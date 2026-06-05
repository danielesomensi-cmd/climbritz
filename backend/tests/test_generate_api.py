"""A026 — tests for POST /api/climbs/generate (problem remix endpoint).

Points climb_service at the dedicated A026 fixture DB
(scripts/seed_a026_test_fixtures.py). Auth uses the X-User-ID dev fallback
(no DB user row needed — the endpoint never reads user data).
"""

import os
import sqlite3
import uuid
from collections import Counter
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import climb_service

client = TestClient(app)

FIXTURE_DB = os.path.join(
    os.path.dirname(__file__), "fixtures", "test_kilter_a026.db"
)


@pytest.fixture(autouse=True)
def mock_boardlib_db():
    with patch("app.services.climb_service.get_settings") as mock:
        mock.return_value.boardlib_db_path = FIXTURE_DB
        yield


def _auth() -> dict:
    return {"X-User-ID": str(uuid.uuid4())}


def _ymap() -> dict[int, int]:
    conn = sqlite3.connect(FIXTURE_DB)
    rows = conn.execute("SELECT id, y FROM holes").fetchall()
    conn.close()
    return {pid: y for pid, y in rows}


# Main pool: angle 40, grade 20, 14 climbs (>= K=10).
MAIN = {"angle": 40, "grade_min": 20, "grade_max": 20, "moves": "any"}


class TestGenerate:
    def test_requires_auth(self):
        resp = client.post("/api/climbs/generate", json=MAIN)
        assert resp.status_code == 401

    def test_valid_request_structure(self):
        resp = client.post("/api/climbs/generate", json=MAIN, headers=_auth())
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert "holds" in body and "meta" in body
        assert body["meta"]["seed_uuid"].startswith("A026-POOL-")
        assert body["meta"]["filters"]["angle"] == 40
        for h in body["holds"]:
            assert set(h) == {"placement_id", "role"}

    def test_at_least_two_swaps(self):
        resp = client.post("/api/climbs/generate", json=MAIN, headers=_auth())
        assert resp.json()["meta"]["swapped_count"] >= 2

    def test_swaps_differ_from_seed(self):
        resp = client.post("/api/climbs/generate", json=MAIN, headers=_auth())
        body = resp.json()
        seed = climb_service.get_holds_for_climbs([body["meta"]["seed_uuid"]])[
            body["meta"]["seed_uuid"]
        ]
        seed_pids = [h["placement_id"] for h in seed]
        new_pids = [h["placement_id"] for h in body["holds"]]
        differing = sum(1 for a, b in zip(seed_pids, new_pids) if a != b)
        assert differing >= 2

    def test_no_duplicate_placement_ids(self):
        for _ in range(15):
            resp = client.post("/api/climbs/generate", json=MAIN, headers=_auth())
            pids = [h["placement_id"] for h in resp.json()["holds"]]
            assert len(pids) == len(set(pids))

    def test_role_ybands_preserved(self):
        ymap = _ymap()
        for _ in range(15):
            resp = client.post("/api/climbs/generate", json=MAIN, headers=_auth())
            for h in resp.json()["holds"]:
                if h["role"] == "start":
                    assert ymap[h["placement_id"]] <= 88
                elif h["role"] == "finish":
                    assert ymap[h["placement_id"]] >= 144

    def test_move_count_preserved_vs_seed(self):
        resp = client.post("/api/climbs/generate", json=MAIN, headers=_auth())
        body = resp.json()
        seed = climb_service.get_holds_for_climbs([body["meta"]["seed_uuid"]])[
            body["meta"]["seed_uuid"]
        ]
        assert Counter(h["role"] for h in body["holds"]) == Counter(
            h["role"] for h in seed
        )

    def test_moves_filter_honored(self):
        # The pool climbs are all 5-move (3 middles) → le5 bucket works,
        # gt10 has no matches → 422.
        ok = client.post(
            "/api/climbs/generate",
            json={**MAIN, "moves": "le5"},
            headers=_auth(),
        )
        assert ok.status_code == 200
        empty = client.post(
            "/api/climbs/generate",
            json={**MAIN, "moves": "gt10"},
            headers=_auth(),
        )
        assert empty.status_code == 422

    def test_grade_filter_honored(self):
        # Grade 24 has no pool climbs → 422.
        resp = client.post(
            "/api/climbs/generate",
            json={"angle": 40, "grade_min": 24, "grade_max": 24, "moves": "any"},
            headers=_auth(),
        )
        assert resp.status_code == 422

    def test_angle_filter_honored_pool_too_small(self):
        # Angle 20 has only 2 climbs (< K=10) → 422.
        resp = client.post(
            "/api/climbs/generate",
            json={"angle": 20, "grade_min": 20, "grade_max": 20, "moves": "any"},
            headers=_auth(),
        )
        assert resp.status_code == 422
        assert "Loosen" in resp.json()["detail"]

    def test_grade_min_above_max_rejected(self):
        resp = client.post(
            "/api/climbs/generate",
            json={"angle": 40, "grade_min": 22, "grade_max": 20, "moves": "any"},
            headers=_auth(),
        )
        assert resp.status_code == 422

    def test_grip_types_accepted_but_ignored(self):
        resp = client.post(
            "/api/climbs/generate",
            json={**MAIN, "grip_types": ["crimp", "jug"]},
            headers=_auth(),
        )
        assert resp.status_code == 200

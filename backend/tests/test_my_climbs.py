"""A030: My Problems — CRUD, auth isolation, naming fallback, logs guard
branch, sessions enrichment fallback, and the Discovery merge."""

from __future__ import annotations

import os
import sys
import uuid as uuid_lib
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.main import app
from app.models.climb_log import ClimbLog
from app.models.user import User
from app.models.user_climb import UserClimb
from app.models.user_generated_climb import UserGeneratedClimb
from app.services import problem_name_service
from conftest import TestingSessionLocal

client = TestClient(app)

# Captured at import time, BEFORE the autouse deterministic_name fixture
# patches the module attribute — TestNaming exercises the real function.
_REAL_PROPOSE = problem_name_service.propose_problem_name

FIXTURE_DB = os.path.join(
    os.path.dirname(__file__), "fixtures", "test_kilter.db"
)

# Valid Kilter Original static frames: 1 start + 2 middles + 1 finish + 1 foot.
VALID_FRAMES = "p1001r12p1002r13p1003r13p1004r14p1005r15"
# Seed climb from the fixture BoardLib DB (difficulty 16 @40° → 6a/V3).
SEED_UUID = "UUID-BENCH-001"


@pytest.fixture(autouse=True)
def mock_boardlib_db():
    """Point climb_service at the fixture BoardLib DB (seed grade prefill +
    logs guard + search merge all touch it)."""
    with patch("app.services.climb_service.get_settings") as mock:
        mock.return_value.boardlib_db_path = FIXTURE_DB
        yield


@pytest.fixture(autouse=True)
def deterministic_name():
    """Make AI naming deterministic and offline by default. The fallback
    path itself is tested explicitly in TestNaming."""
    with patch(
        "app.services.my_climbs_service.problem_name_service.propose_problem_name",
        return_value="Test Problem Name",
    ):
        yield


@pytest.fixture(autouse=True)
def clean_tables():
    db = TestingSessionLocal()
    db.query(ClimbLog).delete()
    db.query(UserClimb).delete()
    db.query(UserGeneratedClimb).delete()
    db.commit()
    db.close()
    yield


def _create_user() -> User:
    db = TestingSessionLocal()
    user = User(
        id=str(uuid_lib.uuid4()),
        clerk_id=f"user_test_{uuid_lib.uuid4().hex[:8]}",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    return user


def _auth(user_id: str) -> dict:
    return {"X-User-ID": str(user_id)}


def _save(user_id: str, frames: str = VALID_FRAMES, angle: int = 40,
          seed: str | None = SEED_UUID):
    return client.post(
        "/api/my-climbs",
        json={"frames": frames, "angle": angle, "seed_climb_uuid": seed},
        headers=_auth(user_id),
    )


# ===========================================================================
# CRUD
# ===========================================================================


class TestCrud:
    def test_create_returns_201_with_prefilled_grade(self):
        user = _create_user()
        resp = _save(user.id)
        assert resp.status_code == 201
        body = resp.json()
        assert body["name"] == "Test Problem Name"
        assert body["frames"] == VALID_FRAMES
        assert body["angle"] == 40
        # Seed UUID-BENCH-001 @40° has difficulty 16 → 6a/V3 in the fixture.
        assert body["grade"] == "6a/V3"
        assert body["difficulty"] == 16
        assert body["seed_climb_uuid"] == SEED_UUID
        assert body["ascent_count"] == 0

    def test_create_without_seed_has_null_grade(self):
        user = _create_user()
        resp = _save(user.id, seed=None)
        assert resp.status_code == 201
        assert resp.json()["grade"] is None
        assert resp.json()["difficulty"] is None

    def test_create_unknown_seed_does_not_fail(self):
        user = _create_user()
        resp = _save(user.id, seed="UUID-DOES-NOT-EXIST")
        assert resp.status_code == 201
        assert resp.json()["grade"] is None

    @pytest.mark.parametrize(
        "frames",
        [
            "",                       # empty
            "not-frames",             # garbage
            "p1r12x",                 # trailing junk
            "p1r12p2r99",             # invalid role id
            "p1r12p1r13",             # duplicate placement_id
            "p1r36",                  # Tycho role — not Kilter Original
        ],
    )
    def test_invalid_frames_rejected_422(self, frames):
        user = _create_user()
        resp = _save(user.id, frames=frames)
        assert resp.status_code == 422

    def test_list_newest_first(self):
        user = _create_user()
        first = _save(user.id).json()["uuid"]
        second = _save(user.id, frames="p2001r12p2002r13p2003r14").json()["uuid"]
        resp = client.get("/api/my-climbs", headers=_auth(user.id))
        assert resp.status_code == 200
        uuids = [r["uuid"] for r in resp.json()]
        assert set(uuids) == {first, second}

    def test_detail_includes_parsed_holds(self):
        user = _create_user()
        saved = _save(user.id).json()
        resp = client.get(
            f"/api/my-climbs/{saved['uuid']}", headers=_auth(user.id)
        )
        assert resp.status_code == 200
        holds = resp.json()["holds"]
        assert [h["role"] for h in holds] == [
            "start", "middle", "middle", "finish", "foot_only",
        ]
        assert holds[0]["placement_id"] == 1001
        # Same shape as the BoardLib detail endpoint (x/y/set_id present).
        assert set(holds[0].keys()) == {
            "placement_id", "role", "x", "y", "set_id",
        }

    def test_patch_name_and_grade(self):
        user = _create_user()
        saved = _save(user.id).json()
        resp = client.patch(
            f"/api/my-climbs/{saved['uuid']}",
            json={"name": "Renamed", "grade": "7a/V6"},
            headers=_auth(user.id),
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Renamed"
        assert resp.json()["grade"] == "7a/V6"

    def test_patch_requires_a_field(self):
        user = _create_user()
        saved = _save(user.id).json()
        resp = client.patch(
            f"/api/my-climbs/{saved['uuid']}", json={}, headers=_auth(user.id)
        )
        assert resp.status_code == 422

    def test_delete(self):
        user = _create_user()
        saved = _save(user.id).json()
        resp = client.delete(
            f"/api/my-climbs/{saved['uuid']}", headers=_auth(user.id)
        )
        assert resp.status_code == 204
        assert (
            client.get(
                f"/api/my-climbs/{saved['uuid']}", headers=_auth(user.id)
            ).status_code
            == 404
        )

    def test_requires_auth(self):
        assert client.get("/api/my-climbs").status_code in (401, 403)


# ===========================================================================
# Auth isolation — user B can't see/edit user A's problems
# ===========================================================================


class TestAuthIsolation:
    def test_other_user_cannot_read_patch_delete(self):
        user_a, user_b = _create_user(), _create_user()
        saved = _save(user_a.id).json()

        assert (
            client.get(
                f"/api/my-climbs/{saved['uuid']}", headers=_auth(user_b.id)
            ).status_code
            == 404
        )
        assert (
            client.patch(
                f"/api/my-climbs/{saved['uuid']}",
                json={"name": "Stolen"},
                headers=_auth(user_b.id),
            ).status_code
            == 404
        )
        assert (
            client.delete(
                f"/api/my-climbs/{saved['uuid']}", headers=_auth(user_b.id)
            ).status_code
            == 404
        )

    def test_list_is_user_scoped(self):
        user_a, user_b = _create_user(), _create_user()
        _save(user_a.id)
        resp = client.get("/api/my-climbs", headers=_auth(user_b.id))
        assert resp.json() == []


# ===========================================================================
# Naming — Gemini failure must fall back locally, never fail the save
# ===========================================================================


class TestNaming:
    def test_fallback_name_shape(self):
        import random

        name = problem_name_service._fallback_name(random.Random(42))
        adj, noun = name.split(" ")
        assert adj in problem_name_service._ADJECTIVES
        assert noun in problem_name_service._NOUNS

    def test_propose_falls_back_when_gemini_raises(self):
        with patch(
            "app.services.gemini_service._get_client",
            side_effect=RuntimeError("no api key"),
        ):
            name = _REAL_PROPOSE(grade="6a/V3", angle=40)
        assert any(name.startswith(a + " ") for a in problem_name_service._ADJECTIVES)

    def test_save_succeeds_even_when_naming_uses_fallback(self):
        user = _create_user()
        # Bypass the deterministic_name fixture: real propose path with a
        # broken Gemini client → local fallback → save still 201.
        with patch(
            "app.services.my_climbs_service.problem_name_service.propose_problem_name",
            wraps=_REAL_PROPOSE,
        ), patch(
            "app.services.gemini_service._get_client",
            side_effect=RuntimeError("down"),
        ):
            resp = _save(user.id)
        assert resp.status_code == 201
        assert resp.json()["name"]

    def test_sanitize_rejects_long_output(self):
        assert problem_name_service._sanitize("one two three four five six seven") is None
        assert problem_name_service._sanitize('"Crimp Carnival"') == "Crimp Carnival"


# ===========================================================================
# Logs guard branch (A030 in POST /api/logs)
# ===========================================================================


class TestLogsGuard:
    def test_log_on_own_generated_problem(self):
        user = _create_user()
        saved = _save(user.id).json()
        resp = client.post(
            "/api/logs",
            json={
                "climb_uuid": saved["uuid"],
                "angle": saved["angle"],
                "result_type": "flash",
            },
            headers=_auth(user.id),
        )
        assert resp.status_code == 201
        # ascent_count reflects the flash in the list payload.
        listed = client.get("/api/my-climbs", headers=_auth(user.id)).json()
        assert listed[0]["ascent_count"] == 1

    def test_log_on_another_users_generated_problem_404(self):
        user_a, user_b = _create_user(), _create_user()
        saved = _save(user_a.id).json()
        resp = client.post(
            "/api/logs",
            json={
                "climb_uuid": saved["uuid"],
                "angle": saved["angle"],
                "result_type": "send",
            },
            headers=_auth(user_b.id),
        )
        assert resp.status_code == 404

    def test_boardlib_path_unchanged(self):
        user = _create_user()
        resp = client.post(
            "/api/logs",
            json={"climb_uuid": SEED_UUID, "angle": 40, "result_type": "send"},
            headers=_auth(user.id),
        )
        assert resp.status_code == 201

    def test_sessions_enriched_with_generated_name(self):
        user = _create_user()
        saved = _save(user.id).json()
        client.post(
            "/api/logs",
            json={
                "climb_uuid": saved["uuid"],
                "angle": saved["angle"],
                "result_type": "send",
            },
            headers=_auth(user.id),
        )
        sessions = client.get(
            "/api/logs/sessions", headers=_auth(user.id)
        ).json()
        assert len(sessions) == 1
        log_entries = sessions[0]["climbs"]
        assert log_entries[0]["climb_name"] == "Test Problem Name"


# ===========================================================================
# Discovery merge (A030 my_problems param on /api/climbs/search)
# ===========================================================================


class TestDiscoveryMerge:
    def test_only_returns_just_mine(self):
        user = _create_user()
        saved = _save(user.id).json()
        resp = client.get(
            "/api/climbs/search?my_problems=only", headers=_auth(user.id)
        )
        assert resp.status_code == 200
        body = resp.json()
        assert [c["uuid"] for c in body["climbs"]] == [saved["uuid"]]
        assert body["total_count"] == 1
        row = body["climbs"][0]
        assert row["is_mine"] is True
        assert row["setter"] == "You"
        assert row["quality_average"] is None
        assert row["is_nomatch"] is False
        assert row["grade"] == "6a/V3"

    def test_include_prepends_mine_and_counts_them(self):
        user = _create_user()
        saved = _save(user.id).json()
        base = client.get("/api/climbs/search", headers=_auth(user.id)).json()
        # Default my_problems=include → mine first, BoardLib after.
        assert base["climbs"][0]["uuid"] == saved["uuid"]
        assert base["climbs"][0]["is_mine"] is True
        assert all(c["is_mine"] is False for c in base["climbs"][1:])

        anon = client.get("/api/climbs/search").json()
        assert base["total_count"] == anon["total_count"] + 1

    def test_unauthenticated_has_no_mine(self):
        user = _create_user()
        _save(user.id)
        resp = client.get("/api/climbs/search?my_problems=only")
        # Param ignored when unauthenticated (like done_filter) → BoardLib.
        assert all(
            c["is_mine"] is False for c in resp.json()["climbs"]
        )

    def test_mine_excluded_by_angle_mismatch(self):
        user = _create_user()
        _save(user.id, angle=40)
        resp = client.get(
            "/api/climbs/search?my_problems=only&angle=45",
            headers=_auth(user.id),
        )
        assert resp.json()["climbs"] == []

    def test_mine_filtered_by_grade_range(self):
        user = _create_user()
        _save(user.id)  # seed difficulty 16
        only = "/api/climbs/search?my_problems=only"
        assert (
            len(client.get(f"{only}&grade_min=10&grade_max=20",
                           headers=_auth(user.id)).json()["climbs"]) == 1
        )
        assert (
            client.get(f"{only}&grade_min=20",
                       headers=_auth(user.id)).json()["climbs"] == []
        )

    def test_mine_filtered_by_moves_bucket(self):
        user = _create_user()
        # VALID_FRAMES has 2 middles → 4 moves → le5 bucket.
        _save(user.id)
        only = "/api/climbs/search?my_problems=only"
        assert (
            len(client.get(f"{only}&moves=le5",
                           headers=_auth(user.id)).json()["climbs"]) == 1
        )
        assert (
            client.get(f"{only}&moves=gt10",
                       headers=_auth(user.id)).json()["climbs"] == []
        )

    def test_inapplicable_filters_exclude_mine(self):
        user = _create_user()
        _save(user.id)
        only = "/api/climbs/search?my_problems=only"
        for qs in ("&benchmark=true", "&nomatch=true", "&min_quality=3"):
            assert (
                client.get(f"{only}{qs}", headers=_auth(user.id)).json()["climbs"]
                == []
            ), qs

    def test_min_ascents_uses_my_log_count(self):
        user = _create_user()
        saved = _save(user.id).json()
        only = "/api/climbs/search?my_problems=only&min_ascents=1"
        assert (
            client.get(only, headers=_auth(user.id)).json()["climbs"] == []
        )
        client.post(
            "/api/logs",
            json={
                "climb_uuid": saved["uuid"],
                "angle": saved["angle"],
                "result_type": "flash",
            },
            headers=_auth(user.id),
        )
        rows = client.get(only, headers=_auth(user.id)).json()["climbs"]
        assert len(rows) == 1
        assert rows[0]["ascensionist_count"] == 1

    def test_q_matches_my_problem_name(self):
        user = _create_user()
        saved = _save(user.id).json()
        client.patch(
            f"/api/my-climbs/{saved['uuid']}",
            json={"name": "Velvet Dyno"},
            headers=_auth(user.id),
        )
        resp = client.get(
            "/api/climbs/search?my_problems=only&q=velvet",
            headers=_auth(user.id),
        )
        assert len(resp.json()["climbs"]) == 1

    def test_mine_carry_user_state_overlay(self):
        user = _create_user()
        saved = _save(user.id).json()
        client.post(
            "/api/logs",
            json={
                "climb_uuid": saved["uuid"],
                "angle": saved["angle"],
                "result_type": "flash",
            },
            headers=_auth(user.id),
        )
        resp = client.get(
            "/api/climbs/search?my_problems=only", headers=_auth(user.id)
        )
        row = resp.json()["climbs"][0]
        assert row["user_state"]["best_result"] == "flash"

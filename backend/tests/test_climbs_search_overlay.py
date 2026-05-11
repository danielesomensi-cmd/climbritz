"""A021: tests for the Discovery search overlay (user_state + chip filters).

These tests cover the Python-side Option A overlay: the search endpoint
queries BoardLib for candidates, then enriches each row with the user's
state from the app DB, and pre-filters by include/exclude uuid sets when
the chip filters are active.
"""

from __future__ import annotations

import os
import sys
import uuid
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.main import app
from app.models.climb_log import ClimbLog
from app.models.user import User
from app.models.user_climb import UserClimb
from conftest import TestingSessionLocal

client = TestClient(app)

FIXTURE_DB = os.path.join(
    os.path.dirname(__file__), "fixtures", "test_kilter.db"
)
CLIMB_A = "UUID-BENCH-001"  # Benchmark Alpha — has rows at angle 40 + 45
CLIMB_B = "UUID-BENCH-002"  # Benchmark Beta — angle 40
CLIMB_C = "UUID-BENCH-003"  # The Crimp Test — angle 40
ANGLE = 40


@pytest.fixture(autouse=True)
def mock_boardlib_db():
    with patch("app.services.climb_service.get_settings") as mock:
        mock.return_value.boardlib_db_path = FIXTURE_DB
        yield


@pytest.fixture(autouse=True)
def clean_log_tables():
    db = TestingSessionLocal()
    db.query(ClimbLog).delete()
    db.query(UserClimb).delete()
    db.commit()
    db.close()
    yield


def _create_user() -> User:
    db = TestingSessionLocal()
    user = User(
        id=str(uuid.uuid4()),
        clerk_id=f"user_test_{uuid.uuid4().hex[:8]}",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    return user


def _auth(user_id: str) -> dict:
    return {"X-User-ID": str(user_id)}


def _log(user_id: str, climb_uuid: str, angle: int = ANGLE, result: str = "send") -> None:
    r = client.post(
        "/api/logs",
        json={"climb_uuid": climb_uuid, "angle": angle, "result_type": result},
        headers=_auth(user_id),
    )
    assert r.status_code == 201, r.text


def _set_project(user_id: str, climb_uuid: str, angle: int = ANGLE, on: bool = True) -> None:
    r = client.patch(
        f"/api/user-climbs/{climb_uuid}/project",
        json={"angle": angle, "is_project": on},
        headers=_auth(user_id),
    )
    assert r.status_code == 200


class TestSearchOverlay:
    def test_unauth_request_no_user_state(self):
        """Without auth, every result has user_state=None (or omitted) —
        existing public-search behaviour is preserved."""
        r = client.get(f"/api/climbs/search?q=Benchmark&angle={ANGLE}")
        assert r.status_code == 200
        for row in r.json()["climbs"]:
            assert row.get("user_state") is None

    def test_auth_with_no_logs_user_state_is_null(self):
        """Auth'd user with zero history → every row's user_state is null."""
        user = _create_user()
        r = client.get(
            f"/api/climbs/search?q=Benchmark&angle={ANGLE}",
            headers=_auth(user.id),
        )
        assert r.status_code == 200
        for row in r.json()["climbs"]:
            assert row["user_state"] is None

    def test_auth_attaches_user_state_when_log_exists(self):
        user = _create_user()
        _log(user.id, CLIMB_A, ANGLE, "send")
        r = client.get(
            f"/api/climbs/search?q=Benchmark&angle={ANGLE}",
            headers=_auth(user.id),
        )
        assert r.status_code == 200
        rows = {row["uuid"]: row for row in r.json()["climbs"]}
        assert rows[CLIMB_A]["user_state"] is not None
        assert rows[CLIMB_A]["user_state"]["best_result"] == "send"
        assert rows[CLIMB_A]["user_state"]["is_project"] is False
        # Other rows still null
        assert rows[CLIMB_B]["user_state"] is None

    def test_user_state_isolated_per_angle(self):
        """A send at angle 40 must NOT show up on the angle-45 row of the
        same climb — user_climbs is keyed by (uuid, angle)."""
        user = _create_user()
        _log(user.id, CLIMB_A, angle=40, result="send")
        # CLIMB_A also exists at angle=45 in the fixture
        r = client.get(
            "/api/climbs/search?q=Benchmark Alpha",  # both angles return
            headers=_auth(user.id),
        )
        by_angle = {row["angle"]: row for row in r.json()["climbs"]}
        assert by_angle[40]["user_state"]["best_result"] == "send"
        assert by_angle[45]["user_state"] is None


class TestDoneFilter:
    def test_done_only_returns_only_logged_climbs(self):
        user = _create_user()
        _log(user.id, CLIMB_A, ANGLE, "send")
        # CLIMB_B never logged
        r = client.get(
            f"/api/climbs/search?angle={ANGLE}&done_filter=only",
            headers=_auth(user.id),
        )
        names = [row["uuid"] for row in r.json()["climbs"]]
        assert CLIMB_A in names
        assert CLIMB_B not in names

    def test_done_only_empty_when_no_logs(self):
        """User has no logs → done_filter=only returns zero results
        (short-circuit via include_uuids=[])."""
        user = _create_user()
        r = client.get(
            f"/api/climbs/search?angle={ANGLE}&done_filter=only",
            headers=_auth(user.id),
        )
        assert r.json()["climbs"] == []
        assert r.json()["total_count"] == 0

    def test_done_exclude_omits_logged_climbs(self):
        user = _create_user()
        _log(user.id, CLIMB_A, ANGLE, "send")
        r = client.get(
            f"/api/climbs/search?angle={ANGLE}&done_filter=exclude",
            headers=_auth(user.id),
        )
        uuids = [row["uuid"] for row in r.json()["climbs"]]
        assert CLIMB_A not in uuids
        assert CLIMB_B in uuids

    def test_done_filter_ignores_attempt_only_logs(self):
        """A user with only attempts (no send/flash) hasn't 'done' anything.
        best_result stays None → list_done_climb_uuids skips them."""
        user = _create_user()
        _log(user.id, CLIMB_A, ANGLE, "attempt")
        r = client.get(
            f"/api/climbs/search?angle={ANGLE}&done_filter=only",
            headers=_auth(user.id),
        )
        # An attempt does NOT count as done.
        assert r.json()["climbs"] == []


class TestProjectFilter:
    def test_project_only_returns_flagged_climbs(self):
        user = _create_user()
        _set_project(user.id, CLIMB_A, ANGLE, on=True)
        r = client.get(
            f"/api/climbs/search?angle={ANGLE}&project_filter=only",
            headers=_auth(user.id),
        )
        uuids = [row["uuid"] for row in r.json()["climbs"]]
        assert uuids == [CLIMB_A]

    def test_project_exclude_omits_flagged_climbs(self):
        user = _create_user()
        _set_project(user.id, CLIMB_A, ANGLE, on=True)
        r = client.get(
            f"/api/climbs/search?angle={ANGLE}&project_filter=exclude",
            headers=_auth(user.id),
        )
        uuids = [row["uuid"] for row in r.json()["climbs"]]
        assert CLIMB_A not in uuids
        assert CLIMB_B in uuids


class TestCombinedFilters:
    def test_done_only_and_project_only_intersect(self):
        """Both chips active = climbs that are done AND flagged project."""
        user = _create_user()
        # A: project + send → matches both
        _log(user.id, CLIMB_A, ANGLE, "send")
        _set_project(user.id, CLIMB_A, ANGLE, on=True)
        # B: only project (no send) → matches project but not done
        _set_project(user.id, CLIMB_B, ANGLE, on=True)
        # C: only send → matches done but not project
        _log(user.id, CLIMB_C, ANGLE, "send")

        r = client.get(
            f"/api/climbs/search?angle={ANGLE}"
            "&done_filter=only&project_filter=only",
            headers=_auth(user.id),
        )
        uuids = [row["uuid"] for row in r.json()["climbs"]]
        assert uuids == [CLIMB_A]

    def test_filters_dont_disable_animated_exclusion(self):
        """Animated sequences (frames_count > 1) are excluded globally;
        flipping chip filters must not bypass that."""
        user = _create_user()
        r = client.get(
            f"/api/climbs/search?angle={ANGLE}&done_filter=exclude",
            headers=_auth(user.id),
        )
        names = [row["name"] for row in r.json()["climbs"]]
        assert "A019 Fixture - Animated Sequence" not in names


class TestUnauthIgnoresFilters:
    def test_unauth_done_only_returns_results(self):
        """Without auth, chip filters are silently ignored (no user_id to
        resolve include/exclude). Same response as a plain search."""
        r_filtered = client.get(
            f"/api/climbs/search?angle={ANGLE}&done_filter=only"
        )
        r_plain = client.get(f"/api/climbs/search?angle={ANGLE}")
        assert r_filtered.json()["total_count"] == r_plain.json()["total_count"]


class TestTotalCountWithFilters:
    def test_total_count_reflects_chip_filters(self):
        """total_count must use the same include/exclude logic — otherwise
        the overflow banner would be wrong when chips are active."""
        user = _create_user()
        _log(user.id, CLIMB_A, ANGLE, "send")
        r = client.get(
            f"/api/climbs/search?angle={ANGLE}&done_filter=only",
            headers=_auth(user.id),
        )
        body = r.json()
        # Only one climb done, so total_count must be 1.
        assert body["total_count"] == 1
        assert len(body["climbs"]) == 1

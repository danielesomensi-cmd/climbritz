"""A021: tests for /api/stats endpoints (pyramid + trend)."""

from __future__ import annotations

import os
import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.main import app
from app.models.climb_log import ClimbLog
from app.models.user import User
from app.models.user_climb import UserClimb
from app.services import log_service
from conftest import TestingSessionLocal

client = TestClient(app)

FIXTURE_DB = os.path.join(
    os.path.dirname(__file__), "fixtures", "test_kilter.db"
)
CLIMB_A = "UUID-BENCH-001"
CLIMB_B = "UUID-BENCH-002"
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


def _log(user_id: str, climb_uuid: str, angle: int, result: str) -> None:
    r = client.post(
        "/api/logs",
        json={"climb_uuid": climb_uuid, "angle": angle, "result_type": result},
        headers=_auth(user_id),
    )
    assert r.status_code == 201, r.text


def _insert_log_at_date(
    user_id: str,
    climb_uuid: str,
    angle: int,
    result: str,
    when: date,
) -> None:
    """Bypass the API to seed a log dated in the past (the API stamps
    today's local_date)."""
    db = TestingSessionLocal()
    try:
        log = ClimbLog(
            id=str(uuid.uuid4()),
            user_id=user_id,
            climb_uuid=climb_uuid,
            angle=angle,
            local_date=when,
            result_type=result,
            attempts_count=1,
        )
        db.add(log)
        db.flush()
        log_service._recompute_user_climb(db, user_id, climb_uuid, angle)
        db.commit()
    finally:
        db.close()


class TestPyramid:
    def test_pyramid_requires_auth(self):
        r = client.get("/api/stats/pyramid")
        assert r.status_code == 401

    def test_pyramid_empty_for_new_user(self):
        user = _create_user()
        r = client.get("/api/stats/pyramid", headers=_auth(user.id))
        assert r.status_code == 200
        assert r.json() == []

    def test_pyramid_counts_sends_by_grade(self):
        user = _create_user()
        _log(user.id, CLIMB_A, ANGLE, "send")
        _log(user.id, CLIMB_B, ANGLE, "send")
        r = client.get("/api/stats/pyramid", headers=_auth(user.id))
        assert r.status_code == 200
        entries = {e["grade_band"]: e["count"] for e in r.json()}
        # Fixture: Alpha@40 → grade 16, Beta@40 → grade 20.
        # Different grades → two separate entries, count=1 each.
        assert sum(entries.values()) == 2
        assert len(entries) == 2

    def test_pyramid_flash_filter(self):
        """result_filter=flash drops sends from the count."""
        user = _create_user()
        _log(user.id, CLIMB_A, ANGLE, "flash")
        _log(user.id, CLIMB_B, ANGLE, "send")
        r = client.get(
            "/api/stats/pyramid?result_filter=flash",
            headers=_auth(user.id),
        )
        entries = r.json()
        # Only flash counts → exactly 1 entry total
        assert sum(e["count"] for e in entries) == 1

    def test_pyramid_all_filter_counts_attempts(self):
        """result_filter=all also counts attempts."""
        user = _create_user()
        _log(user.id, CLIMB_A, ANGLE, "attempt")
        r = client.get(
            "/api/stats/pyramid?result_filter=all",
            headers=_auth(user.id),
        )
        entries = r.json()
        assert sum(e["count"] for e in entries) == 1


class TestTrend:
    def test_trend_requires_auth(self):
        r = client.get("/api/stats/trend")
        assert r.status_code == 401

    def test_trend_empty_for_new_user(self):
        user = _create_user()
        r = client.get("/api/stats/trend", headers=_auth(user.id))
        assert r.status_code == 200
        assert r.json() == []

    def test_trend_buckets_by_iso_week(self):
        user = _create_user()
        # Two sends in the same ISO week → one trend entry.
        # 2026-05-11 is a Monday — same week as 2026-05-13.
        _insert_log_at_date(user.id, CLIMB_A, ANGLE, "send", date(2026, 5, 11))
        _insert_log_at_date(user.id, CLIMB_B, ANGLE, "send", date(2026, 5, 13))

        r = client.get("/api/stats/trend", headers=_auth(user.id))
        assert r.status_code == 200
        entries = r.json()
        assert len(entries) == 1
        assert entries[0]["week_start"] == "2026-05-11"
        assert entries[0]["send_count"] == 2

    def test_trend_separate_weeks(self):
        user = _create_user()
        # Different ISO weeks: 2026-05-11 (Mon) vs 2026-05-18 (next Mon).
        _insert_log_at_date(user.id, CLIMB_A, ANGLE, "send", date(2026, 5, 11))
        _insert_log_at_date(user.id, CLIMB_B, ANGLE, "flash", date(2026, 5, 18))

        r = client.get("/api/stats/trend", headers=_auth(user.id))
        entries = r.json()
        assert len(entries) == 2
        weeks = {e["week_start"]: e for e in entries}
        assert weeks["2026-05-11"]["send_count"] == 1
        assert weeks["2026-05-18"]["flash_count"] == 1

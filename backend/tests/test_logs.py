"""A021: tests for climb logging API + log_service sync rules + tz resolution."""

from __future__ import annotations

import os
import sys
import uuid
from datetime import date, datetime, timezone
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
# A real, single-frame climb from the fixture DB.
CLIMB_UUID = "UUID-BENCH-001"
CLIMB_ANGLE = 40
# The animated row in the fixture (frames_count=3) — must be rejected.
ANIMATED_UUID = "UUID-A019-ANIMATED"


@pytest.fixture(autouse=True)
def mock_boardlib_db():
    """Point climb_service.get_climb_meta at the test fixture so log
    creation can validate frames_count without a real BoardLib DB."""
    with patch("app.services.climb_service.get_settings") as mock:
        mock.return_value.boardlib_db_path = FIXTURE_DB
        yield


@pytest.fixture(autouse=True)
def clean_log_tables():
    """A clean (climb_logs, user_climbs) slate per test. Users persist
    across tests via the in-memory conftest DB, so each test creates its
    own user to avoid log cross-contamination."""
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


# ===========================================================================
# Timezone resolution — UNIT tests on log_service.resolve_local_date
# ===========================================================================


class TestResolveLocalDate:
    """Carry the exact tz cases the user specified during the Phase 2 brief."""

    def test_europe_rome_may_dst_crosses_midnight(self):
        """22:30 UTC on 2026-05-11 = 00:30 CEST on 2026-05-12 (UTC+2)."""
        received = datetime(2026, 5, 11, 22, 30, 0, tzinfo=timezone.utc)
        result = log_service.resolve_local_date(received, "Europe/Rome")
        assert result == date(2026, 5, 12)

    def test_europe_rome_january_no_dst_crosses_midnight(self):
        """22:30 UTC on 2026-01-15 = 23:30 CET on 2026-01-15 (UTC+1).
        Just below midnight in winter, so local_date stays same day."""
        received = datetime(2026, 1, 15, 22, 30, 0, tzinfo=timezone.utc)
        result = log_service.resolve_local_date(received, "Europe/Rome")
        assert result == date(2026, 1, 15)

    def test_europe_rome_january_late_evening_crosses_midnight(self):
        """23:30 UTC on 2026-01-15 = 00:30 CET on 2026-01-16 (UTC+1).
        Companion to the May test — covers the brief's 'must persist
        local_date = 2026-05-12' assertion in winter."""
        received = datetime(2026, 1, 15, 23, 30, 0, tzinfo=timezone.utc)
        result = log_service.resolve_local_date(received, "Europe/Rome")
        assert result == date(2026, 1, 16)

    def test_no_tz_header_falls_back_to_utc(self):
        """22:30 UTC + no header → local_date = the UTC day."""
        received = datetime(2026, 5, 11, 22, 30, 0, tzinfo=timezone.utc)
        result = log_service.resolve_local_date(received, None)
        assert result == date(2026, 5, 11)

    def test_empty_tz_header_falls_back_to_utc(self):
        received = datetime(2026, 5, 11, 22, 30, 0, tzinfo=timezone.utc)
        result = log_service.resolve_local_date(received, "")
        assert result == date(2026, 5, 11)

    def test_la_negative_offset_rewinds_a_day(self):
        """06:00 UTC + America/Los_Angeles (UTC-7 in May) = 23:00 prev day."""
        received = datetime(2026, 5, 11, 6, 0, 0, tzinfo=timezone.utc)
        result = log_service.resolve_local_date(
            received, "America/Los_Angeles"
        )
        assert result == date(2026, 5, 10)

    def test_invalid_tz_falls_back_to_utc(self):
        """Garbage tz string should not crash — fall back to UTC silently
        so a misconfigured client doesn't 500 every log call."""
        received = datetime(2026, 5, 11, 22, 30, 0, tzinfo=timezone.utc)
        result = log_service.resolve_local_date(received, "Mars/Olympus_Mons")
        assert result == date(2026, 5, 11)

    def test_naive_datetime_treated_as_utc(self):
        """Defensive: a naive dt should be assumed UTC, not crash."""
        received = datetime(2026, 5, 11, 22, 30, 0)  # naive
        result = log_service.resolve_local_date(received, "Europe/Rome")
        assert result == date(2026, 5, 12)


# ===========================================================================
# POST /api/logs end-to-end + sync rules
# ===========================================================================


class TestCreateLog:
    def test_create_log_returns_201_and_envelope(self):
        user = _create_user()
        resp = client.post(
            "/api/logs",
            json={
                "climb_uuid": CLIMB_UUID,
                "angle": CLIMB_ANGLE,
                "result_type": "send",
            },
            headers=_auth(user.id),
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert "log" in body
        assert "user_state" in body
        assert body["log"]["result_type"] == "send"
        assert body["log"]["attempts_count"] == 1
        assert body["log"]["user_id"] == user.id

    def test_create_log_materializes_user_climb(self):
        user = _create_user()
        client.post(
            "/api/logs",
            json={
                "climb_uuid": CLIMB_UUID,
                "angle": CLIMB_ANGLE,
                "result_type": "send",
            },
            headers=_auth(user.id),
        )
        db = TestingSessionLocal()
        try:
            uc = (
                db.query(UserClimb)
                .filter(
                    UserClimb.user_id == user.id,
                    UserClimb.climb_uuid == CLIMB_UUID,
                )
                .one()
            )
            assert uc.best_result == "send"
            assert uc.is_project is False
            assert uc.last_logged_at is not None
        finally:
            db.close()

    def test_create_requires_auth(self):
        resp = client.post(
            "/api/logs",
            json={
                "climb_uuid": CLIMB_UUID,
                "angle": CLIMB_ANGLE,
                "result_type": "send",
            },
        )
        assert resp.status_code == 401

    def test_create_rejects_animated_sequence(self):
        """A021: animated multi-frame climbs (frames_count > 1) cannot be
        logged — they're circuits, excluded from Discovery globally."""
        user = _create_user()
        resp = client.post(
            "/api/logs",
            json={
                "climb_uuid": ANIMATED_UUID,
                "angle": CLIMB_ANGLE,
                "result_type": "send",
            },
            headers=_auth(user.id),
        )
        assert resp.status_code == 422
        assert "animated" in resp.json()["detail"].lower()

    def test_create_rejects_nonexistent_climb(self):
        user = _create_user()
        resp = client.post(
            "/api/logs",
            json={
                "climb_uuid": "UUID-DOES-NOT-EXIST",
                "angle": CLIMB_ANGLE,
                "result_type": "send",
            },
            headers=_auth(user.id),
        )
        assert resp.status_code == 404

    def test_create_rejects_invalid_result_type(self):
        user = _create_user()
        resp = client.post(
            "/api/logs",
            json={
                "climb_uuid": CLIMB_UUID,
                "angle": CLIMB_ANGLE,
                "result_type": "DNF",
            },
            headers=_auth(user.id),
        )
        assert resp.status_code == 422


class TestSameDayUpgradeRules:
    def test_attempt_twice_increments_count(self):
        user = _create_user()
        for _ in range(2):
            r = client.post(
                "/api/logs",
                json={
                    "climb_uuid": CLIMB_UUID,
                    "angle": CLIMB_ANGLE,
                    "result_type": "attempt",
                },
                headers=_auth(user.id),
            )
            assert r.status_code == 201
        body = r.json()
        assert body["log"]["attempts_count"] == 2
        assert body["log"]["result_type"] == "attempt"

    def test_attempt_then_send_upgrades_and_increments(self):
        user = _create_user()
        client.post(
            "/api/logs",
            json={
                "climb_uuid": CLIMB_UUID,
                "angle": CLIMB_ANGLE,
                "result_type": "attempt",
            },
            headers=_auth(user.id),
        )
        r = client.post(
            "/api/logs",
            json={
                "climb_uuid": CLIMB_UUID,
                "angle": CLIMB_ANGLE,
                "result_type": "send",
            },
            headers=_auth(user.id),
        )
        body = r.json()
        assert body["log"]["result_type"] == "send"
        assert body["log"]["attempts_count"] == 2
        assert body["user_state"]["best_result"] == "send"

    def test_send_then_attempt_does_not_downgrade(self):
        """Tapping Attempt after Send should not erase the send — it
        should only bump attempts_count."""
        user = _create_user()
        client.post(
            "/api/logs",
            json={
                "climb_uuid": CLIMB_UUID,
                "angle": CLIMB_ANGLE,
                "result_type": "send",
            },
            headers=_auth(user.id),
        )
        r = client.post(
            "/api/logs",
            json={
                "climb_uuid": CLIMB_UUID,
                "angle": CLIMB_ANGLE,
                "result_type": "attempt",
            },
            headers=_auth(user.id),
        )
        body = r.json()
        assert body["log"]["result_type"] == "send"
        assert body["log"]["attempts_count"] == 2

    def test_flash_overrides_send(self):
        user = _create_user()
        client.post(
            "/api/logs",
            json={
                "climb_uuid": CLIMB_UUID,
                "angle": CLIMB_ANGLE,
                "result_type": "send",
            },
            headers=_auth(user.id),
        )
        r = client.post(
            "/api/logs",
            json={
                "climb_uuid": CLIMB_UUID,
                "angle": CLIMB_ANGLE,
                "result_type": "flash",
            },
            headers=_auth(user.id),
        )
        assert r.json()["log"]["result_type"] == "flash"
        assert r.json()["user_state"]["best_result"] == "flash"

    def test_send_does_not_override_flash(self):
        user = _create_user()
        client.post(
            "/api/logs",
            json={
                "climb_uuid": CLIMB_UUID,
                "angle": CLIMB_ANGLE,
                "result_type": "flash",
            },
            headers=_auth(user.id),
        )
        r = client.post(
            "/api/logs",
            json={
                "climb_uuid": CLIMB_UUID,
                "angle": CLIMB_ANGLE,
                "result_type": "send",
            },
            headers=_auth(user.id),
        )
        assert r.json()["log"]["result_type"] == "flash"


# ===========================================================================
# Endpoint-level X-User-Timezone routing — proves the header is plumbed all
# the way through. (Unit-level tests above already cover the resolver in
# isolation.)
# ===========================================================================


class TestPostLogTimezoneRouting:
    def test_post_uses_x_user_timezone_header(self):
        """POST /api/logs at any UTC instant + X-User-Timezone=Europe/Rome
        should persist a local_date that matches the resolver output."""
        user = _create_user()

        fixed_now = datetime(2026, 5, 11, 22, 30, 0, tzinfo=timezone.utc)
        with patch("app.api.logs.datetime") as dt_mock:
            dt_mock.now.return_value = fixed_now
            dt_mock.side_effect = lambda *a, **k: datetime(*a, **k)
            resp = client.post(
                "/api/logs",
                json={
                    "climb_uuid": CLIMB_UUID,
                    "angle": CLIMB_ANGLE,
                    "result_type": "send",
                },
                headers={
                    **_auth(user.id),
                    "X-User-Timezone": "Europe/Rome",
                },
            )
        assert resp.status_code == 201
        # 22:30 UTC = 00:30 CEST next day in May
        assert resp.json()["log"]["local_date"] == "2026-05-12"

    def test_post_falls_back_to_utc_without_header(self):
        user = _create_user()
        fixed_now = datetime(2026, 5, 11, 22, 30, 0, tzinfo=timezone.utc)
        with patch("app.api.logs.datetime") as dt_mock:
            dt_mock.now.return_value = fixed_now
            dt_mock.side_effect = lambda *a, **k: datetime(*a, **k)
            resp = client.post(
                "/api/logs",
                json={
                    "climb_uuid": CLIMB_UUID,
                    "angle": CLIMB_ANGLE,
                    "result_type": "send",
                },
                headers=_auth(user.id),
            )
        assert resp.status_code == 201
        # No header → UTC fallback → same day as the UTC instant
        assert resp.json()["log"]["local_date"] == "2026-05-11"


# ===========================================================================
# DELETE /api/logs/{id} + recompute correctness
# ===========================================================================


class TestDeleteLog:
    def test_delete_removes_log_row(self):
        user = _create_user()
        resp = client.post(
            "/api/logs",
            json={
                "climb_uuid": CLIMB_UUID,
                "angle": CLIMB_ANGLE,
                "result_type": "send",
            },
            headers=_auth(user.id),
        )
        log_id = resp.json()["log"]["id"]
        r = client.delete(f"/api/logs/{log_id}", headers=_auth(user.id))
        assert r.status_code == 204

        db = TestingSessionLocal()
        try:
            assert (
                db.query(ClimbLog).filter(ClimbLog.id == log_id).one_or_none()
                is None
            )
        finally:
            db.close()

    def test_delete_recomputes_best_result(self):
        """After removing the only send, best_result should fall back to
        None (no remaining flash/send logs for that climb)."""
        user = _create_user()
        resp = client.post(
            "/api/logs",
            json={
                "climb_uuid": CLIMB_UUID,
                "angle": CLIMB_ANGLE,
                "result_type": "send",
            },
            headers=_auth(user.id),
        )
        log_id = resp.json()["log"]["id"]
        client.delete(f"/api/logs/{log_id}", headers=_auth(user.id))

        db = TestingSessionLocal()
        try:
            uc = (
                db.query(UserClimb)
                .filter(
                    UserClimb.user_id == user.id,
                    UserClimb.climb_uuid == CLIMB_UUID,
                )
                .one()
            )
            assert uc.best_result is None
        finally:
            db.close()

    def test_delete_nonexistent_returns_404(self):
        user = _create_user()
        r = client.delete(
            f"/api/logs/{uuid.uuid4()}", headers=_auth(user.id)
        )
        assert r.status_code == 404

    def test_delete_other_users_log_returns_404(self):
        """Cross-user isolation: user A cannot delete user B's log."""
        user_a = _create_user()
        user_b = _create_user()
        resp = client.post(
            "/api/logs",
            json={
                "climb_uuid": CLIMB_UUID,
                "angle": CLIMB_ANGLE,
                "result_type": "send",
            },
            headers=_auth(user_a.id),
        )
        log_id = resp.json()["log"]["id"]
        r = client.delete(f"/api/logs/{log_id}", headers=_auth(user_b.id))
        assert r.status_code == 404


# ===========================================================================
# Project toggle independence
# ===========================================================================


class TestProjectToggle:
    def test_toggle_creates_state_row_when_no_logs(self):
        user = _create_user()
        r = client.patch(
            f"/api/user-climbs/{CLIMB_UUID}/project",
            json={"angle": CLIMB_ANGLE, "is_project": True},
            headers=_auth(user.id),
        )
        assert r.status_code == 200
        assert r.json()["is_project"] is True
        assert r.json()["best_result"] is None

    def test_toggle_preserves_best_result(self):
        """Flipping the project flag must not erase best_result from logs."""
        user = _create_user()
        client.post(
            "/api/logs",
            json={
                "climb_uuid": CLIMB_UUID,
                "angle": CLIMB_ANGLE,
                "result_type": "send",
            },
            headers=_auth(user.id),
        )
        client.patch(
            f"/api/user-climbs/{CLIMB_UUID}/project",
            json={"angle": CLIMB_ANGLE, "is_project": True},
            headers=_auth(user.id),
        )
        r = client.get(
            f"/api/user-climbs/{CLIMB_UUID}?angle={CLIMB_ANGLE}",
            headers=_auth(user.id),
        )
        body = r.json()
        assert body["state"]["is_project"] is True
        assert body["state"]["best_result"] == "send"


# ===========================================================================
# GET /api/logs/sessions
# ===========================================================================


class TestListSessions:
    def test_sessions_groups_by_local_date(self):
        user = _create_user()
        # Two logs on the same day → one session with 2 climbs
        client.post(
            "/api/logs",
            json={
                "climb_uuid": CLIMB_UUID,
                "angle": CLIMB_ANGLE,
                "result_type": "send",
            },
            headers=_auth(user.id),
        )
        client.post(
            "/api/logs",
            json={
                "climb_uuid": "UUID-BENCH-002",
                "angle": CLIMB_ANGLE,
                "result_type": "flash",
            },
            headers=_auth(user.id),
        )
        r = client.get("/api/logs/sessions", headers=_auth(user.id))
        assert r.status_code == 200
        sessions = r.json()
        assert len(sessions) == 1
        assert sessions[0]["total_climbs"] == 2
        assert sessions[0]["sends"] == 1
        assert sessions[0]["flashes"] == 1

    def test_sessions_climbs_carry_name_and_grade(self):
        """A021.5 — each climb in the session list is enriched with
        name + grade resolved server-side from BoardLib, so the
        /history page can render readable session cards in one
        request instead of N follow-up climb-detail fetches."""
        user = _create_user()
        client.post(
            "/api/logs",
            json={
                "climb_uuid": CLIMB_UUID,
                "angle": CLIMB_ANGLE,
                "result_type": "send",
            },
            headers=_auth(user.id),
        )
        r = client.get("/api/logs/sessions", headers=_auth(user.id))
        assert r.status_code == 200
        climbs = r.json()[0]["climbs"]
        assert len(climbs) == 1
        # Fixture: UUID-BENCH-001 / angle 40 → "Benchmark Alpha"
        # with display difficulty 16 → boulder name "6a/V3" (in fixture).
        assert climbs[0]["climb_name"] == "Benchmark Alpha"
        assert climbs[0]["grade"] is not None

    def test_sessions_empty_for_new_user(self):
        user = _create_user()
        r = client.get("/api/logs/sessions", headers=_auth(user.id))
        assert r.status_code == 200
        assert r.json() == []

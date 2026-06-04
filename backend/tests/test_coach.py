"""A025: tests for POST /api/coach/summary (text-only Gemini progress comment).

The Gemini call is mocked at the service boundary (``_call_gemini``) so these
tests are fast, deterministic and never hit the network / need an API key.
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
CLIMB_A = "UUID-BENCH-001"
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
    user = User(id=str(uuid.uuid4()), clerk_id=f"user_test_{uuid.uuid4().hex[:8]}")
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    return user


def _auth(user_id: str) -> dict:
    return {"X-User-ID": str(user_id)}


def _log(user_id: str, result: str) -> None:
    r = client.post(
        "/api/logs",
        json={"climb_uuid": CLIMB_A, "angle": ANGLE, "result_type": result},
        headers=_auth(user_id),
    )
    assert r.status_code == 201, r.text


class TestCoachSummary:
    def test_requires_auth(self):
        r = client.post("/api/coach/summary")
        assert r.status_code == 401

    def test_empty_range_returns_fallback_without_calling_gemini(self):
        user = _create_user()
        with patch(
            "app.services.coach_summary_service._call_gemini"
        ) as gem:
            r = client.post("/api/coach/summary", headers=_auth(user.id))
        assert r.status_code == 200
        body = r.json()
        assert "summary" in body
        assert isinstance(body["summary"], str) and body["summary"]
        # 0 sessions → short-circuit, Gemini must NOT be called.
        gem.assert_not_called()

    def test_returns_generated_summary_shape(self):
        user = _create_user()
        _log(user.id, "flash")
        _log(user.id, "send")
        fake = "You flashed a problem and sent another — strong, consistent work!"
        with patch(
            "app.services.coach_summary_service._call_gemini",
            return_value=fake,
        ) as gem:
            r = client.post("/api/coach/summary", headers=_auth(user.id))
        assert r.status_code == 200
        assert r.json() == {"summary": fake}
        gem.assert_called_once()

    def test_none_text_falls_back(self):
        user = _create_user()
        _log(user.id, "send")
        # Gemini produced no text part → service returns the fallback string.
        with patch(
            "app.services.coach_summary_service._call_gemini",
            return_value=None,
        ):
            r = client.post("/api/coach/summary", headers=_auth(user.id))
        assert r.status_code == 200
        assert r.json()["summary"] == (
            coach_fallback()
        )

    def test_gemini_exception_returns_502(self):
        user = _create_user()
        _log(user.id, "send")
        with patch(
            "app.services.coach_summary_service._call_gemini",
            side_effect=RuntimeError("boom"),
        ):
            r = client.post("/api/coach/summary", headers=_auth(user.id))
        assert r.status_code == 502


def coach_fallback() -> str:
    from app.services.coach_summary_service import FALLBACK_SUMMARY

    return FALLBACK_SUMMARY

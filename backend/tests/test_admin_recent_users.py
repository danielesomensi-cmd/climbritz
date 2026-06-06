"""Tests for GET /api/admin/recent-users (Clerk identity + in-app activity).

The Clerk Backend API is always mocked — pytest never makes a real HTTP call.
We assert the server-side join: a mocked Clerk user is enriched with the
activity counts of its local shadow row, and a device label is surfaced.
"""

import datetime
import os
import sys
import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.models.climb_log import ClimbLog
from app.models.user import User
from app.models.user_hold_classification import UserHoldClassification
from app.services import clerk_admin_service
from app.main import app
from conftest import TestingSessionLocal

client = TestClient(app)

SECRET = "test-admin-secret"


def _hdr(secret: str = SECRET) -> dict:
    return {"X-Admin-Secret": secret}


def _settings(clerk_key: str = "sk_test_fake") -> MagicMock:
    s = MagicMock()
    s.clerk_secret_key = clerk_key
    return s


def _seed_user_with_activity() -> str:
    """Create a shadow row + 2 climb logs + 1 classification; return clerk_id."""
    clerk_id = f"user_{uuid.uuid4().hex[:10]}"
    db = TestingSessionLocal()
    user = User(id=str(uuid.uuid4()), clerk_id=clerk_id)
    db.add(user)
    db.flush()
    for i in range(2):
        db.add(
            ClimbLog(
                id=str(uuid.uuid4()),
                user_id=user.id,
                climb_uuid=f"climb-{i}",
                angle=40,
                local_date=datetime.date(2026, 6, 1),
                result_type="send",
                attempts_count=1,
            )
        )
    db.add(
        UserHoldClassification(
            id=str(uuid.uuid4()),
            user_id=user.id,
            placement_id=1234,
            category="crimp",
        )
    )
    db.commit()
    db.close()
    return clerk_id


def test_rejects_invalid_admin_secret():
    with patch("app.api.admin.ADMIN_SECRET", SECRET):
        resp = client.get("/api/admin/recent-users", headers=_hdr("wrong"))
    assert resp.status_code == 403


def test_missing_admin_secret_header():
    # Header(...) is required → FastAPI 422 before our handler runs.
    resp = client.get("/api/admin/recent-users")
    assert resp.status_code == 422


def test_503_when_clerk_secret_unconfigured():
    with patch("app.api.admin.ADMIN_SECRET", SECRET), patch(
        "app.api.admin.get_settings", return_value=_settings(clerk_key="")
    ):
        resp = client.get("/api/admin/recent-users", headers=_hdr())
    assert resp.status_code == 503


def test_502_on_clerk_api_error():
    with patch("app.api.admin.ADMIN_SECRET", SECRET), patch(
        "app.api.admin.get_settings", return_value=_settings()
    ), patch.object(
        clerk_admin_service,
        "list_recent_users",
        side_effect=clerk_admin_service.ClerkApiError("boom"),
    ):
        resp = client.get("/api/admin/recent-users", headers=_hdr())
    assert resp.status_code == 502


def test_joins_clerk_user_with_local_activity_and_device():
    clerk_id = _seed_user_with_activity()
    fake_users = [
        {
            "clerk_id": clerk_id,
            "email": "new@tester.com",
            "name": "New Tester",
            "created_at": "2026-06-05T10:00:00+00:00",
            "last_sign_in_at": "2026-06-05T10:05:00+00:00",
            "last_active_at": "2026-06-05T10:06:00+00:00",
        }
    ]
    fake_devices = [
        {
            "platform": "iOS",
            "device_type": "iPhone",
            "is_mobile": True,
            "browser": "Mobile Safari",
            "ip": "1.2.3.4",
            "city": "Bolzano",
            "country": "IT",
            "session_status": "active",
            "last_active_at": "2026-06-05T10:06:00+00:00",
        }
    ]
    with patch("app.api.admin.ADMIN_SECRET", SECRET), patch(
        "app.api.admin.get_settings", return_value=_settings()
    ), patch.object(
        clerk_admin_service, "list_recent_users", return_value=fake_users
    ), patch.object(
        clerk_admin_service, "get_user_devices", return_value=fake_devices
    ):
        resp = client.get("/api/admin/recent-users", headers=_hdr())

    assert resp.status_code == 200
    body = resp.json()
    assert body["count"] == 1
    user = body["users"][0]
    assert user["email"] == "new@tester.com"
    assert user["activity"]["has_local_row"] is True
    assert user["activity"]["climb_logs"] == 2
    assert user["activity"]["classifications"] == 1
    assert user["activity"]["videos"] == 0
    assert user["devices"][0]["platform"] == "iOS"


def test_notify_rejects_invalid_admin_secret():
    with patch("app.api.admin.ADMIN_SECRET", SECRET):
        resp = client.post("/api/admin/notify-recent-users", headers=_hdr("wrong"))
    assert resp.status_code == 403


def test_notify_pushes_summary_to_telegram():
    clerk_id = _seed_user_with_activity()
    fake_users = [
        {
            "clerk_id": clerk_id,
            "email": "new@tester.com",
            "name": "New Tester",
            "created_at": "2026-06-05T10:00:00+00:00",
            "last_sign_in_at": "2026-06-05T10:05:00+00:00",
            "last_active_at": "2026-06-05T10:06:00+00:00",
        }
    ]
    fake_devices = [
        {
            "platform": "Android",
            "device_type": "Linux",
            "is_mobile": True,
            "browser": "Android",
            "session_status": "active",
            "last_active_at": "2026-06-05T10:06:00+00:00",
        }
    ]
    with patch("app.api.admin.ADMIN_SECRET", SECRET), patch(
        "app.api.admin.get_settings", return_value=_settings()
    ), patch.object(
        clerk_admin_service, "list_recent_users", return_value=fake_users
    ), patch.object(
        clerk_admin_service, "get_user_devices", return_value=fake_devices
    ), patch(
        "app.api.admin.telegram_service.send_message", return_value=True
    ) as send:
        resp = client.post("/api/admin/notify-recent-users", headers=_hdr())

    assert resp.status_code == 200
    assert resp.json() == {"sent": True, "count": 1}
    # The pushed text references the tester + their platform + activity.
    sent_text = send.call_args.args[2]
    assert "New Tester" in sent_text
    assert "Android" in sent_text
    assert "2 logs" in sent_text


def test_notify_returns_sent_false_when_telegram_send_fails():
    fake_users = [
        {
            "clerk_id": f"user_{uuid.uuid4().hex[:10]}",
            "email": "ghost@tester.com",
            "name": None,
            "created_at": "2026-06-05T10:00:00+00:00",
            "last_sign_in_at": None,
            "last_active_at": None,
        }
    ]
    with patch("app.api.admin.ADMIN_SECRET", SECRET), patch(
        "app.api.admin.get_settings", return_value=_settings()
    ), patch.object(
        clerk_admin_service, "list_recent_users", return_value=fake_users
    ), patch.object(
        clerk_admin_service, "get_user_devices", return_value=[]
    ), patch(
        "app.api.admin.telegram_service.send_message", return_value=False
    ):
        resp = client.post("/api/admin/notify-recent-users", headers=_hdr())

    assert resp.status_code == 200
    assert resp.json() == {"sent": False, "count": 1}


def test_user_without_local_row_reports_zero_activity():
    fake_users = [
        {
            "clerk_id": f"user_{uuid.uuid4().hex[:10]}",  # never hit the backend
            "email": "ghost@tester.com",
            "name": None,
            "created_at": "2026-06-05T10:00:00+00:00",
            "last_sign_in_at": None,
            "last_active_at": None,
        }
    ]
    with patch("app.api.admin.ADMIN_SECRET", SECRET), patch(
        "app.api.admin.get_settings", return_value=_settings()
    ), patch.object(
        clerk_admin_service, "list_recent_users", return_value=fake_users
    ), patch.object(clerk_admin_service, "get_user_devices", return_value=[]):
        resp = client.get(
            "/api/admin/recent-users?include_devices=false", headers=_hdr()
        )

    assert resp.status_code == 200
    activity = resp.json()["users"][0]["activity"]
    assert activity["has_local_row"] is False
    assert activity["climb_logs"] == 0
    assert activity["projects"] == 0

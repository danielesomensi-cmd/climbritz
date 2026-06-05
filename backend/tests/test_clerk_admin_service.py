"""Unit tests for clerk_admin_service (pure helpers + HTTP normalization).

httpx is mocked — no real network. Covers timestamp/email/name/platform
mapping and the non-200 → ClerkApiError contract.
"""

import os
import sys
from unittest.mock import MagicMock, patch

import httpx
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services import clerk_admin_service as svc


def test_iso_handles_epoch_ms_and_none():
    assert svc._iso(None) is None
    assert svc._iso(0) is None
    # 1_749_117_600_000 ms = 2025-06-05T10:00:00Z
    assert svc._iso(1_749_117_600_000).startswith("2025-06-05T10:00:00")


def test_primary_email_prefers_primary_id():
    user = {
        "primary_email_address_id": "idA",
        "email_addresses": [
            {"id": "idB", "email_address": "second@x.com"},
            {"id": "idA", "email_address": "primary@x.com"},
        ],
    }
    assert svc._primary_email(user) == "primary@x.com"


def test_primary_email_falls_back_to_first():
    user = {"email_addresses": [{"id": "x", "email_address": "only@x.com"}]}
    assert svc._primary_email(user) == "only@x.com"
    assert svc._primary_email({"email_addresses": []}) is None


@pytest.mark.parametrize(
    "device_type,is_mobile,expected",
    [
        ("iPhone", True, "iOS"),
        ("iPad", True, "iOS"),
        ("Android", True, "Android"),
        (None, True, "Mobile (OS unknown)"),
        ("Linux", False, "Linux"),
        (None, False, "Unknown"),
    ],
)
def test_guess_platform(device_type, is_mobile, expected):
    assert svc._guess_platform(device_type, is_mobile) == expected


def test_list_recent_users_normalizes_payload():
    payload = [
        {
            "id": "user_123",
            "primary_email_address_id": "e1",
            "email_addresses": [{"id": "e1", "email_address": "a@b.com"}],
            "first_name": "Ada",
            "last_name": "Lovelace",
            "created_at": 1_749_117_600_000,
            "last_sign_in_at": 1_749_117_900_000,
            "last_active_at": None,
        }
    ]
    fake_resp = MagicMock(status_code=200)
    fake_resp.json.return_value = payload
    with patch("app.services.clerk_admin_service.httpx.get", return_value=fake_resp):
        out = svc.list_recent_users("sk_test_x", limit=5)
    assert out[0]["clerk_id"] == "user_123"
    assert out[0]["email"] == "a@b.com"
    assert out[0]["name"] == "Ada Lovelace"
    assert out[0]["created_at"].startswith("2025-06-05T10:00:00")
    assert out[0]["last_active_at"] is None


def test_list_recent_users_raises_on_non_200():
    fake_resp = MagicMock(status_code=401, text="unauthorized")
    with patch("app.services.clerk_admin_service.httpx.get", return_value=fake_resp):
        with pytest.raises(svc.ClerkApiError):
            svc.list_recent_users("bad-key")


def test_get_user_devices_returns_empty_on_error():
    with patch(
        "app.services.clerk_admin_service.httpx.get",
        side_effect=httpx.ConnectError("down"),
    ):
        assert svc.get_user_devices("sk", "user_1") == []


def test_get_user_devices_dedupes_and_labels():
    sessions = [
        {
            "status": "active",
            "last_active_at": 1_749_117_600_000,
            "latest_activity": {
                "device_type": "iPhone",
                "is_mobile": True,
                "browser_name": "Mobile Safari",
                "ip_address": "1.1.1.1",
                "city": "Rome",
                "country": "IT",
            },
        },
        {  # duplicate device/browser/ip → collapsed
            "status": "active",
            "last_active_at": 1_749_117_600_000,
            "latest_activity": {
                "device_type": "iPhone",
                "is_mobile": True,
                "browser_name": "Mobile Safari",
                "ip_address": "1.1.1.1",
            },
        },
    ]
    fake_resp = MagicMock(status_code=200)
    fake_resp.json.return_value = sessions
    with patch("app.services.clerk_admin_service.httpx.get", return_value=fake_resp):
        devices = svc.get_user_devices("sk", "user_1")
    assert len(devices) == 1
    assert devices[0]["platform"] == "iOS"
    assert devices[0]["country"] == "IT"

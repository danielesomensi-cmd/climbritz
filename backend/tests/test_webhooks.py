"""Tests for the Clerk webhook → Telegram alert.

The Svix signature verification is mocked (patching app.api.webhooks.Webhook),
so we exercise the routing/auth/dispatch logic without real signatures.
"""

import os
import sys
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from svix.webhooks import WebhookVerificationError

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.main import app

client = TestClient(app)


def _settings(secret="whsec_test", token="TG", chat="CHAT"):
    s = MagicMock()
    s.clerk_webhook_secret = secret
    s.telegram_bot_token = token
    s.telegram_chat_id = chat
    return s


_HEADERS = {
    "svix-id": "msg_1",
    "svix-timestamp": "1700000000",
    "svix-signature": "v1,abc",
}

_USER_CREATED = {
    "type": "user.created",
    "data": {
        "primary_email_address_id": "e1",
        "email_addresses": [{"id": "e1", "email_address": "newbie@example.com"}],
        "first_name": "New",
        "last_name": "Bie",
    },
}


def test_503_when_webhook_secret_unconfigured():
    with patch("app.api.webhooks.get_settings", return_value=_settings(secret="")):
        resp = client.post("/api/webhooks/clerk", content=b"{}", headers=_HEADERS)
    assert resp.status_code == 503


def test_400_on_invalid_signature():
    with patch("app.api.webhooks.get_settings", return_value=_settings()), patch(
        "app.api.webhooks.Webhook"
    ) as MockWebhook:
        MockWebhook.return_value.verify.side_effect = WebhookVerificationError(
            "bad"
        )
        resp = client.post(
            "/api/webhooks/clerk", content=b"{}", headers=_HEADERS
        )
    assert resp.status_code == 400


def test_user_created_sends_telegram_alert():
    with patch("app.api.webhooks.get_settings", return_value=_settings()), patch(
        "app.api.webhooks.Webhook"
    ) as MockWebhook, patch(
        "app.api.webhooks.telegram_service.send_message", return_value=True
    ) as send:
        MockWebhook.return_value.verify.return_value = _USER_CREATED
        resp = client.post(
            "/api/webhooks/clerk", content=b"{}", headers=_HEADERS
        )
    assert resp.status_code == 200
    assert resp.json()["alerted"] is True
    # Telegram called with the configured creds + an email-bearing message.
    args = send.call_args[0]
    assert args[0] == "TG" and args[1] == "CHAT"
    assert "newbie@example.com" in args[2]


def test_non_user_created_event_does_not_alert():
    event = {"type": "session.created", "data": {}}
    with patch("app.api.webhooks.get_settings", return_value=_settings()), patch(
        "app.api.webhooks.Webhook"
    ) as MockWebhook, patch(
        "app.api.webhooks.telegram_service.send_message"
    ) as send:
        MockWebhook.return_value.verify.return_value = event
        resp = client.post(
            "/api/webhooks/clerk", content=b"{}", headers=_HEADERS
        )
    assert resp.status_code == 200
    assert resp.json()["alerted"] is False
    send.assert_not_called()

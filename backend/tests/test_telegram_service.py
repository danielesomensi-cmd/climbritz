"""Unit tests for telegram_service (httpx mocked, no network)."""

import os
import sys
from unittest.mock import MagicMock, patch

import httpx

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services import telegram_service as svc


def test_skips_when_unconfigured():
    assert svc.send_message("", "123", "hi") is False
    assert svc.send_message("tok", "", "hi") is False


def test_posts_to_telegram_and_returns_true():
    fake = MagicMock(status_code=200)
    with patch(
        "app.services.telegram_service.httpx.post", return_value=fake
    ) as post:
        ok = svc.send_message("TOKEN", "CHAT", "hello")
    assert ok is True
    url = post.call_args[0][0]
    assert url == "https://api.telegram.org/botTOKEN/sendMessage"
    assert post.call_args.kwargs["json"]["chat_id"] == "CHAT"
    assert post.call_args.kwargs["json"]["text"] == "hello"


def test_returns_false_on_non_2xx():
    fake = MagicMock(status_code=403, text="forbidden")
    with patch("app.services.telegram_service.httpx.post", return_value=fake):
        assert svc.send_message("T", "C", "x") is False


def test_returns_false_on_transport_error():
    with patch(
        "app.services.telegram_service.httpx.post",
        side_effect=httpx.ConnectError("down"),
    ):
        assert svc.send_message("T", "C", "x") is False

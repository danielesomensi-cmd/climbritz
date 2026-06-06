"""Tests for email_service (Gmail SMTP). smtplib is always mocked — pytest
never opens a socket or needs real credentials."""

import os
import sys
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services import email_service


def test_skips_when_credentials_missing():
    with patch("app.services.email_service.smtplib.SMTP_SSL") as smtp:
        ok = email_service.send_email(
            gmail_address="",
            gmail_app_password="",
            to="x@example.com",
            subject="s",
            html_body="<p>hi</p>",
        )
    assert ok is False
    smtp.assert_not_called()


def test_skips_on_empty_recipient():
    with patch("app.services.email_service.smtplib.SMTP_SSL") as smtp:
        ok = email_service.send_email(
            gmail_address="ops@example.com",
            gmail_app_password="pw",
            to="",
            subject="s",
            html_body="<p>hi</p>",
        )
    assert ok is False
    smtp.assert_not_called()


def test_sends_via_smtp_ssl_with_login():
    with patch("app.services.email_service.smtplib.SMTP_SSL") as smtp:
        server = MagicMock()
        smtp.return_value.__enter__.return_value = server
        ok = email_service.send_email(
            gmail_address="ops@example.com",
            gmail_app_password="app-pw",
            to="newbie@example.com",
            subject="Welcome to Climbritz",
            html_body="<p>Hi New,</p><p>Welcome!</p>",
        )
    assert ok is True
    server.login.assert_called_once_with("ops@example.com", "app-pw")
    server.send_message.assert_called_once()
    sent_msg = server.send_message.call_args[0][0]
    assert sent_msg["To"] == "newbie@example.com"
    assert sent_msg["Subject"] == "Welcome to Climbritz"
    assert "ops@example.com" in sent_msg["From"]


def test_returns_false_on_smtp_error():
    import smtplib

    with patch("app.services.email_service.smtplib.SMTP_SSL") as smtp:
        smtp.return_value.__enter__.side_effect = smtplib.SMTPException("boom")
        ok = email_service.send_email(
            gmail_address="ops@example.com",
            gmail_app_password="app-pw",
            to="newbie@example.com",
            subject="s",
            html_body="<p>hi</p>",
        )
    assert ok is False


def test_html_to_text_fallback_strips_tags():
    txt = email_service._html_to_text("<p>Hi New,</p><p>Welcome <b>back</b>!</p>")
    assert "Hi New," in txt
    assert "<" not in txt and ">" not in txt

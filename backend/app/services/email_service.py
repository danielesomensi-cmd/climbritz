"""Outbound user emails via Gmail SMTP.

Used for transactional/onboarding emails to users (e.g. a welcome on sign-up).
Best-effort by design: a failure to send must never break the calling request,
so send_email swallows errors and returns a bool instead of raising — same
contract as telegram_service.

Setup: a Gmail account with 2FA + a Google App Password (16 chars). Both live
in env (GMAIL_ADDRESS / GMAIL_APP_PASSWORD; Railway Variables in prod). The
account's normal password will NOT work over SMTP.

Volume note: a free Gmail account allows ~500 recipients/day — fine for the
current beta. Move to a domain-verified provider (Resend/SendGrid) before any
real scale or marketing volume.
"""

from __future__ import annotations

import logging
import smtplib
import ssl
from email.message import EmailMessage

logger = logging.getLogger(__name__)

_SMTP_HOST = "smtp.gmail.com"
_SMTP_PORT = 465  # implicit TLS (SMTP_SSL)
_TIMEOUT = 15.0


def send_email(
    *,
    gmail_address: str,
    gmail_app_password: str,
    to: str,
    subject: str,
    html_body: str,
    text_body: str | None = None,
    from_name: str = "Daniele from Climbritz",
) -> bool:
    """Send a single email via Gmail SMTP. Returns True on success, False on
    any failure (missing creds, SMTP error, bad recipient). Never raises."""
    if not gmail_address or not gmail_app_password:
        logger.warning("email send skipped: GMAIL_ADDRESS/APP_PASSWORD not configured")
        return False
    if not to:
        logger.warning("email send skipped: empty recipient")
        return False

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{gmail_address}>"
    msg["To"] = to
    # Plain-text fallback first, then the HTML alternative.
    msg.set_content(text_body or _html_to_text(html_body))
    msg.add_alternative(html_body, subtype="html")

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(
            _SMTP_HOST, _SMTP_PORT, context=context, timeout=_TIMEOUT
        ) as server:
            server.login(gmail_address, gmail_app_password)
            server.send_message(msg)
    except (smtplib.SMTPException, OSError) as exc:
        logger.error("email send failed -> %s: %s", to, exc)
        return False
    logger.info("email sent -> %s (subject=%r)", to, subject)
    return True


def _html_to_text(html: str) -> str:
    """Very small HTML→text fallback for the plain-text part. Not a full parser
    — just strips tags so non-HTML clients get readable text."""
    import re

    text = re.sub(r"<br\s*/?>", "\n", html, flags=re.IGNORECASE)
    text = re.sub(r"</p>", "\n\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()

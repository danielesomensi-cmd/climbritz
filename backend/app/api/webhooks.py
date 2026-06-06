"""Inbound webhooks. Currently: Clerk `user.created` → Telegram alert.

Clerk signs webhooks with Svix. We verify the signature against
CLERK_WEBHOOK_SECRET (the `whsec_...` value Clerk shows when you create the
endpoint) before trusting the payload — an unverified body could be a spoofed
sign-up. On a verified `user.created` we ping Telegram so Daniele gets a push
the moment someone joins.

This is separate from core/clerk.py (JWT verification, high-risk): different
secret, different library (svix), no auth/session code touched.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Request
from svix.webhooks import Webhook, WebhookVerificationError

from app.core.config import get_settings
from app.services import email_service, telegram_service

logger = logging.getLogger(__name__)

router = APIRouter()


def _extract_identity(data: dict) -> tuple[str, str]:
    """Pull (email, first_name) from a Clerk user object. email falls back to
    'unknown', first_name to '' when absent."""
    emails = data.get("email_addresses") or []
    primary_id = data.get("primary_email_address_id")
    email = next(
        (e.get("email_address") for e in emails if e.get("id") == primary_id),
        (emails[0].get("email_address") if emails else "unknown"),
    )
    first_name = (data.get("first_name") or "").strip()
    return email, first_name


def _format_signup(data: dict) -> str:
    """Human-readable Telegram alert from a Clerk user object."""
    email, first_name = _extract_identity(data)
    last = (data.get("last_name") or "").strip()
    name = " ".join(p for p in [first_name, last] if p).strip()
    who = f"{name} ({email})" if name else email
    return (
        "🎉 <b>Nuovo iscritto Climbritz</b>\n"
        f"{who}\n\n"
        "Controlla iOS/Android + attività: "
        "<code>GET /api/admin/recent-users</code>"
    )


def _welcome_email(first_name: str) -> tuple[str, str]:
    """(subject, html_body) for the welcome email. English copy (UI-English
    rule); climbing jargon stays untranslated."""
    hi = f"Hi {first_name}," if first_name else "Hi,"
    subject = "Welcome to Climbritz 🧗"
    html = (
        f"<p>{hi}</p>"
        "<p>Thanks for joining <b>Climbritz</b> — your AI climbing companion "
        "for the Kilter Board. I'm Daniele, the maker, and I'm genuinely glad "
        "you're here.</p>"
        "<p>A few things to try:</p>"
        "<ul>"
        "<li><b>Discover</b> — search 160k+ climbs and light them up on the board.</li>"
        "<li><b>Create with AI</b> — generate a fresh problem from an existing climb.</li>"
        "<li><b>History</b> — log your attempts and get an AI read on your progress.</li>"
        "</ul>"
        "<p>This is an early beta, so if anything feels off — or you just have "
        "an idea — hit reply and tell me. Every message comes straight to me.</p>"
        "<p>Climb strong! 💪<br>Daniele</p>"
    )
    return subject, html


@router.post("/clerk")
async def clerk_webhook(request: Request):
    """Verify a Clerk/Svix webhook and alert on user.created.

    Returns 200 for any verified event (we ignore types other than
    user.created). 503 if the webhook secret isn't configured, 400 on a
    signature that doesn't verify.
    """
    settings = get_settings()
    secret = settings.clerk_webhook_secret
    if not secret:
        raise HTTPException(
            status_code=503, detail="CLERK_WEBHOOK_SECRET not configured"
        )

    payload = await request.body()
    headers = {
        "svix-id": request.headers.get("svix-id", ""),
        "svix-timestamp": request.headers.get("svix-timestamp", ""),
        "svix-signature": request.headers.get("svix-signature", ""),
    }

    try:
        event = Webhook(secret).verify(payload, headers)
    except WebhookVerificationError:
        logger.warning("clerk webhook: signature verification failed")
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_type = event.get("type")
    if event_type == "user.created":
        data = event.get("data") or {}
        # 1. Ops alert to Daniele (Telegram).
        text = _format_signup(data)
        sent = telegram_service.send_message(
            settings.telegram_bot_token, settings.telegram_chat_id, text
        )
        # 2. Welcome email to the new user (best-effort, never blocks the ack).
        email, first_name = _extract_identity(data)
        subject, html = _welcome_email(first_name)
        emailed = False
        if email and email != "unknown":
            emailed = email_service.send_email(
                gmail_address=settings.gmail_address,
                gmail_app_password=settings.gmail_app_password,
                to=email,
                subject=subject,
                html_body=html,
            )
        logger.info(
            "clerk webhook: user.created alert=%s welcome_email=%s", sent, emailed
        )
        return {
            "status": "ok",
            "event": event_type,
            "alerted": sent,
            "welcomed": emailed,
        }

    return {"status": "ok", "event": event_type, "alerted": False, "welcomed": False}

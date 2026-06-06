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
from app.services import telegram_service

logger = logging.getLogger(__name__)

router = APIRouter()


def _format_signup(data: dict) -> str:
    """Human-readable alert from a Clerk user object."""
    emails = data.get("email_addresses") or []
    primary_id = data.get("primary_email_address_id")
    email = next(
        (e.get("email_address") for e in emails if e.get("id") == primary_id),
        (emails[0].get("email_address") if emails else "unknown"),
    )
    name = " ".join(
        p for p in [data.get("first_name"), data.get("last_name")] if p
    ).strip()
    who = f"{name} ({email})" if name else email
    return (
        "🎉 <b>Nuovo iscritto Climbritz</b>\n"
        f"{who}\n\n"
        "Controlla iOS/Android + attività: "
        "<code>GET /api/admin/recent-users</code>"
    )


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
        text = _format_signup(event.get("data") or {})
        sent = telegram_service.send_message(
            settings.telegram_bot_token, settings.telegram_chat_id, text
        )
        logger.info("clerk webhook: user.created alert sent=%s", sent)
        return {"status": "ok", "event": event_type, "alerted": sent}

    return {"status": "ok", "event": event_type, "alerted": False}

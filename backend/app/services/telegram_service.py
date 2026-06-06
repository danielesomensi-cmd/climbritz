"""Outbound Telegram notifications via the Bot API.

Used for ops alerts (e.g. a new Clerk sign-up). Best-effort: a failure to
notify must never break the calling request, so send_message swallows errors
and returns a bool instead of raising.

Setup: create a bot with @BotFather → TELEGRAM_BOT_TOKEN; get your numeric
chat id → TELEGRAM_CHAT_ID. Both live in env (Railway Variables).
"""

from __future__ import annotations

import logging

import httpx

logger = logging.getLogger(__name__)

_TIMEOUT = 10.0


def send_message(token: str, chat_id: str, text: str) -> bool:
    """POST to Telegram sendMessage. Returns True on 2xx, False otherwise.

    Never raises — notification is best-effort."""
    if not token or not chat_id:
        logger.warning("telegram send skipped: token/chat_id not configured")
        return False
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        resp = httpx.post(
            url,
            json={
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "HTML",
                "disable_web_page_preview": True,
            },
            timeout=_TIMEOUT,
        )
    except httpx.HTTPError as exc:
        logger.error("telegram send failed: %s", exc)
        return False
    if resp.status_code // 100 != 2:
        logger.error("telegram send -> %s: %s", resp.status_code, resp.text[:200])
        return False
    return True

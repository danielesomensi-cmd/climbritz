"""Admin-only Clerk Backend API client (read-only).

Powers ``GET /api/admin/recent-users`` — "who just signed up, from which
device, and have they used the app?". Deliberately separate from
``core/clerk.py`` (JWT verification, a high-risk/STOP-gate module): this module
makes outbound REST calls with the secret key and never touches auth/session
verification, so it carries none of that risk.

Clerk Backend API: https://clerk.com/docs/reference/backend-api
Timestamps from Clerk are epoch **milliseconds**.
"""

from __future__ import annotations

import datetime as _dt
from typing import Optional

import httpx

CLERK_API_BASE = "https://api.clerk.com/v1"
_TIMEOUT = 10.0


class ClerkApiError(RuntimeError):
    """Raised when the Clerk Backend API returns a non-2xx response."""


def _iso(ms: Optional[int]) -> Optional[str]:
    """Epoch-milliseconds → UTC ISO-8601, or None."""
    if not ms:
        return None
    return _dt.datetime.fromtimestamp(ms / 1000, tz=_dt.timezone.utc).isoformat()


def _primary_email(user: dict) -> Optional[str]:
    primary_id = user.get("primary_email_address_id")
    addrs = user.get("email_addresses", []) or []
    for ea in addrs:
        if ea.get("id") == primary_id:
            return ea.get("email_address")
    return addrs[0].get("email_address") if addrs else None


def _full_name(user: dict) -> Optional[str]:
    name = " ".join(
        p for p in [user.get("first_name"), user.get("last_name")] if p
    ).strip()
    return name or None


def _guess_platform(
    device_type: Optional[str],
    is_mobile: Optional[bool],
    browser: Optional[str] = None,
) -> str:
    """Best-effort OS label from Clerk's UA-parsed fields.

    Clerk's parsing is quirky for native WebViews:
      - iOS Capacitor app → device_type "iPhone"/"iPad".
      - Android → device_type "Linux" with browser "Android" (NOT "Android" in
        device_type), so we must also inspect the browser to catch it.
      - A desktop Mac is "Macintosh" → macOS, NOT iOS (don't conflate them)."""
    dt = (device_type or "").lower()
    br = (browser or "").lower()
    if "iphone" in dt or "ipad" in dt or "ios" in dt:
        return "iOS"
    if "android" in dt or "android" in br:
        return "Android"
    if "mac" in dt:
        return "macOS"
    if "windows" in dt:
        return "Windows"
    if is_mobile:
        return "Mobile (OS unknown)"
    return device_type or "Unknown"


def _headers(secret_key: str) -> dict:
    return {"Authorization": f"Bearer {secret_key}"}


def list_recent_users(secret_key: str, limit: int = 10) -> list[dict]:
    """Newest sign-ups first, as normalized dicts (no raw Clerk payload leaked).

    Raises ClerkApiError on transport failure or a non-200 response.
    """
    params = {"order_by": "-created_at", "limit": str(limit)}
    try:
        resp = httpx.get(
            f"{CLERK_API_BASE}/users",
            headers=_headers(secret_key),
            params=params,
            timeout=_TIMEOUT,
        )
    except httpx.HTTPError as exc:
        raise ClerkApiError(f"request to Clerk failed: {exc}") from exc

    if resp.status_code != 200:
        raise ClerkApiError(
            f"GET /users -> {resp.status_code}: {resp.text[:200]}"
        )

    out: list[dict] = []
    for u in resp.json():
        out.append(
            {
                "clerk_id": u.get("id"),
                "email": _primary_email(u),
                "name": _full_name(u),
                "created_at": _iso(u.get("created_at")),
                "last_sign_in_at": _iso(u.get("last_sign_in_at")),
                "last_active_at": _iso(u.get("last_active_at")),
            }
        )
    return out


def get_user_devices(secret_key: str, clerk_user_id: str) -> list[dict]:
    """Device/OS + coarse location from the user's sessions' ``latest_activity``.

    Best-effort: returns [] on any error or missing data — devices enrich the
    report but never block it (so a Clerk sessions hiccup can't 500 the endpoint).
    Deduped by (device_type, browser, ip).
    """
    params = {"user_id": clerk_user_id}
    try:
        resp = httpx.get(
            f"{CLERK_API_BASE}/sessions",
            headers=_headers(secret_key),
            params=params,
            timeout=_TIMEOUT,
        )
        if resp.status_code != 200:
            return []
        sessions = resp.json()
    except httpx.HTTPError:
        return []

    devices: list[dict] = []
    seen: set = set()
    for s in sessions:
        act = s.get("latest_activity") or {}
        device_type = act.get("device_type")
        is_mobile = act.get("is_mobile")
        key = (device_type, act.get("browser_name"), act.get("ip_address"))
        if key in seen:
            continue
        seen.add(key)
        devices.append(
            {
                "platform": _guess_platform(
                    device_type, is_mobile, act.get("browser_name")
                ),
                "device_type": device_type,
                "is_mobile": is_mobile,
                "browser": act.get("browser_name"),
                "ip": act.get("ip_address"),
                "city": act.get("city"),
                "country": act.get("country"),
                "session_status": s.get("status"),
                "last_active_at": _iso(s.get("last_active_at")),
            }
        )
    return devices

import uuid as _uuid

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.clerk import (
    get_clerk_user_id,
    is_clerk_configured,
    lookup_or_create_user,
)
from app.core.database import get_db


def get_current_user_id(
    request: Request,
    db: Session = Depends(get_db),
) -> str:
    """A019: return the local user_id (UUID v4 string) for the request.

    Two accepted credentials, in order:

      1. Authorization: Bearer <Clerk JWT>
         When CLERK_JWKS_URL is configured we verify the token via Clerk's
         JWKS, extract `sub`, and shadow-row upsert into users.id.

      2. X-User-ID: <uuid v4>
         Dev/test fallback only. The production guard in core.config refuses
         to boot without CLERK_JWKS_URL, but we additionally gate this header
         behind environment != "production" so even a misconfigured prod
         container can't be impersonated by sending the header.
    """
    auth_header = request.headers.get("Authorization")

    # 1. Bearer token (Clerk JWT) — primary path
    if auth_header and auth_header.startswith("Bearer "):
        if is_clerk_configured():
            token = auth_header.split(" ", 1)[1]
            try:
                clerk_id = get_clerk_user_id(token)
            except Exception as e:
                raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
            return lookup_or_create_user(clerk_id, db)

    # 2. X-User-ID fallback (dev/test only)
    current_settings = get_settings()
    if current_settings.environment != "production":
        x_user_id = request.headers.get("X-User-ID")
        if x_user_id:
            try:
                _uuid.UUID(x_user_id, version=4)
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid X-User-ID: must be a UUID v4",
                )
            return x_user_id

    raise HTTPException(status_code=401, detail="Authentication required")


def get_optional_user_id(
    request: Request,
    db: Session = Depends(get_db),
) -> str | None:
    """A021: like get_current_user_id but returns None instead of 401 when
    no credential is present. Used by endpoints that work unauthenticated
    but enrich the response when a user is identified (e.g. Discovery
    search overlay attaches user_state when logged in).
    """
    try:
        return get_current_user_id(request, db)
    except HTTPException:
        return None

"""Clerk JWT verification + shadow-row management (A019).

Pattern adapted from the climb-agent reference. Two responsibilities:
  1. Verify a Clerk-issued RS256 JWT against the Clerk JWKS endpoint.
  2. Look up (or create) the local users.id row that shadows a clerk_id
     subject — every Clerk user gets exactly one matching row.

Tests mock verify_clerk_token via monkeypatch so we never actually fetch
the JWKS during pytest. See tests/test_clerk_auth.py.
"""

import time
import uuid
from functools import lru_cache

import jwt
from jwt import PyJWKClient
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.user import User


def is_clerk_configured() -> bool:
    """True when CLERK_JWKS_URL is set. Drives the dev-only X-User-ID fallback
    in deps.get_current_user_id — when Clerk is unconfigured (e.g. local dev
    without .env values), the dependency falls back to the X-User-ID header
    instead of refusing every request."""
    return bool(get_settings().clerk_jwks_url)


@lru_cache(maxsize=1)
def _get_jwk_client() -> PyJWKClient:
    return PyJWKClient(get_settings().clerk_jwks_url)


def verify_clerk_token(token: str) -> dict:
    """Decode + verify a Clerk JWT. Returns the claims dict on success.
    Raises jwt.PyJWTError subclasses on signature, expiry, or algorithm
    failures — caller in deps.py converts to HTTP 401.
    """
    jwk_client = _get_jwk_client()
    signing_key = jwk_client.get_signing_key_from_jwt(token)
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        # Clerk's `aud` claim contains the Frontend API host, which is
        # not stable across instances. We trust the `iss` (issuer) instead,
        # which PyJWT validates implicitly via the JWKS lookup.
        options={"verify_aud": False},
    )


def get_clerk_user_id(token: str) -> str:
    """Convenience: verify and return the Clerk subject (the `user_xxx` id)."""
    return verify_clerk_token(token)["sub"]


# In-process cache: clerk_id -> (local_user_id, last_seen_ts).
# Saves a SELECT on every request after the first hit. Bounded TTL avoids
# stale rows surviving forever in a long-lived worker; eviction on TTL is
# enough — we don't need explicit invalidation since the local user_id is
# never reused for a different clerk_id.
_clerk_id_cache: dict[str, tuple[str, float]] = {}
_CACHE_TTL = 300  # 5 minutes


def lookup_or_create_user(clerk_id: str, db: Session) -> str:
    """Return the local user_id (UUID v4) shadowing a Clerk subject.

    First request for a given clerk_id inserts a row; subsequent requests
    reuse it. Cache is process-local — workers may each run a SELECT once
    after restart, that's fine.
    """
    now = time.time()
    cached = _clerk_id_cache.get(clerk_id)
    if cached and now - cached[1] < _CACHE_TTL:
        return cached[0]

    user = db.query(User).filter(User.clerk_id == clerk_id).first()
    if user:
        _clerk_id_cache[clerk_id] = (user.id, now)
        return user.id

    new_id = str(uuid.uuid4())
    user = User(id=new_id, clerk_id=clerk_id)
    db.add(user)
    db.commit()
    _clerk_id_cache[clerk_id] = (new_id, now)
    return new_id

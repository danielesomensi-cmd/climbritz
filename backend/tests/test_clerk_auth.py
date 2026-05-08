"""A019: Clerk authentication tests.

Covers:
  - is_clerk_configured() reflects CLERK_JWKS_URL presence.
  - lookup_or_create_user() creates a shadow row, reuses on repeat,
    serves from cache within TTL, refreshes after TTL expiry.
  - get_current_user_id() FastAPI dependency:
      * Accepts X-User-ID in development.
      * Refuses X-User-ID in production.
      * Rejects malformed X-User-ID.
      * Returns 401 with no headers.
      * Returns 401 for an invalid Bearer token.
      * Returns the local user_id for a valid Bearer token.

verify_clerk_token is monkeypatched throughout — the real PyJWKClient is
never instantiated and we never hit Clerk. core.clerk._get_jwk_client +
_clerk_id_cache are reset between tests via the autouse fixture.
"""

import os
import sys
import time
import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core import clerk as clerk_module
from app.core.clerk import (
    is_clerk_configured,
    lookup_or_create_user,
    verify_clerk_token,
)
from app.core.database import get_db
from app.core.deps import get_current_user_id
from app.models.user import User
from conftest import TestingSessionLocal, override_get_db


@pytest.fixture(autouse=True)
def _reset_clerk_module_state():
    """Module-level caches in core.clerk leak between tests if not reset."""
    clerk_module._clerk_id_cache.clear()
    clerk_module._get_jwk_client.cache_clear()
    yield
    clerk_module._clerk_id_cache.clear()
    clerk_module._get_jwk_client.cache_clear()


# --- is_clerk_configured ---


class TestIsClerkConfigured:
    def test_true_when_jwks_url_set(self):
        fake_settings = MagicMock(clerk_jwks_url="https://example.clerk.dev/jwks")
        with patch("app.core.clerk.get_settings", return_value=fake_settings):
            assert is_clerk_configured() is True

    def test_false_when_jwks_url_empty(self):
        fake_settings = MagicMock(clerk_jwks_url="")
        with patch("app.core.clerk.get_settings", return_value=fake_settings):
            assert is_clerk_configured() is False


# --- lookup_or_create_user ---


class TestLookupOrCreateUser:
    def test_creates_shadow_row_for_new_clerk_id(self):
        db = TestingSessionLocal()
        try:
            clerk_id = f"user_test_{uuid.uuid4().hex[:8]}"
            user_id = lookup_or_create_user(clerk_id, db)

            row = db.query(User).filter(User.clerk_id == clerk_id).first()
            assert row is not None
            assert row.id == user_id
            try:
                uuid.UUID(user_id, version=4)
            except ValueError:
                pytest.fail("user_id should be a UUID v4 string")
        finally:
            db.close()

    def test_reuses_existing_row_for_same_clerk_id(self):
        db = TestingSessionLocal()
        try:
            clerk_id = f"user_test_{uuid.uuid4().hex[:8]}"
            first = lookup_or_create_user(clerk_id, db)
            # Clear cache to force a DB round-trip on the second call
            clerk_module._clerk_id_cache.clear()
            second = lookup_or_create_user(clerk_id, db)

            assert first == second
            assert (
                db.query(User).filter(User.clerk_id == clerk_id).count() == 1
            )
        finally:
            db.close()

    def test_serves_from_cache_within_ttl(self):
        db = TestingSessionLocal()
        try:
            clerk_id = f"user_test_{uuid.uuid4().hex[:8]}"
            first = lookup_or_create_user(clerk_id, db)

            # Spy on the DB session — cache hit must NOT call db.query()
            spy_db = MagicMock(wraps=db)
            second = lookup_or_create_user(clerk_id, spy_db)

            assert first == second
            spy_db.query.assert_not_called()
        finally:
            db.close()

    def test_cache_expires_after_ttl(self):
        db = TestingSessionLocal()
        try:
            clerk_id = f"user_test_{uuid.uuid4().hex[:8]}"
            with patch("app.core.clerk.time.time", return_value=1000.0):
                first = lookup_or_create_user(clerk_id, db)

            # Jump 6 minutes (past the 5-min TTL)
            with patch("app.core.clerk.time.time", return_value=1000.0 + 360):
                second = lookup_or_create_user(clerk_id, db)

            assert first == second  # same shadow row, just cache miss + DB hit
            assert (
                db.query(User).filter(User.clerk_id == clerk_id).count() == 1
            )
        finally:
            db.close()


# --- verify_clerk_token ---


class TestVerifyClerkToken:
    def test_returns_decoded_claims(self):
        fake_signing_key = MagicMock()
        fake_signing_key.key = "fake-key"
        fake_jwk_client = MagicMock()
        fake_jwk_client.get_signing_key_from_jwt.return_value = fake_signing_key

        fake_claims = {"sub": "user_test_xyz", "iat": 1, "exp": 9999999999}

        with patch(
            "app.core.clerk._get_jwk_client", return_value=fake_jwk_client
        ), patch("app.core.clerk.jwt.decode", return_value=fake_claims) as decode:
            result = verify_clerk_token("any-token")

        assert result == fake_claims
        # confirm we asked for RS256, not HS256
        assert decode.call_args.kwargs.get("algorithms") == ["RS256"]


# --- get_current_user_id (via TestClient) ---


@pytest.fixture
def app_client():
    """Minimal app exposing a single endpoint that depends on
    get_current_user_id, so we exercise the full FastAPI DI path."""
    app = FastAPI()

    @app.get("/whoami")
    def whoami(user_id: str = Depends(get_current_user_id)):
        return {"user_id": user_id}

    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app)


class TestGetCurrentUserId:
    def test_x_user_id_accepted_in_development(self, app_client):
        fake = MagicMock(environment="development")
        with patch("app.core.deps.get_settings", return_value=fake):
            user_uuid = str(uuid.uuid4())
            resp = app_client.get("/whoami", headers={"X-User-ID": user_uuid})
        assert resp.status_code == 200
        assert resp.json() == {"user_id": user_uuid}

    def test_x_user_id_rejected_in_production(self, app_client):
        fake = MagicMock(environment="production")
        with patch("app.core.deps.get_settings", return_value=fake):
            resp = app_client.get(
                "/whoami", headers={"X-User-ID": str(uuid.uuid4())}
            )
        assert resp.status_code == 401

    def test_x_user_id_rejected_when_not_uuid(self, app_client):
        fake = MagicMock(environment="development")
        with patch("app.core.deps.get_settings", return_value=fake):
            resp = app_client.get("/whoami", headers={"X-User-ID": "not-a-uuid"})
        assert resp.status_code == 400

    def test_no_credentials_returns_401(self, app_client):
        fake = MagicMock(environment="development")
        with patch("app.core.deps.get_settings", return_value=fake):
            resp = app_client.get("/whoami")
        assert resp.status_code == 401

    def test_invalid_bearer_token_returns_401(self, app_client):
        # is_clerk_configured returns True; verify raises → 401
        with patch(
            "app.core.deps.is_clerk_configured", return_value=True
        ), patch(
            "app.core.deps.get_clerk_user_id", side_effect=ValueError("bad sig")
        ):
            resp = app_client.get(
                "/whoami", headers={"Authorization": "Bearer junk-token"}
            )
        assert resp.status_code == 401
        assert "Invalid token" in resp.json()["detail"]

    def test_valid_bearer_token_creates_shadow_row(self, app_client):
        clerk_id = f"user_test_{uuid.uuid4().hex[:8]}"
        with patch(
            "app.core.deps.is_clerk_configured", return_value=True
        ), patch("app.core.deps.get_clerk_user_id", return_value=clerk_id):
            resp = app_client.get(
                "/whoami", headers={"Authorization": "Bearer valid-token"}
            )

        assert resp.status_code == 200
        returned_user_id = resp.json()["user_id"]

        # The shadow row was created
        db = TestingSessionLocal()
        try:
            row = db.query(User).filter(User.clerk_id == clerk_id).first()
            assert row is not None
            assert row.id == returned_user_id
        finally:
            db.close()

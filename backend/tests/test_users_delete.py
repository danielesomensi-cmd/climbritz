"""A-STORE-PROD-001: DELETE /api/users/me — full account erasure.

Covers the Guideline 5.1.1(v) contract: every user-owned row gone, every
on-disk artifact purged, Clerk identity deleted LAST, idempotent on repeat,
and a Clerk outage surfaced cleanly (never a 500 with a stack trace).

The Clerk Backend API is always mocked — no test ever touches the live
instance.
"""

from __future__ import annotations

import os
import sys
import uuid
from datetime import date, datetime, timezone
from typing import NamedTuple
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.main import app
from app.models.climb_log import ClimbLog
from app.models.user import User
from app.models.user_climb import UserClimb
from app.models.user_generated_climb import UserGeneratedClimb
from app.models.user_hold_classification import UserHoldClassification
from app.models.video import VideoUpload
from app.services.clerk_admin_service import ClerkApiError
from conftest import TestingSessionLocal

client = TestClient(app)


def _auth(user_id: str) -> dict:
    """Dev-mode X-User-ID header (ENVIRONMENT defaults to 'development')."""
    return {"X-User-ID": str(user_id)}


@pytest.fixture(autouse=True)
def clerk_secret_configured():
    """The endpoint 503s without a secret key; give every test a fake one.
    The `no secret key` case has its own test that overrides this."""
    with patch("app.api.users.get_settings") as mock:
        mock.return_value.clerk_secret_key = "sk_test_fake"
        yield mock


class SeededUser(NamedTuple):
    """Plain values, not a live ORM instance — the seeding session is closed
    before the test body runs, so attribute access on a `User` would raise
    DetachedInstanceError (conftest's sessionmaker keeps expire_on_commit)."""

    id: str
    clerk_id: str


def _seed_user_with_data(tmp_path=None) -> tuple[SeededUser, list[str]]:
    """Create a user with one row in every user-owned table.

    Returns (user, video_file_paths) — the paths exist on disk when tmp_path
    is supplied, so the test can assert they were purged.
    """
    db = TestingSessionLocal()
    user_id = str(uuid.uuid4())
    clerk_id = f"user_{uuid.uuid4().hex[:10]}"
    db.add(User(id=user_id, clerk_id=clerk_id))
    db.commit()

    climb_uuid = f"UUID-DEL-{uuid.uuid4().hex[:8]}"

    db.add(
        ClimbLog(
            user_id=user_id,
            climb_uuid=climb_uuid,
            angle=40,
            local_date=date(2026, 7, 1),
            result_type="send",
        )
    )
    db.add(
        UserClimb(
            user_id=user_id,
            climb_uuid=climb_uuid,
            angle=40,
            is_project=True,
            best_result="send",
        )
    )
    db.add(
        UserHoldClassification(
            user_id=user_id, placement_id=1234, category="crimp"
        )
    )
    db.add(
        UserGeneratedClimb(
            user_id=user_id,
            name="Test Problem",
            frames="p1234r12p1235r13",
            frames_count=1,
            angle=40,
        )
    )

    paths: list[str] = []
    if tmp_path is not None:
        vid_file = tmp_path / f"{uuid.uuid4().hex}.mp4"
        vid_file.write_bytes(b"fake video bytes")
        paths.append(str(vid_file))

    db.add(
        VideoUpload(
            user_id=user_id,
            filename="climb.mp4",
            original_file_path=paths[0] if paths else None,
            file_path=paths[0] if paths else None,
            status="completed",
            processing_status="completed",
            gemini_file_id="files/fake123",
            created_at=datetime.now(timezone.utc),
        )
    )
    db.commit()
    db.close()
    return SeededUser(id=user_id, clerk_id=clerk_id), paths


def _counts_for(user_id: str) -> dict[str, int]:
    db = TestingSessionLocal()
    try:
        return {
            "users": db.query(User).filter(User.id == user_id).count(),
            "climb_logs": db.query(ClimbLog)
            .filter(ClimbLog.user_id == user_id)
            .count(),
            "user_climbs": db.query(UserClimb)
            .filter(UserClimb.user_id == user_id)
            .count(),
            "classifications": db.query(UserHoldClassification)
            .filter(UserHoldClassification.user_id == user_id)
            .count(),
            "generated": db.query(UserGeneratedClimb)
            .filter(UserGeneratedClimb.user_id == user_id)
            .count(),
            "videos": db.query(VideoUpload)
            .filter(VideoUpload.user_id == user_id)
            .count(),
        }
    finally:
        db.close()


class TestDeleteAccountHappyPath:
    def test_deletes_every_table_and_calls_clerk(self, tmp_path):
        user, paths = _seed_user_with_data(tmp_path)

        # Sanity: the fixture really did populate every table.
        before = _counts_for(user.id)
        assert all(v == 1 for v in before.values()), before

        with patch(
            "app.services.clerk_admin_service.delete_user", return_value=True
        ) as mock_delete:
            resp = client.delete("/api/users/me", headers=_auth(user.id))

        assert resp.status_code == 204
        assert resp.content == b""

        after = _counts_for(user.id)
        assert all(v == 0 for v in after.values()), after

        mock_delete.assert_called_once()
        # Clerk is called with the user's clerk_id, not the local uuid.
        assert mock_delete.call_args[0][1] == user.clerk_id

    def test_purges_video_files_from_disk(self, tmp_path):
        user, paths = _seed_user_with_data(tmp_path)
        assert os.path.exists(paths[0])

        with patch(
            "app.services.clerk_admin_service.delete_user", return_value=True
        ):
            resp = client.delete("/api/users/me", headers=_auth(user.id))

        assert resp.status_code == 204
        assert not os.path.exists(paths[0]), "video file survived deletion"

    def test_does_not_touch_other_users_data(self, tmp_path):
        victim, _ = _seed_user_with_data(tmp_path)
        bystander, _ = _seed_user_with_data(tmp_path)

        with patch(
            "app.services.clerk_admin_service.delete_user", return_value=True
        ):
            client.delete("/api/users/me", headers=_auth(victim.id))

        assert all(v == 0 for v in _counts_for(victim.id).values())
        assert all(v == 1 for v in _counts_for(bystander.id).values())

    def test_missing_video_file_is_not_fatal(self, tmp_path):
        """A path recorded in the DB that no longer exists on disk (already
        cleaned, volume remounted) must not block the erasure."""
        user, paths = _seed_user_with_data(tmp_path)
        os.unlink(paths[0])

        with patch(
            "app.services.clerk_admin_service.delete_user", return_value=True
        ):
            resp = client.delete("/api/users/me", headers=_auth(user.id))

        assert resp.status_code == 204
        assert all(v == 0 for v in _counts_for(user.id).values())


class TestDeleteAccountAuth:
    def test_unauthenticated_returns_401(self):
        resp = client.delete("/api/users/me")
        assert resp.status_code == 401

    def test_invalid_user_id_returns_400(self):
        resp = client.delete("/api/users/me", headers={"X-User-ID": "not-a-uuid"})
        assert resp.status_code == 400


class TestDeleteAccountIdempotency:
    def test_second_call_returns_204(self, tmp_path):
        user, _ = _seed_user_with_data(tmp_path)

        with patch(
            "app.services.clerk_admin_service.delete_user", return_value=True
        ):
            first = client.delete("/api/users/me", headers=_auth(user.id))
        assert first.status_code == 204

        # Second pass: nothing left locally, and Clerk reports 404 (already
        # gone) which delete_user maps to False — still a 204 for the client.
        with patch(
            "app.services.clerk_admin_service.delete_user", return_value=False
        ):
            second = client.delete("/api/users/me", headers=_auth(user.id))
        assert second.status_code == 204

    def test_user_with_no_data_returns_204(self):
        """A brand-new account that never used the app deletes cleanly."""
        db = TestingSessionLocal()
        user_id = str(uuid.uuid4())
        db.add(User(id=user_id, clerk_id=f"user_{uuid.uuid4().hex[:10]}"))
        db.commit()
        db.close()

        with patch(
            "app.services.clerk_admin_service.delete_user", return_value=True
        ):
            resp = client.delete("/api/users/me", headers=_auth(user_id))
        assert resp.status_code == 204


class TestDeleteAccountPartialFailure:
    def test_clerk_error_surfaces_502_without_stack_trace(self, tmp_path):
        user, paths = _seed_user_with_data(tmp_path)

        with patch(
            "app.services.clerk_admin_service.delete_user",
            side_effect=ClerkApiError("DELETE /users/x -> 500: boom"),
        ):
            resp = client.delete("/api/users/me", headers=_auth(user.id))

        assert resp.status_code == 502
        detail = resp.json()["detail"]
        assert "Traceback" not in detail
        assert "boom" not in detail, "Clerk response body leaked to the client"

        # Local data is already gone — the contract is "local first, Clerk
        # last", so a Clerk failure must not roll the erasure back.
        assert all(v == 0 for v in _counts_for(user.id).values())
        assert not os.path.exists(paths[0])

    def test_missing_clerk_secret_returns_503(self, tmp_path, clerk_secret_configured):
        user, _ = _seed_user_with_data(tmp_path)
        clerk_secret_configured.return_value.clerk_secret_key = ""

        resp = client.delete("/api/users/me", headers=_auth(user.id))

        assert resp.status_code == 503
        assert "Traceback" not in resp.json()["detail"]
        assert all(v == 0 for v in _counts_for(user.id).values())


class TestClerkDeleteUserClient:
    """Unit tests for clerk_admin_service.delete_user (httpx mocked)."""

    def test_returns_true_on_200(self):
        from app.services import clerk_admin_service

        with patch("app.services.clerk_admin_service.httpx.delete") as mock:
            mock.return_value.status_code = 200
            assert clerk_admin_service.delete_user("sk_x", "user_1") is True

    def test_returns_false_on_404(self):
        from app.services import clerk_admin_service

        with patch("app.services.clerk_admin_service.httpx.delete") as mock:
            mock.return_value.status_code = 404
            assert clerk_admin_service.delete_user("sk_x", "user_1") is False

    def test_raises_on_500(self):
        from app.services import clerk_admin_service

        with patch("app.services.clerk_admin_service.httpx.delete") as mock:
            mock.return_value.status_code = 500
            mock.return_value.text = "server error"
            with pytest.raises(ClerkApiError):
                clerk_admin_service.delete_user("sk_x", "user_1")

    def test_raises_on_transport_error(self):
        import httpx

        from app.services import clerk_admin_service

        with patch(
            "app.services.clerk_admin_service.httpx.delete",
            side_effect=httpx.ConnectError("no route"),
        ):
            with pytest.raises(ClerkApiError):
                clerk_admin_service.delete_user("sk_x", "user_1")

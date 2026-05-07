"""Tests for admin endpoints (B013)."""

import os
import sys
import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.main import app
from app.models.user import User
from conftest import TestingSessionLocal

client = TestClient(app)


def _create_user() -> User:
    db = TestingSessionLocal()
    user = User(
        id=str(uuid.uuid4()),
        email=f"admin_{uuid.uuid4().hex[:8]}@example.com",
        username=f"admin_{uuid.uuid4().hex[:8]}",
        hashed_password="hashed",
        full_name="Admin Tester",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    return user


def _auth_header(user_id: str) -> dict:
    """A019: dev-mode X-User-ID header. ENVIRONMENT defaults to 'development'
    in tests, so deps.get_current_user_id accepts this fallback."""
    return {"X-User-ID": str(user_id)}


class TestSyncDbEndpoint:
    def test_sync_requires_auth(self):
        resp = client.post("/api/admin/sync-db")
        assert resp.status_code in (401, 403)

    def test_sync_rejects_invalid_token(self):
        resp = client.post(
            "/api/admin/sync-db",
            headers={"Authorization": "Bearer not-a-real-token"},
        )
        assert resp.status_code == 401

    def test_sync_success(self, tmp_path):
        user = _create_user()
        db_file = tmp_path / "kilter.db"
        db_file.write_bytes(b"fake-db-contents")

        fake_settings = MagicMock()
        fake_settings.boardlib_db_path = str(db_file)

        fake_result = MagicMock()
        fake_result.returncode = 0
        fake_result.stderr = ""
        fake_result.stdout = "Downloaded."

        with patch("app.api.admin.get_settings", return_value=fake_settings), patch(
            "app.api.admin.subprocess.run", return_value=fake_result
        ) as run_mock:
            resp = client.post(
                "/api/admin/sync-db", headers=_auth_header(user.id)
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"
        assert body["path"] == str(db_file)
        assert body["size_bytes"] == len(b"fake-db-contents")

        # Verify the subprocess was called with the boardlib command
        call_args = run_mock.call_args[0][0]
        assert "boardlib" in call_args
        assert "kilter" in call_args
        assert str(db_file) in call_args

    def test_sync_subprocess_failure(self, tmp_path):
        user = _create_user()
        db_file = tmp_path / "kilter.db"

        fake_settings = MagicMock()
        fake_settings.boardlib_db_path = str(db_file)

        fake_result = MagicMock()
        fake_result.returncode = 1
        fake_result.stderr = "network unreachable"
        fake_result.stdout = ""

        with patch("app.api.admin.get_settings", return_value=fake_settings), patch(
            "app.api.admin.subprocess.run", return_value=fake_result
        ):
            resp = client.post(
                "/api/admin/sync-db", headers=_auth_header(user.id)
            )

        assert resp.status_code == 500
        assert "network unreachable" in resp.json()["detail"]

    def test_sync_timeout(self, tmp_path):
        import subprocess as real_subprocess

        user = _create_user()
        db_file = tmp_path / "kilter.db"

        fake_settings = MagicMock()
        fake_settings.boardlib_db_path = str(db_file)

        with patch("app.api.admin.get_settings", return_value=fake_settings), patch(
            "app.api.admin.subprocess.run",
            side_effect=real_subprocess.TimeoutExpired(cmd="boardlib", timeout=600),
        ):
            resp = client.post(
                "/api/admin/sync-db", headers=_auth_header(user.id)
            )

        assert resp.status_code == 504

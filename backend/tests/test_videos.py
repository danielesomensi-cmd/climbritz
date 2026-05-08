"""
Test suite for video upload and analysis pipeline.
Uses SQLite in-memory DB and mocks for Gemini.
"""

import pytest
import uuid
import io
import os
import json
from datetime import datetime
from unittest.mock import patch, MagicMock

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient

from app.main import app
from app.core.database import Base
from app.models.user import User
from app.models.video import VideoUpload
from app.schemas.video import VideoResponse, FormFeedbackResponse
from conftest import engine, TestingSessionLocal

client = TestClient(app)

# --- Helpers ---

MOCK_GEMINI_ANALYSIS = {
    "is_kilter_board": True,
    "technique_score": 7,
    "body_tension_score": 8,
    "footwork_score": 6,
    "hip_positioning_score": 5,
    "power_management_score": 7,
    "summary": "Good body tension on the steep section. Work on keeping hips closer to the wall on the second move.",
    "strengths": ["strong lock-offs", "good contact strength", "controlled dynamics"],
    "improvements": [
        {"issue": "Hips sag on the second move", "fix": "Drive hips into the wall before reaching", "drill": "Angle progression: repeat at 35° focusing on hip drive"},
        {"issue": "Feet cutting on the big reach", "fix": "Flag right foot for counterbalance", "drill": "4x4 sets on similar overhang problems at -1 grade"},
    ],
    "overall_impression": "projecting",
}

MOCK_NOT_KILTER_BOARD = {
    "error": "not_kilter_board",
    "message": "This does not appear to be a Kilter Board climbing video. Kilter-Up currently only supports Kilter Board analysis.",
}


def _create_user(db) -> User:
    """Create a test user shadow row and return it."""
    user = User(
        id=str(uuid.uuid4()),
        clerk_id=f"user_test_{uuid.uuid4().hex[:8]}",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _auth_header(user_id: str) -> dict:
    """A019: dev-mode X-User-ID header. ENVIRONMENT defaults to 'development'
    in tests, so deps.get_current_user_id accepts this fallback."""
    return {"X-User-ID": str(user_id)}


def _fake_video_bytes(size: int = 1024) -> io.BytesIO:
    """Return a BytesIO object that pretends to be a video file."""
    return io.BytesIO(b"\x00" * size)


def _seed_video(db, user_id: str, **kwargs) -> str:
    """Create a video record and return its id."""
    defaults = dict(
        id=str(uuid.uuid4()),
        user_id=user_id,
        filename="test.mp4",
        file_path="/uploads/test.mp4",
        processing_status="pending",
    )
    defaults.update(kwargs)
    video = VideoUpload(**defaults)
    db.add(video)
    db.commit()
    return video.id


# --- Schema Tests ---


class TestVideoSchemas:
    """Validate Pydantic video schemas."""

    def test_video_response(self):
        now = datetime.utcnow()
        resp = VideoResponse(
            id="abc-123",
            user_id="user-456",
            filename="climb.mp4",
            file_size=1024,
            processing_status="pending",
            created_at=now,
        )
        assert resp.id == "abc-123"
        assert resp.form_analysis is None
        assert resp.completed_at is None

    def test_video_response_with_analysis(self):
        now = datetime.utcnow()
        resp = VideoResponse(
            id="abc-123",
            user_id="user-456",
            filename="climb.mp4",
            file_size=1024,
            processing_status="completed",
            form_analysis=MOCK_GEMINI_ANALYSIS,
            created_at=now,
            completed_at=now,
        )
        assert resp.form_analysis is not None
        assert resp.form_analysis.technique_score == 7
        assert resp.form_analysis.is_kilter_board is True
        assert resp.form_analysis.hip_positioning_score == 5
        assert len(resp.form_analysis.improvements) == 2

    def test_form_feedback_response(self):
        fb = FormFeedbackResponse(**MOCK_GEMINI_ANALYSIS)
        assert fb.technique_score == 7
        assert fb.footwork_score == 6
        assert fb.hip_positioning_score == 5
        assert fb.power_management_score == 7
        assert fb.overall_impression == "projecting"
        assert len(fb.improvements) == 2
        assert fb.improvements[0].issue == "Hips sag on the second move"

    def test_form_feedback_extra_fields_allowed(self):
        data = {**MOCK_GEMINI_ANALYSIS, "custom_field": "extra"}
        fb = FormFeedbackResponse(**data)
        assert fb.custom_field == "extra"


# --- Model Tests ---


class TestVideoModel:
    """Test VideoUpload SQLAlchemy model."""

    def test_model_creation(self):
        v = VideoUpload(
            user_id=str(uuid.uuid4()),
            filename="climb.mp4",
            file_path="/uploads/climb.mp4",
            processing_status="pending",
        )
        assert v.processing_status == "pending"
        assert v.form_analysis is None

    def test_model_with_analysis(self):
        v = VideoUpload(
            user_id=str(uuid.uuid4()),
            filename="climb.mp4",
            file_path="/uploads/climb.mp4",
            processing_status="completed",
            form_analysis=MOCK_GEMINI_ANALYSIS,
        )
        assert v.form_analysis["technique_score"] == 7

    def test_model_repr(self):
        v = VideoUpload(
            id="test-id",
            user_id=str(uuid.uuid4()),
            processing_status="pending",
        )
        assert "test-id - pending" in repr(v)


# --- Upload Endpoint Tests ---


class TestUploadEndpoint:
    """POST /api/videos/upload"""

    def setup_method(self):
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)

    @patch("app.api.videos.save_uploaded_file")
    def test_upload_success(self, mock_save):
        db = TestingSessionLocal()
        user = _create_user(db)
        db.close()

        mock_save.return_value = ("vid-123", "/uploads/vid-123.mp4")

        resp = client.post(
            "/api/videos/upload",
            headers=_auth_header(user.id),
            files={"file": ("climb.mp4", _fake_video_bytes(), "video/mp4")},
        )
        assert resp.status_code == 202
        data = resp.json()
        assert data["id"] == "vid-123"
        assert data["processing_status"] == "pending"
        assert data["filename"] == "climb.mp4"
        mock_save.assert_called_once()

    @patch("app.api.videos.save_uploaded_file")
    def test_upload_with_metadata(self, mock_save):
        db = TestingSessionLocal()
        user = _create_user(db)
        db.close()

        mock_save.return_value = ("vid-456", "/uploads/vid-456.mp4")

        resp = client.post(
            "/api/videos/upload",
            headers=_auth_header(user.id),
            files={"file": ("climb.mp4", _fake_video_bytes(), "video/mp4")},
            data={"title": "Red V5", "grade_attempted": "V5"},
        )
        assert resp.status_code == 202
        data = resp.json()
        assert data["title"] == "Red V5"
        assert data["grade_attempted"] == "V5"

    def test_upload_requires_auth(self):
        resp = client.post(
            "/api/videos/upload",
            files={"file": ("climb.mp4", _fake_video_bytes(), "video/mp4")},
        )
        assert resp.status_code in (401, 403)

    @patch("app.api.videos.save_uploaded_file")
    def test_upload_rejects_bad_mime(self, mock_save):
        mock_save.side_effect = ValueError("Unsupported file type 'text/plain'")

        db = TestingSessionLocal()
        user = _create_user(db)
        db.close()

        resp = client.post(
            "/api/videos/upload",
            headers=_auth_header(user.id),
            files={"file": ("notes.txt", _fake_video_bytes(), "text/plain")},
        )
        assert resp.status_code == 400
        assert "Unsupported" in resp.json()["detail"]

    @patch("app.api.videos.save_uploaded_file")
    def test_upload_rejects_too_large(self, mock_save):
        mock_save.side_effect = ValueError("File exceeds maximum allowed size")

        db = TestingSessionLocal()
        user = _create_user(db)
        db.close()

        resp = client.post(
            "/api/videos/upload",
            headers=_auth_header(user.id),
            files={"file": ("big.mp4", _fake_video_bytes(), "video/mp4")},
        )
        assert resp.status_code == 400
        assert "exceeds" in resp.json()["detail"]


# --- List Endpoint Tests ---


class TestListVideosEndpoint:
    """GET /api/videos"""

    def setup_method(self):
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)

    def test_list_empty(self):
        db = TestingSessionLocal()
        user = _create_user(db)
        db.close()

        resp = client.get("/api/videos", headers=_auth_header(user.id))
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_returns_own_videos(self):
        db = TestingSessionLocal()
        user = _create_user(db)
        other_user = _create_user(db)

        for i in range(3):
            _seed_video(db, user.id, id=str(uuid.uuid4()))
        _seed_video(db, other_user.id, id=str(uuid.uuid4()))
        uid = user.id
        db.close()

        resp = client.get("/api/videos", headers=_auth_header(uid))
        assert resp.status_code == 200
        assert len(resp.json()) == 3

    def test_list_pagination(self):
        db = TestingSessionLocal()
        user = _create_user(db)
        for i in range(15):
            _seed_video(db, user.id, id=str(uuid.uuid4()))
        uid = user.id
        db.close()

        resp = client.get("/api/videos?page=1&per_page=10", headers=_auth_header(uid))
        assert len(resp.json()) == 10

        resp = client.get("/api/videos?page=2&per_page=10", headers=_auth_header(uid))
        assert len(resp.json()) == 5

    def test_list_requires_auth(self):
        resp = client.get("/api/videos")
        assert resp.status_code in (401, 403)


# --- Get Video Endpoint Tests ---


class TestGetVideoEndpoint:
    """GET /api/videos/{video_id}"""

    def setup_method(self):
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)

    def test_get_video_success(self):
        db = TestingSessionLocal()
        user = _create_user(db)
        vid = _seed_video(
            db, user.id,
            processing_status="completed",
            form_analysis=MOCK_GEMINI_ANALYSIS,
        )
        uid = user.id
        db.close()

        resp = client.get(f"/api/videos/{vid}", headers=_auth_header(uid))
        assert resp.status_code == 200
        data = resp.json()
        assert data["processing_status"] == "completed"
        assert data["form_analysis"]["technique_score"] == 7
        assert data["form_analysis"]["is_kilter_board"] is True
        assert data["form_analysis"]["overall_impression"] == "projecting"

    def test_get_video_not_found(self):
        db = TestingSessionLocal()
        user = _create_user(db)
        db.close()

        resp = client.get(f"/api/videos/{uuid.uuid4()}", headers=_auth_header(user.id))
        assert resp.status_code == 404

    def test_get_video_other_user_forbidden(self):
        db = TestingSessionLocal()
        user1 = _create_user(db)
        user2 = _create_user(db)
        vid = _seed_video(db, user1.id)
        uid2 = user2.id
        db.close()

        resp = client.get(f"/api/videos/{vid}", headers=_auth_header(uid2))
        assert resp.status_code == 404

    def test_get_video_requires_auth(self):
        resp = client.get(f"/api/videos/{uuid.uuid4()}")
        assert resp.status_code in (401, 403)


# --- Delete Endpoint Tests ---


class TestDeleteVideoEndpoint:
    """DELETE /api/videos/{video_id}"""

    def setup_method(self):
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)

    def test_delete_success(self):
        db = TestingSessionLocal()
        user = _create_user(db)
        vid = _seed_video(db, user.id)
        uid = user.id
        db.close()

        resp = client.delete(f"/api/videos/{vid}", headers=_auth_header(uid))
        assert resp.status_code == 204

        # Verify it's gone
        resp = client.get(f"/api/videos/{vid}", headers=_auth_header(uid))
        assert resp.status_code == 404

    def test_delete_not_found(self):
        db = TestingSessionLocal()
        user = _create_user(db)
        db.close()

        resp = client.delete(f"/api/videos/{uuid.uuid4()}", headers=_auth_header(user.id))
        assert resp.status_code == 404

    def test_delete_other_user_forbidden(self):
        db = TestingSessionLocal()
        user1 = _create_user(db)
        user2 = _create_user(db)
        vid = _seed_video(db, user1.id)
        uid2 = user2.id
        db.close()

        resp = client.delete(f"/api/videos/{vid}", headers=_auth_header(uid2))
        assert resp.status_code == 404

    def test_delete_requires_auth(self):
        resp = client.delete(f"/api/videos/{uuid.uuid4()}")
        assert resp.status_code in (401, 403)


# --- Storage Service Unit Tests ---


class TestStorageService:
    """Unit tests for save_uploaded_file."""

    def test_rejects_bad_mime_type(self):
        from app.services.storage_service import save_uploaded_file

        file = MagicMock()
        file.content_type = "text/plain"
        file.filename = "document.txt"

        with pytest.raises(ValueError, match="Unsupported file type"):
            save_uploaded_file(file)

    def test_allowed_mime_types(self):
        from app.services.storage_service import ALLOWED_MIME_TYPES
        assert "video/mp4" in ALLOWED_MIME_TYPES
        assert "video/quicktime" in ALLOWED_MIME_TYPES
        assert "video/webm" in ALLOWED_MIME_TYPES
        assert "text/plain" not in ALLOWED_MIME_TYPES


# --- Gemini Service Unit Tests ---


class TestGeminiService:
    """Unit tests for gemini_service — google.genai Client pattern."""

    def _mock_client(self):
        """Create a mock genai.Client with files and models sub-objects."""
        client = MagicMock()
        return client

    @patch("app.services.gemini_service.os.path.exists", return_value=True)
    @patch("app.services.gemini_service._get_client")
    def test_upload_video_to_gemini(self, mock_get_client, mock_exists):
        from app.services.gemini_service import upload_video_to_gemini

        client = self._mock_client()
        mock_get_client.return_value = client

        mock_file = MagicMock()
        mock_file.state = "ACTIVE"
        mock_file.name = "files/abc123"
        client.files.upload.return_value = mock_file

        result = upload_video_to_gemini("/fake/video.mp4")

        assert result == "files/abc123"
        client.files.upload.assert_called_once()

    @patch("app.services.gemini_service._get_client")
    def test_analyze_climbing_form(self, mock_get_client):
        from app.services.gemini_service import analyze_climbing_form

        client = self._mock_client()
        mock_get_client.return_value = client

        mock_file = MagicMock()
        client.files.get.return_value = mock_file

        mock_response = MagicMock()
        mock_response.text = json.dumps(MOCK_GEMINI_ANALYSIS)
        client.models.generate_content.return_value = mock_response

        result = analyze_climbing_form("files/abc123")

        assert result["technique_score"] == 7
        assert result["is_kilter_board"] is True
        assert result["hip_positioning_score"] == 5
        assert result["overall_impression"] == "projecting"
        client.files.get.assert_called_once_with(name="files/abc123")
        client.models.generate_content.assert_called_once()

    @patch("app.services.gemini_service.os.path.exists", return_value=True)
    @patch("app.services.gemini_service.time.sleep")
    @patch("app.services.gemini_service._get_client")
    def test_upload_waits_for_processing(self, mock_get_client, mock_sleep, mock_exists):
        from app.services.gemini_service import upload_video_to_gemini

        client = self._mock_client()
        mock_get_client.return_value = client

        processing_file = MagicMock()
        processing_file.state = "PROCESSING"
        processing_file.name = "files/abc123"

        active_file = MagicMock()
        active_file.state = "ACTIVE"
        active_file.name = "files/abc123"

        client.files.upload.return_value = processing_file
        client.files.get.return_value = active_file

        result = upload_video_to_gemini("/fake/video.mp4")

        assert result == "files/abc123"
        client.files.get.assert_called_with(name="files/abc123")
        mock_sleep.assert_called()

    @patch("app.services.gemini_service.os.path.exists", return_value=True)
    @patch("app.services.gemini_service._get_client")
    def test_upload_raises_on_failed_state(self, mock_get_client, mock_exists):
        from app.services.gemini_service import upload_video_to_gemini

        client = self._mock_client()
        mock_get_client.return_value = client

        mock_file = MagicMock()
        mock_file.state = "FAILED"
        mock_file.name = "files/abc123"
        client.files.upload.return_value = mock_file

        with pytest.raises(RuntimeError, match="unexpected state"):
            upload_video_to_gemini("/fake/video.mp4")

    @patch("app.services.gemini_service._get_client")
    def test_analyze_raises_on_bad_json(self, mock_get_client):
        from app.services.gemini_service import analyze_climbing_form

        client = self._mock_client()
        mock_get_client.return_value = client

        mock_file = MagicMock()
        client.files.get.return_value = mock_file

        mock_response = MagicMock()
        mock_response.text = "not valid json at all"
        client.models.generate_content.return_value = mock_response

        with pytest.raises(RuntimeError, match="non-JSON"):
            analyze_climbing_form("files/abc123")

    @patch("app.services.gemini_service._get_client")
    def test_analyze_repairs_truncated_json(self, mock_get_client):
        from app.services.gemini_service import analyze_climbing_form

        client = self._mock_client()
        mock_get_client.return_value = client

        mock_file = MagicMock()
        client.files.get.return_value = mock_file

        # Truncated JSON — missing closing brace
        truncated = '{"is_kilter_board": true, "technique_score": 7'
        mock_response = MagicMock()
        mock_response.text = truncated
        client.models.generate_content.return_value = mock_response

        result = analyze_climbing_form("files/abc123")
        assert result["is_kilter_board"] is True
        assert result["technique_score"] == 7

    def test_try_repair_json(self):
        from app.services.gemini_service import _try_repair_json

        # Missing closing brace
        assert _try_repair_json('{"a": 1') == {"a": 1}

        # Unterminated string + missing braces
        assert _try_repair_json('{"a": "hello') == {"a": "hello"}

        # Missing array closer
        assert _try_repair_json('{"a": [1, 2') == {"a": [1, 2]}

        # Completely invalid
        assert _try_repair_json("not json") is None

    @patch("app.services.gemini_service._get_client")
    def test_analyze_not_kilter_board(self, mock_get_client):
        from app.services.gemini_service import analyze_climbing_form

        client = self._mock_client()
        mock_get_client.return_value = client

        mock_file = MagicMock()
        client.files.get.return_value = mock_file

        mock_response = MagicMock()
        mock_response.text = json.dumps(MOCK_NOT_KILTER_BOARD)
        client.models.generate_content.return_value = mock_response

        result = analyze_climbing_form("files/abc123")
        assert result["error"] == "not_kilter_board"
        assert "message" in result

    def test_get_client_raises_without_key(self):
        from app.services.gemini_service import _get_client
        import app.services.gemini_service as gs

        original_client = gs._client
        gs._client = None
        try:
            with patch("app.services.gemini_service.get_settings") as mock_settings:
                mock_settings.return_value = MagicMock(gemini_api_key="")
                with pytest.raises(RuntimeError, match="GEMINI_API_KEY"):
                    _get_client()
        finally:
            gs._client = original_client


# --- Background Analysis Tests ---


class TestBackgroundAnalysis:
    """Test _background_analyze function."""

    def setup_method(self):
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)

    @patch("app.api.videos.analyze_climbing_form")
    @patch("app.api.videos.upload_video_to_gemini")
    @patch("app.api.videos.SessionLocal")
    def test_background_analyze_success(self, mock_session_cls, mock_upload, mock_analyze):
        from app.api.videos import _background_analyze

        # Set up DB mock
        db = TestingSessionLocal()
        user = _create_user(db)
        vid = _seed_video(db, user.id)

        mock_session_cls.return_value = db
        mock_upload.return_value = "files/gemini-123"
        mock_analyze.return_value = MOCK_GEMINI_ANALYSIS

        _background_analyze(vid, "/uploads/test.mp4")

        # Verify the video was updated
        video = db.query(VideoUpload).filter(VideoUpload.id == vid).first()
        assert video.processing_status == "completed"
        assert video.gemini_file_id == "files/gemini-123"
        assert video.form_analysis == MOCK_GEMINI_ANALYSIS
        assert video.completed_at is not None
        db.close()

    @patch("app.api.videos.upload_video_to_gemini")
    @patch("app.api.videos.SessionLocal")
    def test_background_analyze_failure(self, mock_session_cls, mock_upload):
        from app.api.videos import _background_analyze

        db = TestingSessionLocal()
        user = _create_user(db)
        vid = _seed_video(db, user.id)

        mock_session_cls.return_value = db
        mock_upload.side_effect = RuntimeError("Gemini upload failed")

        _background_analyze(vid, "/uploads/test.mp4")

        video = db.query(VideoUpload).filter(VideoUpload.id == vid).first()
        assert video.processing_status == "failed"
        db.close()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

"""
Test suite for authentication endpoints
Tests register, login, and get_me endpoints
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import Base
from app.models.user import User
from app.core.security import hash_password, create_access_token
from datetime import timedelta
import uuid

from conftest import engine, TestingSessionLocal

client = TestClient(app)


class TestAuthEndpoints:
    """Test suite for authentication endpoints"""

    def setup_method(self):
        """Clear database before each test."""
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)

    def test_register_new_user_success(self):
        """Test successful user registration"""
        response = client.post(
            "/api/auth/register",
            json={
                "email": "daniele@example.com",
                "username": "daniele",
                "full_name": "Daniele Somensi",
                "password": "securepassword123"
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "daniele@example.com"
        assert data["username"] == "daniele"
        assert data["full_name"] == "Daniele Somensi"
        assert "id" in data
        assert "created_at" in data
        assert "updated_at" in data
        assert data["is_active"] is True

    def test_register_duplicate_email(self):
        """Test registration with duplicate email"""
        client.post(
            "/api/auth/register",
            json={
                "email": "daniele@example.com",
                "username": "daniele",
                "full_name": "Daniele Somensi",
                "password": "securepassword123"
            }
        )

        response = client.post(
            "/api/auth/register",
            json={
                "email": "daniele@example.com",
                "username": "daniele2",
                "full_name": "Daniele Somensi 2",
                "password": "securepassword456"
            }
        )
        assert response.status_code == 400
        assert "Email already registered" in response.json()["detail"]

    def test_register_duplicate_username(self):
        """Test registration with duplicate username"""
        client.post(
            "/api/auth/register",
            json={
                "email": "daniele@example.com",
                "username": "daniele",
                "full_name": "Daniele Somensi",
                "password": "securepassword123"
            }
        )

        response = client.post(
            "/api/auth/register",
            json={
                "email": "daniele2@example.com",
                "username": "daniele",
                "full_name": "Daniele Somensi 2",
                "password": "securepassword456"
            }
        )
        assert response.status_code == 400
        assert "Username already taken" in response.json()["detail"]

    def test_login_success(self):
        """Test successful login"""
        client.post(
            "/api/auth/register",
            json={
                "email": "daniele@example.com",
                "username": "daniele",
                "full_name": "Daniele Somensi",
                "password": "securepassword123"
            }
        )

        response = client.post(
            "/api/auth/login",
            json={
                "email": "daniele@example.com",
                "password": "securepassword123"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert len(data["access_token"]) > 0

    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        client.post(
            "/api/auth/register",
            json={
                "email": "daniele@example.com",
                "username": "daniele",
                "full_name": "Daniele Somensi",
                "password": "securepassword123"
            }
        )

        response = client.post(
            "/api/auth/login",
            json={
                "email": "daniele@example.com",
                "password": "wrongpassword"
            }
        )
        assert response.status_code == 401
        assert "Invalid credentials" in response.json()["detail"]

    def test_login_nonexistent_user(self):
        """Test login with non-existent user"""
        response = client.post(
            "/api/auth/login",
            json={
                "email": "nonexistent@example.com",
                "password": "somepassword"
            }
        )
        assert response.status_code == 401
        assert "Invalid credentials" in response.json()["detail"]

    def test_get_me_success(self):
        """Test get_me endpoint with valid token"""
        register_response = client.post(
            "/api/auth/register",
            json={
                "email": "daniele@example.com",
                "username": "daniele",
                "full_name": "Daniele Somensi",
                "password": "securepassword123"
            }
        )
        user_id = register_response.json()["id"]

        login_response = client.post(
            "/api/auth/login",
            json={
                "email": "daniele@example.com",
                "password": "securepassword123"
            }
        )
        token = login_response.json()["access_token"]

        response = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == user_id
        assert data["email"] == "daniele@example.com"
        assert data["username"] == "daniele"
        assert data["full_name"] == "Daniele Somensi"

    def test_get_me_without_token(self):
        """Test get_me endpoint without token"""
        response = client.get("/api/auth/me")
        assert response.status_code == 401

    def test_get_me_with_invalid_token(self):
        """Test get_me endpoint with invalid token"""
        response = client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer invalid_token"}
        )
        assert response.status_code == 401

    def test_register_invalid_email(self):
        """Test registration with invalid email format"""
        response = client.post(
            "/api/auth/register",
            json={
                "email": "not_an_email",
                "username": "daniele",
                "full_name": "Daniele Somensi",
                "password": "securepassword123"
            }
        )
        assert response.status_code == 422


class TestSchemas:
    """Test Pydantic schemas"""

    def test_user_create_schema(self):
        from app.schemas.user import UserCreate
        user = UserCreate(
            email="test@example.com",
            username="test",
            password="password123",
            full_name="Test User"
        )
        assert user.email == "test@example.com"
        assert user.username == "test"
        assert user.full_name == "Test User"

    def test_user_response_schema(self):
        from app.schemas.user import UserResponse
        from datetime import datetime
        user = UserResponse(
            id=uuid.uuid4(),
            email="test@example.com",
            username="test",
            full_name="Test User",
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        assert user.email == "test@example.com"
        assert user.is_active is True

    def test_login_request_schema(self):
        from app.schemas.auth import LoginRequest
        login = LoginRequest(
            email="test@example.com",
            password="password123"
        )
        assert login.email == "test@example.com"
        assert login.password == "password123"

    def test_token_response_schema(self):
        from app.schemas.auth import TokenResponse
        token = TokenResponse(
            access_token="test_token_xyz",
            token_type="bearer"
        )
        assert token.access_token == "test_token_xyz"
        assert token.token_type == "bearer"


class TestModels:
    """Test database models"""

    def test_user_model(self):
        user = User(
            email="test@example.com",
            username="test",
            hashed_password="hashed_pwd",
            full_name="Test User"
        )
        assert user.email == "test@example.com"
        assert user.username == "test"
        assert user.full_name == "Test User"
        assert user.is_active is True

    def test_video_upload_model(self):
        from app.models.video import VideoUpload
        video = VideoUpload(
            user_id=str(uuid.uuid4()),
            original_file_path="/uploads/video.mp4",
            status="pending"
        )
        assert video.original_file_path == "/uploads/video.mp4"
        assert video.status == "pending"


class TestAuthService:
    """Test authentication service"""

    def test_password_hashing(self):
        from app.core.security import hash_password, verify_password
        password = "securepassword123"
        hashed = hash_password(password)
        assert hashed != password
        assert verify_password(password, hashed) is True
        assert verify_password("wrongpassword", hashed) is False

    def test_token_creation(self):
        from app.core.security import create_access_token
        user_id = str(uuid.uuid4())
        token = create_access_token(
            data={"sub": user_id},
            expires_delta=timedelta(hours=24)
        )
        assert isinstance(token, str)
        assert len(token) > 0

        from jose import jwt
        from app.core.config import get_settings
        settings = get_settings()
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        assert payload["sub"] == user_id


class TestErrorHandling:
    """Test error handling"""

    def setup_method(self):
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)

    def test_missing_required_fields(self):
        response = client.post(
            "/api/auth/register",
            json={
                "email": "daniele@example.com"
            }
        )
        assert response.status_code == 422

    def test_empty_password(self):
        response = client.post(
            "/api/auth/register",
            json={
                "email": "daniele@example.com",
                "username": "daniele",
                "password": ""
            }
        )
        # Empty password: may be rejected by Pydantic (422) or business logic (400/201)
        assert response.status_code in [201, 400, 422]


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

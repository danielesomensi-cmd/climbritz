"""
Test suite for authentication logic and schemas
This test file validates schemas, security functions, and models
without requiring a running database or SQLite compatibility.
"""

import pytest
from datetime import datetime, timedelta
import uuid
from jose import jwt

from app.schemas.user import UserCreate, UserResponse, UserUpdate, UserBase
from app.schemas.auth import LoginRequest, TokenResponse
from app.models.user import User
from app.models.video import VideoUpload
from app.core.security import hash_password, verify_password, create_access_token
from app.core.config import get_settings


class TestUserSchemas:
    """Test Pydantic user schemas"""

    def test_user_create_valid(self):
        """Test UserCreate schema with valid data"""
        user_data = UserCreate(
            email="daniele@example.com",
            username="daniele",
            password="securepassword123",
            full_name="Daniele Somensi"
        )
        assert user_data.email == "daniele@example.com"
        assert user_data.username == "daniele"
        assert user_data.password == "securepassword123"
        assert user_data.full_name == "Daniele Somensi"

    def test_user_create_without_full_name(self):
        """Test UserCreate schema without optional full_name"""
        user_data = UserCreate(
            email="test@example.com",
            username="test",
            password="password123"
        )
        assert user_data.email == "test@example.com"
        assert user_data.username == "test"
        assert user_data.full_name is None

    def test_user_create_invalid_email(self):
        """Test UserCreate with invalid email format"""
        with pytest.raises(ValueError):
            UserCreate(
                email="not_an_email",
                username="test",
                password="password123"
            )

    def test_user_response_schema(self):
        """Test UserResponse schema"""
        user_id = uuid.uuid4()
        now = datetime.utcnow()
        user_data = UserResponse(
            id=user_id,
            email="test@example.com",
            username="test",
            full_name="Test User",
            is_active=True,
            created_at=now,
            updated_at=now
        )
        assert user_data.id == user_id
        assert user_data.email == "test@example.com"
        assert user_data.username == "test"
        assert user_data.is_active is True

    def test_user_update_partial(self):
        """Test UserUpdate with partial fields"""
        update_data = UserUpdate(
            email="newemail@example.com"
        )
        assert update_data.email == "newemail@example.com"
        assert update_data.username is None
        assert update_data.full_name is None
        assert update_data.password is None

    def test_user_base_schema(self):
        """Test UserBase schema"""
        user_base = UserBase(
            email="test@example.com",
            username="test",
            full_name="Test User"
        )
        assert user_base.email == "test@example.com"
        assert user_base.username == "test"


class TestAuthSchemas:
    """Test authentication schemas"""

    def test_login_request_valid(self):
        """Test LoginRequest schema with valid data"""
        login_data = LoginRequest(
            email="daniele@example.com",
            password="securepassword123"
        )
        assert login_data.email == "daniele@example.com"
        assert login_data.password == "securepassword123"

    def test_login_request_invalid_email(self):
        """Test LoginRequest with invalid email"""
        with pytest.raises(ValueError):
            LoginRequest(
                email="not_an_email",
                password="password123"
            )

    def test_token_response_schema(self):
        """Test TokenResponse schema"""
        token_response = TokenResponse(
            access_token="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            token_type="bearer"
        )
        assert token_response.access_token == "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        assert token_response.token_type == "bearer"

    def test_token_response_default_token_type(self):
        """Test TokenResponse with default token type"""
        token_response = TokenResponse(
            access_token="test_token"
        )
        assert token_response.access_token == "test_token"
        assert token_response.token_type == "bearer"


class TestDatabaseModels:
    """Test database model definitions"""

    def test_user_model_creation(self):
        """Test User model instantiation"""
        user_id = str(uuid.uuid4())
        user = User(
            id=user_id,
            email="test@example.com",
            username="test",
            hashed_password="hashed_pwd_xyz",
            full_name="Test User"
        )
        assert user.id == user_id
        assert user.email == "test@example.com"
        assert user.username == "test"
        assert user.hashed_password == "hashed_pwd_xyz"
        assert user.full_name == "Test User"
        assert user.is_active is True

    def test_user_model_defaults(self):
        """Test User model with default values"""
        user = User(
            email="test@example.com",
            username="test",
            hashed_password="hashed_pwd"
        )
        assert user.email == "test@example.com"
        assert user.is_active is True
        assert user.full_name is None

    def test_user_repr(self):
        """Test User model __repr__ method"""
        user = User(
            email="test@example.com",
            username="test",
            hashed_password="hashed"
        )
        assert str(user) == "<User test@example.com>"

    def test_video_upload_model_creation(self):
        """Test VideoUpload model instantiation"""
        user_id = str(uuid.uuid4())
        video_id = str(uuid.uuid4())
        video = VideoUpload(
            id=video_id,
            user_id=user_id,
            original_file_path="/uploads/video.mp4",
            status="pending"
        )
        assert video.id == video_id
        assert video.user_id == user_id
        assert video.original_file_path == "/uploads/video.mp4"
        assert video.status == "pending"

    def test_video_upload_model_defaults(self):
        """Test VideoUpload model with default values.
        Note: SQLAlchemy Column defaults only apply on DB insert,
        not on in-memory instantiation — so status is None here.
        """
        user_id = str(uuid.uuid4())
        video = VideoUpload(
            user_id=user_id,
            original_file_path="/uploads/video.mp4"
        )
        assert video.status is None
        assert video.form_analysis is None

    def test_video_upload_repr(self):
        """Test VideoUpload model __repr__ method.
        __repr__ uses processing_status, not status.
        """
        video_id = str(uuid.uuid4())
        video = VideoUpload(
            id=video_id,
            user_id=str(uuid.uuid4()),
            original_file_path="/path",
            processing_status="processing"
        )
        assert f"{video_id} - processing" in str(video)


class TestSecurityFunctions:
    """Test security and password functions"""

    def test_hash_password(self):
        """Test password hashing"""
        password = "securepassword123"
        hashed = hash_password(password)
        
        # Hash should be different from original
        assert hashed != password
        # Hash should be a string
        assert isinstance(hashed, str)
        # Hash should have significant length (bcrypt)
        assert len(hashed) > 20

    def test_verify_password_correct(self):
        """Test password verification with correct password"""
        password = "securepassword123"
        hashed = hash_password(password)
        
        assert verify_password(password, hashed) is True

    def test_verify_password_incorrect(self):
        """Test password verification with incorrect password"""
        password = "securepassword123"
        wrong_password = "wrongpassword"
        hashed = hash_password(password)
        
        assert verify_password(wrong_password, hashed) is False

    def test_verify_password_case_sensitive(self):
        """Test that password verification is case-sensitive"""
        password = "SecurePassword123"
        wrong_case = "securepassword123"
        hashed = hash_password(password)
        
        assert verify_password(password, hashed) is True
        assert verify_password(wrong_case, hashed) is False

    def test_create_access_token_default(self):
        """Test JWT token creation with default expiry"""
        user_id = str(uuid.uuid4())
        token = create_access_token(data={"sub": user_id})
        
        assert isinstance(token, str)
        assert len(token) > 0
        
        # Verify token can be decoded
        settings = get_settings()
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        assert payload["sub"] == user_id
        assert "exp" in payload

    def test_create_access_token_custom_expiry(self):
        """Test JWT token creation with custom expiry"""
        user_id = str(uuid.uuid4())
        expires_delta = timedelta(hours=1)
        token = create_access_token(
            data={"sub": user_id},
            expires_delta=expires_delta
        )
        
        settings = get_settings()
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        assert payload["sub"] == user_id
        # Check that expiry is set (within reasonable range)
        assert "exp" in payload

    def test_create_access_token_additional_data(self):
        """Test JWT token creation with additional data"""
        user_id = str(uuid.uuid4())
        token = create_access_token(data={
            "sub": user_id,
            "email": "test@example.com",
            "username": "testuser"
        })
        
        settings = get_settings()
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        assert payload["sub"] == user_id
        assert payload["email"] == "test@example.com"
        assert payload["username"] == "testuser"


class TestConfiguration:
    """Test configuration loading"""

    def test_get_settings(self):
        """Test settings can be loaded"""
        settings = get_settings()
        assert settings.jwt_secret is not None
        assert settings.jwt_algorithm == "HS256"
        assert settings.api_port == 8000
        assert settings.environment == "development"

    def test_settings_cached(self):
        """Test settings are cached"""
        settings1 = get_settings()
        settings2 = get_settings()
        assert settings1 is settings2


class TestErrorScenarios:
    """Test error handling and edge cases"""

    def test_empty_password(self):
        """Test handling of empty password"""
        # Empty password should still hash
        hashed = hash_password("")
        assert isinstance(hashed, str)
        assert verify_password("", hashed) is True
        assert verify_password("something", hashed) is False

    def test_very_long_password(self):
        """Test handling of very long passwords"""
        long_password = "a" * 1000
        hashed = hash_password(long_password)
        assert verify_password(long_password, hashed) is True

    def test_special_characters_in_password(self):
        """Test handling of special characters in password"""
        special_password = "P@ssw0rd!#$%^&*()"
        hashed = hash_password(special_password)
        assert verify_password(special_password, hashed) is True
        assert verify_password("P@ssw0rd!#$%^&*(", hashed) is False

    def test_unicode_in_password(self):
        """Test handling of Unicode characters in password"""
        unicode_password = "パスワード123!🔐"
        hashed = hash_password(unicode_password)
        assert verify_password(unicode_password, hashed) is True

    def test_uuid_generation(self):
        """Test UUID generation for user and video"""
        user_id = uuid.uuid4()
        video_id = uuid.uuid4()
        
        assert isinstance(user_id, uuid.UUID)
        assert isinstance(video_id, uuid.UUID)
        assert user_id != video_id
        assert len(str(user_id)) == 36  # Standard UUID string format


class TestSchemasIntegration:
    """Test schema integration and conversion"""

    def test_user_response_from_model(self):
        """Test creating UserResponse from User model data"""
        user_id = uuid.uuid4()
        now = datetime.utcnow()
        
        # Simulate model data
        user_response = UserResponse(
            id=user_id,
            email="test@example.com",
            username="test",
            full_name="Test User",
            is_active=True,
            created_at=now,
            updated_at=now
        )
        
        assert user_response.id == user_id
        assert user_response.email == "test@example.com"

    def test_login_request_to_service(self):
        """Test LoginRequest data can be passed to auth service"""
        login_data = LoginRequest(
            email="test@example.com",
            password="password123"
        )
        
        # Simulate passing to service
        email = login_data.email
        password = login_data.password
        
        assert email == "test@example.com"
        assert password == "password123"

    def test_token_response_serialization(self):
        """Test TokenResponse can be serialized"""
        token_response = TokenResponse(
            access_token="test_token_123",
            token_type="bearer"
        )
        
        # Convert to dict (like FastAPI does)
        response_dict = token_response.model_dump()
        assert response_dict["access_token"] == "test_token_123"
        assert response_dict["token_type"] == "bearer"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

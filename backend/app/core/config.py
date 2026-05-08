from pydantic import model_validator
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    environment: str = "development"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    upload_dir: str = "uploads"
    max_file_size_mb: int = 500
    boardlib_db_path: str = "data/kilter.db"

    # A019: Clerk auth — clerk_jwks_url is REQUIRED in production (validator below)
    clerk_jwks_url: str = ""
    clerk_secret_key: str = ""
    clerk_publishable_key: str = ""

    class Config:
        env_file = ".env"
        # Tolerate unrelated keys in .env / environment so removing a Settings
        # field doesn't require every developer to manually edit their local
        # .env. Notably, JWT_SECRET stays in backend/.env after A019.5 with no
        # consumer — without this, Settings construction would crash on it.
        extra = "ignore"

    @model_validator(mode="after")
    def _require_clerk_in_production(self) -> "Settings":
        # Refuse to boot a production container without Clerk auth wired up.
        # If we silently fell back to the dev-only X-User-ID header, anyone could
        # impersonate any user by setting a header — see deps.get_current_user_id.
        if self.environment == "production" and not self.clerk_jwks_url:
            raise RuntimeError(
                "CLERK_JWKS_URL must be set when ENVIRONMENT=production. "
                "Configure it in the Railway project settings before deploying."
            )
        return self


@lru_cache
def get_settings():
    return Settings()

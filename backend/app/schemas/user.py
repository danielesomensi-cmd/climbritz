"""Pydantic schemas for the User shadow row (A019).

We expose only the local-shadow fields here. Email / name / username live
in Clerk and should be fetched there directly when needed.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UserResponse(BaseModel):
    """Shadow-row payload — used by future /api/users/me endpoints."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    clerk_id: str
    created_at: datetime
    updated_at: datetime

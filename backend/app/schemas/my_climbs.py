"""A030: My Problems (saved AI-generated climbs) request/response schemas."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.climb import HoldPosition


class MyClimbCreate(BaseModel):
    """Save a generated problem. The server validates the frames encoding,
    prefills the grade from the seed climb, and proposes the name."""

    frames: str = Field(
        ...,
        min_length=1,
        description="Exact BoardLib encoding: p{placement_id}r{role_id}…",
    )
    angle: int = Field(..., ge=0, le=70, description="Wall angle")
    seed_climb_uuid: Optional[str] = Field(
        default=None, description="A026 seed climb (provenance)"
    )
    # A031 — client overrides. name: the generate page shows the AI name
    # before saving ("Save as is" persists what the user saw); the editor
    # sets both. Absent → server-side naming / seed grade as in v1.
    name: Optional[str] = Field(default=None, min_length=1, max_length=60)
    grade: Optional[str] = Field(default=None, max_length=20)


class MyClimbPatch(BaseModel):
    """Inline edits from the My Problems detail page; A031 adds frames
    (hold editor) — fully validated server-side, logs stay attached."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    grade: Optional[str] = Field(default=None, max_length=20)
    frames: Optional[str] = Field(default=None, min_length=1)


class ProposeNameRequest(BaseModel):
    """A031 — name-on-generate. All hints optional."""

    angle: Optional[int] = Field(default=None, ge=0, le=70)
    grade: Optional[str] = Field(default=None, max_length=20)
    grip_hints: Optional[list[str]] = Field(
        default=None,
        description="Reserved (post-HC-7 grip types). Accepted, unused.",
    )


class ProposeNameResponse(BaseModel):
    name: str
    source: str = Field(..., description='"ai" | "fallback"')


class MyClimbResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    uuid: str
    name: str
    description: Optional[str] = None
    frames: str
    angle: int
    grade: Optional[str] = None
    difficulty: Optional[int] = None
    seed_climb_uuid: Optional[str] = None
    ascent_count: int = Field(
        0, description="Count of the user's flash/send logs on this problem"
    )
    created_at: datetime
    updated_at: datetime


class MyClimbDetail(MyClimbResponse):
    """Detail incl. parsed holds — same HoldPosition shape as the BoardLib
    detail endpoint so the frontend board/BLE path is identical."""

    holds: list[HoldPosition]

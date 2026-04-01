"""Pydantic schemas for climb search and detail endpoints."""

from pydantic import BaseModel, Field


class HoldPosition(BaseModel):
    """A single hold on a Kilter Board problem."""

    placement_id: int
    role: str = Field(..., description="start, middle, finish, or foot_only")
    x: int | None = Field(default=None, description="X coordinate on the board")
    y: int | None = Field(default=None, description="Y coordinate on the board")


class ClimbStats(BaseModel):
    """Per-angle stats for a climb."""

    angle: int
    grade: str = Field(..., description="Grade string e.g. '6a/V3'")
    difficulty: float = Field(..., description="Numeric difficulty value")
    ascensionist_count: int
    quality_average: float


class ClimbSearchResult(BaseModel):
    """A single result from the climb search endpoint."""

    uuid: str
    name: str
    setter: str
    grade: str = Field(..., description="Grade at the queried angle")
    angle: int
    ascensionist_count: int
    quality_average: float


class ClimbDetail(BaseModel):
    """Full detail for a single climb."""

    uuid: str
    name: str
    setter: str
    description: str
    holds: list[HoldPosition]
    stats: list[ClimbStats]


class DbStatsResponse(BaseModel):
    """Quick stats about the BoardLib database."""

    total_climbs: int
    listed_climbs: int
    available_angles: list[int]
    grade_range: dict

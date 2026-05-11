"""Pydantic schemas for climb search and detail endpoints."""

from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.logs import UserClimbState

# Move-count bucket for the Discovery filter (A019).
# Mapped in climb_service to a SQL WHERE clause on the cyan-hold count.
MovesFilter = Literal["any", "le5", "6-7", "8-10", "gt10"]

# A021 — Discovery chip filters for "done" (any flash/send log) and
# "project" (is_project flag set). Tri-state: all (default), only, exclude.
DoneFilter = Literal["all", "only", "exclude"]
ProjectFilter = Literal["all", "only", "exclude"]


class HoldPosition(BaseModel):
    """A single hold on a Kilter Board problem."""

    placement_id: int
    role: str = Field(..., description="start, middle, finish, or foot_only")
    x: int | None = Field(default=None, description="X coordinate on the board")
    y: int | None = Field(default=None, description="Y coordinate on the board")
    set_id: int | None = Field(
        default=None,
        description="Hold set: 1=Bolt Ons (handholds), 20=Screw Ons (small footholds)",
    )


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
    # A021 — populated only when the caller is authenticated AND has a
    # user_climbs row for this (uuid, angle). Discovery uses it to render
    # the ⚡/✓/☆ icon strip on each card.
    user_state: Optional[UserClimbState] = None


class ClimbSearchResponse(BaseModel):
    """Envelope around search results so the client can render an overflow
    banner ("showing 500 of 1247 results") without a second request. B020."""

    climbs: list[ClimbSearchResult]
    total_count: int = Field(
        ...,
        description=(
            "Total climbs matching the filters, ignoring the limit cap. "
            "When > len(climbs), the client surfaces an overflow banner."
        ),
    )


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

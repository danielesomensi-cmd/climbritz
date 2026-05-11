"""Pydantic v2 schemas for A021 climb logging + training history."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


ResultType = Literal["flash", "send", "attempt"]
# Attempts never set best_result — only flash/send do.
BestResult = Literal["flash", "send"]


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------


class LogCreate(BaseModel):
    """POST /api/logs body. ``local_date`` is computed server-side from
    request_received_at + X-User-Timezone header (UTC fallback)."""

    climb_uuid: str = Field(..., min_length=1, max_length=64)
    angle: int = Field(..., ge=0, le=90)
    result_type: ResultType


class LogPatch(BaseModel):
    """PATCH /api/logs/{id} body. At least one field must be set; the
    endpoint enforces that — Pydantic can't express the constraint here."""

    result_type: Optional[ResultType] = None
    attempts_count: Optional[int] = Field(default=None, ge=1)


class ProjectToggle(BaseModel):
    """PATCH /api/user-climbs/{climb_uuid}/project body."""

    angle: int = Field(..., ge=0, le=90)
    is_project: bool


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class LogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    climb_uuid: str
    angle: int
    local_date: date
    result_type: ResultType
    attempts_count: int
    created_at: datetime
    updated_at: datetime


class UserClimbState(BaseModel):
    """Lightweight state row used by Discovery search overlay + Storico section."""

    model_config = ConfigDict(from_attributes=True)

    climb_uuid: str
    angle: int
    is_project: bool
    best_result: Optional[BestResult] = None
    last_logged_at: Optional[datetime] = None


class UserClimbDetail(BaseModel):
    """GET /api/user-climbs/{uuid}?angle= → current state + recent logs."""

    state: Optional[UserClimbState] = None
    recent_logs: list[LogResponse]


class LogCreateResponse(BaseModel):
    """POST /api/logs response: the persisted log + the updated state row,
    so the client doesn't need a second request to refresh the UI."""

    log: LogResponse
    user_state: UserClimbState


class SessionClimb(BaseModel):
    climb_uuid: str
    angle: int
    result_type: ResultType
    attempts_count: int
    log_id: str


class SessionResponse(BaseModel):
    date: date
    total_climbs: int
    sends: int
    flashes: int
    attempts: int
    climbs: list[SessionClimb]


class PyramidEntry(BaseModel):
    grade_band: str
    count: int


class TrendEntry(BaseModel):
    week_start: date
    flash_count: int
    send_count: int
    attempt_count: int

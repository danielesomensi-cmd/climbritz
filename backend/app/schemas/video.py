"""
Pydantic v2 schemas for video upload and analysis responses.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, ConfigDict


# ---------------------------------------------------------------------------
# Nested analysis schemas
# ---------------------------------------------------------------------------

class ImprovementItem(BaseModel):
    """A specific improvement with actionable fix and drill."""

    issue: str = Field(..., description="Specific observation of what needs work.")
    fix: str = Field(..., description="Actionable suggestion to address the issue.")
    drill: str = Field(..., description="Kilter Board-specific drill tied to this issue.")


class FormFeedbackResponse(BaseModel):
    """
    Structured coaching feedback returned after Gemini analysis.
    Maps to the Kilter Board-specific prompt output (B007+).

    Backward compatible: old records with the previous schema (overall_grade_estimate,
    weaknesses, specific_feedback, drills_recommended, next_steps) are handled via
    extra="allow".
    """

    model_config = ConfigDict(extra="allow")  # backward compat with old records

    # Board detection
    is_kilter_board: bool = Field(default=True, description="Whether the video shows a Kilter Board.")
    error: Optional[str] = Field(default=None, description="Error code if not a Kilter Board video.")
    message: Optional[str] = Field(default=None, description="Error message for non-Kilter Board videos.")

    # Scores (1-10)
    technique_score: Optional[int] = Field(default=None, ge=1, le=10, description="Overall technique quality.")
    body_tension_score: Optional[int] = Field(default=None, ge=1, le=10, description="Core and full-body tension.")
    footwork_score: Optional[int] = Field(default=None, ge=1, le=10, description="Foot placement and trust.")
    hip_positioning_score: Optional[int] = Field(default=None, ge=1, le=10, description="Hip positioning quality.")
    power_management_score: Optional[int] = Field(default=None, ge=1, le=10, description="Power generation and management.")

    # Feedback
    summary: Optional[str] = Field(default=None, description="2 sentences max — key observation + suggestion.")
    strengths: list[str] = Field(default_factory=list, description="Max 3 strengths.")
    improvements: Optional[list[ImprovementItem]] = Field(default=None, description="Max 3 improvements with drill per issue.")
    overall_impression: Optional[str] = Field(default=None, description="flash/onsight/projecting/working.")


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class VideoResponse(BaseModel):
    """Response schema for video endpoints."""

    model_config = ConfigDict(from_attributes=True)

    id: str = Field(..., description="Unique video ID (UUID).")
    user_id: str = Field(..., description="ID of the user who uploaded.")
    filename: str | None = Field(default=None, description="Original filename.")
    file_size: int | None = Field(default=None, description="File size in bytes.")
    processing_status: str = Field(
        default="pending",
        description="Current processing status: pending, processing, completed, failed.",
    )
    form_analysis: FormFeedbackResponse | None = Field(
        default=None, description="Coaching feedback (populated when analysis completes)."
    )
    created_at: datetime = Field(..., description="Upload timestamp.")
    completed_at: datetime | None = Field(
        default=None, description="Analysis completion timestamp."
    )
    title: str | None = Field(default=None, description="Human-readable title.")
    grade_attempted: str | None = Field(
        default=None, description="Climber's estimated grade."
    )

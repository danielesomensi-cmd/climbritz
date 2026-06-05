"""A026 — Problem Generator (Remix v1) request/response schemas."""

from pydantic import BaseModel, Field, model_validator

from app.schemas.climb import MovesFilter


class GenerateRequest(BaseModel):
    """Filters for problem generation. The same sensible Discovery set minus
    stars and benchmark. ``grip_types`` is accepted but ignored in v1 —
    reserved for the post-HC-7 grip-type filter."""

    angle: int = Field(..., description="Wall angle (e.g. 40)")
    grade_min: int = Field(..., ge=10, le=40, description="Min numeric difficulty")
    grade_max: int = Field(..., ge=10, le=40, description="Max numeric difficulty")
    moves: MovesFilter = Field(
        default="any", description="Move-count bucket: any | le5 | 6-7 | 8-10 | gt10"
    )
    grip_types: list[str] | None = Field(
        default=None,
        description="Reserved (v2 / HC-7). Accepted but ignored in v1.",
    )

    @model_validator(mode="after")
    def _grade_order(self):
        if self.grade_min > self.grade_max:
            raise ValueError("grade_min must be <= grade_max")
        return self


class GeneratedHold(BaseModel):
    """A single hold in the generated problem."""

    placement_id: int
    role: str = Field(..., description="start, middle, finish, or foot_only")


class GenerateMeta(BaseModel):
    """Generation metadata. ``seed_uuid`` is for debug/telemetry only —
    never surfaced as 'based on X' in the UI."""

    seed_uuid: str
    swapped_count: int
    filters: dict


class GenerateResponse(BaseModel):
    holds: list[GeneratedHold]
    meta: GenerateMeta

"""A023: Pydantic v2 schemas for per-user hold classification."""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class ClassificationCategory(str, Enum):
    JUG = "jug"
    GOOD_CRIMP = "good_crimp"
    CRIMP = "crimp"
    SLOPER = "sloper"
    UNDERCLING = "undercling"
    PINCH = "pinch"


class ClassificationIn(BaseModel):
    # The export shape carries x/y too; we ignore those extra fields so the
    # raw export file can be POSTed to /import without reshaping.
    model_config = ConfigDict(extra="ignore")

    placement_id: int
    category: ClassificationCategory


class ClassificationUpsert(BaseModel):
    """PUT /api/classifications/{placement_id} body — placement_id is in
    the path, so the body only carries the category."""

    category: ClassificationCategory


class ClassificationOut(ClassificationIn):
    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: str
    created_at: datetime
    updated_at: datetime


class ClassificationBulkImport(BaseModel):
    model_config = ConfigDict(extra="ignore")

    # Board has 514 holds; 1000 is a generous safety cap.
    classifications: list[ClassificationIn] = Field(..., max_length=1000)


class ClassificationBulkImportResult(BaseModel):
    total: int  # rows in DB for this user after the merge

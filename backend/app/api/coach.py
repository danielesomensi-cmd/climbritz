"""A025: AI progress-comment API (FREE tier, History).

POST /api/coach/summary?from=&to=  → { "summary": str }

On-tap only — the frontend calls this when the user taps "Generate comment".
Text-only Gemini surface; see app.services.coach_summary_service.
"""

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user_id
from app.services import coach_summary_service

router = APIRouter()


class CoachSummaryResponse(BaseModel):
    summary: str


@router.post("/summary", response_model=CoachSummaryResponse)
def coach_summary(
    date_from: Optional[date] = Query(default=None, alias="from"),
    date_to: Optional[date] = Query(default=None, alias="to"),
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    try:
        summary = coach_summary_service.build_summary(
            db,
            user_id=current_user_id,
            date_from=date_from,
            date_to=date_to,
        )
    except Exception as exc:  # Gemini call failed — retryable on the client.
        raise HTTPException(
            status_code=502,
            detail="Could not generate your progress comment. Please try again.",
        ) from exc
    return CoachSummaryResponse(summary=summary)

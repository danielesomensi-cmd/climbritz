"""A021: training-history stats API.

Endpoints:
  GET /api/stats/pyramid   grade pyramid (counts by grade band)
  GET /api/stats/trend     send-rate by ISO week
"""

from datetime import date
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user_id
from app.schemas.logs import PyramidEntry, TrendEntry
from app.services import climb_service, log_service

router = APIRouter()

ResultFilter = Literal["flash", "send_or_better", "all"]


def _grade_resolver_factory():
    """Build a per-request resolver (climb_uuid, angle) -> grade band.

    Memoised so a user with multiple sends on the same climb hits BoardLib
    once. Lifetime is bounded to a single pyramid request.
    """
    cache: dict[tuple[str, int], Optional[str]] = {}

    def resolve(climb_uuid: str, angle: int) -> Optional[str]:
        key = (climb_uuid, angle)
        if key in cache:
            return cache[key]
        climb = climb_service.get_climb(climb_uuid=climb_uuid, angle=angle)
        grade: Optional[str] = None
        if climb and climb.get("stats"):
            grade = climb["stats"][0].get("grade")
        cache[key] = grade
        return grade

    return resolve


@router.get("/pyramid", response_model=list[PyramidEntry])
def pyramid(
    date_from: Optional[date] = Query(default=None, alias="from"),
    date_to: Optional[date] = Query(default=None, alias="to"),
    result_filter: ResultFilter = Query(default="send_or_better"),
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    rows = log_service.compute_pyramid(
        db,
        user_id=current_user_id,
        date_from=date_from,
        date_to=date_to,
        result_filter=result_filter,
        grade_resolver=_grade_resolver_factory(),
    )
    return [PyramidEntry(**r) for r in rows]


@router.get("/trend", response_model=list[TrendEntry])
def trend(
    date_from: Optional[date] = Query(default=None, alias="from"),
    date_to: Optional[date] = Query(default=None, alias="to"),
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    rows = log_service.compute_trend(
        db,
        user_id=current_user_id,
        date_from=date_from,
        date_to=date_to,
    )
    return [TrendEntry(**r) for r in rows]

"""A021: climb logs API.

Endpoints:
  POST   /api/logs              create or upgrade today's log
  GET    /api/logs              list logs (filters: climb_uuid, from, to)
  GET    /api/logs/sessions     daily session summaries
  PATCH  /api/logs/{id}         update a single log
  DELETE /api/logs/{id}         remove a log (triggers user_climbs recompute)

All endpoints require Clerk JWT (X-User-ID in dev/test fallback). The
POST endpoint additionally reads ``X-User-Timezone`` (IANA name, e.g.
``Europe/Rome``) to resolve the user's local_date — UTC fallback when
the header is absent.
"""

from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user_id
from app.models.climb_log import ClimbLog
from app.schemas.logs import (
    LogCreate,
    LogCreateResponse,
    LogPatch,
    LogResponse,
    SessionResponse,
    UserClimbState,
)
from app.services import climb_service, log_service, my_climbs_service

router = APIRouter()


@router.post("", response_model=LogCreateResponse, status_code=201)
def create_log(
    body: LogCreate,
    x_user_timezone: Optional[str] = Header(
        default=None, alias="X-User-Timezone"
    ),
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Create or upgrade today's log on a climb. Reject animated sequences
    (frames_count > 1) with 422 — those are circuits, not boulders, and
    they're excluded from Discovery globally.

    A030: the user's own generated problems (user_generated_climbs) are
    loggable too — checked first, owner-scoped, static by construction.
    BoardLib guard unchanged for everything else.
    """
    meta = my_climbs_service.get_meta_for_user(
        db, user_id=current_user_id, uuid=body.climb_uuid
    )
    if meta is None:
        meta = climb_service.get_climb_meta(body.climb_uuid)
    if meta is None:
        raise HTTPException(status_code=404, detail="Climb not found")
    if meta["frames_count"] != 1:
        raise HTTPException(
            status_code=422,
            detail=(
                "Cannot log an animated sequence — logging is for "
                "single-problem climbs only."
            ),
        )

    local_date_value = log_service.resolve_local_date(
        datetime.now(timezone.utc), x_user_timezone
    )

    log, state = log_service.create_or_upgrade_log(
        db,
        user_id=current_user_id,
        climb_uuid=body.climb_uuid,
        angle=body.angle,
        result_type=body.result_type,
        local_date_value=local_date_value,
    )
    return LogCreateResponse(
        log=LogResponse.model_validate(log),
        user_state=UserClimbState.model_validate(state),
    )


@router.get("", response_model=list[LogResponse])
def list_logs(
    climb_uuid: Optional[str] = Query(default=None),
    date_from: Optional[date] = Query(default=None, alias="from"),
    date_to: Optional[date] = Query(default=None, alias="to"),
    limit: int = Query(default=100, ge=1, le=500),
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    q = db.query(ClimbLog).filter(ClimbLog.user_id == current_user_id)
    if climb_uuid:
        q = q.filter(ClimbLog.climb_uuid == climb_uuid)
    if date_from is not None:
        q = q.filter(ClimbLog.local_date >= date_from)
    if date_to is not None:
        q = q.filter(ClimbLog.local_date <= date_to)
    rows = (
        q.order_by(desc(ClimbLog.local_date), desc(ClimbLog.created_at))
        .limit(limit)
        .all()
    )
    return [LogResponse.model_validate(r) for r in rows]


def _session_climb_meta_resolver_factory(db: Session, user_id: str):
    """A021.5 — memoised (climb_uuid, angle) → {name, grade} lookup so a
    session with many logs on the same climb hits BoardLib once. Same
    pattern as the pyramid grade_resolver.

    A030: BoardLib misses fall through to the user's generated problems,
    so History sessions show the AI problem's name/grade instead of null.
    """
    cache: dict[tuple[str, int], Optional[dict]] = {}

    def resolve(climb_uuid: str, angle: int) -> Optional[dict]:
        key = (climb_uuid, angle)
        if key in cache:
            return cache[key]
        climb = climb_service.get_climb(climb_uuid=climb_uuid, angle=angle)
        result: Optional[dict] = None
        if climb:
            grade: Optional[str] = None
            if climb.get("stats"):
                grade = climb["stats"][0].get("grade")
            result = {"name": climb.get("name"), "grade": grade}
        else:
            result = my_climbs_service.get_name_grade_for_user(
                db, user_id=user_id, uuid=climb_uuid
            )
        cache[key] = result
        return result

    return resolve


@router.get("/sessions", response_model=list[SessionResponse])
def list_sessions(
    date_from: Optional[date] = Query(default=None, alias="from"),
    date_to: Optional[date] = Query(default=None, alias="to"),
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    sessions = log_service.list_sessions(
        db,
        user_id=current_user_id,
        date_from=date_from,
        date_to=date_to,
        climb_meta_resolver=_session_climb_meta_resolver_factory(
            db, current_user_id
        ),
    )
    return [SessionResponse(**s) for s in sessions]


@router.patch("/{log_id}", response_model=LogCreateResponse)
def patch_log(
    log_id: str,
    body: LogPatch,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    if body.result_type is None and body.attempts_count is None:
        raise HTTPException(
            status_code=422,
            detail="Provide at least one of: result_type, attempts_count",
        )
    res = log_service.patch_log(
        db,
        user_id=current_user_id,
        log_id=log_id,
        result_type=body.result_type,
        attempts_count=body.attempts_count,
    )
    if res is None:
        raise HTTPException(status_code=404, detail="Log not found")
    log, state = res
    return LogCreateResponse(
        log=LogResponse.model_validate(log),
        user_state=UserClimbState.model_validate(state),
    )


@router.delete("/{log_id}", status_code=204)
def delete_log(
    log_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    res = log_service.delete_log(
        db, user_id=current_user_id, log_id=log_id
    )
    if res is None:
        raise HTTPException(status_code=404, detail="Log not found")
    return None

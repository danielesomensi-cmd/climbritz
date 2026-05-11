"""A021: user_climbs API.

Endpoints:
  GET   /api/user-climbs/{climb_uuid}?angle=     state + recent logs
  PATCH /api/user-climbs/{climb_uuid}/project    toggle project flag

Both require Clerk JWT.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user_id
from app.schemas.logs import (
    LogResponse,
    ProjectToggle,
    UserClimbDetail,
    UserClimbState,
)
from app.services import log_service

router = APIRouter()


@router.get("/{climb_uuid}", response_model=UserClimbDetail)
def get_user_climb(
    climb_uuid: str,
    angle: int = Query(..., ge=0, le=90),
    recent_limit: int = Query(default=20, ge=1, le=100),
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    state = log_service.get_user_climb_state(
        db,
        user_id=current_user_id,
        climb_uuid=climb_uuid,
        angle=angle,
    )
    recent = log_service.get_recent_logs_for_climb(
        db,
        user_id=current_user_id,
        climb_uuid=climb_uuid,
        angle=angle,
        limit=recent_limit,
    )
    return UserClimbDetail(
        state=UserClimbState.model_validate(state) if state else None,
        recent_logs=[LogResponse.model_validate(r) for r in recent],
    )


@router.patch("/{climb_uuid}/project", response_model=UserClimbState)
def toggle_project(
    climb_uuid: str,
    body: ProjectToggle,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    state = log_service.set_project(
        db,
        user_id=current_user_id,
        climb_uuid=climb_uuid,
        angle=body.angle,
        is_project=body.is_project,
    )
    return UserClimbState.model_validate(state)

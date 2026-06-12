"""A030: My Problems API — saved AI-generated climbs.

Endpoints (all Clerk-gated):
  POST   /api/my-climbs          save a generated problem (one tap, 201)
  GET    /api/my-climbs          list for the current user (newest first)
  GET    /api/my-climbs/{uuid}   detail incl. parsed holds
  PATCH  /api/my-climbs/{uuid}   edit name / grade
  DELETE /api/my-climbs/{uuid}   delete

Thin layer over services.my_climbs_service. Saving NEVER fails or blocks
on AI naming (local fallback inside problem_name_service).
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user_id
from app.schemas.my_climbs import (
    MyClimbCreate,
    MyClimbDetail,
    MyClimbPatch,
    MyClimbResponse,
    ProposeNameRequest,
    ProposeNameResponse,
)
from app.services import my_climbs_service, problem_name_service
from app.services.my_climbs_service import InvalidFramesError

router = APIRouter()


@router.post("/propose-name", response_model=ProposeNameResponse)
def propose_name(
    body: ProposeNameRequest,
    current_user_id: str = Depends(get_current_user_id),
):
    """A031 — name-on-generate. Thin wrapper over problem_name_service
    (2s Gemini budget, local adjective+noun fallback — never fails)."""
    name, source = problem_name_service.propose_problem_name_detailed(
        grade=body.grade, angle=body.angle
    )
    return ProposeNameResponse(name=name, source=source)


@router.post("", response_model=MyClimbResponse, status_code=201)
def create_my_climb(
    body: MyClimbCreate,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    try:
        row = my_climbs_service.create_my_climb(
            db,
            user_id=current_user_id,
            frames=body.frames,
            angle=body.angle,
            seed_climb_uuid=body.seed_climb_uuid,
            name=body.name,
            grade=body.grade,
        )
    except InvalidFramesError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return MyClimbResponse.model_validate(row)


@router.get("", response_model=list[MyClimbResponse])
def list_my_climbs(
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    return [
        MyClimbResponse(**item)
        for item in my_climbs_service.list_my_climbs(db, user_id=current_user_id)
    ]


@router.get("/{uuid}", response_model=MyClimbDetail)
def get_my_climb(
    uuid: str,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    detail = my_climbs_service.get_my_climb_detail(
        db, user_id=current_user_id, uuid=uuid
    )
    if detail is None:
        raise HTTPException(status_code=404, detail="Problem not found")
    return MyClimbDetail(**detail)


@router.patch("/{uuid}", response_model=MyClimbResponse)
def patch_my_climb(
    uuid: str,
    body: MyClimbPatch,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    if body.name is None and body.grade is None and body.frames is None:
        raise HTTPException(
            status_code=422,
            detail="Provide at least one of: name, grade, frames",
        )
    try:
        row = my_climbs_service.patch_my_climb(
            db,
            user_id=current_user_id,
            uuid=uuid,
            name=body.name,
            grade=body.grade,
            frames=body.frames,
        )
    except InvalidFramesError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if row is None:
        raise HTTPException(status_code=404, detail="Problem not found")
    # Re-read through the detail path so ascent_count is real, not the
    # schema default (the ORM row doesn't carry it).
    detail = my_climbs_service.get_my_climb_detail(
        db, user_id=current_user_id, uuid=uuid
    )
    return MyClimbResponse(**detail)


@router.delete("/{uuid}", status_code=204)
def delete_my_climb(
    uuid: str,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    if not my_climbs_service.delete_my_climb(
        db, user_id=current_user_id, uuid=uuid
    ):
        raise HTTPException(status_code=404, detail="Problem not found")
    return None

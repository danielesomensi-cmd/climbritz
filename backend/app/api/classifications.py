"""A023: per-user hold classification API.

Endpoints (all require Clerk JWT via get_current_user_id):
  GET    /api/classifications              list current user's classifications
  PUT    /api/classifications/{placement}  upsert one
  DELETE /api/classifications/{placement}  remove one (idempotent)
  POST   /api/classifications/import       bulk merge upsert
"""

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user_id
from app.schemas.classifications import (
    ClassificationBulkImport,
    ClassificationBulkImportResult,
    ClassificationOut,
    ClassificationUpsert,
)
from app.services import classification_service

router = APIRouter()


@router.get("", response_model=list[ClassificationOut])
def list_classifications(
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    return classification_service.list_classifications(db, current_user_id)


@router.put("/{placement_id}", response_model=ClassificationOut)
def upsert_classification(
    placement_id: int,
    body: ClassificationUpsert,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    return classification_service.upsert_classification(
        db,
        user_id=current_user_id,
        placement_id=placement_id,
        category=body.category.value,
    )


@router.delete("/{placement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_classification(
    placement_id: int,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    classification_service.delete_classification(
        db, user_id=current_user_id, placement_id=placement_id
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/import", response_model=ClassificationBulkImportResult)
def import_classifications(
    body: ClassificationBulkImport,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    total = classification_service.bulk_import(
        db, user_id=current_user_id, classifications=body.classifications
    )
    return ClassificationBulkImportResult(total=total)

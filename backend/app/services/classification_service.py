"""A023: per-user hold classification domain service.

Plain CRUD over user_hold_classifications. Upserts key on
(user_id, placement_id); bulk import merges (rows not in the payload are
preserved, never deleted).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.user_hold_classification import UserHoldClassification


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def list_classifications(
    db: Session, user_id: str
) -> list[UserHoldClassification]:
    return (
        db.query(UserHoldClassification)
        .filter(UserHoldClassification.user_id == user_id)
        .order_by(UserHoldClassification.placement_id)
        .all()
    )


def upsert_classification(
    db: Session, user_id: str, placement_id: int, category: str
) -> UserHoldClassification:
    row = (
        db.query(UserHoldClassification)
        .filter(
            UserHoldClassification.user_id == user_id,
            UserHoldClassification.placement_id == placement_id,
        )
        .one_or_none()
    )
    if row is None:
        row = UserHoldClassification(
            id=str(uuid.uuid4()),
            user_id=user_id,
            placement_id=placement_id,
            category=category,
        )
        db.add(row)
    else:
        row.category = category
        row.updated_at = _utcnow()
    db.commit()
    db.refresh(row)
    return row


def delete_classification(
    db: Session, user_id: str, placement_id: int
) -> None:
    """Idempotent: no error if the row does not exist."""
    db.query(UserHoldClassification).filter(
        UserHoldClassification.user_id == user_id,
        UserHoldClassification.placement_id == placement_id,
    ).delete(synchronize_session=False)
    db.commit()


def bulk_import(
    db: Session, user_id: str, classifications: list
) -> int:
    """Merge upsert in a single transaction. Rows for placement_ids not in
    the payload are preserved. Returns the user's total row count after."""
    existing = {
        row.placement_id: row
        for row in db.query(UserHoldClassification)
        .filter(UserHoldClassification.user_id == user_id)
        .all()
    }
    now = _utcnow()
    for item in classifications:
        category = (
            item.category.value
            if hasattr(item.category, "value")
            else item.category
        )
        row = existing.get(item.placement_id)
        if row is None:
            row = UserHoldClassification(
                id=str(uuid.uuid4()),
                user_id=user_id,
                placement_id=item.placement_id,
                category=category,
            )
            db.add(row)
            existing[item.placement_id] = row
        else:
            row.category = category
            row.updated_at = now
    db.commit()

    return (
        db.query(UserHoldClassification)
        .filter(UserHoldClassification.user_id == user_id)
        .count()
    )

"""A023: per-user hold classification.

Cloud-synced replacement for the old localStorage-only /classify flow.
One row per (user, placement_id): the user's grip-type verdict for a hold
on the Kilter Board. Coordinates are NOT stored — the frontend joins x/y
from placements_12x12.json at export time, same as before A023.

Per-user only. Aggregation across users into a canonical map is a future
brief (HC-7); this table is the crowdsource collection layer that feeds it.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
)

from app.core.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UserHoldClassification(Base):
    __tablename__ = "user_hold_classifications"

    id = Column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    placement_id = Column(Integer, nullable=False)
    category = Column(String(20), nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=_utcnow,
        server_default=func.now(),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=_utcnow,
        onupdate=_utcnow,
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "placement_id",
            name="uq_user_hold_classifications_user_placement",
        ),
        Index("ix_user_hold_classifications_user", "user_id"),
    )

    def __repr__(self) -> str:
        return (
            f"<UserHoldClassification id={self.id} user={self.user_id} "
            f"placement={self.placement_id} category={self.category}>"
        )

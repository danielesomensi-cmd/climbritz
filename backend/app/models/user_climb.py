"""A021: per-(user, climb, angle) materialized state cache.

Derived from climb_logs and kept in sync by log_service. Exists so that
the Discovery search overlay (500 climbs/request) can attach user_state
with a single keyed SELECT instead of aggregating logs per row.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
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


class UserClimb(Base):
    __tablename__ = "user_climbs"

    id = Column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    climb_uuid = Column(String(36), nullable=False)
    angle = Column(Integer, nullable=False)
    # Project flag is independent of any log history — a climb can be a
    # project with zero logs, or have logs and no project flag.
    is_project = Column(
        Boolean, nullable=False, default=False, server_default="0"
    )
    # Strongest non-attempt result ever recorded ('flash' > 'send' > NULL).
    # Attempts never set this field — the user has "tried" but not "done".
    best_result = Column(String(8), nullable=True)
    last_logged_at = Column(DateTime(timezone=True), nullable=True)
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
        CheckConstraint(
            "best_result IS NULL OR best_result IN ('flash', 'send')",
            name="ck_user_climbs_best_result",
        ),
        UniqueConstraint(
            "user_id",
            "climb_uuid",
            "angle",
            name="uq_user_climbs_user_climb_angle",
        ),
        Index("ix_user_climbs_user", "user_id"),
        Index("ix_user_climbs_user_project", "user_id", "is_project"),
    )

    def __repr__(self) -> str:
        return (
            f"<UserClimb id={self.id} user={self.user_id} "
            f"climb={self.climb_uuid} angle={self.angle} "
            f"project={self.is_project} best={self.best_result}>"
        )

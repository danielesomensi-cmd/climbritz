"""A021: append-mostly log of every climbing attempt/send/flash.

One row per (user, climb, angle, local_date). Repeat taps on the same day
increment ``attempts_count`` instead of inserting new rows. Result type
can be upgraded within the day (attempt → send → flash) but never
downgraded — see log_service.create_or_upgrade_log.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
    text,
)

from app.core.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ClimbLog(Base):
    __tablename__ = "climb_logs"

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
    local_date = Column(Date, nullable=False)
    # 'flash' | 'send' | 'attempt'. Enforced by CHECK constraint in the DB
    # and by the Pydantic schema at the API boundary.
    result_type = Column(String(8), nullable=False)
    attempts_count = Column(
        Integer, nullable=False, default=1, server_default="1"
    )
    # Python-side defaults populate the value before flush so the recompute
    # step in log_service can read created_at without needing db.refresh.
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
            "result_type IN ('flash', 'send', 'attempt')",
            name="ck_climb_logs_result_type",
        ),
        UniqueConstraint(
            "user_id",
            "climb_uuid",
            "angle",
            "local_date",
            name="uq_climb_logs_user_climb_angle_date",
        ),
        Index(
            "ix_climb_logs_user_date",
            "user_id",
            text("local_date DESC"),
        ),
        Index("ix_climb_logs_user_climb", "user_id", "climb_uuid"),
    )

    def __repr__(self) -> str:
        return (
            f"<ClimbLog id={self.id} user={self.user_id} "
            f"climb={self.climb_uuid} angle={self.angle} "
            f"date={self.local_date} result={self.result_type}>"
        )

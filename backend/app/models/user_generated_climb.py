"""A030: user-generated (AI-remixed) climbs saved from /generate.

Stored in a BoardLib-compatible format on purpose: ``frames`` uses the
exact ``p{placement_id}r{role_id}`` encoding, grades are kept both as the
numeric ``difficulty`` (BoardLib semantics) and the user-facing ``grade``
label, and ``is_listed``/``is_nomatch`` mirror the BoardLib ``climbs``
columns — so future community publishing (phase 3) is a flag flip, not a
data migration (contract: docs/audits/D019_MATCHING_SCHEMA_AUDIT.md §5).

Lives in the app DB (DATABASE_URL), not the BoardLib DB.
"""

import uuid as uuid_lib
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)

from app.core.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UserGeneratedClimb(Base):
    __tablename__ = "user_generated_climbs"

    # Same shape as BoardLib climb uuids (string PK) so climb_logs /
    # user_climbs reference it transparently — those columns are plain
    # uuid strings with no FK to BoardLib (verified in Phase 0).
    uuid = Column(
        String(36), primary_key=True, default=lambda: str(uuid_lib.uuid4())
    )
    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    name = Column(String(120), nullable=False)
    description = Column(Text, nullable=True)
    # Exact BoardLib encoding: p{placement_id}r{role_id} concatenated.
    frames = Column(Text, nullable=False)
    frames_count = Column(Integer, nullable=False, default=1)
    angle = Column(Integer, nullable=False)
    # User-facing label ("6c/V5"), prefilled from the seed climb; editable.
    grade = Column(String(20), nullable=True)
    # BoardLib numeric difficulty (rounded display_difficulty of the seed).
    # Drives grade-range filtering in the Discovery merge.
    difficulty = Column(Integer, nullable=True)
    # Provenance: the A026 seed climb. Debug/telemetry only, never surfaced.
    seed_climb_uuid = Column(String(36), nullable=True)
    # BoardLib parity flags — never exposed in v1.
    is_listed = Column(Boolean, nullable=False, default=False)
    is_nomatch = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    __table_args__ = (
        Index("ix_user_generated_climbs_user", "user_id"),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<UserGeneratedClimb uuid={self.uuid} user={self.user_id} "
            f"name={self.name!r} angle={self.angle}>"
        )

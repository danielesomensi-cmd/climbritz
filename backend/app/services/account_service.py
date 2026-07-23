"""A-STORE-PROD-001: full account + data erasure (App Store Guideline 5.1.1(v)).

Backs ``DELETE /api/users/me``. Deletes every user-owned row and every
user-owned artifact that lives outside the DB.

**Why explicit deletes and not ON DELETE CASCADE.**
Migrations 004/005/006 declare ``ondelete="CASCADE"`` on the user FKs, but
``core/database.py`` builds the SQLite engine without a
``PRAGMA foreign_keys=ON`` listener — SQLite disables FK enforcement by
default, so those cascades never fire (Phase 0 finding, tracked as
**B-FK-ENFORCE** in ROADMAP_ACTIVE.md). ``video_uploads`` (migration 001)
has no ``ondelete`` at all. Deleting child rows explicitly, child-first, is
therefore both correct today and portable to the planned PostgreSQL move,
where enforcement will be on. Do not "simplify" this to a single
``DELETE FROM users`` until B-FK-ENFORCE lands.

Order matters: children before ``users``, so an abort part-way through
leaves the account usable rather than half-orphaned.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.climb_log import ClimbLog
from app.models.user import User
from app.models.user_climb import UserClimb
from app.models.user_generated_climb import UserGeneratedClimb
from app.models.user_hold_classification import UserHoldClassification
from app.models.video import VideoUpload

logger = logging.getLogger(__name__)


def purge_video_files(video: VideoUpload) -> int:
    """Best-effort unlink of a video's on-disk artifacts.

    Returns the number of files actually removed. Never raises: a missing
    or unreadable file must not block the erasure of the DB rows, and the
    caller has no way to recover from a filesystem error anyway.

    Both ``original_file_path`` and ``file_path`` are checked — they are
    usually the same path, so identical values are de-duplicated.
    """
    removed = 0
    seen: set[str] = set()
    for raw in (video.original_file_path, video.file_path):
        if not raw or raw in seen:
            continue
        seen.add(raw)
        try:
            path = Path(raw)
            if path.is_file():
                os.unlink(path)
                removed += 1
                logger.info("Purged video file: %s", path)
        except OSError as exc:  # pragma: no cover - filesystem edge case
            logger.warning("Could not purge video file %s: %s", raw, exc)
    return removed


def delete_user_account(db: Session, user_id: str) -> dict[str, int]:
    """Erase every row and artifact owned by ``user_id``. Idempotent.

    A user_id with no data (already deleted, or never used the app) is not
    an error — every count simply comes back 0.

    Note on the Gemini File API: uploaded videos are NOT explicitly deleted
    from Google's Files API here. Google purges them automatically after a
    48-hour TTL, it is not a compliance requirement, and issuing the call
    would mean opening ``gemini_service.py`` — a STOP-gate module — for no
    real gain. Decision recorded in A-STORE-PROD-001 §B.

    Returns a per-table count of deleted rows for logging/telemetry.
    """
    counts: dict[str, int] = {}

    # --- Out-of-DB artifacts first -------------------------------------
    # Read the video rows before deleting them so we still hold the paths.
    videos = (
        db.query(VideoUpload).filter(VideoUpload.user_id == user_id).all()
    )
    files_removed = 0
    for video in videos:
        files_removed += purge_video_files(video)
    counts["video_files"] = files_removed

    # --- Child rows, deepest first -------------------------------------
    for key, model in (
        ("climb_logs", ClimbLog),
        ("user_climbs", UserClimb),
        ("user_hold_classifications", UserHoldClassification),
        ("user_generated_climbs", UserGeneratedClimb),
        ("video_uploads", VideoUpload),
    ):
        counts[key] = (
            db.query(model)
            .filter(model.user_id == user_id)
            .delete(synchronize_session=False)
        )

    # --- The shadow row last -------------------------------------------
    counts["users"] = (
        db.query(User)
        .filter(User.id == user_id)
        .delete(synchronize_session=False)
    )

    db.commit()

    logger.info("Account erasure complete for user %s: %s", user_id, counts)
    return counts

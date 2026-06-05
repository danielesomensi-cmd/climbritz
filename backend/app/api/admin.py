"""Admin endpoints — protected management operations."""

import logging
import os
import shutil
import subprocess
import sys
from pathlib import Path

from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.deps import get_current_user_id
from app.models.climb_log import ClimbLog
from app.models.user import User
from app.models.user_climb import UserClimb
from app.models.user_hold_classification import UserHoldClassification
from app.models.video import VideoUpload
from app.services import clerk_admin_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/sync-db")
async def sync_boardlib_db(current_user_id: str = Depends(get_current_user_id)):
    """Re-download / sync the BoardLib Kilter database.

    Runs `python -m boardlib database kilter <path>` as a subprocess. If the
    file already exists, boardlib will sync deltas instead of re-downloading
    the full ~189MB snapshot. Requires a valid Clerk session.
    """
    settings = get_settings()
    db_path = Path(settings.boardlib_db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    logger.info(
        "Admin sync-db triggered by user=%s path=%s", current_user_id, db_path
    )

    try:
        result = subprocess.run(
            [sys.executable, "-m", "boardlib", "database", "kilter", str(db_path)],
            capture_output=True,
            text=True,
            timeout=600,
            check=False,
        )
    except subprocess.TimeoutExpired:
        logger.error("boardlib sync timed out")
        raise HTTPException(status_code=504, detail="BoardLib sync timed out")

    if result.returncode != 0:
        logger.error(
            "boardlib sync failed rc=%s stderr=%s",
            result.returncode,
            result.stderr[-500:],
        )
        raise HTTPException(
            status_code=500,
            detail=f"BoardLib sync failed: {result.stderr[-200:] or 'unknown error'}",
        )

    size_bytes = db_path.stat().st_size if db_path.exists() else 0
    return {
        "status": "ok",
        "path": str(db_path),
        "size_bytes": size_bytes,
        "size_mb": round(size_bytes / (1024 * 1024), 1),
    }


# --- TEMPORARY: upload kilter.db to persistent volume ---
# Protected by ADMIN_SECRET header to avoid needing JWT for a one-off upload.
# Remove this endpoint after the DB is uploaded.

ADMIN_SECRET = os.environ.get("ADMIN_SECRET", "")


@router.post("/upload-db")
async def upload_boardlib_db(
    file: UploadFile = File(...),
    x_admin_secret: str = Header(..., alias="X-Admin-Secret"),
):
    """Upload a kilter.db file to the persistent volume.

    Protected by X-Admin-Secret header (must match ADMIN_SECRET env var).
    TEMPORARY — remove after first successful upload.
    """
    if not ADMIN_SECRET or x_admin_secret != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Invalid admin secret")

    settings = get_settings()
    db_path = Path(settings.boardlib_db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    # Write to a temp file first, then move atomically
    tmp_path = db_path.with_suffix(".db.tmp")
    try:
        with open(tmp_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        tmp_path.rename(db_path)
    except Exception as e:
        tmp_path.unlink(missing_ok=True)
        logger.error("upload-db failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

    size_bytes = db_path.stat().st_size
    logger.info("upload-db: wrote %s (%.1f MB)", db_path, size_bytes / 1024 / 1024)
    return {
        "status": "ok",
        "path": str(db_path),
        "size_bytes": size_bytes,
        "size_mb": round(size_bytes / (1024 * 1024), 1),
    }


def _local_activity(db: Session, clerk_id: str) -> dict:
    """In-app activity counts for a Clerk subject, joined via our shadow row.

    `has_local_row` is False when the user signed up in Clerk but never hit an
    authenticated backend route (so they have no users.id yet) — which itself
    answers "did they do anything?": no row → never used the app's features."""
    row = db.query(User).filter(User.clerk_id == clerk_id).first()
    if row is None:
        return {
            "has_local_row": False,
            "climb_logs": 0,
            "videos": 0,
            "classifications": 0,
            "projects": 0,
            "first_seen": None,
        }
    uid = row.id
    return {
        "has_local_row": True,
        "climb_logs": db.query(ClimbLog).filter(ClimbLog.user_id == uid).count(),
        "videos": db.query(VideoUpload).filter(VideoUpload.user_id == uid).count(),
        "classifications": db.query(UserHoldClassification)
        .filter(UserHoldClassification.user_id == uid)
        .count(),
        "projects": db.query(UserClimb)
        .filter(UserClimb.user_id == uid, UserClimb.is_project.is_(True))
        .count(),
        "first_seen": row.created_at.isoformat() if row.created_at else None,
    }


@router.get("/recent-users")
def recent_users(
    limit: int = Query(10, ge=1, le=50),
    include_devices: bool = Query(True),
    x_admin_secret: str = Header(..., alias="X-Admin-Secret"),
    db: Session = Depends(get_db),
):
    """Newest Clerk sign-ups + device (iOS/Android) + in-app activity counts.

    Server-side join of the Clerk Backend API (identity + device/location) with
    our DB (climb logs / videos / classifications / projects). Protected by the
    same X-Admin-Secret as /upload-db — no JWT needed, runnable from a one-line
    curl. Read-only.
    """
    if not ADMIN_SECRET or x_admin_secret != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Invalid admin secret")

    settings = get_settings()
    if not settings.clerk_secret_key:
        raise HTTPException(
            status_code=503, detail="CLERK_SECRET_KEY not configured"
        )

    try:
        users = clerk_admin_service.list_recent_users(
            settings.clerk_secret_key, limit=limit
        )
    except clerk_admin_service.ClerkApiError as exc:
        logger.error("recent-users: Clerk API error: %s", exc)
        raise HTTPException(status_code=502, detail=f"Clerk API error: {exc}")

    enriched = []
    for u in users:
        clerk_id = u.get("clerk_id")
        entry = {**u, "activity": _local_activity(db, clerk_id) if clerk_id else None}
        if include_devices and clerk_id:
            entry["devices"] = clerk_admin_service.get_user_devices(
                settings.clerk_secret_key, clerk_id
            )
        enriched.append(entry)

    return {"count": len(enriched), "users": enriched}

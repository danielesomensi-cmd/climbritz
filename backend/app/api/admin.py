"""Admin endpoints — protected management operations."""

import logging
import os
import shutil
import subprocess
import sys
from pathlib import Path

from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile

from app.core.config import get_settings
from app.core.deps import get_current_user
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/sync-db")
async def sync_boardlib_db(current_user: User = Depends(get_current_user)):
    """Re-download / sync the BoardLib Kilter database.

    Runs `python -m boardlib database kilter <path>` as a subprocess. If the
    file already exists, boardlib will sync deltas instead of re-downloading
    the full ~189MB snapshot. Requires a valid JWT.
    """
    settings = get_settings()
    db_path = Path(settings.boardlib_db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    logger.info(
        "Admin sync-db triggered by user=%s path=%s", current_user.id, db_path
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

"""Admin endpoints — protected management operations."""

import logging
import os
import subprocess
import sys
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException

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

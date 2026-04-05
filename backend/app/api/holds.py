"""Endpoint to serve hold images from local disk."""

from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

router = APIRouter()

# Relative to the `backend/` working directory (set by railway_start.sh `cd backend`)
HOLDS_DIR = Path("data/images/holds")


@router.get("/{placement_id}/image")
async def get_hold_image(placement_id: int):
    """Serve a hold PNG image by placement_id."""
    path = HOLDS_DIR / f"{placement_id}.png"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Hold image not found")
    return FileResponse(path, media_type="image/png")

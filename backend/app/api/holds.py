"""Endpoint to serve hold images from local disk."""

from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

router = APIRouter()

# Relative to the `backend/` working directory (set by railway_start.sh `cd backend`)
HOLDS_DIR = Path("data/images/holds")
LAYOUTS_DIR = Path("data/images/product_sizes_layouts_sets")
CACHE_DIR = Path("data/images/cache")

# 16x12 Super Wide composite source (covers bolt-on layout for all Original sizes)
SOURCE_16X12 = LAYOUTS_DIR / "original-16x12-bolt-ons-v2.png"

# 12x12 Square cropped composite — generated on first request
BOARD_12X12 = CACHE_DIR / "board_original_12x12.png"

# Empirically measured crop box on the 16x12 composite that isolates the
# 12x12 Square inner frame (the solid-black physical board rectangle).
#
# A proportional crop using the documented coordinate bounds
# (16x12: x=[-24,168], y=[0,156]) produces ~half a column of extras on each
# side because the composite image has non-uniform padding around the hole
# area and the gray background with extra bolt-ons of the Super Wide bleeds
# in. These numbers were measured by detecting the dark frame edges and
# verified by overlaying all 336 placement centers on the crop (every dot
# sits on a hold). Width/height are both 1075 px (square, as expected).
#
# Crop box maps exactly to kilter coordinates x=[0,144], y=[12,156].
CROP_BOX = (201, 17, 1276, 1092)


def _ensure_board_image() -> Path:
    """Crop the 16x12 composite to the 12x12 region. Cached to disk."""
    if BOARD_12X12.exists():
        return BOARD_12X12

    if not SOURCE_16X12.exists():
        raise HTTPException(
            status_code=500,
            detail=f"Source composite not found: {SOURCE_16X12}",
        )

    from PIL import Image  # lazy import — PIL only loaded when needed

    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    with Image.open(SOURCE_16X12) as im:
        cropped = im.crop(CROP_BOX)
        cropped.save(BOARD_12X12, format="PNG", optimize=True)

    return BOARD_12X12


@router.get("/board-image")
async def get_board_image():
    """Serve the 12x12 composite board image (cropped on-demand, cached)."""
    path = _ensure_board_image()
    return FileResponse(path, media_type="image/png")


@router.get("/{placement_id}/image")
async def get_hold_image(placement_id: int):
    """Serve a hold PNG image by placement_id."""
    path = HOLDS_DIR / f"{placement_id}.png"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Hold image not found")
    return FileResponse(path, media_type="image/png")

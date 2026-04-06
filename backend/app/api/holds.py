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

# Kilter coordinate bounds for 16x12 Super Wide (edge_left/right/bottom/top from
# boardlib schema — see docs/BOARDLIB_SCHEMA_ANALYSIS.md §7).
SRC_X_MIN, SRC_X_MAX = -24, 168
SRC_Y_MIN, SRC_Y_MAX = 0, 156

# Kilter coordinate bounds for 12x12 Square (the sub-region we want to show).
DST_X_MIN, DST_X_MAX = 0, 144
DST_Y_MIN, DST_Y_MAX = 12, 156


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
        w, h = im.size
        px_per_x = w / (SRC_X_MAX - SRC_X_MIN)
        px_per_y = h / (SRC_Y_MAX - SRC_Y_MIN)

        left = (DST_X_MIN - SRC_X_MIN) * px_per_x
        right = (DST_X_MAX - SRC_X_MIN) * px_per_x
        # Kilter y grows upward; image y grows downward.
        top = (SRC_Y_MAX - DST_Y_MAX) * px_per_y
        bottom = (SRC_Y_MAX - DST_Y_MIN) * px_per_y

        box = (round(left), round(top), round(right), round(bottom))
        cropped = im.crop(box)
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

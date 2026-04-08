"""API endpoints for Kilter Board climb search and detail."""

from typing import Literal

from fastapi import APIRouter, HTTPException, Query

from app.schemas.climb import ClimbSearchResult, ClimbDetail, DbStatsResponse
from app.services.climb_service import search_climbs, get_climb, get_db_stats

router = APIRouter()

SortField = Literal["popularity", "quality", "grade_asc", "grade_desc"]


@router.get("/search", response_model=list[ClimbSearchResult])
async def search(
    q: str = Query(..., min_length=1, description="Search query (climb name)"),
    angle: int | None = Query(default=None, description="Filter by wall angle"),
    grade_min: int | None = Query(
        default=None,
        ge=10,
        le=40,
        description="Minimum numeric difficulty (e.g. 16 for 6a/V3)",
    ),
    grade_max: int | None = Query(
        default=None,
        ge=10,
        le=40,
        description="Maximum numeric difficulty",
    ),
    min_ascents: int | None = Query(
        default=None, ge=0, description="Minimum ascensionist count"
    ),
    min_quality: float | None = Query(
        default=None,
        ge=0,
        le=5,
        description="Minimum quality average (0–5)",
    ),
    sort: SortField = Query(
        default="popularity",
        description="Sort field: popularity | quality | grade_asc | grade_desc",
    ),
    limit: int = Query(default=10, ge=1, le=50, description="Max results"),
):
    """Search Kilter Board climbs. Autocomplete-friendly with rich filters."""
    return search_climbs(
        query=q,
        angle=angle,
        grade_min=grade_min,
        grade_max=grade_max,
        min_ascents=min_ascents,
        min_quality=min_quality,
        sort=sort,
        limit=limit,
    )


@router.get("/stats", response_model=DbStatsResponse)
async def stats():
    """Quick stats about the BoardLib Kilter Board database."""
    return get_db_stats()


@router.get("/{climb_uuid}", response_model=ClimbDetail)
async def detail(
    climb_uuid: str,
    angle: int | None = Query(default=None, description="Filter stats by angle"),
):
    """Get full climb detail including hold positions."""
    result = get_climb(climb_uuid=climb_uuid, angle=angle)
    if result is None:
        raise HTTPException(status_code=404, detail="Climb not found")
    return result

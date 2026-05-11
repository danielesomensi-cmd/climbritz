"""API endpoints for Kilter Board climb search and detail."""

from typing import Literal

from fastapi import APIRouter, HTTPException, Query

from app.schemas.climb import (
    ClimbSearchResponse,
    ClimbDetail,
    DbStatsResponse,
    MovesFilter,
)
from app.services.climb_service import (
    search_climbs,
    count_matching_climbs,
    get_climb,
    get_db_stats,
)

router = APIRouter()

SortField = Literal["popularity", "quality", "grade_asc", "grade_desc"]


@router.get("/search", response_model=ClimbSearchResponse)
async def search(
    q: str | None = Query(
        default=None,
        description="Optional search query (climb name). Omit for pure browse-by-filter.",
    ),
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
    moves: MovesFilter | None = Query(
        default=None,
        description="Move-count bucket: any | le5 | 6-7 | 8-10 | gt10",
    ),
    sort: SortField = Query(
        default="popularity",
        description="Sort field: popularity | quality | grade_asc | grade_desc",
    ),
    limit: int = Query(
        default=500,
        ge=1,
        le=500,
        description="Max results returned (hard cap 500). The response "
        "includes total_count so the client can surface an overflow banner.",
    ),
):
    """Search Kilter Board climbs. Autocomplete-friendly with rich filters.

    Response envelope (B020): ``{ climbs: [...], total_count: int }``.
    ``total_count`` reflects every climb matching the filters, ignoring
    the limit cap — so a broad search returning the first 500 of 1247
    matches sets ``total_count=1247`` and the UI can prompt the user to
    narrow the filters.
    """
    climbs = search_climbs(
        query=q,
        angle=angle,
        grade_min=grade_min,
        grade_max=grade_max,
        min_ascents=min_ascents,
        min_quality=min_quality,
        moves=moves,
        sort=sort,
        limit=limit,
    )
    total_count = count_matching_climbs(
        query=q,
        angle=angle,
        grade_min=grade_min,
        grade_max=grade_max,
        min_ascents=min_ascents,
        min_quality=min_quality,
        moves=moves,
    )
    return ClimbSearchResponse(climbs=climbs, total_count=total_count)


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

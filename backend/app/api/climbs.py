"""API endpoints for Kilter Board climb search and detail."""

from fastapi import APIRouter, HTTPException, Query

from app.schemas.climb import ClimbSearchResult, ClimbDetail, DbStatsResponse
from app.services.climb_service import search_climbs, get_climb, get_db_stats

router = APIRouter()


@router.get("/search", response_model=list[ClimbSearchResult])
async def search(
    q: str = Query(..., min_length=1, description="Search query (climb name)"),
    angle: int | None = Query(default=None, description="Filter by wall angle"),
    limit: int = Query(default=10, ge=1, le=50, description="Max results"),
):
    """Search Kilter Board climbs by name. Autocomplete-friendly."""
    return search_climbs(query=q, angle=angle, limit=limit)


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

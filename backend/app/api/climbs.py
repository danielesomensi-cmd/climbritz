"""API endpoints for Kilter Board climb search and detail."""

from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_optional_user_id
from app.schemas.climb import (
    ClimbDetail,
    ClimbSearchResponse,
    DbStatsResponse,
    DoneFilter,
    MovesFilter,
    ProjectFilter,
)
from app.schemas.logs import UserClimbState
from app.services import log_service
from app.services.climb_service import (
    count_matching_climbs,
    get_climb,
    get_db_stats,
    search_climbs,
)

router = APIRouter()

SortField = Literal["popularity", "quality", "grade_asc", "grade_desc"]


def _resolve_include_exclude(
    db: Session,
    user_id: str,
    done_filter: DoneFilter,
    project_filter: ProjectFilter,
) -> tuple[Optional[list[str]], list[str]]:
    """A021: turn the chip selections into ``include_uuids`` / ``exclude_uuids``
    parameters for ``_build_search_filters``.

    Returns (include_uuids, exclude_uuids). ``include_uuids`` is None when
    no chip restricts the candidate set positively — passing None disables
    the IN clause entirely. An *empty list* is meaningful: it short-circuits
    the search to zero results (the user asked for "only done" but has
    logged nothing).
    """
    include: Optional[set[str]] = None
    exclude: list[str] = []

    if done_filter == "only":
        include = set(log_service.list_done_climb_uuids(db, user_id=user_id))
    elif done_filter == "exclude":
        exclude.extend(
            log_service.list_done_climb_uuids(db, user_id=user_id)
        )

    if project_filter == "only":
        project_uuids = set(
            log_service.list_project_climb_uuids(db, user_id=user_id)
        )
        # Intersect with done_filter=only — both chips active means
        # "climbs that are done AND flagged project".
        include = (
            project_uuids if include is None else (include & project_uuids)
        )
    elif project_filter == "exclude":
        exclude.extend(
            log_service.list_project_climb_uuids(db, user_id=user_id)
        )

    return (list(include) if include is not None else None), exclude


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
    benchmark: bool = Query(
        default=False,
        description=(
            "A022 — when true, return only climbs flagged as a benchmark "
            "at the selected angle (benchmark_difficulty IS NOT NULL on the "
            "climb_stats row for this angle). Benchmark status is "
            "angle-specific by DB design."
        ),
    ),
    nomatch: bool = Query(
        default=False,
        description=(
            "A029 — when true, return only climbs with the setter's "
            "'no matching' rule (climbs.is_nomatch = 1, climb-level). "
            "False (default) applies no filter."
        ),
    ),
    done_filter: DoneFilter = Query(
        default="all",
        description=(
            "A021 chip filter — all (default) | only (climbs the user has "
            "flashed or sent) | exclude (climbs not yet done). Ignored "
            "when the request is unauthenticated."
        ),
    ),
    project_filter: ProjectFilter = Query(
        default="all",
        description=(
            "A021 chip filter — all (default) | only (climbs flagged as "
            "project) | exclude (climbs not flagged). Ignored when "
            "unauthenticated."
        ),
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
    current_user_id: Optional[str] = Depends(get_optional_user_id),
    db: Session = Depends(get_db),
):
    """Search Kilter Board climbs. Autocomplete-friendly with rich filters.

    Response envelope (B020): ``{ climbs: [...], total_count: int }``.
    ``total_count`` reflects every climb matching the filters, ignoring
    the limit cap — so a broad search returning the first 500 of 1247
    matches sets ``total_count=1247`` and the UI can prompt the user to
    narrow the filters.

    A021: when the request is authenticated, each result carries a
    ``user_state`` field with the user's project flag + best_result
    (or null when there's no history). ``done_filter`` / ``project_filter``
    pre-filter the candidate set based on user_climbs rows.
    """
    include_uuids: Optional[list[str]] = None
    exclude_uuids: list[str] = []

    if current_user_id is not None and (
        done_filter != "all" or project_filter != "all"
    ):
        include_uuids, exclude_uuids = _resolve_include_exclude(
            db, current_user_id, done_filter, project_filter
        )

    climbs = search_climbs(
        query=q,
        angle=angle,
        grade_min=grade_min,
        grade_max=grade_max,
        min_ascents=min_ascents,
        min_quality=min_quality,
        moves=moves,
        benchmark=benchmark,
        nomatch=nomatch,
        sort=sort,
        limit=limit,
        include_uuids=include_uuids,
        exclude_uuids=exclude_uuids or None,
    )
    total_count = count_matching_climbs(
        query=q,
        angle=angle,
        grade_min=grade_min,
        grade_max=grade_max,
        min_ascents=min_ascents,
        min_quality=min_quality,
        moves=moves,
        benchmark=benchmark,
        nomatch=nomatch,
        include_uuids=include_uuids,
        exclude_uuids=exclude_uuids or None,
    )

    # Overlay user_state on each result row. Authenticated only.
    if current_user_id is not None and climbs:
        state_map = log_service.list_user_climbs_by_uuids(
            db,
            user_id=current_user_id,
            climb_uuids=[c["uuid"] for c in climbs],
        )
        for climb in climbs:
            state = state_map.get((climb["uuid"], climb["angle"]))
            climb["user_state"] = (
                UserClimbState.model_validate(state) if state else None
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

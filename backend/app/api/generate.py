"""A026 — Problem Generator (Remix v1) API.

POST /api/climbs/generate  → remix a fresh problem from the matching pool.

Thin layer: build the pool with the SAME ``_build_search_filters`` path
Discovery uses, then hand injected hold data to the pure
``problem_generator.remix``. Ephemeral — nothing is persisted.
"""

import random

from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import get_current_user_id
from app.schemas.generate import (
    GenerateMeta,
    GenerateRequest,
    GenerateResponse,
)
from app.services import problem_generator
from app.services.climb_service import (
    count_matching_climbs,
    get_holds_for_climbs,
    search_climbs,
)
from app.services.problem_generator import (
    CannotGenerateError,
    GeneratorConfig,
    PoolTooSmallError,
)

router = APIRouter()

# Module-level defaults (Phase-0-derived; live in GeneratorConfig).
CONFIG = GeneratorConfig()

_TOO_SMALL_DETAIL = (
    "Not enough source problems for these filters. Loosen the grade range, "
    "move count, or angle and try again."
)


@router.post("/generate", response_model=GenerateResponse)
def generate(
    payload: GenerateRequest,
    current_user_id: str = Depends(get_current_user_id),
):
    """Generate a remixed problem from real climbs matching the filters.

    422 when the matching pool is too small (``< min_pool_size``) or when no
    seed can yield the required ≥2 swaps.
    """
    filter_kwargs = dict(
        angle=payload.angle,
        grade_min=payload.grade_min,
        grade_max=payload.grade_max,
        min_ascents=CONFIG.min_ascents,
        moves=payload.moves,
    )

    # Pool guard — count ignores the sample limit, so it's the true pool size.
    if count_matching_climbs(**filter_kwargs) < CONFIG.min_pool_size:
        raise HTTPException(status_code=422, detail=_TOO_SMALL_DETAIL)

    # Sample the pool (popularity-sorted: the most "real" climbs lead and
    # make the best seeds). Phase 0: ~300 climbs saturate the hold grid.
    climbs = search_climbs(
        sort="popularity", limit=CONFIG.sample_limit, **filter_kwargs
    )
    holds_map = get_holds_for_climbs([c["uuid"] for c in climbs])
    pool = [
        {
            "uuid": c["uuid"],
            "ascensionist_count": c["ascensionist_count"],
            "holds": holds_map.get(c["uuid"], []),
        }
        for c in climbs
    ]

    try:
        result = problem_generator.remix(pool, config=CONFIG, rng=random.Random())
    except (PoolTooSmallError, CannotGenerateError) as exc:
        raise HTTPException(status_code=422, detail=_TOO_SMALL_DETAIL) from exc

    return GenerateResponse(
        holds=result["holds"],
        meta=GenerateMeta(
            seed_uuid=result["seed_uuid"],
            swapped_count=result["swapped_count"],
            filters={
                "angle": payload.angle,
                "grade_min": payload.grade_min,
                "grade_max": payload.grade_max,
                "moves": payload.moves,
            },
        ),
    )

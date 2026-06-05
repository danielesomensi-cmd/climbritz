"""A026 — pure problem_generator.remix tests (no DB, no FastAPI).

Synthetic pools built inline; rng seeded for determinism.
"""

import random
from collections import Counter

import pytest

from app.services.problem_generator import (
    CannotGenerateError,
    GeneratorConfig,
    PoolTooSmallError,
    remix,
)

CONFIG = GeneratorConfig()


def _grid_pool(n_climbs=14):
    """A pool of distinct climbs on an 8-unit grid whose union covers many
    same-role placements — every hand hold has neighbours within epsilon."""
    xs = [48, 56, 64, 72, 80, 88, 96]
    starts = [(2000 + i, x, 48) for i, x in enumerate(xs)]          # y=48
    middles = [(2100 + i, x, 96) for i, x in enumerate(xs)]         # y=96
    finishes = [(2200 + i, x, 152) for i, x in enumerate(xs)]       # y=152
    foot = (2300, 56, 32)

    pool = []
    for i in range(n_climbs):
        s = starts[i % len(starts)]
        m = [
            middles[(i * 3 + 0) % len(middles)],
            middles[(i * 3 + 1) % len(middles)],
            middles[(i * 3 + 2) % len(middles)],
        ]
        f = finishes[i % len(finishes)]
        holds = (
            [{"placement_id": s[0], "role": "start", "x": s[1], "y": s[2]}]
            + [{"placement_id": mm[0], "role": "middle", "x": mm[1], "y": mm[2]} for mm in m]
            + [{"placement_id": f[0], "role": "finish", "x": f[1], "y": f[2]}]
            + [{"placement_id": foot[0], "role": "foot_only", "x": foot[1], "y": foot[2]}]
        )
        pool.append({"uuid": f"P{i:02d}", "ascensionist_count": 50 + i, "holds": holds})
    return pool


def _seed_holds(pool, uuid):
    return next(c["holds"] for c in pool if c["uuid"] == uuid)


def test_returns_valid_structure():
    result = remix(_grid_pool(), config=CONFIG, rng=random.Random(1))
    assert set(result) == {"holds", "seed_uuid", "swapped_count"}
    assert result["seed_uuid"].startswith("P")
    for h in result["holds"]:
        assert set(h) == {"placement_id", "role"}
        assert h["role"] in ("start", "middle", "finish", "foot_only")


def test_at_least_two_holds_differ_from_seed():
    pool = _grid_pool()
    result = remix(pool, config=CONFIG, rng=random.Random(7))
    seed = _seed_holds(pool, result["seed_uuid"])
    seed_pids = [h["placement_id"] for h in seed]
    new_pids = [h["placement_id"] for h in result["holds"]]
    differing = sum(1 for a, b in zip(seed_pids, new_pids) if a != b)
    assert differing >= 2
    assert result["swapped_count"] >= CONFIG.min_swaps


def test_no_duplicate_placement_ids():
    for seed in range(20):
        result = remix(_grid_pool(), config=CONFIG, rng=random.Random(seed))
        pids = [h["placement_id"] for h in result["holds"]]
        assert len(pids) == len(set(pids))


def test_move_count_preserved():
    pool = _grid_pool()
    result = remix(pool, config=CONFIG, rng=random.Random(3))
    seed = _seed_holds(pool, result["seed_uuid"])
    assert Counter(h["role"] for h in result["holds"]) == Counter(
        h["role"] for h in seed
    )
    assert len(result["holds"]) == len(seed)


def test_role_and_yband_preserved():
    for seed in range(15):
        result = remix(_grid_pool(), config=CONFIG, rng=random.Random(seed))
        # Reconstruct y via a pid->y map from the pool.
        pool = _grid_pool()
        ymap = {
            h["placement_id"]: h["y"]
            for c in pool for h in c["holds"]
        }
        for h in result["holds"]:
            if h["role"] == "start":
                assert ymap[h["placement_id"]] <= CONFIG.start_y_max
            elif h["role"] == "finish":
                assert ymap[h["placement_id"]] >= CONFIG.finish_y_min


def test_feet_inherited_from_seed():
    pool = _grid_pool()
    result = remix(pool, config=CONFIG, rng=random.Random(5))
    seed = _seed_holds(pool, result["seed_uuid"])
    seed_feet = {h["placement_id"] for h in seed if h["role"] == "foot_only"}
    new_feet = {h["placement_id"] for h in result["holds"] if h["role"] == "foot_only"}
    assert new_feet == seed_feet


def test_pool_too_small_raises():
    with pytest.raises(PoolTooSmallError):
        remix(_grid_pool(n_climbs=3), config=CONFIG, rng=random.Random(1))


def test_cannot_generate_when_no_candidates():
    """A pool of identical climbs: every same-role hold is already in the
    problem, so no valid swap exists → reseed exhausts → CannotGenerateError."""
    one = _grid_pool(n_climbs=1)[0]["holds"]
    pool = [
        {"uuid": f"SAME{i}", "ascensionist_count": 10, "holds": [dict(h) for h in one]}
        for i in range(12)
    ]
    with pytest.raises(CannotGenerateError):
        remix(pool, config=CONFIG, rng=random.Random(1))


def test_deterministic_with_seeded_rng():
    a = remix(_grid_pool(), config=CONFIG, rng=random.Random(42))
    b = remix(_grid_pool(), config=CONFIG, rng=random.Random(42))
    assert a == b

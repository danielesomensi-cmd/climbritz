"""A026 — AI Problem Generator (Remix v1). Pure, testable remix logic.

No FastAPI, no DB session here: ``remix()`` takes injected pool/hold data
and returns a freshly remixed problem. The API layer
(``app.api.generate``) builds the pool via ``climb_service`` and calls in.

Spatial constants are NOT magic numbers — they were measured on the real
BoardLib corpus in Phase 0 (``scripts/analyze_a026_corpus.py``):

  - the board sits on an 8-unit grid; same-role hand holds are dense, so a
    24-unit (3-cell) swap radius almost always yields candidates while
    staying local;
  - starts cluster low (y p95 = 80), finishes high (y plateau at 152), so
    the y-band guardrails keep ``start_y_max=88`` / ``finish_y_min=144``;
  - ``min_ascents=5`` keeps seeds to real, climbed problems while leaving
    pools in the hundreds–thousands for every sane filter combo;
  - ``min_pool_size=10`` (K) only trips on genuine extremes (e.g. V10 @70°
    with >10 moves), which is exactly the "loosen your filters" case.

Algorithm (v1): pick a seed (weighted by ascents) from the pool, then swap
≥2 hand holds with same-role candidates drawn from the rest of the pool
that sit within ε of the seed hold and inside the role's y-band. Swaps are
same-role 1:1, so the move count is preserved by construction. Feet are
inherited from the seed unchanged. Known v1 limitation: a swap can shift
real difficulty (grade-coherence scoring is v2, pending HC-7).
"""

from __future__ import annotations

import math
import random
from collections import Counter
from dataclasses import dataclass

# Roles that count as "hands" (swappable). foot_only is inherited as-is.
HAND_ROLES = ("start", "middle", "finish")


@dataclass(frozen=True)
class GeneratorConfig:
    """All generator tunables in one place. Defaults derived in Phase 0."""

    min_ascents: int = 5          # pool seeds must be real climbed problems
    min_pool_size: int = 10       # K — pool guard (PoolTooSmallError below)
    sample_limit: int = 300       # pool climbs sampled for swap candidates
    swap_radius: float = 24.0     # ε — 3 grid cells (grid pitch = 8)
    start_y_max: int = 88         # start band ceiling (p95 start y = 80)
    finish_y_min: int = 144       # finish band floor (finish y plateau = 152)
    swap_fraction: float = 0.25   # target swaps = max(min_swaps, ceil(frac·n))
    reseed_retries: int = 5       # distinct seeds to try before giving up
    min_swaps: int = 2            # HARD CONSTRAINT — at least this many swaps


class PoolTooSmallError(Exception):
    """The candidate pool has fewer than ``min_pool_size`` climbs."""


class CannotGenerateError(Exception):
    """No seed within the retry budget could yield ``min_swaps`` valid swaps."""


def _within_band(role: str, y: int, config: GeneratorConfig) -> bool:
    """Role y-band guardrail: starts stay low, finishes stay high, middles
    are unconstrained."""
    if role == "start":
        return y <= config.start_y_max
    if role == "finish":
        return y >= config.finish_y_min
    return True


def _build_candidate_index(
    pool: list[dict],
) -> dict[str, list[tuple[int, int, int]]]:
    """Aggregate hand holds from the whole pool into a role-keyed spatial
    index, deduped by placement_id. Returns role -> list of (pid, x, y)."""
    by_role: dict[str, dict[int, tuple[int, int]]] = {r: {} for r in HAND_ROLES}
    for climb in pool:
        for h in climb["holds"]:
            role = h["role"]
            if role in HAND_ROLES and h.get("x") is not None and h.get("y") is not None:
                by_role[role][h["placement_id"]] = (h["x"], h["y"])
    return {
        role: [(pid, xy[0], xy[1]) for pid, xy in pmap.items()]
        for role, pmap in by_role.items()
    }


def _weighted_seed_order(
    pool: list[dict], rng: random.Random, k: int
) -> list[dict]:
    """Return up to ``k`` distinct seeds, sampled without replacement and
    weighted by ascensionist_count (popular climbs are preferred seeds —
    they're the most "real"). Documented choice: weighted, not uniform."""
    remaining = list(range(len(pool)))
    weights = [max(1, pool[i].get("ascensionist_count") or 1) for i in range(len(pool))]
    chosen: list[dict] = []
    for _ in range(min(k, len(pool))):
        total = sum(weights[i] for i in remaining)
        r = rng.uniform(0, total)
        upto = 0.0
        for idx_pos, i in enumerate(remaining):
            upto += weights[i]
            if upto >= r:
                chosen.append(pool[i])
                remaining.pop(idx_pos)
                break
    return chosen


def _pick_replacement(
    hold: dict,
    candidates: dict[str, list[tuple[int, int, int]]],
    current_pids: set[int],
    config: GeneratorConfig,
    rng: random.Random,
) -> tuple[int, int, int] | None:
    """Find a same-role replacement within ε and inside the role's y-band,
    not already present in the problem. Returns (pid, x, y) or None."""
    role = hold["role"]
    hx, hy = hold.get("x"), hold.get("y")
    if hx is None or hy is None:
        return None
    options = []
    for pid, x, y in candidates.get(role, []):
        if pid in current_pids or pid == hold["placement_id"]:
            continue
        if not _within_band(role, y, config):
            continue
        dist = math.hypot(hx - x, hy - y)
        if 0 < dist <= config.swap_radius:
            options.append((pid, x, y))
    if not options:
        return None
    return rng.choice(options)


def _try_remix(
    seed: dict,
    candidates: dict[str, list[tuple[int, int, int]]],
    config: GeneratorConfig,
    rng: random.Random,
) -> dict | None:
    """Attempt to remix one seed. Returns the result dict on success
    (≥ min_swaps achieved) or None to signal a re-seed."""
    seed_holds = seed["holds"]
    hand_idxs = [i for i, h in enumerate(seed_holds) if h["role"] in HAND_ROLES]
    if not hand_idxs:
        return None

    target = max(config.min_swaps, math.ceil(config.swap_fraction * len(hand_idxs)))
    order = hand_idxs[:]
    rng.shuffle(order)

    new_holds = [dict(h) for h in seed_holds]
    current_pids = {h["placement_id"] for h in seed_holds}
    swapped = 0

    for i in order:
        if swapped >= target:
            break
        hold = new_holds[i]
        repl = _pick_replacement(hold, candidates, current_pids, config, rng)
        if repl is None:
            continue
        pid, x, y = repl
        current_pids.discard(hold["placement_id"])
        current_pids.add(pid)
        new_holds[i] = {
            "placement_id": pid,
            "role": hold["role"],
            "x": x,
            "y": y,
        }
        swapped += 1

    if swapped < config.min_swaps:
        return None

    # Light validation (v1) — defensive asserts; the construction already
    # guarantees these, but a regression should fail loudly, not silently.
    pids = [h["placement_id"] for h in new_holds]
    assert len(pids) == len(set(pids)), "duplicate placement_id after swap"
    assert Counter(h["role"] for h in new_holds) == Counter(
        h["role"] for h in seed_holds
    ), "role multiset changed — move count not preserved"

    return {
        "holds": [
            {"placement_id": h["placement_id"], "role": h["role"]}
            for h in new_holds
        ],
        "seed_uuid": seed["uuid"],
        "swapped_count": swapped,
    }


def remix(
    pool: list[dict],
    config: GeneratorConfig | None = None,
    rng: random.Random | None = None,
) -> dict:
    """Remix a fresh problem from a pool of real climbs.

    Args:
        pool: list of climbs, each ``{uuid, ascensionist_count, holds}``
              where ``holds`` is ``[{placement_id, role, x, y}, ...]``.
        config: tunables (defaults from Phase 0).
        rng: injectable ``random.Random`` (seed it in tests for determinism;
             omit in prod so each re-roll differs).

    Returns:
        ``{holds: [{placement_id, role}], seed_uuid, swapped_count}``.
        The API layer wraps this with ``meta.filters``.

    Raises:
        PoolTooSmallError: pool smaller than ``min_pool_size``.
        CannotGenerateError: no seed in the retry budget reached min_swaps.
    """
    config = config or GeneratorConfig()
    rng = rng or random.Random()

    if len(pool) < config.min_pool_size:
        raise PoolTooSmallError(
            f"pool has {len(pool)} climbs, need at least {config.min_pool_size}"
        )

    candidates = _build_candidate_index(pool)
    for seed in _weighted_seed_order(pool, rng, config.reseed_retries):
        result = _try_remix(seed, candidates, config, rng)
        if result is not None:
            return result

    raise CannotGenerateError(
        f"no seed yielded {config.min_swaps} valid swaps within "
        f"{config.reseed_retries} retries"
    )

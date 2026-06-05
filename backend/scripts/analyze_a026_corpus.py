"""THROWAWAY — A026 (Problem Generator / Remix v1) Phase 0 corpus analysis.

Read-only. Does NOT wire into prod startup. Run once against the real
BoardLib DB to derive the generator's spatial constants from the corpus
instead of inventing them:

  - pool sizes per (grade, angle, moves) bucket at min_ascents in {0,5,20}
  - inter-hold nearest-neighbor spacing (same role) -> epsilon (swap radius)
  - role y-bands (start vs finish y-range) -> y-band guardrails

Usage:
    cd backend && source venv/bin/activate && python scripts/analyze_a026_corpus.py

Delete after Phase 1 defaults are wired into problem_generator config.
"""

import statistics
from collections import defaultdict

from app.services import climb_service
from app.utils.kilter_parser import parse_layout


# Representative buckets: (label, grade_min, grade_max, angle, moves)
# Grades: 16=6a/V3, 18=6b/V4, 20=6c/V5, 22=7a/V6, 24=7b/V8.
BUCKETS = [
    ("V3-V4 @40 any", 16, 18, 40, "any"),
    ("V5 @40 6-7", 20, 20, 40, "6-7"),
    ("V5-V6 @40 8-10", 20, 22, 40, "8-10"),
    ("V4-V5 @30 any", 18, 20, 30, "any"),
    ("V6-V8 @45 any", 22, 24, 45, "any"),
]


def section(title):
    print("\n" + "=" * 70)
    print(title)
    print("=" * 70)


def analyze_pool_sizes():
    section("1. POOL SIZES  (count_matching_climbs — same path Discovery uses)")
    print(f"{'bucket':<22}{' asc>=0':>10}{'asc>=5':>10}{'asc>=20':>10}")
    for label, gmin, gmax, angle, moves in BUCKETS:
        counts = []
        for min_asc in (0, 5, 20):
            n = climb_service.count_matching_climbs(
                angle=angle,
                grade_min=gmin,
                grade_max=gmax,
                min_ascents=min_asc,
                moves=moves,
            )
            counts.append(n)
        print(f"{label:<22}{counts[0]:>10}{counts[1]:>10}{counts[2]:>10}")


def _hand_holds_for_bucket(gmin, gmax, angle, moves, min_asc, sample_limit):
    """Return list of (placement_id, x, y, role) for hand holds across a
    sample of climbs in the bucket. Roles start/middle/finish only."""
    climbs = climb_service.search_climbs(
        angle=angle,
        grade_min=gmin,
        grade_max=gmax,
        min_ascents=min_asc,
        moves=moves,
        sort="popularity",
        limit=sample_limit,
    )
    # Build placement_id -> (x,y) map once for the whole board.
    with climb_service._get_connection() as conn:
        pos_rows = conn.execute(
            """
            SELECT p.id AS pid, h.x, h.y
            FROM placements p JOIN holes h ON p.hole_id = h.id
            WHERE p.layout_id = 1
            """
        ).fetchall()
        pos = {r["pid"]: (r["x"], r["y"]) for r in pos_rows}

        per_climb = []  # list of list[(pid,x,y,role)]
        for c in climbs:
            frames = conn.execute(
                "SELECT frames FROM climbs WHERE uuid = ?", (c["uuid"],)
            ).fetchone()["frames"]
            holds = []
            for h in parse_layout(frames):
                if h["role"] in ("start", "middle", "finish"):
                    p = pos.get(h["placement_id"])
                    if p:
                        holds.append((h["placement_id"], p[0], p[1], h["role"]))
            if holds:
                per_climb.append(holds)
    return per_climb


def analyze_spacing_and_ybands():
    section("2. INTER-HOLD SPACING (nearest same-role neighbor across pool)")
    print("Per bucket: pool of candidate hand holds aggregated; for each hold,")
    print("nearest neighbor of the SAME role at a DIFFERENT placement.\n")

    all_role_y = defaultdict(list)  # role -> list of y (global, for y-bands)

    for label, gmin, gmax, angle, moves in BUCKETS:
        per_climb = _hand_holds_for_bucket(gmin, gmax, angle, moves, 5, 300)
        # Aggregate candidate pool by role: role -> set of (pid,x,y)
        by_role = defaultdict(dict)  # role -> {pid: (x,y)}
        for holds in per_climb:
            for pid, x, y, role in holds:
                by_role[role][pid] = (x, y)
                all_role_y[role].append(y)

        nn_dists = []
        for role, pmap in by_role.items():
            pts = list(pmap.items())
            for pid_a, (xa, ya) in pts:
                best = None
                for pid_b, (xb, yb) in pts:
                    if pid_b == pid_a:
                        continue
                    d = ((xa - xb) ** 2 + (ya - yb) ** 2) ** 0.5
                    if best is None or d < best:
                        best = d
                if best is not None:
                    nn_dists.append(best)
        if nn_dists:
            nn_dists.sort()
            n = len(nn_dists)
            p = lambda q: nn_dists[min(n - 1, int(q * n))]
            print(
                f"{label:<22} n={n:<5} "
                f"min={nn_dists[0]:.0f} p25={p(.25):.0f} "
                f"median={statistics.median(nn_dists):.0f} "
                f"p75={p(.75):.0f} p90={p(.90):.0f} max={nn_dists[-1]:.0f}"
            )

    section("3. ROLE Y-BANDS (global, across all sampled buckets)")
    print("Board y range observed; per-role y distribution.\n")
    for role in ("start", "middle", "finish"):
        ys = all_role_y.get(role, [])
        if not ys:
            continue
        ys.sort()
        n = len(ys)
        p = lambda q: ys[min(n - 1, int(q * n))]
        print(
            f"{role:<8} n={n:<6} "
            f"min={ys[0]} p5={p(.05)} p25={p(.25)} "
            f"median={int(statistics.median(ys))} "
            f"p75={p(.75)} p95={p(.95)} max={ys[-1]}"
        )

    # Global board extent for context
    with climb_service._get_connection() as conn:
        ext = conn.execute(
            """
            SELECT MIN(h.x), MAX(h.x), MIN(h.y), MAX(h.y)
            FROM placements p JOIN holes h ON p.hole_id = h.id
            WHERE p.layout_id = 1
            """
        ).fetchone()
    print(f"\nBoard extent (layout 1): x[{ext[0]},{ext[1]}] y[{ext[2]},{ext[3]}]")


if __name__ == "__main__":
    print("A026 Phase 0 — corpus analysis (READ-ONLY)")
    analyze_pool_sizes()
    analyze_spacing_and_ybands()
    print("\nDone. (throwaway script — delete after Phase 1)")

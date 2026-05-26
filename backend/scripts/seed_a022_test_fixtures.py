"""Idempotent seeder for A022 benchmark test fixtures.

A022 adds a "Benchmarks only" filter to /discover. The filter restricts
results to climbs flagged as a benchmark *at the selected angle* —
``climb_stats.benchmark_difficulty`` is keyed by (climb_uuid, angle), so
benchmark status is angle-specific by DB design (Phase 0.5 verified the
real dataset: 93% of benchmark climbs are validated at ≤3 angles, and a
climb's grade itself varies per angle).

The pre-A022 fixture had no benchmark rows at all. This script flips a
deterministic subset so the filter can be tested, including the
angle-specificity edge:

  - Benchmark Alpha @ 40°  → benchmark_difficulty = 16.0  (benchmark)
  - Benchmark Alpha @ 45°  → benchmark_difficulty = NULL  (NOT benchmark)
  - The Crimp Test @ 40°   → benchmark_difficulty = 22.0  (benchmark)
  - Benchmark Beta  @ 40°  → benchmark_difficulty = NULL  (control)

So `benchmark=True&angle=40` returns {Alpha, Crimp}, while
`benchmark=True&angle=45` returns {} — proving the filter respects the
selected angle (Alpha is a benchmark only at 40°, not 45°).

These UPDATEs touch only ``benchmark_difficulty`` (never read by any
pre-A022 query — search/count/detail all read ``display_difficulty``),
so every existing assertion stays green. The fixture has no triggers,
so the writes don't cascade.

Idempotent: the script sets exact values (benchmark + explicit NULLs),
so re-running converges to the same state. Run it any time the fixture
DB needs to be regenerated.

Usage:
    cd backend
    python scripts/seed_a022_test_fixtures.py
"""

import os
import sqlite3
import sys

FIXTURE_DB = os.path.join(
    os.path.dirname(__file__),
    "..",
    "tests",
    "fixtures",
    "test_kilter.db",
)

# (climb_uuid, angle, benchmark_difficulty) — None means explicit NULL.
A022_BENCHMARKS = [
    ("UUID-BENCH-001", 40, 16.0),   # Benchmark Alpha @ 40° → benchmark
    ("UUID-BENCH-001", 45, None),   # Benchmark Alpha @ 45° → NOT benchmark
    ("UUID-BENCH-003", 40, 22.0),   # The Crimp Test  @ 40° → benchmark
    ("UUID-BENCH-002", 40, None),   # Benchmark Beta  @ 40° → control (NULL)
]


def main() -> int:
    if not os.path.exists(FIXTURE_DB):
        print(f"ERROR: fixture DB not found at {FIXTURE_DB}", file=sys.stderr)
        return 1

    conn = sqlite3.connect(FIXTURE_DB)
    try:
        cur = conn.cursor()
        for climb_uuid, angle, benchmark in A022_BENCHMARKS:
            cur.execute(
                """
                UPDATE climb_stats
                   SET benchmark_difficulty = ?
                 WHERE climb_uuid = ? AND angle = ?
                """,
                (benchmark, climb_uuid, angle),
            )
            if cur.rowcount != 1:
                print(
                    f"ERROR: expected 1 row for {climb_uuid}@{angle}, "
                    f"updated {cur.rowcount}",
                    file=sys.stderr,
                )
                conn.rollback()
                return 1

        conn.commit()
        print(f"Seeded A022 benchmark flags into {FIXTURE_DB}")
        for climb_uuid, angle, benchmark in A022_BENCHMARKS:
            tag = "benchmark" if benchmark is not None else "NULL (not benchmark)"
            print(f"  {climb_uuid}@{angle}°  → {tag}")
    finally:
        conn.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())

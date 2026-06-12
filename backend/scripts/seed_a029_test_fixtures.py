"""Idempotent seeder for A029 "no matching" test fixtures.

A029 adds a "No matching only" filter to /discover, backed by the
structured column ``climbs.is_nomatch`` (audit D019: set by the official
app's setter toggle, authoritative — no description heuristics). The
fixture column already exists (the BoardLib schema ships it) but every
row was 0, so the filter had nothing to match.

This script flips a deterministic subset:

  - Benchmark Alpha (UUID-BENCH-001)        → is_nomatch = 1
  - A019 Fixture - Bucket 6-7 (…BUCKET-67)  → is_nomatch = 1
  - everything else                          → is_nomatch = 0 (explicit)

Alpha doubles as an A022 benchmark at 40°, so benchmark+nomatch
combination tests have a non-empty intersection. The UPDATEs touch only
``is_nomatch`` (never read by any pre-A029 query), so every existing
assertion stays green.

Idempotent: exact values are set on every run. Run any time the fixture
DB needs to be regenerated.

Usage:
    cd backend
    python scripts/seed_a029_test_fixtures.py
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

A029_NOMATCH_UUIDS = [
    "UUID-BENCH-001",       # Benchmark Alpha — also an A022 benchmark @40°
    "UUID-A019-BUCKET-67",  # plain listed climb, not a benchmark
]


def main() -> int:
    if not os.path.exists(FIXTURE_DB):
        print(f"ERROR: fixture DB not found at {FIXTURE_DB}", file=sys.stderr)
        return 1

    conn = sqlite3.connect(FIXTURE_DB)
    try:
        cur = conn.cursor()
        cur.execute("UPDATE climbs SET is_nomatch = 0")
        placeholders = ",".join("?" for _ in A029_NOMATCH_UUIDS)
        cur.execute(
            f"UPDATE climbs SET is_nomatch = 1 WHERE uuid IN ({placeholders})",
            A029_NOMATCH_UUIDS,
        )
        if cur.rowcount != len(A029_NOMATCH_UUIDS):
            print(
                f"ERROR: expected {len(A029_NOMATCH_UUIDS)} flagged rows, "
                f"updated {cur.rowcount}",
                file=sys.stderr,
            )
            conn.rollback()
            return 1

        conn.commit()
        print(f"Seeded A029 is_nomatch flags into {FIXTURE_DB}")
        for uuid in A029_NOMATCH_UUIDS:
            print(f"  {uuid} → is_nomatch = 1")
    finally:
        conn.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())

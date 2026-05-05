"""Idempotent seeder for A019 test fixture climbs.

A019 adds a "moves" filter to /discover. The filter buckets climbs by
the move count formula `(count of cyan/middle holds) + 2`, computed in
SQL via `(LENGTH(frames) - LENGTH(REPLACE(frames, 'r13', ''))) / 3 + 2`.

The pre-A019 fixture DB only contained climbs in the ≤5 bucket
(Alpha/Beta/Crimp at 3-4 moves). A019 adds:

  - "A019 Fixture - Bucket 6-7"        (5 cyan,  7 moves)
  - "A019 Fixture - Bucket 8-10"       (7 cyan,  9 moves)
  - "A019 Fixture - Bucket >10"        (12 cyan, 14 moves)
  - "A019 Fixture - Animated Sequence" (5 cyan,  7 moves nominal,
                                        frames_count=3 → MUST be
                                        excluded by the global
                                        frames_count=1 filter)

Stats are deliberately set to angle=30, difficulty=13, ascents=100,
quality=2.0 — values that don't intersect any pre-existing test's
filter range so the new rows can't accidentally pollute unrelated
assertions. (difficulty must be a value that exists in the fixture's
`difficulty_grades` table since the search SQL inner-joins on it; 13
is the lowest grade in the table that's well below every existing
`grade_min` test threshold.)

Idempotent: re-running this script wipes the four A019 rows from
`climbs` and `climb_stats` before re-inserting them. Run it any time
the fixture DB needs to be regenerated.

Usage:
    cd backend
    python scripts/seed_a019_test_fixtures.py
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


# Layout-string format: p<placement_id>r<role_id> concatenated.
# Role IDs (Kilter Original, layout_id=1):
#   12 = start, 13 = middle (cyan), 14 = finish, 15 = foot_only.
# The moves formula counts r13 substrings; +2 for start + finish.
def build_frames(middle_count: int) -> str:
    """Build a frames string with one start, `middle_count` middles, one finish."""
    parts = ["p1001r12"]
    placements = [1001, 1002, 1003, 1004, 1005, 1006]
    for i in range(middle_count):
        parts.append(f"p{placements[i % 6]}r13")
    parts.append("p1006r14")
    return "".join(parts)


A019_CLIMBS = [
    # (uuid, name, frames_count, middle_count)
    (
        "UUID-A019-BUCKET-67",
        "A019 Fixture - Bucket 6-7",
        1,
        5,  # 5+2 = 7 moves
    ),
    (
        "UUID-A019-BUCKET-810",
        "A019 Fixture - Bucket 8-10",
        1,
        7,  # 7+2 = 9 moves
    ),
    (
        "UUID-A019-BUCKET-GT10",
        "A019 Fixture - Bucket >10",
        1,
        12,  # 12+2 = 14 moves
    ),
    (
        "UUID-A019-ANIMATED",
        "A019 Fixture - Animated Sequence",
        3,  # frames_count > 1 → must be excluded by global filter
        5,
    ),
]

A019_UUIDS = [c[0] for c in A019_CLIMBS]


def main() -> int:
    if not os.path.exists(FIXTURE_DB):
        print(f"ERROR: fixture DB not found at {FIXTURE_DB}", file=sys.stderr)
        return 1

    conn = sqlite3.connect(FIXTURE_DB)
    try:
        cur = conn.cursor()

        # Idempotent wipe of any prior A019 rows.
        placeholders = ",".join("?" for _ in A019_UUIDS)
        cur.execute(
            f"DELETE FROM climb_stats WHERE climb_uuid IN ({placeholders})",
            A019_UUIDS,
        )
        cur.execute(
            f"DELETE FROM climbs WHERE uuid IN ({placeholders})",
            A019_UUIDS,
        )

        for uuid, name, frames_count, middle_count in A019_CLIMBS:
            frames = build_frames(middle_count)
            cur.execute(
                """
                INSERT INTO climbs (
                    uuid, layout_id, setter_id, setter_username, name,
                    description, frames_count, frames, is_listed, created_at
                ) VALUES (?, 1, 1, 'a019_seeder', ?, ?, ?, ?, 1, '2026-05-05')
                """,
                (
                    uuid,
                    name,
                    f"Seeded by seed_a019_test_fixtures.py — {middle_count} middles",
                    frames_count,
                    frames,
                ),
            )
            cur.execute(
                """
                INSERT INTO climb_stats (
                    climb_uuid, angle, display_difficulty, benchmark_difficulty,
                    ascensionist_count, difficulty_average, quality_average,
                    fa_username, fa_at
                ) VALUES (?, 30, 13.0, NULL, 100, 13.0, 2.0, 'a019_seeder', '2026-05-05')
                """,
                (uuid,),
            )

        conn.commit()
        print(f"Seeded {len(A019_CLIMBS)} A019 fixture climbs into {FIXTURE_DB}")
        for uuid, name, fc, mc in A019_CLIMBS:
            print(f"  {uuid}  {name}  (frames_count={fc}, middles={mc} → {mc + 2} moves)")
    finally:
        conn.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())

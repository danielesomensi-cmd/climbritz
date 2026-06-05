"""Build the A026 dedicated BoardLib test fixture: tests/fixtures/test_kilter_a026.db

The shared test_kilter.db only has 6 sparse placements and 9 climbs whose
counts are pinned by existing assertions — too thin to exercise the problem
generator (which needs a dense, same-role swap pool) and impossible to grow
without breaking unrelated tests. So A026 gets its own fixture DB.

Contents (deterministic, no randomness):
  - a dense hand-hold grid on the real board's 8-unit pitch:
      starts   at low y  (40/48/56), finishes at high y (144/152),
      middles  across the mid band, plus a couple of screw-on feet;
  - a pool of 14 climbs all at angle=40, grade=20 (6c/V5), 5 moves each
      (1 start + 3 middles + 1 finish + 1 foot), ascents >= 5, whose union
      covers the whole grid so any seed hand hold has same-role neighbours
      within epsilon;
  - a 2-climb sparse bucket at angle=20 used to exercise the pool-too-small
      (422) guard.

Idempotent: drops + recreates the file on every run.

Usage:
    cd backend && python scripts/seed_a026_test_fixtures.py
"""

import os
import sqlite3

FIXTURE_DB = os.path.join(
    os.path.dirname(__file__), "..", "tests", "fixtures", "test_kilter_a026.db"
)

SCHEMA = """
CREATE TABLE layouts (id INTEGER PRIMARY KEY, product_id INTEGER, name TEXT, is_listed INTEGER);
CREATE TABLE difficulty_grades (difficulty INTEGER PRIMARY KEY, boulder_name TEXT, is_listed INTEGER);
CREATE TABLE holes (id INTEGER PRIMARY KEY, x INTEGER, y INTEGER);
CREATE TABLE placements (id INTEGER PRIMARY KEY, layout_id INTEGER, hole_id INTEGER, set_id INTEGER, default_placement_role_id INTEGER);
CREATE TABLE climbs (
    uuid TEXT PRIMARY KEY, layout_id INTEGER, setter_username TEXT, name TEXT,
    description TEXT, angle INTEGER, frames_count INTEGER, frames TEXT, is_listed INTEGER
);
CREATE TABLE climb_stats (
    climb_uuid TEXT, angle INTEGER, display_difficulty REAL, benchmark_difficulty REAL,
    ascensionist_count INTEGER, quality_average REAL
);
"""


def build():
    if os.path.exists(FIXTURE_DB):
        os.remove(FIXTURE_DB)
    conn = sqlite3.connect(FIXTURE_DB)
    conn.executescript(SCHEMA)

    conn.execute(
        "INSERT INTO layouts VALUES (1, 1, 'Kilter Board Original', 1)"
    )
    # Only the grades referenced below need to exist (search SQL inner-joins).
    conn.executemany(
        "INSERT INTO difficulty_grades VALUES (?, ?, 1)",
        [(20, "6c/V5"), (24, "7b/V8")],
    )

    # ── Dense hand-hold grid (8-unit pitch) ───────────────────────────────
    xs = [48, 56, 64, 72, 80, 88, 96]
    start_ys = [40, 48, 56]
    middle_ys = [72, 80, 88, 96, 104, 112, 120, 128]
    finish_ys = [144, 152]

    pid = 2000
    starts, middles, finishes, feet = [], [], [], []
    holes, placements = [], []

    def add(role_id, set_id, x, y, bucket):
        nonlocal pid
        holes.append((pid, x, y))
        placements.append((pid, 1, pid, set_id, role_id))
        bucket.append(pid)
        pid += 1

    for y in start_ys:
        for x in xs:
            add(12, 1, x, y, starts)
    for y in middle_ys:
        for x in xs:
            add(13, 1, x, y, middles)
    for y in finish_ys:
        for x in xs:
            add(14, 1, x, y, finishes)
    for x in (56, 80):  # screw-on feet, low
        add(15, 20, x, 32, feet)

    conn.executemany("INSERT INTO holes VALUES (?, ?, ?)", holes)
    conn.executemany("INSERT INTO placements VALUES (?, ?, ?, ?, ?)", placements)

    # ── Pool: 14 climbs @40°, grade 20, 5 moves each ──────────────────────
    # Each climb picks distinct grid placements so the pool union covers the
    # grid (every seed hand hold gets same-role neighbours within epsilon).
    climbs, stats = [], []
    foot = feet[0]
    for i in range(14):
        start = starts[i % len(starts)]
        mids = [
            middles[(i * 3 + 0) % len(middles)],
            middles[(i * 3 + 1) % len(middles)],
            middles[(i * 3 + 2) % len(middles)],
        ]
        finish = finishes[i % len(finishes)]
        frames = (
            f"p{start}r12"
            + "".join(f"p{m}r13" for m in mids)
            + f"p{finish}r14"
            + f"p{foot}r15"
        )
        uuid = f"A026-POOL-{i:02d}"
        climbs.append(
            (uuid, 1, "a026_setter", f"A026 Pool {i:02d}", "", 40, 1, frames, 1)
        )
        stats.append((uuid, 40, 20.0, None, 50 + i, 3.0))

    # ── Sparse bucket @20° (2 climbs) → pool-too-small 422 path ────────────
    for i in range(2):
        start = starts[i]
        frames = (
            f"p{start}r12"
            + f"p{middles[i]}r13"
            + f"p{finishes[i]}r14"
            + f"p{foot}r15"
        )
        uuid = f"A026-SPARSE-{i:02d}"
        climbs.append(
            (uuid, 1, "a026_setter", f"A026 Sparse {i:02d}", "", 20, 1, frames, 1)
        )
        stats.append((uuid, 20, 20.0, None, 50, 3.0))

    conn.executemany(
        "INSERT INTO climbs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", climbs
    )
    conn.executemany(
        "INSERT INTO climb_stats VALUES (?, ?, ?, ?, ?, ?)", stats
    )

    conn.commit()
    conn.close()
    print(
        f"Built {FIXTURE_DB}: {len(placements)} placements, "
        f"{len(climbs)} climbs ({len(starts)} starts / {len(middles)} middles / "
        f"{len(finishes)} finishes)."
    )


if __name__ == "__main__":
    build()

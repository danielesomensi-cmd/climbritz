#!/usr/bin/env python3
"""C001 — Build a slim, board-only Kilter DB for Climbritz.

Target board: Kilter Board Original (layout_id=1), "12 x 12 with kickboard"
(product_size_id=10, bounds x 0..144, y 0..156). Nothing else is kept.

Why: the Aurora API that BoardLib synced from was shut down in March 2026,
so our kilter.db is frozen at 2026-01-31. Boardsesh publishes a fresh,
public SQLite snapshot of the Kilter Original catalog. This script merges
the two into an Aurora-compatible subset containing ONLY the tables and
columns the backend reads (climb_service.py, kilter_parser.py).

Sources
  --local     current BoardLib kilter.db (Aurora schema). Provides
              placements / holes / difficulty_grades, the is_nomatch flag,
              and the canonical uuid spelling of every climb we already
              serve (user logs reference those uuids verbatim).
  --snapshot  Boardsesh snapshot for kilter/1 (schemaVersion 10). If not
              given, the latest one is downloaded from the public manifest.

Rules (all deterministic)
  * Board fit: edge_left > 0, edge_right < 144, edge_bottom > 0,
    edge_top < 156 (strict; matches Boardsesh compatible_size_ids for size 10
    on 100% of rows).
  * listed, not draft, not hidden, frames_count == 1 (no animated sequences).
  * Roles: every start/middle/finish/foot role family that kilter_parser
    already understands (12-15, 20-35, 42-45) is normalized to the Original
    ids 12-15, so the r13 moves filter and BLE colours stay correct. Climbs
    with any other role (e.g. Tycho 36-41) are dropped, as are non-UUID ids
    (Boardsesh "json-import-climb-*").
  * Snapshot wins for climb fields (name, frames, listing). Local is used for
    climbs the snapshot does not have at all.
  * Stats, per (climb, angle): the row with MORE ascents wins (tie ->
    snapshot). Reason: the snapshot recomputed counts in Aug 2026 from a
    partial ascent history — popular climbs gained ascents, but ~150k small
    rows dropped (e.g. 1 -> 0). Ascents never disappear in reality, so the
    larger count is the better-informed row.
  * display_difficulty (snapshot rows) = COALESCE(benchmark_difficulty,
    difficulty_average, display_difficulty): Aurora semantics; the snapshot
    rounds display_difficulty to an integer, difficulty_average keeps 2
    decimals.
  * is_nomatch = local flag OR snapshot characteristics contains "no_match".
  * Stats rows with 0 ascents or no usable grade are dropped (Discovery
    already filters ascensionist_count > 0). A climb is kept only if its best
    angle has >= --min-ascents ascents (default 1 = Discovery parity).
  * --keep-uuids FILE: uuids (one per line) that must survive the fit /
    min-ascents filters (e.g. climbs referenced by production user logs).
  * Existing climbs keep their local uuid spelling; new climbs get
    UPPER(no-dash) uuids (same format as the bulk of the Aurora catalog).

Usage
  python scripts/build_board_db.py --local data/kilter.db \
      --out data/kilter.board.db [--snapshot PATH] [--min-ascents 1] \
      [--keep-uuids FILE]

Stdlib only. Never writes to --local or --snapshot (opened read-only).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sqlite3
import sys
import time
import urllib.request
from pathlib import Path

SCRIPT_VERSION = "C001-1"
MANIFEST_URL = (
    "https://boardsesh-board-snapshots.t3.tigrisfiles.io/"
    "board-snapshots/v1/manifest.json"
)
EXPECTED_SCHEMA_VERSION = 10

BOARD = {
    "name": "Kilter Board Original 12x12 with kickboard",
    "layout_id": 1,
    "product_size_id": 10,
    "edge_left": 0,
    "edge_right": 144,
    "edge_bottom": 0,
    "edge_top": 156,
}
VALID_ROLES = {12, 13, 14, 15}
# Role families (start, middle, finish, foot) known to kilter_parser.
ROLE_NORMALIZE = {
    base + i: 12 + i for base in (12, 20, 24, 28, 32, 42) for i in range(4)
}
FRAME_RX = re.compile(r"p(\d+)r(\d+)")
UUID_RX = re.compile(
    r"^(?:[0-9A-Fa-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$"
)

SCHEMA = """
CREATE TABLE climbs (
    uuid            TEXT PRIMARY KEY,
    layout_id       INTEGER NOT NULL,
    setter_username TEXT,
    name            TEXT,
    description     TEXT,
    hsm             INTEGER,
    frames_count    INTEGER NOT NULL DEFAULT 1,
    frames          TEXT NOT NULL,
    is_listed       INTEGER NOT NULL DEFAULT 1,
    is_nomatch      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT
) WITHOUT ROWID;

CREATE TABLE climb_stats (
    climb_uuid           TEXT NOT NULL,
    angle                INTEGER NOT NULL,
    display_difficulty   REAL,
    benchmark_difficulty REAL,
    ascensionist_count   INTEGER,
    difficulty_average   REAL,
    quality_average      REAL,
    PRIMARY KEY (climb_uuid, angle)
) WITHOUT ROWID;

CREATE TABLE climbritz_db_meta (
    key   TEXT PRIMARY KEY,
    value TEXT
) WITHOUT ROWID;
"""

# Mirrors climb_service.search_climbs() (popularity sort, angle filter).
SEARCH_SQL = """
    SELECT c.uuid, c.name, cs.angle, cs.ascensionist_count, dg.boulder_name
    FROM climbs c
    JOIN climb_stats cs ON c.uuid = cs.climb_uuid
    JOIN difficulty_grades dg
        ON CAST(ROUND(cs.display_difficulty) AS INT) = dg.difficulty
    WHERE c.layout_id = 1 AND c.is_listed = 1 AND c.frames_count = 1
      AND cs.ascensionist_count > 0 AND cs.angle = ?
    ORDER BY cs.ascensionist_count DESC LIMIT ?
"""


def log(msg: str) -> None:
    print(f"[build_board_db] {msg}", flush=True)


def norm(uuid: str) -> str:
    return uuid.replace("-", "").upper()


def ro_uri(path: str) -> str:
    return Path(path).resolve().as_uri() + "?mode=ro"


def fits(left, right, bottom, top) -> bool:
    if None in (left, right, bottom, top):
        return False
    return (
        left > BOARD["edge_left"]
        and right < BOARD["edge_right"]
        and bottom > BOARD["edge_bottom"]
        and top < BOARD["edge_top"]
    )


def normalize_frames(frames: str | None) -> str | None:
    """Return frames with roles mapped to 12-15, or None if not convertible."""
    if not frames:
        return None
    pairs = FRAME_RX.findall(frames)
    if not pairs or "".join(f"p{p}r{r}" for p, r in pairs) != frames:
        return None
    out = []
    for p, r in pairs:
        role = ROLE_NORMALIZE.get(int(r))
        if role is None:
            return None
        out.append(f"p{p}r{role}")
    return "".join(out)


def sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


# ---------------------------------------------------------------- download
def download_snapshot(dest_dir: str) -> tuple[str, dict]:
    log(f"fetching manifest {MANIFEST_URL}")
    with urllib.request.urlopen(MANIFEST_URL, timeout=60) as r:
        manifest = json.load(r)
    entry = next(
        (
            e
            for e in manifest["entries"]
            if e["boardType"] == "kilter" and e["layoutId"] == BOARD["layout_id"]
        ),
        None,
    )
    if entry is None:
        sys.exit("manifest has no kilter/1 entry")
    if entry.get("schemaVersion") != EXPECTED_SCHEMA_VERSION:
        sys.exit(
            f"snapshot schemaVersion {entry.get('schemaVersion')} != "
            f"{EXPECTED_SCHEMA_VERSION}: review the mapping before building"
        )
    dest = Path(dest_dir) / ("boardsesh_" + Path(entry["key"]).name)
    if dest.exists() and dest.stat().st_size == entry["bytes"]:
        log(f"snapshot already present: {dest}")
        return str(dest), entry
    part = dest.with_suffix(".part")
    log(f"downloading {entry['url']} ({entry['bytes'] / 1e6:.0f} MB)")
    urllib.request.urlretrieve(entry["url"], part)
    if part.stat().st_size != entry["bytes"]:
        part.unlink(missing_ok=True)
        sys.exit("snapshot size mismatch — download incomplete")
    part.rename(dest)
    return str(dest), entry


# ---------------------------------------------------------------- build
def build(args) -> dict:
    out = Path(args.out)
    if out.exists():
        if not args.force:
            sys.exit(f"{out} exists (use --force to overwrite)")
        out.unlink()

    keep: set[str] = set()
    if args.keep_uuids:
        keep = {
            norm(line.strip())
            for line in Path(args.keep_uuids).read_text().splitlines()
            if line.strip()
        }
        log(f"keep-uuids: {len(keep)}")

    con = sqlite3.connect(str(out), uri=True)
    con.execute("PRAGMA journal_mode=OFF")
    con.execute("PRAGMA synchronous=OFF")
    con.execute("ATTACH DATABASE ? AS loc", (ro_uri(args.local),))
    con.execute("ATTACH DATABASE ? AS snap", (ro_uri(args.snapshot),))

    sv = con.execute(
        "SELECT schema_version, built_at FROM snap.snapshot_meta "
        "WHERE table_name='board_climbs'"
    ).fetchone()
    if not sv or sv[0] != EXPECTED_SCHEMA_VERSION:
        sys.exit(f"unexpected snapshot schema_version: {sv}")
    snapshot_built_at = sv[1]

    con.executescript(SCHEMA)

    # Reference tables copied verbatim from local (DDL + filtered rows).
    def copy_table(name: str, where: str = "") -> int:
        ddl = con.execute(
            "SELECT sql FROM loc.sqlite_master WHERE type='table' AND name=?",
            (name,),
        ).fetchone()[0]
        con.execute(ddl)
        con.execute(f"INSERT INTO main.{name} SELECT * FROM loc.{name} {where}")
        return con.execute(f"SELECT COUNT(*) FROM main.{name}").fetchone()[0]

    n_dg = copy_table("difficulty_grades")
    n_pl = copy_table("placements", f"WHERE layout_id = {BOARD['layout_id']}")
    n_ho = copy_table("holes", "WHERE id IN (SELECT hole_id FROM main.placements)")
    # Tiny reference tables kept so offline tooling
    # (scripts/regenerate_board_assets.py) keeps working on the slim DB.
    n_le = copy_table("leds", "WHERE hole_id IN (SELECT id FROM main.holes)")
    copy_table("sets")
    copy_table("placement_roles")
    placement_ids = {r[0] for r in con.execute("SELECT id FROM main.placements")}
    log(
        f"difficulty_grades={n_dg} placements={n_pl} holes={n_ho} leds={n_le} "
        "(+ sets, placement_roles)"
    )

    # Local layout-1 climbs, keyed by normalized uuid.
    local: dict[str, tuple] = {}
    for row in con.execute(
        "SELECT uuid, setter_username, name, description, hsm, frames_count, "
        "frames, is_listed, is_nomatch, created_at, edge_left, edge_right, "
        "edge_bottom, edge_top, COALESCE(is_draft,0) "
        "FROM loc.climbs WHERE layout_id = ?",
        (BOARD["layout_id"],),
    ):
        local[norm(row[0])] = row
    log(f"local layout-1 climbs: {len(local)}")

    drops = {
        "not_listed_or_draft_or_hidden": 0,
        "animated": 0,
        "off_board": 0,
        "bad_uuid": 0,
        "bad_roles_or_unknown_placement": 0,
    }
    included: dict[str, str] = {}  # norm uuid -> output uuid
    src_count = {"snapshot_existing": 0, "snapshot_new": 0, "local_only": 0}
    rows_out = []

    normalized_roles = 0

    def clean_frames(frames: str | None) -> str | None:
        nonlocal normalized_roles
        nf = normalize_frames(frames)
        if nf is None:
            return None
        if not all(int(p) in placement_ids for p, _ in FRAME_RX.findall(nf)):
            return None
        if nf != frames:
            normalized_roles += 1
        return nf

    seen_snapshot: set[str] = set()
    for (
        suuid, setter, name, desc, hsm, fcount, frames, is_draft, is_listed,
        created_at, chars, is_hidden, el, er, eb, et,
    ) in con.execute(
        "SELECT uuid, setter_username, name, description, hsm, frames_count, "
        "frames, is_draft, is_listed, created_at, characteristics, is_hidden, "
        "edge_left, edge_right, edge_bottom, edge_top "
        "FROM snap.board_climbs WHERE layout_id = ?",
        (BOARD["layout_id"],),
    ):
        k = norm(suuid)
        seen_snapshot.add(k)
        kept = k in keep
        if not UUID_RX.match(suuid):
            drops["bad_uuid"] += 1
            continue
        if not is_listed or is_draft or is_hidden:
            drops["not_listed_or_draft_or_hidden"] += 1
            continue
        if (fcount or 1) != 1:
            drops["animated"] += 1
            continue
        if not kept and not fits(el, er, eb, et):
            drops["off_board"] += 1
            continue
        frames = clean_frames(frames)
        if frames is None:
            drops["bad_roles_or_unknown_placement"] += 1
            continue
        loc_row = local.get(k)
        out_uuid = loc_row[0] if loc_row else k
        nomatch = int(
            bool(loc_row and loc_row[8]) or "no_match" in (chars or "")
        )
        rows_out.append(
            (out_uuid, BOARD["layout_id"], setter, name, desc, hsm, 1, frames,
             1, nomatch, created_at)
        )
        included[k] = out_uuid
        src_count["snapshot_existing" if loc_row else "snapshot_new"] += 1

    # Local climbs the snapshot does not know at all (deleted upstream or
    # never mirrored): keep them if they are still valid for this board.
    for k, r in local.items():
        if k in seen_snapshot:
            continue
        (uuid, setter, name, desc, hsm, fcount, frames, is_listed, nomatch,
         created_at, el, er, eb, et, is_draft) = r
        kept = k in keep
        if not is_listed or is_draft or (fcount or 1) != 1:
            continue
        if not kept and not fits(el, er, eb, et):
            continue
        frames = clean_frames(frames)
        if frames is None:
            continue
        rows_out.append(
            (uuid, BOARD["layout_id"], setter, name, desc, hsm, 1, frames, 1,
             int(bool(nomatch)), created_at)
        )
        included[k] = uuid
        src_count["local_only"] += 1

    con.executemany(
        "INSERT INTO climbs VALUES (?,?,?,?,?,?,?,?,?,?,?)", rows_out
    )
    log(f"climb candidates: {len(rows_out)} {src_count}")
    log(f"dropped from snapshot: {drops}")
    log(f"climbs with roles normalized to 12-15: {normalized_roles}")

    # ---- stats: per (climb, angle) keep the row with more ascents.
    chosen: dict[tuple[str, int], tuple] = {}
    for cu, angle, disp, bench, asc, avg, qual in con.execute(
        "SELECT climb_uuid, angle, display_difficulty, benchmark_difficulty, "
        "ascensionist_count, difficulty_average, quality_average "
        "FROM loc.climb_stats"
    ):
        k = norm(cu)
        if k in included:
            chosen[(k, angle)] = ("local", asc or 0, disp, bench, avg, qual)
    stat_src = {"snapshot": 0, "local": 0}
    for cu, angle, disp, bench, asc, avg, qual in con.execute(
        "SELECT climb_uuid, angle, display_difficulty, benchmark_difficulty, "
        "ascensionist_count, difficulty_average, quality_average "
        "FROM snap.board_climb_stats"
    ):
        k = norm(cu)
        if k not in included:
            continue
        prev = chosen.get((k, angle))
        if prev is None or (asc or 0) >= prev[1]:
            d = bench if bench is not None else (avg if avg is not None else disp)
            chosen[(k, angle)] = ("snapshot", asc or 0, d, bench, avg, qual)

    stats_out = []
    for (k, angle), (src, asc, d, bench, avg, qual) in chosen.items():
        if d is None or asc <= 0:
            continue
        stat_src[src] += 1
        stats_out.append((included[k], angle, d, bench, asc, avg, qual))
    del chosen
    log(f"stats rows: {len(stats_out)} by source {stat_src}")
    con.executemany(
        "INSERT OR REPLACE INTO climb_stats VALUES (?,?,?,?,?,?,?)", stats_out
    )

    # ---- min-ascents gate (keep-uuids exempt).
    keep_out = [included[k] for k in keep if k in included]
    con.execute("CREATE TEMP TABLE keep_out (uuid TEXT PRIMARY KEY)")
    con.executemany("INSERT INTO keep_out VALUES (?)", [(u,) for u in keep_out])
    removed = con.execute(
        """
        DELETE FROM climbs
        WHERE uuid NOT IN (SELECT uuid FROM temp.keep_out)
          AND COALESCE((SELECT MAX(ascensionist_count) FROM climb_stats cs
                        WHERE cs.climb_uuid = climbs.uuid), 0) < ?
        """,
        (args.min_ascents,),
    ).rowcount
    con.execute(
        "DELETE FROM climb_stats WHERE climb_uuid NOT IN (SELECT uuid FROM climbs)"
    )
    log(f"removed below min_ascents={args.min_ascents}: {removed}")

    counts = {
        "climbs": con.execute("SELECT COUNT(*) FROM climbs").fetchone()[0],
        "climb_stats": con.execute("SELECT COUNT(*) FROM climb_stats").fetchone()[0],
        "difficulty_grades": n_dg,
        "placements": n_pl,
        "holes": n_ho,
        "keep_uuids_requested": len(keep),
        "keep_uuids_found": len(keep_out),
    }
    meta = {
        "script_version": SCRIPT_VERSION,
        "built_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "board": json.dumps(BOARD),
        "min_ascents": str(args.min_ascents),
        "snapshot_file": Path(args.snapshot).name,
        "snapshot_built_at": snapshot_built_at,
        "snapshot_sha256": sha256(args.snapshot),
        "local_file": Path(args.local).name,
        "local_climbs_last_sync": con.execute(
            "SELECT last_synchronized_at FROM loc.shared_syncs "
            "WHERE table_name='climbs'"
        ).fetchone()[0],
        "counts": json.dumps(counts),
        "sources": json.dumps(src_count),
        "stats_sources": json.dumps(stat_src),
        "roles_normalized": str(normalized_roles),
        "dropped": json.dumps(drops),
    }
    con.executemany(
        "INSERT INTO climbritz_db_meta VALUES (?,?)", list(meta.items())
    )
    con.commit()
    con.execute("DETACH DATABASE loc")
    con.execute("DETACH DATABASE snap")
    con.execute("ANALYZE")
    con.commit()
    con.execute("VACUUM")
    con.close()
    return {
        "counts": counts,
        "sources": src_count,
        "stats_sources": stat_src,
        "roles_normalized": normalized_roles,
        "removed_below_min_ascents": removed,
        "dropped": drops,
    }


# ---------------------------------------------------------------- verify
def verify(out: str, local: str) -> dict:
    con = sqlite3.connect(ro_uri(out), uri=True)
    q = lambda s, p=(): con.execute(s, p).fetchall()  # noqa: E731
    problems = []

    if q("PRAGMA integrity_check")[0][0] != "ok":
        problems.append("integrity_check failed")
    orphan_stats = q(
        "SELECT COUNT(*) FROM climb_stats WHERE climb_uuid NOT IN "
        "(SELECT uuid FROM climbs)"
    )[0][0]
    no_stats = q(
        "SELECT COUNT(*) FROM climbs WHERE uuid NOT IN "
        "(SELECT climb_uuid FROM climb_stats)"
    )[0][0]
    no_grade = q(
        "SELECT COUNT(*) FROM climb_stats cs LEFT JOIN difficulty_grades dg "
        "ON CAST(ROUND(cs.display_difficulty) AS INT) = dg.difficulty "
        "WHERE dg.difficulty IS NULL"
    )[0][0]
    if orphan_stats:
        problems.append(f"{orphan_stats} orphan stats rows")
    if no_grade:
        problems.append(f"{no_grade} stats rows without a difficulty_grades match")

    placement_ids = {r[0] for r in q("SELECT id FROM placements")}
    bad_frames = 0
    for (frames,) in con.execute("SELECT frames FROM climbs"):
        pairs = FRAME_RX.findall(frames)
        if not pairs or any(
            int(p) not in placement_ids or int(r) not in VALID_ROLES
            for p, r in pairs
        ):
            bad_frames += 1
    if bad_frames:
        problems.append(f"{bad_frames} climbs with invalid frames")

    # Discovery-visible set today (local DB, app filters + board fit) vs new.
    con.execute("ATTACH DATABASE ? AS loc", (ro_uri(local),))
    lost = q(
        f"""
        SELECT COUNT(DISTINCT c.uuid) FROM loc.climbs c
        JOIN loc.climb_stats cs ON cs.climb_uuid = c.uuid
        WHERE c.layout_id = 1 AND c.is_listed = 1 AND c.frames_count = 1
          AND cs.ascensionist_count > 0
          AND c.edge_left > {BOARD['edge_left']} AND c.edge_right < {BOARD['edge_right']}
          AND c.edge_bottom > {BOARD['edge_bottom']} AND c.edge_top < {BOARD['edge_top']}
          AND c.uuid NOT IN (SELECT uuid FROM main.climbs)
        """
    )[0][0]
    visible_before = q(
        """
        SELECT COUNT(DISTINCT c.uuid) FROM loc.climbs c
        JOIN loc.climb_stats cs ON cs.climb_uuid = c.uuid
        WHERE c.layout_id = 1 AND c.is_listed = 1 AND c.frames_count = 1
          AND cs.ascensionist_count > 0
        """
    )[0][0]
    visible_after = q(
        """
        SELECT COUNT(DISTINCT c.uuid) FROM main.climbs c
        JOIN main.climb_stats cs ON cs.climb_uuid = c.uuid
        WHERE c.layout_id = 1 AND c.is_listed = 1 AND c.frames_count = 1
          AND cs.ascensionist_count > 0
        """
    )[0][0]
    con.execute("DETACH DATABASE loc")

    top40 = q(SEARCH_SQL, (40, 5))
    report = {
        "size_bytes": os.path.getsize(out),
        "discovery_visible_before": visible_before,
        "discovery_visible_after": visible_after,
        "board_fit_climbs_lost_vs_local": lost,
        "climbs_without_stats": no_stats,
        "top5_popularity_40deg": [list(r) for r in top40],
        "angles": [r[0] for r in q("SELECT DISTINCT angle FROM climb_stats ORDER BY 1")],
        "meta": dict(q("SELECT key, value FROM climbritz_db_meta")),
        "problems": problems,
    }
    con.close()
    return report


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--local", required=True, help="current BoardLib kilter.db")
    ap.add_argument("--out", required=True, help="output DB path")
    ap.add_argument("--snapshot", help="Boardsesh kilter/1 .db (downloaded if omitted)")
    ap.add_argument("--download-dir", default="data", help="where to store the snapshot")
    ap.add_argument("--min-ascents", type=int, default=1)
    ap.add_argument("--keep-uuids", help="file with uuids to keep regardless of filters")
    ap.add_argument("--force", action="store_true", help="overwrite --out")
    args = ap.parse_args()

    if not args.snapshot:
        args.snapshot, _ = download_snapshot(args.download_dir)

    t0 = time.time()
    summary = build(args)
    report = verify(args.out, args.local)
    report["build"] = summary
    report["seconds"] = round(time.time() - t0, 1)
    report_path = str(args.out) + ".report.json"
    Path(report_path).write_text(json.dumps(report, indent=2, ensure_ascii=False))
    log(f"report: {report_path}")
    print(json.dumps({k: v for k, v in report.items() if k != "meta"}, indent=2,
                     ensure_ascii=False))
    if report["problems"]:
        log("VERIFY FAILED: " + "; ".join(report["problems"]))
        sys.exit(1)
    log(f"OK — {report['size_bytes'] / 1e6:.1f} MB")


if __name__ == "__main__":
    main()

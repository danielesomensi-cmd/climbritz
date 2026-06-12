"""
Read-only service for querying the BoardLib Kilter Board database.

Uses raw sqlite3 (not SQLAlchemy) because:
- The DB is read-only (we never write to it)
- The schema is managed by BoardLib, not us
- Zero ORM overhead for simple lookups
"""

import sqlite3
from contextlib import contextmanager

from app.core.config import get_settings
from app.utils.kilter_parser import parse_layout


@contextmanager
def _get_connection():
    """Open a read-only connection to the BoardLib database."""
    settings = get_settings()
    conn = sqlite3.connect(settings.boardlib_db_path)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


SORT_OPTIONS: dict[str, str] = {
    "popularity": "cs.ascensionist_count DESC",
    "quality": "cs.quality_average DESC, cs.ascensionist_count DESC",
    "grade_asc": "cs.display_difficulty ASC, cs.ascensionist_count DESC",
    "grade_desc": "cs.display_difficulty DESC, cs.ascensionist_count DESC",
}


def _build_search_filters(
    query: str | None,
    angle: int | None,
    grade_min: int | None,
    grade_max: int | None,
    min_ascents: int | None,
    min_quality: float | None,
    moves: str | None,
    benchmark: bool = False,
    nomatch: bool = False,
    include_uuids: list[str] | None = None,
    exclude_uuids: list[str] | None = None,
) -> tuple[str, list]:
    """Build the WHERE-clause fragment + params shared by ``search_climbs``
    and ``count_matching_climbs``. Returned ``where_sql`` starts with
    ``WHERE`` and assumes the caller's FROM includes ``climbs c`` aliased
    and a JOIN to ``climb_stats cs``. B020.

    The animated-sequence exclusion (``frames_count = 1``) is part of the
    shared base — circuits never appear in either count or list.

    A021: ``include_uuids`` / ``exclude_uuids`` back the ``done_filter``
    and ``project_filter`` chips on Discovery. The user's logs and
    project flags live in the app DB (different SQLite file from
    BoardLib), so the API layer pre-fetches matching uuids and passes
    them in for inclusion/exclusion at the SQL level.

    A022: ``benchmark=True`` restricts results to climbs flagged as a
    benchmark *at the joined angle* — ``benchmark_difficulty`` lives on
    ``climb_stats`` keyed by (climb_uuid, angle), so the flag is
    angle-specific by DB design (Phase 0.5 verified: 93% of benchmark
    climbs are validated at ≤3 angles, and a climb's grade itself varies
    per angle). Since Discovery always sends ``angle``, this naturally
    means "benchmark at the currently selected angle".

    A029: ``nomatch=True`` restricts results to climbs with the setter's
    "no matching" rule (``climbs.is_nomatch``, climb-level — audit D019:
    structured flag set by the official app's toggle, authoritative; no
    description-text heuristics). False (default) applies no filter.
    """
    where_sql = """
        WHERE c.layout_id = 1
          AND c.is_listed = 1
          AND c.frames_count = 1
          AND cs.ascensionist_count > 0
    """
    params: list = []

    if query:
        where_sql += " AND c.name LIKE ?"
        params.append(f"%{query}%")

    if angle is not None:
        where_sql += " AND cs.angle = ?"
        params.append(angle)

    if grade_min is not None:
        where_sql += " AND CAST(ROUND(cs.display_difficulty) AS INT) >= ?"
        params.append(grade_min)

    if grade_max is not None:
        where_sql += " AND CAST(ROUND(cs.display_difficulty) AS INT) <= ?"
        params.append(grade_max)

    if min_ascents is not None:
        where_sql += " AND cs.ascensionist_count >= ?"
        params.append(min_ascents)

    if min_quality is not None:
        where_sql += " AND cs.quality_average >= ?"
        params.append(min_quality)

    # A022 — benchmark filter. The cs join is already constrained to the
    # selected angle (when provided), so the NULL check is angle-specific.
    if benchmark:
        where_sql += " AND cs.benchmark_difficulty IS NOT NULL"

    # A029 — "no matching" filter. Climb-level flag (not per-angle).
    if nomatch:
        where_sql += " AND c.is_nomatch = 1"

    # A019 — moves filter. Counts cyan/middle holds (role 13) by counting
    # 'r13' substrings in the frames blob: each occurrence is 3 chars, so
    # (LENGTH(frames) - LENGTH(REPLACE(frames, 'r13', ''))) / 3 is the
    # middle-hold count. Add 2 (one start, one finish) for total moves.
    # The substring trick is safe because layout_id=1 restricts roles to
    # {12,13,14,15} (2-digit), so 'r13' can never collide with a longer
    # role like 'r130'. If layout filter is ever relaxed, revisit.
    if moves and moves != "any":
        move_expr = "((LENGTH(c.frames) - LENGTH(REPLACE(c.frames, 'r13', ''))) / 3 + 2)"
        if moves == "le5":
            where_sql += f" AND {move_expr} <= 5"
        elif moves == "6-7":
            where_sql += f" AND {move_expr} BETWEEN 6 AND 7"
        elif moves == "8-10":
            where_sql += f" AND {move_expr} BETWEEN 8 AND 10"
        elif moves == "gt10":
            where_sql += f" AND {move_expr} > 10"

    # A021 include/exclude lists. include_uuids=[] short-circuits to zero
    # results (the user has e.g. done_filter=only but no logged climbs).
    if include_uuids is not None:
        if len(include_uuids) == 0:
            where_sql += " AND 1 = 0"
        else:
            placeholders = ",".join("?" for _ in include_uuids)
            where_sql += f" AND c.uuid IN ({placeholders})"
            params.extend(include_uuids)
    if exclude_uuids:
        placeholders = ",".join("?" for _ in exclude_uuids)
        where_sql += f" AND c.uuid NOT IN ({placeholders})"
        params.extend(exclude_uuids)

    return where_sql, params


def search_climbs(
    query: str | None = None,
    angle: int | None = None,
    grade_min: int | None = None,
    grade_max: int | None = None,
    min_ascents: int | None = None,
    min_quality: float | None = None,
    moves: str | None = None,
    benchmark: bool = False,
    nomatch: bool = False,
    sort: str = "popularity",
    limit: int = 500,
    include_uuids: list[str] | None = None,
    exclude_uuids: list[str] | None = None,
) -> list[dict]:
    """Search/browse climbs. Autocomplete-friendly when `query` is provided,
    pure browse-by-filter when it's None or empty.

    Filters: layout_id=1 (Kilter Original), is_listed=1, frames_count=1,
    ascensionist_count > 0.

    Args:
        query: Optional search string (matched with LIKE %query%). If None
               or empty, no name filter is applied — useful for browsing
               with grade/angle/ascents filters alone.
        angle: Optional wall angle filter.
        grade_min: Minimum numeric difficulty (inclusive, e.g. 16 for 6a/V3).
        grade_max: Maximum numeric difficulty (inclusive).
        min_ascents: Minimum ascensionist count.
        min_quality: Minimum quality average (0–5 scale).
        moves: Optional move-count bucket (A019). One of "le5", "6-7",
               "8-10", "gt10". "any" or None means no move filter.
        benchmark: When True, only climbs flagged as a benchmark at the
               joined angle (A022). False (default) applies no benchmark
               filter.
        nomatch: When True, only climbs with the setter's "no matching"
               rule (A029, ``climbs.is_nomatch``). False (default)
               applies no filter.
        sort: One of "popularity", "quality", "grade_asc", "grade_desc".
              Defaults to "popularity". Unknown values fall back to popularity.
        limit: Max results to return. Default 500 (B020). The API endpoint
               clamps this to ≤ 500; the service layer trusts the caller.

    Returns:
        List of dicts with: uuid, name, setter, grade, angle,
        ascensionist_count, quality_average.
    """
    where_sql, params = _build_search_filters(
        query=query,
        angle=angle,
        grade_min=grade_min,
        grade_max=grade_max,
        min_ascents=min_ascents,
        min_quality=min_quality,
        moves=moves,
        benchmark=benchmark,
        nomatch=nomatch,
        include_uuids=include_uuids,
        exclude_uuids=exclude_uuids,
    )

    # Whitelist sort to prevent SQL injection. Unknown → popularity.
    order_clause = SORT_OPTIONS.get(sort, SORT_OPTIONS["popularity"])

    sql = f"""
        SELECT c.uuid, c.name, c.setter_username, c.is_nomatch,
               cs.angle, cs.display_difficulty, cs.ascensionist_count,
               cs.quality_average,
               dg.boulder_name
        FROM climbs c
        JOIN climb_stats cs ON c.uuid = cs.climb_uuid
        JOIN difficulty_grades dg
            ON CAST(ROUND(cs.display_difficulty) AS INT) = dg.difficulty
        {where_sql}
        ORDER BY {order_clause} LIMIT ?
    """
    params.append(limit)

    with _get_connection() as conn:
        rows = conn.execute(sql, params).fetchall()

    return [
        {
            "uuid": row["uuid"],
            "name": row["name"],
            "setter": row["setter_username"],
            "grade": row["boulder_name"],
            "angle": row["angle"],
            "ascensionist_count": row["ascensionist_count"],
            "quality_average": round(row["quality_average"], 2),
            "is_nomatch": bool(row["is_nomatch"]),
        }
        for row in rows
    ]


def count_matching_climbs(
    query: str | None = None,
    angle: int | None = None,
    grade_min: int | None = None,
    grade_max: int | None = None,
    min_ascents: int | None = None,
    min_quality: float | None = None,
    moves: str | None = None,
    benchmark: bool = False,
    nomatch: bool = False,
    include_uuids: list[str] | None = None,
    exclude_uuids: list[str] | None = None,
) -> int:
    """Count climbs matching the same filter set as ``search_climbs``,
    ignoring sort/limit. Backs the ``total_count`` field in the search
    response envelope (B020).

    The COUNT query omits the ``difficulty_grades`` join — that's a
    projection-only join (for ``boulder_name``), not a filter. Dropping it
    saves work on broad searches where the candidate set is large.
    """
    where_sql, params = _build_search_filters(
        query=query,
        angle=angle,
        grade_min=grade_min,
        grade_max=grade_max,
        min_ascents=min_ascents,
        min_quality=min_quality,
        moves=moves,
        benchmark=benchmark,
        nomatch=nomatch,
        include_uuids=include_uuids,
        exclude_uuids=exclude_uuids,
    )

    sql = f"""
        SELECT COUNT(*)
        FROM climbs c
        JOIN climb_stats cs ON c.uuid = cs.climb_uuid
        {where_sql}
    """

    with _get_connection() as conn:
        return conn.execute(sql, params).fetchone()[0]


def get_climb_meta(climb_uuid: str) -> dict | None:
    """Lightweight metadata lookup. Used by POST /api/logs (A021) to
    reject animated sequences (frames_count > 1) before persisting a
    log that the user could never re-discover via search.

    Returns ``{frames_count, is_listed, layout_id}`` or ``None`` when the
    climb_uuid doesn't exist in BoardLib.
    """
    with _get_connection() as conn:
        row = conn.execute(
            "SELECT frames_count, is_listed, layout_id "
            "FROM climbs WHERE uuid = ?",
            (climb_uuid,),
        ).fetchone()
        if row is None:
            return None
        return {
            "frames_count": row["frames_count"],
            "is_listed": bool(row["is_listed"]),
            "layout_id": row["layout_id"],
        }


def get_climb(climb_uuid: str, angle: int | None = None) -> dict | None:
    """Get full climb detail including hold positions.

    Args:
        climb_uuid: The climb UUID.
        angle: Optional angle to filter stats. If None, returns stats
               for the most popular angle.

    Returns:
        Dict with climb data including holds with x/y positions,
        or None if not found.
    """
    with _get_connection() as conn:
        # Fetch climb base data
        climb_row = conn.execute(
            "SELECT uuid, name, setter_username, description, frames, "
            "layout_id, is_nomatch "
            "FROM climbs WHERE uuid = ? AND is_listed = 1",
            (climb_uuid,),
        ).fetchone()

        if climb_row is None:
            return None

        # Fetch stats (optionally filtered by angle)
        if angle is not None:
            stats_sql = """
                SELECT cs.angle, cs.display_difficulty, cs.ascensionist_count,
                       cs.quality_average, dg.boulder_name
                FROM climb_stats cs
                JOIN difficulty_grades dg
                    ON CAST(ROUND(cs.display_difficulty) AS INT) = dg.difficulty
                WHERE cs.climb_uuid = ? AND cs.angle = ?
            """
            stats_rows = conn.execute(stats_sql, (climb_uuid, angle)).fetchall()
        else:
            stats_sql = """
                SELECT cs.angle, cs.display_difficulty, cs.ascensionist_count,
                       cs.quality_average, dg.boulder_name
                FROM climb_stats cs
                JOIN difficulty_grades dg
                    ON CAST(ROUND(cs.display_difficulty) AS INT) = dg.difficulty
                WHERE cs.climb_uuid = ?
                ORDER BY cs.ascensionist_count DESC
            """
            stats_rows = conn.execute(stats_sql, (climb_uuid,)).fetchall()

        if not stats_rows:
            return None

        # Parse holds from layout string
        holds = parse_layout(climb_row["frames"])

        # Fetch x/y positions for all placements
        placement_ids = [h["placement_id"] for h in holds]
        if placement_ids:
            placeholders = ",".join("?" for _ in placement_ids)
            pos_rows = conn.execute(
                f"""
                SELECT p.id AS placement_id, p.set_id, h.x, h.y
                FROM placements p
                JOIN holes h ON p.hole_id = h.id
                WHERE p.id IN ({placeholders})
                """,
                placement_ids,
            ).fetchall()
            pos_map = {
                row["placement_id"]: (row["x"], row["y"], row["set_id"])
                for row in pos_rows
            }
        else:
            pos_map = {}

        # Enrich holds with positions + set_id (so the frontend can render
        # small screw-on footholds at a different size than bolt-on handholds)
        enriched_holds = []
        for h in holds:
            pos = pos_map.get(h["placement_id"])
            enriched_holds.append({
                "placement_id": h["placement_id"],
                "role": h["role"],
                "x": pos[0] if pos else None,
                "y": pos[1] if pos else None,
                "set_id": pos[2] if pos else None,
            })

        # Build stats list
        stats = [
            {
                "angle": row["angle"],
                "grade": row["boulder_name"],
                "difficulty": round(row["display_difficulty"], 2),
                "ascensionist_count": row["ascensionist_count"],
                "quality_average": round(row["quality_average"], 2),
            }
            for row in stats_rows
        ]

        return {
            "uuid": climb_row["uuid"],
            "name": climb_row["name"],
            "setter": climb_row["setter_username"],
            "description": climb_row["description"],
            "is_nomatch": bool(climb_row["is_nomatch"]),
            "holds": enriched_holds,
            "stats": stats,
        }


def get_holds_for_climbs(uuids: list[str]) -> dict[str, list[dict]]:
    """A026 — bulk-fetch parsed holds + positions for many climbs at once.

    Used by the problem generator to build a swap-candidate pool. Two
    queries total (frames for all uuids, then x/y for the union of their
    placements), regardless of pool size.

    Returns ``{uuid: [{placement_id, role, x, y}, ...]}``. Roles are the
    human-readable strings from ``kilter_parser`` (start/middle/finish/
    foot_only). Missing positions surface as ``None`` (defensive — every
    layout-1 placement has a hole).
    """
    if not uuids:
        return {}

    with _get_connection() as conn:
        placeholders = ",".join("?" for _ in uuids)
        climb_rows = conn.execute(
            f"SELECT uuid, frames FROM climbs WHERE uuid IN ({placeholders})",
            uuids,
        ).fetchall()
        parsed = {row["uuid"]: parse_layout(row["frames"]) for row in climb_rows}

        all_pids = {
            h["placement_id"] for holds in parsed.values() for h in holds
        }
        pos_map: dict[int, tuple[int, int]] = {}
        if all_pids:
            pid_list = list(all_pids)
            ph = ",".join("?" for _ in pid_list)
            for row in conn.execute(
                f"""
                SELECT p.id AS placement_id, h.x, h.y
                FROM placements p JOIN holes h ON p.hole_id = h.id
                WHERE p.id IN ({ph})
                """,
                pid_list,
            ):
                pos_map[row["placement_id"]] = (row["x"], row["y"])

    result: dict[str, list[dict]] = {}
    for uuid, holds in parsed.items():
        enriched = []
        for h in holds:
            pos = pos_map.get(h["placement_id"])
            enriched.append({
                "placement_id": h["placement_id"],
                "role": h["role"],
                "x": pos[0] if pos else None,
                "y": pos[1] if pos else None,
            })
        result[uuid] = enriched
    return result


def get_db_stats() -> dict:
    """Quick stats about the BoardLib database. Useful for health checks."""
    with _get_connection() as conn:
        total = conn.execute("SELECT COUNT(*) FROM climbs").fetchone()[0]
        listed = conn.execute(
            "SELECT COUNT(*) FROM climbs WHERE is_listed = 1"
        ).fetchone()[0]
        angles = conn.execute(
            "SELECT DISTINCT angle FROM climb_stats ORDER BY angle"
        ).fetchall()
        grade_range = conn.execute(
            "SELECT MIN(difficulty), MAX(difficulty) "
            "FROM difficulty_grades WHERE is_listed = 1"
        ).fetchone()

        return {
            "total_climbs": total,
            "listed_climbs": listed,
            "available_angles": [row[0] for row in angles],
            "grade_range": {
                "min_difficulty": grade_range[0],
                "max_difficulty": grade_range[1],
            },
        }

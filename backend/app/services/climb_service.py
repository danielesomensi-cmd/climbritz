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


def search_climbs(
    query: str | None = None,
    angle: int | None = None,
    grade_min: int | None = None,
    grade_max: int | None = None,
    min_ascents: int | None = None,
    min_quality: float | None = None,
    sort: str = "popularity",
    limit: int = 10,
) -> list[dict]:
    """Search/browse climbs. Autocomplete-friendly when `query` is provided,
    pure browse-by-filter when it's None or empty.

    Filters: layout_id=1 (Kilter Original), is_listed=1, ascensionist_count > 0.

    Args:
        query: Optional search string (matched with LIKE %query%). If None
               or empty, no name filter is applied — useful for browsing
               with grade/angle/ascents filters alone.
        angle: Optional wall angle filter.
        grade_min: Minimum numeric difficulty (inclusive, e.g. 16 for 6a/V3).
        grade_max: Maximum numeric difficulty (inclusive).
        min_ascents: Minimum ascensionist count.
        min_quality: Minimum quality average (0–5 scale).
        sort: One of "popularity", "quality", "grade_asc", "grade_desc".
              Defaults to "popularity". Unknown values fall back to popularity.
        limit: Max results to return (default 10).

    Returns:
        List of dicts with: uuid, name, setter, grade, angle,
        ascensionist_count, quality_average.
    """
    sql = """
        SELECT c.uuid, c.name, c.setter_username,
               cs.angle, cs.display_difficulty, cs.ascensionist_count,
               cs.quality_average,
               dg.boulder_name
        FROM climbs c
        JOIN climb_stats cs ON c.uuid = cs.climb_uuid
        JOIN difficulty_grades dg
            ON CAST(ROUND(cs.display_difficulty) AS INT) = dg.difficulty
        WHERE c.layout_id = 1
          AND c.is_listed = 1
          AND cs.ascensionist_count > 0
    """
    params: list = []

    if query:
        sql += " AND c.name LIKE ?"
        params.append(f"%{query}%")

    if angle is not None:
        sql += " AND cs.angle = ?"
        params.append(angle)

    if grade_min is not None:
        sql += " AND CAST(ROUND(cs.display_difficulty) AS INT) >= ?"
        params.append(grade_min)

    if grade_max is not None:
        sql += " AND CAST(ROUND(cs.display_difficulty) AS INT) <= ?"
        params.append(grade_max)

    if min_ascents is not None:
        sql += " AND cs.ascensionist_count >= ?"
        params.append(min_ascents)

    if min_quality is not None:
        sql += " AND cs.quality_average >= ?"
        params.append(min_quality)

    # Whitelist sort to prevent SQL injection. Unknown → popularity.
    order_clause = SORT_OPTIONS.get(sort, SORT_OPTIONS["popularity"])
    sql += f" ORDER BY {order_clause} LIMIT ?"
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
        }
        for row in rows
    ]


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
            "SELECT uuid, name, setter_username, description, frames, layout_id "
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
            "holds": enriched_holds,
            "stats": stats,
        }


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

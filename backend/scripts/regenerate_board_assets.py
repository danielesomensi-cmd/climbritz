"""Regenerate the 12x12-with-kickboard board assets (B016 + A015).

Dumps:
  app/data/placements_12x12.json       — 513 placements (bolt-ons + screw-ons,
                                          y∈[0,156], with kickboard)
  app/data/leds_12x12.json             — 476 placement_id → LED position
                                          mappings for product_size_id=10.
                                          Used by A015 to drive BLE packets
                                          from climb detail data.
  public/holds/board_original_12x12.png — composite of bolt-on + screw-on
                                          product-size-10 PNGs

Run from repo root:
    cd backend && source venv/bin/activate && python scripts/regenerate_board_assets.py
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DB_PATH = REPO_ROOT / "backend" / "data" / "kilter.db"
IMG_DIR = REPO_ROOT / "backend" / "data" / "images" / "product_sizes_layouts_sets"

# 12x12 WITH kickboard (product_size_id=10)
# edge_left=0, edge_right=144, edge_bottom=0, edge_top=156
BOUNDS = {"x_min": 0, "x_max": 144, "y_min": 0, "y_max": 156}
LAYOUT_ID = 1

BOLT_PNG = IMG_DIR / "45-1.png"   # product_size 10, set 1 (Bolt Ons)
SCREW_PNG = IMG_DIR / "46-1.png"  # product_size 10, set 20 (Screw Ons)

JSON_OUT = REPO_ROOT / "app" / "data" / "placements_12x12.json"
LEDS_JSON_OUT = REPO_ROOT / "app" / "data" / "leds_12x12.json"
PNG_OUT = REPO_ROOT / "public" / "holds" / "board_original_12x12.png"

# product_size_id for the 12x12-with-kickboard board the LED packets target
PRODUCT_SIZE_ID = 10


def dump_placements() -> None:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row

    sql = """
        SELECT p.id AS placement_id, p.hole_id, p.set_id, s.name AS set_name,
               p.default_placement_role_id AS role_id, pr.name AS default_role,
               h.x, h.y, h.name AS hole_name
        FROM placements p
        JOIN holes h ON h.id = p.hole_id
        JOIN sets s ON s.id = p.set_id
        LEFT JOIN placement_roles pr
            ON pr.id = p.default_placement_role_id
        WHERE p.layout_id = ?
          AND p.set_id IN (1, 20)
          AND h.x BETWEEN ? AND ?
          AND h.y BETWEEN ? AND ?
        ORDER BY p.id
    """
    rows = conn.execute(
        sql,
        (LAYOUT_ID, BOUNDS["x_min"], BOUNDS["x_max"], BOUNDS["y_min"], BOUNDS["y_max"]),
    ).fetchall()
    conn.close()

    # BoardLib stores "foot" in the DB; our frontend expects "foot_only".
    role_rename = {"foot": "foot_only"}

    placements = [
        {
            "placement_id": r["placement_id"],
            "hole_id": r["hole_id"],
            "x": r["x"],
            "y": r["y"],
            "hole_name": r["hole_name"],
            "default_role": role_rename.get(r["default_role"], r["default_role"]),
            "set_name": r["set_name"],
            "set_id": r["set_id"],
            "role_id": r["role_id"],
        }
        for r in rows
    ]

    JSON_OUT.parent.mkdir(parents=True, exist_ok=True)
    JSON_OUT.write_text(json.dumps(placements, indent=2))
    by_set: dict[int, int] = {}
    for p in placements:
        by_set[p["set_id"]] = by_set.get(p["set_id"], 0) + 1
    print(f"[json] wrote {len(placements)} placements to {JSON_OUT}")
    print(f"[json]   by set_id: {by_set}")


def dump_leds() -> None:
    """Dump placement_id → LED position mapping for BLE packet generation.

    Joins placements → holes → leds to resolve the LED position for every
    placement on layout_id=1 / product_size_id=10. Placements without a
    corresponding LED (rare — some footholds on the kickboard border) are
    skipped so the frontend can treat the mapping as authoritative.
    """
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row

    sql = """
        SELECT p.id AS placement_id, l.position AS led_position
        FROM placements p
        JOIN leds l ON l.hole_id = p.hole_id
        WHERE p.layout_id = ?
          AND p.set_id IN (1, 20)
          AND l.product_size_id = ?
        ORDER BY p.id
    """
    rows = conn.execute(sql, (LAYOUT_ID, PRODUCT_SIZE_ID)).fetchall()
    conn.close()

    mapping = {str(r["placement_id"]): r["led_position"] for r in rows}

    LEDS_JSON_OUT.parent.mkdir(parents=True, exist_ok=True)
    LEDS_JSON_OUT.write_text(json.dumps(mapping, indent=2, sort_keys=True))
    print(f"[json] wrote {len(mapping)} placement→LED mappings to {LEDS_JSON_OUT}")


def composite_board_image() -> None:
    if not BOLT_PNG.exists() or not SCREW_PNG.exists():
        raise SystemExit(
            f"Missing source composites. Expected:\n  {BOLT_PNG}\n  {SCREW_PNG}"
        )
    bolt = Image.open(BOLT_PNG).convert("RGBA")
    screw = Image.open(SCREW_PNG).convert("RGBA")
    if bolt.size != screw.size:
        raise SystemExit(f"Size mismatch: bolt={bolt.size} screw={screw.size}")

    # The two BoardLib PNGs are flat renders with transparent backgrounds —
    # composite them on a black canvas (matching the app's dark theme) so the
    # holds pop against the panel.
    canvas = Image.new("RGBA", bolt.size, (17, 17, 17, 255))  # ~zinc-900
    canvas.alpha_composite(bolt)
    canvas.alpha_composite(screw)

    PNG_OUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(PNG_OUT, format="PNG", optimize=True)
    print(f"[png]  wrote {canvas.size} composite to {PNG_OUT}")


if __name__ == "__main__":
    dump_placements()
    dump_leds()
    composite_board_image()

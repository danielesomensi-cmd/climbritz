# HC-1 — Hold Inventory: Kilter Board Original 12x12 Square

> Generated: 5 April 2026
> Board: Kilter Board Original Layout (layout_id=1)
> Product size: 12x12 Square (product_size_id=27, bounds: x=[0,144], y=[12,156])

---

## Section 1: Image Download Results

### Status: RESOLVED

BoardLib's `boardlib images kilter` command fails — the old Aurora API domain (`api.kilterboardapp.com`) is dead (DNS NXDOMAIN). However, two open-source projects that pre-downloaded these images still serve them:

| Source | URL pattern | Format | Status |
|--------|-------------|--------|--------|
| **Climbdex** | `https://climbdex.com/board-images/kilter/{image_filename}` | PNG | Working |
| **Boardsesh** | `https://boardsesh.com/images/kilter/{image_filename}` (as .webp) | WebP | Working (308 redirect) |

**Downloaded:** All 31 composite board layout images from Climbdex → `data/images/product_sizes_layouts_sets/`

**12x12 Original images:**
- `77-1.png` — Bolt Ons (1080x1080 RGBA) — all 342 handholds + 6 foot Bolt Ons
- `78-1.png` — Screw Ons (1080x1080 RGBA) — 135 footholds

### Individual hold crops

Cropped 336 individual handhold images from composite `77-1.png` using DB coordinates:
- **Output:** `data/images/holds/{placement_id}.png` (336 files)
- **Size:** 120x120px each (60px radius crop around hold center)
- **Quality:** Center hold clearly visible; neighboring holds partially visible at edges (expected — holds are packed at 4-unit grid spacing = 30px apart in the image)
- **Mapping:** image filename = `{placement_id}.png` → direct lookup in DB

### Why BoardLib failed (for reference)

- `api.kilterboardapp.com` → DNS NXDOMAIN (Aurora shut down after Kilter Grips cease-and-desist, March 2026)
- `kilterboard.io/img/...` → returns HTML (SPA, not images)
- BoardLib 0.15.1 hardcodes the dead domain. Issue #78 open, no fix.
- New Kilter infrastructure (`idp.kiltergrips.com`, `portal.kiltergrips.com`, `sync1.kiltergrips.com`) has no image-serving endpoint.

---

## Section 2: 12x12 Board Scope

### Total placements on 12x12 Original: **477**

| Category | Count | Set | Notes |
|----------|-------|-----|-------|
| Handholds (start/middle/finish) | 336 | Bolt Ons | Need classification |
| Footholds — Screw Ons | 135 | Screw Ons | All default role=foot. Do NOT need grip classification. |
| Footholds — Bolt Ons | 6 | Bolt Ons | Edge positions (x=0 or x=144, y=16-32). Default role=foot. |

### Breakdown by default role

| Role | Count | Color (LED) | Notes |
|------|-------|-------------|-------|
| middle | 226 | Cyan (#00FFFF) | Largest group |
| start | 108 | Green (#00FF00) | Bottom portion of board |
| finish | 2 | Magenta (#FF00FF) | Top corners only: (0,152) and (144,152) |
| foot | 141 | Orange (#FFA500) | 135 Screw Ons + 6 edge Bolt Ons |

### Grid structure

- **37 distinct X positions:** 0, 4, 8, 12, ..., 140, 144 (uniform 4-unit spacing)
- **33 distinct Y positions:** 16, 20, 24, ..., 136, 144, 152 (mostly 4-unit spacing, with 8-unit gaps at y=136→144 and y=144→152)
- **Minimum grid spacing:** 4 units in both axes
- **All 477 hole positions are unique** (no duplicate hole_ids)

### Hold sets

| Set | ID | hsm | Count on 12x12 | Description |
|-----|----|-----|-----------------|-------------|
| Bolt Ons | 1 | 1 | 342 | Main handholds (336 hand + 6 foot) |
| Screw Ons | 20 | 2 | 135 | Small footholds only |

---

## Section 3: Handhold Count for Classification

### **336 handholds need grip-type classification**

All 336 are Bolt Ons (set_id=1) with default roles: start (108), middle (226), or finish (2).

The 141 foot-only placements (135 Screw Ons + 6 edge Bolt Ons) do NOT need classification — they are small jibs used only for feet.

### Note on "unique hold shapes"

The DB does not distinguish physical hold shapes — each placement has a unique `placement_id` and `hole_id`, but there's no "hold model" or "shape ID" field. Some positions on the board may have identical physical hold shapes (Kilter uses sets of the same mold), but this information isn't in the database.

**For classification: we classify each position independently.** Even if two positions have the same physical hold, orientation and context on the board may affect grip type.

---

## Section 4: Image-to-Hold Mapping

### Status: RESOLVED

**Mapping:** `placement_id` → `data/images/holds/{placement_id}.png`

Each of the 336 handhold images is named by its `placement_id` from the DB. To look up any hold:

```python
# Get hold image + metadata
placement_id = 1234
image_path = f"data/images/holds/{placement_id}.png"
# DB query: SELECT h.x, h.y, pr.name FROM placements p JOIN holes h ...
```

### How images were extracted

1. Downloaded composite layout image from Climbdex (`77-1.png`, 1080x1080 RGBA)
2. Image maps 1:1 to board coordinate space: x=[0,144] → px=[0,1080], y=[12,156] → py=[1080,0] (Y inverted)
3. Scale: 7.5 pixels per board unit
4. Cropped 120x120px region (60px radius) around each hold's center pixel
5. All 336 crops contain visible hold content (no empty crops)

---

## Section 5: Data for HC-2 (Board Map)

### Exported: `backend/data/12x12_placements.json`

Contains all 477 placements with fields:
```json
{
  "placement_id": 1379,
  "hole_id": 1200,
  "x": 8,
  "y": 152,
  "hole_name": "2,35",
  "default_role": "middle",
  "set_name": "Bolt Ons",
  "set_id": 1,
  "role_id": 13
}
```

### Grid summary for board map rendering

| Dimension | Value |
|-----------|-------|
| X range | 0 to 144 |
| Y range | 16 to 152 (handholds), 12 to 156 (board edges) |
| X positions | 37 (every 4 units) |
| Y positions | 33 |
| Total positions | 477 |
| Grid spacing | Uniform 4 units (with 8-unit gaps near top) |

### Special positions

| Position | Role | Notes |
|----------|------|-------|
| (0, 152) | finish | Top-left corner, placement_id=4699 |
| (144, 152) | finish | Top-right corner, placement_id=4756 |
| (0, 16-32) | foot | Left edge Bolt Ons, 3 positions |
| (144, 16-32) | foot | Right edge Bolt Ons, 3 positions |
| Bottom two rows (y=16, y=20) | mostly start | 108 start holds concentrated here |
| Top rows (y=148, y=152) | middle/finish | Reachable only at end of climb |

### LED mapping

4,969 LEDs mapped to holes within 12x12 bounds (multiple LEDs per hole for color channels). Every placement has LED coverage — BLE illumination will work for all holds.

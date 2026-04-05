# HC-1 — Hold Inventory: Kilter Board Original 12x12 Square

> Generated: 5 April 2026
> Board: Kilter Board Original Layout (layout_id=1)
> Product size: 12x12 Square (product_size_id=27, bounds: x=[0,144], y=[12,156])

---

## Section 1: Image Download Results

### Status: BLOCKED

BoardLib's `boardlib images kilter` command fails — the old Aurora API domain (`api.kilterboardapp.com`) is dead (DNS NXDOMAIN). Aurora shut down the server after Kilter Grips sent a cease-and-desist over the domain name (March 2026).

**What was tried:**
- `boardlib images kilter data/kilter.db data/images/` → DNS resolution failure
- Tested `api.kilterboardapp.com` → NXDOMAIN
- Tested `api.kilterboard.io` → NXDOMAIN
- Tested `https://kilterboard.io/img/product_sizes_layouts_sets/77-1.png` → returns HTML (SPA, not actual image)

**New infrastructure (from BoardLib issue #78):**
- Auth: `idp.kiltergrips.com`
- API: `portal.kiltergrips.com`
- Sync: `sync1.kiltergrips.com`
- No image-serving subdomain exists

**BoardLib version:** 0.15.1 (latest on PyPI as of April 2026) — still hardcodes `kilterboardapp.com`. Issue #78 open, no fix yet.

### Alternatives for HC-4 (AI classification)

| Option | Feasibility | Notes |
|--------|-------------|-------|
| **A. Daniele photographs holds in gym** | High | Take close-up photo of each hold. 336 holds, ~1-2 hours. Most reliable — actual hold appearance at the gym. |
| **B. Use composite board layout images** | Medium | Two images exist for 12x12 (Bolt Ons + Screw Ons) but the URLs return HTML. If we can source them from the Kilter native app assets, we could crop individual holds using known x/y coordinates. |
| **C. Wait for BoardLib fix** | Unknown | Issue #78 open. No ETA. |
| **D. Extract from Kilter native app APK** | Medium | New app (com.kiltergrips.kilter_board_app) likely bundles hold images. Requires APK extraction. |
| **E. AI classifies from board photo** | High | Take 1-2 photos of the full board → Gemini identifies hold types by position. Faster than individual photos but less precise. |

**Recommendation:** Option A (gym photos) is most reliable. Option E (full board photo + AI) is fastest. Can combine: start with E for a first pass, use A for validation of ambiguous holds.

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

### Current status: No individual hold images available

BoardLib's image system downloads **composite layout images** (`product_sizes_layouts_sets`), not individual hold photos. These show all holds of a set overlaid on the board outline — 31 images total across all board sizes.

For the 12x12 Original, two composite images exist:
- `product_sizes_layouts_sets/77-1.png` — Bolt Ons layout
- `product_sizes_layouts_sets/78-1.png` — Screw Ons layout

These URLs currently return HTML from kilterboard.io (not actual images).

### Path to individual hold images

**If composite images become available:**
Each hold's pixel position can be computed from its (x, y) DB coordinates mapped to image dimensions. This would allow automated cropping of individual holds.

**For HC-4 classification without images:**
- Option A: Daniele photographs each hold in gym → name files as `{placement_id}.jpg`
- Option E: Full board photos → Gemini classifies by position reference
- The `placement_id` is the canonical identifier linking DB data → image → classification

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

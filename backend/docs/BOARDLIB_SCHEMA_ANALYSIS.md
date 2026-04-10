# D005 — BoardLib Kilter Database Schema Analysis

> **Type:** Audit / Read-Only
> **Date:** 2026-04-01
> **Author:** Daniele Somensi + Claude Code
> **DB:** `backend/data/kilter.db` — downloaded via `boardlib database kilter`

---

## 1. Executive Summary

| Metric | Value |
|--------|-------|
| Total tables | 30 |
| Total climbs | 344,504 |
| Listed climbs | 251,895 (73%) |
| Climbs with stats | 348,028 rows (per-angle) |
| Distinct grades | 39 (V0–V22 / Font–10b+) |
| Hold positions (holes) | 3,294 |
| Placements | 3,773 |
| Beta video links | 32,139 (10,214 unique climbs, all Instagram) |
| Most popular angle | 40° (101,662 climb-angle pairs) |

**Key findings:**
- The `frames` column in `climbs` encodes the full hold layout as `p{placement_id}r{role_id}` tokens — this is the single most important field for coaching context.
- Hold x/y coordinates are absolute integers (not normalized). Board is roughly 260 units wide × 303 units tall.
- All 32k beta links point to Instagram. There are no embedded video files — only URLs + thumbnail images.
- 61% of listed climbs have no description. 24% have `NULL` angle.
- `difficulty_average` in `climb_stats` is a float; must cast to INT to join `difficulty_grades`.
- Many tables are empty in this snapshot (walls, users, circuits, tags, ascents, bids).

---

## 2. Full Table Inventory

| Table | Rows | Purpose | Status |
|-------|------|---------|--------|
| `climbs` | 344,504 | Core climb data — name, setter, layout, frames, grade | **Core** |
| `climb_stats` | 348,028 | Per-angle stats — ascents, quality, difficulty | **Core** |
| `difficulty_grades` | 39 | Grade lookup: difficulty int → Font/V name | **Core** |
| `placements` | 3,773 | placement_id → hole_id for each layout | **Core** |
| `holes` | 3,294 | hole_id → x, y coordinates on board | **Core** |
| `placement_roles` | 30 | role_id → Start/Middle/Finish/Foot + LED color | **Core** |
| `layouts` | 8 | Board layout definitions (Original, Homewall, etc.) | Reference |
| `products` | 7 | Board product families | Reference |
| `product_sizes` | 22 | Size variants per product (edge bounds) | Reference |
| `beta_links` | 32,139 | Instagram beta video URLs per climb | Useful |
| `climb_cache_fields` | 208,457 | Denormalized quality/difficulty per climb (no angle) | Secondary |
| `leds` | 7,828 | LED position index per product size + hole | LED only |
| `sets` | 11 | Hold set names (Bolt Ons, Mainline, etc.) | Reference |
| `product_sizes_layouts_sets` | 41 | Which sets are on which layout+size | Reference |
| `products_angles` | 56 | Valid angles per product | Reference |
| `walls_sets` | 0 | (empty) | Skip |
| `walls` | 0 | (empty — user walls) | Skip |
| `users` | 0 | (empty) | Skip |
| `circuits` | 0 | (empty) | Skip |
| `circuits_climbs` | 0 | (empty) | Skip |
| `ascents` | 0 | (empty) | Skip |
| `bids` | 0 | (empty) | Skip |
| `tags` | 0 | (empty) | Skip |
| `user_permissions` | 0 | (empty) | Skip |
| `user_syncs` | 0 | (empty) | Skip |
| `climb_random_positions` | 0 | (empty) | Skip |
| `attempts` | 38 | (minimal — not useful) | Skip |
| `kits` | 100 | LED kit configs | LED only |
| `shared_syncs` | 17 | Sync metadata | Skip |
| `android_metadata` | 1 | Android DB locale metadata | Skip |

---

## 3. Core Tables — Detail

### 3.1 `climbs`

**Schema:**

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `uuid` | TEXT | NOT NULL | PK — used as climb identifier everywhere |
| `layout_id` | INT UNSIGNED | NOT NULL | FK → `layouts.id` |
| `setter_id` | INT UNSIGNED | NOT NULL | Setter user ID |
| `setter_username` | TEXT | NOT NULL | Setter display name |
| `name` | TEXT | NOT NULL | Climb name |
| `description` | TEXT | NOT NULL (default '') | Often empty (61% of listed climbs) |
| `hsm` | INT UNSIGNED | NOT NULL | Hold set mask bitmask |
| `edge_left/right/bottom/top` | INT UNSIGNED | NOT NULL | Bounding box on the board |
| `angle` | INT | **NULLABLE** | Set angle (24% of listed climbs are NULL) |
| `frames_count` | INT UNSIGNED | NOT NULL | Number of frames (almost always 1) |
| `frames_pace` | INT UNSIGNED | NOT NULL | Animation pace |
| `frames` | TEXT | NOT NULL | **The hold layout string** — see below |
| `is_draft` | BOOLEAN | NOT NULL | All = 0 in dataset |
| `is_listed` | BOOLEAN | NOT NULL | 251,895 of 344,504 are listed |
| `created_at` | TEXT | NOT NULL | ISO timestamp |
| `is_nomatch` | BOOLEAN | NOT NULL | 73,864 flagged — likely auto-gen or duplicates |

**The `frames` string** is the critical field. Format: `p{placement_id}r{role_id}` tokens concatenated with no delimiter:

```
p1145r12p1146r12p1149r13p1186r13p1392r14p1456r15
 ^^^^     = placement_id (→ holes.x, holes.y)
       ^^ = role_id (12=Start, 13=Middle, 14=Finish, 15=Foot)
```

**Filter recommendations:**
- `is_listed = 1` — removes 27% garbage/unlisted
- `is_nomatch = 0` — removes another ~29k auto-generated
- Combined filter: `is_listed=1 AND is_nomatch=0` → ~178k quality climbs

**Sample row:**

```
uuid:     002047402B6941CEA5ED7BB09FBFE14D
name:     4/26 Harder Than It Should Be
setter:   kilterjackie
layout:   1 (Kilter Board Original)
frames:   p1145r12p1146r12p1149r13...p1392r14...
listed:   0 (not listed — example only)
```

---

### 3.2 `climb_stats`

**Schema:**

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `climb_uuid` | TEXT | NOT NULL | PK (composite with angle) → `climbs.uuid` |
| `angle` | INT UNSIGNED | NOT NULL | PK — 0 to 70, step 5 |
| `display_difficulty` | FLOAT | NOT NULL | Rounded display grade (used for UI) |
| `benchmark_difficulty` | FLOAT | **NULLABLE** | Benchmark grade (often NULL) |
| `ascensionist_count` | INT UNSIGNED | NOT NULL | Number of logged ascents |
| `difficulty_average` | FLOAT | NOT NULL | Mean difficulty from user ratings |
| `quality_average` | FLOAT | NOT NULL | Mean quality 1.0–3.0 |
| `fa_username` | TEXT | NOT NULL | First ascensionist username |
| `fa_at` | TEXT | NOT NULL | First ascent timestamp |

**Grade join:** `CAST(difficulty_average AS INTEGER)` → `difficulty_grades.difficulty`

**Available angles:** 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70

**Climbs per angle (top 5):**
| Angle | Climb-stat entries |
|-------|--------------------|
| 40° | 101,662 |
| 30° | 50,672 |
| 45° | 47,698 |
| 50° | 37,344 |
| 20° | 21,823 |

**Quality range:** 1.0 – 3.0 (avg ~2.79). `quality_average >= 2.5` gives 197,580 entries; `>= 3.0` gives 48,179.

---

### 3.3 `difficulty_grades`

**Schema:** `difficulty` (INT PK), `boulder_name` (TEXT), `route_name` (TEXT), `is_listed` (BOOLEAN)

The `boulder_name` column combines Font and V-grade: `"7a/V6"`, `"6c+/V5"`, etc.
The `is_listed` flag — grades 10–33 (V0–V16) are listed.

**Full grade table (listed only):**

| difficulty | boulder_name | route_name |
|-----------|-------------|------------|
| 10 | 4a/V0 | 5b/5.9 |
| 11 | 4b/V0 | 5c/5.10a |
| 12 | 4c/V0 | 6a/5.10b |
| 13 | 5a/V1 | 6a+/5.10c |
| 14 | 5b/V1 | 6b/5.10d |
| 15 | 5c/V2 | 6b+/5.11a |
| 16 | 6a/V3 | 6c/5.11b |
| 17 | 6a+/V3 | 6c+/5.11c |
| 18 | 6b/V4 | 7a/5.11d |
| 19 | 6b+/V4 | 7a+/5.12a |
| 20 | 6c/V5 | 7b/5.12b |
| 21 | 6c+/V5 | 7b+/5.12c |
| 22 | 7a/V6 | 7c/5.12d |
| 23 | 7a+/V7 | 7c+/5.13a |
| 24 | 7b/V8 | 8a/5.13b |
| 25 | 7b+/V8 | 8a+/5.13c |
| 26 | 7c/V9 | 8b/5.13d |
| 27 | 7c+/V10 | 8b+/5.14a |
| 28 | 8a/V11 | 8c/5.14b |
| 29 | 8a+/V12 | 8c+/5.14c |
| 30 | 8b/V13 | 9a/5.14d |
| 31 | 8b+/V14 | 9a+/5.15a |
| 32 | 8c/V15 | 9b/5.15b |
| 33 | 8c+/V16 | 9b+/5.15c |

---

### 3.4 `placements`

**Schema:**

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT UNSIGNED | PK — this is the `{placement_id}` in the frames string |
| `layout_id` | INT UNSIGNED | FK → `layouts.id` |
| `hole_id` | INT UNSIGNED | FK → `holes.id` |
| `set_id` | INT UNSIGNED | FK → `sets.id` (hold set: Bolt Ons, Mainline…) |
| `default_placement_role_id` | INT UNSIGNED | NULLABLE — default role (ignore: role comes from frames) |

3,773 placements for 8 layouts. The `id` in this table is the `p{id}` token in the frames string. The role is **always** taken from the frames token `r{role_id}`, not from `default_placement_role_id`.

---

### 3.5 `holes`

**Schema:**

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT UNSIGNED | PK |
| `product_id` | INT UNSIGNED | FK → `products.id` |
| `name` | TEXT | Human label e.g. `"35,KB1"`, `"34,KB2"` |
| `x` | INT | X coordinate (board units) |
| `y` | INT | Y coordinate (board units) |
| `mirrored_hole_id` | INT UNSIGNED | NULLABLE — mirror counterpart |
| `mirror_group` | INT UNSIGNED | Mirror group ID |

3,294 holes. Coordinate ranges: x ∈ [-56, 204], y ∈ [-12, 291].

The coordinate system uses absolute board units (not pixels, not normalized 0–1). Higher y = higher on the board. Hole names encode grid position (e.g., `"35,KB1"` = row 35, column KB1).

**Board area:** roughly 260 units wide × 303 units tall per the hole extents.

---

### 3.6 `placement_roles`

30 rows covering 7 products. For **product 1** (Kilter Board Original) and **product 7** (Kilter Board Homewall):

| id | name | full_name | led_color | screen_color |
|----|------|-----------|-----------|--------------|
| 12 | start | Start | 00FF00 | 00DD00 |
| 13 | middle | Middle | 00FFFF | 00FFFF |
| 14 | finish | Finish | FF00FF | FF00FF |
| 15 | foot | Foot Only | FFA500 | FFA500 |

These are the role IDs used in the `frames` string. Role 12 = Start (green), 13 = Middle (cyan), 14 = Finish (magenta), 15 = Foot Only (orange).

Product 6 (Tycho) uses a different color scheme (cyan, magenta, yellow, green, red, blue — roles 36–41).

---

### 3.7 `layouts`

8 rows — board configuration variants:

| id | product_id | name | is_mirrored | is_listed | password |
|----|-----------|------|-------------|-----------|----------|
| 1 | 1 | Kilter Board Original | 0 | 1 | (none) |
| 2 | 2 | JUUL | 0 | 1 | freedom |
| 3 | 3 | Standard Medium | 0 | 0 | sales |
| 4 | 4 | BKBBoard Level 1 | 0 | 0 | BKBlove |
| 5 | 5 | Spire | 0 | 0 | SPIREDOJO |
| 6 | 6 | Tycho Complete | 0 | 0 | explore |
| 7 | 6 | Tycho 2020 | 0 | 1 | explore |
| 8 | 7 | Kilter Board Homewall | 0 | 1 | (none) |

The vast majority of climbs use `layout_id = 1` (Kilter Board Original).

---

### 3.8 `leds`

7,828 rows mapping `product_size_id → hole_id → position` (LED strip index). Useful only for driving actual LED hardware; not needed for coaching or analysis.

---

### 3.9 `beta_links`

**Schema:** `climb_uuid`, `link` (PK composite), `foreign_username`, `angle` (NULLABLE), `thumbnail`, `is_listed`, `created_at`

- 32,139 total rows, 30,929 listed
- 10,214 distinct climbs have at least one beta link
- All links are Instagram URLs: `https://www.instagram.com/p/{code}/`
- Thumbnails: `https://api.kilterboardapp.com/img/beta_link_thumbnails/{code}.jpg`
- Some beta links include angle, most don't

**Example:**
```
climb: D0E5387D5B974D38B4E93FC4DFD61EF6 (Floats Your Boat)
link:  https://www.instagram.com/p/B3Pi401jD8z/
thumb: https://api.kilterboardapp.com/img/beta_link_thumbnails/B3Pi401jD8z.jpg
```

---

### 3.10 `products`

7 products in the database:

| id | name | is_listed |
|----|------|-----------|
| 1 | Kilter Board Original | 1 |
| 2 | JUUL | 1 |
| 3 | Demo Board | 0 |
| 4 | BKB Board | 0 |
| 5 | Spire | 0 |
| 6 | Tycho | 1 |
| 7 | Kilter Board Homewall | 1 |

For Kilter-Up, products 1 and 7 are the relevant boards.

---

## 4. Entity Relationship Map

```
products (id)
  └─ layouts (product_id → products.id)
       └─ climbs (layout_id → layouts.id)
            ├─ frames string: "p{placement_id}r{role_id}..."
            └─ climb_stats (climb_uuid → climbs.uuid)
                 ├─ angle (5° increments, 0–70)
                 ├─ difficulty_average → difficulty_grades.difficulty
                 └─ quality_average, ascensionist_count, fa_username

placement_roles (id) ← role_id in frames string
placements (id) ← placement_id in frames string
  ├─ layout_id → layouts.id
  ├─ hole_id → holes.id
  └─ set_id → sets.id

holes (id)
  ├─ product_id → products.id
  ├─ x, y (board coordinates)
  └─ mirrored_hole_id (self-reference)

leds (id)
  ├─ product_size_id → product_sizes.id
  └─ hole_id → holes.id

beta_links (climb_uuid, link)
  └─ climb_uuid → climbs.uuid

product_sizes (id)
  ├─ product_id → products.id
  └─ edge_left/right/bottom/top (size bounds)
```

**Verified:** The frames string `p{id}r{role}` uses `placements.id` directly (NOT a named column, the actual integer PK). This was confirmed by resolving `p1145r12` → `placements.id=1145` → `holes.id=1294` → `x=40, y=40` + `placement_roles.id=12` → `name="start"`.

---

## 5. Data Quality Report

| Field | Listed climbs | Issue |
|-------|--------------|-------|
| `frames` empty | 0 / 251,895 | ✅ All listed climbs have hold data |
| `description` empty | 153,779 / 251,895 (61%) | ⚠️ Most climbs lack description |
| `angle` NULL | 60,905 / 251,895 (24%) | ⚠️ ~1 in 4 has no angle set |
| `benchmark_difficulty` NULL | Very common | ⚠️ Use `difficulty_average` instead |
| `quality_average` range | 1.0 – 3.0 (avg 2.79) | ✅ 1–3 scale, not 1–5 |

**Grade distribution at 40° (listed climbs):**
Bell curve centered at 7a/V6 (14,334 climbs) and 6c/V5 (11,262). Grades below V3 and above V9 are rare.

| Grade | Count at 40° |
|-------|-------------|
| 6a/V3 | 5,660 |
| 6a+/V3 | 4,865 |
| 6b/V4 | 8,485 |
| 6c/V5 | 11,262 |
| 6c+/V5 | 9,826 |
| **7a/V6** | **14,334** |
| 7a+/V7 | 11,114 |
| 7b/V8 | 6,711 |
| 7c/V9 | 2,473 |

**Quality filter recommendations:**
- `quality_average >= 2.5 AND ascensionist_count >= 10` → substantial quality filter
- `quality_average >= 3.0` → top-rated (48k entries)
- Never filter on `quality_average >= 3.0 AND ascensionist_count >= 100` — too aggressive (~10k entries)

---

## 6. Usefulness Assessment

| Table / Field | Category | For Kilter-Up |
|---------------|----------|---------------|
| `climbs.name` | 🟢 Critical | Level 2 prompt: "You are watching {name}" |
| `climbs.frames` | 🟢 Critical | Parse → hold positions + roles for prompt |
| `climbs.setter_username` | 🟡 Useful | "Set by {setter}" — nice to show |
| `climbs.description` | 🟡 Useful | Include if not empty |
| `climbs.layout_id` | 🟢 Critical | Needed for placements join |
| `climb_stats.difficulty_average` | 🟢 Critical | Grade display + coaching context |
| `climb_stats.quality_average` | 🟡 Useful | "Community rating: 2.8/3.0" |
| `climb_stats.ascensionist_count` | 🟡 Useful | Popularity context |
| `climb_stats.fa_username` | 🟡 Useful | "First climbed by…" |
| `climb_stats.angle` | 🟢 Critical | "At 40 degrees" — mandatory context |
| `difficulty_grades.boulder_name` | 🟢 Critical | Human-readable grade |
| `placements.id → holes.x/y` | 🟢 Critical | Hold positions for Level 2 prompt |
| `placement_roles.name` | 🟢 Critical | Start/Middle/Finish/Foot — critical |
| `placement_roles.led_color` | 🔵 Photo | LED color → hold identification |
| `holes.x/y` | 🔵 Photo + 🟢 | Positions in Level 2 + photo lookup |
| `beta_links.link` | 🟡 Useful | Show in UI — "Watch beta" link |
| `beta_links.thumbnail` | 🟡 Useful | Preview thumbnail |
| `layouts.*` | 🔵 Photo | Board type identification |
| `leds.*` | 🔵 Photo | LED strip position for recognition |
| `product_sizes.edge_*` | 🔵 Photo | Board dimension bounds |
| `users`, `walls`, `circuits` | ⚪ Not needed | Empty in this dataset |

---

## 7. Key Questions Answered

### Q1: How do we go from climb name → full hold position map with roles?

**Step 1 — Find the climb:**
```sql
SELECT uuid, layout_id, frames, angle
FROM climbs
WHERE name LIKE '%search term%' AND is_listed = 1;
```

**Step 2 — Parse the frames string in Python:**
```python
import re
tokens = re.findall(r'p(\d+)r(\d+)', frames)
# → [(placement_id, role_id), ...]
```

**Step 3 — Resolve positions:**
```sql
SELECT p.id as placement_id, h.x, h.y, pr.name as role, pr.led_color
FROM placements p
JOIN holes h ON h.id = p.hole_id
JOIN placement_roles pr ON pr.id = ?  -- role_id from frames token
WHERE p.id = ?;  -- placement_id from frames token
```

Or batched:
```sql
SELECT p.id as placement_id, h.x, h.y, pr.name as role
FROM placements p
JOIN holes h ON h.id = p.hole_id
JOIN placement_roles pr ON pr.id IN (12,13,14,15)
WHERE p.id IN (1145, 1146, 1149, ...)  -- all placement_ids from frames
```

**Note:** After batch query, use a dict to map `placement_id → role` from the parsed tokens to assign the correct role (since the batch query returns all roles per placement, you need to filter by the specific role_id from the frames token).

The cleanest approach: parse frames in Python → for each `(pid, rid)` pair, do a single batched query for all `pid`s → cross-reference `rid` from the parsed pairs.

---

### Q2: How do we go from layout string → list of colored holds with x/y coordinates?

"Layout string" = the `frames` column. Process:

```python
import re, sqlite3

def get_hold_map(db_path: str, frames: str) -> list[dict]:
    tokens = re.findall(r'p(\d+)r(\d+)', frames)
    pid_to_role = {int(pid): int(rid) for pid, rid in tokens}
    pids = list(pid_to_role.keys())
    
    conn = sqlite3.connect(db_path)
    placeholders = ','.join('?' * len(pids))
    rows = conn.execute(f"""
        SELECT p.id, h.x, h.y
        FROM placements p
        JOIN holes h ON h.id = p.hole_id
        WHERE p.id IN ({placeholders})
    """, pids).fetchall()
    
    # Fetch role names
    role_rows = conn.execute("""
        SELECT id, name, led_color FROM placement_roles WHERE id IN (12,13,14,15)
    """).fetchall()
    role_map = {r[0]: (r[1], r[2]) for r in role_rows}
    
    return [
        {"placement_id": pid, "x": x, "y": y,
         "role": role_map[pid_to_role[pid]][0],
         "led_color": role_map[pid_to_role[pid]][1]}
        for pid, x, y in rows
    ]
```

---

### Q3: What info can we inject into a Gemini Level 2 prompt?

Concrete fields and example values:

```
Climb: "Floats Your Boat"
Setter: kilterjackie
Grade: 7a/V6 (community difficulty_average = 22.0 at 40°)
Angle: 40 degrees
Quality rating: 2.96/3.0 (76,569 ascents)
First ascent: whole_kogan

Hold layout (14 holds):
  START:   (40,40), (48,40)        [bottom-left area, green]
  MIDDLE:  (56,56), (72,72), ...   [spread across wall, cyan]
  FINISH:  (96,152)                [upper-right, magenta]
  FOOT:    (112,8), (128,8), ...   [lower section, orange]

Description: "Make sure you angle your body just right"
```

This gives Gemini: grade context, expected body position, hold density in zones, finish height, and foot hold coverage.

**Hold zone vocabulary** (derived from y coordinate):
- y < 60: Low zone (feet/start)
- y 60–120: Mid zone  
- y > 120: High zone (finish area)

---

### Q4: For photo recognition — how to match detected LED positions → candidate climbs?

**Strategy (reverse lookup):**

1. Detect LED positions in photo → list of (x, y) approximations on the board
2. Map x,y → nearest `holes.id` (Euclidean distance lookup)
3. Map `holes.id` → `placements.id` (for the known layout_id)
4. For each candidate placement_id, search `climbs.frames` for `p{id}r`
5. Score candidate climbs by what fraction of detected LEDs appear in their frames
6. Return top N matches

The coordinate normalization step (photo pixels → board units) requires knowing the board size and orientation from the photo. Board unit range: x ∈ [-56, 204], y ∈ [-12, 291].

This is a Phase 4 problem — the DB has everything needed.

---

### Q5: Are there beta video URLs in the DB? How many and how to access?

**Yes.** 32,139 beta links, 30,929 listed, covering 10,214 unique climbs (~4% of all climbs).

All are Instagram post URLs. No embedded video files.

```sql
SELECT link, thumbnail, foreign_username, angle
FROM beta_links
WHERE climb_uuid = ? AND is_listed = 1
ORDER BY created_at DESC;
```

Thumbnails are served from `api.kilterboardapp.com` — may require authentication or could be cached locally.

**Note:** These are user-submitted Instagram links, not first-party video from Kilter. They cannot be programmatically downloaded without Instagram API access.

---

### Q6: What's the best way to filter "quality" climbs?

**Recommended tiered filter:**

| Tier | Filter | Result size (all angles) |
|------|--------|--------------------------|
| Baseline | `is_listed=1 AND is_nomatch=0` | ~178k climbs |
| Quality | + `ascensionist_count >= 5` | significantly smaller |
| High Quality | + `quality_average >= 2.5` | 197k stat rows |
| Top Rated | + `quality_average >= 3.0` | 48k stat rows |

**For search results:** `is_listed=1` is sufficient. Apply `quality_average DESC` as sort order.

**For Level 2 context:** No filtering needed — user has already selected a climb.

---

### Q7: How many distinct board types and how to tell them apart programmatically?

4 listed products (is_listed=1):

| product_id | name | layouts | Notes |
|-----------|------|---------|-------|
| 1 | Kilter Board Original | layout_id=1 | ~99% of climbs |
| 2 | JUUL | layout_id=2 | Separate board |
| 6 | Tycho | layout_id=6,7 | Different color roles (36–41) |
| 7 | Kilter Board Homewall | layout_id=8 | Smaller board (-44 to 44 x) |

**Programmatic identification:** `climbs.layout_id` directly identifies the board type. No inference needed.

**Coordinate bounds by product size (Kilter Board Original — product_id=1):**

| Size | edge_left | edge_right | edge_bottom | edge_top |
|------|-----------|------------|-------------|----------|
| 12x14 Commercial | 0 | 144 | 0 | 180 |
| 8x12 Home | 24 | 120 | 0 | 156 |
| 7x10 Small | 28 | 116 | 36 | 156 |
| 12x12 Square | 0 | 144 | 12 | 156 |
| 16x12 Super Wide | -24 | 168 | 0 | 156 |

---

## 8. Appendix — Raw SQL Queries

```sql
-- 1. All table names
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;

-- 2. Row counts (all tables)
SELECT 'climbs', COUNT(*) FROM climbs;
-- (repeated for each table)

-- 3. Climbs filter stats
SELECT COUNT(*), SUM(is_listed), SUM(is_draft), SUM(is_nomatch) FROM climbs;

-- 4. Distinct angles
SELECT DISTINCT angle FROM climb_stats ORDER BY angle;

-- 5. Climbs per angle
SELECT angle, COUNT(DISTINCT climb_uuid) FROM climb_stats GROUP BY angle ORDER BY angle;

-- 6. Grade distribution at 40°
SELECT dg.boulder_name, COUNT(*)
FROM climb_stats cs
JOIN climbs c ON cs.climb_uuid = c.uuid
JOIN difficulty_grades dg ON CAST(cs.difficulty_average AS INTEGER) = dg.difficulty
WHERE c.is_listed = 1 AND cs.angle = 40
GROUP BY dg.boulder_name ORDER BY CAST(dg.difficulty AS INTEGER);

-- 7. Quality stats
SELECT MIN(quality_average), MAX(quality_average), AVG(quality_average),
       SUM(CASE WHEN quality_average >= 3.0 THEN 1 ELSE 0 END),
       SUM(CASE WHEN ascensionist_count >= 10 THEN 1 ELSE 0 END)
FROM climb_stats cs
JOIN climbs c ON cs.climb_uuid = c.uuid WHERE c.is_listed = 1;

-- 8. Holes coordinate range
SELECT MIN(x), MAX(x), MIN(y), MAX(y) FROM holes;

-- 9. Verify frames → placements → holes path
SELECT p.id, p.hole_id, h.x, h.y
FROM placements p JOIN holes h ON h.id = p.hole_id
WHERE p.id IN (1145, 1146, 1149);

-- 10. Beta links stats
SELECT COUNT(*), SUM(is_listed), COUNT(DISTINCT climb_uuid) FROM beta_links;
```

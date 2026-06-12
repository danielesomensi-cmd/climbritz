# D019 — BoardLib Schema Audit: "Matching Allowed" + Full Climbs Schema

> **Date:** 2026-06-12 · **Type:** D (read-only audit) · **DB:** `backend/data/kilter.db` (198 MB, snapshot 2026-04-01, 344,504 climbs)
>
> **Brief-ID note:** the brief arrived as "D018", but D018 is already taken (design/UX audit, `docs/design-audit-2026-06-04/`, commit `48ee58d`). Next free D-number per `PROJECT_STATUS.md` + `git log --all` is **D019** — used throughout.
>
> All queries run with `sqlite3 "file:...?mode=ro"` (SQLite read-only URI). Zero writes.

---

## TL;DR — Verdict A: a structured field EXISTS

**`climbs.is_nomatch BOOLEAN NOT NULL DEFAULT 0`** is a first-class column on the `climbs` table. `1` = the setter declared a **"no matching"** rule (both hands on the same hold forbidden) via a toggle in the official Kilter app. It flags **63,102 of 251,895 listed climbs (25.0%)** — **58,009 (25.5%)** of the layout-1 Discovery pool. The official app also auto-writes a "No matching"-style line into `description`, which is why the flag and the free text agree almost perfectly (see §4). Our test fixture `backend/tests/fixtures/test_kilter.db` already has the column; the backend just never reads it. Exposing it as a Discovery filter is a small, low-risk brief (§6).

---

## 1. Full schema dump

### 1.1 All tables (`.tables`)

```
android_metadata            leds
ascents                     placement_roles
attempts                    placements
beta_links                  product_sizes
bids                        product_sizes_layouts_sets
circuits                    products
circuits_climbs             products_angles
climb_cache_fields          sets
climb_random_positions      shared_syncs
climb_stats                 tags
climbs                      user_permissions
difficulty_grades           user_syncs
holes                       users
kits                        walls
layouts                     walls_sets
```

No explicit indexes exist (`sqlite_master` type='index' with SQL → empty); only the implicit PRIMARY KEY / UNIQUE ones.

### 1.2 `climbs` — the A027 storage-format reference

```sql
CREATE TABLE IF NOT EXISTS "climbs" (
        uuid TEXT NOT NULL PRIMARY KEY,
        layout_id INT UNSIGNED NOT NULL,
        setter_id INT UNSIGNED NOT NULL,
        setter_username TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        hsm INT UNSIGNED NOT NULL,
        edge_left INT UNSIGNED NOT NULL,
        edge_right INT UNSIGNED NOT NULL,
        edge_bottom INT UNSIGNED NOT NULL,
        edge_top INT UNSIGNED NOT NULL,
        angle INT NULL DEFAULT NULL,
        frames_count INT UNSIGNED NOT NULL DEFAULT 1,
        frames_pace INT UNSIGNED NOT NULL DEFAULT 0,
        frames TEXT NOT NULL,
        is_draft BOOLEAN NOT NULL DEFAULT 0,
        is_listed BOOLEAN NOT NULL,
        created_at TEXT NOT NULL, is_nomatch BOOLEAN NOT NULL DEFAULT 0,
        FOREIGN KEY (layout_id) REFERENCES layouts(id) ON UPDATE CASCADE ON DELETE CASCADE
    );
```

Column notes (for A027 BoardLib-compatible storage):

| Column | Meaning |
|---|---|
| `uuid` | TEXT PK, 32-char hex (no dashes) |
| `layout_id` | 1 = Kilter Board Original, 8 = Kilter Board Homewall (full list §1.4) |
| `setter_id` / `setter_username` | Aurora account of the setter |
| `description` | free text; the app auto-appends the "No matching" line when the toggle is set |
| `hsm` | **hold-set mask** — bitwise OR of `sets.hsm` for every set the climb uses (§3.2). NOT matching-related. |
| `edge_left/right/bottom/top` | bounding box of the climb in board units → drives the min-board-size compatibility check |
| `angle` | NULL = adjustable (graded per-angle in `climb_stats`) |
| `frames_count` / `frames_pace` | >1 = animated sequence (we exclude these globally); pace = ms per frame |
| `frames` | `p{placement_id}r{role_id}` concatenated, e.g. `p1083r12p1117r13…` |
| `is_draft` / `is_listed` | publish state — Discovery pool = `is_listed=1 AND is_draft=0` |
| `is_nomatch` | **the matching rule flag** — appended column (note the inline position after `created_at`: added later by an Aurora sync migration), `1` = no matching allowed |

### 1.3 `climb_stats` (+ cache triggers)

```sql
CREATE TABLE climb_stats (
    climb_uuid TEXT NOT NULL,
    angle INT UNSIGNED NOT NULL,
    display_difficulty FLOAT UNSIGNED NOT NULL,   -- benchmark_difficulty if set, else difficulty_average
    benchmark_difficulty FLOAT UNSIGNED NULL DEFAULT NULL,
    ascensionist_count INT UNSIGNED NOT NULL,
    difficulty_average FLOAT UNSIGNED NOT NULL,
    quality_average FLOAT UNSIGNED NOT NULL,
    fa_username TEXT NOT NULL,
    fa_at TEXT NOT NULL,
    PRIMARY KEY (climb_uuid, angle),
    FOREIGN KEY (climb_uuid) REFERENCES climbs(uuid) ON UPDATE CASCADE ON DELETE RESTRICT
);
```

Three triggers (`climb_stats_after_insert/update/delete`) maintain `climb_cache_fields` (per-climb ascent-weighted aggregate of `ascensionist_count` / `display_difficulty` / `quality_average` across angles).

### 1.4 Related tables (full schemas)

```sql
CREATE TABLE layouts (
    id INT UNSIGNED NOT NULL PRIMARY KEY,
    product_id INT UNSIGNED NOT NULL,
    name TEXT NOT NULL,
    instagram_caption TEXT NOT NULL,
    is_mirrored BOOLEAN NOT NULL,
    is_listed BOOLEAN NOT NULL,
    password TEXT NULL DEFAULT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE CASCADE
);
-- rows: 1 Kilter Board Original · 2 JUUL · 3 Standard Medium (Demo) · 4 BKB Level 1
--       5 Spire · 6 Tycho Complete · 7 Tycho 2020 · 8 Kilter Board Homewall

CREATE TABLE products (
    id INT UNSIGNED NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    is_listed BOOLEAN NOT NULL,
    password TEXT NULL DEFAULT NULL,
    min_count_in_frame INT UNSIGNED NULL DEFAULT NULL,
    max_count_in_frame INT UNSIGNED NULL DEFAULT NULL
);

CREATE TABLE products_angles (
    product_id INT UNSIGNED NOT NULL,
    angle INT NOT NULL,
    PRIMARY KEY(product_id, angle),
    FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE sets (
    id INT UNSIGNED NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    hsm INT UNSIGNED NOT NULL          -- the per-set bit for climbs.hsm / walls.hsm (§3.2)
);

CREATE TABLE placements (
    id INT UNSIGNED NOT NULL PRIMARY KEY,
    layout_id INT UNSIGNED NOT NULL,
    hole_id INT UNSIGNED NOT NULL,
    set_id INT UNSIGNED NOT NULL,
    default_placement_role_id INT UNSIGNED NULL DEFAULT NULL,
    UNIQUE(layout_id, hole_id),
    FOREIGN KEY (layout_id) REFERENCES layouts(id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (hole_id) REFERENCES holes(id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (set_id) REFERENCES sets(id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (default_placement_role_id) REFERENCES placement_roles(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE placement_roles (
    id INT UNSIGNED NOT NULL PRIMARY KEY,
    product_id INT UNSIGNED NOT NULL,
    position INT UNSIGNED NOT NULL,
    name TEXT NOT NULL,
    full_name TEXT NOT NULL,
    led_color TEXT NOT NULL,
    screen_color TEXT NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE holes (
    id INT UNSIGNED NOT NULL PRIMARY KEY,
    product_id INT UNSIGNED NOT NULL,
    name TEXT NOT NULL,
    x INT NOT NULL,
    y INT NOT NULL,
    mirrored_hole_id INT UNSIGNED NULL DEFAULT NULL,
    mirror_group INT UNSIGNED NOT NULL DEFAULT 0,
    UNIQUE(product_id, name),
    UNIQUE(product_id, x, y),
    FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (mirrored_hole_id) REFERENCES holes(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE leds (
    id INT UNSIGNED NOT NULL PRIMARY KEY,
    product_size_id INT UNSIGNED NOT NULL,
    hole_id INT UNSIGNED NOT NULL,
    position INT UNSIGNED NOT NULL,
    UNIQUE(product_size_id, position),
    FOREIGN KEY (product_size_id) REFERENCES product_sizes(id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (hole_id) REFERENCES holes(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE product_sizes (
    id INT UNSIGNED NOT NULL PRIMARY KEY,
    product_id INT UNSIGNED NOT NULL,
    edge_left INT NOT NULL,
    edge_right INT NOT NULL,
    edge_bottom INT NOT NULL,
    edge_top INT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    image_filename TEXT NOT NULL,
    position INT UNSIGNED NOT NULL,
    is_listed BOOLEAN NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE product_sizes_layouts_sets (
    id INT UNSIGNED NOT NULL PRIMARY KEY,
    product_size_id INT UNSIGNED NOT NULL,
    layout_id INT UNSIGNED NOT NULL,
    set_id INT UNSIGNED NOT NULL,
    image_filename TEXT NOT NULL,
    is_listed BOOLEAN NOT NULL,
    UNIQUE(product_size_id, layout_id, set_id),
    FOREIGN KEY (product_size_id) REFERENCES product_sizes(id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (layout_id) REFERENCES layouts(id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (set_id) REFERENCES sets(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE tags (                    -- EMPTY in the shared download (user-sync table)
    entity_uuid TEXT NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    name TEXT NOT NULL,
    is_listed BOOLEAN NOT NULL,
    PRIMARY KEY (entity_uuid, user_id, name)
);

CREATE TABLE beta_links (
    climb_uuid TEXT NOT NULL,
    link TEXT NOT NULL,
    foreign_username TEXT NULL DEFAULT NULL,
    angle INT NULL DEFAULT NULL,
    thumbnail TEXT NULL DEFAULT NULL,
    is_listed BOOLEAN NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (climb_uuid, link),
    FOREIGN KEY (climb_uuid) REFERENCES climbs(uuid) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE circuits (
    uuid TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    color TEXT NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    is_public BOOLEAN NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(uuid)
);

CREATE TABLE circuits_climbs (
    circuit_uuid TEXT NOT NULL,
    climb_uuid TEXT NOT NULL,
    position INT UNSIGNED NOT NULL,
    PRIMARY KEY(circuit_uuid, climb_uuid)
);

CREATE TABLE climb_cache_fields (
    climb_uuid TEXT NOT NULL PRIMARY KEY,
    ascensionist_count INT UNSIGNED NULL DEFAULT NULL,
    display_difficulty FLOAT UNSIGNED NULL DEFAULT NULL,
    quality_average FLOAT UNSIGNED NULL DEFAULT NULL,
    FOREIGN KEY (climb_uuid) REFERENCES climbs(uuid) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE climb_random_positions (
    climb_uuid TEXT NOT NULL PRIMARY KEY,
    position INT NOT NULL
);

CREATE TABLE difficulty_grades (
    difficulty INT UNSIGNED NOT NULL PRIMARY KEY,
    boulder_name TEXT NOT NULL,
    route_name TEXT NOT NULL,
    is_listed BOOLEAN NOT NULL
);

CREATE TABLE ascents (
    uuid TEXT NOT NULL PRIMARY KEY,
    climb_uuid TEXT NOT NULL,
    angle INT UNSIGNED NOT NULL,
    is_mirror BOOLEAN NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    attempt_id INT UNSIGNED NOT NULL,
    bid_count INT UNSIGNED NOT NULL DEFAULT 1,
    quality INT UNSIGNED NOT NULL,
    difficulty INT UNSIGNED NOT NULL,
    is_benchmark INT UNSIGNED NOT NULL DEFAULT 0, -- boolean
    comment TEXT NOT NULL DEFAULT '',
    climbed_at TEXT NOT NULL,
    created_at TEXT NULL DEFAULT NULL,
    FOREIGN KEY (climb_uuid) REFERENCES climbs(uuid) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (difficulty) REFERENCES difficulty_grades(difficulty) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE attempts (
    id INT UNSIGNED NOT NULL PRIMARY KEY,
    position INT UNSIGNED NOT NULL,
    name TEXT NOT NULL
);

CREATE TABLE bids (
    uuid TEXT NOT NULL PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    climb_uuid TEXT NOT NULL,
    angle INT UNSIGNED NOT NULL,
    is_mirror BOOLEAN NOT NULL,
    bid_count INT UNSIGNED NOT NULL DEFAULT 1,
    comment TEXT NOT NULL DEFAULT '',
    climbed_at TEXT NOT NULL,
    created_at TEXT NULL DEFAULT NULL,
    FOREIGN KEY (climb_uuid) REFERENCES climbs(uuid) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE users (
    id INT UNSIGNED NOT NULL PRIMARY KEY,
    username TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE walls (
    uuid TEXT NOT NULL PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    name TEXT NOT NULL,
    product_id INT UNSIGNED NOT NULL,
    is_adjustable BOOLEAN NOT NULL,
    angle INT UNSIGNED NOT NULL,
    layout_id INT UNSIGNED NOT NULL,
    product_size_id INT UNSIGNED NOT NULL,
    hsm INT UNSIGNED NOT NULL,
    serial_number TEXT NULL DEFAULT NULL,
    created_at TEXT NULL DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (layout_id) REFERENCES layouts(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (product_size_id) REFERENCES product_sizes(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE walls_sets (
    wall_uuid TEXT NOT NULL,
    set_id INT UNSIGNED NOT NULL,
    PRIMARY KEY(wall_uuid, set_id),
    FOREIGN KEY (wall_uuid) REFERENCES walls(uuid) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (set_id) REFERENCES sets(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE kits (
    serial_number TEXT NULL PRIMARY KEY,
    name TEXT NULL,
    is_autoconnect BOOLEAN NOT NULL,
    is_listed BOOLEAN NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE shared_syncs (
    table_name TEXT NOT NULL PRIMARY KEY,
    last_synchronized_at TEXT NOT NULL
);

CREATE TABLE user_syncs (
    user_id INT UNSIGNED NOT NULL,
    table_name TEXT NOT NULL,
    last_synchronized_at TEXT NOT NULL,
    PRIMARY KEY (user_id, table_name),
    FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE user_permissions (
    user_id INT UNSIGNED NOT NULL,
    name TEXT NOT NULL,
    PRIMARY KEY (user_id, name)
);

CREATE TABLE android_metadata (locale TEXT);
```

---

## 2. Structured matching field hunt → FOUND

Scanned every column name across all 30 tables for `match / rules / restrictions / attributes / flags / type / style`. Exactly one hit, and it's the right one:

### `climbs.is_nomatch` (BOOLEAN NOT NULL DEFAULT 0)

| Scope | `is_nomatch=1` | total | % |
|---|---:|---:|---:|
| All climbs | 73,864 | 344,504 | 21.4% |
| Listed pool (`is_listed=1 AND is_draft=0`) | 63,102 | 251,895 | 25.0% |
| **Discovery pool** (listed, non-draft, single-frame, layout 1) | **58,009** | **227,704** | **25.5%** |
| Homewall pool (same, layout 8) | 5,020 | 23,156 | 21.7% |

Semantics confirmed by the description cross-check (§4): `1` ⇔ the setter set the official app's "no matching" rule. `0` = matching allowed (the default — the app has no explicit "matching required" state).

No other candidate: no `rules`, `restrictions`, `attributes` or flag tables exist; `tags` is empty in the shared download (it's a user-sync table — 0 rows, 0 match-related names).

### Frame role IDs — no rule encoding

Distinct `r{n}` ids actually used (listed, non-draft, single-frame, all layouts):

| Layout | Roles used | Notes |
|---|---|---|
| 1 (Kilter Original) | **r12 start · r13 middle · r14 finish · r15 foot** (3.9M placements) | + stray r20–r31 on ~550 climbs (other products' role ids leaking in — data noise, no semantics) |
| 8 (Kilter Homewall) | r42 start · r43 middle · r44 finish · r45 foot | product-7 roles |
| 2/5 (JUUL/Spire) | r20–r23 / r32–r35 | same 4-role pattern per product |
| 6/7 (Tycho) | r36–r41 (cyan/magenta/yellow/green/red/blue) | circuit-color roles, Tycho-only |

Every product follows the same 4-role pattern (start/middle/finish/foot) via `placement_roles`; **no role id encodes matching or any other rule.** Our known r12–15 set for layout 1 is confirmed.

---

## 3. Cross-check: other candidate metadata

### 3.1 No per-climb settings/boolean tables

No `climb_settings` or bit-flag side table exists. The only per-climb auxiliary tables are `climb_stats` (grades/ascents), `climb_cache_fields` (trigger-maintained cache), `climb_random_positions` (shuffle order for the official app's random sort), and `beta_links` (Instagram beta videos).

### 3.2 `hsm` decoded — hold-set mask, NOT matching

`sets.hsm` assigns each hold set a bit; `climbs.hsm` is the OR of the sets the climb uses (same field on `walls` describes which sets a wall has installed):

```
sets:  1 Bolt Ons hsm=1 · 20 Screw Ons hsm=2 · 26 Mainline hsm=1 · 27 Auxiliary hsm=2
       28 Mainline Kickboard hsm=4 · 29 Auxiliary Kickboard hsm=8 · (JUUL/Demo/BKB/Spire/Orbit hsm=1)
```

`climbs.hsm` distribution: `3` = 276,055 (Original: bolt-ons + screw-ons), `1` = 60,554 (bolt-ons / mainline only), `2` = 786, then homewall combinations `5/7/9/11/13/15` etc. (mainline ± aux ± kickboards). Values match the bitmask model exactly; zero correlation with matching. **A027 must compute it** as `OR(sets.hsm)` over the placements used (via `placements.set_id → sets.hsm`).

---

## 4. Description free-text analysis

Listed pool (251,895 climbs; 98,116 have a non-empty description):

| | mentions "match" | no mention |
|---|---:|---:|
| `is_nomatch=1` | **63,102** | **0** |
| `is_nomatch=0` | 1,341 | 187,452 |

- 64,443 listed climbs (25.6%) mention "match" in the description.
- **Every single flagged climb mentions it** — because the official app *auto-writes the rule into the description* when the toggle is set. Top texts among flagged climbs: `No matching.` ×21,182, `No Matching` ×16,090, `No match` ×14,936, plus low-count variants (`No matches`, `No matching!`, `Campus. No matching.`, `No matchy`, `"no matching"`, `rule: no matching hands`, …). 52,582 (83%) are *exactly* a bare "no match(ing)" string.
- The 1,341 free-text-only mentions (`is_nomatch=0`) are a mixed bag — **not** reliably "no matching":
  - positive: `Matching allowed`, `Matching encouraged`, `match all the way`, `Say yes to matching today!`, `matching recommended`, `Matching is on`, `match away, compadre ;-)`
  - partial rules: `you can only match the finish`, `Match second last hold if you want`, `No Ghost Matching`, `360 No match for kids`
  - genuine unflagged no-match (setter typed it manually, predating or skipping the toggle): `no hand matches`, `don't match`, `Matching not allowed`, `Do not match holds.`, `No match`, plus non-English (`Ne JAMAIS mettre les deux mains sur la même prise…`)

Conclusion: the flag is **authoritative and strictly more reliable than any LIKE heuristic**. A heuristic would add at most ~0.5% of the pool, at the cost of false positives ("Matching allowed" contains "match"; "Without match this is prolly 7b" is commentary, not a rule).

### 30 verbatim samples (flagged climbs, first 30 by uuid, truncated at 120 chars)

```
No matching
No matching
No Matching
No match
No matching
No match
No matching.
No matching
No matching
no match
no match
No matching!
Easy. No matching.
Squamish replica. No matching
No matching.
No matching.
no match
no matcheru
No matching 🤲
no matching / 🦕🦕🦕…
No match
no matches
No matching.
No match
No match
No matching.
No matching pls. Set by Felix and Martin.
No Match
No match
No matching.
```

---

## 5. Verdict

**A — Structured field exists: `climbs.is_nomatch`.**

- **Semantics:** `1` = "no matching" rule declared by the setter through the official Kilter app toggle (which also auto-writes the rule into `description`); `0` = no rule (matching allowed by default). Climb-level, not per-angle. Column was added to the schema by a later Aurora sync migration (inline position after `created_at`), so any fresh BoardLib download has it — including our Railway prod DB and the pytest fixture `backend/tests/fixtures/test_kilter.db` (verified: column present).
- **Coverage:** 25.5% of the Discovery pool — large enough to be a genuinely useful filter.
- **Do NOT build a description heuristic.** It would add ~1,341 climbs (0.5%) with real false-positive risk; the flag already covers everything the official app knows.

### Sketch: Discovery "No matching" filter (future brief)

1. **Backend** — `climb_service.py`: add `is_nomatch` to the SELECT and a `matching` query param to `GET /api/climbs/search` (`all` default · `no_match_only` · `exclude_no_match`), one `WHERE is_nomatch = ?` branch in `_build_search_filters()` (the shared path means `/api/climbs/generate` inherits it for free). Include `is_nomatch` in the climb detail response.
2. **Frontend** — `FilterPanel`: a 3-state chip row like the existing benchmark toggle; "No matching" badge on `ClimbCard` / detail page.
3. **Cost/risk:** small; read-only column, no migration, fixture already compatible. Tests: seed fixture rows with `is_nomatch=1` + filter assertions.

### A027 takeaways (BoardLib-compatible storage of user-generated problems)

- The full `climbs` column list in §1.2 is the storage contract; `is_nomatch` (default 0) and `hsm` (computed OR of `sets.hsm` over used placements, §3.2) are the two non-obvious fields.
- `edge_*` must be computed from the holds' hole x/y; `angle` NULL = adjustable; `frames` stays the `p{id}r{role}` string; `frames_count=1`, `frames_pace=0` for static problems.

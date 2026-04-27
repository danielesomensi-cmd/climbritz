# D015 — Circuits Identification Audit

_Read-only audit of `backend/data/kilter.db` to determine how BoardLib distinguishes circuits, routes, drafts, and unlisted climbs from normal boulders. Output feeds Brief A (move count filter on `/discover`)._

DB path: `backend/data/kilter.db`

## TL;DR

**The "circuit" concept in BoardLib is split in two, and neither is a dedicated `climb_type` column:**

1. **User-curated circuits (playlists of multiple climbs)** live in a dedicated `circuits` / `circuits_climbs` table — these are **empty (0 rows)** in the public DB. Safe to ignore for Brief A.
2. **Sequence-circuits encoded as a single `climbs` row** are distinguished by the `frames_count` column. 99.85% of climbs have `frames_count = 1` (a single static hold pattern). The remaining **517 climbs (0.15%) have `frames_count > 1`** — these are multi-frame animated circuits (the `frames` column contains multiple comma-separated patterns). **These are the rows to exclude.**

Additional signals:

- **`is_listed = 1`** filters out ~92k unvalidated/private climbs (already standard practice).
- **`is_draft` is effectively dead** (all 344k climbs have `is_draft=0` in the public DB — BoardLib doesn't ship drafts).
- **`hsm` is not a climb-type column** — it's a "set mode" identifier tied to the hold set used by the climb, correlated with `sets.hsm`. Not useful for circuit detection.
- **High middle-hold count alone does not mean "circuit"** — climbs like "Pump 540°" (26 middles, 920 ascents) and "The Obvious Child" (23 middles, 740 ascents) are legitimate long routes that the community has validated. Filtering them out by hold count would hurt the UX.

**Recommended WHERE clause for Brief A (move count filter):**

```sql
WHERE layout_id = 1
  AND is_listed = 1
  AND frames_count = 1
  AND (LENGTH(frames) - LENGTH(REPLACE(frames, 'r13', ''))) / 3 + 2 BETWEEN :min AND :max
```

The `+ 2` comes from Daniele's formula: `moves = middle_holds + 2` (start + finish positions).

**Suggested UX range for the slider:** `2` to `30`. The distribution past 33 middle holds falls off a cliff (33: 268 climbs, 34: only 11), so a hard cap of 30–35 keeps the filter useful without letting outliers (the 403-middle "Tetris a la Kilter") skew the range control.


## Q1 — `climbs` table schema

```sql
PRAGMA table_info(climbs);
```

| cid | name | type | notnull | dflt_value | pk |
| --- | --- | --- | --- | --- | --- |
| 0 | uuid | TEXT | 1 | NULL | 1 |
| 1 | layout_id | INT UNSIGNED | 1 | NULL | 0 |
| 2 | setter_id | INT UNSIGNED | 1 | NULL | 0 |
| 3 | setter_username | TEXT | 1 | NULL | 0 |
| 4 | name | TEXT | 1 | NULL | 0 |
| 5 | description | TEXT | 1 | '' | 0 |
| 6 | hsm | INT UNSIGNED | 1 | NULL | 0 |
| 7 | edge_left | INT UNSIGNED | 1 | NULL | 0 |
| 8 | edge_right | INT UNSIGNED | 1 | NULL | 0 |
| 9 | edge_bottom | INT UNSIGNED | 1 | NULL | 0 |
| 10 | edge_top | INT UNSIGNED | 1 | NULL | 0 |
| 11 | angle | INT | 0 | NULL | 0 |
| 12 | frames_count | INT UNSIGNED | 1 | 1 | 0 |
| 13 | frames_pace | INT UNSIGNED | 1 | 0 | 0 |
| 14 | frames | TEXT | 1 | NULL | 0 |
| 15 | is_draft | BOOLEAN | 1 | 0 | 0 |
| 16 | is_listed | BOOLEAN | 1 | NULL | 0 |
| 17 | created_at | TEXT | 1 | NULL | 0 |
| 18 | is_nomatch | BOOLEAN | 1 | 0 | 0 |


## Q2 — All tables in the DB

```sql
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;
```

| name |
| --- |
| android_metadata |
| ascents |
| attempts |
| beta_links |
| bids |
| circuits |
| circuits_climbs |
| climb_cache_fields |
| climb_random_positions |
| climb_stats |
| climbs |
| difficulty_grades |
| holes |
| kits |
| layouts |
| leds |
| placement_roles |
| placements |
| product_sizes |
| product_sizes_layouts_sets |
| products |
| products_angles |
| sets |
| shared_syncs |
| sqlite_stat1 |
| tags |
| user_permissions |
| user_syncs |
| users |
| walls |
| walls_sets |


**Tables flagged for further inspection:** circuits, circuits_climbs, difficulty_grades, placement_roles, product_sizes_layouts_sets, sets, tags, walls_sets


### Schema — `circuits`

| cid | name | type | notnull | dflt_value | pk |
| --- | --- | --- | --- | --- | --- |
| 0 | uuid | TEXT | 1 | NULL | 1 |
| 1 | name | TEXT | 1 | NULL | 0 |
| 2 | description | TEXT | 1 | NULL | 0 |
| 3 | color | TEXT | 1 | NULL | 0 |
| 4 | user_id | INT UNSIGNED | 1 | NULL | 0 |
| 5 | is_public | BOOLEAN | 1 | NULL | 0 |
| 6 | created_at | TEXT | 1 | NULL | 0 |
| 7 | updated_at | TEXT | 1 | NULL | 0 |

Row count: **0**


### Schema — `circuits_climbs`

| cid | name | type | notnull | dflt_value | pk |
| --- | --- | --- | --- | --- | --- |
| 0 | circuit_uuid | TEXT | 1 | NULL | 1 |
| 1 | climb_uuid | TEXT | 1 | NULL | 2 |
| 2 | position | INT UNSIGNED | 1 | NULL | 0 |

Row count: **0**


### Schema — `difficulty_grades`

| cid | name | type | notnull | dflt_value | pk |
| --- | --- | --- | --- | --- | --- |
| 0 | difficulty | INT UNSIGNED | 1 | NULL | 1 |
| 1 | boulder_name | TEXT | 1 | NULL | 0 |
| 2 | route_name | TEXT | 1 | NULL | 0 |
| 3 | is_listed | BOOLEAN | 1 | NULL | 0 |

Row count: **39**


### Schema — `placement_roles`

| cid | name | type | notnull | dflt_value | pk |
| --- | --- | --- | --- | --- | --- |
| 0 | id | INT UNSIGNED | 1 | NULL | 1 |
| 1 | product_id | INT UNSIGNED | 1 | NULL | 0 |
| 2 | position | INT UNSIGNED | 1 | NULL | 0 |
| 3 | name | TEXT | 1 | NULL | 0 |
| 4 | full_name | TEXT | 1 | NULL | 0 |
| 5 | led_color | TEXT | 1 | NULL | 0 |
| 6 | screen_color | TEXT | 1 | NULL | 0 |

Row count: **30**


### Schema — `product_sizes_layouts_sets`

| cid | name | type | notnull | dflt_value | pk |
| --- | --- | --- | --- | --- | --- |
| 0 | id | INT UNSIGNED | 1 | NULL | 1 |
| 1 | product_size_id | INT UNSIGNED | 1 | NULL | 0 |
| 2 | layout_id | INT UNSIGNED | 1 | NULL | 0 |
| 3 | set_id | INT UNSIGNED | 1 | NULL | 0 |
| 4 | image_filename | TEXT | 1 | NULL | 0 |
| 5 | is_listed | BOOLEAN | 1 | NULL | 0 |

Row count: **41**


### Schema — `sets`

| cid | name | type | notnull | dflt_value | pk |
| --- | --- | --- | --- | --- | --- |
| 0 | id | INT UNSIGNED | 1 | NULL | 1 |
| 1 | name | TEXT | 1 | NULL | 0 |
| 2 | hsm | INT UNSIGNED | 1 | NULL | 0 |

Row count: **11**


### Schema — `tags`

| cid | name | type | notnull | dflt_value | pk |
| --- | --- | --- | --- | --- | --- |
| 0 | entity_uuid | TEXT | 1 | NULL | 1 |
| 1 | user_id | INT UNSIGNED | 1 | NULL | 2 |
| 2 | name | TEXT | 1 | NULL | 3 |
| 3 | is_listed | BOOLEAN | 1 | NULL | 0 |

Row count: **0**


### Schema — `walls_sets`

| cid | name | type | notnull | dflt_value | pk |
| --- | --- | --- | --- | --- | --- |
| 0 | wall_uuid | TEXT | 1 | NULL | 1 |
| 1 | set_id | INT UNSIGNED | 1 | NULL | 2 |

Row count: **0**



## Q3 — Type/kind columns on `climbs`

Candidate columns inspected: `layout_id`, `setter_id`, `hsm`, `frames_count`, `frames_pace`, `is_draft`, `is_listed`


### `layout_id` (INT UNSIGNED)

| layout_id | n |
| --- | --- |
| 1 | 315357 |
| 8 | 28330 |
| 5 | 637 |
| 2 | 160 |
| 7 | 12 |
| 6 | 6 |
| 3 | 2 |

### `setter_id` (INT UNSIGNED)

| setter_id | n |
| --- | --- |
| 283023 | 5130 |
| 1999 | 1678 |
| 520723 | 1533 |
| 158200 | 1049 |
| 7292 | 1038 |
| 642813 | 999 |
| 1061 | 862 |
| 1051 | 840 |
| 143376 | 789 |
| 6739 | 786 |
| 1410 | 734 |
| 43688 | 687 |
| 7269 | 683 |
| 5058 | 664 |
| 259397 | 604 |

### `hsm` (INT UNSIGNED)

| hsm | n |
| --- | --- |
| 3 | 276055 |
| 1 | 60554 |
| 11 | 2956 |
| 7 | 1794 |
| 15 | 1430 |
| 2 | 786 |
| 5 | 514 |
| 9 | 248 |
| 13 | 106 |
| 10 | 20 |
| 4 | 13 |
| 14 | 12 |
| 6 | 11 |
| 8 | 5 |

### `frames_count` (INT UNSIGNED)

| frames_count | n |
| --- | --- |
| 1 | 343987 |
| 5 | 58 |
| 6 | 50 |
| 7 | 34 |
| 8 | 28 |
| 9 | 24 |
| 12 | 23 |
| 13 | 18 |
| 19 | 14 |
| 11 | 14 |
| 10 | 14 |
| 26 | 13 |
| 14 | 13 |
| 24 | 12 |
| 23 | 11 |

### `frames_pace` (INT UNSIGNED)

| frames_pace | n |
| --- | --- |
| 0 | 343987 |
| 10000 | 179 |
| 1000 | 34 |
| 60000 | 6 |
| 3155 | 4 |
| 15544 | 2 |
| 11844 | 2 |
| 11645 | 2 |
| 9306 | 2 |
| 8013 | 2 |
| 5935 | 2 |
| 4622 | 2 |
| 3868 | 2 |
| 3794 | 2 |
| 3543 | 2 |

### `is_draft` (BOOLEAN)

| is_draft | n |
| --- | --- |
| 0 | 344504 |

### `is_listed` (BOOLEAN)

| is_listed | n |
| --- | --- |
| 1 | 251895 |
| 0 | 92609 |


## Q4 — Hold count distribution (`frames` field, layout_id=1)

Counts `p` occurrences in `frames` — each hold is encoded as `p{id}r{role}`.


```sql
SELECT
  (LENGTH(frames) - LENGTH(REPLACE(frames, 'p', ''))) AS num_holds,
  COUNT(*) AS n
FROM climbs
WHERE layout_id = 1
GROUP BY num_holds
ORDER BY num_holds DESC
LIMIT 20;
```

**Top 20 (highest hold counts):**

| num_holds | n |
| --- | --- |
| 407 | 1 |
| 394 | 1 |
| 306 | 1 |
| 270 | 1 |
| 247 | 1 |
| 198 | 1 |
| 173 | 1 |
| 165 | 1 |
| 151 | 1 |
| 141 | 1 |
| 133 | 1 |
| 129 | 1 |
| 123 | 1 |
| 121 | 2 |
| 120 | 2 |
| 113 | 4 |
| 109 | 1 |
| 108 | 1 |
| 106 | 1 |
| 105 | 1 |

**Bottom 10 (lowest hold counts):**

| num_holds | n |
| --- | --- |
| 1 | 1 |
| 2 | 336 |
| 3 | 561 |
| 4 | 1271 |
| 5 | 2765 |
| 6 | 6235 |
| 7 | 11625 |
| 8 | 19703 |
| 9 | 27793 |
| 10 | 33723 |


## Q5 — Middle-hold (cyan, role=13) count distribution

Counts `r13` occurrences in `frames` for layout_id=1. Middle holds are the cyan/blue hand holds that define the bulk of a boulder's move sequence.


```sql
SELECT
  uuid, name, layout_id,
  (LENGTH(frames) - LENGTH(REPLACE(frames, 'r13', ''))) / 3 AS middle_holds
FROM climbs
WHERE layout_id = 1
ORDER BY middle_holds DESC
LIMIT 30;
```

| uuid | name | layout_id | middle_holds |
| --- | --- | --- | --- |
| 5AC528EB88344ABE835335DC6BDB215D | Tetris a la Kilter | 1 | 403 |
| 8B005FF52E9F49AE8BC9EB249524497B | intro fra resi | 1 | 168 |
| 3E0A3B586A0D4619B4C2BA1EBA7F4EEA | Dance party 👯‍♀️ 💃 | 1 | 136 |
| 4BAFCA774B8B48DD9AC3F30AFC16929F | Project 99 | 1 | 116 |
| 449dd70d42c24a20bb752468d8f31735 | TWP Spooky like Sunday Morning | 1 | 104 |
| 0ff722df5f754a9e875996757a7403e1 | TWP Working Hard on the Graveyard Shift | 1 | 96 |
| AE0C18D73BE44DE6AE074317D41E49C2 | MARRY ME? | 1 | 91 |
| F142693E7BF54FBEA3DC936E263DEEF5 | Happy New Year! 🎉 | 1 | 89 |
| C2AF976F349849E5BED2D2A4C327BC86 | Enduro Corner | 1 | 81 |
| 5367B9C314F6488F89D6DDF99CAED1C9 | heo bear 01 | 1 | 74 |
| 93E5AB56A3E94CB5BF827526D0F32D78 | heobear 09 | 1 | 74 |
| 9009dafe7e6c49acb17753e2286b43db | Twister 12x12 Original | 1 | 72 |
| c576ff6b5b51414b9c80f115b6580c10 | Fortississimo | 1 | 71 |
| B0CB3A68EDA44D658DCA5125F83AB6DC | Master Tester 2021 | 1 | 70 |
| 19E0423217E74DA39974EC21F8492C56 | Red blood strains | 1 | 70 |
| F6A1A6AF07564593B0A74E06CD0DEC99 | Tim Cheese | 1 | 69 |
| 7916699BDBF34236B3920A362C5A9FD5 | 2025 WD | 1 | 67 |
| 8C3620B3BB1C48A3AB009C901552B525 | Lio 4 | 1 | 67 |
| E1EB12B5DA1B4E878A60742098980FE9 | Training Route 1 | 1 | 60 |
| bc2102a9362b4b549bebd18bd5490e71 | drafty route | 1 | 60 |
| A7BECE02E4B741F69DD6D87E47A7D555 | Gingerbread | 1 | 59 |
| A17162C6F8614DE38A28923EC25BF784 | Masters tester M1 | 1 | 57 |
| E346240E82C14B3BA46B092DC8F79D0D | Yellow flower | 1 | 57 |
| 2FAB0D46DECA459B8FF0EFBCBF22C04A | heobear 02 | 1 | 56 |
| CFF7BC253D2741D8853344176EE236F2 | Precision M Circuit | 1 | 56 |
| 05553868db094f1a9f47a92efd835113 | Testy 40r | 1 | 56 |
| 7E0766E4B77B4F69A2F5BCCBA4DE5A79 | Kilter country full | 1 | 56 |
| ceddf2e9db2a43efb353b76045f72d36 | A Never Sending Story | 1 | 55 |
| 41b50c0345014374a9609ebd815345dc | 지지 HIGH | 1 | 55 |
| 89614c03231a4947b6155384f0ae8424 | Twister 8x12 Original | 1 | 54 |

### Full middle-hold distribution (layout_id=1, binned where needed)

```sql
SELECT middle_holds, COUNT(*) AS n
FROM (
  SELECT (LENGTH(frames) - LENGTH(REPLACE(frames, 'r13', ''))) / 3 AS middle_holds
  FROM climbs
  WHERE layout_id = 1
)
GROUP BY middle_holds
ORDER BY middle_holds;
```

| middle_holds | n |
| --- | --- |
| 0 | 3101 |
| 1 | 3082 |
| 2 | 12521 |
| 3 | 34731 |
| 4 | 62996 |
| 5 | 68187 |
| 6 | 50066 |
| 7 | 28286 |
| 8 | 14986 |
| 9 | 7915 |
| 10 | 4928 |
| 11 | 3430 |
| 12 | 2677 |
| 13 | 2033 |
| 14 | 1870 |
| 15 | 1621 |
| 16 | 1480 |
| 17 | 1203 |
| 18 | 1081 |
| 19 | 961 |
| 20 | 949 |
| 21 | 749 |
| 22 | 800 |
| 23 | 739 |
| 24 | 683 |
| 25 | 576 |
| 26 | 570 |
| 27 | 428 |
| 28 | 455 |
| 29 | 397 |
| 30 | 441 |
| 31 | 489 |
| 32 | 498 |
| 33 | 268 |
| 34 | 11 |
| 35 | 9 |
| 36 | 9 |
| 37 | 4 |
| 38 | 13 |
| 39 | 11 |
| 40 | 5 |
| 41 | 9 |
| 42 | 6 |
| 43 | 11 |
| 44 | 4 |
| 45 | 12 |
| 46 | 3 |
| 47 | 3 |
| 48 | 4 |
| 49 | 4 |
| 50 | 2 |
| 51 | 4 |
| 52 | 3 |
| 53 | 3 |
| 54 | 1 |
| 55 | 2 |
| 56 | 4 |
| 57 | 2 |
| 59 | 1 |
| 60 | 2 |
| 67 | 2 |
| 69 | 1 |
| 70 | 2 |
| 71 | 1 |
| 72 | 1 |
| 74 | 2 |
| 81 | 1 |
| 89 | 1 |
| 91 | 1 |
| 96 | 1 |
| 104 | 1 |
| 116 | 1 |
| 136 | 1 |
| 168 | 1 |
| 403 | 1 |


## Q6 — Ascent-count cross-reference for high-middle-hold climbs

### `climb_stats` schema

| cid | name | type | notnull | dflt_value | pk |
| --- | --- | --- | --- | --- | --- |
| 0 | climb_uuid | TEXT | 1 | NULL | 1 |
| 1 | angle | INT UNSIGNED | 1 | NULL | 2 |
| 2 | display_difficulty | FLOAT UNSIGNED | 1 | NULL | 0 |
| 3 | benchmark_difficulty | FLOAT UNSIGNED | 0 | NULL | 0 |
| 4 | ascensionist_count | INT UNSIGNED | 1 | NULL | 0 |
| 5 | difficulty_average | FLOAT UNSIGNED | 1 | NULL | 0 |
| 6 | quality_average | FLOAT UNSIGNED | 1 | NULL | 0 |
| 7 | fa_username | TEXT | 1 | NULL | 0 |
| 8 | fa_at | TEXT | 1 | NULL | 0 |

```sql
SELECT
  c.uuid, c.name,
  (LENGTH(c.frames) - LENGTH(REPLACE(c.frames, 'r13', ''))) / 3 AS middle_holds,
  MAX(cs.ascensionist_count) AS max_ascents
FROM climbs c
LEFT JOIN climb_stats cs ON cs.climb_uuid = c.uuid
WHERE c.layout_id = 1
  AND (LENGTH(c.frames) - LENGTH(REPLACE(c.frames, 'r13', ''))) / 3 > 15
GROUP BY c.uuid
ORDER BY max_ascents DESC NULLS LAST
LIMIT 20;
```

| uuid | name | middle_holds | max_ascents |
| --- | --- | --- | --- |
| B602AD26A9F54360BC5A69EF2E0CA132 | Pump 540° | 26 | 920 |
| 4F5720539CE043028D87B982E742C1FB | The Obvious Child | 23 | 740 |
| 2B901F7B9CA6482ABA938516B9CC56BF | Hultqvist’s no 3 | 44 | 701 |
| db8c8c7cfde342c0b8692f9fc158bb19 | Driftwood | 34 | 675 |
| a6f64df59a2e4afa8bac10cb245af89e | BFF (20moves) | 19 | 655 |
| 9C54330D7B014C29A0F7E417FB760629 | Blue Granite | 18 | 552 |
| 28FF59C2410842118D4F00486D7DDD90 | Night Drive | 24 | 538 |
| 3757e21895a74bb7bf1a3114f971b5fc | Please don't sandback me! | 30 | 436 |
| 53732523C8AD49D4ADA462BEE913354D | Back To Basics | 28 | 416 |
| 103b1de79e9646c189c820389a650850 | ddddR6 | 25 | 401 |
| 665C2AB67F1340F7AE3DB02B41212D29 | Square Route | 22 | 395 |
| 27569F3B74394E099EC8B4CA4D5FF5FF | Rookies | 25 | 374 |
| A1E742A9B54F4EC0AEF15408969589B1 | Tech Trainer | 20 | 354 |
| 85FF68328CC64CBDA6B981004E486A30 | Cocobolo | 19 | 339 |
| E410ED926CB9421BB8EA4E97D05694A1 | Lonestar State of Mind | 23 | 296 |
| 612E9D4CC8C64108899DE258A609EA2F | Loop de Loop 🙃 | 28 | 276 |
| C91028D990314ACAAD26F7B517CE88E0 | Mega Enduro | 33 | 258 |
| 53A6A2079FE346618831863692791439 | crossLoopLF1 | 27 | 247 |
| 327695BC30CA4FE88293FBF9A9A3D8C7 | pride rock | 18 | 225 |
| 6642D0474A7448D284CBC6845943D8BB | Hueftle 💗 | 24 | 200 |


## Q7 — Sample inspection: high-middle-hold suspects vs median boulders

### Top 5 suspects (highest middle-hold counts)

| uuid | name | description | setter_username | is_listed | is_draft | hsm | angle | middle_holds | max_ascents | frames |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 5AC528EB88344ABE835335DC6BDB215D | Tetris a la Kilter |  | mkclimb | 1 | 0 | 1 | 50 | 403 | NULL | p1098r13p1115r13p1132r12p1149r12p1202r13p1218r13p1219r13p1220r13p1249r13p1250r13p1267r13p1268r13p1288r13p1304r13p1305r1… |
| 8B005FF52E9F49AE8BC9EB249524497B | intro fra resi |  | edfresi | 1 | 0 | 3 | 40 | 168 | NULL | p1194r12p1211r12,p1194r13p1211r13,p1194r15p1211r15,"p1194r13,"p1211r13,"p1228r13,"p1245r13,"p1262r13,"p1229r13p1263r13,… |
| 3E0A3B586A0D4619B4C2BA1EBA7F4EEA | Dance party 👯‍♀️ 💃 | Get on the wall (put hands on the blue)  HIT THE BLUE SQUARES/RECTANGLES | gmrcc_rutland | 1 | 0 | 1 | 15 | 136 | NULL | p1297r13p1300r13p1302r12p1305r13p1314r13p1317r13p1319r13p1322r13p1331r13p1332r13p1333r13p1334r13p1336r13p1338r13p1339r1… |
| 4BAFCA774B8B48DD9AC3F30AFC16929F | Project 99 | Free Feet | ksmd | 1 | 0 | 1 | NULL | 116 | 6 | p1145r12p1146r12,"p1195r13,"p1229r13,"p1260r13,"p1312r13,"p1364r13,"p1351r13,"p1350r13,"p1338r13,"p1303r13,"p1307r13,"p… |
| 449dd70d42c24a20bb752468d8f31735 | TWP Spooky like Sunday Morning | (top oranges are the end holds) Recommended 40/60 seconds | RoryLaye | 0 | 0 | 1 | 45 | 104 | NULL | p1099r15p1120r15p1133r15p1154r15p1165r15p1200r15p1214r15p1221r12p1234r12p1235r15p1236r13p1252r15p1267r13p1282r15p1300r1… |

### 5 climbs near the median middle-hold count

_(average middle_holds = 6.0393078320760285)_


| uuid | name | description | setter_username | is_listed | is_draft | hsm | angle | middle_holds | max_ascents | frames |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 36E949A6395D4290AF08FDFBCC6010C1 | Bell of the Wall |  | KilterStudio | 1 | 0 | 1 | NULL | 4 | 76388 | p1169r15p1183r15p1198r15p1234r12p1236r12p1268r13p1284r13p1317r13p1353r13p1387r14 |
| 4E20BED475EC45BF8A91FECF57245DD8 | Can You Ear Me Now? |  | KilterStudio | 1 | 0 | 1 | NULL | 4 | 46803 | p1137r15p1190r15p1240r12p1255r12p1307r13p1321r13p1324r13p1373r13p1387r14 |
| 55E48B84E146476084918FBDAC0D291A | kevin noooo |  | jwebxl | 1 | 0 | 1 | NULL | 4 | 45189 | p1078r15p1082r15p1128r12p1149r12p1150r15p1218r13p1239r13p1288r13p1341r13p1390r14 |
| 18E34282FDF54D6BA0A3A7B57F0F2689 | proj braj |  | jwebxl | 1 | 0 | 1 | NULL | 4 | 39038 | p1086r15p1113r15p1145r12p1163r12p1186r13p1198r13p1254r13p1283r13p1353r14 |
| 12607465EA63447398E65FC379C61CD7 | Romeo |  | KilterStudio | 1 | 0 | 1 | NULL | 4 | 36800 | p1204r15p1233r12p1235r12p1283r13p1287r13p1337r13p1368r13p1385r14 |


## Extra — Cross-tab: `is_listed` × `is_draft` × middle_holds buckets

| is_listed | is_draft | bucket | n |
| --- | --- | --- | --- |
| 1 | 0 | boulder (≤12) | 220192 |
| 1 | 0 | long boulder (13-20) | 5268 |
| 1 | 0 | route-ish (21-40) | 2539 |
| 1 | 0 | circuit/route (>40) | 75 |
| 0 | 0 | boulder (≤12) | 76714 |
| 0 | 0 | long boulder (13-20) | 5930 |
| 0 | 0 | route-ish (21-40) | 4616 |
| 0 | 0 | circuit/route (>40) | 23 |


## Recommendation

### Proposed WHERE clause (Brief A — move count filter)

```sql
WHERE layout_id = 1
  AND is_listed = 1
  AND frames_count = 1
  AND (LENGTH(frames) - LENGTH(REPLACE(frames, 'r13', ''))) / 3 + 2 BETWEEN :min AND :max
```

### Justification per clause

| Clause | Why | Source data |
|---|---|---|
| `layout_id = 1` | Scope to Original Kilter Board (315,357 climbs, 91.5% of DB). Other layouts are Homewall, Mini, etc. — already filtered everywhere else in the app. | Q3 `layout_id` breakdown |
| `is_listed = 1` | Excludes 92,609 unvalidated/private climbs. Standard practice — these are drafts-in-spirit that the setter never published. | Q3 `is_listed` — 251,895 listed vs 92,609 unlisted |
| `frames_count = 1` | **Primary circuit filter.** Excludes the 517 multi-frame "sequence circuits" (playlists encoded as a single climbs row). Their `frames` column contains multiple comma-separated patterns, one per "boulder in the loop". | Q3 `frames_count` — 343,987 of 344,504 rows are `=1` |
| `is_draft = 0` | Redundant (100% of rows have `is_draft=0`), but cheap and future-proof if BoardLib ever starts shipping drafts. Omit if you prefer a tighter query. | Q3 `is_draft` — single value |
| middle-hold math | `moves = middles + 2`. The `r13` substring count / 3 is the middle count (each hole encoded as `p{id}r13` = 4–5 chars, but dividing by 3 after the replace-trick is the standard SQLite pattern). | Q5 distribution |

### Edge cases to discuss with Daniele

1. **Long routes (20–33 middle holds) are legitimate climbs.** E.g. "Pump 540°" (26, 920 ascents), "Hultqvist's no 3" (44, 701 ascents), "Driftwood" (34, 675 ascents), "Please don't sandback me!" (30, 436 ascents). These are what a gym-goer would call "enduro routes". The filter should **include them by default** if the slider range permits. Consider letting the user pull the max slider up to ~35 to expose this tail.

2. **UX range cap.** The distribution past 33 middle holds is noise (33: 268 climbs, 34: 11, 35: 9, …, 403: 1). A slider capped at **30–35** (i.e. max ~32–37 moves) would cover 99.9% of useful climbs without exposing outliers in the range UI. Recommend slider range `[2, 32]` moves (middles 0–30).

3. **0-middle-hold climbs exist** (3,101 of them). These are 2-move problems — just start + finish, no cyan holds. Legitimate short boulders. The `+ 2` formula gives them `moves = 2`, which matches the lower bound of the proposed slider. Keep them.

4. **`frames_count = 1` excludes some things that *look* like circuits but aren't in the sequence-circuit sense.** E.g. "Tetris a la Kilter" (403 middle holds, `frames_count = 1`) is a single static 12×12 full-board pattern — not a playlist. The hold-count cap (#2) handles these, not the `frames_count` clause.

5. **`is_listed = 1` may remove some climbs that are currently visible in the app.** Before adding this clause, check whether `app/api/climbs.py` already applies it (high likelihood — it's the canonical BoardLib search pattern). If it does, this clause is a no-op. If not, adding it **will reduce search result counts** and Daniele should confirm that's the desired behavior (it almost certainly is — unlisted climbs are noise).

6. **`hsm` was investigated but is not a circuit signal.** Most climbs have `hsm = 3` (276,055) or `hsm = 1` (60,554). `hsm` correlates with the `sets` table (which hold set the climb uses) and a separate hsm value on `product_sizes_layouts_sets` — it's a hold-set/size discriminator, not a climb-type one. **Do not use `hsm` in the circuit filter.**

7. **The `hsm` of the `sets` table may be useful later** for a separate "training set only" filter (Phase 3 — AI Session Builder), but is out of scope for the moves filter.

### Single recommended SQL fragment to add to `climb_service.py` (Brief A)

```python
# In the search query builder, add:
WHERE_FILTERS.append("is_listed = 1")
WHERE_FILTERS.append("frames_count = 1")
# And for the moves filter:
if moves_min is not None:
    WHERE_FILTERS.append(
        "((LENGTH(frames) - LENGTH(REPLACE(frames, 'r13', ''))) / 3 + 2) >= :moves_min"
    )
    params["moves_min"] = moves_min
if moves_max is not None:
    WHERE_FILTERS.append(
        "((LENGTH(frames) - LENGTH(REPLACE(frames, 'r13', ''))) / 3 + 2) <= :moves_max"
    )
    params["moves_max"] = moves_max
```

_The LENGTH/REPLACE trick is SQLite-specific but fast — no full-table scan once combined with the existing `layout_id` index. If performance degrades at scale, consider adding a computed column `middle_holds_count` + index in a future migration._

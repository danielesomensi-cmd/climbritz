# 🧗 Claude Code Guidelines - Kilter-Up App

## Project Overview
**Kilter-Up** — AI-powered climbing form analysis app.

**Core Value Proposition:**
- Upload a climbing video → Gemini File API analyzes your form → get structured coaching feedback
- NOT a circuit recognition app. Form analysis is the core.

**Primary Tech Stack:**
- Frontend: Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
- Backend: Python 3.11 + FastAPI + PostgreSQL + SQLAlchemy + Alembic
- AI: Gemini Vision API (form analysis)
- Circuit recognition: BoardLib API (supplementary only)
- Storage: Local filesystem (dev) → S3 (prod, week 3)

## 🎯 CORE STRATEGY (Non-Negotiable)

**One product, two tiers:**

| Tier | Name | Value prop | Price |
|------|------|------------|-------|
| **Free** | Discovery | Search 160k+ climbs by grip type, AI session builder, problem generation, BLE board connection, attempt logging | Free |
| **Paid** | Coach | Video upload → Gemini AI technique analysis with climb context (Levels 1–3), move-by-move coaching | €7.99/month |

**Key asset — hold classification database:**
Every hold on the Kilter Board tagged by grip type: Jug / Good Crimp / Crimp / Sloper / Undercling / Pinch. No competitor has this. Enables grip-type filtering, session builder, problem generation, and BLE "illuminate only [type]" feature.

**BLE is in scope** (Phase 3e): Capacitor wraps Next.js → native iOS/Android app. BLE runtime path is `lib/ble/transport.ts` (thin wrapper over `@capacitor-community/bluetooth-le`) + `lib/ble/kilter-board-service.ts` (Kilter-specific orchestration + UUIDs) + `lib/ble/kilter-protocol.ts` (pure packet encoder, API level 3). Web Bluetooth / Grip Connect are NOT on the runtime path — `@hangtime/grip-connect` stays in `package.json` as protocol reference only (never imported). `UnsupportedBoardError` is thrown for API level 2 boards (no `@` or `@2` in device name). Protocol docs: https://github.com/1-max-1/fake_kilter_board

**Discovery competitors:** Climbdex (free, open-source, no AI), Kilter Lookup (limited filters, no AI), kilterboard.io (official new Kilter app, no AI, no grip-type filter).

**Coach — Gemini Vision analyzes:**
- Hold positions and quality
- Body tension and posture
- Efficiency score
- Specific weaknesses (e.g., "weak on sloper finish")
- Grade estimate

---

## 📦 Current State (A019 Complete — 5 May 2026)

✅ **Phase 1:** FastAPI backend, Clerk auth (A020 — was custom JWT until then), User model, Alembic migrations
✅ **Phase 2:** Video upload + Gemini File API analysis (consolidated pipeline)
✅ **B001:** Codebase rationalization — single endpoint set, clean migrations, all tests green
✅ **B007:** Kilter Board-specific prompt rework — board detection, 5 scores, drills per issue
✅ **B008:** Kilter Board completion rules added to prompt — match on finish hold = send, post-match drop = dismount not fall
✅ **D010:** Backend pytest CI fix — env vars added to GitHub Actions workflow
✅ **Phase 3a:** BoardLib DB setup — climb_service.py, test fixture DB
✅ **Phase 3b:** Climb search + detail API (extended in A011 with grade/ascents/quality/sort filters)
✅ **A011:** Discovery frontend — `/discover` (search + filter panel) + `/discover/detail?id=` (board visualization with role colors). BottomNav added.
✅ **HC-2:** 12x12 board map (composite background, annotated, mobile-friendly)
✅ **HC-5:** Hold classification UI (`/classify` — mobile, board map per hold, manual classification flow)
✅ **B013:** Auto-provision BoardLib kilter.db on Railway first boot
✅ **D014:** Railway DB startup validation — probe `SELECT 1 FROM climbs` + `_validate_boardlib_db()`
✅ **B016:** Board visualization fixes — hollow rings for active holds, screw-on footholds sized smaller, kickboard row included (y∈[0,156]), HoldPosition.set_id plumbed through backend → frontend
✅ **A006:** BLE LED test — Capacitor Android project, `/ble-test` page with 10 LED presets sourced from `leds` table (layout_id=1), `use-kilter-ble` hook over Capacitor BLE
✅ **B009:** Visual board preview on `/ble-test` — board image + colored circles at correct hold positions, pre-computed from product_size_id=10 coordinates
✅ **B010:** Homepage redesign (4-tile hub) + Play Store release build (signed AAB/APK) + privacy policy + Capacitor mobile fixes (CORS, dynamic routes → query params, board image, back buttons, network security)
✅ **B011:** Fix Android manifest BLE permissions — bounded ACCESS_FINE/COARSE_LOCATION to maxSdkVersion=30, no spurious location prompt on Android 12+
✅ **B012:** BLE LED packet transmission — pure encoder (`kilter-protocol.ts`), `sendLEDPreset`/`sendAllOff` in service, "Illumina board" button + error banner in `/ble-test`, API level 3 only
✅ **A016:** iOS Capacitor setup — `@capacitor/ios ^8.3.1`, `ios/` Xcode project initialized (SPM-based, no CocoaPods), `NSBluetoothAlwaysUsageDescription` in Info.plist, `build:mobile` split into platform-agnostic build + `sync:ios`/`sync:android`/`open:ios`/`open:android`, first device build running on iPhone 15 (iOS 26.2) via personal Apple Developer account
✅ **B014:** BLE LED test UX polish — auto-apply on preset tap with 200ms debounce, BLE writes serialized via hook-level promise chain (no chunk interleave), Connetti/Disconnetti enlarged to card-sized buttons, creative presets #6-#10 authored on the 17×18 main-hold grid via new `grid(col,row)` helper
✅ **B014-iter:** Preset visual fixes after gym validation — climber redrawn with asymmetric reaching pose (replacing T-pose "crucifix"), heart stripped of white shine (uniform red outline + magenta fill), lightning extended to near-full-board-height zigzag (rows 2-17), smile enlarged to 11×11 rounded circle with unambiguous eyes + U-shape smile
✅ **B014-iter-2:** Art presets overhaul — replaced diagnostic presets #1-#5 with pixel art (Space Invader green, Ghost Blinky red + white/cyan eyes, Zelda Heart mono-red 8-bit, yellow 5-point Star, orange-centre + yellow-rays Sun) and added preset #11 All LEDs Diagnostic (stress test lighting all 476 positions in y-banded rainbow stripes, col-span-2 in the grid with amber accent)
✅ **A015:** Universal BottomNav (added to `/classify` and `/ble-test`, `← Home` text links dropped) + BLE illumination on `/discover/detail` — `ClimbBleControls` component reuses the `/ble-test` hook, `climb-to-leds.ts` maps climb holds to `EncoderHold[]` via static `app/data/leds_12x12.json` (476-entry placement_id → LED position map, generated from BoardLib DB by `regenerate_board_assets.py`). Single source of truth for role → color stays in `kilter-protocol.PLACEMENT_ROLES`.
✅ **A014:** Next/Prev navigation on `/discover/detail` — `filtered-list-storage.ts` persists the active filter result set in sessionStorage (24h TTL, uuid-based validity check), detail page renders a "← Prev / N of M / Next →" row (hidden on deep links / stale lists). `ClimbBleControls` gained `climbKey`+`autoSendOnKeyChange` props: when the user taps Next/Prev and the board is connected, the new climb is auto-sent with a 300ms debounce (rapid taps coalesce into a single BLE packet on the last climb).
✅ **B017:** Discovery UX fixes after gym validation — (1) Prev/Next buttons on `/discover/detail` enlarged to card-sized tap targets (`min-h-16`, `text-xl font-bold`) so flipping climbs with a tired thumb during rest intervals is fast; (2) app-wide safe-area sweep — new `.pt-safe`/`.pb-safe` CSS utilities in `app/safe-area.css` (separate from globals.css because Tailwind v4 strips plain class rules from the Tailwind entrypoint), `viewport-fit=cover` added via `viewport` export in `app/layout.tsx`, applied to all 12 pages plus `pb-safe` on BottomNav; (3) Discovery filter state (`query` + `angle` + `filters`) now persists in sessionStorage (`kilter-up:discover:filters`, 24h TTL) so the filter UI restores on return from `/discover/detail` — URL params still win on mount for shareable deep links; (4) prominent Filters button — full-width 56px-tall toggle embedded in the sticky `/discover` header, neutral dark bg when no filter active, brand orange + count badge when any filter (grade range, min ascents, min stars, or non-default sort) is applied. Panel `expanded` state lifted from `FilterPanel` into `DiscoverPage`; `countActiveFilters()` exported from `FilterPanel` as the single source of truth for the badge count; aria-expanded + aria-controls wired up.
✅ **A019:** Move count chip filter on `/discover` — new Moves section in `FilterPanel` between MIN STARS and SORT BY (chips: Any / ≤5 / 6–7 / 8–10 / >10, default Any). Backend: optional `moves` query param on `GET /api/climbs/search`, applied as a SQL WHERE on `((LENGTH(c.frames) - LENGTH(REPLACE(c.frames, 'r13', ''))) / 3 + 2)` — no schema change, no computed column. Animated multi-frame sequences (`frames_count > 1`) now excluded from search globally (D016): they're circuits, not boulders, and the moves formula doesn't apply — Phase 8+ will surface them in a dedicated UX. `MovesFilter` Literal in `backend/app/schemas/climb.py` and `app/lib/api.ts`; `countActiveFilters()` extended to count any non-Any moves bucket. Test fixtures regenerated by `backend/scripts/seed_a019_test_fixtures.py` (idempotent), seeding A019-prefixed rows for each bucket plus one `frames_count=3` row that validates the global animated-sequence exclusion.
✅ **A020:** Clerk auth integration — legacy custom-JWT stack (auth.py, auth_service.py, security.py, schemas/auth.py) deleted; replaced with hosted Clerk widget at `/sign-in` + `/sign-up` (SPA-mode `@clerk/clerk-react`), backend JWKS verification via `core/clerk.py` + new `get_current_user_id` dependency, `users` table reduced to a Clerk shadow row (id, clerk_id, created_at, updated_at) via alembic 003. Production startup guard refuses to boot without `CLERK_JWKS_URL`. iOS WKAppBoundDomains + Capacitor `allowNavigation` configured for the Clerk Frontend API. AuthGuard gates routes client-side via `useAuth()` (no `middleware.ts` — incompatible with `output: 'export'`, Clerk issue #4647). **A019.16 widened the protection scope:** ALL pages require login except `/sign-in`, `/sign-up`, `/privacy`, `/debug`. Discovery is still the free tier (no payment) but no longer anonymous — needed because per-user logging (send/project) depends on a guaranteed user_id, and a guest mode would be a confusing dead-end.
✅ **B020:** Discover search cap raised from 50 (backend max) / 30 (frontend hardcode) to 500. **On-device validated 2026-05-11** — broad-filter search scrolls, overflow banner renders, Next/Prev walks the full list end-to-end on the device. `GET /api/climbs/search` returns `{climbs, total_count}` envelope; new `count_matching_climbs` sibling shares a `_build_search_filters()` helper with `search_climbs` (count query drops the projection-only `difficulty_grades` JOIN). Frontend renders all returned climbs; orange overflow banner ("Mostro i primi 500 di 1247 risultati. Restringi i filtri per essere più preciso.") appears when `total_count > climbs.length`. `ClimbCard` wrapped in `React.memo` so 500-card lists don't re-render on every parent tick. `filtered-list-storage.ts` already supports the larger list (500 uuids ≈ 18 KB, well under the ~5 MB sessionStorage budget). 13 new tests (7 endpoint + 6 service + 5 frontend banner).

**Video API surface:**
- `POST /api/videos/upload` → 202 (background Gemini analysis)
- `GET /api/videos/{id}` → video + status/results
- `GET /api/videos` → paginated list
- `DELETE /api/videos/{id}` → delete

**Auth API surface (A020):**
- Authentication is owned by Clerk. Sign-in/sign-up live at the hosted widget on `/sign-in` and `/sign-up` (frontend). The backend has no `/api/auth/*` endpoints — protected routes accept `Authorization: Bearer <Clerk JWT>` (verified via `core/clerk.py` against the Clerk JWKS) or, in non-production environments only, `X-User-ID: <uuid>` as a dev/test fallback.

**Climb API surface (Phase 3b + A011 + A019 + B020):**
- `GET /api/climbs/search?q=&angle=&grade_min=&grade_max=&min_ascents=&min_quality=&moves=&sort=&limit=` → search with filters; `moves` is the A019 bucket (`any` | `le5` | `6-7` | `8-10` | `gt10`). Animated sequences (`frames_count > 1`) are excluded globally regardless of filters. **B020:** `limit` defaults to 500 with hard cap 500 (422 above). Response is the envelope `{climbs: [...], total_count: int}` — `total_count` reflects all matching climbs ignoring the cap, so the UI shows an overflow banner without a second request.
- `GET /api/climbs/{climb_uuid}?angle={angle}` → full detail with holds
- `GET /api/climbs/stats` → DB health stats

**Holds API surface (HC-5):**
- `GET /api/holds/board-image` → full board composite image
- `GET /api/holds/{placement_id}/image` → individual hold image

**Admin API surface (B013):**
- `POST /api/admin/sync-db` → JWT-protected, runs `boardlib database kilter` to download/sync the BoardLib DB
- `POST /api/admin/upload-db` → upload BoardLib DB to Railway volume (temporary, ADMIN_SECRET-protected)

**Logs API surface (A021 Phase 2):**
- `POST /api/logs` → 201, create or upgrade today's log on a climb. Body `{climb_uuid, angle, result_type}`. Result strength flash > send > attempt; tapping the same result on the same day increments `attempts_count` instead of inserting a new row; tapping a stronger result upgrades and increments. Rejects animated sequences (`frames_count > 1`) with 422. Reads `X-User-Timezone` (IANA, e.g. `Europe/Rome`) to resolve `local_date`; UTC fallback when header absent.
- `GET /api/logs?climb_uuid=&from=&to=&limit=` → flat list, scoped to the current user.
- `GET /api/logs/sessions?from=&to=` → grouped by `local_date`, descending. Each session climb is enriched with `climb_name` + `grade` via a per-request memoised BoardLib lookup (A021.5.0) so `/history` avoids N+1.
- `PATCH /api/logs/{id}` → update `result_type` and/or `attempts_count`. Recomputes the matching `user_climbs` row.
- `DELETE /api/logs/{id}` → 204. Recomputes the matching `user_climbs.best_result` from the remaining logs.

**User-climbs API surface (A021 Phase 2):**
- `GET /api/user-climbs/{climb_uuid}?angle=&recent_limit=` → `{state, recent_logs}`. Powers LogSection + RecentLogs on `/discover/detail`.
- `PATCH /api/user-climbs/{climb_uuid}/project` → toggle `is_project` (idempotent — submits the desired boolean, not a flip request).

**Stats API surface (A021 Phase 2):**
- `GET /api/stats/pyramid?from=&to=&result_filter=` → `[{grade_band, count}]`. `result_filter` ∈ `flash | send_or_better | all`.
- `GET /api/stats/trend?from=&to=` → `[{week_start, flash_count, send_count, attempt_count}]`. ISO-week bucketed (Monday).

**Search overlay (A021 Phase 2 + Phase 4):** `GET /api/climbs/search` now accepts optional `done_filter` and `project_filter` query params (`all | only | exclude`) and, when the request is authenticated, enriches each returned climb with a `user_state` object `{is_project, best_result, last_logged_at}`. The chip filters pre-fetch matching uuids from `user_climbs` and pass them as include/exclude lists to the underlying search — both chips on `only` are intersected (climbs that are done AND flagged project).

**Deploy:** Backend live on Railway (SQLite). Frontend on Vercel. Health check at `/health`. B013: kilter.db auto-downloads via boardlib on first boot when `$BOARDLIB_DB_PATH` is missing (persistent volume at `/data/kilter-up`). D014: startup scripts also probe `SELECT 1 FROM climbs` and re-download if an empty file was left behind; `_validate_boardlib_db()` crashes the container in production if the DB is still invalid.

**Next:** B017 gym re-validation (Prev/Next tap-target on iPhone/Android, page titles clear of the notch/clock, filters restore on return from detail), B018 repo-hygiene pre/post-task checks (queued — triggered by a stale git-status snapshot at the start of B017), B014-iter-2 gym validation (art presets + #11 stress test), then HC-3 taxonomy validation (Daniele + Christie), HC-6 manual classification, HC-7 DB migration, Phase 3c AI Session Builder, Phase 3d Level 2 Enhanced Analysis, Phase 3e remaining items (illuminate by grip type, light generated problems, background connection management)

**Gemini:** google.genai SDK, model gemini-2.5-flash, Kilter Board-specific prompt (B007+B008), JSON repair + Pydantic validation

---

## Core Rules for Claude Development

### 📋 Code Standards
- **Language**: English for code AND rendered UI strings (climbing jargon — flash / send / attempt / project — stays untranslated). Comments + commit bodies can be Italian when natural, but never user-visible text. See `feedback_ui_english.md` in the memory store for the full rule + history.
- **Style**: Follow PEP 8 (Python), ESLint (TypeScript)
- **No secrets in code**: Use environment variables for API keys
- **Type safety**: Always use TypeScript types, Python type hints

### ✅ ALWAYS Do This
1. **Write tests for every feature** — pytest (backend), Jest (frontend)
2. **Test locally before push** — full suite must pass
3. **Run `npm run build` before every push that includes frontend changes** — pytest and jest alone do NOT catch Next.js type errors or invalid page exports; only `npm run build` does
4. **Commit with clear messages**: `feat: add video upload endpoint`
5. **Push after each working feature** — small, atomic commits
6. **Document complex logic** — docstrings for functions

### ❌ NEVER Do This
1. Commit broken code
2. Push credentials, API keys, or .env files
3. Change database schema without creating a new Alembic migration
4. Skip tests
5. Add circuit detection as a primary feature (it's Phase 4 — visual LED recognition)

### 📄 Doc Alignment Rule (Non-Negotiable)
When a change touches facts shared across docs (model version, test count, deploy status, repo URL, DB size, etc.), **update ALL files that reference that fact in the same commit.** Don't leave stale data behind.

Files to cross-check on every factual change:
- `README.md` (root) — tech stack, deploy status, repo URL
- `backend/README.md` — dependencies, model version
- `CLAUDE.md` — project structure, test references
- `PROJECT_STATUS.md` — stato attuale, credenziali, contatori
- `RESEARCH.md` — ecosystem data (DB size, LED colors, etc.)
- `ARCHITECTURE.md` — stack diagram, deployment topology

**Hard-coded numbers (test counts, climb counts, DB size) decay fast.** Prefer descriptions ("tests" not "46 tests") unless the number is the point. When a number must appear, grep all .md files for the old value before committing.

---

## 🏗️ Project Structure

```
kilter-training-app/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── videos.py           ✅ Upload, list, get, delete (uses get_current_user_id, A020)
│   │   │   ├── climbs.py           ✅ Search (+ A021.4 done_filter/project_filter + user_state overlay), detail, stats
│   │   │   ├── holds.py            ✅ Board image + hold images (HC-5)
│   │   │   ├── admin.py            ✅ Protected: sync-db + upload-db (B013, uses get_current_user_id, A020)
│   │   │   ├── logs.py             ✅ A021 — POST/GET/PATCH/DELETE /api/logs + /api/logs/sessions (X-User-Timezone resolves local_date)
│   │   │   ├── user_climbs.py      ✅ A021 — GET/PATCH /api/user-climbs/{uuid}
│   │   │   ├── stats.py            ✅ A021 — /pyramid + /trend (uses memoised BoardLib grade resolver)
│   │   │   └── circuits.py         ✅ Stub (legacy)
│   │   ├── core/
│   │   │   ├── config.py           ✅ (A020: production guard on CLERK_JWKS_URL, extra="ignore")
│   │   │   ├── database.py         ✅
│   │   │   ├── clerk.py            ✅ A020 — Clerk JWT verification (JWKS) + shadow-row upsert + 5-min in-process clerk_id cache
│   │   │   └── deps.py             ✅ (A020: get_current_user_id + A021.2.6: get_optional_user_id for overlay-only search)
│   │   ├── models/
│   │   │   ├── user.py             ✅ (A020: id + clerk_id + created_at + updated_at — Clerk shadow row)
│   │   │   ├── video.py            ✅
│   │   │   ├── climb_log.py        ✅ A021 — append-mostly source of truth (one row per user/climb/angle/local_date)
│   │   │   └── user_climb.py       ✅ A021 — derived state cache (is_project + best_result + last_logged_at)
│   │   ├── schemas/
│   │   │   ├── user.py             ✅
│   │   │   ├── video.py            ✅ VideoResponse, FormFeedbackResponse
│   │   │   ├── climb.py            ✅ ClimbSearchResult (+ user_state, A021.4), ClimbDetail
│   │   │   └── logs.py             ✅ A021 — LogCreate / LogResponse / UserClimbState / SessionResponse / PyramidEntry / TrendEntry
│   │   ├── services/
│   │   │   ├── gemini_service.py   ✅ File API (lazy init, Kilter Board prompt)
│   │   │   ├── climb_service.py    ✅ Read-only BoardLib DB queries (+ A021: get_climb_meta + include/exclude uuids on _build_search_filters)
│   │   │   ├── log_service.py      ✅ A021 — resolve_local_date / create_or_upgrade_log / list_sessions / compute_pyramid / compute_trend
│   │   │   ├── video_service.py    ✅ ffmpeg utils
│   │   │   └── storage_service.py  ✅ Local filesystem
│   │   ├── utils/
│   │   │   └── kilter_parser.py    ✅ Layout parser
│   │   └── main.py                 ✅
│   ├── alembic/versions/
│   │   ├── 001_initial_migration.py ✅
│   │   ├── 002_video_form_analysis.py ✅
│   │   ├── 003_clerk_auth.py       ✅ A020 — drop legacy users columns, recreate as Clerk shadow row
│   │   └── 004_a021_climb_logging.py ✅ A021 — climb_logs + user_climbs tables (FK to users, ON DELETE CASCADE)
│   ├── tests/
│   │   ├── test_videos.py          ✅ video + gemini tests
│   │   ├── test_climb_service.py   ✅ climb service tests
│   │   ├── test_climbs_api.py      ✅ climb API tests
│   │   ├── test_climbs_search_overlay.py ✅ A021.4 — done/project filters + user_state attach
│   │   ├── test_holds_api.py       ✅ holds API tests
│   │   ├── test_admin_api.py       ✅ admin sync-db tests (B013)
│   │   ├── test_clerk_auth.py      ✅ A020 — Clerk verification + shadow-row upsert + dep gating
│   │   ├── test_logs.py            ✅ A021 — sync rules, tz resolution (Europe/Rome / LA / UTC fallback), session enrichment
│   │   ├── test_stats.py           ✅ A021 — pyramid grade-band grouping + trend ISO-week bucketing
│   │   ├── test_startup_validation.py ✅ D014 boardlib DB checks
│   │   ├── test_kilter_parser.py   ✅
│   │   └── fixtures/test_kilter.db ✅ test fixture DB
│   ├── scripts/
│   │   └── regenerate_board_assets.py ✅ B016 — dumps placements_12x12.json + composite board PNG
│   ├── conftest.py                 ✅
│   └── requirements.txt
├── app/ (Next.js 14 frontend)
│   ├── page.tsx                    ✅ Homepage (homepage tile target updated /login → /sign-in, A020)
│   ├── upload/page.tsx             ✅ Drag-drop upload (Coach)
│   ├── sign-in/page.tsx            ✅ A020 — Clerk hosted sign-in widget (SPA mode, hash routing)
│   ├── sign-up/page.tsx            ✅ A020 — Clerk hosted sign-up widget (SPA mode, hash routing)
│   ├── login/page.tsx              ✅ A020 — redirect alias to /sign-in (backward compat)
│   ├── dashboard/page.tsx          ✅ (A020: header uses Clerk <UserButton afterSignOutUrl="/sign-in" />)
│   ├── videos/detail/page.tsx       ✅ Video detail ?id= (query-param route for Capacitor)
│   ├── videos/[id]/page.tsx        ✅ Legacy redirect → /videos/detail?id=
│   ├── classify/page.tsx           ✅ Hold classification UI (HC-5)
│   ├── classify/state.ts           ✅ Classification state management
│   ├── classify/__tests__/         ✅ Classification tests
│   ├── board-map/page.tsx          ✅ Annotated 12x12 board map (HC-2)
│   ├── discover/page.tsx           ✅ Discovery: search + filters (A011)
│   ├── discover/detail/page.tsx    ✅ Climb detail ?id=&angle= (query-param route for Capacitor, A015: BLE control bar above board, A014: Next/Prev row at bottom)
│   ├── discover/detail/climb-to-leds.ts ✅ A015 — climb holds → BLE EncoderHold[] via static leds_12x12.json
│   ├── discover/detail/__tests__/  ✅ climb-to-leds helper tests
│   ├── discover/filtered-list-storage.ts ✅ A014 — sessionStorage-backed persistence of the filtered climb list (24h TTL)
│   ├── discover/discover-filters-storage.ts ✅ B017 — sessionStorage-backed persistence of the filter UI state (query + angle + filters, 24h TTL)
│   ├── discover/[climb_uuid]/page.tsx ✅ Legacy redirect → /discover/detail?id=
│   ├── discover/__tests__/         ✅ Discovery tests (search, detail, filtered-list-storage, chip-filters A021.4)
│   ├── history/page.tsx            ✅ A021.5 — /history page: stats header + calendar + sessions + pyramid + trend
│   ├── history/calendar.tsx        ✅ A021.5 — hand-rolled CSS-grid month-by-month heatmap, no library
│   ├── history/sessions-list.tsx   ✅ A021.5 — per-day session cards w/ click-through to /discover/detail
│   ├── history/grade-pyramid.tsx   ✅ A021.5 — Recharts horizontal BarChart + flash/send_or_better/all filter
│   ├── history/trend-chart.tsx     ✅ A021.5 — Recharts LineChart + per-series toggle (flash/send/attempt)
│   ├── history/__tests__/          ✅ A021.5 — date-range, pyramid filter, calendar→scroll, error state
│   ├── ble-test/page.tsx           ✅ BLE LED test page — 10 presets + board preview (A006/B009/B014 auto-apply)
│   ├── ble-test/presets.ts         ✅ LED preset data — 10 pixel-art presets + #11 all-LEDs stress test (B014-iter-2)
│   ├── ble-test/board-preview.tsx  ✅ Board image + colored circles overlay (B009)
│   ├── ble-test/use-kilter-ble.ts  ✅ KilterBoard hook — connect/send/disconnect + write serialization (B012/B014)
│   ├── ble-test/__tests__/         ✅ Preset structure + auto-apply debounce tests (B014)
│   ├── privacy/page.tsx            ✅ Privacy policy (Play Store requirement, B010)
│   ├── debug/page.tsx              ✅ Network diagnostics (dev tool, B010)
│   ├── data/                       ✅ Frontend data files (placements_12x12.json + leds_12x12.json — both generated by backend/scripts/regenerate_board_assets.py)
│   ├── lib/api.ts                  ✅ Fetch wrapper + climb/video APIs (A020: pulls fresh JWT via window.Clerk.session.getToken() per call, 401-retry-once-then-redirect-to-/sign-in)
│   ├── lib/clerk.d.ts              ✅ A020 — ambient typing for window.Clerk
│   ├── lib/grades.ts               ✅ Difficulty → Font/V grade mapping (A011)
│   ├── lib/ble/kilter-protocol.ts  ✅ Pure packet encoder — API level 3 (B012)
│   ├── lib/ble/kilter-board-service.ts ✅ Kilter-specific BLE orchestration (B012)
│   ├── lib/ble/transport.ts        ✅ Generic Capacitor BLE wrapper (B012: +writeWithoutResponse)
│   ├── lib/ble/__tests__/kilter-protocol.test.ts ✅ Encoder unit tests (B012)
│   ├── layout.tsx                  ✅ Root layout — metadata + viewport (B017: viewportFit=cover)
│   ├── globals.css                 ✅ Tailwind v4 entrypoint
│   └── safe-area.css               ✅ B017 — .pt-safe / .pb-safe utilities (separate from globals.css because Tailwind v4 strips plain class rules from the Tailwind entrypoint)
├── components/
│   ├── BoardMap.tsx                ✅ 12x12 board canvas (HC-2)
│   ├── ClimbBoardView.tsx          ✅ Climb detail board wrapper (A011)
│   ├── ClimbCard.tsx               ✅ Search result card (A011 + A021.4 StateIcons in info column, B-A021-fix-2 moved out of absolute)
│   ├── StateIcons.tsx              ✅ A021.4 — ⚡/✓/★ icon strip, renders null when userState has no history + no project flag
│   ├── LogSection.tsx              ✅ A021.3 — 5-col single-row grid (Flash / Send / Attempt / Project / Remove) + project-removal modal w/ Android back-button
│   ├── RecentLogs.tsx              ✅ A021.3 — "History on this climb" mini-list on /discover/detail
│   ├── FilterPanel.tsx             ✅ Discovery filters (A011 + A021.4 doneFilter/projectFilter on Filters type)
│   ├── GradeDisplay.tsx            ✅ Font/V grade display (A011)
│   ├── StarRating.tsx              ✅ 5-star widget (A011)
│   ├── BottomNav.tsx               ✅ App bottom navigation (A011, A015: now on /classify + /ble-test)
│   ├── ClimbBleControls.tsx        ✅ A015/A014 — BLE connect/illuminate bar for climb detail + auto-send on Next/Prev climb change (300ms debounce)
│   ├── ClerkSpaProvider.tsx        ✅ A020 — client-only ClerkProvider wrapper (uses @clerk/clerk-react, wires routerPush/Replace to next/navigation)
│   ├── AuthGuard.tsx               ✅ A020 — uses Clerk useAuth(), redirects to /sign-in when !isSignedIn
│   └── __tests__/                  ✅ Component tests (A020: AuthGuard.test.tsx — loading/redirect/render-children)
├── capacitor.config.ts             ✅ Capacitor config (appId=com.kilterup.app, webDir=out)
├── android/                        ✅ Capacitor Android project (A006)
├── ios/                            ✅ Capacitor iOS Xcode project — SPM-based, Info.plist has NSBluetoothAlwaysUsageDescription (A016)
├── CLAUDE.md                       ✅ This file
├── PROJECT_STATUS.md               ✅ Decisions log
├── ROADMAP_ACTIVE.md               ✅ Phase plan
└── RESEARCH.md                     ✅ Ecosystem audit
```

---

## 🔧 Useful Commands

```bash
# Backend
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8001
pytest                    # Run all tests
pytest --cov             # Coverage report
alembic upgrade head     # Apply migrations

# Frontend
npm run dev
npm test
npm run build
npm run lint

# Mobile (Capacitor)
npm run build:mobile      # NEXT_PUBLIC_MOBILE=true next build (static export to out/)
npm run sync:android      # npx cap sync android
npm run sync:ios          # npx cap sync ios
npm run open:android      # open Android Studio
npm run open:ios          # open Xcode workspace

# Git
git status && git diff
git add . && git commit -m "feat: description"
git push origin main
```

---

## 📱 Capacitor Compatibility Rules (Non-Negotiable)

The app ships as a Capacitor Android APK + iOS app via `next build` with `output: 'export'`. These rules **MUST** be followed for every frontend change:

1. **NO dynamic routes (`[param]`)** for pages that must work in Capacitor. Use query params instead: `/discover/detail?id=xxx` not `/discover/[id]`. Dynamic route segments produce a single `_.html` fallback that Capacitor's WebView cannot resolve for arbitrary paths.
2. **Use plain `<img>` tags, NOT `next/image` `Image` component.** The Next.js image optimizer doesn't exist in static export — images silently fail to load.
3. **API base URL is hardcoded to Railway in mobile builds.** When `NEXT_PUBLIC_MOBILE=true`, `app/lib/api.ts` ignores `NEXT_PUBLIC_API_URL` from `.env.local` and uses the Railway prod URL — otherwise a developer-local `NEXT_PUBLIC_API_URL=http://localhost:8001` leaks into the APK and every API call hits the device's own port 8001 (silent failure). To point a mobile build at a non-prod backend, edit `app/lib/api.ts` directly.
4. **CORS on backend must include `https://localhost`** — Capacitor Android WebView sends `Origin: https://localhost`. Also allow `capacitor://localhost` (iOS) and `http://localhost` (dev).
5. **All navigation must work as SPA** — no server-side redirects, no middleware redirects. Use `router.push()` or `<Link>`.
6. **No Next.js API routes (`app/api/`)** — all API calls go to the FastAPI backend.
7. **Test every new page in Capacitor build**, not just browser. Run `npm run build:mobile && npm run sync:android` (and `sync:ios` when iOS-relevant) and verify in the device build.
8. **Use `localStorage` for auth tokens**, not cookies. Cookies may not work reliably in WebView.
9. **Capacitor builds require `NEXT_PUBLIC_MOBILE=true`** — without it, `next build` produces a server build (`.next/`) instead of a static export (`out/`), and `npx cap sync android` silently fails to copy assets.

---

## 🧪 Testing Requirements
- **Backend:** pytest, >80% coverage on new code
- **Frontend:** Jest + React Testing Library
- **Every commit must leave BOTH suites green** — no exceptions, not even pre-existing failures. If you find red tests, fix them in the same session before moving on.
- **CI:** `.github/workflows/test.yml` runs backend pytest + frontend jest + tsc + next build on every push/PR. A red CI is a blocker.
- **Local pre-commit hook** (optional but recommended): `ln -sf ../../scripts/git-hooks/pre-commit .git/hooks/pre-commit` — blocks commits with red tests. Bypass only when strictly needed with `SKIP_TESTS=1 git commit ...`.
- **Local pre-push hook** (active): `.git/hooks/pre-push` runs `npm run build` before every push — aborts if the build fails. This is the last line of defence against broken Vercel deploys.

---

## 🎬 Development Flow
1. **Receive task** → Understand scope
2. **Plan** → Files to change + dependencies
3. **Code** → Implement + tests
4. **Verify** → Run the FULL suites, not just touched areas:
   - Backend: `cd backend && source venv/bin/activate && pytest`
   - Frontend: `npx jest` + `npx tsc --noEmit`
   - Any red test — including ones you didn't touch — must be diagnosed and fixed now, not logged as "pre-existing".
5. **Commit** → Clear message (pre-commit hook will re-run the suites)
6. **Push** → Confirm push succeeded; check the GitHub Actions run stays green
7. **Doc Sync (MANDATORY)** → After every push, update ALL affected docs:
   - `ROADMAP_ACTIVE.md` — mark completed tasks with ✅, update [ ] → [x]
   - `PROJECT_STATUS.md` — update date, stato attuale table, test count
   - `ARCHITECTURE.md` — new components, updated pipeline descriptions
   - `CLAUDE.md` — current state section, project structure tree, version
   - `README.md` + `backend/README.md` — new endpoints, dependencies
   - Commit as `docs: sync after {brief_id}` and push

**This step is NOT optional.** Do not wait for the user to ask. Do it immediately after every feature push, in the same conversation turn.

---

## High-Risk Modules — STOP Gate Required

These files require **Phase 0 audit (read all affected files, list call sites) → STOP → explicit OK** before any changes:

| File | Why |
|------|-----|
| `backend/app/services/gemini_service.py` | AI pipeline — broken = no analysis |
| `backend/app/core/clerk.py` | Clerk JWT verification — broken = no auth |
| `backend/app/core/deps.py` | Dependency injection — affects all endpoints |
| `backend/app/api/videos.py` | Video pipeline — broken = core feature down |
| `alembic/versions/*.py` | Schema migrations — wrong = data loss |

For these files: read first, print analysis, wait for OK, then implement.

---

**Version:** 2.28 (A021 closeout — CLAUDE.md API surface + project tree, ARCHITECTURE.md A021 flows, English-UI rule pinned, Debug tile prod-guard, BottomNav 5th History slot — 2026-05-12)
**Owner:** Daniele Somensi + Claude Code

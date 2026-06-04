# Climbritz — Architecture

> Last updated: 30 May 2026 (through A023 hold-classification cloud sync + B021 Clerk production auth)

---

## System Overview

Climbritz is an AI climbing companion for Kilter Board users. Two tiers:

- **Discovery (free):** Search 160k+ climbs by grip type, AI session builder, problem generation, BLE board connection, attempt logging. Powered by a proprietary hold classification database (every hold tagged: jug/good crimp/crimp/sloper/undercling/pinch).
- **Coach (€7.99/month):** Video technique analysis with Gemini 2.5 Flash, enriched with climb context (grade, holds, angle) from BoardLib DB. Move-by-move coaching feedback.

The native app wraps the Next.js frontend via Capacitor (iOS + Android), enabling BLE connection to the Kilter Board.

---

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  Capacitor Native App (iOS / Android — Phase 3e)                     │
│  ┌─────────────────┐                          ┌────────────────────┐ │
│  │   Next.js 14    │──────────────────────────▶  Kilter Board      │ │
│  │   (Frontend)    │  BLE (kilter-protocol.ts │  (Hardware)        │ │
│  │   Port 3000     │   + @cap-community/ble)  │  LED control       │ │
│  └────────┬────────┘                          └────────────────────┘ │
└───────────┼──────────────────────────────────────────────────────────┘
            │ HTTP
            ▼
┌──────────────────────────┐     ┌─────────────────┐
│    FastAPI Backend        │────▶│  Gemini 2.5     │
│    (Python 3.11)          │◀────│  Flash File API │
│    Port 8001 (dev)        │     │  (Coach tier)   │
│    Railway (prod)         │     └─────────────────┘
└──────────┬────────────────┘
           │
┌──────────┴────────────────────────────────────────────┐
│  SQLite (dev + prod*)          BoardLib SQLite DB      │
│  users + video_uploads         ~189MB, gitignored      │
│  *PostgreSQL planned           kilter.db (344k+ climbs)│
│                                # hold_classifications   │
│                                # (planned — HC-7)       │
└───────────────────────────────────────────────────────┘
```

---

## Request Flow — Video Analysis

```
1. User uploads video via drag-drop UI
   │
2. POST /api/videos/upload (JWT auth required)
   │  → File saved to local filesystem (dev) / S3 (prod, planned)
   │  → VideoUpload record created (status: "pending")
   │  → Returns 202 Accepted immediately
   │
3. FastAPI BackgroundTask starts
   │  → Status: "pending" → "processing"
   │  → Upload video to Gemini File API
   │  → Wait for Gemini to process the file
   │  → Send analysis prompt + video reference to Gemini
   │  → Parse structured coaching response
   │  → Store results in form_analysis JSON column
   │  → Status: "processing" → "completed" (or "failed")
   │
4. Frontend polls GET /api/videos/{id}
   │  → Shows progress indicator while processing
   │  → Displays structured coaching feedback when completed
```

---

## Component Map

### Backend (`backend/app/`)

| Component | Path | Responsibility |
|-----------|------|----------------|
| **Video API** | `api/videos.py` | Upload, list, get, delete + background analysis |
| **Climb API** | `api/climbs.py` | Search, detail, stats (BoardLib DB queries). Search excludes animated sequences (`frames_count > 1`) globally; A019 `moves` query param applies a SQL WHERE on the cyan-hold count. **A022:** `benchmark` bool param adds `AND cs.benchmark_difficulty IS NOT NULL` — angle-specific, since the `cs` join is already constrained to the selected angle. B020: `limit` defaults to 500 with hard cap 500 (422 above); response is the envelope `{climbs, total_count}` so the UI can surface an overflow banner without a second request — `total_count` reflects all matching climbs ignoring the cap. **A021.4 overlay:** when the request is authenticated, search now also accepts `done_filter` and `project_filter` chip params (`all`/`only`/`exclude`) and enriches each climb with a `user_state` object. The overlay is a Python merge (Option A) — BoardLib lives in a separate SQLite file from the app DB, so the API layer pre-fetches matching uuids from `user_climbs` and threads them as include/exclude lists into `_build_search_filters`. |
| **Holds API** | `api/holds.py` | Board composite image + individual hold images |
| **Admin API** | `api/admin.py` | BoardLib DB sync + upload (Railway maintenance) |
| **Logs API** | `api/logs.py` | A021 — POST/GET/PATCH/DELETE `/api/logs` + `GET /api/logs/sessions`. Reads `X-User-Timezone` (IANA) to resolve `local_date`. Rejects animated sequences with 422. The `/sessions` endpoint memoises a BoardLib lookup so each session climb arrives with `climb_name + grade` already attached. |
| **User-climbs API** | `api/user_climbs.py` | A021 — `GET /api/user-climbs/{uuid}` returns `{state, recent_logs}`; `PATCH /api/user-climbs/{uuid}/project` toggles the project flag. |
| **Stats API** | `api/stats.py` | A021 — `/pyramid` (counts by grade band, flash/send_or_better/all filter) + `/trend` (ISO-week buckets, flash/send/attempt counts). Uses memoised BoardLib grade resolver to keep BoardLib hits sub-linear. |
| **Circuits API** | `api/circuits.py` | Stub (legacy) |
| **Gemini Service** | `services/gemini_service.py` | File API upload + Kilter Board-specific prompt (B007+B008) |
| **Climb Service** | `services/climb_service.py` | Read-only sqlite3 queries against BoardLib DB. A021: `get_climb_meta()` for the POST-/api/logs animated-sequence guard; `include_uuids` / `exclude_uuids` params on `_build_search_filters` for the Discovery chip-filter pipeline. |
| **Log Service** | `services/log_service.py` | A021 — owns the climb_logs / user_climbs sync contract. `resolve_local_date(received_at, tz_header)`, `create_or_upgrade_log`, `_recompute_user_climb` (best_result via SQL existence probes, avoiding identity-map staleness), `list_sessions / compute_pyramid / compute_trend`. Decoupled from BoardLib — accepts injected resolvers for grade lookups. |
| **Storage Service** | `services/storage_service.py` | Local filesystem (dev), S3 planned (prod) |
| **Video Service** | `services/video_service.py` | ffmpeg utilities |
| **Kilter Parser** | `utils/kilter_parser.py` | Layout string parser for BoardLib data |
| **Config** | `core/config.py` | Pydantic Settings (env vars, BOARDLIB_DB_PATH). A020: production guard refuses to boot without `CLERK_JWKS_URL` |
| **Database** | `core/database.py` | SQLAlchemy engine + SessionLocal |
| **Clerk Auth** | `core/clerk.py` | A020 — Clerk JWT verification via JWKS, shadow-row upsert, in-process clerk_id cache (5-min TTL) |
| **Dependencies** | `core/deps.py` | FastAPI dependency injection (get_db, `get_current_user_id`) |

### Frontend (`app/`)

| Page | Path | What it does |
|------|------|-------------|
| Homepage | `page.tsx` | Tile hub (Demo LED, Discover, Classify, Video Analysis, History, Debug). Debug tile is hidden in production builds so end users only see the 5 product tiles. **B021 (2026-05-19):** Video Analysis tile carries a COMING SOON pill (brand-orange) instead of the previous 🔒 lock — Coach tier not production-ready. Tile remains clickable; `/upload` stays URL-reachable. **B032 (2026-06-04):** Clerk `<UserButton>` account/sign-out control added top-right (the only homepage account entry point; homepage stays a launcher with no BottomNav). **B033:** ported off 100% inline styles → Tailwind classes + design tokens (D18-12); odd tile count now spans the last tile full-width to kill the orphan; wordmark uses the Space Grotesk display face. |
| Sign in | `app/sign-in/page.tsx` | Clerk widget (hash routing, SPA mode) |
| Sign up | `app/sign-up/page.tsx` | Clerk widget (hash routing, SPA mode) |
| Login | `login/page.tsx` | Redirect alias to `/sign-in` (backward compat) |
| Upload | `upload/page.tsx` | Drag-drop video upload, progress bar. **B032:** mounts universal `BottomNav`. |
| Dashboard | `dashboard/page.tsx` | User overview (the Profile BottomNav target; Clerk `<UserButton>` for sign-out). **B032:** mounts universal `BottomNav` so the Profile tab keeps the nav bar. |
| Discover | `discover/page.tsx` | Climb search + filter panel (A011). B020: renders the full result set (no internal slice) up to the backend's 500-result cap; an orange overflow banner appears at the top when `total_count > climbs.length` |
| Climb detail | `discover/detail/page.tsx` | Board visualization + BLE control bar (A015) + Next/Prev row through the filtered list (A014, sessionStorage-backed). Reuses `/ble-test` BLE stack via `ClimbBleControls` + `climb-to-leds.ts`. **A021.3:** mounts `<LogSection>` (5-col grid Flash / Send / Attempt / Project / Remove, project-removal modal w/ Android back-button via `@capacitor/app`) + `<RecentLogs>` mini-list. Board capped at `max-w-[280px]` to fit a mid-height phone viewport (B-A021-fix-1 Round 2). **B021 (2026-05-19):** "🎬 Analyze with Coach" CTA removed pending Coach tier production readiness. |
| Classify | `classify/page.tsx` | Hold classification UI (HC-5) |
| Board map | `board-map/page.tsx` | Annotated 12x12 board map (HC-2) |
| BLE test | `ble-test/page.tsx` | 10 pixel-art LED presets + #11 all-LEDs stress test, auto-apply on tap with 200ms debounce (A006/B009/B012/B014/B014-iter-2) |
| Video detail | `videos/detail/page.tsx` | Analysis results display (query-param route). **B032:** mounts universal `BottomNav`. |
| **History** | `history/page.tsx` | A021.5 + A024 — single-scroll page: sticky date range picker (7d/30d/90d/1y/All, default 90d) + stats header (A024: hero row Climbs volume / Sessions over secondary Flashes / Sends / Peak grade; Climbs summed from the sessions payload, no extra endpoint) + sessions list (cards desc, climb rows link to `/discover/detail`) + Recharts horizontal-bar grade pyramid (flash/send_or_better/all filter) + Recharts line trend chart (per-series toggle for flash/send/attempt). A024 dropped the hand-rolled calendar heatmap; a layout slot above the stats is reserved for the A025 Gemini comment card. Recharts 3.8.1 pulled in for the two chart sections. |
| Privacy | `privacy/page.tsx` | Privacy policy (Play Store requirement) |
| Debug | `debug/page.tsx` | Network diagnostics (dev tool — hidden from homepage in prod builds) |

Legacy redirect pages (`discover/[climb_uuid]/`, `videos/[id]/`) redirect to the query-param routes above for Capacitor compatibility.

### Design system (B033, 2026-06-04 — implements D018)

- **Token layer** — `app/globals.css`. Brand orange `#ff6b35` is a `:root`-override of Tailwind's built-in `orange-*` ramp (B032; required because `@theme` overrides of built-in ramps don't take in this v4 setup without `@config`). All *other* tokens are new namespaces declared in `@theme static` (forces every var to emit to `:root` so author-CSS / inline `var()` consumers don't get tree-shaken; utilities stay on-demand): `surface-base/raised/overlay`, `border-default/strong`, `text-primary/secondary/tertiary/muted`, `state-*` (flash/send/attempt/project), `feedback-*` (success/warn/error/info), `category-*` (data palette — crimp moved off-brand to teal), `radius-pill/card/control`, `shadow-elev-raised/overlay`, the `text-*` type scale, and the `--hero-gradient` / `--brand-orange` plain-`:root` vars for inline consumers. Mirrored (documentary) in `tailwind.config.ts`.
- **Primitive library** — `components/ui/`: `Button` (primary brand-500/near-black `zinc-950` for AA contrast, secondary, destructive, ghost), `Chip` (one soft-outline selected style, 44px target), `Card` (default + interactive hover), `PageHeader` (top-level + nested-with-back variants, sticky/blur), `EmptyState`, `LoadingState` ("Loading…"), `StatusDot`. **No `ComingSoonBadge`** (dropped). Adopted on ble-test, classify, history, discover (+`FilterPanel`), discover/detail.
- **BLE status** — `lib/ble/status.ts` is the single source for `STATUS_COLORS`/`STATUS_LABELS`/`BUSY_STATUSES`, consumed by `StatusDot`, `/ble-test`, and `ClimbBleControls` (was duplicated in the latter two).
- **Typography** — Space Grotesk (display, `.font-display`) + Inter Tight (body) self-hosted via `next/font` in `app/layout.tsx` (build-time download, no runtime fetch, metric-matched fallback). Body face set in `globals.css`; display applied to the wordmark + every page title.

**Auth gating (A019.16):** ALL frontend pages above require login except `Sign in`, `Sign up`, `Privacy`, and `Debug`. The `<AuthGuard>` component (using Clerk's `useAuth()`) wraps every protected page and redirects to `/sign-in` when the user isn't authenticated. Discovery is still the free tier (no payment), but the app has no anonymous mode — per-user logging features (send/project, A021) need a guaranteed `user_id` and a guest mode would dead-end the UX.

### Database (SQLite / PostgreSQL)

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `users` | id, clerk_id, created_at, updated_at | A020 — Clerk shadow row, no PII (email/name/etc. live in Clerk). UUID as String(36) |
| `video_uploads` | id, user_id, filename, file_path, processing_status, form_analysis, gemini_file_id | form_analysis is JSON |
| `climb_logs` | id, user_id, climb_uuid, angle, local_date, result_type (CHECK flash/send/attempt), attempts_count | A021 — append-mostly source of truth. UNIQUE on (user_id, climb_uuid, angle, local_date) so same-day re-taps upgrade in place. FK to users with ON DELETE CASCADE. |
| `user_climbs` | id, user_id, climb_uuid, angle, is_project, best_result (CHECK flash/send/null), last_logged_at | A021 — derived state cache kept in sync by `log_service`. UNIQUE on (user_id, climb_uuid, angle). FK to users with ON DELETE CASCADE. |

Processing statuses: `pending` → `processing` → `completed` / `failed`

> **Planned:** `hold_classifications` table (HC-7) — will store grip-type tags per hold for Discovery features.

---

## Request Flow — Climb Logging (A021)

```
1. User taps result button on /discover/detail LogSection
   │
2. POST /api/logs (Clerk JWT + X-User-Timezone)
   │  → climb_service.get_climb_meta(climb_uuid) confirms frames_count==1
   │     (animated sequences rejected with 422)
   │  → log_service.resolve_local_date(now_utc, tz_header)
   │     • valid IANA tz (e.g. Europe/Rome) → date in that zone
   │     • missing or unparseable → UTC fallback
   │  → log_service.create_or_upgrade_log:
   │     • UNIQUE conflict on (user, climb, angle, local_date)
   │       → existing row: attempts_count++, result_type upgrades if stronger
   │       → new row inserted otherwise
   │     • _recompute_user_climb runs in the SAME transaction:
   │       — best_result = strongest flash/send across all logs
   │       — last_logged_at = max(created_at)
   │       — is_project preserved (independent toggle)
   │  → 201 with { log, user_state } envelope
   │
3. Frontend caches the new user_state at the page level
   │  → LogSection refetches /api/user-climbs/{uuid}?angle= for the
   │    Storico section (recent_logs list)
   │  → /discover overlay picks up the new state on next search

POST /api/logs (Flash on a project climb):
   ProjectRemovalModal opens client-side BEFORE the POST.
   ├─ "Yes, remove"   → POST /api/logs, THEN PATCH project=false
   ├─ "No, keep it"   → POST /api/logs only
   └─ "Cancel"        → no request

Android system back button (Capacitor App.addListener('backButton'))
dismisses the modal cleanly without navigating away from the page.
```

## /history page composition (A021.5)

```
┌──────────────────────────────────────────────────────────┐
│  Sticky header: back link + date range picker            │
├──────────────────────────────────────────────────────────┤
│  Stats header (A024): hero row Climbs/Sessions           │
│   over secondary row Flashes / Sends / Peak grade        │
│  (A025 slot reserved above the stats)                    │
│                                                          │
│  ── Sessions ──                                          │
│  <SessionCard> per local_date (desc)                      │
│   each: date · totals · per-climb mini-list (Link → /detail)│
│                                                          │
│  ── Grade pyramid ──                                     │
│  Recharts horizontal BarChart                             │
│  Filter chips: Flash only / Send or better / All          │
│                                                          │
│  ── Send-rate trend ──                                   │
│  Recharts LineChart                                       │
│  Series toggles: Flash / Send / Attempt                   │
└──────────────────────────────────────────────────────────┘
```

Three GET fetches drive the page (`/api/logs/sessions`, `/api/stats/pyramid`, `/api/stats/trend`), all tied to the same date range and refetched atomically when the range changes.

---

## Deployment Topology (Current)

```
┌──────────────────────────────────────────┐
│               Railway                     │
│  URL: web-production-cea9.up.railway.app  │
│  Config: backend/railway.toml             │
│  ┌────────────────────────────────────┐  │
│  │  FastAPI (uvicorn)                 │  │
│  │  Port: $PORT (8080)                │  │
│  │  startCommand:                     │  │
│  │    1. Check/download BoardLib DB   │  │
│  │    2. alembic upgrade head         │  │
│  │    3. uvicorn app.main:app         │  │
│  │  Health: GET /health → 200         │  │
│  ├────────────────────────────────────┤  │
│  │  SQLite (file-based, on Railway)   │  │
│  │  Persistent volume: /data/climbritz│  │
│  │  ✅ Data survives redeploys        │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘

Frontend: climbritz.app (deployed via Vercel)
Video storage: local filesystem (S3 planned)
```

**Note:** SQLite is on a persistent Railway volume (`/data/climbritz`) — data survives redeploys. The startup command (in `backend/railway.toml`) checks for a valid BoardLib DB (`SELECT 1 FROM climbs`), re-downloads if missing or invalid (D014), then runs migrations and starts uvicorn. Migration to PostgreSQL is planned for Phase 7.

**Native app (Phase 3e):** Capacitor wraps the Next.js frontend → iOS App Store + Android Play Store. BLE connection via a custom protocol stack:

```
app/ble-test/page.tsx          UI — preset grid, auto-apply on tap (200ms debounce), "Illumina board" button, error banner
  └─ use-kilter-ble.ts         React hook — state machine (8 states) + promise-chain write serialization
       └─ kilter-board-service  Kilter-specific orchestration — connect, sendLEDPreset, sendAllOff
            ├─ kilter-protocol  Pure encoder (API level 3) — holds → BLE-ready Uint8Array chunks
            │                   Color compression: 24-bit RGB → 8-bit 0bRRRGGGBB
            │                   Packet format: [SOH, len, checksum, STX, body, ETX]
            │                   Chunked to 20-byte BLE writes
            └─ transport.ts     Generic @capacitor-community/bluetooth-le wrapper
```

`@hangtime/grip-connect` remains in `package.json` as protocol reference only (never imported at runtime). `UnsupportedBoardError` is thrown for API level 2 boards. Protocol docs: https://github.com/1-max-1/fake_kilter_board

**A015 — climb illumination on `/discover/detail`:** The same BLE stack is reused verbatim via the `useKilterBle` hook. A static `app/data/leds_12x12.json` (476 entries, generated by `backend/scripts/regenerate_board_assets.py` from BoardLib's `leds` table, `product_size_id=10`) maps `placement_id → LED position`. The `climb-to-leds.ts` helper translates a climb's `HoldPosition[]` into `EncoderHold[]` by looking up LED positions + converting role strings (`start`/`middle`/`finish`/`foot_only`) to `role_id` (12/13/14/15). Colors are NOT declared frontend-side — resolution happens in `kilter-protocol.PLACEMENT_ROLES`, preserving a single source of truth.

**A014 — Next/Prev through the filtered list:** `/discover` writes the current result set's uuid list + angle + timestamp to sessionStorage on every search completion (`app/discover/filtered-list-storage.ts`, key `climbritz:discover:filtered-list`, 24h TTL, self-cleaning on corrupt/stale reads). `/discover/detail` reads that list on mount, matches the current uuid to an index, and renders a Next/Prev row. Tapping Next/Prev calls `router.push` — the page stays mounted (same route, different query params), so `ClimbBleControls`'s `useKilterBle` state survives. The parent flips `autoSendOnKeyChange=true` on the first Next/Prev tap and passes the climb uuid as `climbKey`; `ClimbBleControls` then debounces (300ms) a `sendLEDs` on each key change when the board is connected, so rapid taps coalesce into one packet on the last climb.

---

## AI Pipeline Detail

```
Video file (MP4, MOV, etc.)
  │
  ▼
Gemini File API: client.files.upload(path)   # google.genai SDK
  │  → Returns file reference
  │  → Polls until state != PROCESSING
  │
  ▼
Gemini 2.5 Flash: client.models.generate_content(
    model="gemini-2.5-flash",
    contents=[video_file, prompt],
    config=GenerateContentConfig(
        response_mime_type="application/json",
        max_output_tokens=8192,
        thinking_config=ThinkingConfig(thinking_budget=0),  # see note
    )
  )
  │  → ONE API call per video (not frame-by-frame)
  │  → thinking DISABLED: 2.5-flash dynamic-thinking tokens count against
  │     max_output_tokens; on real videos they ate the whole budget →
  │     truncated/empty JSON → analysis silently failed. budget=0 gives the
  │     full 8192 to the structured answer (the B007/B008 prompt was
  │     validated without thinking).
  │  → Kilter Board-specific prompt (B007): board detection, 5 scores,
  │     max 3 improvements with drills, overall impression
  │  → JSON repair fallback if response is malformed
  │  → Pydantic validation (FormFeedbackResponse, warning-only)
  │
  ▼
Structured response stored as JSON in video_uploads.form_analysis
```

**Cost:** ~$0.001–0.003 per video analyzed (Gemini 2.5 Flash pricing)

---

## Authentication Flow (A020)

Sign-in / sign-up: Clerk-hosted widget at /sign-in (and /sign-up).
  → email + password, with a 6-digit email code only at sign-up (B021). Google OAuth + magic links disabled — they break the iOS WebView.
  → Production Clerk on custom domain clerk.climbritz.app (pk_live). The Capacitor WebView is served on app.climbritz.app so the SameSite=Lax session cookie stays same-site. Per-platform origin gotchas: docs/CLERK_CAPACITOR_AUTH.md.
  → after sign-in, ClerkProvider establishes a session and redirects to /dashboard.

Each frontend API call:
  → app/lib/api.ts fetches a fresh JWT via window.Clerk.session.getToken().
  → Authorization: Bearer <token> attached to the fetch.
  → On 401: retry once after 500ms (covers Clerk mid-refresh), then redirect to /sign-in.

Backend (each protected request):
  → deps.get_current_user_id() reads Authorization header.
  → core/clerk.verify_clerk_token() validates against Clerk's JWKS endpoint.
  → core/clerk.lookup_or_create_user() returns the local users.id (UUID v4) shadowing the Clerk subject. First-seen clerk_ids get a fresh row; subsequent requests hit a 5-min in-process cache.

Production guard: core/config.py raises RuntimeError if ENVIRONMENT=production and CLERK_JWKS_URL is empty — the X-User-ID dev fallback is also gated behind environment != "production" so a misconfigured prod container can't be impersonated by header.

Route protection: client-side via components/AuthGuard.tsx using useAuth() from @clerk/clerk-react. NO middleware.ts — clerkMiddleware is incompatible with output: 'export' (Clerk issue #4647 closed "not planned"). Backend JWT verification is the actual security boundary; AuthGuard is UX glue.

Protected page coverage (A019.16): ALL frontend pages require login except /sign-in, /sign-up, /privacy, /debug. Discovery is still the free tier but no longer anonymous — per-user logging in A021 (send/project) needs a guaranteed user_id, and a guest mode would dead-end the UX.

---

## 3-Level Intelligence System (Roadmap)

| Level | Status | What it adds |
|-------|--------|-------------|
| **Level 1: Solo Analysis** | ✅ Working | Gemini analyzes video with general climbing knowledge |
| **Level 2: Contextual Analysis** | 🎯 Phase 3d | + climb data from BoardLib DB (grade, holds, angle) |
| **Level 3: Expert Comparison** | 🔮 Phase 5 | + expert reference video for side-by-side comparison |

Level 2 architecture (Phase 3):
```
BoardLib SQLite DB (~189MB, local, gitignored)
  │  344k+ climbs with grade, holds, angle, ascents
  │
  ▼
GET /api/climbs/search?q={name}&angle={angle}
  │  → Autocomplete from local DB
  │
  ▼
POST /api/videos/upload + climb_id + angle
  │  → Fetch climb data from BoardLib DB
  │  → Build enriched Gemini prompt with climb context
  │  → Structured JSON output with technique scores, move-by-move analysis
```

---

## Key Technical Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Video analysis | Gemini File API (whole video, 1 call) | Frame-by-frame = rate limit disaster (15 req/min) |
| Background processing | FastAPI BackgroundTasks | Celery/Redis too complex for MVP |
| Climb data | BoardLib (pip install) | Downloads official Kilter Board SQLite DB locally |
| Climb identification | Search/autocomplete first | Visual LED recognition deferred to Phase 4 |
| UUID storage | String(36) | SQLite + PostgreSQL compatibility |
| Dev database | SQLite | Simple, no setup, PostgreSQL for prod |
| Native app | Capacitor (wraps Next.js) | BLE plugin available, zero frontend rewrite, iOS + Android |
| BLE | Custom encoder (`kilter-protocol.ts`) over `@capacitor-community/bluetooth-le` | Pure encoder reimplemented from grip-connect reference. API level 3 only. grip-connect stays as reference, not imported. Web Bluetooth insufficient for iOS Safari |
| Hold classification | Manual classification via `/classify` UI | HC-4 (AI batch) removed — manual-first by Daniele + Christie in gym. Proprietary asset, prerequisite for Discovery |
| Routing (Capacitor) | Query-param routes (`/discover/detail?id=`) | Dynamic `[param]` segments don't work in Capacitor static export |
| Safe-area CSS (B017) | Plain utilities in `app/safe-area.css`, imported separately from `globals.css` | Tailwind v4's postcss pipeline strips plain class rules from the Tailwind entrypoint (even inside `@utility`/`@layer`). Separate CSS import survives. `.pt-safe`/`.pb-safe` use `max(env(safe-area-inset-*), fallback)`; `viewport-fit=cover` set via Next `viewport` export in `app/layout.tsx` |
| Discovery filter persistence (B017) | sessionStorage (`climbritz:discover:filters`, 24h TTL) | Mirrors `filtered-list-storage.ts`. Initial-state priority: URL params > sessionStorage > defaults — preserves shareable-link intent while fixing back-nav reset |
| Identity provider | Clerk (hosted) | Outsource password storage, MFA, OAuth, password reset, email verification — saves ~2 weeks vs in-house |
| Clerk Provider variant | `@clerk/clerk-react` SPA-mode | `@clerk/nextjs`'s ClerkProvider transitively requires server-actions.js, incompatible with `output: 'export'` |
| Route protection (Clerk) | Client-side `useAuth()` | `clerkMiddleware` silently dropped from static-export bundles per Clerk issue #4647 |

---

## Environment Variables

| Variable | Purpose | Default | Where |
|----------|---------|---------|-------|
| `DATABASE_URL` | SQLAlchemy connection string | — (required) | `.env` |
| `CLERK_JWKS_URL` | Clerk JWKS endpoint for JWT verification (REQUIRED in production — startup guard) | `""` | `.env`, Railway |
| `CLERK_SECRET_KEY` | Clerk server-side secret (optional — backend currently only needs JWKS) | `""` | `.env`, Railway |
| `CLERK_PUBLISHABLE_KEY` | Clerk publishable key (also as `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` for frontend) | `""` | `.env`, Vercel |
| `GEMINI_API_KEY` | Google AI Studio API key | `""` | `.env`, Railway |
| `GEMINI_MODEL` | Gemini model to use | `gemini-2.5-flash` | `.env` |
| `UPLOAD_DIR` | Video file storage path | `uploads` | `.env` |
| `BOARDLIB_DB_PATH` | Path to BoardLib SQLite DB | `data/kilter.db` | `.env`, Railway |
| `ENVIRONMENT` | `development` / `production` | `development` | `.env`, Railway |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins | `http://localhost:3000` | Railway |
| `ADMIN_SECRET` | Secret for admin upload-db endpoint | `""` | Railway |
| `NEXT_PUBLIC_MOBILE` | Force API base URL to Railway prod, ignoring `NEXT_PUBLIC_API_URL` (frontend) | unset | Capacitor build |
| `NEXT_PUBLIC_API_URL` | Backend URL for web/dev builds. Ignored when `NEXT_PUBLIC_MOBILE=true` | `http://localhost:8001` | `.env.local` |

See `backend/app/core/config.py` for the full Pydantic Settings model.

---

For the complete API endpoint list and project structure tree, see `CLAUDE.md`.
For strategy, pricing, and phase plan, see `ROADMAP_ACTIVE.md`.

*Architecture doc created: March 2026 (B002) — Last updated: 30 May 2026 (A023 + B021)*

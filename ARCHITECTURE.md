# Kilter-Up — Architecture

> Last updated: 7 May 2026

---

## System Overview

Kilter-Up is an AI climbing companion for Kilter Board users. Two tiers:

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
| **Climb API** | `api/climbs.py` | Search, detail, stats (BoardLib DB queries). Search excludes animated sequences (`frames_count > 1`) globally; A019 `moves` query param applies a SQL WHERE on the cyan-hold count. |
| **Holds API** | `api/holds.py` | Board composite image + individual hold images |
| **Admin API** | `api/admin.py` | BoardLib DB sync + upload (Railway maintenance) |
| **Circuits API** | `api/circuits.py` | Stub (legacy) |
| **Gemini Service** | `services/gemini_service.py` | File API upload + Kilter Board-specific prompt (B007+B008) |
| **Climb Service** | `services/climb_service.py` | Read-only sqlite3 queries against BoardLib DB |
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
| Homepage | `page.tsx` | 4-tile hub (Demo LED, Discover, Classify, Video Analysis) |
| Sign in | `app/sign-in/page.tsx` | Clerk widget (hash routing, SPA mode) |
| Sign up | `app/sign-up/page.tsx` | Clerk widget (hash routing, SPA mode) |
| Login | `login/page.tsx` | Redirect alias to `/sign-in` (backward compat) |
| Upload | `upload/page.tsx` | Drag-drop video upload, progress bar |
| Dashboard | `dashboard/page.tsx` | User overview |
| Discover | `discover/page.tsx` | Climb search + filter panel (A011) |
| Climb detail | `discover/detail/page.tsx` | Board visualization + BLE control bar (A015) + Next/Prev row through the filtered list (A014, sessionStorage-backed). Reuses `/ble-test` BLE stack via `ClimbBleControls` + `climb-to-leds.ts` |
| Classify | `classify/page.tsx` | Hold classification UI (HC-5) |
| Board map | `board-map/page.tsx` | Annotated 12x12 board map (HC-2) |
| BLE test | `ble-test/page.tsx` | 10 pixel-art LED presets + #11 all-LEDs stress test, auto-apply on tap with 200ms debounce (A006/B009/B012/B014/B014-iter-2) |
| Video detail | `videos/detail/page.tsx` | Analysis results display (query-param route) |
| Privacy | `privacy/page.tsx` | Privacy policy (Play Store requirement) |
| Debug | `debug/page.tsx` | Network diagnostics (dev tool) |

Legacy redirect pages (`discover/[climb_uuid]/`, `videos/[id]/`) redirect to the query-param routes above for Capacitor compatibility.

**Auth gating (A019.16):** ALL frontend pages above require login except `Sign in`, `Sign up`, `Privacy`, and `Debug`. The `<AuthGuard>` component (using Clerk's `useAuth()`) wraps every protected page and redirects to `/sign-in` when the user isn't authenticated. Discovery is still the free tier (no payment), but the app has no anonymous mode — per-user logging features (send/project, A021) need a guaranteed `user_id` and a guest mode would dead-end the UX.

### Database (SQLite / PostgreSQL)

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `users` | id, clerk_id, created_at, updated_at | A020 — Clerk shadow row, no PII (email/name/etc. live in Clerk). UUID as String(36) |
| `video_uploads` | id, user_id, filename, file_path, processing_status, form_analysis, gemini_file_id | form_analysis is JSON |

Processing statuses: `pending` → `processing` → `completed` / `failed`

> **Planned:** `hold_classifications` table (HC-7) — will store grip-type tags per hold for Discovery features.

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
│  │  Persistent volume: /data/kilter-up│  │
│  │  ✅ Data survives redeploys        │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘

Frontend: kilter-up-coach.vercel.app (deployed via Vercel)
Video storage: local filesystem (S3 planned)
```

**Note:** SQLite is on a persistent Railway volume (`/data/kilter-up`) — data survives redeploys. The startup command (in `backend/railway.toml`) checks for a valid BoardLib DB (`SELECT 1 FROM climbs`), re-downloads if missing or invalid (D014), then runs migrations and starts uvicorn. Migration to PostgreSQL is planned for Phase 7.

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

**A014 — Next/Prev through the filtered list:** `/discover` writes the current result set's uuid list + angle + timestamp to sessionStorage on every search completion (`app/discover/filtered-list-storage.ts`, key `kilter-up:discover:filtered-list`, 24h TTL, self-cleaning on corrupt/stale reads). `/discover/detail` reads that list on mount, matches the current uuid to an index, and renders a Next/Prev row. Tapping Next/Prev calls `router.push` — the page stays mounted (same route, different query params), so `ClimbBleControls`'s `useKilterBle` state survives. The parent flips `autoSendOnKeyChange=true` on the first Next/Prev tap and passes the climb uuid as `climbKey`; `ClimbBleControls` then debounces (300ms) a `sendLEDs` on each key change when the board is connected, so rapid taps coalesce into one packet on the last climb.

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
    )
  )
  │  → ONE API call per video (not frame-by-frame)
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
  → email + verification code (no magic links — they break iOS WebView).
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
| Discovery filter persistence (B017) | sessionStorage (`kilter-up:discover:filters`, 24h TTL) | Mirrors `filtered-list-storage.ts`. Initial-state priority: URL params > sessionStorage > defaults — preserves shareable-link intent while fixing back-nav reset |
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
| `NEXT_PUBLIC_MOBILE` | Switch API base URL to Railway (frontend) | unset | Capacitor build |

See `backend/app/core/config.py` for the full Pydantic Settings model.

---

For the complete API endpoint list and project structure tree, see `CLAUDE.md`.
For strategy, pricing, and phase plan, see `ROADMAP_ACTIVE.md`.

*Architecture doc created: March 2026 (B002) — Last updated: 7 May 2026 (A020)*

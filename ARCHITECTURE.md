# Kilter-Up — Architecture

> Last updated: 23 April 2026

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
| **Auth API** | `api/auth.py` | Register, login, /me (JWT) |
| **Video API** | `api/videos.py` | Upload, list, get, delete + background analysis |
| **Climb API** | `api/climbs.py` | Search, detail, stats (BoardLib DB queries) |
| **Holds API** | `api/holds.py` | Board composite image + individual hold images |
| **Admin API** | `api/admin.py` | BoardLib DB sync + upload (Railway maintenance) |
| **Circuits API** | `api/circuits.py` | Stub (legacy) |
| **Gemini Service** | `services/gemini_service.py` | File API upload + Kilter Board-specific prompt (B007+B008) |
| **Climb Service** | `services/climb_service.py` | Read-only sqlite3 queries against BoardLib DB |
| **Storage Service** | `services/storage_service.py` | Local filesystem (dev), S3 planned (prod) |
| **Auth Service** | `services/auth_service.py` | Password hashing, token generation |
| **Video Service** | `services/video_service.py` | ffmpeg utilities |
| **Kilter Parser** | `utils/kilter_parser.py` | Layout string parser for BoardLib data |
| **Config** | `core/config.py` | Pydantic Settings (env vars, BOARDLIB_DB_PATH) |
| **Database** | `core/database.py` | SQLAlchemy engine + SessionLocal |
| **Security** | `core/security.py` | JWT encode/decode |
| **Dependencies** | `core/deps.py` | FastAPI dependency injection (get_db, get_current_user) |

### Frontend (`app/`)

| Page | Path | What it does |
|------|------|-------------|
| Homepage | `page.tsx` | 4-tile hub (Demo LED, Discover, Classify, Video Analysis) |
| Login | `login/page.tsx` | Auth form |
| Upload | `upload/page.tsx` | Drag-drop video upload, progress bar |
| Dashboard | `dashboard/page.tsx` | User overview |
| Discover | `discover/page.tsx` | Climb search + filter panel (A011) |
| Climb detail | `discover/detail/page.tsx` | Board visualization with role colors (query-param route) |
| Classify | `classify/page.tsx` | Hold classification UI (HC-5) |
| Board map | `board-map/page.tsx` | Annotated 12x12 board map (HC-2) |
| BLE test | `ble-test/page.tsx` | 10 pixel-art LED presets + #11 all-LEDs stress test, auto-apply on tap with 200ms debounce (A006/B009/B012/B014/B014-iter-2) |
| Video detail | `videos/detail/page.tsx` | Analysis results display (query-param route) |
| Privacy | `privacy/page.tsx` | Privacy policy (Play Store requirement) |
| Debug | `debug/page.tsx` | Network diagnostics (dev tool) |

Legacy redirect pages (`discover/[climb_uuid]/`, `videos/[id]/`) redirect to the query-param routes above for Capacitor compatibility.

### Database (SQLite / PostgreSQL)

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `users` | id, username, email, password_hash, skill_level | UUID as String(36) |
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

## Authentication Flow

```
Register: POST /api/auth/register
  → bcrypt hash password → store user → return JWT

Login: POST /api/auth/login
  → verify bcrypt hash → return JWT

Protected routes: Authorization: Bearer <token>
  → deps.py: get_current_user decodes JWT → injects user
```

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

---

## Environment Variables

| Variable | Purpose | Default | Where |
|----------|---------|---------|-------|
| `DATABASE_URL` | SQLAlchemy connection string | — (required) | `.env` |
| `JWT_SECRET` | Token signing key | — (required) | `.env` |
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

*Architecture doc created: March 2026 (B002) — Last updated: 23 April 2026 (B014-iter-2)*

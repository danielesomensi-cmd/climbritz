# Kilter-Up — Architecture

> Updated: April 2026

---

## System Overview

Kilter-Up is an AI climbing companion for Kilter Board users. Two tiers:

- **Discovery (free):** Search 160k+ climbs by grip type, AI session builder, problem generation, BLE board connection, attempt logging. Powered by a proprietary hold classification database (every hold tagged: jug/crimp/microcrimp/sloper/pinch/pocket).
- **Coach (€7.99/month):** Video technique analysis with Gemini 2.5 Flash, enriched with climb context (grade, holds, angle) from BoardLib DB. Move-by-move coaching feedback.

The native app wraps the Next.js frontend via Capacitor (iOS + Android), enabling BLE connection to the Kilter Board.

---

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  Capacitor Native App (iOS / Android — Phase 3e)                     │
│  ┌─────────────────┐                          ┌────────────────────┐ │
│  │   Next.js 14    │──────────────────────────▶  Kilter Board      │ │
│  │   (Frontend)    │  BLE (@capacitor-        │  (Hardware)        │ │
│  │   Port 3000     │   community/bluetooth-le) │  LED control       │ │
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
│  hold_classifications          kilter.db (344k+ climbs)│
│  *PostgreSQL planned           + hold_classifications   │
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
| **Gemini Service** | `services/gemini_service.py` | File API upload + Kilter Board-specific prompt (B007) |
| **Climb Service** | `services/climb_service.py` | Read-only sqlite3 queries against BoardLib DB |
| **Storage Service** | `services/storage_service.py` | Local filesystem (dev), S3 planned (prod) |
| **Auth Service** | `services/auth_service.py` | Password hashing, token generation |
| **Video Service** | `services/video_service.py` | ffmpeg utilities |
| **Config** | `core/config.py` | Pydantic Settings (env vars, BOARDLIB_DB_PATH) |
| **Database** | `core/database.py` | SQLAlchemy engine + SessionLocal |
| **Security** | `core/security.py` | JWT encode/decode |
| **Dependencies** | `core/deps.py` | FastAPI dependency injection (get_db, get_current_user) |

### Frontend (`app/`)

| Page | Path | What it does |
|------|------|-------------|
| Homepage | `page.tsx` | Landing page |
| Login | `login/page.tsx` | Auth form |
| Upload | `upload/page.tsx` | Drag-drop video upload, progress bar |
| Dashboard | `dashboard/page.tsx` | User overview |
| Video detail | `videos/[id]/page.tsx` | Analysis results display |

### Database (SQLite / PostgreSQL)

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `users` | id, username, email, password_hash, skill_level | UUID as String(36) |
| `video_uploads` | id, user_id, filename, file_path, processing_status, form_analysis, gemini_file_id | form_analysis is JSON |

Processing statuses: `pending` → `processing` → `completed` / `failed`

---

## Deployment Topology (Current)

```
┌──────────────────────────────────────────┐
│               Railway                     │
│  URL: web-production-cea9.up.railway.app  │
│  ┌────────────────────────────────────┐  │
│  │  FastAPI (uvicorn)                 │  │
│  │  Port: $PORT (8080)                │  │
│  │  startCommand:                     │  │
│  │    alembic upgrade head &&         │  │
│  │    uvicorn app.main:app            │  │
│  │    --host 0.0.0.0 --port $PORT    │  │
│  │  Health: GET /health → 200         │  │
│  ├────────────────────────────────────┤  │
│  │  SQLite (file-based, on Railway)   │  │
│  │  Persistent volume: /data/kilter-up│  │
│  │  ✅ Data survives redeploys        │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘

Frontend: kilter-up-coach.vercel.app (deployed)
Video storage: local filesystem (S3 planned)
```

**Note:** SQLite is on a persistent Railway volume (`/data/kilter-up`) — data survives redeploys. Migration to PostgreSQL is still planned for Phase 7.

**Native app (Phase 3e):** Capacitor wraps the Next.js frontend → iOS App Store + Android Play Store. BLE connection via `@capacitor-community/bluetooth-le`. Same frontend codebase, zero rewrite.

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
| BLE | @capacitor-community/bluetooth-le | Web Bluetooth insufficient for iOS Safari |
| Hold classification | Gemini Flash batch + manual validation | Proprietary asset, one-time pipeline, prerequisite for Discovery |

---

## Environment Variables

| Variable | Purpose | Where |
|----------|---------|-------|
| `GEMINI_API_KEY` | Google AI Studio API key | `.env` (local), Railway env vars (prod) |
| `DATABASE_URL` | SQLAlchemy connection string | `.env` |
| `JWT_SECRET` | Token signing key | `.env` |
| `UPLOAD_DIR` | Video file storage path | `.env` |

---

*Architecture doc created: March 2026 — B002 Documentation Rationalization*

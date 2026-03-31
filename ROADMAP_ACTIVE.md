# Kilter-Up — Active Roadmap
> Updated: 30 March 2026
> Strategy: AI CLIMBING COACH via Video Analysis (3-Level System)

---

## Vision

Kilter-Up is an AI-powered climbing coach for Kilter Board users. Three levels of intelligence:

| Level | Name | Input | What AI Knows | Status |
|-------|------|-------|---------------|--------|
| 1 | Solo Analysis | Your video only | General climbing technique | ✅ Working (Gemini File API) |
| 2 | Contextual Analysis | Your video + climb ID | Grade, holds, angle, known beta, hold types | 🎯 Next |
| 3 | Comparison Analysis | Your video + expert video | Everything from L2 + expert reference | 🔮 Future |

**Market strategy:** Kilter Board-specific at launch. No direct competitor offers AI video coaching with BoardLib climb context integration. The standardization of Kilter Boards worldwide (identical holds, positions, grading) makes AI analysis deterministic and reliable. Natural expansion path: other Aurora boards (Tension, Moonboard) via BoardLib after Kilter product-market fit.

---

## Completed

### Phase 1 — Foundation ✅
- FastAPI backend with JWT auth
- SQLite (dev) / PostgreSQL (prod) ready
- Alembic migrations

### Phase 2 — Video Upload + Basic Analysis ✅
- Video upload endpoint (POST /api/videos/upload)
- Gemini 2.5 Flash via google.genai SDK (NOT frame-by-frame)
- Async processing with BackgroundTasks
- Frontend: drag-drop upload, progress bar, mobile-first

---

## Pre-Phase 3 — Quick Wins

### Prompt & Output Refinement (D001 → B brief)
- [ ] Audit current Gemini prompt in `gemini_service.py` — document what we send and what we get back
- [ ] Define compact structured JSON output schema (shorter, more actionable)
- [ ] Always include dual grading scale: Font AND V-grade (e.g., "6A+ / V4")
- [ ] Test with real climbing videos, iterate on prompt quality
- [ ] STOP gate: review prompt changes before merging (touches gemini_service.py)

### Video Thumbnails + Replay (B003)
- [ ] Extract a representative frame (~30-50% of video duration) using ffmpeg during background processing
- [ ] Save as JPEG alongside the video file
- [ ] Serve thumbnail via API: GET /api/videos/{id}/thumbnail
- [ ] Frontend: show thumbnail as cover in video list and analysis report
- [ ] Frontend: add `<video>` player to video detail page so users can rewatch their upload
- [ ] Ensure uploaded videos are NOT deleted after analysis — they must persist for replay
- [ ] Tests pytest

---

## Phase 3 — BoardLib Integration + Climb Context (NEXT)

**Goal:** Connect user videos to specific Kilter Board problems for contextual AI coaching.

### 3a — BoardLib Database Setup
- [ ] Add `boardlib` to requirements.txt
- [ ] Script to download/sync Kilter Board SQLite DB (`backend/data/kilter.db`)
- [ ] Add `backend/data/` to .gitignore
- [ ] Explore DB schema: climbs, placements, holes tables
- [ ] Document available fields and data quality

### 3b — Climb Search API
- [ ] Endpoint GET /api/climbs/search?q={name}&angle={angle}
- [ ] Autocomplete-friendly: return top 10 matches with name, grade, setter, ascent count
- [ ] Endpoint GET /api/climbs/{climb_id} — full climb detail with hold positions
- [ ] Tests pytest for both endpoints

### 3c — Enhanced Video Analysis (Level 2)
- [ ] Modify video upload flow: optional `climb_id` + `angle` parameters
- [ ] When climb_id provided: fetch climb data from BoardLib DB
- [ ] Build enriched Gemini prompt with climb context:
  - Grade and angle
  - Hold types (start/middle/finish/foot-only)
  - Hold positions on the board (from holes table x/y)
  - Number of ascents + difficulty accuracy (community consensus)
- [ ] Structured JSON output from Gemini:
  ```json
  {
    "overall_grade_assessment": "This is a V5 at 40° — your attempt shows V4-level execution",
    "technique_scores": {
      "body_tension": 7,
      "footwork": 5,
      "hip_positioning": 6,
      "route_reading": 8,
      "power_management": 6
    },
    "move_by_move": [
      {"move": 1, "observation": "Good start position, hips close to wall", "suggestion": "Try flagging right foot for balance"}
    ],
    "key_improvements": ["Work on active feet on slopers", "Drop your hips before the dyno"],
    "training_suggestions": ["4x4s on sloper problems at -1 grade", "Hip mobility drills"]
  }
  ```
- [ ] Frontend: climb search before upload, display structured feedback
- [ ] Tests pytest

### 3d — Sync & Maintenance
- [ ] Management command: `python -m scripts.sync_kilter_db`
- [ ] Document sync frequency recommendation (weekly is fine — DB doesn't change fast)

### 3e — Climb Recommendation Engine
- [ ] Endpoint GET /api/climbs/recommend?hold_type={type}&angle={angle}&grade_min={min}&grade_max={max}
- [ ] Filter by: hold type preference (slopers/crimps/pinches), angle range, grade range, minimum ascents
- [ ] Sort by popularity (ascent count) and difficulty accuracy
- [ ] Support training-oriented queries: "4x4 sets", "endurance circuit", "power problems"
- [ ] Frontend: recommendation UI — select preferences, browse suggested problems
- [ ] This works WITHOUT video — standalone value for all Kilter Board users
- [ ] Tests pytest

---

## Phase 4 — Visual Problem Recognition (Enhancement)

**Goal:** User takes a frontal photo of the Kilter Board with LEDs lit → system identifies the climb.

**Why this is simpler than it sounds:** A deliberate frontal photo of a flat board with bright colored LEDs (green=start, cyan=middle, magenta=finish, yellow=feet) is essentially a template matching problem. BoardLib has exact x/y coordinates for every hole. The board type (7x10, 12x12, 16x12, Fullride) can be inferred from the detected hole pattern itself.

**Approach:**
- [ ] Endpoint POST /api/climbs/identify (accepts image)
- [ ] Gemini Vision: extract LED positions and colors from frontal photo
- [ ] Map detected positions to the holes grid (BoardLib `holes` table with x/y)
- [ ] Infer board type from the overall pattern geometry
- [ ] Match LED color pattern against `climbs.layout` strings in BoardLib DB
- [ ] Return top-N candidate climbs with confidence score for user confirmation
- [ ] User confirms match + provides angle (or use their default gym angle)
- [ ] Fallback: if confidence is low, redirect to text search (Phase 3b)
- [ ] Requirement: photo must be reasonably frontal (document in UX)
- [ ] Tests pytest

**Note:** No custom ML model needed — Gemini Vision + geometric matching against known coordinates. Camera angle distortion is minimized by requiring a frontal photo.

---

## Phase 5 — Expert Video Comparison (Level 3)

**Goal:** Compare user technique against expert reference videos using Gemini multi-video analysis.

### 5a — Curated Benchmark Database
- [ ] Manually curate 20-50 expert send videos of the most iconic/benchmark Kilter Board problems
- [ ] Sources: YouTube (top Kilter climbers), downloaded via yt-dlp
- [ ] Store locally / S3 with metadata: climb_id, climber_name, source_url, grade, angle
- [ ] Schema: `expert_videos` table (id, climb_id, climber_name, file_path, source_url, notes)
- [ ] Alembic migration — STOP gate
- [ ] When a user uploads a video for a problem that has a benchmark video → auto-suggest comparison
- [ ] Endpoint GET /api/expert-videos?climb_id={id} — list available benchmarks for a climb

### 5b — Dual Video Upload + Comparison
- [ ] Allow user to upload 2 videos in one session: "my attempt" + "reference video"
- [ ] Works even for problems without a pre-loaded benchmark (user provides their own reference)
- [ ] Gemini prompt: 2 videos + climb context → structured comparison output
- [ ] Comparison JSON: what the expert does differently, move-by-move delta, specific suggestions
- [ ] Frontend: side-by-side or sequential video display with annotations
- [ ] Tests pytest

### 5c — Future: Learning from Accumulated Videos
- [ ] As video database grows, explore patterns across many analyses
- [ ] Identify common technique gaps per grade band
- [ ] Potentially auto-tag movement types (dyno, gaston, heel hook, etc.) for searchability
- [ ] This is exploratory — revisit after 100+ analyzed videos

---

## Phase 6 — Training Logs + Progress Tracking

**Goal:** Log sessions and track improvement over time.

- [ ] Schema training_logs (date, location, duration, session_type)
- [ ] Schema climb_attempts (training_log_id, climb_id, grade, result, attempts, video_id)
- [ ] Alembic migration
- [ ] Endpoints: POST/GET /api/training-logs, POST/GET /api/climb-attempts
- [ ] Link to video analysis results
- [ ] Frontend: session logger, progress charts (grade distribution, send rate trend)
- [ ] Tests pytest

---

## Phase 7 — Deploy & Polish

- [x] Deploy backend to Railway (FastAPI + SQLite)
- [x] Alembic migrations in Railway startCommand (`alembic upgrade head && uvicorn ...`)
- [x] Health check endpoint (`/health`)
- [x] Deploy frontend to Vercel — live at kilter-up-coach.vercel.app
- [ ] Switch Railway DB from SQLite to PostgreSQL — persistent volume now attached at /data/kilter-up (data survives redeploys), PostgreSQL migration still planned
- [ ] S3 for video storage (currently local filesystem)
- [ ] Mobile responsive polish
- [ ] Dashboard: aggregate stats, streaks, grade progression

---

## Phase 8+ — Backlog / Visionary

### Outdoor Video → Kilter Movement Matching
- [ ] User films outdoor climb → AI describes movement types (dyno, gaston, compression, etc.)
- [ ] Match movement descriptions against annotated Kilter problems
- [ ] Suggest Kilter Board problems that train similar movement patterns
- [ ] Requires: movement tagging system from Phase 5c + large analyzed video corpus
- [ ] Extremely ambitious — revisit when movement annotation data is mature

### Aurora Board Expansion
- [ ] Extend support to other Aurora boards: Tension Board, Moonboard
- [ ] BoardLib already supports these — same `boardlib database {board_name}` command
- [ ] Reuse all infrastructure: search, recognition, analysis, benchmarks
- [ ] Natural expansion once Kilter-specific product is proven and stable

---

## Backlog — Technical Debt

Items to address before or during the next major phase:

- [x] **Migrate `google.generativeai` → `google.genai`** — done in B003. New SDK active in production.
- [x] **`gemini_service.py`: migrate API key to pydantic Settings** — done in B003. Reads from `get_settings().gemini_api_key`.
- [ ] **Recreate API_SPECIFICATION.md** — archived due to heavy drift. Recreate after Phase 3 endpoints are stable.
- [ ] **Recreate DATABASE_SCHEMA.sql** — archived due to heavy drift. Recreate after Phase 3 schema is stable.
- [ ] **Retry with backoff on Gemini 503/429 errors in background task** — currently fails immediately on transient errors.
- [ ] **Clean up dead files: root Procfile, railway_start.sh, backend/Procfile** — legacy Railway config, no longer used.
- [ ] **Evaluate switch to gemini-2.5-pro when availability improves** — currently on 2.5-flash due to 503 availability issues with pro.

---

## Non-Negotiable Rules
- Gemini File API for video (NEVER frame-by-frame)
- FastAPI BackgroundTasks (NOT Celery/Redis for MVP)
- pytest required for every new endpoint
- Secrets in .env only
- Conventional commits, push after every feature
- Don't break existing auth
- BoardLib DB gitignored (85MB+ file)

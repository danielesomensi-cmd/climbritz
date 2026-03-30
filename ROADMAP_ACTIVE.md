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

---

## Completed

### Phase 1 — Foundation ✅
- FastAPI backend with JWT auth
- SQLite (dev) / PostgreSQL (prod) ready
- Alembic migrations

### Phase 2 — Video Upload + Basic Analysis ✅
- Video upload endpoint (POST /api/videos/upload)
- Gemini 2.0 Flash via File API (NOT frame-by-frame)
- Async processing with BackgroundTasks
- Frontend: drag-drop upload, progress bar, mobile-first

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

---

## Phase 4 — Visual Problem Recognition (Enhancement)

**Goal:** User takes photo of board with LEDs lit → system identifies the climb.

- [ ] Endpoint POST /api/climbs/identify (accepts image)
- [ ] Gemini vision: extract colored hold positions from photo
- [ ] Match extracted pattern against BoardLib DB layouts
- [ ] Return top-N candidate climbs for user confirmation
- [ ] Handle: camera angle distortion, gym lighting variance, partial occlusion
- [ ] Fallback: suggest manual search if confidence is low

---

## Phase 5 — Expert Video Comparison (Level 3)

**Goal:** Find and compare with expert beta videos.

### 5a — Expert Video Sources
- [ ] Curated list of 10-20 known expert Kilter Board YouTube channels
- [ ] YouTube Data API v3 integration: search "{climb_name} kilter board" filtered by expert channels
- [ ] Download via yt-dlp to local/S3 storage
- [ ] Cache: once downloaded, don't re-download
- [ ] Instagram video links from BoardLib DB (evaluate feasibility)

### 5b — Comparison Analysis
- [ ] Modified Gemini prompt: 2 videos (user + expert) + climb context
- [ ] Structured comparison output: what expert does differently, specific move suggestions
- [ ] Frontend: side-by-side or sequential video display with annotations

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
- [ ] Deploy frontend to Vercel
- [ ] Switch Railway DB from SQLite to PostgreSQL
- [ ] S3 for video storage (currently local filesystem)
- [ ] Mobile responsive polish
- [ ] Dashboard: aggregate stats, streaks, grade progression

---

## Backlog — Technical Debt

Items to address before or during the next major phase:

- [ ] **Migrate `google.generativeai` → `google.genai`** — current package is deprecated with a FutureWarning. Switch to the new `google.genai` SDK before it stops working. See: https://github.com/google-gemini/deprecated-generative-ai-python
- [ ] **`gemini_service.py`: migrate API key to pydantic Settings** — currently reads via `os.getenv()` instead of the project's `Settings` object in `core/config.py`. Align with the rest of the codebase.
- [ ] **Recreate API_SPECIFICATION.md** — archived due to heavy drift. Recreate after Phase 3 endpoints are stable.
- [ ] **Recreate DATABASE_SCHEMA.sql** — archived due to heavy drift. Recreate after Phase 3 schema is stable.

---

## Non-Negotiable Rules
- Gemini File API for video (NEVER frame-by-frame)
- FastAPI BackgroundTasks (NOT Celery/Redis for MVP)
- pytest required for every new endpoint
- Secrets in .env only
- Conventional commits, push after every feature
- Don't break existing auth
- BoardLib DB gitignored (85MB+ file)

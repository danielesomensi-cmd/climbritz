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
Every hold on the Kilter Board tagged by grip type: Jug / Crimp / Microcrimp / Sloper / Pinch / Pocket. No competitor has this. Enables grip-type filtering, session builder, problem generation, and BLE "illuminate only [type]" feature.

**BLE is in scope** (Phase 3e): Capacitor wraps Next.js → native iOS/Android app with `@capacitor-community/bluetooth-le`. Web Bluetooth is insufficient for iOS.

**Discovery competitors:** Climbdex (free, open-source, no AI), Kilter Lookup (limited filters, no AI), kilterboard.io (official new Kilter app, no AI, no grip-type filter).

**Coach — Gemini Vision analyzes:**
- Hold positions and quality
- Body tension and posture
- Efficiency score
- Specific weaknesses (e.g., "weak on sloper finish")
- Grade estimate

---

## 📦 Current State (B007 + Phase 3b Complete — 1 April 2026)

✅ **Phase 1:** FastAPI backend, JWT auth, User model, Alembic migrations
✅ **Phase 2:** Video upload + Gemini File API analysis (consolidated pipeline)
✅ **B001:** Codebase rationalization — single endpoint set, clean migrations, all tests green
✅ **B007:** Kilter Board-specific prompt rework — board detection, 5 scores, drills per issue
✅ **Phase 3a:** BoardLib DB setup — climb_service.py, test fixture DB
✅ **Phase 3b:** Climb search + detail API endpoints

**Video API surface:**
- `POST /api/videos/upload` → 202 (background Gemini analysis)
- `GET /api/videos/{id}` → video + status/results
- `GET /api/videos` → paginated list
- `DELETE /api/videos/{id}` → delete

**Climb API surface (Phase 3b):**
- `GET /api/climbs/search?q={name}&angle={angle}` → autocomplete search
- `GET /api/climbs/{climb_uuid}?angle={angle}` → full detail with holds
- `GET /api/climbs/stats` → DB health stats

**Next:** Pre-Phase 3 — Hold Classification (HC-1 through HC-7), then Phase 3c AI Session Builder, Phase 3d Level 2 Enhanced Analysis, Phase 3e Capacitor + BLE

**Deploy:** Backend live on Railway (SQLite). Frontend on Vercel. Health check at `/health`.

**Gemini:** google.genai SDK, model gemini-2.5-flash, Kilter Board-specific prompt (B007), JSON repair + Pydantic validation

---

## Core Rules for Claude Development

### 📋 Code Standards
- **Language**: English for code, Italian for comments when needed
- **Style**: Follow PEP 8 (Python), ESLint (TypeScript)
- **No secrets in code**: Use environment variables for API keys
- **Type safety**: Always use TypeScript types, Python type hints

### ✅ ALWAYS Do This
1. **Write tests for every feature** — pytest (backend), Jest (frontend)
2. **Test locally before push** — full suite must pass
3. **Commit with clear messages**: `feat: add video upload endpoint`
4. **Push after each working feature** — small, atomic commits
5. **Document complex logic** — docstrings for functions

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
│   │   │   ├── auth.py             ✅ JWT auth (register, login, /me)
│   │   │   ├── videos.py           ✅ Upload, list, get, delete
│   │   │   ├── climbs.py           ✅ Search, detail, stats (Phase 3b)
│   │   │   └── circuits.py         ✅ Stub (legacy)
│   │   ├── core/
│   │   │   ├── config.py           ✅
│   │   │   ├── database.py         ✅
│   │   │   ├── security.py         ✅
│   │   │   └── deps.py             ✅
│   │   ├── models/
│   │   │   ├── user.py             ✅
│   │   │   └── video.py            ✅
│   │   ├── schemas/
│   │   │   ├── user.py             ✅
│   │   │   ├── auth.py             ✅
│   │   │   ├── video.py            ✅ VideoResponse, FormFeedbackResponse
│   │   │   └── climb.py            ✅ ClimbSearchResult, ClimbDetail
│   │   ├── services/
│   │   │   ├── auth_service.py     ✅
│   │   │   ├── gemini_service.py   ✅ File API (lazy init, Kilter Board prompt)
│   │   │   ├── climb_service.py    ✅ Read-only BoardLib DB queries
│   │   │   ├── video_service.py    ✅ ffmpeg utils
│   │   │   └── storage_service.py  ✅ Local filesystem
│   │   ├── utils/
│   │   │   └── kilter_parser.py    ✅ Layout parser
│   │   └── main.py                 ✅
│   ├── alembic/versions/
│   │   ├── 001_initial_migration.py ✅
│   │   └── 002_video_form_analysis.py ✅
│   ├── tests/
│   │   ├── test_videos.py          ✅ video + gemini tests
│   │   ├── test_climb_service.py   ✅ climb service tests
│   │   ├── test_climbs_api.py      ✅ climb API tests
│   │   ├── test_kilter_parser.py   ✅
│   │   └── fixtures/test_kilter.db ✅ test fixture DB
│   ├── conftest.py                 ✅
│   └── requirements.txt
├── app/ (Next.js 14 frontend)
│   ├── page.tsx                    ✅ Homepage
│   ├── upload/page.tsx             ✅ Drag-drop upload
│   ├── login/page.tsx              ✅
│   ├── dashboard/page.tsx          ✅
│   └── videos/[id]/page.tsx        ✅
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

# Git
git status && git diff
git add . && git commit -m "feat: description"
git push origin main
```

---

## 🧪 Testing Requirements
- **Backend:** pytest, >80% coverage on new code
- **Frontend:** Jest + React Testing Library
- All tests must pass before push

---

## 🎬 Development Flow
1. **Receive task** → Understand scope
2. **Plan** → Files to change + dependencies
3. **Code** → Implement + tests
4. **Verify** → Full test suite green
5. **Commit** → Clear message
6. **Push** → Confirm push succeeded
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
| `backend/app/core/security.py` | JWT auth — broken = locked out |
| `backend/app/core/deps.py` | Dependency injection — affects all endpoints |
| `backend/app/api/auth.py` | Auth endpoints — broken = no login |
| `backend/app/api/videos.py` | Video pipeline — broken = core feature down |
| `alembic/versions/*.py` | Schema migrations — wrong = data loss |

For these files: read first, print analysis, wait for OK, then implement.

---

**Version:** 2.5 (B007 prompt rework + Phase 3b climb API 2026-04-01)
**Owner:** Daniele Somensi + Sam (AI Agent)

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

```
🎥 VIDEO = CORE FEATURE
  Upload video → Gemini File API → structured form analysis
  → Output: scores, strengths, weaknesses, drills, coaching cues

📸 PHOTO = UTILITY (supplementary, Phase 3+)
  Quick LED recognition (BoardLib) for logging
  → NOT the main value driver
```

**Gemini Vision analyzes:**
- Hold positions and quality
- Body tension and posture
- Efficiency score
- Specific weaknesses (e.g., "weak on sloper finish")
- Grade estimate

---

## 📦 Current State (B003 Complete — 30 March 2026)

✅ **Phase 1:** FastAPI backend, JWT auth, User model, Alembic migrations
✅ **Phase 2:** Video upload + Gemini File API analysis (consolidated pipeline)
✅ **B001:** Codebase rationalization — single endpoint set, clean migrations, all tests green

**Video API surface (consolidated):**
- `POST /api/videos/upload` → 202 (background Gemini analysis)
- `GET /api/videos/{id}` → video + status/results
- `GET /api/videos` → paginated list
- `DELETE /api/videos/{id}` → delete

**Next:** Phase 3 — BoardLib integration for contextual AI coaching

**Deploy:** Backend live on Railway (SQLite). Alembic runs in startCommand. Health check at `/health`.

**Gemini:** google.genai SDK, model gemini-2.5-flash, JSON repair fallback, response_mime_type=application/json

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
5. Add circuit detection as a primary feature (it's Phase 2)

---

## 🏗️ Project Structure

```
kilter-training-app/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth.py             ✅ JWT auth (register, login, /me)
│   │   │   ├── videos.py           ✅ Upload, list, get, delete
│   │   │   └── circuits.py         ✅ Stub for future BoardLib
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
│   │   │   └── video.py            ✅ VideoResponse, FormFeedbackResponse
│   │   ├── services/
│   │   │   ├── auth_service.py     ✅
│   │   │   ├── gemini_service.py   ✅ File API (lazy init)
│   │   │   ├── video_service.py    ✅ ffmpeg utils
│   │   │   └── storage_service.py  ✅ Local filesystem
│   │   ├── utils/
│   │   │   └── kilter_parser.py    ✅ Layout parser
│   │   └── main.py                 ✅
│   ├── alembic/versions/
│   │   ├── 001_initial_migration.py ✅
│   │   └── 002_video_form_analysis.py ✅
│   ├── tests/
│   │   ├── test_videos.py          ✅ 46 tests
│   │   └── test_kilter_parser.py   ✅
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

---

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

**Version:** 2.3 (B005 quick wins from climb-agent audit 2026-03-31)
**Owner:** Daniele Somensi + Sam (AI Agent)

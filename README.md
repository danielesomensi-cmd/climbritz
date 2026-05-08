# Kilter-Up — AI Climbing Companion for Kilter Board

AI climbing companion for Kilter Board — search 160k+ climbs by grip type, build AI training sessions, connect to your board via Bluetooth (Discovery, free) + video technique analysis powered by Gemini 2.5 Flash (Coach, €7.99/month).

## Quick Start

### Backend
```bash
cd backend
python3.11 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # then edit with GEMINI_API_KEY + CLERK_JWKS_URL/CLERK_SECRET_KEY/CLERK_PUBLISHABLE_KEY (from your Clerk dashboard)
alembic upgrade head
uvicorn app.main:app --reload --port 8001
```

### Frontend
```bash
npm install
cp .env.example .env.local  # then set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY from your Clerk dashboard
npm run dev  # http://localhost:3000
```

### Tests
```bash
cd backend && pytest -v
```

## Tech Stack
- **Frontend:** Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Python 3.11 + FastAPI + SQLAlchemy + Alembic
- **AI:** Gemini 2.5 Flash (File API, google.genai SDK)
- **Auth:** Clerk (hosted sign-in / sign-up)
- **DB:** SQLite (dev) / PostgreSQL (prod)

## Deployment
- **Backend:** Railway (FastAPI + SQLite, auto-migrates on deploy)
- **Frontend:** Vercel — kilter-up-coach.vercel.app
- **CI:** Alembic migrations run automatically via `startCommand` in `backend/railway.toml`

## API Endpoints

Core endpoints: videos (upload/list/get/delete), climbs (search/detail/stats), holds (board-image/hold-image), admin (sync-db/upload-db). Auth is owned by Clerk (hosted sign-in/sign-up); backend verifies Clerk JWTs via JWKS.

See `CLAUDE.md` for the complete API surface with parameters and response codes.

## Repo
https://github.com/danielesomensi-cmd/kilter-up

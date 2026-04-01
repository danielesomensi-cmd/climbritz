# Kilter-Up — AI Climbing Coach for Kilter Board

Upload climbing videos and get AI-powered coaching feedback using Gemini 2.5 Flash.

## Quick Start

### Backend
```bash
cd backend
python3.11 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # then edit with your GEMINI_API_KEY
alembic upgrade head
uvicorn app.main:app --reload --port 8001
```

### Frontend
```bash
npm install
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
- **DB:** SQLite (dev) / PostgreSQL (prod)

## Deployment
- **Backend:** Railway (FastAPI + SQLite, auto-migrates on deploy)
- **Frontend:** Vercel — kilter-up-coach.vercel.app
- **CI:** Alembic migrations run automatically via `startCommand` in `railway.toml`

## API Endpoints
- `POST /api/videos/upload` — Upload video for analysis (202 Accepted)
- `GET /api/videos/{id}` — Get video status and results
- `GET /api/videos` — List videos (paginated)
- `DELETE /api/videos/{id}` — Delete video
- `POST /api/auth/register` — Register
- `POST /api/auth/login` — Login
- `GET /api/auth/me` — Current user

## Repo
https://github.com/danielesomensi-cmd/kilter-up

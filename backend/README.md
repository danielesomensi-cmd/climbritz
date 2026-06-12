# Kilter Backend — FastAPI Application

FastAPI backend for the Climbritz video analysis platform.

## Quick Start

```bash
source venv/bin/activate
cp .env.example .env  # edit with GEMINI_API_KEY + CLERK_JWKS_URL/CLERK_SECRET_KEY/CLERK_PUBLISHABLE_KEY
alembic upgrade head
uvicorn app.main:app --reload --port 8001
```

Server: `http://localhost:8001`

## API Endpoints

### Health
- `GET /health` — Server status

### Auth

Auth is handled by Clerk (hosted /sign-in and /sign-up pages). Backend verifies Clerk-issued JWTs via `core/clerk.py` — there are no `/api/auth/*` endpoints. Protected routes accept `Authorization: Bearer <Clerk JWT>`, or (in non-production environments only) `X-User-ID: <uuid>` as a dev/test fallback.

### Videos
- `POST /api/videos/upload` — Upload video for analysis (202 Accepted, async)
- `GET /api/videos/{video_id}` — Get video status + results
- `GET /api/videos` — List videos (paginated)
- `DELETE /api/videos/{id}` — Delete video

### Climbs (BoardLib)
- `GET /api/climbs/search?q={name}&angle={angle}&moves={bucket}&benchmark={bool}&nomatch={bool}&limit={n}` — Search climbs by name + filters (`benchmark=true` → benchmark climbs at the selected angle, A022; `nomatch=true` → climbs with the setter's "no matching" rule, A029)
- `GET /api/climbs/{climb_uuid}?angle={angle}` — Full climb detail with holds
- `GET /api/climbs/stats` — Database stats
- `POST /api/climbs/generate` — A026: remix a fresh problem from the matching pool (angle / grade range / moves; `grip_types` reserved, ignored in v1). Ephemeral. 422 when the pool is too small. JWT-gated.

### My Problems (A030 — saved AI-generated climbs)
- `POST /api/my-climbs` — Save a generated problem (validates BoardLib frames encoding incl. 1–2 start / 1–2 finish / ≥3 holds; optional `name`/`grade` overrides (A031); otherwise grade from seed + AI name with local fallback). JWT-gated, owner-scoped.
- `POST /api/my-climbs/propose-name` — A031: `{angle?, grade?}` → `{name, source}` (name-on-generate; never fails).
- `GET /api/my-climbs` — List (newest first, with `ascent_count`) · `GET /api/my-climbs/{uuid}` — Detail with holds · `PATCH /api/my-climbs/{uuid}` — Edit name/grade/frames (A031, frames re-validated) · `DELETE /api/my-climbs/{uuid}`
- Generated problems are loggable via `POST /api/logs` and merge into `/api/climbs/search` via `my_problems=include|only` (flagged `is_mine`).

## Documentation

- **Swagger UI**: http://localhost:8001/docs
- **ReDoc**: http://localhost:8001/redoc

## Project Structure

```
app/
├── core/          # config (pydantic Settings), database, clerk (JWT verification), deps
├── api/           # routes: videos, climbs, holds, admin, circuits
├── models/        # SQLAlchemy models: User (Clerk shadow row), VideoUpload
├── schemas/       # Pydantic schemas (video, climb, user)
├── services/      # gemini_service, climb_service, video_service, storage_service
└── main.py        # FastAPI app factory
```

## Database

SQLite (dev) via SQLAlchemy. PostgreSQL planned for production.

```bash
alembic upgrade head   # apply migrations
alembic revision --autogenerate -m "description"  # new migration
```

## Background Processing

Video analysis runs as a FastAPI `BackgroundTask` (no Celery/Redis required). Upload returns `202 Accepted` immediately; poll `GET /api/videos/{id}` for status.

## Testing

```bash
pytest -v          # run all tests
pytest --cov       # with coverage report
```

## Key Dependencies

- `fastapi` + `uvicorn` — web framework
- `sqlalchemy` + `alembic` — ORM + migrations
- `google-genai` — Gemini 2.5 Flash File API for video analysis
- `PyJWT[crypto]` — Clerk JWT verification
- `boardlib` — Kilter Board database download/sync
- `pytest` — test suite

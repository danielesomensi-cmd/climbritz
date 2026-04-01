# Kilter Backend — FastAPI Application

FastAPI backend for the Kilter-Up video analysis platform.

## Quick Start

```bash
source venv/bin/activate
cp .env.example .env  # edit with GEMINI_API_KEY, JWT_SECRET, etc.
alembic upgrade head
uvicorn app.main:app --reload --port 8001
```

Server: `http://localhost:8001`

## API Endpoints

### Health
- `GET /health` — Server status

### Auth
- `POST /api/auth/register` — Register user
- `POST /api/auth/login` — Login user
- `GET /api/auth/me` — Current user (JWT required)

### Videos
- `POST /api/videos/upload` — Upload video for analysis (202 Accepted, async)
- `GET /api/videos/{video_id}` — Get video status + results
- `GET /api/videos` — List videos (paginated)
- `DELETE /api/videos/{id}` — Delete video

### Climbs (BoardLib)
- `GET /api/climbs/search?q={name}&angle={angle}&limit={n}` — Search climbs by name
- `GET /api/climbs/{climb_uuid}?angle={angle}` — Full climb detail with holds
- `GET /api/climbs/stats` — Database stats

## Documentation

- **Swagger UI**: http://localhost:8001/docs
- **ReDoc**: http://localhost:8001/redoc

## Project Structure

```
app/
├── core/          # config (pydantic Settings), database, security, deps
├── api/           # routes: auth, videos, climbs, circuits
├── models/        # SQLAlchemy models: User, VideoUpload
├── schemas/       # Pydantic schemas (video, climb, user, auth)
├── services/      # gemini_service, climb_service, video_service, storage_service, auth_service
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
- `python-jose` + `passlib[bcrypt]` — JWT auth
- `boardlib` — Kilter Board database download/sync
- `pytest` — test suite

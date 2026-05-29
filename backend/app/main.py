import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from app.core.config import get_settings
from app.core.database import engine
from app.api import (
    videos,
    circuits,
    climbs,
    holds,
    admin,
    logs,
    user_climbs,
    stats,
    classifications,
)

logger = logging.getLogger(__name__)

settings = get_settings()


def _validate_boardlib_db():
    """D014: verify the BoardLib DB exists AND has the `climbs` table.

    sqlite3.connect silently creates empty files on open, so file-presence
    alone is not enough — a poisoned empty DB on a persistent volume would
    make every /api/climbs/* request return 500. In production we fail
    startup loudly; in dev/test we only warn so local work isn't blocked.
    """
    import sqlite3
    from pathlib import Path

    db_path = Path(settings.boardlib_db_path)
    is_production = settings.environment == "production"

    if not db_path.exists():
        msg = (
            f"BoardLib DB missing at {db_path}. Set BOARDLIB_DB_PATH and/or "
            f"run `boardlib database kilter {db_path}`."
        )
        if is_production:
            raise RuntimeError(msg)
        logger.warning("BoardLib DB check skipped: %s", msg)
        return

    try:
        conn = sqlite3.connect(str(db_path))
        conn.execute("SELECT 1 FROM climbs LIMIT 1")
        conn.close()
    except sqlite3.DatabaseError as e:
        msg = (
            f"BoardLib DB at {db_path} is invalid or missing 'climbs' table: "
            f"{e}. Delete the file and redeploy to trigger a fresh download."
        )
        if is_production:
            raise RuntimeError(msg)
        logger.warning("BoardLib DB check failed: %s", msg)


def _validate_startup():
    """Fail fast if critical resources are missing."""
    from pathlib import Path

    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    if not os.access(upload_dir, os.W_OK):
        raise RuntimeError(f"Upload directory not writable: {upload_dir}")

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as e:
        raise RuntimeError(f"Database connectivity check failed: {e}")

    _validate_boardlib_db()

    logger.info(
        "Startup validation passed: app DB connected, BoardLib DB valid, "
        "upload dir writable"
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    _validate_startup()
    yield


app = FastAPI(
    title="Climbritz API",
    description="AI-powered climbing video form analysis",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS — read from ALLOWED_ORIGINS env var, fallback to localhost for dev.
# B021: the mobile build serves the WebView from app.climbritz.app
# (capacitor server.hostname) so Clerk's SameSite=Lax session cookie is
# same-site. The WebView ORIGIN differs per platform, though:
#   - Android honors androidScheme=https  → Origin: https://app.climbritz.app
#   - iOS reserves the https scheme, so iosScheme=https is ignored and WKWebView
#     stays on the capacitor scheme → Origin: capacitor://app.climbritz.app
# Both must be allowed. Older builds (+ Android dev) also send the localhost
# variants, kept for backward-compat.
origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
for cap_origin in (
    "https://app.climbritz.app",
    "capacitor://app.climbritz.app",
    "capacitor://localhost",
    "http://localhost",
    "https://localhost",
):
    if cap_origin not in origins:
        origins.append(cap_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(
        "Unhandled exception on %s %s: %s",
        request.method,
        request.url.path,
        exc,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


# Routes
# A019: /api/auth router deleted — Clerk hosts sign-in/sign-up flows. The
# frontend talks directly to Clerk; backend only verifies Clerk-issued JWTs
# via deps.get_current_user_id.
app.include_router(videos.router, prefix="/api/videos", tags=["videos"])
app.include_router(circuits.router, prefix="/api/circuits", tags=["circuits"])
app.include_router(climbs.router, prefix="/api/climbs", tags=["climbs"])
app.include_router(holds.router, prefix="/api/holds", tags=["holds"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(logs.router, prefix="/api/logs", tags=["logs"])
app.include_router(
    user_climbs.router, prefix="/api/user-climbs", tags=["user-climbs"]
)
app.include_router(stats.router, prefix="/api/stats", tags=["stats"])
app.include_router(
    classifications.router,
    prefix="/api/classifications",
    tags=["classifications"],
)


import time
from pathlib import Path

UPLOAD_DIR = Path(settings.upload_dir)
PERSISTENCE_MARKER = UPLOAD_DIR / ".persistence_marker"


def _check_persistence() -> dict:
    """Check if persistent volume survived redeployment."""
    marker_existed = PERSISTENCE_MARKER.exists()
    if not marker_existed:
        try:
            UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
            PERSISTENCE_MARKER.write_text(f"created:{time.time()}")
        except OSError:
            return {"persistence_ok": False, "error": "Cannot write marker"}
    return {
        "persistence_ok": True,
        "marker_survived_redeploy": marker_existed,
    }


def _check_upload_dir() -> dict:
    """Check if upload directory exists and is writable."""
    return {
        "path": str(UPLOAD_DIR),
        "exists": UPLOAD_DIR.exists(),
        "writable": os.access(UPLOAD_DIR, os.W_OK) if UPLOAD_DIR.exists() else False,
    }


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "environment": settings.environment,
        "version": "0.1.0",
        "persistence": _check_persistence(),
        "upload_dir": _check_upload_dir(),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.environment == "development"
    )

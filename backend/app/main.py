import logging
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import get_settings
from app.api import auth, videos, circuits

logger = logging.getLogger(__name__)

settings = get_settings()

app = FastAPI(
    title="Kilter Up API",
    description="AI-powered climbing video form analysis",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — read from ALLOWED_ORIGINS env var, fallback to localhost for dev
origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

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
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(videos.router, prefix="/api/videos", tags=["videos"])
app.include_router(circuits.router, prefix="/api/circuits", tags=["circuits"])


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "environment": settings.environment,
        "version": "0.1.0"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.environment == "development"
    )

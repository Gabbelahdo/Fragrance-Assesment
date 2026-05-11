from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import ensure_indexes
from app.fragrances.seed import ensure_suggest_seed
from app.users.router import router as users_router
from app.fragrances.router import router as fragrances_router
from app.ai.router import router as ai_router
from app.feedback.router import router as feedback_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run startup tasks before the server starts accepting requests."""
    await ensure_indexes()
    await ensure_suggest_seed()   # seeds suggest_seed collection if empty
    yield


app = FastAPI(
    title="Fragrance Assessment API",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────────────────────────────────
app.include_router(users_router,      prefix="/users",      tags=["Users"])
app.include_router(fragrances_router, prefix="/fragrances", tags=["Fragrances"])
app.include_router(ai_router,         prefix="/ai",         tags=["AI"])
app.include_router(feedback_router,   prefix="/feedback",   tags=["Feedback"])


@app.get("/health")
async def health():
    """Used by Azure App Service health checks."""
    return {"status": "ok"}

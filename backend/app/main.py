from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.users.router import router as users_router
from app.fragrances.router import router as fragrances_router
from app.ai.router import router as ai_router

app = FastAPI(
    title="Fragrance Assessment API",
    version="0.1.0",
    docs_url="/docs",       # Swagger UI — disable in prod if desired
    redoc_url="/redoc",
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


@app.get("/health")
async def health():
    """Used by Azure App Service health checks."""
    return {"status": "ok"}

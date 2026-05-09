"""
Shared fixtures for the test suite.

Environment variables are set here BEFORE any app module is imported so that
pydantic-settings picks them up instead of reading the local .env file.
This makes tests fully self-contained and safe to run in CI without real keys.
"""
import os

# ── Set env vars before any app import ───────────────────────────────────────
os.environ.setdefault("MONGODB_URL",        "mongodb://localhost:27017/fragrance_test")
os.environ.setdefault("JWT_SECRET",         "test-secret-do-not-use-in-prod")
os.environ.setdefault("FRAGRANCE_API_URL",  "https://api.fragella.com/api")
os.environ.setdefault("FRAGRANCE_API_KEY",  "test-key")
os.environ.setdefault("AI_API_KEY",         "test-key")
os.environ.setdefault("CORS_ORIGINS",       "http://localhost:5173")

import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.rate_limit import _store as rate_limit_store
from app.core.database import get_db


# ── HTTP client ───────────────────────────────────────────────────────────────

@pytest.fixture
async def client() -> AsyncClient:
    """Async HTTPX client wired directly to the FastAPI app (no real TCP)."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as c:
        yield c


# ── Rate limit ────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def reset_rate_limit():
    """Clear the in-memory rate-limit store before and after every test."""
    rate_limit_store.clear()
    yield
    rate_limit_store.clear()


# ── MongoDB test DB ───────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
async def clean_db():
    """Drop cache collections before each test so they don't bleed into each other."""
    db = get_db()
    try:
        await db["recommendation_cache"].drop()
        await db["fragrance_cache"].drop()
    except Exception:
        pass   # MongoDB might not be available; cache tests will just skip caching
    yield


# ── Shared fake data ──────────────────────────────────────────────────────────

VALID_PREFERENCES = {
    "budgetMin":       500,
    "budgetMax":       3000,
    "season":          "all_year",
    "fragranceGender": "unisex",
    "notesText":       "oud, vanilla",
    "preferNiche":     True,
    "preferDesigner":  False,
    "preferDupe":      False,
    "name":            "Test User",
    "age":             28,
    "gender":          "male",
    "country":         "Sweden",
    "collectionSize":  "5to10",
}

VALID_PROFILE = {
    "name":           "Test User",
    "age":            28,
    "gender":         "male",
    "country":        "Sweden",
    "collectionSize": "5to10",
}

FAKE_RECOMMENDATIONS = [
    {
        "id":          f"{i}-Fragrance {i}",
        "name":        f"Fragrance {i}",
        "brand":       f"Brand {i}",
        "description": "EDP · Longevity: Long Lasting",
        "notes":       ["Oud", "Vanilla"],
        "imageUrl":    None,
        "matchScore":  95 - i * 5,
        "type":        "niche",
        "priceRange":  "1000 kr",
        "reason":      "Great match.",
    }
    for i in range(5)
]

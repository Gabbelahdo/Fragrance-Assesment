"""
Admin endpoints — protected by ADMIN_KEY env var.

Usage:
  GET  /admin/seed-status          → counts in all key collections
  POST /admin/reseed-suggest?key=X → drops + re-seeds suggest_seed collection

Set ADMIN_KEY in Azure Container Apps env vars (or .env locally).
Leave ADMIN_KEY empty to disable all admin endpoints (returns 403).
"""
from fastapi import APIRouter, HTTPException, Query

from app.core.config import settings
from app.core.database import get_db
from app.fragrances.seed import ensure_suggest_seed, fragella_bulk_seed, SEED_BRANDS, SEED_FRAGRANCES

router = APIRouter()


def _check_key(key: str) -> None:
    """Raise 403 if admin endpoints are disabled or the key is wrong."""
    if not settings.admin_key or key != settings.admin_key:
        raise HTTPException(status_code=403, detail="Forbidden")


@router.get("/seed-status")
async def seed_status(key: str = Query(...)):
    """Return document counts for all key collections."""
    _check_key(key)
    db = get_db()
    return {
        "suggest_seed":        await db["suggest_seed"].count_documents({}),
        "fragrance_cache":     await db["fragrance_cache"].count_documents({}),
        "recommendation_cache":await db["recommendation_cache"].count_documents({}),
        "assessments":         await db["assessments"].count_documents({}),
        "feedback":            await db["feedback"].count_documents({}),
        "seed_brands_expected":    len(SEED_BRANDS),
        "seed_fragrances_expected":len(SEED_FRAGRANCES),
    }


@router.post("/reseed-suggest")
async def reseed_suggest(key: str = Query(...)):
    """
    Drop the suggest_seed collection and re-seed it from the static list.
    Use this if the collection is empty after a deploy.
    """
    _check_key(key)
    db = get_db()

    # Drop so ensure_suggest_seed sees count=0 and re-inserts
    await db["suggest_seed"].drop()

    await ensure_suggest_seed()

    count = await db["suggest_seed"].count_documents({})
    return {"seeded": count, "expected": len(SEED_BRANDS) + len(SEED_FRAGRANCES)}


@router.post("/fragella-bulk-seed")
async def fragella_bulk_seed_endpoint(key: str = Query(...)):
    """
    Sweep Fragella A–Z (26 API calls) and upsert every brand and fragrance
    found into suggest_seed.  Existing documents are never deleted.

    Typical result: 2 000–5 000 fragrances + all their brands in ~30 s.
    Safe to run multiple times — fully idempotent via upsert.
    """
    _check_key(key)
    result = await fragella_bulk_seed()
    return result

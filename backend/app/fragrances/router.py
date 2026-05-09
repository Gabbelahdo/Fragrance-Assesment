"""
Fragrance lookup router.

GET /fragrances/search?name={name}  — proxy a single Fragella lookup
"""
from fastapi import APIRouter, Query

from app.fragrances import service

router = APIRouter()


@router.get("/search")
async def search_fragrance(name: str = Query(..., description="Fragrance name to look up")):
    """Proxy the Fragella API for a single fragrance name."""
    result = await service.lookup_fragrance(name)
    if not result:
        return {"found": False, "data": None}
    return {"found": True, "data": result}

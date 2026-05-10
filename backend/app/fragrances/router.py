"""
Fragrance lookup router.

GET /fragrances/search?name={name}          — proxy a single Fragella lookup
GET /fragrances/suggest?query={q}&type={t}  — autocomplete suggestions from Fragella
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


@router.get("/suggest")
async def suggest_fragrances(
    query: str = Query(..., min_length=2, description="Partial search query (min 2 chars)"),
    type: str = Query("fragrance", pattern="^(fragrance|brand)$", description="fragrance or brand"),
):
    """
    Return up to 8 autocomplete suggestions from Fragella.
    type=fragrance → [{name, brand}]
    type=brand     → [{name}]  (unique brand names)
    """
    results = await service.search_suggestions(query, suggest_type=type)
    return {"results": results}

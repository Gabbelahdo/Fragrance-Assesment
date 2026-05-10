"""
Fragella API proxy service — with MongoDB cache (30-day TTL).

Lookup order:
  1. MongoDB fragrance_cache  →  instant, free
  2. Fragella API             →  ~200 ms, costs an API call
  3. None                     →  Fragella had no result

MongoDB is optional: if it is unreachable the service falls through to
a live Fragella call and logs a warning.
"""
from datetime import datetime, timezone

import httpx

from app.core.config import settings
from app.core.database import get_db


# ── Normalisation helpers ─────────────────────────────────────────────────────

def _flatten_notes(notes_obj: dict | None) -> list[str]:
    """Flatten Top/Middle/Base note lists into a single list of name strings."""
    if not notes_obj:
        return []
    names: list[str] = []
    for layer in ("Top", "Middle", "Base"):
        for item in notes_obj.get(layer) or []:
            if isinstance(item, dict):
                name = item.get("name") or item.get("Name") or ""
            else:
                name = str(item)
            if name:
                names.append(name)
    return names


def _format_price(price: str | None) -> str:
    if not price:
        return "Price not available"
    try:
        return f"{round(float(price))} kr"
    except (ValueError, TypeError):
        return "Price not available"


def _build_description(result: dict) -> str:
    parts: list[str] = []
    if result.get("OilType"):
        parts.append(result["OilType"])
    if result.get("Longevity"):
        parts.append(f"Longevity: {result['Longevity']}")
    if result.get("Sillage"):
        parts.append(f"Sillage: {result['Sillage']}")
    return " · ".join(parts) if parts else "No description available."


def _normalise(raw: dict, fallback_name: str) -> dict:
    return {
        "fragella_name":  raw.get("Name") or fallback_name,
        "fragella_brand": raw.get("Brand") or "",
        "image_url":      raw.get("Image URL") or raw.get("ImageURL") or None,
        "notes":          _flatten_notes(raw.get("Notes")),
        "description":    _build_description(raw),
        "price_range":    _format_price(raw.get("Price")),
    }


# ── Cache helpers ─────────────────────────────────────────────────────────────

async def _cache_get(name: str) -> dict | None:
    try:
        doc = await get_db()["fragrance_cache"].find_one({"_id": name.lower()})
        if doc:
            print(f"[fragrances.service] Cache hit: '{name}'")
            return doc["data"]
    except Exception as exc:
        print(f"[fragrances.service] Cache read error: {exc}")
    return None


async def _cache_set(name: str, data: dict) -> None:
    try:
        await get_db()["fragrance_cache"].replace_one(
            {"_id": name.lower()},
            {
                "_id":       name.lower(),
                "data":      data,
                "cached_at": datetime.now(timezone.utc),   # TTL index key
            },
            upsert=True,
        )
    except Exception as exc:
        print(f"[fragrances.service] Cache write error: {exc}")


# ── Public API ────────────────────────────────────────────────────────────────

async def search_suggestions(
    query: str,
    suggest_type: str = "fragrance",
    limit: int = 8,
) -> list[dict]:
    """
    Return autocomplete suggestions from Fragella for a partial query.

    suggest_type="fragrance"  → list of {name, brand} pairs
    suggest_type="brand"      → list of unique {name} brand names
    """
    url = f"{settings.fragrance_api_url}/v1/fragrances"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                url,
                params={"search": query, "limit": limit},
                headers={"x-api-key": settings.fragrance_api_key},
            )
            resp.raise_for_status()
            data: list[dict] = resp.json()
    except Exception as exc:
        print(f"[fragrances.service] Suggestion search failed for '{query}': {exc}")
        return []

    if suggest_type == "brand":
        seen: set[str] = set()
        brands: list[dict] = []
        for item in data:
            brand = (item.get("Brand") or "").strip()
            if brand and brand.lower() not in seen:
                seen.add(brand.lower())
                brands.append({"name": brand})
        return brands

    # default: fragrance
    return [
        {"name": (item.get("Name") or "").strip(), "brand": (item.get("Brand") or "").strip()}
        for item in data
        if item.get("Name")
    ]


async def lookup_fragrance(name: str) -> dict | None:
    """
    Return normalised Fragella data for a fragrance name.
    Checks MongoDB cache first; falls back to a live Fragella call.
    Returns None if not found or if both sources fail.
    """
    # 1. Cache
    cached = await _cache_get(name)
    if cached is not None:
        return cached

    # 2. Live Fragella call
    url = f"{settings.fragrance_api_url}/v1/fragrances"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                url,
                params={"search": name, "limit": 1},
                headers={"x-api-key": settings.fragrance_api_key},
            )
            resp.raise_for_status()
            data: list[dict] = resp.json()
    except Exception as exc:
        print(f"[fragrances.service] Fragella lookup failed for '{name}': {exc}")
        return None

    if not data:
        return None

    result = _normalise(data[0], name)

    # 3. Store in cache for next time
    await _cache_set(name, result)

    return result

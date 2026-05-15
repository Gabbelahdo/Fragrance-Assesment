"""
Parfumo season-vote scraper.

For each fragrance, fetches the community season-vote distribution
from parfumo.com and returns percentages per season.

Result shape: {"spring": 25, "summer": 45, "autumn": 20, "winter": 10}
              (integers that sum to ~100)

Results are cached in MongoDB with a 30-day TTL — season votes
are stable data that rarely change significantly.
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone

import httpx
from bs4 import BeautifulSoup

from app.core.database import get_db

# ── Constants ─────────────────────────────────────────────────────────────────

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

_TIMEOUT = 6.0  # seconds — never block the pipeline for too long
_SEASON_KEYS = ("spring", "summer", "autumn", "winter")


# ── URL builder ───────────────────────────────────────────────────────────────

def _slugify(text: str) -> str:
    """Convert 'Black Afgano' → 'Black_Afgano' for Parfumo URLs."""
    return re.sub(r"\s+", "_", text.strip())


def _direct_url(name: str, brand: str) -> str:
    return (
        f"https://www.parfumo.com/Perfumes/"
        f"{_slugify(brand)}/{_slugify(name)}"
    )


def _search_url(name: str, brand: str) -> str:
    query = f"{brand} {name}".strip()
    encoded = query.replace(" ", "+")
    return f"https://www.parfumo.com/search?q={encoded}"


# ── HTML parsers ──────────────────────────────────────────────────────────────

def _parse_season_votes(html: str) -> dict[str, int] | None:
    """
    Extract season vote percentages from a Parfumo fragrance page.

    Tries multiple strategies in order — Parfumo has changed their
    markup before, so fallbacks are important.

    MAINTENANCE: if this stops working, open a Parfumo fragrance page
    in DevTools, search the page source for "spring" or "season" and
    update the patterns below to match the new structure.
    """
    soup = BeautifulSoup(html, "lxml")

    # ── Strategy 1: JSON blob in <script> tags ────────────────────────────────
    for script in soup.find_all("script"):
        text = script.string or ""

        # Pattern A: "seasons":{"spring":23,"summer":45,...}
        match = re.search(
            r'"seasons"\s*:\s*\{([^}]+)\}',
            text,
            re.IGNORECASE,
        )
        if match:
            try:
                data = json.loads("{" + match.group(1) + "}")
                votes = _normalize_votes(data)
                if votes:
                    return votes
            except (json.JSONDecodeError, ValueError):
                pass

        # Pattern B: flat keys like "season_spring": 23
        flat: dict[str, int] = {}
        for season in _SEASON_KEYS:
            m = re.search(
                rf'"season_{season}"\s*:\s*(\d+)',
                text,
                re.IGNORECASE,
            )
            if m:
                flat[season] = int(m.group(1))
        if len(flat) == 4:
            return flat

        # Pattern C: Parfumo sometimes embeds chart data as:
        # data: [23, 45, 20, 12]  adjacent to season labels
        season_block = re.search(
            r'spring.*?summer.*?autumn.*?winter.*?data\s*:\s*\[(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\]',
            text,
            re.IGNORECASE | re.DOTALL,
        )
        if season_block:
            return {
                "spring": int(season_block.group(1)),
                "summer": int(season_block.group(2)),
                "autumn": int(season_block.group(3)),
                "winter": int(season_block.group(4)),
            }

    # ── Strategy 2: data-* attributes on chart container ─────────────────────
    for attr_name in ("data-spring", "data-season-spring"):
        chart = soup.find(attrs={attr_name: True})
        if chart:
            try:
                autumn_val = (
                    chart.get("data-autumn")
                    or chart.get("data-fall")
                    or "0"
                )
                return {
                    "spring": int(chart.get("data-spring", 0)),
                    "summer": int(chart.get("data-summer", 0)),
                    "autumn": int(autumn_val),
                    "winter": int(chart.get("data-winter", 0)),
                }
            except (TypeError, ValueError):
                pass

    # ── Strategy 3: percentage text near season labels ────────────────────────
    found: dict[str, int] = {}
    for season in _SEASON_KEYS:
        # Find any element whose text contains "Spring 23%" or "23% Spring"
        tag = soup.find(
            string=re.compile(
                rf"(^|\s){season}\s*[\d.]+\s*%|[\d.]+\s*%\s*{season}",
                re.IGNORECASE,
            )
        )
        if tag:
            m = re.search(r"([\d.]+)\s*%", str(tag), re.IGNORECASE)
            if m:
                found[season] = int(float(m.group(1)))

        # Also check title/aria-label attributes
        for el in soup.find_all(title=re.compile(rf"{season}", re.IGNORECASE)):
            m = re.search(r"([\d.]+)\s*%", el.get("title", ""))
            if m:
                found[season] = int(float(m.group(1)))
            break

    if len(found) == 4:
        return found

    return None


def _normalize_votes(data: dict) -> dict[str, int] | None:
    """Accept various key names → canonical spring/summer/autumn/winter."""
    aliases = {
        "spring":  ["spring", "frühling", "printemps", "primavera"],
        "summer":  ["summer", "sommer", "été", "ete", "estate"],
        "autumn":  ["autumn", "fall", "herbst", "automne", "autunno"],
        "winter":  ["winter", "hiver", "inverno"],
    }
    result: dict[str, int] = {}
    for canonical, names in aliases.items():
        for n in names:
            if n in data:
                result[canonical] = int(data[n])
                break
    return result if len(result) == 4 else None


# ── Search result resolver ────────────────────────────────────────────────────

def _extract_first_fragrance_url(html: str) -> str | None:
    """From a Parfumo search results page, return the first fragrance URL."""
    soup = BeautifulSoup(html, "lxml")
    # Parfumo search results: links containing /Perfumes/
    for a in soup.find_all("a", href=re.compile(r"/Perfumes/", re.IGNORECASE)):
        href = a.get("href", "")
        if href.startswith("/"):
            href = "https://www.parfumo.com" + href
        if "/Perfumes/" in href:
            return href
    return None


# ── MongoDB cache ─────────────────────────────────────────────────────────────

async def _cache_get(key: str) -> dict[str, int] | None:
    try:
        doc = await get_db()["parfumo_cache"].find_one({"_id": key})
        if doc:
            print(f"[parfumo] Cache hit: {key}")
            return doc["votes"]
    except Exception as exc:
        print(f"[parfumo] Cache read error: {exc}")
    return None


async def _cache_set(key: str, votes: dict[str, int]) -> None:
    try:
        await get_db()["parfumo_cache"].replace_one(
            {"_id": key},
            {
                "_id": key,
                "votes": votes,
                "created_at": datetime.now(timezone.utc),
            },
            upsert=True,
        )
    except Exception as exc:
        print(f"[parfumo] Cache write error: {exc}")


async def _ensure_ttl_index() -> None:
    """Create 30-day TTL index on parfumo_cache (idempotent)."""
    try:
        await get_db()["parfumo_cache"].create_index(
            "created_at",
            expireAfterSeconds=30 * 24 * 3600,
            background=True,
        )
    except Exception:
        pass  # index already exists or DB unavailable — not fatal


# ── Public API ────────────────────────────────────────────────────────────────

async def get_season_votes(name: str, brand: str) -> dict[str, int] | None:
    """
    Return community season-vote distribution for a fragrance.

    Returns None on any failure so callers can degrade gracefully
    without affecting the recommendation pipeline.
    """
    cache_key = f"{brand.strip().lower()}:{name.strip().lower()}"
    cached = await _cache_get(cache_key)
    if cached is not None:
        return cached

    async with httpx.AsyncClient(
        headers=_HEADERS,
        follow_redirects=True,
        timeout=_TIMEOUT,
    ) as client:
        # Try direct URL first (fast path)
        for url in [_direct_url(name, brand), _search_url(name, brand)]:
            try:
                resp = await client.get(url)
                if resp.status_code != 200:
                    continue

                html = resp.text

                # If it's a search page, resolve to the fragrance page
                if "search" in str(resp.url):
                    frag_url = _extract_first_fragrance_url(html)
                    if not frag_url:
                        continue
                    resp2 = await client.get(frag_url)
                    if resp2.status_code != 200:
                        continue
                    html = resp2.text

                votes = _parse_season_votes(html)
                if votes:
                    print(f"[parfumo] {name} by {brand}: {votes}")
                    await _cache_set(cache_key, votes)
                    return votes

            except httpx.TimeoutException:
                print(f"[parfumo] Timeout for '{name}'")
                break  # don't retry on timeout
            except Exception as exc:
                print(f"[parfumo] Error for '{name}': {exc}")

    print(f"[parfumo] No season data found for '{name}' by '{brand}'")
    return None

"""
Black-box precision tests — BB-07 through BB-10.

These tests call the REAL Claude model (no mocks) and evaluate recommendation
quality.  They are skipped automatically in CI because AI_API_KEY is set to
the placeholder "test-key" there.  Run locally with a real key:

    pytest tests/test_precision.py -v -m integration

The conftest `reset_rate_limit` fixture already clears the in-memory
rate-limit store before every test, so the 5-req/hr gate is bypassed.
"""
from __future__ import annotations

import os
import pytest
from httpx import AsyncClient

# ── Skip helper ───────────────────────────────────────────────────────────────
# If AI_API_KEY is still the test placeholder the calls would 401 immediately.
_HAS_REAL_KEY = os.environ.get("AI_API_KEY", "test-key") != "test-key"

integration = pytest.mark.skipif(
    not _HAS_REAL_KEY,
    reason="Integration test — requires a real AI_API_KEY",
)

# ── Base payloads ─────────────────────────────────────────────────────────────

_BB07 = {
    "budgetMin": 500, "budgetMax": 2000,
    "season": "spring", "fragranceGender": "women",
    "notesText": "floral, peony, rose",
    "preferNiche": False, "preferDesigner": True, "preferDupe": False,
    "name": "Test", "age": 28, "gender": "female",
    "country": "Sweden", "collectionSize": "5to10",
    "descriptionText": "", "likedBrandsText": "", "likedFragrancesText": "",
}

_BB08 = {
    "budgetMin": 800, "budgetMax": 3000,
    "season": "winter", "fragranceGender": "men",
    "notesText": "spicy, vanilla, tobacco",
    "preferNiche": True, "preferDesigner": True, "preferDupe": False,
    "name": "Test", "age": 30, "gender": "male",
    "country": "Sweden", "collectionSize": "5to10",
    "descriptionText": "",
    "likedBrandsText": "",
    "likedFragrancesText": "Spicebomb Extreme",
}

_BB09 = {
    "budgetMin": 200, "budgetMax": 600,
    "season": "summer", "fragranceGender": "men",
    "notesText": "citrus, fresh, marine",
    "preferNiche": False, "preferDesigner": False, "preferDupe": True,
    "name": "Test", "age": 25, "gender": "male",
    "country": "Sweden", "collectionSize": "lt5",
    "descriptionText": "",
    "likedBrandsText": "Creed, Tom Ford",
    "likedFragrancesText": "",
}

_BB10A = {
    "budgetMin": 500, "budgetMax": 4000,
    "season": "all_year", "fragranceGender": "men",
    "notesText": "birch, pineapple, musk, ambergris",
    "preferNiche": True, "preferDesigner": False, "preferDupe": False,
    "name": "Test", "age": 32, "gender": "male",
    "country": "Sweden", "collectionSize": "10plus",
    "descriptionText": "Looking for something similar to Creed Aventus, smoky birch pineapple signature",
    "likedBrandsText": "", "likedFragrancesText": "",
}

_BB10B = {
    "budgetMin": 500, "budgetMax": 4000,
    "season": "all_year", "fragranceGender": "men",
    "notesText": "lavender, vanilla, mint, coumarin",
    "preferNiche": True, "preferDesigner": False, "preferDupe": False,
    "name": "Test", "age": 32, "gender": "male",
    "country": "Sweden", "collectionSize": "10plus",
    "descriptionText": "Looking for something similar to Jean Paul Gaultier Le Male, sweet lavender mint sailor signature",
    "likedBrandsText": "", "likedFragrancesText": "",
}

# ── Known brand sets for tier-checking ───────────────────────────────────────

_DESIGNER_BRANDS = {
    "dior", "chanel", "ysl", "yves saint laurent", "paco rabanne", "versace",
    "gucci", "hugo boss", "calvin klein", "dolce & gabbana", "givenchy",
    "burberry", "valentino", "giorgio armani", "hermès", "hermes",
    "lacoste", "ralph lauren", "marc jacobs", "coach", "michael kors",
    "viktor & rolf", "viktor&rolf", "mont blanc", "montblanc",
}

_NICHE_BRANDS = {
    "creed", "tom ford", "maison margiela", "byredo", "nishane", "xerjoff",
    "amouage", "initio", "mancera", "montale", "kilian", "orto parisi",
    "tauer", "zoologist", "serge lutens", "diptyque", "l'artisan", "lartisan",
    "memo paris", "roja parfums", "roja dove", "clive christian",
    "parfums de marly", "bdk parfums", "parfums de nicolai",
}

_DUPE_BRANDS = {
    "afnan", "lattafa", "armaf", "al haramain", "rasasi",
    "ard al zaafaran", "fragrance world", "pendora", "zara",
    "kemi oud", "paris corner", "riiffs", "maison alhambra",
}

# Known Le Male DNA markers
_LE_MALE_NOTES = {"lavender", "vanilla", "mint", "coumarin", "tonka", "ginger"}
_AVENTUS_NOTES = {"birch", "pineapple", "ambergris", "musk", "blackcurrant", "oakmoss"}


def _print_results(label: str, results: list) -> None:
    print(f"\n{'='*60}")
    print(f"  {label}")
    print(f"{'='*60}")
    for i, r in enumerate(results, 1):
        print(f"  [{i}] {r['name']} by {r['brand']} | type={r['type']} | "
              f"score={r['matchScore']} | price={r['priceRange']}")
        print(f"       {r['reason'][:120]}")


# ── BB-07 ─────────────────────────────────────────────────────────────────────

@integration
async def test_bb07_women_spring_designer_all_designer(client: AsyncClient):
    """
    BB-07 — Category enforcement: designer-only, women, spring.
    PASS criteria:
      - All 5 recommendations have type='designer'.
      - No niche or dupe brands appear.
      - Notes are floral/spring-appropriate (soft check via reason text).
    """
    resp = await client.post("/ai/recommend", json=_BB07)
    assert resp.status_code == 200
    results = resp.json()
    _print_results("BB-07: Women spring designer", results)

    assert len(results) == 5, f"Expected 5 results, got {len(results)}"

    for r in results:
        assert r["type"] == "designer", (
            f"Expected type=designer, got type={r['type']} for '{r['name']}' by {r['brand']}"
        )
        brand_lower = r["brand"].lower()
        assert brand_lower not in _NICHE_BRANDS, (
            f"Niche brand '{r['brand']}' appeared in designer-only results"
        )
        assert brand_lower not in _DUPE_BRANDS, (
            f"Dupe brand '{r['brand']}' appeared in designer-only results"
        )


# ── BB-08 ─────────────────────────────────────────────────────────────────────

@integration
async def test_bb08_multi_category_spicebomb_extreme_scent_target(client: AsyncClient):
    """
    BB-08 — Multi-category (niche+designer) with Spicebomb Extreme as liked fragrance.
    PASS criteria:
      - All 5 have type in {'niche', 'designer'} (no dupes).
      - No non-fragrance brand appears (Pure Cosmetics etc.).
      - At least 3 results include spicy/vanilla/tobacco in reason text.
      - No summer/citrus/aquatic fragrances (winter season).
    """
    from app.ai.service import _NON_FRAGRANCE_BRANDS

    resp = await client.post("/ai/recommend", json=_BB08)
    assert resp.status_code == 200
    results = resp.json()
    _print_results("BB-08: Multi-category + Spicebomb Extreme", results)

    assert len(results) >= 4, f"Expected at least 4 results, got {len(results)}"

    for r in results:
        assert r["type"] in ("niche", "designer"), (
            f"Dupe appeared in niche+designer results: '{r['name']}' type={r['type']}"
        )
        brand_lower = r["brand"].lower()
        assert brand_lower not in _DUPE_BRANDS, (
            f"Dupe brand '{r['brand']}' slipped through"
        )
        assert brand_lower not in _NON_FRAGRANCE_BRANDS, (
            f"Non-fragrance brand '{r['brand']}' appeared in results"
        )

    # Soft check: at least 3 reasons mention spicy/warm DNA
    spicy_keywords = {"spic", "vanilla", "tobacco", "warm", "oriental", "oud", "smoky"}
    spicy_matches = sum(
        1 for r in results
        if any(kw in r["reason"].lower() for kw in spicy_keywords)
    )
    assert spicy_matches >= 3, (
        f"Only {spicy_matches}/5 results mention spicy/warm character — "
        "expected Spicebomb Extreme-adjacent DNA"
    )


# ── BB-09 ─────────────────────────────────────────────────────────────────────

@integration
async def test_bb09_dupe_only_ignores_luxury_liked_brands(client: AsyncClient):
    """
    BB-09 — Dupe-only with liked luxury brands (Creed, Tom Ford).
    P7 (liked brands) must be overridden by P2 (dupe-only category).
    PASS criteria:
      - All 5 have type='dupe'.
      - None from Creed or Tom Ford (luxury brands, non-allowed tier).
      - Results are from known dupe/budget brands.
    """
    resp = await client.post("/ai/recommend", json=_BB09)
    assert resp.status_code == 200
    results = resp.json()
    _print_results("BB-09: Dupe-only, liked luxury brands ignored", results)

    assert len(results) == 5

    for r in results:
        assert r["type"] == "dupe", (
            f"Non-dupe appeared in dupe-only results: '{r['name']}' by '{r['brand']}' type={r['type']}"
        )
        brand_lower = r["brand"].lower()
        assert "creed" not in brand_lower, (
            f"Creed (niche brand) appeared in dupe-only results: '{r['name']}'"
        )
        assert "tom ford" not in brand_lower, (
            f"Tom Ford (niche brand) appeared in dupe-only results: '{r['name']}'"
        )
        assert brand_lower not in _NICHE_BRANDS, (
            f"Niche brand '{r['brand']}' in dupe-only results"
        )
        assert brand_lower not in _DESIGNER_BRANDS, (
            f"Designer brand '{r['brand']}' in dupe-only results"
        )


# ── BB-10a ────────────────────────────────────────────────────────────────────

@integration
async def test_bb10a_niche_aventus_description_targets_aventus_dna(client: AsyncClient):
    """
    BB-10a — Niche only, description = 'similar to Creed Aventus'.
    PASS criteria:
      - All 5 type='niche'.
      - At least 3 reasons mention birch / pineapple / smoky / Aventus DNA.
      - None are Le Male-type (lavender/mint dominated).
    """
    resp = await client.post("/ai/recommend", json=_BB10A)
    assert resp.status_code == 200
    results = resp.json()
    _print_results("BB-10a: Niche Aventus-like", results)

    assert len(results) == 5

    for r in results:
        assert r["type"] == "niche", (
            f"Non-niche appeared: '{r['name']}' type={r['type']}"
        )

    aventus_keywords = {"birch", "pineapple", "smoky", "smoke", "ambergris", "aventus", "fruity"}
    aventus_matches = sum(
        1 for r in results
        if any(kw in r["reason"].lower() for kw in aventus_keywords)
    )
    assert aventus_matches >= 3, (
        f"Only {aventus_matches}/5 results reflect Aventus-adjacent DNA. "
        "Possible scent-target failure."
    )

    # Negative: must not be Le Male-dominated
    le_male_keywords = {"lavender", "mint", "sailor", "coumarin"}
    le_male_matches = sum(
        1 for r in results
        if sum(kw in r["reason"].lower() for kw in le_male_keywords) >= 2
    )
    assert le_male_matches == 0, (
        f"{le_male_matches} result(s) look like Le Male clones in an Aventus query"
    )


# ── BB-10b ────────────────────────────────────────────────────────────────────

@integration
async def test_bb10b_niche_le_male_description_targets_le_male_dna(client: AsyncClient):
    """
    BB-10b — Niche only, description = 'similar to Jean Paul Gaultier Le Male'.
    PASS criteria:
      - All 5 type='niche'.
      - At least 3 reasons mention lavender / vanilla / mint / coumarin / tonka.
      - None are Aventus-type (birch/pineapple dominated).
    """
    resp = await client.post("/ai/recommend", json=_BB10B)
    assert resp.status_code == 200
    results = resp.json()
    _print_results("BB-10b: Niche Le Male-like", results)

    assert len(results) == 5

    for r in results:
        assert r["type"] == "niche", (
            f"Non-niche appeared: '{r['name']}' type={r['type']}"
        )

    le_male_keywords = {"lavender", "vanilla", "mint", "coumarin", "tonka", "powdery", "fougère", "fougere"}
    le_male_matches = sum(
        1 for r in results
        if any(kw in r["reason"].lower() for kw in le_male_keywords)
    )
    assert le_male_matches >= 3, (
        f"Only {le_male_matches}/5 results reflect Le Male DNA. "
        "Possible description-override failure."
    )

    # Negative: must not be Aventus-dominated
    aventus_keywords = {"birch", "pineapple", "smoke"}
    aventus_matches = sum(
        1 for r in results
        if sum(kw in r["reason"].lower() for kw in aventus_keywords) >= 2
    )
    assert aventus_matches == 0, (
        f"{aventus_matches} result(s) look like Aventus clones in a Le Male query"
    )


# ── BB-10c: cache differentiation ─────────────────────────────────────────────

@integration
async def test_bb10c_aventus_description_no_le_male_overlap(client: AsyncClient):
    """
    BB-10c — Aventus-description query must NOT return Le Male-style fragrances.
    This is a single-call sanity check (avoids the two-call event-loop teardown
    issue that would occur when running BB-10a and BB-10b back-to-back in one test).

    PASS criteria:
      - All 5 type='niche'.
      - ≤ 1 result has Le Male DNA keywords (lavender + mint).
    """
    resp = await client.post("/ai/recommend", json=_BB10A)
    assert resp.status_code == 200
    results = resp.json()
    _print_results("BB-10c: Aventus query — checking no Le Male bleed", results)

    for r in results:
        assert r["type"] == "niche"

    le_male_kw = {"lavender", "mint", "coumarin", "sailor"}
    le_male_contamination = sum(
        1 for r in results
        if sum(kw in r["reason"].lower() for kw in le_male_kw) >= 2
    )
    assert le_male_contamination <= 1, (
        f"{le_male_contamination} result(s) look like Le Male clones in an Aventus query"
    )

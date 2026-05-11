"""
AI recommendation service.

Flow
----
1. Hash the preference inputs → check MongoDB recommendation_cache.
2. Cache hit  → return immediately (free, ~1 ms).
3. Cache miss → pick model based on request complexity.
4. Call Claude with a cached system prompt (prompt-caching saves ~30% input cost).
5. Parse the JSON response → 5 AIFragranceSuggestion objects.
6. Enrich each via fragrances.service (which has its own Fragella cache).
7. Persist the merged result in recommendation_cache (7-day TTL).
8. Return the list.
"""
from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone

import anthropic

from app.ai.models import AIFragranceSuggestion, AssessmentPreferences, RecommendationResult
from app.core.config import settings
from app.core.database import get_db
from app.fragrances import service as fragrance_service
from app.users import service as user_service

# ── Model selection ───────────────────────────────────────────────────────────
# claude-opus-4-7  → $5 / $25 per M tokens  — complex niche requests
# claude-haiku-4-5 → $1 / $5  per M tokens  — straightforward requests (~25× cheaper)

_MODEL_OPUS  = "claude-opus-4-7"
_MODEL_HAIKU = "claude-haiku-4-5"
MAX_TOKENS   = 2048


def _pick_model(prefs: AssessmentPreferences) -> str:
    """
    Use Opus only when the request is complex enough to justify the cost:
      - niche category selected, AND
      - 3 or more specific notes provided.
    Everything else → Haiku.
    """
    notes_count = len([n for n in prefs.notes_text.split(",") if n.strip()])
    if prefs.prefer_niche and notes_count >= 3:
        return _MODEL_OPUS
    return _MODEL_HAIKU


# ── System prompt (cached by Anthropic for 5 min per model) ──────────────────

SYSTEM_PROMPT = """\
You are an expert fragrance sommelier with comprehensive knowledge of perfumery — \
including niche houses, designer brands, and high-quality dupes.

Your task: given fragrance preferences, recommend exactly 5 fragrances \
that are the best possible match.

Respond with ONLY valid JSON — no prose, no markdown, no code fences. \
The JSON must have exactly this structure:

{
  "recommendations": [
    {
      "name": "Exact Fragrance Name",
      "brand": "Brand Name",
      "match_score": 95,
      "type": "niche",
      "price_range": "800–1 200 SEK",
      "reason": "1-2 sentences explaining why this matches the preferences."
    }
  ]
}

Rules:
- Exactly 5 recommendations, ordered highest to lowest match_score.
- match_score: integer 0–100.
- type: exactly one of "niche", "designer", or "dupe" — no other values.
- name: use the official name exactly as listed on Fragrantica / Basenotes.
- brand: the perfume house or parent company.
- price_range: the real-world retail price range in SEK, e.g. "800–1 200 SEK". Use current market prices.
- reason: reference the notes, season, budget, and style from the preferences.
- Only recommend fragrances that genuinely exist and are commercially available.
- Respect the budget, category whitelist, gender preference, and note preferences.

CATEGORY ENFORCEMENT (critical — never violate this):
- The user specifies which categories are allowed. Only recommend from those categories.
- If ONLY "dupe" is selected: every single one of the 5 recommendations MUST be a dupe
  (budget clone/inspired-by fragrance from brands like Afnan, Lattafa, Armaf, Al Haramain,
  Rasasi, Ard al Zaafaran, Fragrance World, Zara, etc.). Do NOT include any niche or
  designer fragrances. type must be "dupe" for all 5.
- If ONLY "niche" is selected: all 5 must be niche/artisan fragrances. No designers. No dupes.
- If ONLY "designer" is selected: all 5 must be mainstream designer fragrances. No niche. No dupes.
- If multiple categories are selected: distribute across the selected categories only.
- Violating the category restriction is the worst possible error — it directly contradicts
  the user's explicit preference.\
"""

# ── Season label ──────────────────────────────────────────────────────────────

_SEASON_LABEL = {
    "spring":   "spring",
    "summer":   "summer",
    "autumn":   "autumn / fall",
    "winter":   "winter",
    "all_year": "all seasons",
}


# ── Prompt builder ────────────────────────────────────────────────────────────

def _build_user_message(prefs: AssessmentPreferences) -> str:
    categories: list[str] = []
    if prefs.prefer_niche:
        categories.append("niche")
    if prefs.prefer_designer:
        categories.append("designer")
    if prefs.prefer_dupe:
        categories.append("dupe")

    notes = [n.strip() for n in prefs.notes_text.split(",") if n.strip()]
    notes_str = ", ".join(notes) if notes else "no specific preference"

    lines = [
        "Recommend fragrances based on these preferences:",
        "",
        f"  Budget: {prefs.budget_min}–{prefs.budget_max} SEK",
        f"  Preferred season: {_SEASON_LABEL.get(prefs.season, prefs.season)}",
        f"  Fragrance gender: {prefs.fragrance_gender}",
        f"  Preferred notes: {notes_str}",
        f"  Preferred categories: {', '.join(categories)}",
    ]

    # Optional fields — only included when the user actually filled them in
    if prefs.description_text.strip():
        lines.append(f"  What they're looking for: {prefs.description_text.strip()}")

    if prefs.liked_brands_text.strip():
        lines.append(f"  Fragrance brands they like: {prefs.liked_brands_text.strip()}")

    if prefs.liked_fragrances_text.strip():
        lines.append(f"  Specific fragrances they like: {prefs.liked_fragrances_text.strip()}")

    # Explicit category enforcement reminder in the user message
    if prefs.prefer_dupe and not prefs.prefer_niche and not prefs.prefer_designer:
        lines.append("  ⚠️  ONLY dupes allowed — all 5 must be budget/inspired-by fragrances (type=dupe). No niche, no designer.")
    elif prefs.prefer_niche and not prefs.prefer_designer and not prefs.prefer_dupe:
        lines.append("  ⚠️  ONLY niche allowed — all 5 must be niche/artisan fragrances (type=niche). No designer, no dupe.")
    elif prefs.prefer_designer and not prefs.prefer_niche and not prefs.prefer_dupe:
        lines.append("  ⚠️  ONLY designer allowed — all 5 must be mainstream designer fragrances (type=designer). No niche, no dupe.")

    lines += ["", "Recommend exactly 5 fragrances."]
    return "\n".join(lines)


# ── JSON extraction ───────────────────────────────────────────────────────────

def _extract_json(text: str) -> dict:
    """Parse JSON from Claude's response, tolerating markdown code fences."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", text)
    if match:
        return json.loads(match.group(1))
    raise ValueError(f"Could not parse JSON from Claude response:\n{text[:500]}")


# ── Recommendation cache ──────────────────────────────────────────────────────

def _preference_hash(prefs: AssessmentPreferences) -> str:
    """Stable SHA-256 fingerprint of the fragrance preferences (not personal data)."""
    key = {
        "budget_min":            prefs.budget_min,
        "budget_max":            prefs.budget_max,
        "season":                prefs.season,
        "fragrance_gender":      prefs.fragrance_gender,
        "notes_text":            prefs.notes_text.strip().lower(),
        "prefer_niche":          prefs.prefer_niche,
        "prefer_designer":       prefs.prefer_designer,
        "prefer_dupe":           prefs.prefer_dupe,
        "liked_brands_text":     prefs.liked_brands_text.strip().lower(),
        "liked_fragrances_text": prefs.liked_fragrances_text.strip().lower(),
    }
    return hashlib.sha256(json.dumps(key, sort_keys=True).encode()).hexdigest()


async def _cache_get(key: str) -> list[RecommendationResult] | None:
    try:
        doc = await get_db()["recommendation_cache"].find_one({"_id": key})
        if doc:
            print(f"[ai.service] Recommendation cache hit ({key[:8]}…)")
            return [RecommendationResult(**r) for r in doc["results"]]
    except Exception as exc:
        print(f"[ai.service] Cache read error: {exc}")
    return None


async def _cache_set(key: str, results: list[RecommendationResult]) -> None:
    try:
        await get_db()["recommendation_cache"].replace_one(
            {"_id": key},
            {
                "_id":        key,
                "results":    [r.model_dump() for r in results],
                "created_at": datetime.now(timezone.utc),   # TTL index key
            },
            upsert=True,
        )
        print(f"[ai.service] Recommendation cached ({key[:8]}…)")
    except Exception as exc:
        print(f"[ai.service] Cache write error: {exc}")


# ── Claude + Fragella call ────────────────────────────────────────────────────

async def _call_claude_and_enrich(prefs: AssessmentPreferences) -> list[RecommendationResult]:
    model = _pick_model(prefs)
    print(f"[ai.service] Using model: {model}")

    client = anthropic.AsyncAnthropic(api_key=settings.ai_api_key)

    # Adaptive thinking is Opus-only — Haiku doesn't support it
    extra = {"thinking": {"type": "adaptive"}} if model == _MODEL_OPUS else {}

    async with client.messages.stream(
        model=model,
        max_tokens=MAX_TOKENS,
        **extra,
        system=[
            {
                "type": "text",
                "text": SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},  # cache for 5 min per model
            }
        ],
        messages=[{"role": "user", "content": _build_user_message(prefs)}],
    ) as stream:
        message = await stream.get_final_message()

    text_block = next(
        (block.text for block in message.content if block.type == "text"),
        None,
    )
    if not text_block:
        raise RuntimeError("Claude returned no text content.")

    raw = _extract_json(text_block)
    suggestions = [
        AIFragranceSuggestion(**item)
        for item in raw.get("recommendations", [])
    ]
    print(f"[ai.service] Claude suggested {len(suggestions)} fragrances via {model}.")

    # Enrich with Fragella (fragrance_service has its own cache)
    results: list[RecommendationResult] = []
    for i, suggestion in enumerate(suggestions):
        fragella = await fragrance_service.lookup_fragrance(suggestion.name)

        if fragella:
            name        = fragella["fragella_name"] or suggestion.name
            brand       = fragella["fragella_brand"] or suggestion.brand
            image_url   = fragella["image_url"]
            notes       = fragella["notes"]
            description = fragella["description"]
            # Always use Claude's SEK estimate — Fragella returns raw USD values
            # without currency label, making them misleading when displayed as kr.
            price_range = suggestion.price_range
        else:
            print(f"[ai.service] Fragella miss for '{suggestion.name}' — using AI data.")
            name        = suggestion.name
            brand       = suggestion.brand
            image_url   = None
            notes       = []
            description = "No additional details available."
            price_range = suggestion.price_range

        results.append(
            RecommendationResult(
                id          = f"{i}-{name}",
                name        = name,
                brand       = brand,
                description = description,
                notes       = notes,
                image_url   = image_url,
                match_score = suggestion.match_score,
                type        = suggestion.type,
                price_range = price_range,
                reason      = suggestion.reason,
            )
        )

    return results


# ── Assessment permanent store ────────────────────────────────────────────────

async def _store_assessment(
    prefs: AssessmentPreferences,
    results: list[RecommendationResult],
    cache_key: str,
    session_verified: bool,
) -> None:
    """
    Permanently record every assessment in the `assessments` collection.
    Stores the full preference set, user profile, session verification status,
    and the 5 recommendations — no TTL, never auto-deleted.
    """
    try:
        doc = {
            "created_at":       datetime.now(timezone.utc),
            "preference_hash":  cache_key,
            "preferences": {
                "budget_min":            prefs.budget_min,
                "budget_max":            prefs.budget_max,
                "season":                prefs.season,
                "fragrance_gender":      prefs.fragrance_gender,
                "notes_text":            prefs.notes_text,
                "prefer_niche":          prefs.prefer_niche,
                "prefer_designer":       prefs.prefer_designer,
                "prefer_dupe":           prefs.prefer_dupe,
                "description_text":      prefs.description_text,
                "liked_brands_text":     prefs.liked_brands_text,
                "liked_fragrances_text": prefs.liked_fragrances_text,
            },
            "profile": {
                "name":            prefs.name,
                "age":             prefs.age,
                "gender":          prefs.gender,
                "country":         prefs.country,
                "collection_size": prefs.collection_size,
            },
            "session_verified": session_verified,
            "results": [r.model_dump() for r in results],
        }
        await get_db()["assessments"].insert_one(doc)
        print(f"[ai.service] Assessment stored for '{prefs.name}' (verified={session_verified}).")
    except Exception as exc:
        print(f"[ai.service] Assessment store error: {exc}")


# ── Public entry point ────────────────────────────────────────────────────────

async def get_recommendations(prefs: AssessmentPreferences) -> list[RecommendationResult]:
    """
    Return 5 enriched fragrance recommendations for the given preferences.
    Checks the MongoDB recommendation cache before calling Claude.
    Always records the assessment permanently (cache hit or miss).
    """
    # Verify session token if provided — used only for the assessments record
    session_verified = False
    if prefs.session_token:
        profile = await user_service.get_profile_from_token(prefs.session_token)
        session_verified = profile is not None

    cache_key = _preference_hash(prefs)

    # 1. Try cache
    cached = await _cache_get(cache_key)
    if cached is not None:
        await _store_assessment(prefs, cached, cache_key, session_verified)
        return cached

    # 2. Cache miss — call Claude + Fragella
    results = await _call_claude_and_enrich(prefs)

    # 3. Persist recommendation for next time
    await _cache_set(cache_key, results)

    # 4. Permanently record this assessment
    await _store_assessment(prefs, results, cache_key, session_verified)

    return results

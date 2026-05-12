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
# claude-opus-4-7  → $5 / $25 per M tokens  — strict category enforcement
# claude-haiku-4-5 → $1 / $5  per M tokens  — multi-category, relaxed requests

_MODEL_OPUS  = "claude-opus-4-7"
_MODEL_HAIKU = "claude-haiku-4-5"
MAX_TOKENS   = 2048


def _pick_model(prefs: AssessmentPreferences) -> str:
    """
    Use Opus whenever strict category enforcement or a description is present:
      - Exactly ONE category selected → Opus (zero tolerance for mistakes).
      - Description text present → Opus (nuanced scent-direction matching).
      - Multiple categories with niche + 3 or more notes → Opus.
    Everything else (multiple categories, no description) → Haiku.
    """
    categories_selected = sum([prefs.prefer_niche, prefs.prefer_designer, prefs.prefer_dupe])
    if categories_selected == 1:
        return _MODEL_OPUS
    if prefs.description_text.strip():
        return _MODEL_OPUS
    notes_count = len([n for n in prefs.notes_text.split(",") if n.strip()])
    if prefs.prefer_niche and notes_count >= 3:
        return _MODEL_OPUS
    return _MODEL_HAIKU


# ── System prompt (cached by Anthropic for 5 min per model) ──────────────────

SYSTEM_PROMPT = """\
You are an expert fragrance sommelier with comprehensive knowledge of perfumery — \
including niche houses, designer brands, and high-quality dupes.

Your task: recommend exactly 5 fragrances that best match the user's preferences.
Apply the constraints below IN STRICT PRIORITY ORDER — higher priorities can never \
be sacrificed to satisfy a lower one.

══════════════════════════════════════════════════════════════════
PRIORITY 1 — BUDGET  ⚠ HARD CONSTRAINT — never violate
══════════════════════════════════════════════════════════════════
Every recommendation MUST have a real-world retail price within the user's SEK
budget range. A fragrance that retails outside the range is EXCLUDED regardless
of how well it matches everything else. Use current Swedish market prices.

══════════════════════════════════════════════════════════════════
PRIORITY 2 — CATEGORY (dupe / designer / niche)  ⚠ HARD CONSTRAINT
══════════════════════════════════════════════════════════════════
The user selects which categories are allowed. Only recommend from those.

DUPE ONLY → All 5 must be budget clone/inspired-by fragrances.
  Brands: Afnan, Lattafa, Armaf, Al Haramain, Rasasi, Ard al Zaafaran,
  Fragrance World, Pendora, Zara, etc.
  type = "dupe" for every recommendation. No niche. No designer. Ever.

DESIGNER ONLY → All 5 must be mainstream designer fragrances.
  Brands: Dior, Chanel, YSL, Paco Rabanne, Versace, Gucci, Hugo Boss, etc.
  type = "designer" for every recommendation. No niche. No dupe. Ever.

NICHE ONLY → All 5 must be niche/artisan fragrances.
  Brands: Creed, Maison Margiela, Byredo, Nishane, Xerjoff, Amouage, etc.
  type = "niche" for every recommendation. No designer. No dupe. Ever.

MULTIPLE CATEGORIES → distribute only across the selected categories.

This rule is absolute. Liked brands or liked fragrances from a non-allowed
category are IGNORED — they can never override the category constraint.
Before finalising, check every recommendation against the allowed categories.

══════════════════════════════════════════════════════════════════
PRIORITY 3 — SEASON  ⚠ HARD CONSTRAINT
══════════════════════════════════════════════════════════════════
Match the stated season strictly. Never recommend a fragrance whose primary
use season differs from the selected one:
- Winter → heavy, warm, spicy, oriental, oud, incense, leather. No aquatics.
- Summer → fresh, citrus, aquatic, light floral. No heavy orientals or ouds.
- Spring → fresh floral, green, light. No heavy winter scents.
- Autumn → woody, spicy, warm but not oppressive. No pure summer aquatics.
- All seasons → versatile fragrances only.

══════════════════════════════════════════════════════════════════
PRIORITY 4 — DESCRIPTION (user's stated intent)
══════════════════════════════════════════════════════════════════
If the user describes a specific scent direction, clone, or reference fragrance,
this is the PRIMARY scent brief and outweighs generic note/brand preferences.
Examples:
- "I want a clone of Jean Paul Gaultier Le Male" → target JPG Le Male's DNA
  (lavender, vanilla, tonka, coumarin) — NOT Creed Aventus clones.
- "Something similar to Sauvage but cheaper" → Sauvage-adjacent profile.
Do not substitute a popular generic match if the user named something specific.

══════════════════════════════════════════════════════════════════
PRIORITY 5 — GENDER
══════════════════════════════════════════════════════════════════
Match the stated gender. Unisex fragrances are acceptable when they lean
noticeably toward the stated gender direction (e.g. a masculine unisex for "men").

══════════════════════════════════════════════════════════════════
PRIORITY 6 — LIKED FRAGRANCES (optional field)
══════════════════════════════════════════════════════════════════
Use these as scent reference points — recommend fragrances with a similar DNA.
BUT: the category constraint (P2) is absolute. If only "dupe" is selected and
the liked fragrance is a designer or niche, still recommend only dupes that share
its scent profile — never cross into a non-allowed category.

══════════════════════════════════════════════════════════════════
PRIORITY 7 — LIKED BRANDS (optional field, lowest priority)
══════════════════════════════════════════════════════════════════
Prefer fragrances from these brands when possible, but only within allowed
categories (P2). A liked designer brand cannot produce recommendations when
only "dupe" is selected. Category always wins over brand loyalty.

══════════════════════════════════════════════════════════════════

Respond with ONLY valid JSON — no prose, no markdown, no code fences.
Exact structure required:

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

Output rules:
- Exactly 5 recommendations, ordered highest to lowest match_score.
- match_score: integer 0–100.
- type: exactly one of "niche", "designer", or "dupe".
- name: official name as listed on Fragrantica / Basenotes.
- brand: the perfume house or parent company.
- price_range: real-world Swedish retail price range in SEK.
- reason: 1-2 sentences of natural prose explaining why this fragrance matches. Write for an end user — never mention P1/P2/P3 or any internal priority labels. Reference the scent profile, season, style, and budget naturally.
- Only recommend fragrances that genuinely exist and are verifiable on Fragrantica or Basenotes.
- CRITICAL — do NOT hallucinate: if you are not certain a fragrance exists under that exact name and brand, do not include it. It is better to repeat a well-known fragrance than to invent one.
- PERFUME BRANDS ONLY: every brand must be a perfume/fragrance house. Never recommend products from cosmetics brands, skincare brands, makeup brands, or any company not primarily known for fragrances. If a brand name could belong to a non-fragrance company, skip it.\
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
    """
    Build the user message following the exact priority hierarchy defined in the
    system prompt: Budget → Category → Season → Description → Gender →
    Liked Fragrances → Liked Brands.
    Presenting data in priority order helps Claude weight them correctly.
    """
    categories: list[str] = []
    if prefs.prefer_niche:
        categories.append("niche")
    if prefs.prefer_designer:
        categories.append("designer")
    if prefs.prefer_dupe:
        categories.append("dupe")

    notes = [n.strip() for n in prefs.notes_text.split(",") if n.strip()]
    notes_str = ", ".join(notes) if notes else "no specific preference"

    lines: list[str] = ["User preferences (apply in the priority order from your instructions):"]

    # ── P1: BUDGET ────────────────────────────────────────────────────────────
    lines += [
        "",
        f"[P1 BUDGET — hard constraint] {prefs.budget_min}–{prefs.budget_max} SEK",
        "  All 5 recommendations must retail within this range. Exclude anything outside it.",
    ]

    # ── P2: CATEGORY ─────────────────────────────────────────────────────────
    cat_str = ", ".join(categories) if categories else "none selected"
    lines += [
        "",
        f"[P2 CATEGORY — hard constraint] Allowed: {cat_str}",
    ]
    if prefs.prefer_dupe and not prefs.prefer_niche and not prefs.prefer_designer:
        lines.append("  ONLY dupes — all 5 must be type=dupe. Zero niche or designer.")
    elif prefs.prefer_niche and not prefs.prefer_designer and not prefs.prefer_dupe:
        lines.append("  ONLY niche — all 5 must be type=niche. Zero designer or dupe.")
    elif prefs.prefer_designer and not prefs.prefer_niche and not prefs.prefer_dupe:
        lines.append("  ONLY designer — all 5 must be type=designer. Zero niche or dupe.")
    else:
        lines.append(f"  Mix across allowed categories only: {cat_str}.")

    # ── P3: SEASON ────────────────────────────────────────────────────────────
    lines += [
        "",
        f"[P3 SEASON — hard constraint] {_SEASON_LABEL.get(prefs.season, prefs.season)}",
        "  Only recommend fragrances whose primary use season matches this.",
    ]

    # ── P4: DESCRIPTION / IMPLICIT CLONE BRIEF ───────────────────────────────
    # When dupe-only is selected AND liked fragrances are listed, the intent is
    # unambiguous: find budget clones of those exact fragrances. Promote to P4
    # so it overrides generic note matching.
    dupe_only = prefs.prefer_dupe and not prefs.prefer_niche and not prefs.prefer_designer
    liked_frags = prefs.liked_fragrances_text.strip()

    if dupe_only and liked_frags:
        lines += [
            "",
            "[P4 CLONE BRIEF — primary scent directive]",
            f"  The user wants budget dupes/clones of these specific fragrances: {liked_frags}",
            "  Every recommendation must be an inspired-by or clone of one of these — not",
            "  a generic popular dupe. Target the exact scent DNA of each named fragrance.",
            "  (This already covers P6 — do not add P6 separately below.)",
        ]
    elif prefs.description_text.strip():
        lines += [
            "",
            f"[P4 DESCRIPTION — primary scent brief] {prefs.description_text.strip()}",
            "  This overrides generic note matching. If a specific fragrance or brand is",
            "  named, target that exact scent DNA. Do not substitute a generic popular match.",
        ]

    # ── P5: GENDER ────────────────────────────────────────────────────────────
    lines += [
        "",
        f"[P5 GENDER] {prefs.fragrance_gender}",
        "  Unisex fragrances are acceptable if they lean toward this direction.",
    ]

    # ── Notes (supporting detail, not a ranked priority) ──────────────────────
    if notes:
        lines += [
            "",
            f"[NOTES — supporting detail] {notes_str}",
            "  Use these to fine-tune within the constraints above.",
        ]

    # ── P6: LIKED FRAGRANCES ──────────────────────────────────────────────────
    # Skip if already promoted to P4 clone brief above (dupe-only + liked frags).
    if liked_frags and not (dupe_only and liked_frags):
        lines += [
            "",
            f"[P6 LIKED FRAGRANCES] {liked_frags}",
            "  Use as scent reference — recommend similar DNA/profile.",
            "  Category (P2) is absolute: never cross into a non-allowed category",
            "  even if the liked fragrance belongs there.",
        ]

    # ── P7: LIKED BRANDS ──────────────────────────────────────────────────────
    if prefs.liked_brands_text.strip():
        lines += [
            "",
            f"[P7 LIKED BRANDS — lowest priority] {prefs.liked_brands_text.strip()}",
            "  Prefer fragrances from these brands, but only within allowed categories (P2).",
            "  A liked designer brand cannot appear when only dupe is selected, etc.",
            "  Aim for at least 2–3 recommendations from these brands when possible.",
        ]

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

# Increment this to invalidate ALL previously cached recommendations.
# History:
#   v1 — initial
#   v2 — stronger category enforcement prompt + Opus for single-category requests
#   v3 — description_text added to hash; liked_brands/fragrances as primary directives
#   v4 — full 7-level priority hierarchy in system prompt + user message;
#         Opus also triggered when description_text is present
#   v5 — fix reason field leaking P1/P2/P3 labels to end users
#   v6 — anti-hallucination: perfume brands only, Fragrantica-verifiable names
#   v7 — dupe-only + liked fragrances promoted to P4 clone brief
_CACHE_VERSION = 7


def _preference_hash(prefs: AssessmentPreferences) -> str:
    """Stable SHA-256 fingerprint of the fragrance preferences (not personal data)."""
    key = {
        "_v":                    _CACHE_VERSION,
        "budget_min":            prefs.budget_min,
        "budget_max":            prefs.budget_max,
        "season":                prefs.season,
        "fragrance_gender":      prefs.fragrance_gender,
        "notes_text":            prefs.notes_text.strip().lower(),
        "description_text":      prefs.description_text.strip().lower(),  # was missing — caused cached results to ignore description changes
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

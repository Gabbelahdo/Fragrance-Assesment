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
from app.parfumo import service as parfumo_service
from app.users import service as user_service

# ── Model selection ───────────────────────────────────────────────────────────
# claude-opus-4-7  → $5 / $25 per M tokens  — strict category enforcement
# claude-haiku-4-5 → $1 / $5  per M tokens  — multi-category, relaxed requests

_MODEL_OPUS  = "claude-opus-4-7"
_MODEL_HAIKU = "claude-haiku-4-5"
# Opus 4.7 with adaptive thinking uses tokens for reasoning before the JSON output.
# 4096 gives ample room for both internal reasoning and the ~600-token JSON response.
MAX_TOKENS   = 4096


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

BRAND TIER REFERENCE — memorise this before outputting anything:
  DUPE brands (budget/inspired-by only):
    Afnan, Lattafa, Armaf, Al Haramain, Rasasi, Ard al Zaafaran,
    Fragrance World, Pendora, Zara, Lidl, Kemi Oud, Paris Corner,
    Riiffs, Maison Alhambra, Fragrance Du Bois (budget line), etc.
    These retail under ~500 SEK for 100 ml.

  DESIGNER brands (mainstream/luxury fashion houses):
    Dior, Chanel, YSL, Paco Rabanne, Versace, Gucci, Hugo Boss,
    Calvin Klein, Dolce & Gabbana, Givenchy, Burberry, Valentino,
    Giorgio Armani, Hermès, Lacoste, Ralph Lauren, etc.

  NICHE brands (artisan/independent perfume houses):
    Creed, Tom Ford, Maison Margiela, Byredo, Nishane, Xerjoff,
    Amouage, Initio, Mancera, Montale, Kilian, Orto Parisi,
    Tauer, Zoologist, Serge Lutens, Diptyque, L'Artisan, etc.

  ⚠ NEVER label a niche or designer brand as type="dupe".
    Tom Ford, Mancera, Creed, Dior, Chanel etc. are NEVER dupes.
    A dupe must come from a budget brand. No exceptions.

DUPE ONLY → All 5 from the DUPE brand list above. type="dupe" for all.
DESIGNER ONLY → All 5 from the DESIGNER brand list above. type="designer" for all.
NICHE ONLY → All 5 from the NICHE brand list above. type="niche" for all.
MULTIPLE CATEGORIES → distribute only across the selected categories.

This rule is absolute. Liked brands or liked fragrances from a non-allowed
category are IGNORED — they can never override the category constraint.
Before finalising, check EVERY recommendation: does the brand belong to
an allowed tier? If not, replace it.

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

⚠ POPULARITY BIAS WARNING: Do NOT default to a brand's most popular or
best-selling fragrance if it does not fit the season. A fragrance being
"famous" or "highly rated" never overrides the season constraint.
Example: if summer is selected and the user mentions Afnan, do NOT recommend
Afnan 9PM (a heavy oriental) — recommend Afnan 9AM Dive or similar fresh
options instead. Always ask: "Does this fragrance actually smell like this
season?" If not, pick a lesser-known but seasonally correct alternative.

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
- Only recommend fragrances verifiable on Fragrantica or Basenotes with that exact name and brand.
- ANTI-HALLUCINATION: if you are not 100% certain a fragrance exists under that exact name and brand, do not include it. Use a well-known safe alternative instead.
- PERFUME BRANDS ONLY: every brand must be a dedicated perfume/fragrance house. Never include cosmetics brands (e.g. Pure Cosmetics, MAC, NYX), skincare brands, makeup brands, or any company whose primary business is not fragrance. If in doubt, skip it.
- SELF-CHECK before outputting: read back each of the 5 brands — is it a real fragrance house? Is the fragrance name real? Is the type correct for its tier? Fix any that fail.\
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

def _build_user_message(
    prefs: AssessmentPreferences,
    ref_dna: dict[str, list[str]] | None = None,
) -> str:
    """
    Build the user message following the exact priority hierarchy defined in the
    system prompt: Budget → Category → Season → Description → Gender →
    Liked Fragrances → Liked Brands.
    Presenting data in priority order helps Claude weight them correctly.

    ref_dna: optional dict {fragrance_name: [notes]} pre-fetched from Fragella.
    When provided, it is injected right after the description/scent-target block
    as a factual note-DNA anchor so Claude targets the correct scent profile.
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

    # ── P4: DESCRIPTION / SCENT-TARGET BRIEF ─────────────────────────────────
    # When exactly ONE category is selected AND liked fragrances are listed,
    # the intent is always: "find [category] fragrances that smell like these."
    # The liked fragrances define the scent target; the category defines the tier.
    # Examples:
    #   dupe + Dylan Blue, Bleu de Chanel  → budget clones of those two
    #   niche + Sauvage, Dylan Blue        → niche fragrances with that DNA
    #   designer + Creed Aventus           → designer fragrances with that profile
    # Promote to P4 so it overrides generic note matching.
    categories_selected = sum([prefs.prefer_niche, prefs.prefer_designer, prefs.prefer_dupe])
    single_category = categories_selected == 1
    dupe_only  = prefs.prefer_dupe     and not prefs.prefer_niche and not prefs.prefer_designer
    niche_only = prefs.prefer_niche    and not prefs.prefer_designer and not prefs.prefer_dupe
    liked_frags = prefs.liked_fragrances_text.strip()

    if single_category and liked_frags:
        if dupe_only:
            target_desc = "budget-friendly dupes/clones/inspired-by versions"
            category_label = "dupe"
        elif niche_only:
            target_desc = "niche/artisan fragrances"
            category_label = "niche"
        else:  # designer_only
            target_desc = "mainstream designer fragrances"
            category_label = "designer"

        lines += [
            "",
            "[P4 SCENT-TARGET BRIEF — primary directive]",
            f"  The user likes the scent profile of: {liked_frags}",
            f"  Find {target_desc} (type={category_label}) that share the same scent DNA.",
            f"  The liked fragrances are the SCENT REFERENCE — the category ({category_label}) is",
            "  the TIER to search in. Do not recommend the liked fragrances themselves.",
            f"  Do not pick generic popular {category_label} fragrances — match the specific",
            f"  scent character of {liked_frags}.",
            "  (This already covers P6 — do not repeat liked fragrances below.)",
        ]
    elif prefs.description_text.strip():
        lines += [
            "",
            f"[P4 DESCRIPTION — primary scent brief] {prefs.description_text.strip()}",
            "  This overrides generic note matching. If a specific fragrance or brand is",
            "  named, target that exact scent DNA. Do not substitute a generic popular match.",
        ]

    # ── DNA fingerprint block (injected when Fragella note data is available) ──
    # Provides factual note anchors for any reference fragrances so Claude
    # targets the correct scent profile rather than relying on memory alone.
    if ref_dna:
        lines += ["", "[SCENT-DNA REFERENCE — verified note data from Fragella]"]
        for frag_name, notes_list in ref_dna.items():
            notes_str_dna = ", ".join(notes_list)
            lines += [
                f"  {frag_name}: {notes_str_dna}",
            ]
        lines += [
            "  → Your recommendations MUST match this note profile.",
            "  → Do NOT substitute a different popular fragrance that lacks these notes.",
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
    # Skip when already promoted to P4 scent-target brief above
    # (any single category + liked fragrances — handled there).
    if liked_frags and not (single_category and liked_frags):
        lines += [
            "",
            f"[P6 LIKED FRAGRANCES] {liked_frags}",
            "  Use as scent reference — recommend similar DNA/profile.",
            "  Category (P2) is absolute: never cross into a non-allowed category",
            "  even if the liked fragrance belongs there.",
        ]

    # ── P7: LIKED BRANDS ──────────────────────────────────────────────────────
    # Detect "brand-exclusive" intent: if ANY liked brand is mentioned in the
    # description, the user clearly wants ALL results from that brand.
    # Promote to a hard constraint so Claude doesn't dilute with other brands.
    if prefs.liked_brands_text.strip():
        liked_brands_list = [b.strip() for b in prefs.liked_brands_text.split(",") if b.strip()]
        desc_lower = prefs.description_text.lower()
        exclusive_brands = [b for b in liked_brands_list if b.lower() in desc_lower]

        if exclusive_brands:
            exclusive_str = ", ".join(exclusive_brands)
            lines += [
                "",
                f"[P2b BRAND — hard constraint] The user explicitly asked for fragrances from: {exclusive_str}",
                f"  ALL 5 recommendations MUST come from {exclusive_str}.",
                "  Do not include any other brand, even if it is a better seasonal or scent match.",
                f"  Browse {exclusive_str}'s full catalogue and find the 5 best fits within the",
                "  other constraints (budget, season, category, gender).",
            ]
        else:
            lines += [
                "",
                f"[P7 LIKED BRANDS — lowest priority] {prefs.liked_brands_text.strip()}",
                "  Prefer fragrances from these brands, but only within allowed categories (P2).",
                "  A liked designer brand cannot appear when only dupe is selected, etc.",
                "  Aim for at least 2–3 recommendations from these brands when possible.",
            ]

    # ── Implicit notes from description keywords ──────────────────────────────
    # When the description contains freshness/scent-cluster keywords, inject
    # concrete notes so Claude has a precise brief even for vague descriptions.
    desc_notes = _extract_description_notes(prefs.description_text)
    if desc_notes and not notes:  # don't override if user already gave notes
        implicit_str = ", ".join(desc_notes)
        lines += [
            "",
            f"[IMPLICIT NOTES from description] {implicit_str}",
            "  These notes were inferred from the description. Use them to guide scent selection.",
        ]
    elif desc_notes:
        # Merge with user notes — description inference adds extra signal
        all_notes = list(dict.fromkeys(notes + desc_notes))  # dedupe, preserve order
        lines_idx = next(
            (i for i, line in enumerate(lines) if line.startswith("[NOTES")), None
        )
        if lines_idx is not None:
            lines[lines_idx] = f"[NOTES — supporting detail] {', '.join(all_notes)}"

    lines += ["", "Recommend exactly 5 fragrances."]
    return "\n".join(lines)


# ── Non-fragrance brand blocklist ────────────────────────────────────────────
# Claude occasionally hallucinates cosmetics/makeup/skincare companies as
# fragrance brands despite explicit prompt rules.  This list is a last-resort
# post-processing guard: any suggestion whose brand matches here is dropped.
# Add new offenders discovered in testing.
_NON_FRAGRANCE_BRANDS: frozenset[str] = frozenset({
    "pure cosmetics",
    "mac",
    "mac cosmetics",
    "nyx",
    "nyx professional makeup",
    "maybelline",
    "l'oreal",
    "loreal",
    "revlon",
    "e.l.f.",
    "elf cosmetics",
    "urban decay",
    "too faced",
    "benefit cosmetics",
    "clinique",   # primarily skincare/cosmetics, rarely fragrance
    "cetaphil",
    "nivea",
    "dove",
    "neutrogena",
})


def _is_blocked_brand(brand: str) -> bool:
    """Return True if brand is in the non-fragrance blocklist."""
    return brand.strip().lower() in _NON_FRAGRANCE_BRANDS


# ── Note → Season compatibility weights ──────────────────────────────────────
# Maps individual note names (lower-case) to per-season scores.
# Positive = note fits the season; negative = note conflicts.
# Missing entry → 0 (neutral).  "all_year" is never scored.
_NOTE_SEASON: dict[str, dict[str, float]] = {
    # ── Fresh / citrus ────────────────────────────────────────────────────────
    "bergamot":        {},  # top note — appears in all seasons, no seasonal opinion
    "lemon":           {},  # top note — appears across all seasons
    "lime":            {},  # top note — appears across all seasons
    "grapefruit":      {"summer": 1.2, "spring": 0.7, "winter": -0.4},
    "orange":          {"summer": 0.8, "spring": 0.6},
    "mandarin":        {"summer": 0.7, "spring": 0.5},
    "tangerine":       {"summer": 0.7, "spring": 0.5},
    "yuzu":            {"summer": 1.0, "spring": 0.6},
    "citrus":          {"summer": 1.2, "spring": 0.8, "winter": -0.4},
    # ── Aquatic / marine ──────────────────────────────────────────────────────
    "marine":          {"summer": 1.8, "spring": 0.4, "autumn": -0.6, "winter": -1.8},
    "aquatic":         {"summer": 1.8, "spring": 0.4, "autumn": -0.6, "winter": -1.8},
    "sea salt":        {"summer": 1.5, "spring": 0.2, "winter": -1.2},
    "ozonic":          {"summer": 1.5, "spring": 0.3, "winter": -1.2},
    "water":           {"summer": 1.0, "spring": 0.4, "winter": -0.5},
    "cucumber":        {"summer": 1.2, "spring": 0.5, "winter": -0.5},
    "watermelon":      {"summer": 1.3, "spring": 0.3, "winter": -0.5},
    "melon":           {"summer": 1.0, "spring": 0.4},
    # ── Light spring florals ──────────────────────────────────────────────────
    "peony":           {"spring": 1.5, "summer": 0.7, "autumn": -0.3, "winter": -0.5},
    "cherry blossom":  {"spring": 1.5, "summer": 0.4, "autumn": -0.5, "winter": -0.8},
    "magnolia":        {"spring": 1.3, "summer": 0.5, "winter": -0.3},
    "lily of the valley": {"spring": 1.5, "summer": 0.5, "autumn": -0.3, "winter": -0.5},
    "freesia":         {"spring": 1.2, "summer": 0.6, "winter": -0.3},
    "lilac":           {"spring": 1.3, "summer": 0.4, "winter": -0.3},
    "hyacinth":        {"spring": 1.2, "summer": 0.3, "winter": -0.3},
    "iris":            {"spring": 0.8, "autumn": 0.4},
    # ── Green / fresh ─────────────────────────────────────────────────────────
    "green":           {"spring": 1.0, "summer": 0.5},
    "grass":           {"spring": 1.0, "summer": 0.5},
    "green tea":       {"summer": 0.8, "spring": 0.7},
    "mint":            {"summer": 0.8, "spring": 0.6, "winter": -0.2},
    # ── Heavy warm / winter ───────────────────────────────────────────────────
    "oud":             {"winter": 1.8, "autumn": 0.9, "spring": -0.9, "summer": -2.0},
    "incense":         {"winter": 1.4, "autumn": 0.8, "summer": -1.2},
    "frankincense":    {"winter": 1.4, "autumn": 0.8, "summer": -1.0},
    "myrrh":           {"winter": 1.2, "autumn": 0.6, "summer": -0.9},
    "benzoin":         {"winter": 1.0, "autumn": 0.5, "summer": -0.8},
    "labdanum":        {"winter": 0.9, "autumn": 0.6, "summer": -0.7},
    "tobacco":         {"winter": 1.4, "autumn": 1.0, "spring": -0.5, "summer": -1.5},
    "leather":         {"winter": 0.9, "autumn": 0.8, "spring": -0.3, "summer": -1.0},
    "smoke":           {"winter": 1.1, "autumn": 0.7, "summer": -1.1},
    "birch":           {"autumn": 0.9, "winter": 0.7, "summer": -0.8},
    "rum":             {"winter": 1.0, "autumn": 0.7, "summer": -0.8},
    "whisky":          {"winter": 1.0, "autumn": 0.8, "summer": -0.9},
    # ── Gourmand / sweet ──────────────────────────────────────────────────────
    "vanilla":         {"winter": 0.8, "autumn": 0.6, "summer": -0.5},
    "tonka":           {"winter": 0.8, "autumn": 0.6, "summer": -0.5},
    "tonka bean":      {"winter": 0.8, "autumn": 0.6, "summer": -0.5},
    "coumarin":        {"autumn": 0.7, "winter": 0.7, "summer": -0.3},
    "caramel":         {"winter": 0.8, "autumn": 0.7, "summer": -0.5},
    "chocolate":       {"winter": 0.8, "autumn": 0.6, "summer": -0.5},
    # ── Spices ────────────────────────────────────────────────────────────────
    "cinnamon":        {"winter": 0.9, "autumn": 1.0, "summer": -0.8},
    "cardamom":        {"winter": 0.8, "autumn": 0.8, "summer": -0.5},
    "clove":           {"winter": 0.9, "autumn": 1.0, "summer": -0.8},
    "nutmeg":          {"autumn": 0.9, "winter": 0.7, "summer": -0.5},
    "saffron":         {"winter": 0.8, "autumn": 0.7, "summer": -0.5},
    "black pepper":    {"autumn": 0.6, "winter": 0.5, "summer": -0.2},
    "pink pepper":     {"autumn": 0.5, "winter": 0.3, "summer": -0.1},
    "white pepper":    {"autumn": 0.5, "winter": 0.3, "summer": -0.1},
    "pepper":          {"autumn": 0.4, "winter": 0.3, "summer": -0.1},
    # ── Versatile (low weights, no strong conflict) ───────────────────────────
    "rose":            {"spring": 0.6, "summer": 0.3, "autumn": 0.2},
    "jasmine":         {"spring": 0.5, "summer": 0.5, "autumn": 0.2},
    "lavender":        {"spring": 0.5, "summer": 0.4, "autumn": 0.3, "winter": 0.2},
    "neroli":          {"spring": 0.6, "summer": 0.8},
    "geranium":        {"spring": 0.5, "summer": 0.4},
    "ylang-ylang":     {"summer": 0.4, "spring": 0.4},
    "sandalwood":      {"autumn": 0.5, "winter": 0.5},
    "vetiver":         {"summer": 0.3, "autumn": 0.6, "winter": 0.4},
    "cedar":           {"autumn": 0.4, "winter": 0.3},
    "patchouli":       {"autumn": 0.6, "winter": 0.5, "summer": -0.4},
    "amber":           {"winter": 0.7, "autumn": 0.6, "summer": -0.3},
    "ambergris":       {"autumn": 0.4, "winter": 0.4},
    "musk":            {},  # neutral — no season preference
    "white musk":      {},
    "woody":           {"autumn": 0.3, "winter": 0.2},
    # ── Explicit Fragella aliases (alternate note names returned by API) ───────
    # Fragella sometimes returns compound names like "Agarwood (Oud)" — these
    # would miss the "oud" key with exact matching, so we register them directly.
    "agarwood":        {"winter": 1.8, "autumn": 0.9, "spring": -0.9, "summer": -2.0},
    "agarwood (oud)":  {"winter": 1.8, "autumn": 0.9, "spring": -0.9, "summer": -2.0},
    "oud wood":        {"winter": 1.8, "autumn": 0.9, "spring": -0.9, "summer": -2.0},
    "tonka beans":     {"winter": 0.8, "autumn": 0.6, "summer": -0.5},
    "sea water":       {"summer": 1.5, "spring": 0.3, "winter": -1.0},
    "salt":            {"summer": 1.2, "spring": 0.2, "winter": -0.5},
    "fresh":           {"summer": 1.0, "spring": 0.7},
    "clean":           {"summer": 0.8, "spring": 0.6},
    "powdery":         {"autumn": 0.4, "winter": 0.3, "summer": -0.2},
    "resinous":        {"winter": 0.8, "autumn": 0.6, "summer": -0.7},
    "warm spices":     {"winter": 0.9, "autumn": 0.8, "summer": -0.8},
    "beeswax":         {"winter": 0.6, "autumn": 0.5, "summer": -0.3},
    "iso e super":     {},
    "ambroxan":        {"autumn": 0.3, "winter": 0.3},
}

# Pre-compiled word-boundary patterns for all keys — built once at module load.
# Used by _season_score for substring matching when exact lookup fails.
_NOTE_SEASON_PATTERNS: list[tuple[re.Pattern, dict]] = [
    (re.compile(r"\b" + re.escape(k) + r"\b"), v)
    for k, v in _NOTE_SEASON.items()
    if k  # skip empty string keys just in case
]


def _season_score(notes: list[str], season: str) -> float:
    """
    Return a season-alignment score for a fragrance given its actual notes.
    Positive = good fit, negative = poor fit.
    Returns 0.0 for 'all_year' (no season penalty applied).

    Uses two-phase lookup:
    1. Exact match (fast path) — e.g. "oud" → found directly.
    2. Word-boundary substring (fallback) — e.g. "Agarwood (Oud)" → matches "oud".
       The longest matching key wins to avoid false positives.
    """
    if season == "all_year" or not notes:
        return 0.0

    total = 0.0
    for note in notes:
        note_lower = note.strip().lower()

        # Fast path: exact key match
        if note_lower in _NOTE_SEASON:
            total += _NOTE_SEASON[note_lower].get(season, 0.0)
            continue

        # Fallback: longest key that appears as a whole word inside the note name
        best_weight: float | None = None
        best_len: int = 0
        for pattern, weights in _NOTE_SEASON_PATTERNS:
            key_len = len(pattern.pattern) - 4  # strip \b...\b
            if key_len > best_len and pattern.search(note_lower):
                best_weight = weights.get(season, 0.0)
                best_len = key_len
        if best_weight is not None:
            total += best_weight

    return total


# ── Fragrance-name based season heuristic ────────────────────────────────────
# Certain keywords in a fragrance NAME strongly imply a season regardless of
# what notes Fragella returns (e.g. Badee Al OUD for summer = obvious mismatch).

_NAME_SEASON_PENALTY: dict[str, dict[str, float]] = {
    "oud":     {"summer": -3.0, "spring": -1.5},
    "noir":    {"summer": -1.0},
    "intense": {"summer": -0.5},
    "extreme": {"summer": -0.5},
    "inferno": {"summer": -0.8},
    "winter":  {"summer": -2.0, "spring": -1.0},
    "noel":    {"summer": -1.5, "spring": -0.5},
    "nuit":    {"summer": -0.5},
    "absolu":  {"summer": -0.3},
    # Evening/night-coded names — typically heavy orientals
    "9pm":     {"summer": -2.5, "spring": -1.0},
    "midnight": {"summer": -1.5, "spring": -0.5},
    "night":   {"summer": -1.0},
    "evening": {"summer": -0.8},
    "tobacco": {"summer": -1.5, "spring": -0.5},
    "opium":   {"summer": -1.5, "spring": -0.5},
}


def _name_season_score(fragrance_name: str, season: str) -> float:
    """
    Additional season penalty/bonus derived from keywords in the fragrance name.
    Catches obvious mismatches even when Fragella has no note data.
    """
    if season == "all_year":
        return 0.0
    name_lower = fragrance_name.lower()
    total = 0.0
    for keyword, weights in _NAME_SEASON_PENALTY.items():
        if re.search(r"\b" + re.escape(keyword) + r"\b", name_lower):
            total += weights.get(season, 0.0)
    return total


# ── Description → implicit notes ─────────────────────────────────────────────
# When a user's free-text description contains freshness / scent-cluster keywords
# we inject matching notes into the prompt so Claude gets a concrete scent brief
# rather than interpreting vague descriptions through popularity bias.

_DESCRIPTION_NOTE_CLUSTERS: list[tuple[re.Pattern, list[str]]] = [
    # Fresh / shower / clean
    (re.compile(r"nydusch|freshly shower|just shower|after shower|shower gel|"
                r"clean\b|soapy|soap\b|tvål|ren\b|renlighet|hvit musk|white soap",
                re.IGNORECASE),
     ["aquatic", "clean", "fresh", "white musk", "ozonic", "green"]),
    # Aquatic / ocean / beach
    (re.compile(r"hav|ocean|beach|seaside|sea breeze|salt water|aquatic|water",
                re.IGNORECASE),
     ["marine", "aquatic", "sea salt", "ozonic", "bergamot"]),
    # Citrus burst
    (re.compile(r"citrus|lime|lemon|grapefruit|sitrus|citrusskal",
                re.IGNORECASE),
     ["bergamot", "lemon", "grapefruit", "citrus"]),
    # Warm / cozy / gourmand
    (re.compile(r"varm|cozy|cosy|mysig|kanel|vanilj|söt|gourmand|baked|cookie",
                re.IGNORECASE),
     ["vanilla", "tonka", "cinnamon", "amber"]),
    # Woody / forest
    (re.compile(r"skog|forest|woods|träig|cedar|sandalwood",
                re.IGNORECASE),
     ["cedar", "sandalwood", "vetiver", "woody"]),
    # Floral
    (re.compile(r"blommig|floral|blomma|rose|jasmin|peony|pion",
                re.IGNORECASE),
     ["rose", "jasmine", "peony", "neroli"]),
    # Spicy / oriental
    (re.compile(r"kryddig|spicy|orientalisk|oriental|oud|rökig|smoky",
                re.IGNORECASE),
     ["oud", "incense", "amber", "saffron", "tobacco"]),
]


def _extract_description_notes(description: str) -> list[str]:
    """
    Map free-text description keywords to concrete note clusters.
    Returns a deduplicated list of note strings to inject into the prompt.
    """
    notes: list[str] = []
    seen: set[str] = set()
    for pattern, cluster_notes in _DESCRIPTION_NOTE_CLUSTERS:
        if pattern.search(description):
            for n in cluster_notes:
                if n not in seen:
                    seen.add(n)
                    notes.append(n)
    return notes


# ── Reference fragrance DNA helpers ──────────────────────────────────────────

# Regex patterns to extract a reference fragrance name from free text.
# Matches: "similar to X", "like X", "clone of X", "dupe of X", etc.
# Also handles Swedish: "liknande X", "kopia av X", "inspirerad av X".
_REFERENCE_PATTERNS: list[re.Pattern] = [
    re.compile(r"similar to\s+([A-Z][^\n,.(]{3,60}?)(?:\s*[,.(]|$)", re.IGNORECASE),
    re.compile(r"\blike\s+([A-Z][^\n,.(]{3,60}?)(?:\s*[,.(]|$)", re.IGNORECASE),
    re.compile(r"clone of\s+([A-Z][^\n,.(]{3,60}?)(?:\s*[,.(]|$)", re.IGNORECASE),
    re.compile(r"dupe of\s+([A-Z][^\n,.(]{3,60}?)(?:\s*[,.(]|$)", re.IGNORECASE),
    re.compile(r"inspired by\s+([A-Z][^\n,.(]{3,60}?)(?:\s*[,.(]|$)", re.IGNORECASE),
    re.compile(r"version of\s+([A-Z][^\n,.(]{3,60}?)(?:\s*[,.(]|$)", re.IGNORECASE),
    re.compile(r"reminiscent of\s+([A-Z][^\n,.(]{3,60}?)(?:\s*[,.(]|$)", re.IGNORECASE),
    re.compile(r"liknande\s+([A-Za-zÅÄÖåäö][^\n,.(]{3,60}?)(?:\s*[,.(]|$)", re.IGNORECASE),
    re.compile(r"kopia av\s+([A-Za-zÅÄÖåäö][^\n,.(]{3,60}?)(?:\s*[,.(]|$)", re.IGNORECASE),
    re.compile(r"inspirerad av\s+([A-Za-zÅÄÖåäö][^\n,.(]{3,60}?)(?:\s*[,.(]|$)", re.IGNORECASE),
    re.compile(r"påminner om\s+([A-Za-zÅÄÖåäö][^\n,.(]{3,60}?)(?:\s*[,.(]|$)", re.IGNORECASE),
]


def _extract_reference_names(description: str, liked_frags: str) -> list[str]:
    """
    Extract fragrance reference names from description text and liked_fragrances.
    - liked_fragrances_text is already a comma-separated clean list.
    - description_text is free text; we scan for common "similar to X" patterns.
    Returns a deduplicated list of candidate fragrance names (max 4).
    """
    seen: set[str] = set()
    names: list[str] = []

    def _add(raw: str) -> None:
        cleaned = raw.strip().rstrip(".,;:!?").strip()
        if cleaned and cleaned.lower() not in seen and len(cleaned) > 2:
            seen.add(cleaned.lower())
            names.append(cleaned)

    # 1. liked_fragrances (already structured)
    for frag in liked_frags.split(","):
        _add(frag)

    # 2. description — scan for reference patterns
    for pattern in _REFERENCE_PATTERNS:
        for m in pattern.finditer(description):
            _add(m.group(1))

    return names[:4]  # cap at 4 to limit Fragella calls


async def _fetch_reference_dna(names: list[str]) -> dict[str, list[str]]:
    """
    Look up each reference fragrance in Fragella and return a dict of
    {fragrance_name: [note, note, ...]} for any that have note data.
    Results are cached by fragrance_service so repeated calls are free.
    """
    dna: dict[str, list[str]] = {}
    for name in names:
        try:
            data = await fragrance_service.lookup_fragrance(name)
            if data and data.get("notes"):
                dna[name] = data["notes"][:15]  # keep top 15 notes
        except Exception as exc:
            print(f"[ai.service] DNA lookup failed for '{name}': {exc}")
    if dna:
        print(f"[ai.service] Reference DNA fetched for: {list(dna.keys())}")
    return dna


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


# ── Parfumo season validation ────────────────────────────────────────────────

# If the selected season has fewer than this % of community votes → flag parfym
_PARFUMO_SEASON_MIN_PCT = 20


def _parfumo_season_score(votes: dict[str, int] | None, season: str) -> float:
    """
    Convert Parfumo community votes to a re-ranking signal.

    >50% for selected season → strong positive  (+2.0)
    30–50%                  → weak positive     (+0.5)
    15–30%                  → neutral           ( 0.0)
    <15%                    → negative          (-2.0)
    No data                 → neutral           ( 0.0)
    """
    if not votes or season == "all_year":
        return 0.0
    pct = votes.get(season, 0)
    if pct >= 50:
        return 2.0
    elif pct >= 30:
        return 0.5
    elif pct >= 15:
        return 0.0
    else:
        return -2.0


async def _replace_season_mismatches(
    results: list[RecommendationResult],
    prefs: AssessmentPreferences,
    parfumo_votes: list[dict[str, int] | None],
) -> list[RecommendationResult]:
    """
    Ask Claude (Haiku) to replace any fragrance where Parfumo community
    votes show <_PARFUMO_SEASON_MIN_PCT% for the selected season.
    Falls back to the original list on any error.
    """
    season = prefs.season
    if season == "all_year":
        return results

    bad: list[tuple[int, RecommendationResult, dict]] = []
    for i, (r, votes) in enumerate(zip(results, parfumo_votes)):
        if votes is None:
            continue
        pct = votes.get(season, 0)
        if pct < _PARFUMO_SEASON_MIN_PCT:
            bad.append((i, r, votes))
            print(
                f"[ai.service] Parfumo season mismatch: '{r.name}' "
                f"only {pct}% for {season} — queuing for replacement."
            )

    if not bad:
        return results

    bad_indices = {idx for idx, _, _ in bad}
    good_names = [r.name for i, r in enumerate(results) if i not in bad_indices]

    bad_lines = "\n".join(
        f"- {r.name} by {r.brand} "
        f"(Parfumo votes: spring={v.get('spring', 0)}% "
        f"summer={v.get('summer', 0)}% "
        f"autumn={v.get('autumn', 0)}% "
        f"winter={v.get('winter', 0)}%; "
        f"selected season '{season}' has only {v.get(season, 0)}%)"
        for _, r, v in bad
    )

    prompt = f"""These fragrances were recommended for {season} but Parfumo community \
data shows they are poor seasonal fits:

{bad_lines}

Already accepted fragrances (do NOT repeat): {", ".join(good_names) or "none"}

For each fragrance above, suggest exactly ONE replacement that:
1. Fits {season} well (aim for >40% Parfumo community votes for {season})
2. Stays within the same category (niche/designer/dupe) as the fragrance it replaces
3. Fits budget {prefs.budget_min}–{prefs.budget_max} SEK
4. Matches gender: {prefs.fragrance_gender}
5. Is verifiable on Fragrantica or Basenotes

Respond with ONLY valid JSON — no prose, no markdown:
{{
  "replacements": [
    {{
      "replaces": "Exact name of the fragrance being replaced",
      "name": "Replacement Fragrance Name",
      "brand": "Brand Name",
      "type": "niche|designer|dupe",
      "price_range": "X–Y SEK",
      "match_score": 80,
      "reason": "1-2 sentences explaining the seasonal fit and why this matches."
    }}
  ]
}}"""

    try:
        client = anthropic.AsyncAnthropic(api_key=settings.ai_api_key)
        resp = await client.messages.create(
            model=_MODEL_HAIKU,
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        text = next((b.text for b in resp.content if b.type == "text"), None)
        if not text:
            return results

        data = _extract_json(text)
        for replacement in data.get("replacements", []):
            for idx, r, _ in bad:
                if r.name.lower() == replacement.get("replaces", "").lower():
                    print(
                        f"[ai.service] Replacing '{r.name}' → "
                        f"'{replacement['name']}' (Parfumo season fix)"
                    )
                    results[idx] = RecommendationResult(
                        id=f"{idx}-{replacement['name']}",
                        name=replacement["name"],
                        brand=replacement["brand"],
                        description="",
                        notes=[],
                        image_url=None,
                        match_score=replacement.get("match_score", 75),
                        type=replacement["type"],
                        price_range=replacement["price_range"],
                        reason=replacement["reason"],
                    )
                    break
    except Exception as exc:
        print(f"[ai.service] Parfumo replacement error: {exc}")

    return results


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
#   v8 — scent-target brief generalised to all 3 single-category + liked frags combos
#   v9 — brand tier reference added (Tom Ford/Mancera never dupe); stronger hallucination guard
#   v10 — post-Claude non-fragrance brand blocklist (Pure Cosmetics repeat offender)
#   v11 — note→season re-ranking + Fragella DNA fingerprint injection into prompt
#   v12 — fix season_score note matching (word-boundary substring for "Agarwood (Oud)");
#          name-based season heuristic; description→implicit notes injection
_CACHE_VERSION = 16


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

    # ── Pre-fetch Fragella note DNA for reference fragrances ──────────────────
    # Done BEFORE the Claude call so the note anchors can be injected into the
    # prompt — this is the core fix for BB-03 (Le Male → Aventus substitution).
    ref_names = _extract_reference_names(
        prefs.description_text,
        prefs.liked_fragrances_text,
    )
    ref_dna = await _fetch_reference_dna(ref_names) if ref_names else {}

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
        messages=[{"role": "user", "content": _build_user_message(prefs, ref_dna)}],
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
        # Hard blocklist — reject known non-fragrance brands before any enrichment
        if _is_blocked_brand(suggestion.brand):
            print(f"[ai.service] Blocked non-fragrance brand: '{suggestion.brand}' — skipping.")
            continue

        fragella = await fragrance_service.lookup_fragrance(suggestion.name)

        fragella_is_valid = False
        if fragella:
            fragella_brand = fragella["fragella_brand"] or suggestion.brand
            # Secondary blocklist check — Fragella can return wrong brands for some
            # queries (e.g. a cosmetics brand name as a false-positive search result).
            # Discard the entire Fragella record when the brand is blocked.
            if _is_blocked_brand(fragella_brand):
                print(
                    f"[ai.service] Fragella returned blocked brand '{fragella_brand}' "
                    f"for '{suggestion.name}' — discarding Fragella result, using AI data."
                )
            else:
                fragella_is_valid = True

        if fragella_is_valid:
            name        = fragella["fragella_name"] or suggestion.name
            brand       = fragella["fragella_brand"] or suggestion.brand
            image_url   = fragella["image_url"]
            notes       = fragella["notes"]
            description = fragella["description"]
            # Always use Claude's SEK estimate — Fragella returns raw USD values
            # without currency label, making them misleading when displayed as kr.
            price_range = suggestion.price_range
        else:
            if not fragella:
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

    # ── Parfumo season validation ─────────────────────────────────────────────
    # Fetch community season votes in parallel for all results.
    # Runs only when a specific season is selected (not all_year).
    # Each fetch has a 6 s timeout; failures return None and are skipped.
    parfumo_votes: list[dict[str, int] | None]
    if prefs.season != "all_year" and results:
        import asyncio as _asyncio
        parfumo_votes = list(await _asyncio.gather(*[
            parfumo_service.get_season_votes(r.name, r.brand)
            for r in results
        ]))
        # Ask Claude (Haiku) to replace fragrances with poor season fit
        results = await _replace_season_mismatches(results, prefs, parfumo_votes)
        # Refresh votes for any newly swapped-in fragrances
        parfumo_votes = list(await _asyncio.gather(*[
            parfumo_service.get_season_votes(r.name, r.brand)
            for r in results
        ]))
    else:
        parfumo_votes = [None] * len(results)

    # ── Note→Season re-ranking (three signals combined) ───────────────────────
    # Signal 1: _season_score      — Fragella note weights
    # Signal 2: _name_season_score — name-keyword heuristic
    # Signal 3: _parfumo_season_score — Parfumo community votes (highest weight)
    if prefs.season != "all_year" and results:
        for r in results:
            note_sc = _season_score(r.notes, prefs.season)
            name_sc = _name_season_score(r.name, prefs.season)
            total_sc = note_sc + name_sc
            if total_sc < -1.5:
                print(
                    f"[ai.service] Season mismatch: '{r.name}' "
                    f"note_score={note_sc:.1f} name_score={name_sc:.1f} "
                    f"total={total_sc:.1f} season={prefs.season}"
                )

        def _rank_key(pair: tuple[RecommendationResult, dict | None]) -> float:
            r, votes = pair
            return (
                r.match_score
                + (_season_score(r.notes, prefs.season)
                   + _name_season_score(r.name, prefs.season)) * 6
                + _parfumo_season_score(votes, prefs.season) * 8
            )

        paired = sorted(zip(results, parfumo_votes), key=_rank_key, reverse=True)
        results = [r for r, _ in paired]

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

"""Pydantic models for the AI recommendation endpoint."""
from typing import Literal

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class AssessmentPreferences(BaseModel):
    """
    Full form payload from the frontend.
    Accepts camelCase field names (alias_generator=to_camel) so the frontend
    can POST its form values as-is without any key conversion.
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,  # also accept snake_case for tests / curl
    )

    # Step 1 — fragrance preferences
    budget_min: int
    budget_max: int
    season: Literal["spring", "summer", "autumn", "winter", "all_year"]
    fragrance_gender: Literal["men", "women", "unisex"]
    notes_text: str
    prefer_niche: bool
    prefer_designer: bool
    prefer_dupe: bool

    # Optional free-text fields (Step 1)
    description_text: str = ""      # what kind of fragrance they're looking for
    liked_fragrances_text: str = "" # comma-separated brands/names they already like

    # Step 2 — user profile
    name: str
    age: int
    gender: Literal["male", "female", "unspecified"]
    country: str
    collection_size: Literal["lt5", "5to10", "10plus"]


class AIFragranceSuggestion(BaseModel):
    """One fragrance suggestion as returned by Claude (internal)."""

    name: str
    brand: str
    match_score: int
    type: Literal["niche", "designer", "dupe"]
    price_range: str   # estimated market price, e.g. "800–1 200 SEK"
    reason: str


class RecommendationResult(BaseModel):
    """
    Final enriched recommendation sent back to the frontend.
    Serialised with camelCase aliases so it matches the TypeScript
    `FragranceRecommendation` interface exactly.
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    id: str
    name: str
    brand: str
    description: str
    notes: list[str]
    image_url: str | None = None
    match_score: int
    type: Literal["niche", "designer", "dupe"]
    price_range: str
    reason: str

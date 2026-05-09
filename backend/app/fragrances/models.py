"""Pydantic models for the Fragella API response shape."""
from pydantic import BaseModel


class FragellaNoteItem(BaseModel):
    name: str
    imageUrl: str | None = None


class FragellaNotes(BaseModel):
    Top: list[FragellaNoteItem] = []
    Middle: list[FragellaNoteItem] = []
    Base: list[FragellaNoteItem] = []


class FragellaResult(BaseModel):
    """One result entry returned by the Fragella /v1/fragrances endpoint."""
    Name: str
    Brand: str
    ImageURL: str | None = None
    GeneralNotes: list[str] = []
    Notes: FragellaNotes | None = None
    Price: str | None = None
    OilType: str | None = None
    Gender: str | None = None
    Longevity: str | None = None
    Sillage: str | None = None
    Year: str | None = None
    rating: str | None = None
    Confidence: str | None = None
    Popularity: str | None = None

    model_config = {"extra": "ignore", "populate_by_name": True}

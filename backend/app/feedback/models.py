"""Pydantic models for the feedback endpoint."""
from typing import Literal

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class FeedbackIn(BaseModel):
    """
    Optional post-recommendation feedback submitted by the user.
    All fields are optional — the user can fill in as much or as little as they want.
    Accepts camelCase keys from the frontend.
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    rating: int | None = None            # 1–5 stars
    comments: str = ""
    name: str = ""
    gender: Literal["male", "female", "unspecified"] | None = None
    age: int | None = None
    collection_size: Literal["lt5", "5to10", "10plus"] | None = None
    email: str = ""

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from typing import Literal


class UserProfileIn(BaseModel):
    """
    Profile submitted from the frontend.
    Accepts camelCase field names (collectionSize, etc.) via alias_generator.
    """
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    name: str
    age: int
    gender: Literal["male", "female", "unspecified"]
    country: str
    collection_size: Literal["lt5", "5to10", "10plus"]


class UserProfileOut(BaseModel):
    """Response returned to the frontend after session creation."""
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    session_token: str   # JWT — frontend stores in localStorage
    profile: UserProfileIn

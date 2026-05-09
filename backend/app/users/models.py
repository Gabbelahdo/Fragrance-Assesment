from pydantic import BaseModel
from typing import Literal


class UserProfileIn(BaseModel):
    name: str
    age: int
    gender: Literal["male", "female", "unspecified"]
    country: str
    collection_size: Literal["lt5", "5to10", "10plus"]


class UserProfileOut(BaseModel):
    session_token: str   # JWT — frontend stores this in localStorage
    profile: UserProfileIn

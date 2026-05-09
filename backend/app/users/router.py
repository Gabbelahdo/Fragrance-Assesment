"""
User session endpoints.

POST /users/session  — save profile, return a JWT
GET  /users/me       — decode JWT, return profile (used to pre-fill the form)
"""
from fastapi import APIRouter, HTTPException

from app.users.models import UserProfileIn, UserProfileOut
from app.users import service

router = APIRouter()


@router.post(
    "/session",
    response_model=UserProfileOut,
    response_model_by_alias=True,
    status_code=201,
)
async def create_session(profile: UserProfileIn):
    """
    Encode the user's profile into a JWT and return it.
    The frontend stores the token in localStorage and sends it on return visits.
    """
    return await service.create_or_update_session(profile)


@router.get(
    "/me",
    response_model=UserProfileIn,
    response_model_by_alias=True,
)
async def get_me(token: str):
    """
    Decode the JWT and return the stored profile so Step 2 can be pre-filled.
    Pass the token as a query parameter: GET /users/me?token=<jwt>
    """
    profile = await service.get_profile_from_token(token)
    if not profile:
        raise HTTPException(status_code=401, detail="Invalid or expired session token.")
    return profile

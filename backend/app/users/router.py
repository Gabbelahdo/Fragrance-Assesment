"""
User session endpoints.

POST /users/session  — create or update a user profile, returns a JWT
GET  /users/me       — return the stored profile from the JWT
"""
from fastapi import APIRouter, HTTPException
from app.users.models import UserProfileIn, UserProfileOut
from app.users import service

router = APIRouter()


@router.post("/session", response_model=UserProfileOut, status_code=201)
async def create_session(profile: UserProfileIn):
    """
    Save name / age / gender to MongoDB and return a JWT session token.
    Frontend stores the token in localStorage and sends it on future visits.
    """
    return await service.create_or_update_session(profile)


@router.get("/me", response_model=UserProfileIn)
async def get_me(token: str):
    """
    Decode the JWT and return the stored profile so the form can be pre-filled.
    """
    profile = await service.get_profile_from_token(token)
    if not profile:
        raise HTTPException(status_code=404, detail="Session not found")
    return profile

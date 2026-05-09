"""
User session service — JWT-based profile persistence.

Profiles are encoded directly in the JWT (no DB round-trip needed for the
initial local-dev flow).  Swapping in a Mongo write later is a one-liner.
"""
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from app.core.config import settings
from app.users.models import UserProfileIn, UserProfileOut


def _create_token(payload: dict) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    return jwt.encode(
        {**payload, "exp": expire},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


async def create_or_update_session(profile: UserProfileIn) -> UserProfileOut:
    """Encode the profile into a JWT and return it."""
    token = _create_token(profile.model_dump())
    return UserProfileOut(session_token=token, profile=profile)


async def get_profile_from_token(token: str) -> UserProfileIn | None:
    """Decode the JWT and return the stored profile, or None if invalid."""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        payload.pop("exp", None)
        return UserProfileIn(**payload)
    except (JWTError, Exception):
        return None

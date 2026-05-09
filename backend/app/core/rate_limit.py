"""
In-memory rate limiter — per IP, sliding 1-hour window.

For multi-instance production deployments swap _store for a Redis sorted-set.
The interface (check_rate_limit dependency) stays the same either way.
"""
from collections import defaultdict
from time import time

from fastapi import HTTPException, Request

# Max assessments per IP per hour.
# Generous enough for real users, punishing for scripts.
MAX_PER_HOUR = 5

_store: dict[str, list[float]] = defaultdict(list)


def check_rate_limit(request: Request) -> None:
    """
    FastAPI dependency — raises 429 if the caller has exceeded MAX_PER_HOUR
    requests in the last 60 minutes.  Otherwise records the timestamp and returns.
    """
    ip: str = request.client.host if request.client else "unknown"
    now = time()

    # Discard timestamps older than one hour
    recent = [t for t in _store[ip] if now - t < 3600]
    _store[ip] = recent

    if len(recent) >= MAX_PER_HOUR:
        oldest = min(recent)
        retry_after = int(3600 - (now - oldest))
        raise HTTPException(
            status_code=429,
            detail=(
                f"Rate limit exceeded ({MAX_PER_HOUR} assessments per hour). "
                f"Try again in {retry_after // 60} min {retry_after % 60} s."
            ),
            headers={"Retry-After": str(retry_after)},
        )

    _store[ip].append(now)

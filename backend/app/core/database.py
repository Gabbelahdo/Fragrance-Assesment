from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import settings

_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(settings.mongodb_url)
    return _client


def get_db() -> AsyncIOMotorDatabase:
    return get_client()[settings.db_name]


async def ensure_indexes() -> None:
    """
    Create TTL indexes for the two cache collections.
    Safe to call on every startup — MongoDB ignores no-op index creation.
    Silently skips if MongoDB is unavailable (caching is optional).
    """
    db = get_db()
    try:
        # Recommendation cache expires after 7 days
        await db["recommendation_cache"].create_index(
            "created_at",
            expireAfterSeconds=7 * 24 * 3600,
            name="ttl_recommendation_cache",
        )
        # Fragrance data cache expires after 30 days
        await db["fragrance_cache"].create_index(
            "cached_at",
            expireAfterSeconds=30 * 24 * 3600,
            name="ttl_fragrance_cache",
        )
        print("[database] TTL indexes ensured.")
    except Exception as exc:
        print(f"[database] Could not create indexes (MongoDB unavailable?): {exc}")

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
    Set up indexes for all collections.
    - Drops any legacy TTL indexes (caches are now permanent).
    - Creates a sorted index on assessments.created_at for easy querying.
    Safe to call on every startup. Silently skips if MongoDB is unavailable.
    """
    db = get_db()
    try:
        # Drop legacy TTL indexes — caches are now stored permanently.
        for col, idx in [
            ("recommendation_cache", "ttl_recommendation_cache"),
            ("fragrance_cache",      "ttl_fragrance_cache"),
        ]:
            try:
                await db[col].drop_index(idx)
                print(f"[database] Dropped legacy TTL index '{idx}'.")
            except Exception:
                pass  # index didn't exist — that's fine

        # Assessments — index on created_at for time-based queries/sorting
        await db["assessments"].create_index(
            "created_at",
            name="assessments_created_at",
        )
        # Assessments — index on profile.name for per-user lookups
        await db["assessments"].create_index(
            "profile.name",
            name="assessments_profile_name",
        )
        print("[database] Indexes ensured.")
    except Exception as exc:
        print(f"[database] Could not create indexes (MongoDB unavailable?): {exc}")

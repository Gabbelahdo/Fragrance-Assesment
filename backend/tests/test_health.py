"""Tests for the /health endpoint."""
from httpx import AsyncClient


async def test_health_returns_ok(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_health_is_fast(client: AsyncClient):
    """Health check must respond quickly — it's used by Azure App Service."""
    import time
    start = time.monotonic()
    response = await client.get("/health")
    elapsed = time.monotonic() - start
    assert response.status_code == 200
    assert elapsed < 1.0, f"Health check took {elapsed:.2f}s — should be < 1s"

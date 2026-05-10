"""
Tests for the per-IP rate limiter.

The in-memory store is cleared before each test by the autouse fixture
in conftest.py, so tests are fully independent.
"""
import json
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient

from tests.conftest import VALID_PREFERENCES


def _claude_mock():
    payload = json.dumps({"recommendations": [
        {"name": f"F{i}", "brand": "B", "match_score": 90 - i,
         "type": "niche", "price_range": "800–1 200 SEK", "reason": "ok"}
        for i in range(5)
    ]})
    msg = MagicMock()
    msg.content = [MagicMock(type="text", text=payload)]

    ctx = AsyncMock()
    ctx.__aenter__ = AsyncMock(return_value=ctx)
    ctx.__aexit__ = AsyncMock(return_value=None)
    ctx.get_final_message = AsyncMock(return_value=msg)

    c = MagicMock()
    c.messages.stream = MagicMock(return_value=ctx)
    return c


def _fragella_mock():
    resp = MagicMock()
    resp.raise_for_status = MagicMock()
    resp.json = MagicMock(return_value=[])   # empty = fallback to AI data

    http = AsyncMock()
    http.__aenter__ = AsyncMock(return_value=http)
    http.__aexit__ = AsyncMock(return_value=None)
    http.get = AsyncMock(return_value=resp)
    return http


async def test_five_requests_succeed(client: AsyncClient):
    with (
        patch("app.ai.service.anthropic.AsyncAnthropic", return_value=_claude_mock()),
        patch("app.fragrances.service.httpx.AsyncClient", return_value=_fragella_mock()),
    ):
        for i in range(5):
            r = await client.post("/ai/recommend", json=VALID_PREFERENCES)
            assert r.status_code == 200, f"Request {i+1} should succeed, got {r.status_code}"


async def test_sixth_request_is_rejected(client: AsyncClient):
    with (
        patch("app.ai.service.anthropic.AsyncAnthropic", return_value=_claude_mock()),
        patch("app.fragrances.service.httpx.AsyncClient", return_value=_fragella_mock()),
    ):
        for _ in range(5):
            await client.post("/ai/recommend", json=VALID_PREFERENCES)

        r = await client.post("/ai/recommend", json=VALID_PREFERENCES)
        assert r.status_code == 429


async def test_rate_limit_error_includes_retry_info(client: AsyncClient):
    with (
        patch("app.ai.service.anthropic.AsyncAnthropic", return_value=_claude_mock()),
        patch("app.fragrances.service.httpx.AsyncClient", return_value=_fragella_mock()),
    ):
        for _ in range(5):
            await client.post("/ai/recommend", json=VALID_PREFERENCES)

        r = await client.post("/ai/recommend", json=VALID_PREFERENCES)
        assert r.status_code == 429
        assert "Retry-After" in r.headers
        body = r.json()
        assert "detail" in body
        assert "Rate limit" in body["detail"]

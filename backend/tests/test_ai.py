"""
Tests for the AI recommendation endpoint.

Claude and Fragella HTTP calls are mocked so these tests:
- Run in CI without real API keys
- Complete in milliseconds
- Are fully deterministic
"""
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient

from app.ai.models import RecommendationResult
from tests.conftest import VALID_PREFERENCES, FAKE_RECOMMENDATIONS


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_claude_mock(recommendations: list[dict]):
    """Build a mock that mimics anthropic.AsyncAnthropic().messages.stream().__aenter__."""
    payload = json.dumps({"recommendations": recommendations})

    mock_message = MagicMock()
    mock_message.content = [MagicMock(type="text", text=payload)]

    mock_stream_ctx = AsyncMock()
    mock_stream_ctx.__aenter__ = AsyncMock(return_value=mock_stream_ctx)
    mock_stream_ctx.__aexit__ = AsyncMock(return_value=None)
    mock_stream_ctx.get_final_message = AsyncMock(return_value=mock_message)

    mock_client = MagicMock()
    mock_client.messages.stream = MagicMock(return_value=mock_stream_ctx)

    return mock_client


def _claude_suggestions():
    return [
        {"name": f"Fragrance {i}", "brand": f"Brand {i}",
         "match_score": 95 - i * 5, "type": "niche", "reason": "Great match."}
        for i in range(5)
    ]


def _fragella_response(name: str):
    return [{
        "Name": name, "Brand": "Test Brand",
        "Image URL": None,
        "Notes": {
            "Top":    [{"name": "Oud",     "imageUrl": ""}],
            "Middle": [{"name": "Vanilla", "imageUrl": ""}],
            "Base":   [],
        },
        "Price": "1000", "OilType": "EDP",
        "Longevity": "Long Lasting", "Sillage": "Moderate",
    }]


@pytest.fixture
def mock_claude():
    client = _make_claude_mock(_claude_suggestions())
    with patch("app.ai.service.anthropic.AsyncAnthropic", return_value=client):
        yield


@pytest.fixture
def mock_fragella():
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()

    mock_http = AsyncMock()
    mock_http.__aenter__ = AsyncMock(return_value=mock_http)
    mock_http.__aexit__ = AsyncMock(return_value=None)

    # Return a different fragrance per call based on the search param
    async def fake_get(url, **kwargs):
        name = kwargs.get("params", {}).get("search", "Unknown")
        mock_resp.json = MagicMock(return_value=_fragella_response(name))
        return mock_resp

    mock_http.get = fake_get

    with patch("app.fragrances.service.httpx.AsyncClient", return_value=mock_http):
        yield


# ── Tests ─────────────────────────────────────────────────────────────────────

async def test_recommend_returns_five_results(client: AsyncClient, mock_claude, mock_fragella):
    response = await client.post("/ai/recommend", json=VALID_PREFERENCES)
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 5


async def test_recommend_results_sorted_by_score(client: AsyncClient, mock_claude, mock_fragella):
    response = await client.post("/ai/recommend", json=VALID_PREFERENCES)
    scores = [r["matchScore"] for r in response.json()]
    assert scores == sorted(scores, reverse=True)


async def test_recommend_result_shape(client: AsyncClient, mock_claude, mock_fragella):
    response = await client.post("/ai/recommend", json=VALID_PREFERENCES)
    first = response.json()[0]
    assert "id"          in first
    assert "name"        in first
    assert "brand"       in first
    assert "matchScore"  in first
    assert "type"        in first
    assert "notes"       in first
    assert "priceRange"  in first
    assert "reason"      in first


async def test_recommend_missing_required_field(client: AsyncClient):
    bad = {k: v for k, v in VALID_PREFERENCES.items() if k != "notesText"}
    response = await client.post("/ai/recommend", json=bad)
    assert response.status_code == 422


async def test_recommend_invalid_season(client: AsyncClient):
    bad = {**VALID_PREFERENCES, "season": "monsoon"}
    response = await client.post("/ai/recommend", json=bad)
    assert response.status_code == 422


async def test_recommend_result_cached_on_second_call(client: AsyncClient, mock_claude, mock_fragella):
    """Identical preferences should hit MongoDB cache on the second call."""
    r1 = await client.post("/ai/recommend", json=VALID_PREFERENCES)
    r2 = await client.post("/ai/recommend", json=VALID_PREFERENCES)
    assert r1.status_code == 200
    assert r2.status_code == 200
    # Results must be identical
    assert r1.json() == r2.json()


async def test_recommend_model_tiering_uses_haiku_for_simple(mock_claude, mock_fragella):
    """Designer + 2 notes → Haiku; niche + 3+ notes → Opus."""
    from app.ai.service import _pick_model
    from app.ai.models import AssessmentPreferences

    simple = AssessmentPreferences(
        budget_min=500, budget_max=2000, season="summer",
        fragrance_gender="men", notes_text="citrus, fresh",
        prefer_niche=False, prefer_designer=True, prefer_dupe=False,
        name="X", age=25, gender="male", country="Sweden", collection_size="lt5",
    )
    assert _pick_model(simple) == "claude-haiku-4-5"

    complex_ = AssessmentPreferences(
        budget_min=500, budget_max=5000, season="winter",
        fragrance_gender="unisex", notes_text="oud, amber, smoke, leather",
        prefer_niche=True, prefer_designer=False, prefer_dupe=False,
        name="X", age=30, gender="male", country="Sweden", collection_size="10plus",
    )
    assert _pick_model(complex_) == "claude-opus-4-7"

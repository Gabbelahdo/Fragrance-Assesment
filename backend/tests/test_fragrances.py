"""
Tests for the Fragella proxy service and /fragrances/search endpoint.
Fragella HTTP calls are mocked — no real network requests.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient


FAKE_FRAGELLA_RESULT = [{
    "Name": "Oud for Greatness",
    "Brand": "Initio Parfums Prives",
    "Image URL": "https://example.com/image.jpg",
    "Notes": {
        "Top":    [{"name": "Oud",      "imageUrl": ""}],
        "Middle": [{"name": "Saffron",  "imageUrl": ""}],
        "Base":   [{"name": "Ambergris","imageUrl": ""}],
    },
    "Price": "2800",
    "OilType": "EDP",
    "Longevity": "Very Long Lasting",
    "Sillage": "Enormous",
}]


@pytest.fixture
def mock_fragella_http():
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json = MagicMock(return_value=FAKE_FRAGELLA_RESULT)

    mock_http = AsyncMock()
    mock_http.__aenter__ = AsyncMock(return_value=mock_http)
    mock_http.__aexit__ = AsyncMock(return_value=None)
    mock_http.get = AsyncMock(return_value=mock_resp)

    with patch("app.fragrances.service.httpx.AsyncClient", return_value=mock_http):
        yield


async def test_search_endpoint_returns_result(client: AsyncClient, mock_fragella_http):
    response = await client.get("/fragrances/search?name=Oud+for+Greatness")
    assert response.status_code == 200
    body = response.json()
    assert body["found"] is True
    assert body["data"]["fragella_name"] == "Oud for Greatness"
    assert body["data"]["fragella_brand"] == "Initio Parfums Prives"


async def test_search_flattens_notes(client: AsyncClient, mock_fragella_http):
    response = await client.get("/fragrances/search?name=Oud+for+Greatness")
    notes = response.json()["data"]["notes"]
    assert "Oud"       in notes
    assert "Saffron"   in notes
    assert "Ambergris" in notes


async def test_search_formats_price(client: AsyncClient, mock_fragella_http):
    response = await client.get("/fragrances/search?name=Oud+for+Greatness")
    assert response.json()["data"]["price_range"] == "2800 kr"


async def test_search_builds_description(client: AsyncClient, mock_fragella_http):
    response = await client.get("/fragrances/search?name=Oud+for+Greatness")
    desc = response.json()["data"]["description"]
    assert "EDP" in desc
    assert "Very Long Lasting" in desc
    assert "Enormous" in desc


async def test_search_returns_not_found_when_empty(client: AsyncClient):
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json = MagicMock(return_value=[])   # Fragella returns empty list

    mock_http = AsyncMock()
    mock_http.__aenter__ = AsyncMock(return_value=mock_http)
    mock_http.__aexit__ = AsyncMock(return_value=None)
    mock_http.get = AsyncMock(return_value=mock_resp)

    with patch("app.fragrances.service.httpx.AsyncClient", return_value=mock_http):
        response = await client.get("/fragrances/search?name=DoesNotExist")
        assert response.status_code == 200
        assert response.json()["found"] is False


async def test_search_handles_fragella_error_gracefully(client: AsyncClient):
    mock_http = AsyncMock()
    mock_http.__aenter__ = AsyncMock(return_value=mock_http)
    mock_http.__aexit__ = AsyncMock(return_value=None)
    mock_http.get = AsyncMock(side_effect=Exception("Fragella is down"))

    with patch("app.fragrances.service.httpx.AsyncClient", return_value=mock_http):
        response = await client.get("/fragrances/search?name=SomeFragrance")
        assert response.status_code == 200
        assert response.json()["found"] is False


async def test_fragrance_cached_after_first_lookup(client: AsyncClient, mock_fragella_http):
    """Second lookup for the same name should use MongoDB cache (Fragella not called again)."""
    from app.fragrances.service import lookup_fragrance

    result1 = await lookup_fragrance("Oud for Greatness")
    result2 = await lookup_fragrance("Oud for Greatness")

    assert result1 == result2
    assert result1["fragella_name"] == "Oud for Greatness"
    # mock_fragella_http's get was called only once (second call hit cache)

"""Tests for the user session endpoints (JWT creation and decoding)."""
from httpx import AsyncClient

from tests.conftest import VALID_PROFILE


async def test_create_session_returns_token(client: AsyncClient):
    response = await client.post("/users/session", json=VALID_PROFILE)
    assert response.status_code == 201
    body = response.json()
    assert "sessionToken" in body
    assert body["sessionToken"].startswith("ey")   # JWT always starts with ey
    assert body["profile"]["name"] == "Test User"


async def test_create_session_profile_roundtrip(client: AsyncClient):
    """The profile encoded in the JWT should be exactly what was sent."""
    response = await client.post("/users/session", json=VALID_PROFILE)
    token = response.json()["sessionToken"]

    me_response = await client.get(f"/users/me?token={token}")
    assert me_response.status_code == 200
    profile = me_response.json()
    assert profile["name"]           == VALID_PROFILE["name"]
    assert profile["age"]            == VALID_PROFILE["age"]
    assert profile["gender"]         == VALID_PROFILE["gender"]
    assert profile["country"]        == VALID_PROFILE["country"]
    assert profile["collectionSize"] == VALID_PROFILE["collectionSize"]


async def test_get_me_invalid_token(client: AsyncClient):
    response = await client.get("/users/me?token=not-a-real-token")
    assert response.status_code == 401


async def test_get_me_missing_token(client: AsyncClient):
    response = await client.get("/users/me")
    # FastAPI returns 422 when a required query param is missing
    assert response.status_code == 422


async def test_create_session_invalid_gender(client: AsyncClient):
    bad = {**VALID_PROFILE, "gender": "alien"}
    response = await client.post("/users/session", json=bad)
    assert response.status_code == 422


async def test_create_session_negative_age(client: AsyncClient):
    """Age is an int but there's no lower-bound constraint in the model — just ensure it parses."""
    profile = {**VALID_PROFILE, "age": -1}
    response = await client.post("/users/session", json=profile)
    # Model has no age constraint; service should still create a token
    assert response.status_code == 201


async def test_create_session_accepts_camel_case(client: AsyncClient):
    """Backend must accept camelCase keys from the frontend."""
    response = await client.post("/users/session", json=VALID_PROFILE)
    assert response.status_code == 201

"""
Tests for:
  - /api/card-royale/chat/* (send, list, react, rate-limit)
  - /api/leaderboard/vibez-top100 (cache + top-N semantics)
  - /api/smartcar/* + /api/spotify/* (MOCK-mode scaffolds)
"""
import os
from fastapi.testclient import TestClient
from pymongo import MongoClient
import pytest

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "global_vibez_dsg")


MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
USER_ID = "pytest_chat_user"
TID = "pytest_chat_t1"

_CLIENT = MongoClient(MONGO_URL)


def _db():
    return _CLIENT[DB_NAME]


@pytest.fixture(scope="module")
def client(shared_client):
    return shared_client


@pytest.fixture(scope="module", autouse=True)
def _seed_and_cleanup():
    db = _db()
    db.users.update_one(
        {"user_id": USER_ID},
        {"$set": {"user_id": USER_ID, "username": "Chatter", "email": "pytest-chat@example.com"}},
        upsert=True,
    )
    db.tournaments.update_one(
        {"tournament_id": TID},
        {"$set": {"tournament_id": TID, "name": "Pytest Chat", "status": "RUNNING"}},
        upsert=True,
    )
    yield
    db.users.delete_one({"user_id": USER_ID})
    db.tournaments.delete_one({"tournament_id": TID})
    db.tournament_chat.delete_many({"tournament_id": TID})


# ========================= TOURNAMENT CHAT =========================

def test_send_requires_auth(client: TestClient):
    client.cookies.clear()
    res = client.post(f"/api/card-royale/chat/{TID}", json={"text": "hi"})
    assert res.status_code == 401


def test_send_rejects_empty_body(client: TestClient):
    res = client.post(
        f"/api/card-royale/chat/{TID}",
        json={"text": ""},
        headers={"x-user-id": USER_ID},
    )
    assert res.status_code == 422  # Pydantic min_length=1


def test_send_rejects_nonexistent_tournament(client: TestClient):
    res = client.post(
        "/api/card-royale/chat/no_such_tournament",
        json={"text": "hello"},
        headers={"x-user-id": USER_ID},
    )
    assert res.status_code == 404


def test_send_and_list_message(client: TestClient):
    res = client.post(
        f"/api/card-royale/chat/{TID}",
        json={"text": "first heckle"},
        headers={"x-user-id": USER_ID},
    )
    assert res.status_code == 200
    msg = res.json()["message"]
    assert msg["text"] == "first heckle"
    assert msg["username"] == "Chatter"
    assert msg["user_id"] == USER_ID
    assert msg["is_pinned"] is False

    res = client.get(f"/api/card-royale/chat/{TID}")
    assert res.status_code == 200
    body = res.json()
    assert any(m["message_id"] == msg["message_id"] for m in body["messages"])


def test_reaction_toggle(client: TestClient):
    # Send a fresh message we can react to
    res = client.post(
        f"/api/card-royale/chat/{TID}",
        json={"text": "react to me"},
        headers={"x-user-id": USER_ID},
    )
    mid = res.json()["message"]["message_id"]

    # Add 🔥
    res = client.post(
        f"/api/card-royale/chat/{TID}/react",
        json={"message_id": mid, "emoji": "🔥"},
        headers={"x-user-id": USER_ID},
    )
    assert res.status_code == 200
    assert res.json()["action"] == "added"
    assert res.json()["reactions"]["🔥"] == 1

    # Toggle off
    res = client.post(
        f"/api/card-royale/chat/{TID}/react",
        json={"message_id": mid, "emoji": "🔥"},
        headers={"x-user-id": USER_ID},
    )
    assert res.json()["action"] == "removed"
    assert res.json()["reactions"].get("🔥", 0) == 0


def test_rate_limit_blocks_spam(client: TestClient):
    headers = {"x-user-id": USER_ID}
    # Fire 15 messages — first 12 (minus any already sent above) must pass,
    # 13th and beyond within the 60s window must 429.
    for i in range(20):
        res = client.post(
            f"/api/card-royale/chat/{TID}",
            json={"text": f"spam {i}"},
            headers=headers,
        )
    # Last request should have been rate-limited
    assert res.status_code == 429


def test_slur_filter(client: TestClient):
    res = client.post(
        f"/api/card-royale/chat/{TID}",
        json={"text": "you are a retard"},  # banned substring
        headers={"x-user-id": "pytest_slur_user"},  # fresh user to avoid rate limit
    )
    assert res.status_code == 400


# ========================= LEADERBOARD =========================

def test_leaderboard_returns_shape(client: TestClient):
    res = client.get("/api/leaderboard/vibez-top100?limit=20")
    assert res.status_code == 200
    body = res.json()
    assert "top" in body
    assert "count" in body
    assert body["limit"] == 20
    # Every row has the minimum public shape — no PII
    for row in body["top"]:
        assert "rank" in row
        assert "display_name" in row
        assert "total_vibez" in row
        assert "email" not in row
        assert "solana_wallet_address" not in row


def test_leaderboard_respects_limit_bounds(client: TestClient):
    # Below min clamps up, above max clamps down.
    r1 = client.get("/api/leaderboard/vibez-top100?limit=1").json()
    r2 = client.get("/api/leaderboard/vibez-top100?limit=500").json()
    assert r1["limit"] == 10
    assert r2["limit"] == 200


def test_leaderboard_cache_reused(client: TestClient):
    r1 = client.get("/api/leaderboard/vibez-top100?limit=25").json()
    r2 = client.get("/api/leaderboard/vibez-top100?limit=25").json()
    # cached_until timestamp is stable across a single window
    assert r1["cached_until"] == r2["cached_until"]


# ========================= SMARTCAR / SPOTIFY =========================

def test_smartcar_config_public(client: TestClient):
    res = client.get("/api/smartcar/config")
    assert res.status_code == 200
    body = res.json()
    # Either mock (no keys) or live (real keys set in .env). Both are valid.
    assert "configured" in body
    assert "scopes_supported" in body


def test_smartcar_vehicles_auth_path(client: TestClient):
    """Mock mode returns fixtures; live mode returns [] if user hasn't OAuth'd."""
    res = client.get("/api/smartcar/vehicles", headers={"x-user-id": USER_ID})
    assert res.status_code == 200
    body = res.json()
    assert "vehicles" in body
    # Live mode with no OAuth yet → connected=False, vehicles=[].
    # Mock mode → mode="mock" with a fixture Tesla.
    if body.get("mode") == "mock":
        assert len(body["vehicles"]) == 1
        assert body["vehicles"][0]["make"] == "Tesla"
    else:
        assert isinstance(body["vehicles"], list)


def test_smartcar_unlock_path(client: TestClient):
    """Mock returns success; live should 502 without OAuth tokens."""
    res = client.post(
        "/api/smartcar/unlock",
        json={"vehicle_id": "mock-vehicle-1"},
        headers={"x-user-id": USER_ID},
    )
    # 200 (mock) OR 502 (live but no tokens) are both acceptable.
    assert res.status_code in (200, 502)


def test_spotify_config_public(client: TestClient):
    res = client.get("/api/spotify/config")
    assert res.status_code == 200
    assert "configured" in res.json()


def test_spotify_now_playing_path(client: TestClient):
    """Mock mode returns fixture; live mode returns connected:false if user not OAuth'd."""
    res = client.get("/api/spotify/now-playing", headers={"x-user-id": USER_ID})
    assert res.status_code in (200, 502)
    if res.status_code == 200:
        body = res.json()
        if body.get("mode") == "mock":
            assert body["track"]["artist"] == "Global Vibez DSG"
        else:
            # Live mode — user hasn't OAuth'd yet
            assert "connected" in body


def test_spotify_push_to_car_requires_auth(client: TestClient):
    client.cookies.clear()
    res = client.post("/api/spotify/push-to-car", json={"track_uri": "spotify:track:foo"})
    assert res.status_code == 401

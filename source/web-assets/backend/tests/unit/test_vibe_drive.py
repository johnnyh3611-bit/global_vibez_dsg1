"""Tests for Vibe Drive — covers every gate + award math + daily cap."""
import os
import pytest
from fastapi.testclient import TestClient
from pymongo import MongoClient

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "global_vibez_dsg")

from services.vibe_drive_service import tick, CURATED_PLAYLIST_URIS  # noqa: E402

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
USER_ID = "pytest_vibe_drive_user"
_CLIENT = MongoClient(MONGO_URL)
APPROVED_PL = next(iter(CURATED_PLAYLIST_URIS))


def _sync_db():
    return _CLIENT[DB_NAME]


@pytest.fixture(scope="module")
def client(shared_client):
    return shared_client


@pytest.fixture(autouse=True)
def _cleanup():
    db = _sync_db()
    db.vibe_drive_sessions.delete_many({"user_id": USER_ID})
    db.vibez_mining_ledger.delete_many({"user_id": USER_ID, "event": "vibe_drive"})
    db.vibez_mining_balance.delete_one({"user_id": USER_ID})
    yield
    db.vibe_drive_sessions.delete_many({"user_id": USER_ID})
    db.vibez_mining_ledger.delete_many({"user_id": USER_ID, "event": "vibe_drive"})
    db.vibez_mining_balance.delete_one({"user_id": USER_ID})


# ==================== HTTP ====================

def test_status_requires_auth(client: TestClient):
    client.cookies.clear()
    res = client.get("/api/vibe-drive/status")
    assert res.status_code == 401


def test_status_gates_when_nothing_connected(client: TestClient):
    res = client.get("/api/vibe-drive/status", headers={"x-user-id": USER_ID})
    assert res.status_code == 200
    body = res.json()
    assert body["car_connected"] is False
    assert body["spotify_connected"] is False
    assert body["awarded_vibez"] == 0.0
    assert body["reason"] == "smartcar_not_connected"


def test_playlists_endpoint(client: TestClient):
    res = client.get("/api/vibe-drive/playlists")
    assert res.status_code == 200
    body = res.json()
    assert isinstance(body["playlists"], list)
    assert body["miles_per_vibez"] > 0
    assert body["daily_cap"] > 0


def test_history_requires_auth(client: TestClient):
    client.cookies.clear()
    res = client.get("/api/vibe-drive/history")
    assert res.status_code == 401


# ==================== CORE LOGIC ====================

@pytest.mark.asyncio
async def test_tick_establishes_baseline_on_first_call():
    from motor.motor_asyncio import AsyncIOMotorClient
    cli = AsyncIOMotorClient(MONGO_URL)
    try:
        db = cli[DB_NAME]
        state = await tick(db, USER_ID, mock={
            "odometer_miles": 10000.0,
            "playback": {"is_playing": True, "track_uri": "spotify:track:x", "playlist_uri": APPROVED_PL},
        })
        assert state["car_connected"] is True
        assert state["spotify_connected"] is True
        assert state["is_playing"] is True
        assert state["approved_playlist"] is True
        assert state["awarded_vibez"] == 0.0
        assert state["reason"] == "first_ping_establishing_baseline"
        assert state["odometer_miles"] == 10000.0
    finally:
        cli.close()


@pytest.mark.asyncio
async def test_tick_awards_after_miles_driven():
    from motor.motor_asyncio import AsyncIOMotorClient
    cli = AsyncIOMotorClient(MONGO_URL)
    try:
        db = cli[DB_NAME]
        # Establish baseline
        await tick(db, USER_ID, mock={
            "odometer_miles": 10000.0,
            "playback": {"is_playing": True, "playlist_uri": APPROVED_PL},
        })
        # Drive 25 miles — should award 2.5 $DSG
        state = await tick(db, USER_ID, mock={
            "odometer_miles": 10025.0,
            "playback": {"is_playing": True, "playlist_uri": APPROVED_PL},
        })
        assert state["reason"] == "awarded"
        assert state["awarded_vibez"] == pytest.approx(2.5, rel=1e-3)
        # Ledger entry written
        ledger = _sync_db().vibez_mining_ledger.find_one({"user_id": USER_ID, "event": "vibe_drive"})
        assert ledger is not None
        assert ledger["status"] == "PENDING_VIBE_CHECK"
        assert ledger["mined"] == pytest.approx(2.5, rel=1e-3)
        # Balance bumped
        bal = _sync_db().vibez_mining_balance.find_one({"user_id": USER_ID})
        assert bal["pending_balance"] == pytest.approx(2.5, rel=1e-3)
    finally:
        cli.close()


@pytest.mark.asyncio
async def test_tick_respects_daily_cap():
    from motor.motor_asyncio import AsyncIOMotorClient
    cli = AsyncIOMotorClient(MONGO_URL)
    try:
        db = cli[DB_NAME]
        # Baseline at 10000
        await tick(db, USER_ID, mock={
            "odometer_miles": 10000.0,
            "playback": {"is_playing": True, "playlist_uri": APPROVED_PL},
        })
        # Drive 100 miles → 10 $DSG raw → clamped to 5 (daily cap)
        state = await tick(db, USER_ID, mock={
            "odometer_miles": 10100.0,
            "playback": {"is_playing": True, "playlist_uri": APPROVED_PL},
        })
        assert state["awarded_vibez"] == pytest.approx(5.0)
        assert state["today_awarded"] == pytest.approx(5.0)
        # Another 50 miles same day → 0 (cap hit)
        state = await tick(db, USER_ID, mock={
            "odometer_miles": 10150.0,
            "playback": {"is_playing": True, "playlist_uri": APPROVED_PL},
        })
        assert state["awarded_vibez"] == 0.0
        assert state["reason"] == "daily_cap_reached"
    finally:
        cli.close()


@pytest.mark.asyncio
async def test_tick_blocks_unapproved_playlist():
    from motor.motor_asyncio import AsyncIOMotorClient
    cli = AsyncIOMotorClient(MONGO_URL)
    try:
        db = cli[DB_NAME]
        await tick(db, USER_ID, mock={
            "odometer_miles": 10000.0,
            "playback": {"is_playing": True, "playlist_uri": "spotify:playlist:not_curated"},
        })
        state = await tick(db, USER_ID, mock={
            "odometer_miles": 10020.0,
            "playback": {"is_playing": True, "playlist_uri": "spotify:playlist:not_curated"},
        })
        # No award possible — playlist not approved
        assert state["awarded_vibez"] == 0.0
        assert state["reason"] == "playlist_not_approved"
    finally:
        cli.close()


@pytest.mark.asyncio
async def test_tick_blocks_when_not_playing():
    from motor.motor_asyncio import AsyncIOMotorClient
    cli = AsyncIOMotorClient(MONGO_URL)
    try:
        db = cli[DB_NAME]
        state = await tick(db, USER_ID, mock={
            "odometer_miles": 10000.0,
            "playback": {"is_playing": False, "playlist_uri": APPROVED_PL},
        })
        assert state["awarded_vibez"] == 0.0
        assert state["reason"] == "nothing_playing"
    finally:
        cli.close()


@pytest.mark.asyncio
async def test_tick_no_new_miles():
    from motor.motor_asyncio import AsyncIOMotorClient
    cli = AsyncIOMotorClient(MONGO_URL)
    try:
        db = cli[DB_NAME]
        await tick(db, USER_ID, mock={
            "odometer_miles": 10000.0,
            "playback": {"is_playing": True, "playlist_uri": APPROVED_PL},
        })
        state = await tick(db, USER_ID, mock={
            "odometer_miles": 10000.0,
            "playback": {"is_playing": True, "playlist_uri": APPROVED_PL},
        })
        assert state["awarded_vibez"] == 0.0
        assert state["reason"] == "no_new_miles"
    finally:
        cli.close()


@pytest.mark.asyncio
async def test_odometer_rollback_is_not_penalized():
    """If odometer somehow goes backward, we treat delta as 0 (no negative award)."""
    from motor.motor_asyncio import AsyncIOMotorClient
    cli = AsyncIOMotorClient(MONGO_URL)
    try:
        db = cli[DB_NAME]
        await tick(db, USER_ID, mock={
            "odometer_miles": 10000.0,
            "playback": {"is_playing": True, "playlist_uri": APPROVED_PL},
        })
        state = await tick(db, USER_ID, mock={
            "odometer_miles": 9999.0,  # reversed
            "playback": {"is_playing": True, "playlist_uri": APPROVED_PL},
        })
        assert state["awarded_vibez"] == 0.0
        assert state["reason"] == "no_new_miles"
    finally:
        cli.close()

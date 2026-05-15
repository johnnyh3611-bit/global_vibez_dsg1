"""Sprint 3 (Jan 2026) — Media Master ecosystem wiring tests.

Covers:
  • DSG TV channel programming + /tv/now-playing (HLS wiring + privacy)
  • AI Scout cf_input_id integration (cf_status semantics)
  • /api/media-master-pulse/snapshot founder dashboard shape
"""
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
    # Fallback to the frontend env which is the canonical public URL
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE = line.split("=", 1)[1].strip()
                break

API = f"{BASE}/api"
MONGO_URL = os.environ.get("MONGO_URL") or "mongodb://localhost:27017"
DB_NAME = os.environ.get("DB_NAME") or "test_database"
# Read from backend/.env if not in test env
if not os.environ.get("DB_NAME"):
    try:
        with open("/app/backend/.env") as _f:
            for _line in _f:
                if _line.startswith("MONGO_URL="):
                    MONGO_URL = _line.split("=", 1)[1].strip().strip('"')
                elif _line.startswith("DB_NAME="):
                    DB_NAME = _line.split("=", 1)[1].strip().strip('"')
    except Exception:
        pass


@pytest.fixture(scope="module")
def db():
    client = AsyncIOMotorClient(MONGO_URL)
    return client[DB_NAME]


# ───────────────────────── DSG TV: /tv/now-playing ──
class TestTvNowPlaying:
    def test_now_playing_arena_offline_when_no_program(self):
        # Ensure clean state — remove any active programs on arena
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient as C
        async def clear():
            d = C(MONGO_URL)[DB_NAME]
            await d.media_tv_channel_programs.delete_many({"channel_id": "arena"})
        asyncio.get_event_loop().run_until_complete(clear())

        r = requests.get(f"{API}/media-master/tv/now-playing/arena", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["channel_id"] == "arena"
        assert data["live"] is False
        assert data["live_input"] is None

    def test_now_playing_unknown_channel_404(self):
        r = requests.get(f"{API}/media-master/tv/now-playing/no-such-channel", timeout=10)
        assert r.status_code == 404


# ───────────────────────── DSG TV: /tv/program ──
class TestTvProgram:
    def test_program_unknown_channel_404(self):
        r = requests.post(f"{API}/media-master/tv/program", json={
            "channel_id": "no-such-channel",
            "input_id": "stub_abc",
            "streamer_id": "TEST_streamer",
        }, timeout=10)
        assert r.status_code == 404

    def test_program_unknown_input_404(self):
        r = requests.post(f"{API}/media-master/tv/program", json={
            "channel_id": "arena",
            "input_id": "no_such_input_12345",
            "streamer_id": "TEST_streamer",
        }, timeout=10)
        assert r.status_code == 404

    def test_program_valid_input_returns_record_with_4h_window(self):
        # Seed a CF live input directly
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient as C
        input_id = f"TEST_input_{uuid.uuid4().hex[:8]}"
        streamer_id = f"TEST_streamer_{uuid.uuid4().hex[:6]}"

        async def seed():
            d = C(MONGO_URL)[DB_NAME]
            await d.cf_live_inputs.insert_one({
                "input_id": input_id,
                "streamer_id": streamer_id,
                "name": "TEST live input",
                "hls_playback_url": f"https://stream.example.com/{input_id}.m3u8",
                "dash_playback_url": None,
                "is_live": False,  # default offline first
                "is_deleted": False,
                "last_status_at": datetime.now(timezone.utc).isoformat(),
            })

        asyncio.get_event_loop().run_until_complete(seed())

        before = datetime.now(timezone.utc)
        r = requests.post(f"{API}/media-master/tv/program", json={
            "channel_id": "arena",
            "input_id": input_id,
            "streamer_id": streamer_id,
            "duration_hours": 4,
        }, timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        prog = body["program"]
        assert prog["channel_id"] == "arena"
        assert prog["input_id"] == input_id
        # programmed_until ~ 4h ahead
        pu = datetime.fromisoformat(prog["programmed_until"].replace("Z", "+00:00"))
        delta = (pu - before).total_seconds()
        assert 3.5 * 3600 < delta < 4.5 * 3600, f"window not ~4h: {delta}s"

        # Privacy: live_input is_live=false → still offline, NO hls
        r2 = requests.get(f"{API}/media-master/tv/now-playing/arena", timeout=10)
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["live"] is False, "PRIVACY VIOLATION: live=true while is_live=false"
        assert d2["live_input"] is None

        # Flip is_live=true and re-check — should now expose hls
        async def flip():
            d = C(MONGO_URL)[DB_NAME]
            await d.cf_live_inputs.update_one(
                {"input_id": input_id}, {"$set": {"is_live": True}},
            )
        asyncio.get_event_loop().run_until_complete(flip())

        r3 = requests.get(f"{API}/media-master/tv/now-playing/arena", timeout=10)
        assert r3.status_code == 200
        d3 = r3.json()
        assert d3["live"] is True
        assert d3["live_input"] is not None
        assert d3["live_input"]["input_id"] == input_id
        assert d3["live_input"]["hls_playback_url"], "hls_playback_url must be exposed"

        # Cleanup
        async def cleanup():
            d = C(MONGO_URL)[DB_NAME]
            await d.cf_live_inputs.delete_one({"input_id": input_id})
            await d.media_tv_channel_programs.delete_many({"input_id": input_id})
        asyncio.get_event_loop().run_until_complete(cleanup())


# ───────────────────────── AI Scout cf_input_id ──
class TestScoutCfInput:
    def test_ingest_with_stub_input_returns_stub_status(self):
        room_id = f"TEST_room_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/media-master/scout/ingest", json={
            "room_id": room_id,
            "gift_volume_coins": 2000.0,
            "chat_messages_per_minute": 80.0,
            "cf_input_id": "stub_xyz_test",
        }, timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["snapshot"]["verdict"] in ("auto_clip", "break_in")
        clip = body["auto_clip"]
        assert clip is not None, "should have minted a clip"
        assert clip["cf_input_id"] == "stub_xyz_test"
        # In preview env, stub_ short-circuits before CF API
        assert clip["cf_status"] in ("stub_input", "cf_not_configured")
        # No real playback URL for stub
        assert clip["playback_url"] is None
        assert clip["cf_clip_uid"] is None

    def test_ingest_without_cf_input_metadata_only(self):
        room_id = f"TEST_room_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/media-master/scout/ingest", json={
            "room_id": room_id,
            "gift_volume_coins": 2000.0,
            "chat_messages_per_minute": 80.0,
        }, timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        clip = body["auto_clip"]
        assert clip is not None
        assert clip["cf_input_id"] is None
        assert clip["cf_clip_uid"] is None
        assert clip["playback_url"] is None
        assert clip["cf_status"] in ("metadata_only", "cf_not_configured")

    def test_ingest_with_real_input_id_cf_configured_handles_unknown_input(self):
        # Use a real-looking (non-stub) input id. CF creds ARE configured
        # in this preview env, so the clipper will actually hit CF API and
        # get either an error response (unknown input) or cf_not_configured
        # depending on env. Either way, cf_status must NOT be 'rendered'
        # for a bogus input, and playback_url must be None.
        room_id = f"TEST_room_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/media-master/scout/ingest", json={
            "room_id": room_id,
            "gift_volume_coins": 2500.0,
            "chat_messages_per_minute": 100.0,
            "cf_input_id": "abcdef1234567890",
        }, timeout=20)
        assert r.status_code == 200, r.text
        clip = r.json()["auto_clip"]
        assert clip is not None
        assert clip["cf_input_id"] == "abcdef1234567890"
        # Bogus input must not produce a successful clip
        assert clip["cf_status"] != "rendered"
        assert clip["playback_url"] is None
        assert clip["cf_clip_uid"] is None


# ───────────────────────── Pulse snapshot ──
class TestPulseSnapshot:
    def test_snapshot_returns_8_keys(self):
        r = requests.get(f"{API}/media-master-pulse/snapshot", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in [
            "generated_at", "hottest_rooms", "station_bid_pools",
            "channel_revenue", "sponsor_leaderboard", "active_break_ins",
            "recent_clips", "totals",
        ]:
            assert k in data, f"missing key: {k}"

    def test_snapshot_channel_revenue_5_rows(self):
        r = requests.get(f"{API}/media-master-pulse/snapshot", timeout=15)
        assert r.status_code == 200
        assert len(r.json()["channel_revenue"]) == 5

    def test_snapshot_station_pools_3_rows(self):
        r = requests.get(f"{API}/media-master-pulse/snapshot", timeout=15)
        assert r.status_code == 200
        assert len(r.json()["station_bid_pools"]) == 3

    def test_snapshot_totals_has_3_integer_keys(self):
        r = requests.get(f"{API}/media-master-pulse/snapshot", timeout=15)
        assert r.status_code == 200
        t = r.json()["totals"]
        for k in ("total_lifetime_channel_coins", "active_sponsorships", "active_break_in_count"):
            assert k in t
            assert isinstance(t[k], int), f"{k} should be int, got {type(t[k])}"

    def test_snapshot_no_mongo_id_leaks(self):
        r = requests.get(f"{API}/media-master-pulse/snapshot", timeout=15)
        body = r.text
        assert '"_id"' not in body, "_id leak found in pulse snapshot"

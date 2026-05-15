"""Media Master ecosystem regression — DSG TV / Vibe Radio / Music Group / AI Scout.
Tests all 19 endpoints across 4 sub-domains per Jan 2026 ship.
"""
from __future__ import annotations

import os
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
import uuid
import pytest
import requests
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Read from frontend .env if missing
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE_URL}/api/media-master"

UID = f"TEST_media_{uuid.uuid4().hex[:8]}"
CHAIR_UID = f"TEST_chair_{uuid.uuid4().hex[:8]}"
ARTIST_UID = f"TEST_artist_{uuid.uuid4().hex[:8]}"
ROOM_AMBIENT = f"TEST_room_ambient_{uuid.uuid4().hex[:6]}"
ROOM_CLIP = f"TEST_room_clip_{uuid.uuid4().hex[:6]}"
ROOM_BREAKIN = f"TEST_room_breakin_{uuid.uuid4().hex[:6]}"


@pytest.fixture(scope="module", autouse=True)
def topup_wallet():
    """Top up the test wallet so debit-coin endpoints don't 402."""
    async def _topup():
        db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ.get("DB_NAME", "global_vibez_dsg")]
        for uid in (UID, CHAIR_UID):
            await db.users.update_one(
                {"user_id": uid},
                {"$set": {"user_id": uid, "credits_balance": 1_000_000, "email": f"{uid}@test.local"}},
                upsert=True,
            )

    async def _cleanup():
        db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ.get("DB_NAME", "global_vibez_dsg")]
        for col in ("media_tv_passes", "media_tv_pins", "media_radio_skip_bids",
                    "media_radio_purchases", "media_studio_bookings",
                    "media_artist_sponsorships", "media_scout_hype",
                    "media_scout_clips", "media_scout_alerts"):
            await db[col].delete_many({"user_id": {"$in": [UID, CHAIR_UID]}})
        await db.users.delete_many({"user_id": {"$in": [UID, CHAIR_UID]}})

    asyncio.new_event_loop().run_until_complete(_topup())
    yield
    try:
        asyncio.new_event_loop().run_until_complete(_cleanup())
    except Exception:
        pass


# ─────────── CONSTANTS ───────────
def test_constants_returns_all():
    r = requests.get(f"{API}/constants")
    assert r.status_code == 200
    d = r.json()
    assert len(d["dsg_tv_channels"]) == 5
    assert len(d["vibe_radio_stations"]) == 3
    assert len(d["dsg_music_studios"]) == 3
    assert d["skip_bid_floor"] == 25
    assert d["keep_bid_increment"] == 10
    assert d["affiliate_chair_share_bps"] == 3000
    assert d["auto_clip_threshold"] == 1000
    assert d["break_in_threshold"] == 10000


# ─────────── DSG TV ───────────
def test_tv_channels():
    r = requests.get(f"{API}/tv/channels")
    assert r.status_code == 200
    chs = r.json()["channels"]
    assert len(chs) == 5
    gated = [c for c in chs if c["requires_paywall"]]
    assert len(gated) == 2
    ids = {c["channel_id"] for c in gated}
    assert ids == {"after-dark", "nightmare-club"}


def test_tv_access_arena_free():
    r = requests.get(f"{API}/tv/access/arena/{UID}")
    assert r.status_code == 200
    d = r.json()
    assert d["access"] is True
    assert d["reason"] == "free_channel"


def test_tv_access_after_dark_locked():
    r = requests.get(f"{API}/tv/access/after-dark/{UID}")
    assert r.status_code == 200
    d = r.json()
    assert d["access"] is False
    assert d["coin_price"] == 500
    assert d["requires_18_plus"] is True


def test_tv_set_pin():
    r = requests.post(f"{API}/tv/set-pin", json={"user_id": UID, "pin": "1234"})
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_tv_unlock_after_dark_age_gate_403():
    """SAFETY: 21+ gate must fire when no age verification on file."""
    r = requests.post(f"{API}/tv/unlock/after-dark",
                      json={"user_id": UID, "secondary_pin": "1234"})
    assert r.status_code == 403
    detail = r.json().get("detail", {})
    if isinstance(detail, dict):
        assert detail.get("code") == "age_verification_required"
    else:
        assert "age" in str(detail).lower()


def test_tv_unlock_arena_400():
    r = requests.post(f"{API}/tv/unlock/arena", json={"user_id": UID})
    assert r.status_code == 400


# ─────────── VIBE RADIO ───────────
def test_radio_stations():
    r = requests.get(f"{API}/radio/stations")
    assert r.status_code == 200
    assert r.json()["count"] == 3


def test_radio_now_playing():
    r = requests.get(f"{API}/radio/now-playing/the-grind")
    assert r.status_code == 200
    d = r.json()
    assert "now_playing" in d
    assert d["skip_bid"] is None


def test_skip_bid_below_floor_400():
    r = requests.post(f"{API}/radio/skip-bid",
                      json={"user_id": UID, "station_id": "the-grind", "amount": 10})
    assert r.status_code == 400
    detail = r.json().get("detail", {})
    if isinstance(detail, dict):
        assert detail.get("code") == "below_skip_floor"


def test_skip_bid_success():
    r = requests.post(f"{API}/radio/skip-bid",
                      json={"user_id": UID, "station_id": "the-grind", "amount": 50})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["ok"] is True
    assert d["skip_pool"] >= 50


def test_keep_bid_below_threshold():
    r = requests.post(f"{API}/radio/keep-bid",
                      json={"user_id": UID, "station_id": "the-grind", "amount": 1})
    assert r.status_code == 400
    detail = r.json().get("detail", {})
    if isinstance(detail, dict):
        assert detail.get("code") == "below_keep_threshold"


def test_buy_track():
    r = requests.post(f"{API}/radio/buy-track",
                      json={"user_id": UID, "track_id": "trk_test_1", "price_coins": 100})
    assert r.status_code == 200, r.text
    assert "receipt" in r.json()


# ─────────── MUSIC GROUP ───────────
def test_music_studios_rates():
    r = requests.get(f"{API}/music/studios")
    assert r.status_code == 200
    studios = r.json()["studios"]
    rates = {s["studio_id"]: s["hourly_rate_coins"] for s in studios}
    assert rates["casino-vault"] == 2000
    assert rates["glasshouse-mirror"] == 3000
    assert rates["rooftop-aurora"] == 5000


def test_book_studio():
    r = requests.post(f"{API}/music/book-studio",
                      json={"user_id": UID, "studio_id": "casino-vault", "hours": 2})
    assert r.status_code == 200, r.text
    booking = r.json()["booking"]
    assert booking["total_coins"] == 4000


def test_artists_list():
    r = requests.get(f"{API}/music/artists")
    assert r.status_code == 200
    assert "artists" in r.json()


def test_sponsor_idempotent():
    r1 = requests.post(f"{API}/music/sponsor",
                       json={"chair_user_id": CHAIR_UID, "artist_id": ARTIST_UID})
    assert r1.status_code == 200, r1.text
    assert r1.json()["idempotent"] is False

    r2 = requests.post(f"{API}/music/sponsor",
                       json={"chair_user_id": CHAIR_UID, "artist_id": ARTIST_UID})
    assert r2.status_code == 200
    assert r2.json()["idempotent"] is True


def test_sponsorships_list():
    r = requests.get(f"{API}/music/sponsorships/{CHAIR_UID}")
    assert r.status_code == 200
    assert r.json()["count"] >= 1


# ─────────── AI SCOUT ───────────
def test_scout_ambient():
    r = requests.post(f"{API}/scout/ingest", json={
        "room_id": ROOM_AMBIENT,
        "gift_volume_coins": 100,
        "chat_messages_per_minute": 5,
    })
    assert r.status_code == 200
    d = r.json()
    assert d["snapshot"]["verdict"] == "ambient"
    assert d["auto_clip"] is None
    assert d["break_in_alert"] is None


def test_scout_auto_clip():
    r = requests.post(f"{API}/scout/ingest", json={
        "room_id": ROOM_CLIP,
        "gift_volume_coins": 1500,
        "chat_messages_per_minute": 50,
    })
    assert r.status_code == 200
    d = r.json()
    assert d["snapshot"]["verdict"] == "auto_clip"
    assert d["auto_clip"] is not None
    assert d["auto_clip"]["duration_seconds"] == 30
    assert d["break_in_alert"] is None


def test_scout_break_in():
    r = requests.post(f"{API}/scout/ingest", json={
        "room_id": ROOM_BREAKIN,
        "gift_volume_coins": 12000,
        "chat_messages_per_minute": 500,
    })
    assert r.status_code == 200
    d = r.json()
    assert d["snapshot"]["verdict"] == "break_in"
    assert d["auto_clip"] is not None
    assert d["break_in_alert"] is not None


def test_scout_recent_clips():
    r = requests.get(f"{API}/scout/clips/recent")
    assert r.status_code == 200
    assert r.json()["count"] >= 1


def test_scout_active_break_ins():
    r = requests.get(f"{API}/scout/break-ins/active")
    assert r.status_code == 200
    assert r.json()["count"] >= 1

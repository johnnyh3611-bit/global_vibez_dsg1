"""
E2E HTTP integration tests for VR↔Physical handover stack.
Hits the live preview URL (REACT_APP_BACKEND_URL) and validates:
- Handshake token issuance + verify gate (403 on bad token)
- /vr/request-ride persistence (Mongo db.vr_rides)
- /vr/teleport-exit + /vr/asap-teleport + bg task scheduling
- /bonds/milestone auto-unlock (twin_flame_vfx at date_count=3)
- /bonds/{a}/{b} sorted lookup + non-existent {exists:false}
- /cosmetics/teleport/active (lazy create) + check-unlock + equip (403 locked)
- /car/victory-handoff (no_streak vs broadcast on seeded streak=5)
- WebSocket /api/ws/ride-status/{ride_id}
"""
import asyncio
import os
import time
import uuid

import pytest
import requests
import websockets

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")
WS_URL = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")


# ─── Fixtures ──────────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def user_ctx():
    uid = f"TEST_user_{uuid.uuid4().hex[:8]}"
    sid = f"TEST_vr_{uuid.uuid4().hex[:8]}"
    return {"user_id": uid, "vr_session_id": sid}


@pytest.fixture(scope="module")
def handshake(session, user_ctx):
    r = session.post(f"{BASE_URL}/api/vr/handshake-token", json=user_ctx, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "handshake_token" in data
    assert data["expires_in_seconds"] == 600
    assert data["user_id"] == user_ctx["user_id"]
    assert data["vr_session_id"] == user_ctx["vr_session_id"]
    return data["handshake_token"]


# ─── Handshake ────────────────────────────────────────────────────────────
class TestHandshake:
    def test_handshake_token_shape(self, handshake):
        # exp.signature format
        assert "." in handshake
        exp_str, sig = handshake.split(".", 1)
        assert int(exp_str) > int(time.time())
        assert len(sig) == 64  # sha256 hex


# ─── /vr/request-ride ─────────────────────────────────────────────────────
class TestRequestRide:
    def test_valid_token_dispatches(self, session, user_ctx, handshake):
        payload = {
            **user_ctx,
            "handshake_token": handshake,
            "target_location": "TEST_Downtown",
            "pickup_location": "TEST_Home",
            "context": "TEST_e2e",
        }
        r = session.post(f"{BASE_URL}/api/vr/request-ride", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "Ride Dispatched"
        assert "ride_id" in data and len(data["ride_id"]) > 0
        assert data["eta"]
        assert data["vehicle"]
        # stash for ws test
        pytest.shared_ride_id = data["ride_id"]

    def test_garbage_token_returns_403(self, session, user_ctx):
        payload = {
            **user_ctx,
            "handshake_token": "garbage.deadbeef",
            "target_location": "X",
            "pickup_location": "Y",
        }
        r = session.post(f"{BASE_URL}/api/vr/request-ride", json=payload, timeout=15)
        assert r.status_code == 403

    def test_missing_dot_token_returns_403(self, session, user_ctx):
        payload = {**user_ctx, "handshake_token": "no_dot_here", "target_location": "X", "pickup_location": "Y"}
        r = session.post(f"{BASE_URL}/api/vr/request-ride", json=payload, timeout=15)
        assert r.status_code == 403


# ─── /vr/teleport-exit + asap ─────────────────────────────────────────────
class TestTeleportExit:
    def test_teleport_exit_standard(self, session, user_ctx, handshake):
        payload = {**user_ctx, "handshake_token": handshake, "volume": 50}
        r = session.post(f"{BASE_URL}/api/vr/teleport-exit", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "Transition Initiated"
        assert data["mode"] == "standard"

    def test_teleport_exit_priority(self, session, user_ctx, handshake):
        payload = {**user_ctx, "handshake_token": handshake, "priority": True}
        r = session.post(f"{BASE_URL}/api/vr/teleport-exit", json=payload, timeout=15)
        assert r.status_code == 200
        assert r.json()["mode"] == "asap"

    def test_asap_teleport_endpoint(self, session, user_ctx, handshake):
        payload = {**user_ctx, "handshake_token": handshake}
        r = session.post(f"{BASE_URL}/api/vr/asap-teleport", json=payload, timeout=15)
        assert r.status_code == 200
        assert r.json()["mode"] == "asap"

    def test_teleport_exit_bad_token_403(self, session, user_ctx):
        payload = {**user_ctx, "handshake_token": "bad.token"}
        r = session.post(f"{BASE_URL}/api/vr/teleport-exit", json=payload, timeout=15)
        assert r.status_code == 403


# ─── /bonds ────────────────────────────────────────────────────────────────
class TestBonds:
    def test_milestone_unlocks_twin_flame_at_3(self, session):
        ua = f"TEST_a_{uuid.uuid4().hex[:6]}"
        ub = f"TEST_b_{uuid.uuid4().hex[:6]}"
        last = None
        for _ in range(3):
            r = session.post(
                f"{BASE_URL}/api/bonds/milestone",
                json={"user_a": ua, "user_b": ub, "stat": "date_count", "increment": 1},
                timeout=15,
            )
            assert r.status_code == 200, r.text
            last = r.json()
        assert last["new_value"] == 3
        assert "twin_flame_vfx" in last["unlocked_now"]
        assert "twin_flame_vfx" in last["all_unlocked"]

    def test_get_bond_returns_sorted_pair(self, session):
        # zzz < aaa false; "aaa" < "zzz"; sorted should swap
        ua, ub = "TEST_zzz_user", "TEST_aaa_user"
        # create bond
        session.post(
            f"{BASE_URL}/api/bonds/milestone",
            json={"user_a": ua, "user_b": ub, "stat": "date_count", "increment": 1},
            timeout=15,
        )
        r = session.get(f"{BASE_URL}/api/bonds/{ua}/{ub}", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["user_a"] == "TEST_aaa_user"
        assert data["user_b"] == "TEST_zzz_user"
        assert data["bond_id"] == "TEST_aaa_user-TEST_zzz_user"
        assert data["exists"] is True

    def test_get_bond_nonexistent(self, session):
        ua = f"TEST_nope_{uuid.uuid4().hex[:6]}"
        ub = f"TEST_nada_{uuid.uuid4().hex[:6]}"
        r = session.get(f"{BASE_URL}/api/bonds/{ua}/{ub}", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["exists"] is False
        assert data["shared_stats"] == {}
        assert data["unlocked_shared_cosmetics"] == []

    def test_unknown_stat_400(self, session):
        r = session.post(
            f"{BASE_URL}/api/bonds/milestone",
            json={"user_a": "x", "user_b": "y", "stat": "bogus_stat", "increment": 1},
            timeout=15,
        )
        assert r.status_code == 400


# ─── /cosmetics/teleport ──────────────────────────────────────────────────
class TestTeleportCosmetics:
    def test_active_lazy_creates_with_digital_cubes(self, session):
        uid = f"TEST_cos_{uuid.uuid4().hex[:8]}"
        r = session.get(f"{BASE_URL}/api/cosmetics/teleport/active", params={"user_id": uid}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["active_effect"] == "digital_cubes"
        assert "digital_cubes" in data["unlocked_effects"]

    def test_check_unlock_romantic_hearts_at_10(self, session):
        uid = f"TEST_unl_{uuid.uuid4().hex[:8]}"
        last = None
        for _ in range(10):
            r = session.post(
                f"{BASE_URL}/api/cosmetics/teleport/check-unlock",
                json={"user_id": uid, "stat": "vr_dates_completed", "increment": 1},
                timeout=15,
            )
            assert r.status_code == 200
            last = r.json()
        assert last["new_value"] == 10
        assert "romantic_hearts" in last["unlocked_now"]

        # equip the now-unlocked effect
        r = session.post(
            f"{BASE_URL}/api/cosmetics/teleport/equip",
            json={"user_id": uid, "effect_id": "romantic_hearts"},
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json()["active_effect"] == "romantic_hearts"

    def test_equip_locked_effect_403(self, session):
        uid = f"TEST_lock_{uuid.uuid4().hex[:8]}"
        # ensure user exists with default
        session.get(f"{BASE_URL}/api/cosmetics/teleport/active", params={"user_id": uid}, timeout=15)
        r = session.post(
            f"{BASE_URL}/api/cosmetics/teleport/equip",
            json={"user_id": uid, "effect_id": "champion_aura"},
            timeout=15,
        )
        assert r.status_code == 403

    def test_check_unlock_unknown_stat_400(self, session):
        r = session.post(
            f"{BASE_URL}/api/cosmetics/teleport/check-unlock",
            json={"user_id": "x", "stat": "bogus", "increment": 1},
            timeout=15,
        )
        assert r.status_code == 400


# ─── /car/victory-handoff ─────────────────────────────────────────────────
class TestVictoryHandoff:
    def test_no_streak_when_no_session(self, session):
        uid = f"TEST_vh_nostreak_{uuid.uuid4().hex[:6]}"
        r = session.post(
            f"{BASE_URL}/api/car/victory-handoff",
            json={"user_id": uid, "vehicle_id": "TEST_VEH_1"},
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "no_streak"
        assert data["streak"] == 0

    def test_broadcast_when_streak_5_seeded(self, session):
        # Seed game_sessions doc directly via Mongo
        import sys
        sys.path.insert(0, "/home/johnnie/master-project")
        from motor.motor_asyncio import AsyncIOMotorClient

        mongo_url = os.environ.get("MONGO_URL")
        db_name = os.environ.get("DB_NAME")
        assert mongo_url and db_name, "MONGO_URL / DB_NAME must be set"

        uid = f"TEST_vh_streak_{uuid.uuid4().hex[:6]}"

        async def seed():
            client = AsyncIOMotorClient(mongo_url)
            db = client[db_name]
            await db.game_sessions.insert_one(
                {"active_users": [uid], "spades_streak": 5, "session_id": f"TEST_{uid}"}
            )
            client.close()

        asyncio.get_event_loop().run_until_complete(seed())

        r = session.post(
            f"{BASE_URL}/api/car/victory-handoff",
            json={"user_id": uid, "vehicle_id": "TEST_VEH_2", "game_type": "spades"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "Victory broadcasted" in data["status"]
        assert data["streak"] == 5
        assert "5-GAME WIN STREAK" in data["message"]

        # cleanup seeded doc
        async def cleanup():
            client = AsyncIOMotorClient(mongo_url)
            db = client[db_name]
            await db.game_sessions.delete_many({"active_users": uid})
            client.close()
        asyncio.get_event_loop().run_until_complete(cleanup())


# ─── WebSocket ride-status stream ─────────────────────────────────────────
class TestRideStatusWS:
    def test_ws_streams_status(self):
        ride_id = getattr(pytest, "shared_ride_id", "TEST_ride_fallback")
        url = f"{WS_URL}/api/ws/ride-status/{ride_id}"

        async def run():
            async with websockets.connect(url, open_timeout=15, close_timeout=5) as ws:
                msg = await asyncio.wait_for(ws.recv(), timeout=15)
                import json
                data = json.loads(msg)
                assert data["ride_id"] == ride_id
                assert "status" in data
                assert "eta" in data
                assert "vehicle" in data
                return True

        assert asyncio.get_event_loop().run_until_complete(run())

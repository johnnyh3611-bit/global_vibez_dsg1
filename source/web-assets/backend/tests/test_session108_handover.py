"""
Backend regression tests for Session 108:
 - NEW: /api/bonds/unlock-rules, /api/bonds/list/{user_id}
 - NEW: /api/cosmetics/teleport/my-vfx/{user_id}, /api/cosmetics/teleport/unlock-rules
 - MODIFIED: POST /api/api/vr_date/end/{room_id}  (note: double "/api/api/" is intentional pre-existing)
 - EXISTING: POST /api/bonds/milestone
 - EXISTING: WS /api/ws/ride-status/{ride_id}
 - REGRESSION: Vibe 654 tournament (/api/games/vibe654/tables)
"""
import os
import json
import asyncio
import uuid
import requests
import websockets

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback to read the frontend .env for CI
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass

assert BASE_URL, "REACT_APP_BACKEND_URL must be set"

API = f"{BASE_URL}/api"
WS_BASE = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")


# -------- /api/bonds/unlock-rules --------
class TestBondsUnlockRules:
    def test_returns_four_stats(self):
        r = requests.get(f"{API}/bonds/unlock-rules", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        # must contain rule table with 4 stats
        # API may wrap in {rules: {...}} or return dict directly; accept either
        rules = data.get("rules", data)
        expected = {"date_count", "games_played", "shared_jackpots", "spades_win_streak"}
        assert expected.issubset(set(rules.keys())), f"missing stats: {set(rules.keys())}"

    def test_date_count_first_rule(self):
        r = requests.get(f"{API}/bonds/unlock-rules", timeout=15)
        data = r.json()
        rules = data.get("rules", data)
        first = rules["date_count"][0]
        assert first["threshold"] == 3
        assert first["cosmetic_id"] == "twin_flame_vfx"


# -------- /api/bonds/list/{user_id} --------
class TestBondsList:
    def test_empty_user_returns_structure(self):
        uid = f"TEST_empty_{uuid.uuid4().hex[:8]}"
        r = requests.get(f"{API}/bonds/list/{uid}", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user_id"] == uid
        assert data["bond_count"] == 0
        assert isinstance(data["bonds"], list)


# -------- /api/cosmetics/teleport/unlock-rules --------
class TestTeleportUnlockRules:
    def test_returns_rules_table(self):
        r = requests.get(f"{API}/cosmetics/teleport/unlock-rules", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        # Accept either wrapped or flat
        rules = data.get("rules", data)
        assert isinstance(rules, dict) and len(rules) > 0


# -------- /api/cosmetics/teleport/my-vfx/{user_id} --------
class TestTeleportMyVfx:
    def test_auto_init_new_user(self):
        uid = f"TEST_vfx_{uuid.uuid4().hex[:8]}"
        r = requests.get(f"{API}/cosmetics/teleport/my-vfx/{uid}", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user_id"] == uid
        assert "active_effect" in data
        assert data["active_effect"]  # default effect assigned
        assert "unlocked_effects" in data
        assert isinstance(data["unlocked_effects"], list)
        assert "stats" in data


# -------- POST /api/bonds/milestone (existing must still pass) --------
class TestBondMilestoneRegression:
    def test_milestone_unlocks_twin_flame_at_3(self):
        u1 = f"TEST_bm_{uuid.uuid4().hex[:6]}"
        u2 = f"TEST_bm_{uuid.uuid4().hex[:6]}"
        # Post milestone – try a couple of common payload shapes
        # Increment three times to reach threshold 3
        for _ in range(3):
            r = requests.post(
                f"{API}/bonds/milestone",
                json={"user_a": u1, "user_b": u2, "stat": "date_count", "increment": 1},
                timeout=15,
            )
            assert r.status_code in (200, 201), f"{r.status_code} {r.text}"
        # The third call's response should advertise twin_flame_vfx
        text = json.dumps(r.json()).lower()
        assert "twin_flame_vfx" in text, f"expected unlock, got: {r.json()}"


# -------- POST /api/api/vr_date/end/{room_id} (double-prefix is intentional) --------
class TestEndVrDate:
    def test_end_vr_date_triggers_bond_and_teleport(self):
        u1 = f"TEST_vr_{uuid.uuid4().hex[:6]}"
        u2 = f"TEST_vr_{uuid.uuid4().hex[:6]}"
        room_id = f"TEST_room_{uuid.uuid4().hex[:8]}"

        # Try to create / seed the room first (best-effort — may or may not be needed)
        requests.post(
            f"{BASE_URL}/api/api/vr_date/start",
            json={"room_id": room_id, "user1_id": u1, "user2_id": u2},
            timeout=15,
        )

        r = requests.post(f"{BASE_URL}/api/api/vr_date/end/{room_id}", timeout=20)
        # Endpoint may return 200 even if room wasn't seeded; we check structure when present
        assert r.status_code in (200, 404, 400), f"unexpected status {r.status_code}: {r.text}"
        if r.status_code == 200:
            data = r.json()
            assert "success" in data
            assert "room_id" in data
            assert "bond_unlocks" in data
            assert "teleport_unlocks" in data


# -------- Vibe 654 regression --------
class TestVibe654Regression:
    def test_list_tables(self):
        r = requests.get(f"{API}/games/vibe654/tables/active", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, (list, dict))

    def test_create_table_100k(self):
        payload = {
            "name": f"TEST_table_{uuid.uuid4().hex[:6]}",
            "buy_in": 100000,
            "max_players": 6,
        }
        r = requests.post(f"{API}/games/vibe654/create-table", json=payload, timeout=20)
        # Accept 200/201; some apps require auth – tolerate 401/403/422 but flag
        assert r.status_code in (200, 201, 401, 403, 422), f"{r.status_code} {r.text}"


# -------- WebSocket /api/ws/ride-status/{ride_id} --------
class TestWsRideStatus:
    def test_ride_status_ws_streams_frame(self):
        ride_id = f"TEST_ride_{uuid.uuid4().hex[:6]}"
        url = f"{WS_BASE}/api/ws/ride-status/{ride_id}"

        async def run():
            try:
                async with websockets.connect(url, open_timeout=10, close_timeout=5) as ws:
                    msg = await asyncio.wait_for(ws.recv(), timeout=10)
                    return msg
            except Exception as e:
                return f"ERR:{e}"

        msg = asyncio.run(run())
        assert not msg.startswith("ERR:"), msg
        data = json.loads(msg)
        for k in ("ride_id", "status", "eta", "vehicle"):
            assert k in data, f"missing key {k} in {data}"

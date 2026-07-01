"""
Backend regression tests for the Jan-2026 Global Vibez DSG iteration — part 2.

Covers (per review_request, this iteration):
  1. Driver onboarding GET /api/vibe-ridez/driver/me (401 / null / row)
  2. Driver state persistence across backend restart (escrow survives)
  3. Hydrate idempotence after a 2nd restart (no double-credit)
  4. Solana indexer admin status endpoint
  5. Solana indexer manual-credit happy path + 2nd-call 404 + unknown-id 404
  6. /ridez/complete still requires auth for non-anon-prefixed rider_ids
"""
import os
import time
import uuid
import subprocess

import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://social-connect-953.preview.emergentagent.com",
).rstrip("/")


# ──────────────────────────── shared fixtures ──

@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth_session(api):
    r = api.post(f"{BASE_URL}/api/auth/demo-login", timeout=20)
    if r.status_code != 200:
        pytest.skip(f"demo-login failed ({r.status_code}): {r.text[:200]}")
    data = r.json()
    token = data.get("token")
    user_id = data.get("user_id")
    assert token and user_id
    bearer = requests.Session()
    bearer.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    })
    return {
        "bearer_session": bearer,
        "cookie_session": api,  # api session retained the session_token cookie
        "token": token,
        "user_id": user_id,
    }


def _restart_backend_and_wait(wait_s: int = 9) -> None:
    """Restart backend via supervisor and wait for /api/health to come back."""
    subprocess.run(["sudo", "supervisorctl", "restart", "backend"], check=False)
    time.sleep(wait_s)
    # Wait for the API to respond before continuing.
    for _ in range(20):
        try:
            r = requests.get(f"{BASE_URL}/api/", timeout=5)
            if r.status_code in (200, 404):
                return
        except requests.RequestException:
            pass
        time.sleep(1)


# ──────────────────────────── 1. Driver onboarding /driver/me ──

class TestDriverMeOnboarding:
    def test_unauthed_returns_401(self):
        r = requests.get(f"{BASE_URL}/api/vibe-ridez/driver/me", timeout=10)
        assert r.status_code == 401, r.text

    def test_authed_no_registration_returns_null(self, auth_session):
        """If the demo user happens to already have a driver row (state leak from
        prior runs), delete it first via mongo so the contract `driver: null`
        can be cleanly verified."""
        import os as _os
        from pymongo import MongoClient
        mongo = MongoClient(_os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db = mongo[_os.environ.get("DB_NAME", "test_database")]
        db.vibe_ridez_drivers.delete_many({"user_id": auth_session["user_id"]})
        mongo.close()

        r = auth_session["cookie_session"].get(
            f"{BASE_URL}/api/vibe-ridez/driver/me", timeout=10
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "driver" in body
        # Demo user has no driver registration row → null.
        assert body["driver"] is None, body

    def test_authed_driver_registered_returns_row(self, api, auth_session):
        cookie = auth_session["cookie_session"]
        # Try to register; if already registered (400) we still expect a row.
        reg_payload = {
            "phone_number": "+15555550100",
            "license_number": f"TEST_LIC_{uuid.uuid4().hex[:6]}",
            "vehicle": {
                "make": "Tesla",
                "model": "Model 3",
                "year": 2023,
                "color": "White",
                "plate_number": f"TEST-{uuid.uuid4().hex[:4]}",
                "seats": 4,
            },
            "bio": "TEST_driver bio",
        }
        r = cookie.post(
            f"{BASE_URL}/api/vibe-ridez/driver/register",
            json=reg_payload,
            timeout=15,
        )
        assert r.status_code in (200, 400), r.text  # 400 if already registered

        r = cookie.get(f"{BASE_URL}/api/vibe-ridez/driver/me", timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["driver"], body
        drv = body["driver"]
        assert "license_verified" in drv
        assert isinstance(drv["license_verified"], bool)
        assert drv["user_id"] == auth_session["user_id"]


# ──────────────────────────── 2. Driver state persistence across restart ──

class TestDriverStatePersistence:
    def test_escrow_survives_restart_and_complete_releases(self, api):
        driver_id = f"TEST_drv_persist_{uuid.uuid4().hex[:6]}"
        seed = uuid.uuid4().int % 1000
        rider_lat = 12.0 + seed * 0.01
        rider_lon = 22.0 + seed * 0.01
        drv_lat = rider_lat + 0.0003
        drv_lon = rider_lon + 0.0003

        # 1. Register driver
        r = api.post(
            f"{BASE_URL}/api/ridez/status",
            json={
                "driver_id": driver_id, "status": "AVAILABLE", "type": "virtual",
                "lat": drv_lat, "lon": drv_lon,
            },
            timeout=10,
        )
        assert r.status_code == 200, r.text

        # 2. Match a ride → BUSY + pending_earned=R + active_ride_id set
        reward = 88
        rider_id = f"TEST_rider_{uuid.uuid4().hex[:6]}"
        r = api.post(
            f"{BASE_URL}/api/ridez/request",
            json={
                "rider_id": rider_id,
                "rider_lat": rider_lat, "rider_lon": rider_lon,
                "ride_type": "virtual", "reward": reward,
                "max_radius_km": 5.0, "timeout_per_driver": 5.0,
            },
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "MATCHED", body
        assert body["driver_id"] == driver_id
        ride_id = body["ride_id"]

        # earnings shows pending_earned=R pre-restart
        r = api.get(f"{BASE_URL}/api/ridez/earnings/{driver_id}", timeout=10)
        pre = r.json()
        assert int(pre["pending_earned"]) == reward, pre
        daily_pre = int(pre.get("daily_earned", 0))
        total_pre = int(pre.get("total_earned", 0))

        # 3. RESTART backend
        _restart_backend_and_wait(9)

        # 4. earnings still shows pending_earned=R (survived restart)
        r = requests.get(f"{BASE_URL}/api/ridez/earnings/{driver_id}", timeout=15)
        assert r.status_code == 200, r.text
        post = r.json()
        assert int(post["pending_earned"]) == reward, post
        assert int(post.get("daily_earned", 0)) == daily_pre, post
        assert int(post.get("total_earned", 0)) == total_pre, post

        # Driver appears in /active-drivers as OFFLINE (no live websocket / status post yet)
        r = requests.get(f"{BASE_URL}/api/ridez/active-drivers", timeout=10)
        assert r.status_code == 200
        drivers = {d["driver_id"]: d for d in r.json()["drivers"]}
        assert driver_id in drivers, f"{driver_id} not in active-drivers after restart"
        assert drivers[driver_id]["status"] == "OFFLINE", drivers[driver_id]

        # 5. Complete the ride → credits R, pending=0
        r = requests.post(
            f"{BASE_URL}/api/ridez/complete",
            json={"ride_id": ride_id, "rated": 5},
            timeout=10,
        )
        assert r.status_code == 200, r.text
        comp = r.json()
        assert comp["credited"] == reward, comp
        assert comp["pending_earned"] == 0, comp
        assert comp["daily_earned"] == daily_pre + reward, comp
        assert comp["total_earned"] == total_pre + reward, comp

        # Stash for next test (idempotence after 2nd restart)
        TestDriverStatePersistence._post_complete_state = {
            "driver_id": driver_id,
            "ride_id": ride_id,
            "expected_pending": 0,
            "expected_daily": daily_pre + reward,
            "expected_total": total_pre + reward,
        }

    def test_hydrate_idempotence_after_second_restart(self):
        """A 2nd restart must not double-credit and must keep pending_earned at the released level."""
        st = getattr(TestDriverStatePersistence, "_post_complete_state", None)
        if not st:
            pytest.skip("first persistence test did not run / set state")

        _restart_backend_and_wait(9)

        r = requests.get(
            f"{BASE_URL}/api/ridez/earnings/{st['driver_id']}", timeout=15
        )
        assert r.status_code == 200, r.text
        post = r.json()
        assert int(post["pending_earned"]) == st["expected_pending"], post
        assert int(post["daily_earned"]) == st["expected_daily"], post
        assert int(post["total_earned"]) == st["expected_total"], post


# ──────────────────────────── 3. Solana indexer admin endpoints ──

class TestSolanaIndexerAdmin:
    def test_status_returns_payload(self, api):
        r = api.get(f"{BASE_URL}/api/admin/solana-indexer/status", timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "treasury_wallet" in body
        assert "rpc_configured" in body
        # Per env note: HELIUS_RPC_URL not set → rpc_configured=False
        assert body["rpc_configured"] is False, body
        assert "poll_interval_s" in body
        assert isinstance(body["poll_interval_s"], int)
        assert "last_signature" in body
        assert "pending_deposits" in body
        assert "confirmed_deposits" in body
        assert isinstance(body["pending_deposits"], int)
        assert isinstance(body["confirmed_deposits"], int)

    def test_manual_credit_unknown_returns_404(self, api):
        r = api.post(
            f"{BASE_URL}/api/admin/solana-indexer/manual-credit/TEST_unknown_{uuid.uuid4().hex}",
            timeout=10,
        )
        assert r.status_code == 404, r.text

    def test_manual_credit_happy_path_then_404_on_repeat(self, api):
        user_id = f"TEST_user_{uuid.uuid4().hex[:8]}"
        # Create SOL deposit
        r = api.post(
            f"{BASE_URL}/api/crypto-payments/create-deposit",
            json={
                "user_id": user_id,
                "cryptocurrency": "SOL",
                "amount_usd": 7.5,
            },
            timeout=15,
        )
        assert r.status_code == 200, r.text
        deposit = r.json()["deposit"]
        deposit_id = deposit["deposit_id"]
        assert deposit["status"] == "pending", deposit

        # Manual-credit → 200 credited:true
        r = api.post(
            f"{BASE_URL}/api/admin/solana-indexer/manual-credit/{deposit_id}",
            timeout=10,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["credited"] is True, body
        assert body["deposit_id"] == deposit_id

        # 2nd call → 404 (no longer pending)
        r = api.post(
            f"{BASE_URL}/api/admin/solana-indexer/manual-credit/{deposit_id}",
            timeout=10,
        )
        assert r.status_code == 404, r.text


# ──────────────────────────── 4. /ridez/complete auth gate (regression) ──

class TestCompleteAuthGate:
    """Non-anon-prefixed rider_id should require auth on /ridez/complete."""

    def test_complete_without_auth_for_real_rider_id_returns_403(self, api):
        # Need a real ride first (rider_id must NOT start with 'anon_'/'TEST_anon_')
        driver_id = f"TEST_drv_auth_{uuid.uuid4().hex[:6]}"
        seed = uuid.uuid4().int % 1000
        rider_lat = 70.0 + seed * 0.01
        rider_lon = 80.0 + seed * 0.01
        drv_lat = rider_lat + 0.0003
        drv_lon = rider_lon + 0.0003

        r = api.post(
            f"{BASE_URL}/api/ridez/status",
            json={
                "driver_id": driver_id, "status": "AVAILABLE", "type": "virtual",
                "lat": drv_lat, "lon": drv_lon,
            },
            timeout=10,
        )
        assert r.status_code == 200

        rider_id = f"realuser_{uuid.uuid4().hex[:8]}"  # NOT anon_
        r = api.post(
            f"{BASE_URL}/api/ridez/request",
            json={
                "rider_id": rider_id,
                "rider_lat": rider_lat, "rider_lon": rider_lon,
                "ride_type": "virtual", "reward": 20,
                "max_radius_km": 5.0, "timeout_per_driver": 5.0,
            },
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        if body.get("status") != "MATCHED":
            pytest.skip(f"could not match driver: {body}")
        ride_id = body["ride_id"]

        # Complete without auth (fresh requests, no cookies/headers)
        r = requests.post(
            f"{BASE_URL}/api/ridez/complete",
            json={"ride_id": ride_id},
            timeout=10,
        )
        assert r.status_code == 403, r.text

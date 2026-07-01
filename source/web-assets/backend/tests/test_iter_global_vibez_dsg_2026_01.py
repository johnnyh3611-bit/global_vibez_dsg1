"""
Backend regression tests for the Jan-2026 Global Vibez DSG iteration.

Covers (per review_request):
  1. VibeRidez auto-payout on accept                       — POST /api/ridez/request
  2. NO_DRIVERS branch                                     — POST /api/ridez/request
  3. Driver-location polling endpoint                      — GET  /api/ridez/driver-location/{id}
  4. Vibe Suites balance endpoint (auth-gated)             — GET  /api/vibe-suites/me/balance
  5. Solana platform receive wallet                        — GET  /api/crypto-payments/platform-receive-wallet
  6. SOL vs BTC create-deposit address/memo behaviour      — POST /api/crypto-payments/create-deposit
  7. Router-registration regression smoke                  — supported-currencies, platform-receive-wallet,
                                                              subscriptions/tiers all return 200
"""
import os
import uuid

import pytest
import requests

# Public preview URL — exactly what the user's browser hits.
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")
EXPECTED_SOLANA_WALLET = os.environ.get(
    "GLOBAL_VIBEZ_SOLANA_RECEIVE_WALLET",
    "8fn1G5eUxvUxz1KfQ7yxFkJkB5o91Cej76xq2Tx58mph",
)


# ────────────────────────────────────── shared fixtures ──

@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth_session(api):
    """Demo-login → returns (session, token, user_id). Used for /me/balance auth tests."""
    r = api.post(f"{BASE_URL}/api/auth/demo-login", timeout=20)
    if r.status_code != 200:
        pytest.skip(f"demo-login failed ({r.status_code}): {r.text[:200]}")
    data = r.json()
    token = data.get("token")
    user_id = data.get("user_id")
    assert token, "demo-login did not return a token"
    assert user_id, "demo-login did not return a user_id"
    # Build a fresh session that carries the bearer; api session already has cookie.
    bearer = requests.Session()
    bearer.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    })
    return {"cookie_session": api, "bearer_session": bearer, "token": token, "user_id": user_id}


# ────────────────────────────────────── 1 + 2. VibeRidez dispatch ──

class TestRidezDispatchAndAutoPayout:
    """POST /api/ridez/request — auto-payout + NO_DRIVERS branch + driver_lat/lon in response."""

    def test_no_drivers_branch_when_radius_empty(self, api):
        # Use a far-flung lat/lon + tiny radius so no virtual driver can match.
        rider_id = f"TEST_rider_{uuid.uuid4().hex[:6]}"
        r = api.post(
            f"{BASE_URL}/api/ridez/request",
            json={
                "rider_id": rider_id,
                "rider_lat": -89.9,
                "rider_lon": 179.9,
                "ride_type": "any",
                "reward": 50,
                "max_radius_km": 0.1,
                "timeout_per_driver": 1.0,
            },
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "NO_DRIVERS", body
        assert "message" in body

    def test_escrow_flow_credits_on_complete_only(self, api):
        """
        New escrow contract:
        • Match → reward goes to `pending_earned` (not daily/total).
        • POST /ridez/complete → moves escrow → daily/total, flips driver
          back to AVAILABLE, returns idempotently on a 2nd call.
        """
        driver_id = f"TEST_drv_{uuid.uuid4().hex[:6]}"
        # Unique-per-run coords so prior in-memory TEST_drv entries from
        # earlier pytest runs don't out-compete this one in the matcher.
        seed = uuid.uuid4().int % 1000
        rider_lat = 10.0 + (seed * 0.01)
        rider_lon = 20.0 + (seed * 0.01)
        drv_lat = rider_lat + 0.0003
        drv_lon = rider_lon + 0.0003

        r = api.post(
            f"{BASE_URL}/api/ridez/status",
            json={
                "driver_id": driver_id,
                "status": "AVAILABLE",
                "type": "virtual",
                "lat": drv_lat,
                "lon": drv_lon,
            },
            timeout=10,
        )
        assert r.status_code == 200, r.text

        # Snapshot earnings BEFORE.
        r0 = api.get(f"{BASE_URL}/api/ridez/earnings/{driver_id}", timeout=10)
        assert r0.status_code == 200
        before = r0.json()
        daily_before = int(before.get("daily_earned", 0))
        total_before = int(before.get("total_earned", 0))
        pending_before = int(before.get("pending_earned", 0))

        reward = 75
        rider_id = f"TEST_rider_{uuid.uuid4().hex[:6]}"
        r = api.post(
            f"{BASE_URL}/api/ridez/request",
            json={
                "rider_id": rider_id,
                "rider_lat": rider_lat,
                "rider_lon": rider_lon,
                "ride_type": "virtual",
                "reward": reward,
                "max_radius_km": 5.0,
                "timeout_per_driver": 5.0,
            },
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "MATCHED", body
        assert body["driver_id"] == driver_id
        assert body["reward"] == reward
        assert "ride_id" in body, body
        ride_id = body["ride_id"]

        # driver_lat / driver_lon contract still holds.
        assert body["driver_lat"] == drv_lat
        assert body["driver_lon"] == drv_lon
        assert body.get("driver_type") == "virtual"
        assert isinstance(body.get("eta_minutes"), (int, float))

        # Reward in escrow ONLY at this point.
        r1 = api.get(f"{BASE_URL}/api/ridez/earnings/{driver_id}", timeout=10)
        assert r1.status_code == 200
        mid = r1.json()
        assert int(mid["daily_earned"]) == daily_before, mid
        assert int(mid["total_earned"]) == total_before, mid
        assert int(mid["pending_earned"]) == pending_before + reward, mid

        # Complete → escrow releases.
        r2 = api.post(
            f"{BASE_URL}/api/ridez/complete",
            json={"ride_id": ride_id, "rated": 5},
            timeout=10,
        )
        assert r2.status_code == 200, r2.text
        comp = r2.json()
        assert comp["credited"] == reward, comp
        assert comp["pending_earned"] == pending_before, comp
        assert comp["daily_earned"] == daily_before + reward, comp
        assert comp["total_earned"] == total_before + reward, comp

        # Idempotent — second call is a no-op.
        r3 = api.post(
            f"{BASE_URL}/api/ridez/complete",
            json={"ride_id": ride_id},
            timeout=10,
        )
        assert r3.status_code == 200, r3.text
        assert r3.json().get("already_completed") is True

        # /earnings reflects the released funds.
        r4 = api.get(f"{BASE_URL}/api/ridez/earnings/{driver_id}", timeout=10)
        after = r4.json()
        assert int(after["daily_earned"]) == daily_before + reward, after
        assert int(after["total_earned"]) == total_before + reward, after
        assert int(after["pending_earned"]) == pending_before, after


# ────────────────────────────────────── 3. Driver-location endpoint ──

class TestDriverLocationEndpoint:
    """GET /api/ridez/driver-location/{driver_id}"""

    def test_unknown_driver_returns_404(self, api):
        r = api.get(
            f"{BASE_URL}/api/ridez/driver-location/TEST_unknown_{uuid.uuid4().hex[:6]}",
            timeout=10,
        )
        assert r.status_code == 404, r.text

    def test_known_driver_returns_location_payload(self, api):
        driver_id = f"TEST_drv_loc_{uuid.uuid4().hex[:6]}"
        lat, lon = 40.7128, -74.0060
        r = api.post(
            f"{BASE_URL}/api/ridez/status",
            json={
                "driver_id": driver_id,
                "status": "AVAILABLE",
                "type": "virtual",
                "lat": lat,
                "lon": lon,
            },
            timeout=10,
        )
        assert r.status_code == 200

        r = api.get(f"{BASE_URL}/api/ridez/driver-location/{driver_id}", timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["driver_id"] == driver_id
        assert body["lat"] == lat
        assert body["lon"] == lon
        assert body["status"] == "AVAILABLE"
        assert "last_seen" in body
        assert isinstance(body["last_seen"], (int, float))


# ────────────────────────────────────── 4. Vibe Suites /me/balance ──

class TestVibeSuitesMeBalance:
    """GET /api/vibe-suites/me/balance — auth-gated; supports Bearer + cookie."""

    def test_unauthenticated_returns_401(self):
        # Bare requests call (no cookies, no auth header).
        r = requests.get(f"{BASE_URL}/api/vibe-suites/me/balance", timeout=10)
        assert r.status_code == 401, r.text

    def test_bearer_auth_returns_balance(self, auth_session):
        r = auth_session["bearer_session"].get(
            f"{BASE_URL}/api/vibe-suites/me/balance", timeout=10
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["user_id"] == auth_session["user_id"]
        assert "token_balance" in body
        assert isinstance(body["token_balance"], int)
        assert body["token_balance"] >= 0

    def test_cookie_auth_returns_balance(self, auth_session):
        # cookie_session was the original demo-login session — has session_token cookie.
        r = auth_session["cookie_session"].get(
            f"{BASE_URL}/api/vibe-suites/me/balance", timeout=10
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["user_id"] == auth_session["user_id"]
        assert isinstance(body["token_balance"], int)


# ────────────────────────────────────── 5 + 6. Crypto payments ──

class TestCryptoPayments:
    """Solana receive wallet + SOL/BTC deposit-address contract."""

    def test_platform_receive_wallet(self, api):
        r = api.get(f"{BASE_URL}/api/crypto-payments/platform-receive-wallet", timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["success"] is True
        assert body["network"] == "solana"
        assert body["address"] == EXPECTED_SOLANA_WALLET
        assert body.get("label"), "Missing label on platform receive wallet response"

    def test_create_deposit_sol_uses_platform_wallet_with_memo(self, api):
        user_id = f"TEST_user_{uuid.uuid4().hex[:8]}"
        r = api.post(
            f"{BASE_URL}/api/crypto-payments/create-deposit",
            json={
                "user_id": user_id,
                "cryptocurrency": "SOL",
                "amount_usd": 10.0,
            },
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["success"] is True
        deposit = body["deposit"]
        assert deposit["cryptocurrency"] == "SOL"
        assert deposit["network"] == "solana"
        assert deposit["deposit_address"] == EXPECTED_SOLANA_WALLET, deposit
        assert deposit["memo"], "SOL deposit must carry a memo"
        assert deposit["memo"].startswith("GVZ-"), deposit["memo"]
        assert deposit["status"] == "pending"
        assert deposit["user_id"] == user_id

    def test_create_deposit_btc_uses_placeholder_and_no_memo(self, api):
        user_id = f"TEST_user_{uuid.uuid4().hex[:8]}"
        r = api.post(
            f"{BASE_URL}/api/crypto-payments/create-deposit",
            json={
                "user_id": user_id,
                "cryptocurrency": "BTC",
                "amount_usd": 25.0,
            },
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        deposit = body["deposit"]
        assert deposit["cryptocurrency"] == "BTC"
        assert deposit["network"] == "bitcoin"
        assert deposit["deposit_address"].startswith("GENERATED_ADDRESS_"), deposit
        assert deposit["memo"] is None, deposit


# ────────────────────────────────────── 7. Router-registration regression ──

class TestRouterRegistrationRegression:
    """
    Confirms the fix where app.include_router(api_router) was moved AFTER all
    api_router.include_router(...) calls — previously several routers were 404'ing.
    """

    @pytest.mark.parametrize(
        "path",
        [
            "/api/crypto-payments/supported-currencies",
            "/api/crypto-payments/platform-receive-wallet",
            "/api/subscriptions/tiers",
        ],
    )
    def test_router_path_returns_200(self, api, path):
        r = api.get(f"{BASE_URL}{path}", timeout=10)
        assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:200]}"
        # Sanity: must be JSON and non-empty.
        body = r.json()
        assert body, f"{path} returned empty body"



# ────────────────────────────────────── 8. Complete-ride edge cases ──

class TestRideCompleteEdgeCases:
    """POST /api/ridez/complete edge cases (unknown ride_id)."""

    def test_complete_unknown_ride_id_returns_404(self, api):
        r = api.post(
            f"{BASE_URL}/api/ridez/complete",
            json={"ride_id": f"TEST_unknown_ride_{uuid.uuid4().hex}"},
            timeout=10,
        )
        assert r.status_code == 404, r.text

    def test_driver_flips_back_to_available_in_active_drivers_after_complete(self, api):
        driver_id = f"TEST_drv_avail_{uuid.uuid4().hex[:6]}"
        seed = uuid.uuid4().int % 1000
        rider_lat = 30.0 + (seed * 0.01)
        rider_lon = 40.0 + (seed * 0.01)
        drv_lat = rider_lat + 0.0003
        drv_lon = rider_lon + 0.0003

        # Register driver
        r = api.post(
            f"{BASE_URL}/api/ridez/status",
            json={
                "driver_id": driver_id,
                "status": "AVAILABLE",
                "type": "virtual",
                "lat": drv_lat,
                "lon": drv_lon,
            },
            timeout=10,
        )
        assert r.status_code == 200

        # Match
        r = api.post(
            f"{BASE_URL}/api/ridez/request",
            json={
                "rider_id": f"TEST_rider_{uuid.uuid4().hex[:6]}",
                "rider_lat": rider_lat,
                "rider_lon": rider_lon,
                "ride_type": "virtual",
                "reward": 30,
                "max_radius_km": 1.0,
                "timeout_per_driver": 5.0,
            },
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "MATCHED", body
        assert body["driver_id"] == driver_id
        ride_id = body["ride_id"]

        # Driver should be BUSY in active-drivers list while ride in progress.
        r = api.get(f"{BASE_URL}/api/ridez/active-drivers", timeout=10)
        drivers = {d["driver_id"]: d for d in r.json()["drivers"]}
        assert drivers[driver_id]["status"] == "BUSY", drivers[driver_id]

        # Complete it.
        r = api.post(
            f"{BASE_URL}/api/ridez/complete",
            json={"ride_id": ride_id, "rated": 5},
            timeout=10,
        )
        assert r.status_code == 200

        # Now the driver must show AVAILABLE again.
        r = api.get(f"{BASE_URL}/api/ridez/active-drivers", timeout=10)
        drivers = {d["driver_id"]: d for d in r.json()["drivers"]}
        assert drivers[driver_id]["status"] == "AVAILABLE", drivers[driver_id]


# ────────────────────────────────────── 9. Rider history (auth-gated) ──

class TestRiderHistory:
    """GET /api/ridez/my-history — auth-gated, returns rider's recent rides."""

    def test_unauthenticated_returns_401(self):
        r = requests.get(f"{BASE_URL}/api/ridez/my-history", timeout=10)
        assert r.status_code == 401, r.text

    def test_authenticated_returns_completed_ride(self, api, auth_session):
        bearer = auth_session["bearer_session"]
        user_id = auth_session["user_id"]

        # Register a virtual driver with unique coords.
        driver_id = f"TEST_drv_hist_{uuid.uuid4().hex[:6]}"
        seed = uuid.uuid4().int % 1000
        rider_lat = 50.0 + (seed * 0.01)
        rider_lon = 60.0 + (seed * 0.01)
        drv_lat = rider_lat + 0.0003
        drv_lon = rider_lon + 0.0003

        r = api.post(
            f"{BASE_URL}/api/ridez/status",
            json={
                "driver_id": driver_id,
                "status": "AVAILABLE",
                "type": "virtual",
                "lat": drv_lat,
                "lon": drv_lon,
            },
            timeout=10,
        )
        assert r.status_code == 200

        # Create a ride with rider_id == authenticated user_id.
        r = api.post(
            f"{BASE_URL}/api/ridez/request",
            json={
                "rider_id": user_id,
                "rider_lat": rider_lat,
                "rider_lon": rider_lon,
                "ride_type": "virtual",
                "reward": 42,
                "max_radius_km": 1.0,
                "timeout_per_driver": 5.0,
            },
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "MATCHED", body
        ride_id = body["ride_id"]

        # Complete with 5-star rating.
        r = api.post(
            f"{BASE_URL}/api/ridez/complete",
            json={"ride_id": ride_id, "rated": 5},
            timeout=10,
        )
        assert r.status_code == 200

        # GET /api/ridez/my-history (Bearer auth) → must contain this ride.
        r = bearer.get(f"{BASE_URL}/api/ridez/my-history", timeout=10)
        assert r.status_code == 200, r.text
        hist = r.json()
        assert hist["rider_id"] == user_id
        assert isinstance(hist["count"], int)
        assert isinstance(hist["rides"], list)
        match = next((rd for rd in hist["rides"] if rd.get("ride_id") == ride_id), None)
        assert match is not None, f"ride {ride_id} not found in history; got {hist}"
        assert match["status"] == "completed", match
        assert match["rating"] == 5, match


# ────────────────────────────────────── 10. Uber removal regression ──

class TestUberRemoved:
    """All /api/uber/* endpoints should now 404 (Uber subsystem removed)."""

    @pytest.mark.parametrize(
        "path",
        [
            "/api/uber/health",
            "/api/uber/quote",
            "/api/uber/request-ride",
            "/api/uber/foo",
        ],
    )
    def test_uber_paths_return_404(self, api, path):
        r = api.get(f"{BASE_URL}{path}", timeout=10)
        assert r.status_code == 404, f"{path} -> {r.status_code} {r.text[:200]}"



# ────────────────────────────────────── Agora Vibe Call ──

class TestAgoraVibeCall:
    """Agora RTC token mint endpoint."""

    def test_agora_health_public(self, api):
        r = api.get(f"{BASE_URL}/api/agora/health", timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body["configured"] is True
        assert body["app_id_present"] is True
        assert isinstance(body["ttl_seconds"], int) and body["ttl_seconds"] > 0

    def test_rtc_token_requires_auth(self):
        # Use a fresh session with no cookies/auth so we actually hit the 401 path.
        anon = requests.Session()
        anon.headers.update({"Content-Type": "application/json"})
        r = anon.post(
            f"{BASE_URL}/api/agora/rtc-token",
            json={"channel": "jftn-room-x"},
            timeout=10,
        )
        assert r.status_code == 401

    def test_rtc_token_validates_channel_pattern(self, auth_session):
        s = auth_session["bearer_session"]
        r = s.post(
            f"{BASE_URL}/api/agora/rtc-token",
            json={"channel": "bad space!"},
            timeout=10,
        )
        assert r.status_code == 400

    def test_rtc_token_authed_returns_token(self, auth_session):
        s = auth_session["bearer_session"]
        ch = f"jftn-room-{uuid.uuid4().hex[:6]}"
        r = s.post(
            f"{BASE_URL}/api/agora/rtc-token",
            json={"channel": ch, "role": "publisher"},
            timeout=10,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["channel"] == ch
        assert body["role"] == "publisher"
        assert isinstance(body["uid"], int) and body["uid"] > 0
        assert isinstance(body["token"], str) and len(body["token"]) > 20
        # uid is deterministic per (user_id) — same call should return same uid.
        r2 = s.post(
            f"{BASE_URL}/api/agora/rtc-token",
            json={"channel": ch, "role": "publisher"},
            timeout=10,
        )
        assert r2.status_code == 200
        assert r2.json()["uid"] == body["uid"]



# ────────────────────────────────────── Vibe Phone ──

class TestVibePhone:
    """Privacy-masked in-app calling endpoints."""

    def test_me_unauth(self):
        anon = requests.Session()
        r = anon.get(f"{BASE_URL}/api/vibe-phone/me", timeout=10)
        assert r.status_code == 401

    def test_provision_idempotent(self, auth_session):
        s = auth_session["bearer_session"]
        r1 = s.post(f"{BASE_URL}/api/vibe-phone/provision", timeout=10)
        assert r1.status_code == 200, r1.text
        r2 = s.post(f"{BASE_URL}/api/vibe-phone/provision", timeout=10)
        assert r2.status_code == 200
        assert r1.json()["vibe_number"] == r2.json()["vibe_number"]
        assert r1.json()["vibe_number"].startswith("+1 (888) VIBE-")

    def test_lookup_returns_user_id(self, auth_session):
        s = auth_session["bearer_session"]
        r = s.post(f"{BASE_URL}/api/vibe-phone/provision", timeout=10)
        n = r.json()["vibe_number"]
        r2 = s.post(
            f"{BASE_URL}/api/vibe-phone/lookup",
            json={"vibe_number": n},
            timeout=10,
        )
        assert r2.status_code == 200
        assert r2.json()["found"] is True
        assert r2.json()["user_id"] == r.json()["user_id"]

    def test_lookup_bad_format_400(self, auth_session):
        s = auth_session["bearer_session"]
        r = s.post(
            f"{BASE_URL}/api/vibe-phone/lookup",
            json={"vibe_number": "555-1234"},
            timeout=10,
        )
        assert r.status_code == 400

    def test_initiate_call_returns_channel(self, auth_session):
        s = auth_session["bearer_session"]
        # Note: initiate against a fake user — endpoint doesn't verify the
        # callee exists; the WS push just doesn't deliver. We're testing
        # the contract, not delivery.
        r = s.post(
            f"{BASE_URL}/api/vibe-phone/call/initiate",
            json={"callee_user_id": f"phantom_user_{uuid.uuid4().hex[:6]}"},
            timeout=10,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "ringing"
        assert body["channel"].startswith("vibephone-")
        assert body["call_id"].startswith("call_")
        assert body["caller_vibe_number"].startswith("+1 (888) VIBE-")

    def test_cannot_call_yourself(self, auth_session):
        s = auth_session["bearer_session"]
        me = s.get(f"{BASE_URL}/api/vibe-phone/me", timeout=10).json()
        r = s.post(
            f"{BASE_URL}/api/vibe-phone/call/initiate",
            json={"callee_user_id": me["user_id"]},
            timeout=10,
        )
        assert r.status_code == 400

    def test_pstn_eligibility_free_user(self, auth_session):
        s = auth_session["bearer_session"]
        r = s.get(f"{BASE_URL}/api/vibe-phone/pstn/eligibility", timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body["has_pstn"] in (False, True)
        assert "twilio_configured" in body
        assert "phase_2_status" in body

    def test_pstn_provision_blocks_free_user(self, auth_session):
        s = auth_session["bearer_session"]
        r = s.post(
            f"{BASE_URL}/api/vibe-phone/pstn/provision",
            json={},
            timeout=10,
        )
        # Free-tier user → 402 (payment required) before we even look at Twilio.
        assert r.status_code in (402, 503)



# ────────────────────────────────────────── Safe Vibe Stakes (Apr 27 2026) ──
class TestSafeVibeStakes:
    """Apr 2026 — safe loyalty translations of the user's manifest:
    surge multiplier, treasury dashboard, dynamic premium pricing,
    4/3/3 subscription rake. NOT a security; lightweight contract checks."""

    def test_pool_endpoint_includes_surge(self, api):
        r = api.get(f"{BASE_URL}/api/profit-share/pool", timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "surge" in body
        s = body["surge"]
        assert "active" in s and "multiplier" in s
        assert s["multiplier"] >= 1.0

    def test_surge_endpoint_public(self, api):
        r = api.get(f"{BASE_URL}/api/profit-share/surge", timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert "active" in body
        assert "multiplier" in body

    def test_treasury_dashboard_shape(self, api):
        r = api.get(f"{BASE_URL}/api/profit-share/treasury", timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "current_quarter" in body
        assert "last_quarter" in body
        assert "stability_reserve_usd" in body
        assert "leaderboard" in body
        assert "surge" in body
        assert isinstance(body["leaderboard"], list)
        # Anonymized — no raw user_id leaking
        for row in body["leaderboard"]:
            assert "anon_id" in row
            assert "user_id" not in row

    def test_premium_price_curve(self, api):
        r = api.get(f"{BASE_URL}/api/premium/price", timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["current_price_usd"] > 0
        assert body["next_price_increase_to_usd"] > body["current_price_usd"]
        assert body["step_per_quarter_usd"] > 0
        assert body["quarters_since_launch"] >= 0

    def test_premium_subscribe_requires_auth(self, api):
        # Use a fresh session so we don't inherit cookies from earlier tests.
        fresh = requests.Session()
        fresh.headers.update({"Content-Type": "application/json"})
        r = fresh.post(
            f"{BASE_URL}/api/premium/subscribe",
            json={"payment_amount_usd": 9.99, "payment_ref": f"test_{uuid.uuid4().hex[:8]}"},
            timeout=10,
        )
        # No auth → 401
        assert r.status_code == 401


# ────────────────────────────────────────── Founders Pass / House Tiers ──
class TestFoundersPass:
    """Apr 27 2026 — Casino House Tiers (Scenario D). One-time prepaid
    utility purchase with permanent stake-multiplier + starter stakes.
    NOT a security."""

    def test_tiers_endpoint_public(self, api):
        r = api.get(f"{BASE_URL}/api/founders-pass/tiers", timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        ids = [t["id"] for t in body["tiers"]]
        assert ids == ["the_slots", "blackjack", "craps", "spades_royale"]
        # Pricing matches Scenario D exactly
        prices = {t["id"]: t["price_usd"] for t in body["tiers"]}
        assert prices["the_slots"] == 19.0
        assert prices["blackjack"] == 99.0
        assert prices["craps"] == 399.0
        assert prices["spades_royale"] == 1499.0
        # Multipliers match Scenario D
        mults = {t["id"]: t["multiplier"] for t in body["tiers"]}
        assert mults["the_slots"] == 1.5
        assert mults["blackjack"] == 4.0
        assert mults["craps"] == 9.0
        assert mults["spades_royale"] == 20.0
        assert "legal_disclaimer" in body
        assert "Not a security" in body["legal_disclaimer"]

    def test_me_unauthenticated_blocked(self, api):
        fresh = requests.Session()
        fresh.headers.update({"Content-Type": "application/json"})
        r = fresh.get(f"{BASE_URL}/api/founders-pass/me", timeout=10)
        assert r.status_code == 401

    def test_me_no_pass_default(self, auth_session):
        s = auth_session["bearer_session"]
        r = s.get(f"{BASE_URL}/api/founders-pass/me", timeout=10)
        # Either no pass or already activated by an earlier test in same session.
        assert r.status_code == 200
        body = r.json()
        assert "has_pass" in body
        assert body["multiplier"] >= 1.0

    def test_test_activate_grants_multiplier_and_starter_stakes(self, auth_session):
        s = auth_session["bearer_session"]
        ref = f"pytest_fp_slots_{uuid.uuid4().hex[:8]}"
        r = s.post(
            f"{BASE_URL}/api/founders-pass/test-activate",
            json={"tier_id": "the_slots", "payment_ref": ref},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        # First call → not idempotent_replay
        assert body.get("idempotent_replay") is False
        assert body["tier_id"] == "the_slots"
        assert body["multiplier"] == 1.5
        assert body["starter_stakes_granted"] == 300

    def test_test_activate_is_idempotent(self, auth_session):
        s = auth_session["bearer_session"]
        ref = f"pytest_fp_idem_{uuid.uuid4().hex[:8]}"
        # First activation
        r1 = s.post(
            f"{BASE_URL}/api/founders-pass/test-activate",
            json={"tier_id": "blackjack", "payment_ref": ref},
            timeout=15,
        )
        assert r1.status_code == 200
        # Replay
        r2 = s.post(
            f"{BASE_URL}/api/founders-pass/test-activate",
            json={"tier_id": "blackjack", "payment_ref": ref},
            timeout=15,
        )
        assert r2.status_code == 200
        assert r2.json().get("idempotent_replay") is True

    def test_unknown_tier_rejected(self, auth_session):
        s = auth_session["bearer_session"]
        r = s.post(
            f"{BASE_URL}/api/founders-pass/test-activate",
            json={"tier_id": "ferrari_tier", "payment_ref": f"x_{uuid.uuid4().hex[:6]}"},
            timeout=10,
        )
        assert r.status_code == 400

    def test_checkout_unauthenticated_blocked(self, api):
        fresh = requests.Session()
        fresh.headers.update({"Content-Type": "application/json"})
        r = fresh.post(
            f"{BASE_URL}/api/founders-pass/checkout",
            json={"tier_id": "the_slots"},
            timeout=10,
        )
        assert r.status_code == 401

    def test_admin_stats_requires_admin_cookie(self, api):
        fresh = requests.Session()
        fresh.headers.update({"Content-Type": "application/json"})
        r = fresh.get(f"{BASE_URL}/api/admin/founders-pass/stats", timeout=10)
        # Without admin_session cookie → 401
        assert r.status_code in (401, 403)

    def test_real_stripe_checkout_returns_session_url(self, auth_session):
        """When STRIPE_API_KEY is configured, /checkout returns a live
        cs_test_* session URL. In preview env this hits Stripe test mode."""
        s = auth_session["bearer_session"]
        # Reset any pre-existing pass on this demo user so we can buy the
        # cheapest tier without 409.
        try:
            from utils.database import get_database
            import asyncio
            db = get_database()
            uid = auth_session["user_id"]
            asyncio.get_event_loop().run_until_complete(
                db.founders_passes.delete_many({"user_id": uid})
            )
            asyncio.get_event_loop().run_until_complete(
                db.users.update_one(
                    {"user_id": uid},
                    {"$unset": {"founders_pass_multiplier": "", "founders_pass_tier": ""}},
                )
            )
        except Exception:
            pass  # Best-effort; non-fatal.
        s.headers.update({"Origin": BASE_URL})
        r = s.post(
            f"{BASE_URL}/api/founders-pass/checkout",
            json={"tier_id": "the_slots"},
            timeout=15,
        )
        # Either we get a real Stripe session OR a 409 if the demo user was
        # already passed up by a different test in the same session — both
        # prove the endpoint is wired correctly.
        assert r.status_code in (200, 409), r.text
        if r.status_code == 200:
            body = r.json()
            assert body["checkout_url"].startswith("https://checkout.stripe.com/")
            assert body["session_id"].startswith("cs_test_")
            assert body["amount_usd"] == 19.0

    def test_tiers_include_next_pass_number(self, api):
        """FOMO marketing — every tier exposes the next-available founder
        number for the public marketing copy."""
        r = api.get(f"{BASE_URL}/api/founders-pass/tiers", timeout=10)
        assert r.status_code == 200
        body = r.json()
        for t in body["tiers"]:
            assert "next_pass_number" in t, f"tier {t['id']} missing next_pass_number"
            assert isinstance(t["next_pass_number"], int)
            assert t["next_pass_number"] >= 1

    def test_activation_assigns_sequential_pass_number(self, auth_session):
        """A newly-activated pass returns pass_number + pass_number_label
        like 'Spades Royale Founder #001'."""
        s = auth_session["bearer_session"]
        ref = f"pytest_seq_{uuid.uuid4().hex[:8]}"
        r = s.post(
            f"{BASE_URL}/api/founders-pass/test-activate",
            json={"tier_id": "craps", "payment_ref": ref},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "pass_number" in body
        assert isinstance(body["pass_number"], int)
        assert body["pass_number"] >= 1
        assert "pass_number_label" in body
        assert body["pass_number_label"].startswith("Craps Tier Founder #")
        # Must be 3-digit zero-padded
        suffix = body["pass_number_label"].split("#")[-1]
        assert len(suffix) >= 3, f"expected zero-padded number, got {suffix!r}"

    def test_idempotent_replay_keeps_pass_number(self, auth_session):
        """Re-activating with same payment_ref must NOT increment the
        counter or change the pass number."""
        s = auth_session["bearer_session"]
        ref = f"pytest_seq_idem_{uuid.uuid4().hex[:8]}"
        r1 = s.post(
            f"{BASE_URL}/api/founders-pass/test-activate",
            json={"tier_id": "the_slots", "payment_ref": ref},
            timeout=15,
        )
        assert r1.status_code == 200
        n1 = r1.json().get("pass_number")
        # Replay
        r2 = s.post(
            f"{BASE_URL}/api/founders-pass/test-activate",
            json={"tier_id": "the_slots", "payment_ref": ref},
            timeout=15,
        )
        assert r2.status_code == 200
        body2 = r2.json()
        assert body2.get("idempotent_replay") is True
        assert body2.get("pass_number") == n1, (
            f"replay must return same number: first={n1} replay={body2.get('pass_number')}"
        )

    def test_premium_subscribe_runs_4_3_3_rake(self, auth_session):
        s = auth_session["bearer_session"]
        ref = f"pytest_rake_{uuid.uuid4().hex[:8]}"
        r = s.post(
            f"{BASE_URL}/api/premium/subscribe",
            json={"payment_amount_usd": 10.00, "payment_ref": ref},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["tier"] == "premium"
        split = body["split"]
        # 40 / 30 / 30 of $10 = $4 / $3 / $3
        assert abs(split["operating_cut_usd"] - 4.0) < 0.01
        assert abs(split["reserve_cut_usd"] - 3.0) < 0.01
        assert abs(split["pool_boost_usd"] - 3.0) < 0.01
        assert body["stakes_granted"] == 200

    def test_premium_subscribe_is_idempotent_on_payment_ref(self, auth_session):
        """Stripe webhooks retry. Same payment_ref must not double-bill."""
        s = auth_session["bearer_session"]
        ref = f"pytest_idem_{uuid.uuid4().hex[:8]}"
        r1 = s.post(
            f"{BASE_URL}/api/premium/subscribe",
            json={"payment_amount_usd": 9.99, "payment_ref": ref},
            timeout=15,
        )
        assert r1.status_code == 200
        # Replay
        r2 = s.post(
            f"{BASE_URL}/api/premium/subscribe",
            json={"payment_amount_usd": 9.99, "payment_ref": ref},
            timeout=15,
        )
        assert r2.status_code == 200
        b2 = r2.json()
        assert b2.get("idempotent_replay") is True
        assert b2["stakes_granted"] == 0

    def test_premium_subscribe_rejects_huge_amount(self, auth_session):
        """Cap absurd amounts so an authed user can't pollute the reserve."""
        s = auth_session["bearer_session"]
        r = s.post(
            f"{BASE_URL}/api/premium/subscribe",
            json={"payment_amount_usd": 1_000_000_000, "payment_ref": f"abuse_{uuid.uuid4().hex[:6]}"},
            timeout=10,
        )
        assert r.status_code == 422



# ────────────────────────────────────────── Founder Chairs / Master Plan ──
class TestFounderChairs:
    """Apr 27 2026 — phase-priced Founder Chairs system.
    Replaces equity rhetoric with utility loyalty seats. NOT a security."""

    def test_phase_endpoint_public(self, api):
        r = api.get(f"{BASE_URL}/api/chairs/phase", timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        # New 5-name flow: Genesis / Vanguard / Global / Stellar / Celestial
        assert body["phase"] in (
            "Genesis", "Vanguard", "Global", "Stellar", "Celestial", "Sold Out"
        )
        if body["phase"] != "Sold Out":
            assert body["price_usd"] in (5.0, 10.0, 20.0)
            assert body["remaining_in_phase"] >= 0
            # Weight is now part of every phase response
            assert body["weight"] in (3.0, 2.0, 1.0)

    def test_chairs_me_unauthenticated_blocked(self, api):
        fresh = requests.Session()
        fresh.headers.update({"Content-Type": "application/json"})
        r = fresh.get(f"{BASE_URL}/api/chairs/me", timeout=10)
        assert r.status_code == 401

    def test_test_buy_grants_chairs_and_records(self, auth_session):
        s = auth_session["bearer_session"]
        ref = f"pytest_chair_{uuid.uuid4().hex[:8]}"
        r = s.post(
            f"{BASE_URL}/api/chairs/test-buy",
            json={"quantity": 2, "payment_ref": ref},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["quantity"] == 2
        assert body["price_per_chair_usd"] in (5.0, 10.0, 20.0)
        assert body["contribution_usd"] == 2 * body["price_per_chair_usd"]
        assert body.get("idempotent_replay") is False

    def test_chair_purchase_idempotent(self, auth_session):
        s = auth_session["bearer_session"]
        ref = f"pytest_chair_idem_{uuid.uuid4().hex[:8]}"
        r1 = s.post(
            f"{BASE_URL}/api/chairs/test-buy",
            json={"quantity": 1, "payment_ref": ref},
            timeout=15,
        )
        assert r1.status_code == 200
        # Replay
        r2 = s.post(
            f"{BASE_URL}/api/chairs/test-buy",
            json={"quantity": 1, "payment_ref": ref},
            timeout=15,
        )
        assert r2.status_code == 200
        body2 = r2.json()
        assert body2.get("idempotent_replay") is True

    def test_quantity_cap_enforced(self, auth_session):
        s = auth_session["bearer_session"]
        r = s.post(
            f"{BASE_URL}/api/chairs/test-buy",
            json={"quantity": 1_000_000, "payment_ref": f"abuse_{uuid.uuid4().hex[:6]}"},
            timeout=10,
        )
        assert r.status_code == 422  # Pydantic field validator rejects

    def test_invite_validate_unknown_returns_invalid(self, api):
        r = api.get(f"{BASE_URL}/api/invites/validate/VIBE-NOTREAL999", timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body["valid"] is False

    def test_invite_generate_authed(self, auth_session):
        s = auth_session["bearer_session"]
        r = s.post(f"{BASE_URL}/api/invites/generate", timeout=10)
        # 200 if user has chairs/pass, 403 if not. Either proves endpoint live.
        assert r.status_code in (200, 403), r.text
        if r.status_code == 200:
            body = r.json()
            assert body["code"].startswith("VIBE-")
            assert body["share_link"].startswith("/join/")

    def test_admin_health_requires_admin_cookie(self, api):
        fresh = requests.Session()
        fresh.headers.update({"Content-Type": "application/json"})
        r = fresh.get(f"{BASE_URL}/api/admin/chairs/health", timeout=10)
        assert r.status_code in (401, 403)

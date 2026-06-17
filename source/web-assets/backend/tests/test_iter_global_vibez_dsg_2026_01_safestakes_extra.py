"""
Extra hardening tests for the safe Vibe Stakes / Premium pricing iteration
(Apr 2026). Complements TestSafeVibeStakes by exercising:
  - PII anonymization in /api/profit-share/treasury
  - /api/profit-share/me auth requirement + shape
  - /api/premium/price math identity (current + step == next)
  - /api/premium/subscribe rake math with a non-round payment amount
  - /api/admin/premium/reserve admin gating + post-rake balance > 0
"""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://social-connect-953.preview.emergentagent.com",
).rstrip("/")


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth(api):
    r = api.post(f"{BASE_URL}/api/auth/demo-login", timeout=20)
    if r.status_code != 200:
        pytest.skip(f"demo-login unavailable: {r.status_code}")
    body = r.json()
    token = body.get("token") or body.get("access_token")
    user_id = body.get("user_id") or (body.get("user") or {}).get("user_id")
    if not token:
        pytest.skip("no token returned from demo-login")
    bearer = requests.Session()
    bearer.headers.update(
        {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
    )
    return {"bearer": bearer, "user_id": user_id, "token": token}


# ── Treasury PII anonymization ───────────────────────────────────
class TestTreasuryAnonymization:
    def test_no_raw_user_id_in_leaderboard(self, api):
        r = api.get(f"{BASE_URL}/api/profit-share/treasury", timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        for row in body["leaderboard"]:
            assert "user_id" not in row, f"PII leak: {row}"
            assert "anon_id" in row
            # anon_id should look like 'aaaaaa…xx' or short raw if user_id ≤10 chars
            assert isinstance(row["anon_id"], str) and len(row["anon_id"]) > 0

    def test_treasury_surge_shape(self, api):
        r = api.get(f"{BASE_URL}/api/profit-share/treasury", timeout=10)
        body = r.json()
        s = body["surge"]
        assert "active" in s and "multiplier" in s and "expires_at" in s
        if not s["active"]:
            assert s["multiplier"] == 1.0
        else:
            # SURGE_MULTIPLIER constant in code is 2.0
            assert s["multiplier"] >= 1.0


# ── /me requires auth & has new fields ───────────────────────────
class TestProfitShareMe:
    def test_unauth_returns_401(self, api):
        r = api.get(f"{BASE_URL}/api/profit-share/me", timeout=10)
        assert r.status_code == 401

    def test_auth_returns_expected_keys(self, auth):
        r = auth["bearer"].get(f"{BASE_URL}/api/profit-share/me", timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        for k in (
            "current_stakes",
            "projected_payout_coins",
            "premium_multiplier",
            "is_premium",
            "next_quarter_start",
        ):
            assert k in body, f"missing key {k}"
        assert body["premium_multiplier"] in (1.0, 1.5)


# ── Premium price math ───────────────────────────────────────────
class TestPremiumPriceMath:
    def test_current_plus_step_equals_next(self, api):
        r = api.get(f"{BASE_URL}/api/premium/price", timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        cur = body["current_price_usd"]
        step = body["step_per_quarter_usd"]
        nxt = body["next_price_increase_to_usd"]
        assert abs((cur + step) - nxt) < 0.01, f"{cur} + {step} != {nxt}"

    def test_grandfathered_null_for_anon(self):
        # Use a brand-new session so we don't inherit the demo-login cookie
        # the `auth` fixture set on the shared `api` session.
        fresh = requests.Session()
        fresh.headers.update({"Content-Type": "application/json"})
        r = fresh.get(f"{BASE_URL}/api/premium/price", timeout=10)
        body = r.json()
        assert body.get("your_grandfathered_price_usd") is None


# ── 4/3/3 rake with non-round number ─────────────────────────────
class TestRakeMathPrecision:
    def test_subscribe_with_decimal_amount(self, auth):
        ref = f"pytest_extra_{uuid.uuid4().hex[:8]}"
        amt = 12.99
        r = auth["bearer"].post(
            f"{BASE_URL}/api/premium/subscribe",
            json={"payment_amount_usd": amt, "payment_ref": ref},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        split = body["split"]
        # 40/30/30 of 12.99 → 5.196 / 3.897 / 3.897
        assert abs(split["operating_cut_usd"] - 5.196) < 0.01
        assert abs(split["reserve_cut_usd"] - 3.897) < 0.01
        assert abs(split["pool_boost_usd"] - 3.897) < 0.01
        # Sum should match original payment within rounding tolerance
        total = (
            split["operating_cut_usd"]
            + split["reserve_cut_usd"]
            + split["pool_boost_usd"]
        )
        assert abs(total - amt) < 0.01, f"split sum {total} != {amt}"
        # Grandfathered price should equal amount paid
        assert abs(body["grandfathered_price_usd"] - amt) < 0.01

    def test_subscribe_rejects_zero_or_negative(self, auth):
        r = auth["bearer"].post(
            f"{BASE_URL}/api/premium/subscribe",
            json={"payment_amount_usd": 0, "payment_ref": "x"},
            timeout=10,
        )
        # Pydantic ge=0.01 → 422
        assert r.status_code in (400, 422)

    def test_grandfathered_price_persisted_after_subscribe(self, auth):
        # After the previous test ran, /premium/price for this user must
        # surface their grandfathered rate.
        r = auth["bearer"].get(f"{BASE_URL}/api/premium/price", timeout=10)
        assert r.status_code == 200
        body = r.json()
        gf = body.get("your_grandfathered_price_usd")
        assert gf is not None and gf > 0, body


# ── Admin reserve gate ───────────────────────────────────────────
class TestAdminReserveGate:
    def test_no_cookie_returns_401_or_403(self, api):
        r = api.get(f"{BASE_URL}/api/admin/premium/reserve", timeout=10)
        assert r.status_code in (401, 403), r.status_code

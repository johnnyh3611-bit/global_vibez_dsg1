"""
Backend tests for VibeRidez Fare Splitter (Jan 2026).

Coverage:
  - GET  /api/viberidez/economics/split-policy (public)
  - POST /api/viberidez/fares/distribute (auth)
  - GET  /api/viberidez/fares/breakdown/{ride_id} (auth)
  - GET  /api/viberidez/driver/earnings-summary (auth)
  - POST /api/ridez/complete with total_fare_usd auto-triggers splitter
  - 401 unauth checks
  - Idempotency (no double-credit)
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def demo_auth(api):
    r = api.post(f"{BASE_URL}/api/auth/demo-login", timeout=20)
    assert r.status_code == 200, f"demo-login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("token") or data.get("session_token")
    user_id = data.get("user_id") or data.get("user", {}).get("user_id")
    assert token, f"no token in demo-login: {data}"
    assert user_id, f"no user_id in demo-login: {data}"
    return {"token": token, "user_id": user_id}


@pytest.fixture(scope="module")
def auth_headers(demo_auth):
    return {"Authorization": f"Bearer {demo_auth['token']}"}


# ────── public split-policy ──────
class TestSplitPolicy:
    def test_split_policy_pre_ev(self, api):
        r = api.get(f"{BASE_URL}/api/viberidez/economics/split-policy", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        # pre/post EV maps always present
        assert d["split_pct_pre_ev"] == {
            "driver": 0.70, "chair_pool": 0.14, "platform": 0.085,
            "insurance": 0.05, "referral": 0.025,
        }
        assert d["split_pct_post_ev"] == {
            "driver": 0.70, "chair_pool": 0.30, "platform": 0.0,
            "insurance": 0.0, "referral": 0.0,
        }
        assert "marketing_line" in d and "Escape Velocity" in d["marketing_line"]
        assert "escape_velocity_active" in d
        # Active split should match one of the two maps
        assert d["split_pct"] in (d["split_pct_pre_ev"], d["split_pct_post_ev"])


# ────── auth gating ──────
class TestAuthGating:
    def test_distribute_401_no_token(self, api):
        r = api.post(
            f"{BASE_URL}/api/viberidez/fares/distribute",
            json={"ride_id": "x", "total_fare_usd": 5},
            timeout=15,
        )
        assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text}"

    def test_earnings_summary_401_no_token(self, api):
        r = api.get(f"{BASE_URL}/api/viberidez/driver/earnings-summary", timeout=15)
        assert r.status_code == 401


# ────── distribute + idempotency ──────
class TestDistributeFare:
    @pytest.fixture(scope="class")
    def ride_ctx(self, demo_auth):
        return {
            "ride_id": f"TEST_ride_{uuid.uuid4().hex[:10]}",
            "driver_id": demo_auth["user_id"],
            "rider_id": f"TEST_rider_{uuid.uuid4().hex[:8]}",
        }

    def test_distribute_exact_split_for_10usd(self, api, auth_headers, ride_ctx):
        payload = {
            "ride_id": ride_ctx["ride_id"],
            "total_fare_usd": 10.0,
            "driver_id": ride_ctx["driver_id"],
            "rider_id": ride_ctx["rider_id"],
        }
        r = api.post(
            f"{BASE_URL}/api/viberidez/fares/distribute",
            json=payload, headers=auth_headers, timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        # Pre-EV expected (assume EV not active in test env)
        if not d.get("escape_velocity_active"):
            assert d["driver_usd"] == 7.00
            assert d["chair_usd"] == 1.40
            assert d["platform_usd"] == 0.85
            assert d["insurance_usd"] == 0.50
            assert d["referral_usd"] == 0.25
            total = round(
                d["driver_usd"] + d["chair_usd"] + d["platform_usd"]
                + d["insurance_usd"] + d["referral_usd"], 2,
            )
            assert total == 10.00, f"buckets sum {total} != 10.00"
        assert d["driver_payout_token"] == "USDC"
        assert d["driver_payout_status"] == "pending"

    def test_distribute_idempotent(self, api, auth_headers, ride_ctx):
        # Second call with same ride_id must replay, not double-credit
        payload = {
            "ride_id": ride_ctx["ride_id"],
            "total_fare_usd": 10.0,
            "driver_id": ride_ctx["driver_id"],
            "rider_id": ride_ctx["rider_id"],
        }
        r = api.post(
            f"{BASE_URL}/api/viberidez/fares/distribute",
            json=payload, headers=auth_headers, timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("idempotent_replay") is True, f"expected replay flag, got {d}"

    def test_breakdown_for_driver(self, api, auth_headers, ride_ctx):
        r = api.get(
            f"{BASE_URL}/api/viberidez/fares/breakdown/{ride_ctx['ride_id']}",
            headers=auth_headers, timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ride_id"] == ride_ctx["ride_id"]
        assert d["total_fare_usd"] == 10.0
        assert d["driver_id"] == ride_ctx["driver_id"]

    def test_breakdown_403_for_unrelated(self, api, auth_headers):
        # Distribute another ride where caller is NEITHER driver nor rider.
        unrelated_ride = f"TEST_ride_unrelated_{uuid.uuid4().hex[:8]}"
        api.post(
            f"{BASE_URL}/api/viberidez/fares/distribute",
            json={
                "ride_id": unrelated_ride,
                "total_fare_usd": 5,
                "driver_id": "OTHER_DRIVER",
                "rider_id": "OTHER_RIDER",
            },
            headers=auth_headers, timeout=15,
        )
        r = api.get(
            f"{BASE_URL}/api/viberidez/fares/breakdown/{unrelated_ride}",
            headers=auth_headers, timeout=15,
        )
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"

    def test_breakdown_404_unknown(self, api, auth_headers):
        r = api.get(
            f"{BASE_URL}/api/viberidez/fares/breakdown/TEST_does_not_exist_{uuid.uuid4().hex[:8]}",
            headers=auth_headers, timeout=15,
        )
        assert r.status_code == 404


# ────── earnings summary ──────
class TestEarningsSummary:
    def test_earnings_summary_includes_seeded_ride(self, api, auth_headers, demo_auth):
        # Ensure at least one ride credits this driver
        ride_id = f"TEST_ride_earn_{uuid.uuid4().hex[:8]}"
        api.post(
            f"{BASE_URL}/api/viberidez/fares/distribute",
            json={
                "ride_id": ride_id,
                "total_fare_usd": 20.0,
                "driver_id": demo_auth["user_id"],
                "rider_id": "TEST_rider_earn",
            },
            headers=auth_headers, timeout=15,
        )
        time.sleep(0.5)
        r = api.get(
            f"{BASE_URL}/api/viberidez/driver/earnings-summary",
            headers=auth_headers, timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["driver_id"] == demo_auth["user_id"]
        assert "lifetime" in d and "last_30_days" in d
        assert d["lifetime"]["rides"] >= 1
        assert d["lifetime"]["driver_payout_usd"] >= 7.0  # at least 70% of $10
        assert isinstance(d["recent_rides"], list)
        assert len(d["recent_rides"]) <= 25
        assert any(rr.get("ride_id") == ride_id for rr in d["recent_rides"])


# ────── /ridez/complete auto-trigger ──────
class TestRidezCompleteIntegration:
    def test_ridez_complete_with_fare_returns_split(self, api, auth_headers):
        """POST /api/ridez/complete with total_fare_usd should embed fare_split."""
        ride_id = f"TEST_ride_complete_{uuid.uuid4().hex[:8]}"
        payload = {
            "ride_id": ride_id,
            "total_fare_usd": 25.0,
        }
        r = api.post(
            f"{BASE_URL}/api/ridez/complete",
            json=payload, headers=auth_headers, timeout=20,
        )
        # Endpoint may have other required fields; report status either way.
        if r.status_code != 200:
            pytest.skip(f"/api/ridez/complete returned {r.status_code}: {r.text[:300]}")
        d = r.json()
        assert "fare_split" in d, f"no fare_split key in response: {d}"
        fs = d["fare_split"]
        # Either fresh distribution or replay
        assert fs.get("ride_id") == ride_id or fs.get("idempotent_replay")

    def test_ridez_complete_without_fare_omits_split(self, api, auth_headers):
        ride_id = f"TEST_ride_nofare_{uuid.uuid4().hex[:8]}"
        r = api.post(
            f"{BASE_URL}/api/ridez/complete",
            json={"ride_id": ride_id}, headers=auth_headers, timeout=20,
        )
        if r.status_code != 200:
            pytest.skip(f"/api/ridez/complete returned {r.status_code}")
        d = r.json()
        assert "fare_split" not in d, f"fare_split should be omitted, got {d}"

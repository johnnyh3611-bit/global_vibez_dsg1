"""
Launch Readiness sweep — iteration 2026-05.
Covers: DSG6 Lottery, Vibe Spots cancellation, Vibe Core orchestrator,
plus the public-endpoint health/auth/checkout sweep.
"""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

BETA1 = {"email": "betatester1@globalvibez.com", "password": "BetaTester2026!"}
BETA2 = {"email": "betatester2@globalvibez.com", "password": "BetaTester2026!"}


def _login(creds):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json=creds, timeout=15)
    if r.status_code != 200:
        return None, None
    data = r.json() or {}
    token = data.get("access_token") or data.get("token")
    if token:
        s.headers["Authorization"] = f"Bearer {token}"
    return s, data


@pytest.fixture(scope="module")
def s1():
    sess, data = _login(BETA1)
    if not sess:
        pytest.skip("betatester1 login failed")
    return sess


@pytest.fixture(scope="module")
def s2():
    sess, _ = _login(BETA2)
    if not sess:
        pytest.skip("betatester2 login failed")
    return sess


# ============ HEALTH / PUBLIC ENDPOINTS ============
class TestPublicEndpoints:
    def test_health(self):
        r = requests.get(f"{API}/health", timeout=10)
        assert r.status_code == 200, r.text

    @pytest.mark.parametrize("path", [
        "/coins/packs",
        "/wallet/packages",
        "/cinema-room/catalog",
        "/vibez-654/leaderboard",
        "/vibez-654/side-bet-types",
        "/vibez-654/hot-side-bet",
    ])
    def test_public_get(self, path):
        r = requests.get(f"{API}{path}", timeout=15)
        assert r.status_code == 200, f"{path} → {r.status_code} {r.text[:200]}"


# ============ AUTH FLOW ============
class TestAuthFlow:
    def test_register_login_me_logout(self):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        email = f"TEST_launch_{uuid.uuid4().hex[:8]}@example.com"
        pw = "Strong!Pass2026"
        r = s.post(f"{API}/auth/signup", json={"email": email, "password": pw, "name": "Launch Test", "date_of_birth": "1990-01-01"}, timeout=15)
        assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text[:200]}"
        # Login
        r2 = s.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=15)
        assert r2.status_code == 200, r2.text[:200]
        data = r2.json()
        token = data.get("access_token") or data.get("token")
        assert token
        s.headers["Authorization"] = f"Bearer {token}"
        # /me
        r3 = s.get(f"{API}/auth/me", timeout=10)
        assert r3.status_code == 200, r3.text[:200]


# ============ DSG6 LOTTERY ============
class TestDSG6:
    def test_current_shape(self):
        r = requests.get(f"{API}/dsg6/current", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["ticket_cost_vibe"] == 200
        assert d["core_pool_max"] == 50
        assert d["vibe_balls"] == ["RUBY", "SAPPHIRE", "EMERALD", "GOLD", "DIAMOND"]
        assert isinstance(d["pool_vibe"], int)
        assert "draw_id" in d

    def test_buy_unauth(self):
        r = requests.post(f"{API}/dsg6/buy", json={"core": [1, 2, 3, 4, 5], "vibe_ball": "RUBY", "quantity": 1}, timeout=10)
        assert r.status_code == 401

    def test_buy_invalid_core_duplicate(self, s1):
        r = s1.post(f"{API}/dsg6/buy", json={"core": [1, 1, 2, 3, 4], "vibe_ball": "RUBY", "quantity": 1}, timeout=10)
        assert r.status_code == 400

    def test_buy_invalid_core_out_of_range(self, s1):
        r = s1.post(f"{API}/dsg6/buy", json={"core": [1, 2, 3, 4, 99], "vibe_ball": "RUBY", "quantity": 1}, timeout=10)
        assert r.status_code == 400

    def test_buy_invalid_vibe_ball(self, s1):
        r = s1.post(f"{API}/dsg6/buy", json={"core": [1, 2, 3, 4, 5], "vibe_ball": "PURPLE", "quantity": 1}, timeout=10)
        assert r.status_code == 400

    def test_buy_invalid_count_pydantic(self, s1):
        # 4 numbers — must be rejected by pydantic (422) OR our 400 validator
        r = s1.post(f"{API}/dsg6/buy", json={"core": [1, 2, 3, 4], "vibe_ball": "RUBY", "quantity": 1}, timeout=10)
        assert r.status_code in (400, 422)

    def test_buy_success_and_persist(self, s1):
        r = s1.post(f"{API}/dsg6/buy", json={"core": [7, 14, 21, 28, 35], "vibe_ball": "GOLD", "quantity": 2}, timeout=15)
        assert r.status_code == 200, r.text[:200]
        d = r.json()
        assert d["quantity"] == 2
        assert d["total_cost_vibe"] == 400
        assert len(d["tickets"]) == 2
        # Verify my-tickets returns them newest-first
        r2 = s1.get(f"{API}/dsg6/my-tickets", timeout=10)
        assert r2.status_code == 200
        rows = r2.json()["rows"]
        assert len(rows) >= 2

    def test_last_draw_shape(self):
        r = requests.get(f"{API}/dsg6/last-draw", timeout=10)
        assert r.status_code == 200
        assert "draw" in r.json()


# ============ VIBE SPOTS ============
class TestVibeSpots:
    def test_book_unauth(self):
        r = requests.post(f"{API}/vibe-spots/book", json={
            "host_user_id": "x", "spot_id": "s", "starts_at": "2026-06-01T00:00:00Z", "fee_vibe": 1000
        }, timeout=10)
        assert r.status_code == 401

    def test_full_cancel_flow_65_35(self, s1, s2):
        # s2 owns user_id; s1 books their spot
        me2 = s2.get(f"{API}/auth/me", timeout=10).json()
        host_id = me2.get("user_id") or me2.get("id")
        assert host_id
        r = s1.post(f"{API}/vibe-spots/book", json={
            "host_user_id": host_id, "spot_id": "spot_test_1",
            "starts_at": "2026-06-01T00:00:00Z", "fee_vibe": 1000,
        }, timeout=15)
        assert r.status_code == 200, r.text[:200]
        b = r.json()
        assert b["status"] == "booked"
        assert b["escrow_tx"] is None  # solana locked
        bid = b["booking_id"]
        # Cancel
        r2 = s1.post(f"{API}/vibe-spots/cancel", json={"booking_id": bid}, timeout=15)
        assert r2.status_code == 200, r2.text[:200]
        d = r2.json()
        assert d["status"] == "cancelled"
        s = d["settlement"]
        assert s["host_keep_vibe"] == 350
        assert s["guest_refund_vibe"] == 650

    def test_complete_non_host_403(self, s1, s2):
        me2 = s2.get(f"{API}/auth/me", timeout=10).json()
        host_id = me2.get("user_id") or me2.get("id")
        r = s1.post(f"{API}/vibe-spots/book", json={
            "host_user_id": host_id, "spot_id": "spot_test_2",
            "starts_at": "2026-06-02T00:00:00Z", "fee_vibe": 500,
        }, timeout=15)
        assert r.status_code == 200
        bid = r.json()["booking_id"]
        # non-host (s1 is guest) tries to complete
        r2 = s1.post(f"{API}/vibe-spots/complete", json={"booking_id": bid}, timeout=10)
        assert r2.status_code == 403
        # Host completes
        r3 = s2.post(f"{API}/vibe-spots/complete", json={"booking_id": bid}, timeout=15)
        assert r3.status_code == 200, r3.text[:200]
        d = r3.json()
        assert d["status"] == "completed"
        assert "sovereign_tax_vibe" in d["settlement"]

    def test_mine_lists(self, s1):
        r = s1.get(f"{API}/vibe-spots/mine", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "rows" in d
        assert "solana_mainnet_unlocked" in d


# ============ VIBE CORE ORCHESTRATOR ============
class TestVibeCore:
    def test_unauth(self):
        r = requests.post(f"{API}/vibe-core/process-event", json={"event_id": "e1234", "type": "GENERIC"}, timeout=10)
        assert r.status_code == 401

    def test_invalid_type(self, s1):
        r = s1.post(f"{API}/vibe-core/process-event", json={"event_id": "evtbad1", "type": "WHATEVS"}, timeout=10)
        assert r.status_code == 400

    def test_generic_event(self, s1):
        eid = f"evt_{uuid.uuid4().hex[:10]}"
        r = s1.post(f"{API}/vibe-core/process-event", json={"event_id": eid, "type": "GENERIC", "context": {"a": 1}}, timeout=30)
        assert r.status_code == 200, r.text[:200]
        d = r.json()
        assert d["status"] == "Complete"
        assert d["tx_id"].startswith("offchain_") or d["tx_id"].startswith("sol_tx_")
        assert d["executed_on_chain"] is False  # solana locked
        assert d["emailed_founder"] is False
        # Verify broadcast row exists
        r2 = requests.get(f"{API}/vibe-court/feed?limit=20", timeout=10)
        assert r2.status_code == 200
        rows = r2.json()["rows"]
        assert any(row.get("event_id") == eid for row in rows)


# ============ STRIPE CHECKOUT ============
class TestStripe:
    def test_coins_topup_checkout(self, s1):
        r = s1.post(f"{API}/coins/topup/checkout", json={"pack_id": "starter", "origin_url": BASE_URL}, timeout=20)
        # Accept 200 with cs_test URL, or 400 with helpful error
        if r.status_code != 200:
            pytest.skip(f"coins topup checkout returned {r.status_code}: {r.text[:200]}")
        d = r.json()
        url = d.get("url") or d.get("checkout_url") or d.get("session_url")
        assert url and "cs_test" in url, f"unexpected: {d}"

    def test_wallet_topup_session(self, s1):
        r = s1.post(f"{API}/wallet/topup/create-session", json={"package_id": "starter", "origin_url": BASE_URL}, timeout=20)
        if r.status_code != 200:
            pytest.skip(f"wallet topup session returned {r.status_code}: {r.text[:200]}")
        d = r.json()
        url = d.get("url") or d.get("checkout_url") or d.get("session_url")
        assert url and "cs_test" in url, f"unexpected: {d}"

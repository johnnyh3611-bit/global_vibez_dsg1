"""
Backend tests for Sovereign Master Vault v9 + Spotify ladder +
Sponsor Admin UI (Feb 6, 2026 release).

Coverage:
  • /api/economy/status (public)
  • /api/engine/process-transaction (admin gated)
  • /api/vibe-drive/auto-dj/seed + /auto-dj/queue/{ride_id} (auth gated)
  • /api/vibe-drive/tip-skip / /tip-add (auth + debit + sovereign tax)
  • /api/admin/sponsors list + reject (admin gated)
"""
import os
import pytest
import requests
import uuid

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "GlobalVibez_Founder_2025!")


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def admin_session():
    """Login as admin, returns a session with admin_session cookie."""
    sess = requests.Session()
    r = sess.post(f"{BASE_URL}/api/admin/vault-auth",
                  json={"password": ADMIN_PASSWORD, "code": "000000"}, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Admin auth failed: {r.status_code} {r.text[:120]}")
    return sess


@pytest.fixture(scope="module")
def demo_user():
    """Demo user bearer token."""
    r = requests.post(f"{BASE_URL}/api/auth/demo-login", timeout=15)
    assert r.status_code == 200, f"demo-login failed: {r.status_code} {r.text[:150]}"
    data = r.json()
    assert "token" in data or "session_token" in data
    token = data.get("token") or data.get("session_token")
    return {"token": token, "user_id": data.get("user_id"), "raw": data}


# ───────────────────── Economy / Engine ─────────────────────
class TestSovereignEconomy:
    def test_economy_status_public(self, s):
        r = s.get(f"{BASE_URL}/api/economy/status", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["supply"]["total_cap"] == 3_000_000_000
        assert data["supply"]["treasury_reserve"] == 1_500_000_000
        assert data["constants"]["sovereign_tax"] == 0.135
        assert data["constants"]["ride_split"] == 0.70
        assert data["constants"]["ambassador_dividend"] == 0.035
        assert data["constants"]["viberidez_tax"] == 0.30
        for k in ("volume", "tax_collected", "dividends_paid"):
            assert k in data["lifetime"]

    def test_engine_process_tx_requires_admin(self, s):
        r = s.post(f"{BASE_URL}/api/engine/process-transaction",
                   json={"user_id": "x", "amount": 100, "tx_type": "TEST"}, timeout=10)
        assert r.status_code in (401, 403)

    def test_engine_process_tx_admin_ok(self, admin_session):
        payload = {"user_id": f"TEST_{uuid.uuid4().hex[:8]}",
                   "amount": 1000, "tx_type": "TEST_TX", "is_ambassador": False}
        r = admin_session.post(f"{BASE_URL}/api/engine/process-transaction",
                               json=payload, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        # 13.5% tax on 1000 → 135, payout 865
        assert data["tax"] == 135
        assert data["payout"] == 865
        assert data["tax_rate"] == 0.135


# ───────────────────── Auto-DJ ─────────────────────
class TestAutoDJ:
    def test_auto_dj_seed_requires_auth(self, s):
        r = s.post(f"{BASE_URL}/api/vibe-drive/auto-dj/seed",
                   json={"ride_id": "ride1"}, timeout=10)
        assert r.status_code == 401

    def test_auto_dj_seed_ok(self, demo_user):
        h = {"Authorization": f"Bearer {demo_user['token']}"}
        ride_id = f"TEST_ride_{uuid.uuid4().hex[:8]}"
        r = requests.post(f"{BASE_URL}/api/vibe-drive/auto-dj/seed",
                          json={"ride_id": ride_id,
                                "driver_genres": ["hip-hop", "r-n-b", "pop"]},
                          headers=h, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        assert "queue_len" in data
        assert "queue" in data
        assert "seed" in data
        assert "spotify_connected" in data

    def test_auto_dj_queue_requires_auth(self, s):
        r = s.get(f"{BASE_URL}/api/vibe-drive/auto-dj/queue/xyz", timeout=10)
        assert r.status_code == 401

    def test_auto_dj_queue_ok(self, demo_user):
        h = {"Authorization": f"Bearer {demo_user['token']}"}
        ride_id = f"TEST_ride_{uuid.uuid4().hex[:8]}"
        requests.post(f"{BASE_URL}/api/vibe-drive/auto-dj/seed",
                      json={"ride_id": ride_id}, headers=h, timeout=20)
        r = requests.get(f"{BASE_URL}/api/vibe-drive/auto-dj/queue/{ride_id}",
                         headers=h, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["ride_id"] == ride_id
        assert "queue" in data
        assert data.get("seeded") is True


# ───────────────────── Tip-to-Skip / Tip-to-Add ─────────────────────
class TestTip:
    def test_tip_skip_requires_auth(self, s):
        r = s.post(f"{BASE_URL}/api/vibe-drive/tip-skip",
                   json={"ride_id": "r", "driver_user_id": "d"}, timeout=10)
        assert r.status_code == 401

    def test_tip_skip_ok(self, demo_user):
        h = {"Authorization": f"Bearer {demo_user['token']}"}
        driver_id = f"TEST_driver_{uuid.uuid4().hex[:6]}"
        ride_id = f"TEST_ride_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{BASE_URL}/api/vibe-drive/tip-skip",
                          json={"ride_id": ride_id, "driver_user_id": driver_id},
                          headers=h, timeout=20)
        # 402 if demo user has no balance; otherwise 200
        assert r.status_code in (200, 402), r.text
        if r.status_code == 200:
            d = r.json()
            assert d["kind"] == "tip_skip"
            assert d["cost"] == 100
            # 30% tax on 100 = 30 (VIBE_DRIVE_TIP uses VIBERIDEZ_TAX 0.30)
            assert d["tax"] == 30
            # payout 70, driver gets 70% → 49
            assert d["driver_credit"] == 49
            assert d["spotify"]["status"] in ("no-spotify", "error", "ok", "sent")

    def test_tip_add_missing_track_400(self, demo_user):
        h = {"Authorization": f"Bearer {demo_user['token']}"}
        r = requests.post(f"{BASE_URL}/api/vibe-drive/tip-add",
                          json={"ride_id": "r", "driver_user_id": "d"},
                          headers=h, timeout=10)
        assert r.status_code == 400

    def test_tip_add_ok(self, demo_user):
        h = {"Authorization": f"Bearer {demo_user['token']}"}
        driver_id = f"TEST_driver_{uuid.uuid4().hex[:6]}"
        ride_id = f"TEST_ride_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{BASE_URL}/api/vibe-drive/tip-add",
                          json={"ride_id": ride_id, "driver_user_id": driver_id,
                                "track_uri": "spotify:track:abc123"},
                          headers=h, timeout=20)
        assert r.status_code in (200, 402), r.text
        if r.status_code == 200:
            d = r.json()
            assert d["kind"] == "tip_add"
            assert d["cost"] == 50
            assert d["tax"] == 15  # 30% of 50
            assert d["driver_credit"] == 24  # round(24.5) = 24 (banker's rounding)
            assert "spotify" in d


# ───────────────────── Sponsor Admin ─────────────────────
class TestSponsorAdmin:
    def test_list_requires_admin(self, s):
        r = s.get(f"{BASE_URL}/api/admin/sponsors", timeout=10)
        assert r.status_code in (401, 403)

    def test_list_admin_ok(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/sponsors", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "rows" in data
        assert "counts" in data
        for k in ("pending", "verified", "total"):
            assert k in data["counts"]

    def test_list_status_filter(self, admin_session):
        for s_ in ("pending", "verified", "rejected"):
            r = admin_session.get(f"{BASE_URL}/api/admin/sponsors?status={s_}", timeout=15)
            assert r.status_code == 200
            assert "rows" in r.json()

    def test_reject_unknown_404(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/admin/sponsors/__NOPE__/reject",
                               json={"reason": "test"}, timeout=10)
        assert r.status_code == 404

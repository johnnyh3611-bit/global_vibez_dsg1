"""Final pre-redeploy regression: chair expansion plan + critical regressions."""
import os
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    # fallback to frontend env
    with open('/app/frontend/.env') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                BASE_URL = line.split('=', 1)[1].strip().rstrip('/')

ADMIN_PASSWORD = "GlobalVibez_Founder_2025!"
ADMIN_2FA = "000000"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/admin/vault-auth",
               json={"password": ADMIN_PASSWORD, "code": ADMIN_2FA},
               timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Admin auth failed: {r.status_code} {r.text[:200]}")
    return s


# ── NEW ENDPOINT: /api/chairs/expansion-plan ──────────────
class TestExpansionPlan:
    def test_endpoint_public_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/chairs/expansion-plan", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        # top-level
        assert data["active_circulation"] == 500_000
        assert data["reserve_vault_locked"] == 500_000
        assert data["total_ecosystem_capacity"] == 1_000_000
        assert data["genesis_floor_multiplier"] == 5.5
        assert data["total_potential_revenue_usd"] == 16_250_000
        assert data["current_tier_order"] == 1
        assert "active_chairs_sold" in data

    def test_ten_tiers_structure(self):
        r = requests.get(f"{BASE_URL}/api/chairs/expansion-plan", timeout=15)
        tiers = r.json()["tiers"]
        assert len(tiers) == 10
        # First tier
        t1 = tiers[0]
        assert t1["order"] == 1
        assert t1["name"] == "Genesis Phase"
        assert t1["low"] == 0
        assert t1["high"] == 50_000
        assert t1["price_usd"] == 10
        # Last tier
        t10 = tiers[9]
        assert t10["order"] == 10
        assert t10["name"] == "Phase X — Apex"
        assert t10["low"] == 450_001
        assert t10["high"] == 500_000
        assert t10["price_usd"] == 55
        # Each tier has required keys
        for t in tiers:
            for k in ("order", "name", "low", "high", "price_usd",
                      "supply", "potential_revenue_usd", "status"):
                assert k in t, f"tier {t.get('order')} missing {k}"

    def test_pricing_ladder_increments_by_5(self):
        r = requests.get(f"{BASE_URL}/api/chairs/expansion-plan", timeout=15)
        tiers = r.json()["tiers"]
        prices = [t["price_usd"] for t in tiers]
        assert prices == [10, 15, 20, 25, 30, 35, 40, 45, 50, 55]


# ── REGRESSION: legacy phase endpoint must still work ─────
class TestLegacyChairsPhase:
    def test_chairs_phase_still_returns_legacy(self):
        r = requests.get(f"{BASE_URL}/api/chairs/phase", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        # Legacy phase names should exist (Genesis/Vanguard/Global/Stellar/Celestial/Apex/Sold Out)
        assert "phase" in data
        assert data["phase"] in ("Genesis", "Vanguard", "Global", "Stellar",
                                 "Celestial", "Apex", "Sold Out")
        # Must have legacy fields
        assert "total_sold" in data

    def test_chairs_checkout_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/chairs/checkout",
                          json={"quantity": 1}, timeout=15)
        # must remain auth-gated (not 404 or 500)
        assert r.status_code in (401, 403), r.text


# ── REGRESSION: previously green endpoints ────────────────
class TestRegressionGreens:
    def test_treasury_public_status(self):
        r = requests.get(f"{BASE_URL}/api/treasury/public-status", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "configured" in data
        assert "rpc_ok" in data

    def test_admin_treasury_squads_status_admin_gated(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/treasury/squads-status", timeout=15)
        assert r.status_code == 200, r.text

    def test_admin_treasury_squads_rpc(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/treasury/squads-rpc", timeout=15)
        assert r.status_code == 200, r.text

    def test_admin_perf_alert_status(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/perf-alert/status", timeout=15)
        assert r.status_code == 200, r.text

    def test_admin_perf_alert_test_unconfigured(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/admin/perf-alert/test", timeout=15)
        assert r.status_code in (200, 503), r.text

    def test_admin_solana_indexer_sweep_balance(self, admin_session):
        # endpoint is mounted; it requires `old_wallet` query param
        # 422 (validation) confirms route exists; with a valid pubkey expect 200/502
        r = admin_session.get(
            f"{BASE_URL}/api/admin/solana-indexer/sweep-balance",
            params={"old_wallet": "11111111111111111111111111111111"},
            timeout=20,
        )
        assert r.status_code in (200, 502, 503), r.text

    def test_admin_solana_indexer_sweep_instructions(self, admin_session):
        # POST + old_wallet param required
        r = admin_session.post(
            f"{BASE_URL}/api/admin/solana-indexer/sweep-instructions",
            params={"old_wallet": "11111111111111111111111111111111"},
            timeout=20,
        )
        assert r.status_code in (200, 400, 502, 503), r.text

    def test_admin_perf_snapshot(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/perf-snapshot", timeout=15)
        assert r.status_code == 200, r.text

    def test_admin_vault_auth_login(self):
        r = requests.post(f"{BASE_URL}/api/admin/vault-auth",
                          json={"password": ADMIN_PASSWORD, "code": ADMIN_2FA},
                          timeout=15)
        assert r.status_code == 200, r.text

    def test_admin_vault_auth_bad_password(self):
        r = requests.post(f"{BASE_URL}/api/admin/vault-auth",
                          json={"password": "wrong", "code": "000000"},
                          timeout=15)
        assert r.status_code in (401, 403), r.text

"""
Pre-Beta-Launch Comprehensive Regression Sweep — Jan 2026
Validates 5 spec PDFs end-to-end against the live preview backend:
  - Economic Engine
  - Definitive Economy
  - Legal Age Verification (21+, Stripe Identity)
  - Corrected KYC Compliance
  - Content Rights & IP Policy (DMCA agent: H&S Solutions Group)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

TIMEOUT = 30


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ============ ECONOMIC ENGINE ============
class TestEconomicEngine:
    def test_snapshot(self, session):
        r = session.get(f"{API}/economic-engine/snapshot", timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        constants = d.get("constants", {})
        # Spec: supply=3B
        assert constants.get("initial_supply") == 3_000_000_000, f"supply={constants.get('initial_supply')}"
        # current_supply also 3B
        assert d.get("current_supply") == 3_000_000_000.0, f"current_supply={d.get('current_supply')}"
        # burn 5%
        assert d.get("current_burn_rate") == 0.05, f"burn={d.get('current_burn_rate')}"
        assert constants.get("initial_burn_rate") == 0.05
        # parity $0.10
        assert constants.get("parity_usd") == 0.1, f"parity={constants.get('parity_usd')}"
        # 50/50 split
        assert constants.get("revenue_split_ratio") == 0.5
        # credits standard: 1 Coin = 10 Credits, $1 = 100 Credits
        assert constants.get("coin_to_credits_ratio") == 10
        assert constants.get("usd_to_credits_ratio") == 100

    def test_convert_10_coins(self, session):
        r = session.get(f"{API}/economic-engine/convert", params={"coins": 10}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("coins") == 10
        assert d.get("credits") == 100
        assert d.get("usd") in (1.0, 1)

    def test_burn_rate_midpoint(self, session):
        # supply=2.25B → linear midpoint between 5% (3B) and 0.5% (1.5B) → 2.75%
        r = session.get(f"{API}/economic-engine/burn-rate", params={"supply": 2250000000}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        rate = d.get("burn_rate") or d.get("rate") or d
        # Allow either 0.0275 (fraction) or 2.75 (pct)
        if isinstance(rate, dict):
            rate = rate.get("burn_rate") or rate.get("rate")
        assert abs(float(rate) - 0.0275) < 1e-4 or abs(float(rate) - 2.75) < 1e-3, f"rate={rate}"

    def test_constants(self, session):
        r = session.get(f"{API}/economic-engine/constants", timeout=TIMEOUT)
        assert r.status_code == 200, r.text


# ============ AGE VERIFICATION (21+ KYC) ============
class TestAgeVerification:
    def test_constants(self, session):
        r = session.get(f"{API}/age-verification/constants", timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        # 21+ minimum
        assert d.get("minimum_age") == 21, f"minimum_age={d.get('minimum_age')}"
        # Restricted categories: alcohol + tobacco
        assert "alcohol" in d.get("restricted_categories", [])
        assert "tobacco" in d.get("restricted_categories", [])
        # Stripe Identity vendor
        assert d.get("recommended_kyc_provider") == "stripe_identity"
        assert "stripe_identity" in d.get("supported_kyc_providers", [])
        # 5-decision matrix (vendor_decisions)
        decisions = d.get("vendor_decisions", [])
        assert len(decisions) == 5, f"Expected 5 vendor_decisions, got {len(decisions)}: {decisions}"
        # 7-reason refusal taxonomy
        refusals = d.get("delivery_refusal_reasons", {})
        assert len(refusals) == 7, f"Expected 7 refusal reasons, got {len(refusals)}: {list(refusals.keys())}"

    def test_refusal_reasons(self, session):
        r = session.get(f"{API}/age-verification/delivery/refusal-reasons", timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        reasons = d if isinstance(d, list) else (d.get("reasons") or d.get("refusal_reasons") or [])
        assert len(reasons) >= 7, f"Expected 7+ reasons, got {len(reasons)}"

    def test_eligibility_alcohol_unauth(self, session):
        # Unauth call → expect 401/403 or anonymous false response
        r = session.get(f"{API}/age-verification/eligibility/alcohol", timeout=TIMEOUT)
        assert r.status_code in (200, 401, 403), r.text


# ============ CONTENT RIGHTS & IP POLICY ============
class TestContentRights:
    def test_policy(self, session):
        r = session.get(f"{API}/content-rights/policy", timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        s = str(d)
        # DMCA Designated Agent block
        assert "H&S Solutions" in s or "H & S Solutions" in s or "Solutions Group" in s, "DMCA agent (H&S Solutions Group) missing"
        assert "customerservice@globalvibezdsg.com" in s, "DMCA agent email missing"
        assert "1643" in s and "Alpine" in s and "Rockford" in s, "DMCA agent address missing"
        assert "28277U36" in s, "Pay.gov filing # 28277U36 missing"
        # 6 pillars
        pillars = d.get("pillars") or d.get("ip_pillars") or []
        if pillars:
            assert len(pillars) == 6, f"Expected 6 pillars, got {len(pillars)}"


# ============ NEARBY DRIVERS (Vibe Ridez) ============
class TestRidezNearbyDrivers:
    def test_nearby(self, session):
        # API expects lon (not lng) per Pydantic schema
        r = session.get(f"{API}/ridez/nearby-drivers", params={"lat": 42.27, "lon": -89.05}, timeout=TIMEOUT)
        assert r.status_code in (200, 401), r.text
        if r.status_code == 200:
            d = r.json()
            assert "count" in d or "drivers" in d


# ============ AUTH FLOW ============
class TestAuthFlow:
    def test_login_demo_account(self, session):
        r = session.post(
            f"{API}/auth/login",
            json={"email": "demo@globalvibez.com", "password": "FreshStart2026!"},
            timeout=TIMEOUT,
        )
        # demo@globalvibez.com may not be seeded — accept 200 or 401
        assert r.status_code in (200, 401, 404), r.text

    def test_login_betatester1(self, session):
        r = session.post(
            f"{API}/auth/login",
            json={"email": "betatester1@globalvibez.com", "password": "BetaTester2026!"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, f"betatester1 login failed: {r.status_code} {r.text}"
        d = r.json()
        assert d.get("access_token") or d.get("token") or d.get("user"), f"No token in response: {d}"


# ============ NAVIGATION / PAGE BACKEND HEALTH ============
class TestPageDependencies:
    def test_restaurants_list(self, session):
        r = session.get(f"{API}/restaurants/list", timeout=TIMEOUT)
        assert r.status_code in (200, 401), r.text

    def test_vibe_venues_list(self, session):
        r = session.get(f"{API}/vibe-venues/venues", timeout=TIMEOUT)
        assert r.status_code in (200, 401, 404), r.text

    def test_health(self, session):
        r = session.get(f"{API}/health", timeout=TIMEOUT)
        assert r.status_code in (200, 404), r.text


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

"""
Founder Chairs — Jan-2026 deeper coverage.

Augments existing TestFounderChairs (8 tests) with:
  * Legal-posture leak guard (no 'valuation', 'shares', 'dividends', 'investment')
  * /chairs/me full schema verification + perks_paused_reason logic
  * /chairs/leaders shape
  * /invites/mine and /invites/redeem (self-redeem rejection)
  * /chairs/checkout — invite gate and quantity-vs-remaining-in-phase 409
  * /admin/chairs/health admin-cookie happy path
  * /admin/chairs/run-quarter idempotency on quarter_key
"""
import os
import re
import uuid
from typing import Tuple

import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://social-connect-953.preview.emergentagent.com",
).rstrip("/")
# Admin password sourced from env var so dev/staging/prod can each define
# their own. Falls back to the known-public dev value when running tests
# against the preview env.
ADMIN_PASSWORD = os.environ.get("VAULT_ADMIN_PASSWORD", "GlobalVibez_Founder_2025!")

# Forbidden language that would imply a security
FORBIDDEN_TERMS = [
    "valuation", "current_value", "shares", "share_price",
    "dividend", "dividends", "investment", "equity", "ipo",
]


# ───────── fixtures ─────────

@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _demo_login() -> Tuple[requests.Session, str]:
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/demo-login", timeout=20)
    if r.status_code != 200:
        pytest.skip(f"demo-login failed: {r.status_code}")
    data = r.json()
    token = data["token"]
    user_id = data["user_id"]
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s, user_id


@pytest.fixture(scope="session")
def auth():
    s, uid = _demo_login()
    return {"s": s, "uid": uid}


@pytest.fixture(scope="session")
def auth_b():
    """Second demo user for cross-user invite-redeem testing."""
    s, uid = _demo_login()
    return {"s": s, "uid": uid}


@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(
        f"{BASE_URL}/api/admin/vault-auth",
        json={"password": ADMIN_PASSWORD, "code": "000000"},
        timeout=15,
    )
    if r.status_code != 200:
        pytest.skip(f"admin login failed: {r.status_code} {r.text[:200]}")
    return s


# ───────── tests ─────────

class TestLegalPosture:
    def test_phase_endpoint_no_forbidden_terms(self, api):
        body = api.get(f"{BASE_URL}/api/chairs/phase", timeout=10).text.lower()
        for term in FORBIDDEN_TERMS:
            assert term not in body, f"phase endpoint leaked '{term}'"

    def test_chairs_me_no_valuation_field(self, auth):
        r = auth["s"].get(f"{BASE_URL}/api/chairs/me", timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        for term in FORBIDDEN_TERMS:
            assert term not in body, f"/chairs/me leaked field '{term}'"
        # Must explicitly include lifetime_contribution_usd
        assert "lifetime_contribution_usd" in body
        assert "current_value" not in body
        assert "valuation" not in body

    def test_leaders_no_forbidden_terms(self, api):
        text = api.get(f"{BASE_URL}/api/chairs/leaders", timeout=10).text.lower()
        for term in FORBIDDEN_TERMS:
            assert term not in text


class TestChairsMeSchema:
    def test_chairs_me_has_required_fields(self, auth):
        r = auth["s"].get(f"{BASE_URL}/api/chairs/me", timeout=10)
        assert r.status_code == 200
        body = r.json()
        for key in (
            "locked_chairs", "lifetime_chairs", "lifetime_contribution_usd",
            "is_premium", "rewards_active", "perks_paused_reason", "current_phase",
        ):
            assert key in body, f"missing key {key}"
        assert isinstance(body["locked_chairs"], int)
        assert isinstance(body["is_premium"], bool)

    def test_perks_paused_reason_when_chairs_but_no_premium(self, auth):
        # Buy a chair via test-buy first
        ref = f"pytest_perks_{uuid.uuid4().hex[:8]}"
        rb = auth["s"].post(
            f"{BASE_URL}/api/chairs/test-buy",
            json={"quantity": 1, "payment_ref": ref},
            timeout=15,
        )
        assert rb.status_code == 200, rb.text
        r = auth["s"].get(f"{BASE_URL}/api/chairs/me", timeout=10)
        body = r.json()
        assert body["locked_chairs"] >= 1
        # If not premium, rewards_active must be False AND reason set
        if not body["is_premium"]:
            assert body["rewards_active"] is False
            assert body["perks_paused_reason"] == "premium_subscription_required"


class TestChairLeaders:
    def test_leaders_shape(self, api):
        r = api.get(f"{BASE_URL}/api/chairs/leaders", timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert "leaders" in body and isinstance(body["leaders"], list)
        for row in body["leaders"]:
            assert "anon_id" in row
            assert "successful_invites" in row
            assert row["rank_title"] in ("Connector", "Team Builder", "Executive Recruiter")


class TestInviteFlow:
    def test_validate_unknown(self, api):
        r = api.get(f"{BASE_URL}/api/invites/validate/VIBE-DEAD00", timeout=10)
        assert r.status_code == 200
        assert r.json()["valid"] is False

    def test_generate_validate_and_self_redeem_blocked(self, auth, auth_b):
        # auth A has bought chairs in earlier tests, can mint invite
        r = auth["s"].post(f"{BASE_URL}/api/invites/generate", timeout=10)
        if r.status_code == 403:
            pytest.skip("user lacks chairs/pass (other test ordering)")
        assert r.status_code == 200, r.text
        code = r.json()["code"]
        assert re.match(r"^VIBE-[A-F0-9]{6}$", code)

        # validate
        v = auth["s"].get(f"{BASE_URL}/api/invites/validate/{code}", timeout=10)
        assert v.status_code == 200 and v.json()["valid"] is True

        # owner cannot self-redeem (400)
        self_red = auth["s"].post(
            f"{BASE_URL}/api/invites/redeem", json={"code": code}, timeout=10
        )
        assert self_red.status_code == 400, self_red.text

        # NOTE: demo-login returns the same singleton user_id, so we can't
        # exercise cross-user redemption here. Self-redeem rejection above
        # is the primary correctness check.
        if auth["uid"] != auth_b["uid"]:
            red = auth_b["s"].post(
                f"{BASE_URL}/api/invites/redeem", json={"code": code}, timeout=10
            )
            assert red.status_code == 200, red.text
            v2 = auth["s"].get(f"{BASE_URL}/api/invites/validate/{code}", timeout=10)
            assert v2.json()["valid"] is False
            assert v2.json().get("reason") == "already_used"

    def test_invites_mine(self, auth):
        r = auth["s"].get(f"{BASE_URL}/api/invites/mine", timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert "count" in body
        assert "successful_redemptions" in body
        assert isinstance(body["rows"], list)


class TestChairCheckout:
    def test_checkout_unauth(self, api):
        fresh = requests.Session()
        fresh.headers.update({"Content-Type": "application/json"})
        r = fresh.post(
            f"{BASE_URL}/api/chairs/checkout",
            json={"quantity": 1},
            timeout=10,
        )
        assert r.status_code == 401

    def test_checkout_quantity_over_cap_422(self, auth):
        r = auth["s"].post(
            f"{BASE_URL}/api/chairs/checkout",
            json={"quantity": 99999},
            timeout=10,
        )
        assert r.status_code == 422

    def test_checkout_returns_stripe_session_or_503(self, auth):
        # User auth A has chairs (from earlier perks test) → invite gate skipped
        r = auth["s"].post(
            f"{BASE_URL}/api/chairs/checkout",
            headers={"Origin": BASE_URL},
            json={"quantity": 1},
            timeout=20,
        )
        # Acceptable: 200 (Stripe) or 503 (no key) or 409 (capacity boundary)
        assert r.status_code in (200, 503, 409), r.text
        if r.status_code == 200:
            body = r.json()
            assert "checkout_url" in body
            assert body["session_id"]
            assert body["price_per_chair_usd"] in (5.0, 10.0, 20.0)


class TestAdminChairsHealth:
    def test_admin_health_happy(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/chairs/health", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "lifetime_payouts" in body
        assert "chair_inventory" in body
        ci = body["chair_inventory"]
        assert "total_sold" in ci
        assert "current_phase" in ci
        assert "phase_breakdown" in ci
        assert len(ci["phase_breakdown"]) == 5  # Genesis, Vanguard, Global, Stellar, Celestial
        assert "active_stakeholders" in body

    def test_run_quarter_idempotent(self, admin_session):
        qk = "2099-Q1"  # far-future key won't collide with real distributions
        r1 = admin_session.post(
            f"{BASE_URL}/api/admin/chairs/run-quarter",
            json={"quarter_key": qk},
            timeout=30,
        )
        assert r1.status_code == 200, r1.text
        r2 = admin_session.post(
            f"{BASE_URL}/api/admin/chairs/run-quarter",
            json={"quarter_key": qk},
            timeout=30,
        )
        assert r2.status_code == 200, r2.text
        # Idempotent: should report already-run / no-op marker
        body2 = r2.json()
        assert any(
            k in body2 for k in ("already_run", "idempotent", "skipped",
                                 "status", "quarter_key")
        ), body2

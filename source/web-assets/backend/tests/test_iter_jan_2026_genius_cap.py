"""Tests for Genius Phase per-user cap (Jan 2026 PDF spec).

Covers:
  - GET /api/chairs/genius-cap (no auth)
  - GET /api/chairs/genius-cap (with Bearer demo token → user_remaining)
  - GET /api/chairs/economics exposes new fields
  - POST /api/admin/chairs/genius-cap/toggle (admin cookie required)
  - Cap enforcement via _genius_cap_remaining (direct invariants)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")
ADMIN_PASSWORD = "GlobalVibez_Founder_2025!"
ADMIN_2FA = "000000"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def demo_token(s):
    r = s.post(f"{BASE_URL}/api/auth/demo-login", timeout=30)
    assert r.status_code == 200, f"demo-login failed: {r.status_code} {r.text}"
    body = r.json()
    tok = body.get("token") or body.get("session_token")
    assert tok, f"no token in demo-login response: {body}"
    return tok, body.get("user_id")


@pytest.fixture(scope="module")
def admin_session(s):
    r = s.post(f"{BASE_URL}/api/admin/vault-auth",
               json={"password": ADMIN_PASSWORD, "code": ADMIN_2FA}, timeout=30)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    # Cookie is set automatically on the session
    assert any(c.name == "admin_session" for c in s.cookies), "admin_session cookie not set"
    return s


# ────────────────────────── /api/chairs/genius-cap (public) ──────────────────────────
class TestGeniusCapPublic:
    def test_public_shape(self, s):
        r = requests.get(f"{BASE_URL}/api/chairs/genius-cap", timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        # Required keys
        for k in ("current_phase", "cap_active", "per_user_cap", "genius_phase_limit",
                  "genius_sold", "genius_remaining_total", "user_remaining", "total_supply"):
            assert k in d, f"missing key {k} in response: {d}"
        assert d["per_user_cap"] == 100
        assert d["genius_phase_limit"] == 50000
        assert d["total_supply"] == 1_000_000
        assert d["user_remaining"] is None  # not authed
        assert isinstance(d["genius_sold"], int)
        assert d["genius_remaining_total"] == max(0, 50000 - d["genius_sold"])

    def test_genius_sold_matches_db(self):
        """REGRESSION: genius_sold should reflect actual Genius purchases.
        Currently broken by spurious `status: 'active'` filter in the
        aggregation pipeline — _grant_chairs never writes a status field."""
        import os
        os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
        from pymongo import MongoClient
        client = MongoClient(os.environ["MONGO_URL"])
        db = client[os.environ.get("DB_NAME", "test_database")]
        pipeline = [{"$match": {"phase_at_purchase": "Genius"}},
                    {"$group": {"_id": None, "sold": {"$sum": "$quantity"}}}]
        agg = list(db.chair_purchases.aggregate(pipeline))
        actual_sold = int(agg[0]["sold"]) if agg else 0
        r = requests.get(f"{BASE_URL}/api/chairs/genius-cap", timeout=20)
        api_sold = r.json()["genius_sold"]
        assert api_sold == actual_sold, (
            f"genius_sold mismatch: API returned {api_sold} but DB has "
            f"{actual_sold} Genius chairs purchased. Likely caused by "
            f"`status: active` filter in aggregation excluding all docs."
        )

    def test_authed_user_remaining(self, demo_token):
        token, _ = demo_token
        r = requests.get(f"{BASE_URL}/api/chairs/genius-cap",
                         headers={"Authorization": f"Bearer {token}"}, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        # When cap is active, user_remaining should be an int between 0..100.
        # When cap is NOT active (admin lifted or phase past Genius), it's None.
        if d["cap_active"]:
            assert isinstance(d["user_remaining"], int), f"user_remaining should be int when cap active, got {d}"
            assert 0 <= d["user_remaining"] <= 100
        else:
            assert d["user_remaining"] is None


# ────────────────────────── /api/chairs/economics ──────────────────────────
class TestEconomicsExposesCap:
    def test_economics_exposes_new_fields(self, s):
        r = requests.get(f"{BASE_URL}/api/chairs/economics", timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("genius_user_cap") == 100, f"genius_user_cap missing or wrong: {d}"
        assert d.get("genius_phase_limit") == 50000
        assert d.get("total_supply") == 1_000_000
        assert "genius_cap_active" in d
        assert isinstance(d["genius_cap_active"], bool)


# ────────────────────────── Admin toggle ──────────────────────────
class TestAdminToggle:
    def test_non_admin_blocked(self):
        # Plain requests with no admin cookie
        r = requests.post(f"{BASE_URL}/api/admin/chairs/genius-cap/toggle",
                          json={"lifted": True}, timeout=20)
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code} {r.text}"

    def test_admin_lift_then_reengage(self, admin_session):
        # Lift
        r1 = admin_session.post(f"{BASE_URL}/api/admin/chairs/genius-cap/toggle",
                                json={"lifted": True}, timeout=20)
        assert r1.status_code == 200, r1.text
        assert r1.json().get("lifted") is True

        # Verify via public endpoint
        r2 = requests.get(f"{BASE_URL}/api/chairs/genius-cap", timeout=20)
        assert r2.status_code == 200
        d2 = r2.json()
        # cap_active should now be False if current phase is Genius
        if d2["current_phase"] == "Genius":
            assert d2["cap_active"] is False, f"expected cap lifted, got {d2}"

        # Re-engage (leave production state CAP-ON at end of test)
        r3 = admin_session.post(f"{BASE_URL}/api/admin/chairs/genius-cap/toggle",
                                json={"lifted": False}, timeout=20)
        assert r3.status_code == 200, r3.text
        assert r3.json().get("lifted") is False

        # Verify
        r4 = requests.get(f"{BASE_URL}/api/chairs/genius-cap", timeout=20)
        d4 = r4.json()
        if d4["current_phase"] == "Genius":
            assert d4["cap_active"] is True, f"expected cap re-engaged, got {d4}"


# ────────────────────────── Cap math invariants ──────────────────────────
class TestCapMath:
    def test_remaining_consistent_with_phase(self, demo_token, s):
        """When cap is active and user_remaining=R, lifting cap should
        flip cap_active False AND user_remaining to None."""
        token, _ = demo_token
        # Get initial state
        r0 = requests.get(f"{BASE_URL}/api/chairs/genius-cap",
                          headers={"Authorization": f"Bearer {token}"}, timeout=20)
        d0 = r0.json()
        initial_phase = d0["current_phase"]

        # Login admin to flip the toggle
        admin = requests.Session()
        ar = admin.post(f"{BASE_URL}/api/admin/vault-auth",
                        json={"password": ADMIN_PASSWORD, "code": ADMIN_2FA}, timeout=30)
        if ar.status_code != 200:
            pytest.skip(f"admin auth failed: {ar.status_code}")

        try:
            # Lift cap
            admin.post(f"{BASE_URL}/api/admin/chairs/genius-cap/toggle",
                       json={"lifted": True}, timeout=20)
            r1 = requests.get(f"{BASE_URL}/api/chairs/genius-cap",
                              headers={"Authorization": f"Bearer {token}"}, timeout=20)
            d1 = r1.json()
            if initial_phase == "Genius":
                assert d1["cap_active"] is False
                assert d1["user_remaining"] is None
        finally:
            # Always restore cap-on
            admin.post(f"{BASE_URL}/api/admin/chairs/genius-cap/toggle",
                       json={"lifted": False}, timeout=20)

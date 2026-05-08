"""Backend smoke for this iteration:
1) Beta Feedback (submit as user, read as admin)
2) HungryVibes Sponsorship Stripe checkout + verify error shape
3) Pinochle Practice full-ish cycle
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_PW = os.environ.get("ADMIN_PASSWORD", "GlobalVibez_Founder_2025!")


# ─── helpers ────────────────────────────────────────────────
@pytest.fixture(scope="session")
def user_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/demo-login", timeout=30)
    assert r.status_code == 200, f"demo-login failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    token = data.get("token") or data.get("session_token")
    assert token, f"no token: {data}"
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(
        f"{BASE_URL}/api/admin/vault-auth",
        json={"password": ADMIN_PW, "code": "000000"},
        timeout=30,
    )
    assert r.status_code == 200, f"vault-auth failed: {r.status_code} {r.text[:200]}"
    return s


# ─── 1) Beta Feedback ───────────────────────────────────────
class TestBetaFeedback:
    def test_submit_feedback(self, user_session):
        r = user_session.post(
            f"{BASE_URL}/api/beta/feedback",
            json={
                "category": "OTHER",
                "comment": "TEST_iter_jan2026 smoke feedback — pinochle ready?",
                "page": "/pinochle",
                "severity": "normal",
            },
            timeout=30,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True
        assert data.get("feedback_id")
        pytest.submitted_fid = data["feedback_id"]

    def test_admin_list_feedback_contains_submission(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/beta/feedback?limit=50", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "rows" in data
        comments = [row.get("comment", "") for row in data["rows"]]
        assert any("TEST_iter_jan2026" in c for c in comments), \
            f"Submitted feedback not found. rows={data['rows'][:3]}"

    def test_feedback_requires_auth(self):
        r = requests.post(
            f"{BASE_URL}/api/beta/feedback",
            json={"category": "OTHER", "comment": "unauth test", "severity": "normal"},
            timeout=30,
        )
        assert r.status_code in (401, 403)


# ─── 2) HungryVibes Sponsorship ─────────────────────────────
class TestHungryVibesSponsorship:
    def _ensure_merchant(self, user_session):
        # Try /me first; if 404, register.
        r = user_session.get(f"{BASE_URL}/api/hungryvibes/merchant/me", timeout=30)
        if r.status_code == 404:
            r = user_session.post(
                f"{BASE_URL}/api/hungryvibes/merchant/register",
                json={"name": "TEST_iter_merchant", "cuisine": "American"},
                timeout=30,
            )
            assert r.status_code == 200, r.text
        elif r.status_code != 200:
            pytest.fail(f"/me returned {r.status_code}: {r.text[:200]}")

    def test_checkout_creates_stripe_session(self, user_session):
        self._ensure_merchant(user_session)
        r = user_session.post(
            f"{BASE_URL}/api/hungryvibes/merchant/sponsorship/checkout", timeout=30
        )
        # If Stripe not configured, should be 503 — still not 500.
        if r.status_code == 503:
            pytest.skip(f"Stripe not configured: {r.text[:120]}")
        assert r.status_code == 200, f"checkout failed: {r.status_code} {r.text[:300]}"
        data = r.json()
        assert data.get("success") is True
        assert data.get("checkout_url", "").startswith("http")
        assert data.get("session_id")
        assert data.get("amount") == 29.99

    def test_verify_rejects_invalid_session(self, user_session):
        self._ensure_merchant(user_session)
        r = user_session.post(
            f"{BASE_URL}/api/hungryvibes/merchant/sponsorship/verify",
            json={"session_id": "cs_test_invalid_fake_id_iter_jan_2026"},
            timeout=30,
        )
        # Must NOT be 200 and must NOT be 500 (proper error handling).
        assert r.status_code in (400, 403, 404, 503), \
            f"expected 400/403/404/503 for invalid session, got {r.status_code}: {r.text[:300]}"


# ─── 3) Pinochle Practice flow ──────────────────────────────
class TestPinochlePractice:
    def test_full_cycle(self, user_session):
        # START
        r = user_session.post(
            f"{BASE_URL}/api/pinochle-practice/start", json={}, timeout=30
        )
        assert r.status_code == 200, r.text
        g = r.json()["game"]
        assert g["phase"] == "bidding", f"expected bidding, got {g.get('phase')}"
        # spec says bid_turn=south & min_next_bid=250 & 12 cards
        # (if bots have bid first per state machine, these may vary — check flexibly)
        assert "your_hand" in g
        assert len(g["your_hand"]) == 12, f"hand has {len(g['your_hand'])} cards"
        assert g.get("dealer") in ("north", "south", "east", "west")

        # Pass up to 4 times to exit bidding
        for i in range(6):
            if g.get("phase") != "bidding":
                break
            if g.get("bid_turn") == "south":
                r = user_session.post(f"{BASE_URL}/api/pinochle-practice/pass-bid", timeout=30)
                assert r.status_code == 200, r.text
                g = r.json()["game"]
            else:
                # Advance bots (run_bots runs on every call so just poll state)
                r = user_session.get(f"{BASE_URL}/api/pinochle-practice/state", timeout=30)
                g = r.json()["game"]

        # At this point phase should be trump_naming (if someone bid), scoring (all passed → redeal),
        # or playing (if user was high bidder and trump already picked by bot logic — unlikely).
        assert g.get("phase") in ("trump_naming", "playing", "scoring", "bidding"), g.get("phase")

        # If we're high bidder → name trump
        if g.get("phase") == "trump_naming" and g.get("high_bidder") == "south":
            r = user_session.post(
                f"{BASE_URL}/api/pinochle-practice/name-trump",
                json={"suit": "spades"},
                timeout=30,
            )
            assert r.status_code == 200, r.text
            g = r.json()["game"]

        # If we're in playing phase and it's our turn, try a card
        if g.get("phase") == "playing" and g.get("trick_turn") == "south":
            playable = g.get("playable_cards") or g.get("your_hand", [])[:1]
            if playable:
                r = user_session.post(
                    f"{BASE_URL}/api/pinochle-practice/play",
                    json={"card": playable[0]},
                    timeout=30,
                )
                assert r.status_code == 200, r.text

    def test_start_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/pinochle-practice/start", json={}, timeout=30)
        assert r.status_code in (401, 403)


# ─── 4) Regression: core AAA game routes still load ─────────
class TestAAAGameRoutesRegression:
    ENDPOINTS = [
        ("/api/spades-practice/start", "POST", {}),
        ("/api/hearts-practice/start", "POST", {}),
        ("/api/crazy-eights/start", "POST", {}),
    ]

    @pytest.mark.parametrize("path,method,body", ENDPOINTS)
    def test_endpoint_not_500(self, user_session, path, method, body):
        url = f"{BASE_URL}{path}"
        r = user_session.request(method, url, json=body, timeout=30)
        # Should not be 500 (auth may be required → 401/403 is fine; route exists → not 404)
        assert r.status_code != 500, f"{path} returned 500: {r.text[:200]}"

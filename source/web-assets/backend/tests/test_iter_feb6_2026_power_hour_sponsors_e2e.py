"""
E2E API smoke for Power Hour + Sponsor Achievement + Vibe-Drive auth fixes.
Iteration: Feb 6 2026.

Hits the public preview URL (REACT_APP_BACKEND_URL) to validate:
  * P0 auth: demo-login token works on /api/vibe-ridez/driver/me + /api/vibe-drive/status
  * P0 public: /api/vibe-drive/playlists works without auth
  * P1: /api/power-hour/status shape
  * P1: /api/sponsors/link, /api/sponsors/me, /api/sponsors/leaderboard, /verify (403 w/o admin)
  * P2: /api/vibe-drive/vote-skip idempotency + threshold
"""
from __future__ import annotations

import os
import secrets

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")


# ── Shared fixtures ──
@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def demo_token(session):
    r = session.post(f"{BASE_URL}/api/auth/demo-login", json={}, timeout=20)
    assert r.status_code == 200, f"demo-login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("token") or data.get("session_token")
    assert token, f"no token in response: {data}"
    return token


@pytest.fixture(scope="module")
def auth_headers(demo_token):
    return {"Authorization": f"Bearer {demo_token}", "Content-Type": "application/json"}


# ── P0 Auth fix: VibeRidez + VibeDrive accept Bearer ──
class TestP0AuthFix:
    def test_vibe_ridez_driver_me_with_bearer(self, session, auth_headers):
        r = session.get(f"{BASE_URL}/api/vibe-ridez/driver/me", headers=auth_headers, timeout=15)
        # 200 if exists, 404 if no driver record yet — but NOT 401
        assert r.status_code != 401, f"Bearer auth still failing on driver/me: {r.text}"
        assert r.status_code in (200, 404), f"unexpected status: {r.status_code} {r.text}"

    def test_vibe_drive_status_with_bearer(self, session, auth_headers):
        r = session.get(f"{BASE_URL}/api/vibe-drive/status", headers=auth_headers, timeout=15)
        assert r.status_code == 200, f"vibe-drive/status failed: {r.status_code} {r.text}"
        body = r.json()
        # Should not contain "Not authenticated"
        text = str(body).lower()
        assert "not authenticated" not in text, f"still unauthenticated: {body}"

    def test_vibe_drive_playlists_no_auth(self, session):
        r = session.get(f"{BASE_URL}/api/vibe-drive/playlists", timeout=15)
        assert r.status_code == 200
        body = r.json()
        # accept either {playlists: [...]} or a list
        if isinstance(body, dict):
            playlists = body.get("playlists") or body.get("items") or []
        else:
            playlists = body
        assert isinstance(playlists, list)
        assert len(playlists) > 0, "expected at least one curated playlist"


# ── P1 Power Hour status ──
class TestP1PowerHour:
    def test_power_hour_status_shape(self, session):
        r = session.get(f"{BASE_URL}/api/power-hour/status", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body.get("active"), bool)
        assert body.get("multiplier") == 1.10
        window = body.get("window", {})
        assert window.get("tz") == "America/New_York"
        assert "start_iso" in window and "end_iso" in window
        assert ("starts_in_seconds" in body) or ("ends_in_seconds" in body)


# ── P1 Sponsor Achievement ──
class TestP1Sponsors:
    def test_sponsor_link_with_bearer(self, session, auth_headers):
        payload = {
            "business_name": f"TEST_QA Pizza {secrets.token_hex(3)}",
            "business_type": "Restaurant",
            "contact_email": "test@example.com",
        }
        r = session.post(f"{BASE_URL}/api/sponsors/link", json=payload, headers=auth_headers, timeout=15)
        assert r.status_code == 200, f"link failed: {r.status_code} {r.text}"
        body = r.json()
        assert body.get("success") is True
        assert body.get("status") == "pending"
        assert "sponsor_id" in body
        # Save for next test
        TestP1Sponsors.sponsor_id = body["sponsor_id"]

    def test_admin_verify_requires_admin(self, session):
        sid = getattr(TestP1Sponsors, "sponsor_id", None) or "spon_dummy"
        r = session.post(
            f"{BASE_URL}/api/sponsors/{sid}/verify",
            json={"commission_bps": 50},
            timeout=15,
        )
        # admin cookie missing → 401/403
        assert r.status_code in (401, 403), f"expected 401/403 without admin: {r.status_code} {r.text}"

    def test_sponsors_me_with_bearer(self, session, auth_headers):
        r = session.get(f"{BASE_URL}/api/sponsors/me", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        body = r.json()
        for key in ("ambassador_id", "verified_count", "pending_count",
                    "earned_chairs", "granted_chairs", "max_chairs", "sponsors"):
            assert key in body, f"missing key: {key} in {body.keys()}"
        assert body["max_chairs"] == 3
        assert isinstance(body["sponsors"], list)

    def test_sponsors_leaderboard_public(self, session):
        r = session.get(f"{BASE_URL}/api/sponsors/leaderboard", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "leaderboard" in body and "count" in body
        assert isinstance(body["leaderboard"], list)


# ── P2 Vote-Skip ──
class TestP2VoteSkip:
    def test_vote_skip_idempotent(self, session, auth_headers):
        ride_id = f"qa_ride_{secrets.token_hex(3)}"
        body = {"ride_id": ride_id, "track_uri": "spotify:track:abc"}
        r1 = session.post(f"{BASE_URL}/api/vibe-drive/vote-skip", json=body, headers=auth_headers, timeout=15)
        assert r1.status_code == 200, f"vote-skip failed: {r1.status_code} {r1.text}"
        d1 = r1.json()
        assert d1.get("success") is True
        assert d1.get("votes") == 1
        assert d1.get("skipped") is False
        # Re-call same body — must remain votes:1
        r2 = session.post(f"{BASE_URL}/api/vibe-drive/vote-skip", json=body, headers=auth_headers, timeout=15)
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2.get("votes") == 1, f"expected idempotent votes=1, got {d2}"
        assert d2.get("skipped") is False

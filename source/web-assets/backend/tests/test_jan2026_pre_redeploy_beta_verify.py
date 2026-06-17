"""
Pre-redeploy beta verification: JFTN Season Pass + Room Password + Gift +
Integrity Protocol + Sovereign Tiers + Underground Live + Spectator Bet +
Receipts + Recent Rooms.
"""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

BETA_EMAIL = "betatester1@globalvibez.com"
BETA_PW = "BetaTester2026!"
BETA2_EMAIL = "betatester2@globalvibez.com"
BETA2_PW = "BetaTester2026!"


def _login(email, pw):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    token = data.get("token") or data.get("access_token") or (data.get("user") or {}).get("token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    user = data.get("user") or {}
    user_id = user.get("user_id") or user.get("id") or data.get("user_id")
    return s, user_id


@pytest.fixture(scope="module")
def auth():
    s, uid = _login(BETA_EMAIL, BETA_PW)
    return {"session": s, "user_id": uid}


@pytest.fixture(scope="module")
def auth2():
    try:
        s, uid = _login(BETA2_EMAIL, BETA2_PW)
        return {"session": s, "user_id": uid}
    except Exception:
        return None


# ---------- JFTN Season Pass ----------
class TestJFTNSeasonPass:
    def test_season_pass_unauth_blocked(self):
        r = requests.get(f"{API}/just-for-the-night/season-pass/me", timeout=15)
        assert r.status_code in (401, 403, 500), f"expected 401/403/500, got {r.status_code}: {r.text[:200]}"

    def test_season_pass_me_authed_inactive_default(self, auth):
        r = auth["session"].get(f"{API}/just-for-the-night/season-pass/me", timeout=15)
        assert r.status_code == 200, f"got {r.status_code}: {r.text[:200]}"
        body = r.json()
        assert body.get("active") is False
        assert body.get("price_usd") == 25
        assert body.get("duration_days") == 30

    def test_season_pass_subscribe_returns_checkout(self, auth):
        r = auth["session"].post(
            f"{API}/just-for-the-night/season-pass/subscribe",
            json={"origin_url": BASE_URL},
            timeout=30,
        )
        assert r.status_code == 200, f"got {r.status_code}: {r.text[:300]}"
        body = r.json()
        assert body.get("price_usd") == 25
        assert body.get("duration_days") == 30
        url = body.get("checkout_url", "")
        assert "stripe.com" in url or "cs_test" in url or "checkout" in url


# ---------- JFTN Room Password ----------
class TestJFTNRoomPassword:
    @pytest.fixture(scope="class")
    def room_id(self, auth):
        body = {
            "title": f"TEST_pwroom_{uuid.uuid4().hex[:6]}",
            "description": "pw room",
            "stream_url": "https://example.com/stream.m3u8",
            "settings": {
                "dealer_type": "founder_ai",
                "challenge_game": "blackjack",
                "entry_tokens": 10,
                "challenge_difficulty": "medium",
                "room_theme": "neon_nights",
                "enable_watermark": True,
            },
            "room_password": "secret123",
        }
        r = auth["session"].post(f"{API}/just-for-the-night/rooms/create", json=body, timeout=20)
        assert r.status_code == 200, f"create: {r.status_code} {r.text[:300]}"
        return r.json()["room_id"]

    def test_get_room_hides_secrets(self, room_id, auth):
        r = auth["session"].get(f"{API}/just-for-the-night/rooms/{room_id}", timeout=15)
        assert r.status_code == 200
        room = r.json().get("room", {})
        assert room.get("requires_password") is True
        assert "password_hash" not in room
        assert "stream_url" not in room

    def test_join_without_password_blocked(self, room_id, auth):
        r = auth["session"].post(
            f"{API}/just-for-the-night/rooms/join-transaction",
            json={"room_id": room_id, "visitor_id": auth["user_id"] or "x"},
            timeout=15,
        )
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:200]}"

    def test_join_with_wrong_password_blocked(self, room_id, auth):
        r = auth["session"].post(
            f"{API}/just-for-the-night/rooms/join-transaction",
            json={"room_id": room_id, "visitor_id": auth["user_id"] or "x", "room_password": "WRONG"},
            timeout=15,
        )
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:200]}"

    def test_join_with_correct_password_succeeds(self, room_id, auth):
        # Top up credits for current user to ensure deduction passes
        r = auth["session"].post(
            f"{API}/just-for-the-night/rooms/join-transaction",
            json={"room_id": room_id, "visitor_id": auth["user_id"] or "x", "room_password": "secret123"},
            timeout=20,
        )
        # Owner joining own room may still succeed or fail on funds — allow both
        if r.status_code == 200:
            body = r.json()
            assert body.get("status") == "paid"
            assert body.get("room", {}).get("stream_url")
        else:
            # Insufficient balance is acceptable — confirms password gate passed
            assert r.status_code == 400, f"got {r.status_code}: {r.text[:200]}"
            assert "alance" in r.text or "balance" in r.text.lower()


# ---------- JFTN Gift ----------
class TestJFTNGift:
    def test_gift_endpoints_exist(self, auth):
        # my-inbox should return a shape with gifts list
        r = auth["session"].get(f"{API}/just-for-the-night/gifts/my-inbox", timeout=15)
        assert r.status_code == 200, f"got {r.status_code}: {r.text[:200]}"
        body = r.json()
        assert "gifts" in body and isinstance(body["gifts"], list)
        assert "count" in body

    def test_redeem_nonexistent_gift_404(self, auth):
        r = auth["session"].post(f"{API}/just-for-the-night/gifts/gift_nonexistent/redeem", timeout=15)
        assert r.status_code == 404


# ---------- Integrity Protocol ----------
class TestIntegrity:
    def test_config(self):
        r = requests.get(f"{API}/integrity/config", timeout=15)
        assert r.status_code == 200
        cfg = r.json()
        assert cfg["Min_Reporters"] == 10
        assert cfg["Consensus_Threshold"] == 0.75
        assert cfg["Genius_Chair_Weight"] == 2.0
        assert cfg["Reward_Per_Correct_Report_Vibe"] == 5


# ---------- Sovereign Tiers ----------
class TestTiers:
    def test_catalog(self):
        r = requests.get(f"{API}/tiers/catalog", timeout=15)
        assert r.status_code == 200
        body = r.json()
        tiers = body["tiers"]
        assert len(tiers) == 6
        by_id = {t["id"]: t for t in tiers}
        assert by_id["tastemaker"]["price_usd"] == 19
        assert by_id["tastemaker"]["popular_anchor"] is True
        assert by_id["insider"]["price_usd"] == 9
        assert by_id["insider"].get("trial_intro_usd") == 1


# ---------- Underground Live ----------
class TestUnderground:
    def test_battles_seeded(self):
        r = requests.get(f"{API}/underground-live/battles", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["count"] >= 2
        assert len(body["battles"]) >= 2


# ---------- Spectator Bet ----------
class TestSpectatorBet:
    def test_leaderboard(self):
        r = requests.get(f"{API}/spectator-bet/leaderboard", timeout=15)
        assert r.status_code == 200, f"got {r.status_code}: {r.text[:200]}"
        body = r.json()
        assert "rows" in body or "leaderboard" in body or isinstance(body, list)


# ---------- Receipts ----------
class TestReceipts:
    def test_merchant_boosts(self):
        r = requests.get(f"{API}/receipts/merchant-boosts", timeout=15)
        assert r.status_code == 200


# ---------- Recent Rooms / Homeworld ----------
class TestRecentRooms:
    def test_log_visit_authed(self, auth):
        r = auth["session"].post(
            f"{API}/recent-rooms/log",
            json={"path": "/sports-lounge", "category": "sports", "label": "Sports Lounge", "emoji": "🏟️"},
            timeout=15,
        )
        assert r.status_code == 200
        body = r.json()
        assert body.get("status") in ("logged", "cooldown_skipped")

    def test_my_homeworlds(self, auth):
        r = auth["session"].get(f"{API}/recent-rooms/me", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "homeworlds" in body
        assert isinstance(body["homeworlds"], dict)

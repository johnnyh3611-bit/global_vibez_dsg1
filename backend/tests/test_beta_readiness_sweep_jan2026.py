"""
Beta-Readiness Sweep — Jan 2026.

Coverage:
  • P0.1 Integrity Protocol  (/api/integrity/*)
  • P0.2 Sovereign Tiers     (/api/tiers/*)
  • P2.2 Underground Live    (/api/underground-live/*)
  • P2.3 Spectator Bet       (/api/spectator-bet/*)
  • P2.4 Receipts OCR        (/api/receipts/*)
"""
import os

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def anon_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/demo-login", json={}, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"demo-login failed: {r.status_code} {r.text[:200]}")
    token = r.json().get("token")
    if not token:
        pytest.skip("demo-login did not return token")
    s.headers.update({"Authorization": f"Bearer {token}"})
    s.user_id = r.json().get("user_id")
    return s


# ─────────────────────────────── P0.1 Integrity ───────────────────────────────
class TestIntegrityProtocol:
    def test_config_returns_locked_vibe_check(self, anon_client):
        r = anon_client.get(f"{BASE_URL}/api/integrity/config", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["Min_Reporters"] == 10
        assert d["Consensus_Threshold"] == 0.75
        assert d["Genius_Chair_Weight"] == 2.0
        assert d["Reward_Per_Correct_Report_Vibe"] == 5
        assert d["Strike_1"]["tax_pct"] == 0.10
        assert d["Strike_2"]["tax_pct"] == 0.50
        assert d["Strike_3"]["permanent_ban"] is True

    def test_report_rejects_unauth(self, anon_client):
        r = anon_client.post(
            f"{BASE_URL}/api/integrity/report",
            json={"game_id": "g_test_001", "reported_winner": "Lakers"}, timeout=10,
        )
        assert r.status_code == 401, r.text

    def test_report_accepts_authed_and_is_idempotent(self, auth_client):
        payload = {"game_id": "g_beta_sweep_001", "reported_winner": "Lakers"}
        r1 = auth_client.post(f"{BASE_URL}/api/integrity/report", json=payload, timeout=10)
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1["status"] in ("submitted", "already_reported")
        # Second call with same game_id+user → idempotent.
        r2 = auth_client.post(f"{BASE_URL}/api/integrity/report", json=payload, timeout=10)
        assert r2.status_code == 200
        assert r2.json()["status"] == "already_reported"

    def test_my_status_returns_state(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/integrity/my-status", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "strikes" in d
        assert "currently_banned" in d

    def test_my_status_rejects_unauth(self, anon_client):
        r = anon_client.get(f"{BASE_URL}/api/integrity/my-status", timeout=10)
        assert r.status_code == 401


# ─────────────────────────────── P0.2 Sovereign Tiers ─────────────────────────
class TestSovereignTiers:
    def test_catalog_returns_expected_pricing(self, anon_client):
        r = anon_client.get(f"{BASE_URL}/api/tiers/catalog", timeout=10)
        assert r.status_code == 200
        d = r.json()
        tiers_by_id = {t["id"]: t for t in d["tiers"]}
        # 6 tiers total (guest + 4 monthly + genius_chair one-time).
        assert d["count"] == 6
        assert set(tiers_by_id.keys()) >= {"guest", "insider", "tastemaker", "royal", "sovereign", "genius_chair"}
        assert tiers_by_id["insider"]["price_usd"] == 9
        assert tiers_by_id["tastemaker"]["price_usd"] == 19
        assert tiers_by_id["tastemaker"]["popular_anchor"] is True
        assert tiers_by_id["royal"]["price_usd"] == 39
        assert tiers_by_id["sovereign"]["price_usd"] == 89
        assert tiers_by_id["genius_chair"]["price_usd"] == 20
        assert tiers_by_id["genius_chair"]["interval"] == "one_time"
        # Annual math: 12*monthly*0.8333 (allow ±$1 rounding).
        for tid, monthly in [("insider", 9), ("tastemaker", 19), ("royal", 39), ("sovereign", 89)]:
            expected = round(12 * monthly * 0.8333)
            actual = tiers_by_id[tid]["price_usd_year"]
            assert abs(actual - expected) <= 1, f"{tid}: expected ~{expected}, got {actual}"

    def test_me_returns_tier(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/tiers/me", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "tier_id" in d
        assert d["tier_id"] in {"guest", "insider", "tastemaker", "royal", "sovereign", "genius_chair"}

    def test_subscribe_tastemaker_returns_stripe_test_url(self, auth_client):
        r = auth_client.post(
            f"{BASE_URL}/api/tiers/subscribe",
            json={"tier_id": "tastemaker", "origin_url": ""}, timeout=20,
        )
        # Skip gracefully if Stripe not configured in this env.
        if r.status_code == 503:
            pytest.skip("Stripe not configured (503)")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["tier_id"] == "tastemaker"
        assert isinstance(d.get("checkout_url"), str)
        assert "cs_test_" in d.get("session_id", "") or "cs_test_" in d["checkout_url"]


# ─────────────────────────────── P2.2 Underground Live ────────────────────────
class TestUndergroundLive:
    def test_battles_returns_two_seeded(self, anon_client):
        r = anon_client.get(f"{BASE_URL}/api/underground-live/battles", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["count"] >= 2
        ids = {b["battle_id"] for b in d["battles"]}
        assert "ul_seed_music_friday" in ids
        assert "ul_seed_dance_saturday" in ids
        # Verify shape: each has contestants list.
        for b in d["battles"]:
            assert isinstance(b.get("contestants"), list)
            assert len(b["contestants"]) >= 2

    def test_active_returns_null_or_live(self, anon_client):
        r = anon_client.get(f"{BASE_URL}/api/underground-live/active", timeout=10)
        assert r.status_code == 200
        d = r.json()
        # Either no live battle, or one with crowd_meter dict.
        battle = d.get("battle")
        if battle is not None:
            assert battle.get("status") == "live"
            assert "crowd_meter" in battle

    def test_vote_rejects_unauth(self, anon_client):
        r = anon_client.post(
            f"{BASE_URL}/api/underground-live/vote",
            json={"battle_id": "ul_seed_music_friday", "contestant_id": "c_rio"}, timeout=10,
        )
        assert r.status_code == 401

    def test_vote_authed_when_battle_live(self, auth_client):
        # If no battle is live we expect 400 (Battle is not live), proving the
        # auth gate passed; this is exactly the spec.
        r = auth_client.post(
            f"{BASE_URL}/api/underground-live/vote",
            json={"battle_id": "ul_seed_music_friday", "contestant_id": "c_rio"}, timeout=10,
        )
        # Acceptable: 200 (vote_cast) OR 400 (not live yet)
        assert r.status_code in (200, 400), r.text
        if r.status_code == 200:
            assert r.json().get("status") == "vote_cast"


# ─────────────────────────────── P2.3 Spectator Bet ───────────────────────────
class TestSpectatorBet:
    def test_place_rejects_unauth(self, anon_client):
        r = anon_client.post(
            f"{BASE_URL}/api/spectator-bet/place",
            json={"market_id": "m_test_001", "choice": "A", "context": "card-room"}, timeout=10,
        )
        assert r.status_code == 401

    def test_place_authed_free_pick(self, auth_client):
        import uuid
        mid = f"m_beta_sweep_{uuid.uuid4().hex[:6]}"
        r = auth_client.post(
            f"{BASE_URL}/api/spectator-bet/place",
            json={"market_id": mid, "choice": "A", "context": "card-room"}, timeout=10,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] in ("placed", "already_placed")
        if d["status"] == "placed":
            assert d["bet"]["choice"] == "A"
            assert d["bet"]["market_id"] == mid

    def test_leaderboard_returns_rows(self, anon_client):
        r = anon_client.get(f"{BASE_URL}/api/spectator-bet/leaderboard", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d.get("rows"), list)
        assert "count" in d


# ─────────────────────────────── P2.4 Receipts OCR ────────────────────────────
class TestReceipts:
    def test_submit_rejects_unauth(self, anon_client):
        r = anon_client.post(
            f"{BASE_URL}/api/receipts/submit",
            json={
                "image_url": "https://example.com/receipt.jpg",
                "merchant_id": "m_diner",
                "amount_usd": 25.50,
            }, timeout=10,
        )
        assert r.status_code == 401

    def test_submit_valid_returns_15pct_bonus(self, auth_client):
        r = auth_client.post(
            f"{BASE_URL}/api/receipts/submit",
            json={
                "image_url": "https://example.com/receipt.jpg",
                "merchant_id": "m_beta_diner",
                "amount_usd": 25.00,
            }, timeout=10,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "verified"
        # 25 USD * 100 ₵/USD * 0.15 = 375 ₵
        assert d["bonus_vibe"] == int(25.00 * 100 * 0.15)
        assert "merchant_boost_until" in d

    def test_submit_rejects_malformed_image_url(self, auth_client):
        r = auth_client.post(
            f"{BASE_URL}/api/receipts/submit",
            json={
                "image_url": "https://example.com/not-an-image",
                "merchant_id": "m_beta_diner_bad",
                "amount_usd": 12.00,
            }, timeout=10,
        )
        # Either pydantic validation 422 OR ocr "rejected" 200.
        assert r.status_code in (200, 422)
        if r.status_code == 200:
            assert r.json().get("status") == "rejected"

    def test_merchant_boosts_returns_200(self, anon_client):
        r = anon_client.get(f"{BASE_URL}/api/receipts/merchant-boosts", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d.get("rows"), list)

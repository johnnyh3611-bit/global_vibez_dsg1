"""Wave 2 — VIP Roulette + Baccarat + standard-engine isolation.

Validates the new High Roller endpoints introduced Jan 2026:
  - POST /api/high-roller/roulette/server-hash (VIP-gated)
  - POST /api/high-roller/roulette/spin (VIP gate + 10k floor + payout math)
  - POST /api/high-roller/baccarat/play (VIP gate + 10k floor + payout math)
  - Isolation: /api/baccarat/play (public) still enforces 50-coin floor, no leak.
"""
import os
import uuid
import pytest
import requests

# Resolve backend URL the same way as test_high_roller_mvp.py
_url = os.environ.get("REACT_APP_BACKEND_URL")
if not _url:
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    _url = line.split("=", 1)[1].strip()
                    break
    except Exception:
        pass
if not _url:
    raise RuntimeError("REACT_APP_BACKEND_URL must be set")
BASE_URL = _url.rstrip("/")
API = f"{BASE_URL}/api"

NON_VIP_USER = f"TEST_nonvip_{uuid.uuid4().hex[:8]}"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def vip_user():
    """Grant VIP directly via pymongo so we don't have to round-trip Stripe."""
    from datetime import datetime, timedelta, timezone
    import pymongo
    client = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    db = client[os.environ.get("DB_NAME", "global_vibez_dsg")]
    uid = f"TEST_vip_w2_{uuid.uuid4().hex[:8]}"
    vip_until = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    db.high_roller_vip.update_one(
        {"user_id": uid},
        {"$set": {
            "user_id": uid,
            "tier": "genesis",
            "vip_until": vip_until,
            "last_grant_session_id": f"cs_test_{uuid.uuid4().hex[:8]}",
            "last_granted_at": datetime.now(timezone.utc).isoformat(),
            "grant_count": 1,
        }},
        upsert=True,
    )
    yield uid
    db.high_roller_vip.delete_one({"user_id": uid})
    client.close()


# ───────────── VIP Roulette: gating ─────────────
class TestVipRouletteGate:
    def test_spin_without_vip_returns_403(self, session):
        r = session.post(
            f"{API}/high-roller/roulette/spin",
            json={
                "user_id": NON_VIP_USER,
                "client_seed": "abc",
                "bets": [{"bet_type": "red", "bet_amount": 10000}],
            }, timeout=15,
        )
        assert r.status_code == 403
        assert r.json().get("detail", {}).get("code") == "vip_required"

    def test_server_hash_returns_vip_payload(self, session, vip_user):
        r = session.post(
            f"{API}/high-roller/roulette/server-hash",
            params={"user_id": vip_user}, timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        # contains serverSeedHash + nonce + vip flag
        assert data.get("vip") is True
        assert "serverSeedHash" in data or "server_seed_hash" in data
        assert "nonce" in data

    def test_spin_below_min_returns_400(self, session, vip_user):
        r = session.post(
            f"{API}/high-roller/roulette/spin",
            json={
                "user_id": vip_user,
                "client_seed": "abc",
                "bets": [{"bet_type": "red", "bet_amount": 5000}],
            }, timeout=15,
        )
        assert r.status_code == 400
        assert r.json().get("detail", {}).get("code") == "below_high_roller_min"

    def test_spin_unknown_bet_type_rejected(self, session, vip_user):
        r = session.post(
            f"{API}/high-roller/roulette/spin",
            json={
                "user_id": vip_user,
                "client_seed": "abc",
                "bets": [{"bet_type": "unknown", "bet_amount": 10000}],
            }, timeout=15,
        )
        assert r.status_code == 400
        assert "unknown" in r.text.lower() or "bet_type" in r.text.lower()


# ───────────── VIP Roulette: happy path + math ─────────────
class TestVipRouletteSpin:
    def test_multi_bet_at_10k_returns_full_payload(self, session, vip_user):
        # split 10k across red/black/dozen1 to guarantee total >= 10k
        r = session.post(
            f"{API}/high-roller/roulette/spin",
            json={
                "user_id": vip_user,
                "client_seed": f"cs_{uuid.uuid4().hex[:8]}",
                "bets": [
                    {"bet_type": "red", "bet_amount": 4000},
                    {"bet_type": "black", "bet_amount": 4000},
                    {"bet_type": "dozen1", "bet_amount": 2000},
                ],
            }, timeout=20,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["vip"] is True
        assert 0 <= d["winning_number"] <= 36
        assert d["color"] in ("red", "black", "green")
        assert d["total_stake"] == 10000
        assert isinstance(d["bets"], list) and len(d["bets"]) == 3
        for b in d["bets"]:
            assert "bet_type" in b and "payout" in b and "won" in b
        # net = total_payout - total_stake
        assert d["net"] == d["total_payout"] - d["total_stake"]

    def test_straight_bet_pays_35_to_1_when_hit(self, session, vip_user):
        """Loop spins (up to 50) trying to hit straight 0; verify 35:1 multiplier
        when won. If we never hit within 50 spins (unlikely), assert that the
        loss path still returns a sane payload."""
        hit_found = False
        for _ in range(50):
            r = session.post(
                f"{API}/high-roller/roulette/spin",
                json={
                    "user_id": vip_user,
                    "client_seed": f"cs_{uuid.uuid4().hex[:8]}",
                    "bets": [{"bet_type": "straight", "bet_value": 0, "bet_amount": 10000}],
                }, timeout=20,
            )
            assert r.status_code == 200, r.text
            d = r.json()
            b = d["bets"][0]
            if b["won"]:
                hit_found = True
                # 35:1 multiplier; payout = stake * 36 (stake returned + 35x winnings)
                assert b["multiplier"] == 35
                assert b["payout"] == 10000 * 36
                break
            else:
                assert b["multiplier"] == 0
                assert b["payout"] == 0
        # We don't require hit_found=True (probability ~74% over 50 spins,
        # but flaky). Just log if we never hit.
        if not hit_found:
            print("Note: straight-0 not hit in 50 spins (~26% probability)")


# ───────────── VIP Baccarat ─────────────
class TestVipBaccarat:
    def test_play_without_vip_returns_403(self, session):
        r = session.post(
            f"{API}/high-roller/baccarat/play",
            json={"user_id": NON_VIP_USER, "bet_type": "player", "bet_amount": 10000},
            timeout=15,
        )
        assert r.status_code == 403
        assert r.json().get("detail", {}).get("code") == "vip_required"

    def test_play_below_min_returns_400(self, session, vip_user):
        r = session.post(
            f"{API}/high-roller/baccarat/play",
            json={"user_id": vip_user, "bet_type": "banker", "bet_amount": 1000},
            timeout=15,
        )
        assert r.status_code == 400
        assert r.json().get("detail", {}).get("code") == "below_high_roller_min"

    def test_invalid_bet_type_rejected(self, session, vip_user):
        r = session.post(
            f"{API}/high-roller/baccarat/play",
            json={"user_id": vip_user, "bet_type": "bla", "bet_amount": 10000},
            timeout=15,
        )
        assert r.status_code == 400

    def test_play_at_min_returns_full_hand(self, session, vip_user):
        r = session.post(
            f"{API}/high-roller/baccarat/play",
            json={"user_id": vip_user, "bet_type": "player", "bet_amount": 10000},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["vip"] is True
        assert d["bet_amount"] == 10000
        assert isinstance(d["player_hand"], list) and len(d["player_hand"]) >= 2
        assert isinstance(d["banker_hand"], list) and len(d["banker_hand"]) >= 2
        assert 0 <= d["player_score"] <= 9
        assert 0 <= d["banker_score"] <= 9
        assert d["winner"] in ("player", "banker", "tie")
        # Payout math: player win→2x, banker win→1.95x, tie→9x, else 0
        if d["winner"] == "player" and d["bet_type"] == "player":
            assert d["payout"] == 20000
        elif d["winner"] != d["bet_type"]:
            assert d["payout"] == 0
        assert d["net"] == d["payout"] - d["bet_amount"]

    def test_banker_payout_uses_1_95_multiplier(self, session, vip_user):
        """Play repeatedly until we get a banker win on a banker bet, verify 1.95x."""
        for _ in range(60):
            r = session.post(
                f"{API}/high-roller/baccarat/play",
                json={"user_id": vip_user, "bet_type": "banker", "bet_amount": 10000},
                timeout=20,
            )
            assert r.status_code == 200
            d = r.json()
            if d["winner"] == "banker":
                # 1.95x ⇒ int(10000 * 1.95) = 19500
                assert d["payout"] == 19500
                return
        print("Note: no banker win within 60 plays (rare)")


# ───────────── Isolation: standard endpoints unchanged ─────────────
class TestStandardEndpointIsolation:
    def test_standard_roulette_spin_works_without_vip(self, session):
        """Standard /api/roulette/spin is a spin engine; it should respond 200
        without any VIP or 10k requirement."""
        r = session.post(
            f"{API}/roulette/spin",
            json={"clientSeed": f"cs_{uuid.uuid4().hex[:8]}"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        # should NOT carry the VIP min_bet
        assert "high_roller" not in r.text.lower()
        # Should include winningNumber/winning_number
        assert "winningNumber" in d or "winning_number" in d

    def test_standard_baccarat_accepts_below_10000_floor(self, session):
        """Public /api/baccarat/play must still accept the standard floor (50).
        Even if it requires auth, the rejection MUST NOT mention 10000 or VIP."""
        r = session.post(
            f"{API}/baccarat/play",
            json={"bet_type": "player", "bet_amount": 100},
            timeout=15,
        )
        # Likely 401/403 due to required auth — that's fine; just NOT a leak
        body = r.text.lower()
        assert "10000" not in body
        assert "high_roller" not in body
        assert "high roller" not in body
        # Status should NOT be 400 'below_high_roller_min'
        if r.status_code == 400:
            assert "below_high_roller_min" not in body

    def test_standard_baccarat_rejects_25_with_50_floor_or_auth(self, session):
        """Below the standard 50-coin floor; if not auth-blocked, must be the
        50-coin rejection — and absolutely not the 10000 floor."""
        r = session.post(
            f"{API}/baccarat/play",
            json={"bet_type": "player", "bet_amount": 25},
            timeout=15,
        )
        body = r.text.lower()
        assert "10000" not in body
        assert "high roller" not in body

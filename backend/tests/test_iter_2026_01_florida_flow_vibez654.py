"""
Backend tests for the Florida-Flow / Vibez-654 / Friend-Notifier / God-Mode-Audit
manifest integration (Jan-2026).

Covers:
  • Vibez-654: start, auth gate, calcify rule, auto-stand at 3 locked, manual stand,
    bet-balance enforcement, leaderboard
  • Florida-Flow payout/rake/burn calculator
  • Nova dealer config endpoint
  • Beta feedback (auth gate + admin list cookie gate + 422 invalid category)
  • God-Mode audit feed (admin cookie gate)
  • Friend events recent (auth gate + happy path)
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "GlobalVibez_Founder_2025!")


# ─────────────────────────────── fixtures ──

@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth_session(api):
    r = api.post(f"{BASE_URL}/api/auth/demo-login", timeout=20)
    if r.status_code != 200:
        pytest.skip(f"demo-login failed ({r.status_code}): {r.text[:200]}")
    data = r.json()
    token = data.get("token")
    user_id = data.get("user_id")
    assert token and user_id
    s = requests.Session()
    s.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    })
    return {"session": s, "token": token, "user_id": user_id}


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
        pytest.skip(f"vault-auth failed ({r.status_code}): {r.text[:200]}")
    return s


# ─────────────────────────────── Vibez-654 ──

class TestVibez654:
    def test_start_unauth_returns_401(self):
        r = requests.post(f"{BASE_URL}/api/vibez-654/start", json={"bet": 0}, timeout=10)
        assert r.status_code == 401, r.text

    def test_start_authed_returns_active_game(self, auth_session):
        r = auth_session["session"].post(
            f"{BASE_URL}/api/vibez-654/start", json={"bet": 0}, timeout=10
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "active"
        assert data["locked_dice"] == []
        assert data["unlocked_dice"] == []
        assert data["rolls"] == 0
        assert data["game_id"].startswith("v654_")

    def test_start_bet_exceeds_balance_returns_402(self, auth_session):
        r = auth_session["session"].post(
            f"{BASE_URL}/api/vibez-654/start",
            json={"bet": 99999},
            timeout=10,
        )
        # Demo user typically has 0 token_balance — should 402.
        assert r.status_code == 402, f"expected 402 got {r.status_code}: {r.text}"

    def test_roll_calcify_rule_and_increments(self, auth_session):
        s = auth_session["session"]
        start = s.post(f"{BASE_URL}/api/vibez-654/start", json={"bet": 0}, timeout=10).json()
        gid = start["game_id"]

        for _ in range(8):
            r = s.post(f"{BASE_URL}/api/vibez-654/roll", json={"game_id": gid}, timeout=10)
            assert r.status_code == 200, r.text
            data = r.json()
            # locked_dice only contains 5/6
            for v in data["locked_dice"]:
                assert v in (5, 6), f"locked_dice contains non-calcify: {data['locked_dice']}"
            # unlocked_dice only contains 1-4
            for v in data["unlocked_dice"]:
                assert v in (1, 2, 3, 4), f"unlocked_dice contains 5/6: {data['unlocked_dice']}"
            # If still active and not auto-ended, locked must be < 3
            if data.get("status") == "ended":
                # Auto-stand path: when 3 locked → ended w/ score 0.
                if len(data["locked_dice"]) >= 3:
                    assert data["score"] == 0, data
                break
            assert data["rolls"] >= 1

    def test_auto_stand_blocks_further_rolls(self, auth_session):
        s = auth_session["session"]
        # Try many games until we hit auto-stand (rolling all 5/6 is ~0.4% per roll;
        # with 20 attempts of 8 rolls each it's nearly guaranteed).
        gid_ended = None
        for _ in range(40):
            start = s.post(f"{BASE_URL}/api/vibez-654/start", json={"bet": 0}, timeout=10).json()
            gid = start["game_id"]
            for _ in range(20):
                r = s.post(f"{BASE_URL}/api/vibez-654/roll", json={"game_id": gid}, timeout=10).json()
                if r.get("status") == "ended" and len(r.get("locked_dice", [])) >= 3:
                    gid_ended = gid
                    break
            if gid_ended:
                break
        if not gid_ended:
            pytest.skip("Could not reach 3-locked auto-stand within attempts (random)")
        # Subsequent roll should 400
        r = s.post(f"{BASE_URL}/api/vibez-654/roll", json={"game_id": gid_ended}, timeout=10)
        assert r.status_code == 400, r.text

    def test_manual_stand_returns_score_sum(self, auth_session):
        s = auth_session["session"]
        start = s.post(f"{BASE_URL}/api/vibez-654/start", json={"bet": 0}, timeout=10).json()
        gid = start["game_id"]
        # one roll
        roll = s.post(f"{BASE_URL}/api/vibez-654/roll", json={"game_id": gid}, timeout=10).json()
        if roll.get("status") == "ended":
            # auto-ended already - just verify final state
            assert "score" in roll
            return
        unlocked = roll["unlocked_dice"]
        expected_score = sum(unlocked)
        r = s.post(f"{BASE_URL}/api/vibez-654/stand", json={"game_id": gid}, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "ended"
        assert data["score"] == expected_score, f"expected {expected_score} got {data['score']}"

    def test_leaderboard_returns_rows(self):
        r = requests.get(f"{BASE_URL}/api/vibez-654/leaderboard", timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "rows" in data
        assert isinstance(data["rows"], list)
        assert data.get("window") == "24h"


# ─────────────────────────────── Florida-Flow payout ──

class TestFloridaFlow:
    def test_payout_calc_matches_expected(self):
        r = requests.post(
            f"{BASE_URL}/api/economy/payout",
            json={"total_pot": 1000, "rake_percent": 0.05, "burn_share": 0.5},
            timeout=10,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["winner_payout"] == 950
        assert d["house_cut"] == 50
        assert d["burn_amount"] == 25
        assert d["maintenance_amount"] == 25


# ─────────────────────────────── Nova dealer ──

class TestNovaDealer:
    def test_nova_config_returns_full_profile(self):
        r = requests.get(f"{BASE_URL}/api/dealer/nova", timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["dealer_name"] == "Nova"
        assert "archetype" in d
        assert "features" in d and isinstance(d["features"], dict)
        assert "reactions" in d and isinstance(d["reactions"], dict)
        assert "voice_pack" in d


# ─────────────────────────────── Beta feedback ──

class TestBetaFeedback:
    def test_submit_unauth_returns_401(self):
        r = requests.post(
            f"{BASE_URL}/api/beta/feedback",
            json={"category": "OTHER", "comment": "test feedback"},
            timeout=10,
        )
        assert r.status_code == 401, r.text

    def test_submit_authed_returns_ok(self, auth_session):
        r = auth_session["session"].post(
            f"{BASE_URL}/api/beta/feedback",
            json={
                "category": "FEATURE_REQUEST",
                "comment": f"TEST_ {uuid.uuid4().hex[:6]} please add more dice games",
                "severity": "low",
            },
            timeout=10,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert "feedback_id" in d

    def test_submit_invalid_category_returns_422(self, auth_session):
        r = auth_session["session"].post(
            f"{BASE_URL}/api/beta/feedback",
            json={"category": "INVALID_CAT", "comment": "test"},
            timeout=10,
        )
        assert r.status_code == 422, r.text

    def test_admin_list_no_cookie_returns_401(self):
        r = requests.get(f"{BASE_URL}/api/beta/feedback", timeout=10)
        assert r.status_code == 401, r.text

    def test_admin_list_with_cookie_returns_200(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/beta/feedback", timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "rows" in d
        assert isinstance(d["rows"], list)


# ─────────────────────────────── God-Mode Audit ──

class TestGodModeAudit:
    def test_audit_feed_no_cookie_returns_401(self):
        r = requests.get(f"{BASE_URL}/api/admin/audit/feed", timeout=10)
        assert r.status_code == 401, r.text

    def test_audit_feed_with_admin_cookie_returns_200(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/audit/feed", timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "rows" in d
        assert isinstance(d["rows"], list)


# ─────────────────────────────── Friend events ──

class TestFriendEvents:
    def test_recent_unauth_returns_401(self):
        r = requests.get(f"{BASE_URL}/api/friend-events/recent", timeout=10)
        assert r.status_code == 401, r.text

    def test_recent_authed_returns_count_and_events(self, auth_session):
        r = auth_session["session"].get(
            f"{BASE_URL}/api/friend-events/recent", timeout=10
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert "count" in d
        assert "events" in d
        assert isinstance(d["events"], list)

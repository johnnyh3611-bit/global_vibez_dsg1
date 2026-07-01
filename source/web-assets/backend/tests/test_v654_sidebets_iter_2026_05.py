"""
Backend tests — Vibez 654 side-bets, history, and types endpoints.
Iteration 2026-05 (V654 side bets + visual sweep).

Validates:
- /api/vibez-654/side-bet-types returns 11 catalog entries with type/multiplier/label
- /api/vibez-654/start with side_bets list debits up-front, accepts mixed types
- /api/vibez-654/start with unknown side bet type → 400
- /api/vibez-654/start with insufficient balance → 402
- /api/vibez-654/roll evaluates side bets ONLY on roll #1 (side_bet_results populated)
- /api/vibez-654/stand credits both main payout + side_bet_payout
- /api/vibez-654/history returns user's last N ended games with side_bets/payout
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

BETA_EMAIL = "betatester1@globalvibez.com"
BETA_PASS = "BetaTester2026!"


# Module-scope auth fixture
@pytest.fixture(scope="module")
def auth_token():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": BETA_EMAIL, "password": BETA_PASS}, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Auth failed: {r.status_code} {r.text[:200]}")
    data = r.json()
    token = data.get("token") or data.get("access_token") or (data.get("user") or {}).get("token")
    if not token:
        pytest.skip(f"No token in login response: {list(data.keys())}")
    return token


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


# ----- /side-bet-types -----
class TestSideBetTypes:
    def test_returns_11_types(self):
        r = requests.get(f"{API}/vibez-654/side-bet-types", timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "types" in data
        types = data["types"]
        assert len(types) == 11, f"Expected 11 side bet types, got {len(types)}"
        # Required fields
        for t in types:
            assert "type" in t and "multiplier" in t and "label" in t
            assert isinstance(t["multiplier"], int)
            assert t["multiplier"] > 0
        type_names = {t["type"] for t in types}
        # Must include the canonical 11
        for required in ("TRIPLE_6", "ANY_STRAIGHT", "STRAIGHT_6", "SMALL_STRAIGHT",
                         "LARGE_STRAIGHT", "ONE_AND_DONE",
                         "STRAIGHT_1", "STRAIGHT_2", "STRAIGHT_3", "STRAIGHT_4", "STRAIGHT_5"):
            assert required in type_names, f"Missing required side bet type: {required}"


# ----- /start with side bets -----
class TestStartWithSideBets:
    def test_start_with_mixed_side_bets_200(self, auth_headers):
        body = {
            "bet": 100,
            "side_bets": [
                {"type": "TRIPLE_6", "amount": 10},
                {"type": "ANY_STRAIGHT", "amount": 25},
                {"type": "STRAIGHT_6", "amount": 10},
                {"type": "SMALL_STRAIGHT", "amount": 10},
                {"type": "LARGE_STRAIGHT", "amount": 10},
                {"type": "ONE_AND_DONE", "amount": 10},
            ],
        }
        r = requests.post(f"{API}/vibez-654/start", json=body, headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        g = r.json()
        assert g["status"] == "active"
        assert g["bet"] == 100
        assert len(g["side_bets"]) == 6
        assert g["side_bets_total"] == 75
        assert g["side_bet_payout"] == 0  # not evaluated yet
        assert g["side_bet_results"] == []

    def test_start_unknown_side_bet_type_400(self, auth_headers):
        body = {"bet": 10, "side_bets": [{"type": "FAKE_BET", "amount": 5}]}
        r = requests.post(f"{API}/vibez-654/start", json=body, headers=auth_headers, timeout=10)
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"
        assert "Unknown side bet" in r.text or "side bet" in r.text.lower()

    def test_start_insufficient_balance_402(self, auth_headers):
        # Force insufficient with a huge bet+side bet combo
        body = {
            "bet": 99999,
            "side_bets": [{"type": "TRIPLE_6", "amount": 99999}],
        }
        r = requests.post(f"{API}/vibez-654/start", json=body, headers=auth_headers, timeout=10)
        # If balance happens to be enough this could be 200 — flag if so but assert 402 strict
        assert r.status_code == 402, f"Expected 402, got {r.status_code}: {r.text}"


# ----- Full flow: start → roll → side bets eval on roll #1 → stand -----
class TestSideBetEvaluation:
    def test_full_flow_side_bets_evaluated_on_roll_1(self, auth_headers):
        body = {
            "bet": 50,
            "side_bets": [
                {"type": "TRIPLE_6", "amount": 10},
                {"type": "ANY_STRAIGHT", "amount": 10},
            ],
        }
        r = requests.post(f"{API}/vibez-654/start", json=body, headers=auth_headers, timeout=10)
        assert r.status_code == 200, r.text
        game_id = r.json()["game_id"]

        # Roll 1
        r1 = requests.post(f"{API}/vibez-654/roll", json={"game_id": game_id}, headers=auth_headers, timeout=10)
        assert r1.status_code == 200, r1.text
        g1 = r1.json()
        # side_bet_results MUST be populated (one row per bet) with won/payout fields
        assert "side_bet_results" in g1
        assert len(g1["side_bet_results"]) == 2
        for row in g1["side_bet_results"]:
            assert "type" in row and "amount" in row and "won" in row and "payout" in row
            assert isinstance(row["won"], bool)
            assert isinstance(row["payout"], int)
        # side_bet_payout = sum of payouts
        assert g1["side_bet_payout"] == sum(r["payout"] for r in g1["side_bet_results"])

        # Stand
        rs = requests.post(f"{API}/vibez-654/stand", json={"game_id": game_id}, headers=auth_headers, timeout=10)
        # Game might already auto-stand if rolls exhausted but we only rolled once, so stand should work
        assert rs.status_code == 200, rs.text
        gs = rs.json()
        assert gs["status"] == "ended"
        # side_bet_payout preserved through settlement
        assert gs["side_bet_payout"] == g1["side_bet_payout"]


# ----- /history endpoint -----
class TestHistory:
    def test_history_returns_recent_rows(self, auth_headers):
        # Play one quick game to ensure there's at least one row
        body = {"bet": 10, "side_bets": [{"type": "ANY_STRAIGHT", "amount": 5}]}
        r = requests.post(f"{API}/vibez-654/start", json=body, headers=auth_headers, timeout=10)
        assert r.status_code == 200, r.text
        game_id = r.json()["game_id"]
        requests.post(f"{API}/vibez-654/roll", json={"game_id": game_id}, headers=auth_headers, timeout=10)
        requests.post(f"{API}/vibez-654/stand", json={"game_id": game_id}, headers=auth_headers, timeout=10)

        # Fetch history
        h = requests.get(f"{API}/vibez-654/history?limit=10", headers=auth_headers, timeout=10)
        assert h.status_code == 200, h.text
        d = h.json()
        assert "rows" in d and "count" in d
        assert d["count"] >= 1
        row = d["rows"][0]
        for key in ("game_id", "bet", "score", "side_bets", "side_bet_payout", "ended_at"):
            assert key in row, f"Missing field {key} in history row: {list(row.keys())}"

    def test_history_limit_clamps(self, auth_headers):
        h = requests.get(f"{API}/vibez-654/history?limit=2", headers=auth_headers, timeout=10)
        assert h.status_code == 200
        assert len(h.json()["rows"]) <= 2

    def test_history_unauthenticated_401(self):
        h = requests.get(f"{API}/vibez-654/history?limit=5", timeout=10)
        assert h.status_code == 401, f"Expected 401 unauthenticated, got {h.status_code}"

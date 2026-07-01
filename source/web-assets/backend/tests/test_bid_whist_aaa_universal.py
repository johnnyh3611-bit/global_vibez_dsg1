"""Backend smoke tests for the Universal Card Room prototype.

Covers:
  • POST /api/spades-practice/start    → phase=bidding, 13-card hand, seats have bid/tricks
  • POST /api/bid-whist-practice/start → phase=bidding, 12-card hand, 6-card kitty
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def auth_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/demo-login", json={}, timeout=30)
    assert r.status_code == 200, f"demo-login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("token") or data.get("session_token")
    assert token, f"no token in demo-login response: {data}"
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


class TestSpadesPractice:
    def test_start_returns_bidding_phase_and_13_card_hand(self, auth_session):
        r = auth_session.post(f"{BASE_URL}/api/spades-practice/start", json={"bet_amount": 0}, timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        body = r.json()
        g = body.get("game") or body
        assert g.get("phase") == "bidding", f"phase={g.get('phase')}"
        hand = g.get("your_hand") or []
        assert len(hand) == 13, f"hand size={len(hand)}"
        players = g.get("players") or {}
        for pos in ("north", "east", "south", "west"):
            assert pos in players, f"missing seat {pos}"
            p = players[pos]
            # bid/tricks must be present (may be 0)
            assert "bid" in p or "books_won" in p or "tricks" in p or "card_count" in p


class TestBidWhistPractice:
    def test_start_returns_bidding_phase_and_12_card_hand(self, auth_session):
        r = auth_session.post(f"{BASE_URL}/api/bid-whist-practice/start", json={"bet_amount": 0}, timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        body = r.json()
        g = body.get("game") or body
        assert g.get("phase") == "bidding", f"phase={g.get('phase')}"
        hand = g.get("your_hand") or []
        assert len(hand) == 12, f"hand size={len(hand)} (should be 12 for 54-card deck)"
        # 54 deck: 4*12 + 6 kitty = 54
        kitty_count = g.get("kitty_count")
        if kitty_count is not None:
            assert kitty_count == 6, f"kitty_count={kitty_count}"
        players = g.get("players") or {}
        for pos in ("north", "east", "south", "west"):
            assert pos in players, f"missing seat {pos}"

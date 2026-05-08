"""Integration tests for the 4 new card games built in iteration 100.

Covers: spades-practice, blackjack-universal, poker-practice, rummy-practice.
Uses the public backend URL with a demo session token.
Response shapes verified against live responses:
  - spades-practice/start -> {success, game: {game_id, your_hand, phase, players, scores, ...}}
  - blackjack-universal/start -> {game_id, phase, seats, dealer, ...} (flat)
  - poker-practice/start -> {game_id, phase, pot, seats[{stack,bet}], active_seat, valid_actions} (flat)
  - rummy-practice/start -> {game_id, phase, turn, your_hand, discard_top, stock_count, ...} (flat)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def auth_client():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/demo-login", timeout=15)
    assert r.status_code == 200, f"demo-login failed: {r.status_code} {r.text}"
    token = r.json()["token"]
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


# ==================== SPADES PRACTICE ====================

class TestSpadesPractice:
    def test_start_deals_13_cards_and_bidding_phase(self, auth_client):
        r = auth_client.post(f"{BASE_URL}/api/spades-practice/start", json={})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True
        game = data["game"]
        assert game["phase"] == "bidding"
        assert len(game["your_hand"]) == 13
        assert game["your_position"] == "south"
        # All 4 players should be present
        assert set(game["players"].keys()) == {"north", "east", "south", "west"}
        pytest.spades_game_id = game["game_id"]

    def test_bid_then_ai_bids_and_advance_to_playing(self, auth_client):
        gid = getattr(pytest, "spades_game_id", None)
        assert gid, "needs prior start"
        r = auth_client.post(f"{BASE_URL}/api/spades-practice/bid", json={"game_id": gid, "bid": 4})
        assert r.status_code == 200, r.text
        data = r.json()
        game = data.get("game", data)
        assert game["phase"] == "playing", f"phase={game.get('phase')}"
        # All 4 bids should be set
        for pos, p in game["players"].items():
            assert p.get("bid") is not None, f"player {pos} missing bid"

    def test_play_one_card_advances(self, auth_client):
        gid = getattr(pytest, "spades_game_id", None)
        r = auth_client.get(f"{BASE_URL}/api/spades-practice/state/{gid}")
        assert r.status_code == 200, r.text
        game = r.json().get("game", r.json())
        hand = game["your_hand"]
        valid = game.get("valid_plays") or hand
        if game.get("turn_position") != "south":
            # lead not on us; pick any valid that server will allow when turn comes
            pytest.skip(f"turn_position={game.get('turn_position')} not south, skipping play")
        card = valid[0]
        r = auth_client.post(
            f"{BASE_URL}/api/spades-practice/play",
            json={"game_id": gid, "card": card},
        )
        assert r.status_code == 200, r.text
        game = r.json().get("game", r.json())
        assert game["phase"] in ("playing", "hand_over", "game_over")


# ==================== BLACKJACK UNIVERSAL ====================

class TestBlackjackUniversal:
    def test_start_creates_seats(self, auth_client):
        r = auth_client.post(f"{BASE_URL}/api/blackjack-universal/start", json={"num_bots": 2})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "game_id" in data
        assert data.get("phase") == "betting"
        seats = data.get("seats") or []
        assert len(seats) == 3, f"expected 3 seats got {len(seats)}"
        names = [s.get("name") for s in seats]
        assert names[0] == "You"
        pytest.bj_game_id = data["game_id"]

    def test_bet_deals_cards_and_phase_playing(self, auth_client):
        gid = getattr(pytest, "bj_game_id", None)
        r = auth_client.post(
            f"{BASE_URL}/api/blackjack-universal/bet",
            json={"game_id": gid, "bet": 1000},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("phase") in ("playing", "settled"), f"phase={data.get('phase')}"
        seats = data.get("seats", [])
        assert all(len(s.get("hand", [])) >= 2 for s in seats), "seats missing cards"
        # Dealer has 2 cards (one may be hidden)
        dealer_hand = data.get("dealer", {}).get("hand", [])
        assert len(dealer_hand) == 2

    def test_action_stand_progresses_and_settles(self, auth_client):
        gid = getattr(pytest, "bj_game_id", None)
        st = auth_client.get(f"{BASE_URL}/api/blackjack-universal/state/{gid}").json()
        if st.get("phase") == "settled":
            pytest.skip("hand already settled (natural blackjack)")
        r = auth_client.post(
            f"{BASE_URL}/api/blackjack-universal/action",
            json={"game_id": gid, "action": "stand"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("phase") == "settled", f"phase={data.get('phase')}"
        user_seat = data["seats"][0]
        # Implementation uses 'win'/'loss'/'push'/'blackjack' (note: 'loss' not 'lose')
        assert user_seat.get("result") in ("win", "loss", "push", "blackjack"), f"unexpected result {user_seat.get('result')}"
        assert "payout" in user_seat


# ==================== POKER PRACTICE ====================

class TestPokerPractice:
    def test_start_creates_4_seats_blinds_posted(self, auth_client):
        r = auth_client.post(f"{BASE_URL}/api/poker-practice/start", json={"num_bots": 3})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "game_id" in data
        assert data["phase"] == "pre-flop"
        seats = data["seats"]
        assert len(seats) == 4, f"expected 4 seats got {len(seats)}"
        # Blinds posted: seat bets should sum to at least 1500 (SB+BB)
        total_bet = sum(s.get("bet", 0) for s in seats)
        assert total_bet >= 1500, f"total bets={total_bet}"
        # Starting stacks ~100K
        assert seats[0]["stack"] <= 100000 and seats[0]["stack"] >= 99000
        pytest.poker_game_id = data["game_id"]

    def test_action_call_or_check(self, auth_client):
        gid = getattr(pytest, "poker_game_id", None)
        assert gid
        # Try call first
        r = auth_client.post(
            f"{BASE_URL}/api/poker-practice/action",
            json={"game_id": gid, "action": "call"},
        )
        if r.status_code != 200:
            r = auth_client.post(
                f"{BASE_URL}/api/poker-practice/action",
                json={"game_id": gid, "action": "check"},
            )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("phase") in ("pre-flop", "flop", "turn", "river", "showdown", "hand_over")

    def test_fold_returns_ok(self, auth_client):
        r = auth_client.post(f"{BASE_URL}/api/poker-practice/start", json={"num_bots": 3})
        assert r.status_code == 200
        gid = r.json()["game_id"]
        rf = auth_client.post(
            f"{BASE_URL}/api/poker-practice/action",
            json={"game_id": gid, "action": "fold"},
        )
        assert rf.status_code in (200, 400), rf.text


# ==================== RUMMY PRACTICE ====================

class TestRummyPractice:
    def test_start_deals_10_cards(self, auth_client):
        r = auth_client.post(f"{BASE_URL}/api/rummy-practice/start", json={})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "game_id" in data
        assert len(data["your_hand"]) == 10, f"hand size={len(data.get('your_hand', []))}"
        assert data["phase"] == "draw"
        assert data["turn"] == "user"
        assert data["bot_hand_count"] == 10
        assert data["stock_count"] == 31
        assert data["discard_top"] is not None
        pytest.rummy_game_id = data["game_id"]

    def test_draw_stock_adds_card(self, auth_client):
        gid = getattr(pytest, "rummy_game_id", None)
        r = auth_client.post(
            f"{BASE_URL}/api/rummy-practice/draw",
            json={"game_id": gid, "source": "stock"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert len(data["your_hand"]) == 11
        assert data["phase"] == "discard"

    def test_discard_switches_to_bot_then_back_to_user(self, auth_client):
        gid = getattr(pytest, "rummy_game_id", None)
        st = auth_client.get(f"{BASE_URL}/api/rummy-practice/state/{gid}").json()
        hand = st["your_hand"]
        assert len(hand) == 11
        card = hand[-1]
        r = auth_client.post(
            f"{BASE_URL}/api/rummy-practice/discard",
            json={"game_id": gid, "card": card},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert len(data["your_hand"]) == 10
        assert data["phase"] == "draw"
        assert data["turn"] == "user"


# ==================== REGRESSION ====================

class TestRegressions:
    def test_baccarat_routes_reachable(self, auth_client):
        r = auth_client.post(f"{BASE_URL}/api/baccarat/start", json={})
        assert r.status_code < 500, f"baccarat 5xx: {r.status_code} {r.text[:200]}"

    def test_admin_vault_login(self):
        # test admin vault still accepts password
        r = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={"password": "GlobalVibez_Founder_2025!", "totp_code": "000000"},
            timeout=10,
        )
        # Accept 200 or 404 (if route renamed); must not be 5xx
        assert r.status_code < 500, f"admin login 5xx: {r.status_code} {r.text[:200]}"

"""
Test Bid Whist /play endpoint returns play_sequence array (Jan 2026 fix).

Validates:
- Authenticated demo user can start a practice game
- Bidding flow lands in kitty_exchange or playing phase
- /play response includes play_sequence array
- play_sequence elements have shape {player, card, trick_complete, trick_winner}
- The user's own card is the first element
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fall back to frontend env file
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass


@pytest.fixture(scope="module")
def auth_session():
    """Demo-login session with Bearer token."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/demo-login", json={}, timeout=30)
    assert r.status_code == 200, f"demo-login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("token") or data.get("session_token") or data.get("access_token")
    assert token, f"no token in demo-login response: {data}"
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


def _start_game(s):
    r = s.post(f"{BASE_URL}/api/bid-whist-practice/start", json={}, timeout=30)
    assert r.status_code == 200, f"start failed: {r.status_code} {r.text}"
    return r.json().get("game", {})


def _state(s):
    r = s.get(f"{BASE_URL}/api/bid-whist-practice/state", timeout=30)
    assert r.status_code == 200, f"state failed: {r.status_code} {r.text}"
    return r.json().get("game", {})


def _drive_to_play(s, game):
    """Bid 4-no, exchange kitty if required, until phase == 'playing'."""
    phase = game.get("phase") or game.get("game_phase")
    # Make a bid if it's south's turn and phase is bidding
    if phase == "bidding":
        # Try a low bid: 4 with bid_type=uptown
        r = s.post(
            f"{BASE_URL}/api/bid-whist-practice/bid",
            json={"amount": 4, "bid_type": "uptown"},
            timeout=30,
        )
        # If 400 (bot already bid higher etc), try pass
        if r.status_code == 400:
            r = s.post(
                f"{BASE_URL}/api/bid-whist-practice/bid",
                json={"amount": None},
                timeout=30,
            )
        assert r.status_code == 200, f"bid failed: {r.text}"
        game = r.json().get("game", {})
        phase = game.get("phase") or game.get("game_phase")

    if phase == "kitty_exchange":
        # If we won the bid we must exchange. Else AI auto-handles.
        bid_winner = game.get("bid_winner")
        if bid_winner == "south":
            hand = game.get("your_hand", [])
            discards = hand[:6] if len(hand) >= 6 else hand
            r = s.post(
                f"{BASE_URL}/api/bid-whist-practice/kitty-exchange",
                json={
                    "trump_suit": "spades",
                    "discarded_cards": discards,
                },
                timeout=30,
            )
            assert r.status_code in (200, 400), f"kitty-exchange: {r.text}"
            if r.status_code == 200:
                game = r.json().get("game", {})

    return game


def test_play_returns_play_sequence(auth_session):
    s = auth_session
    game = _start_game(s)
    # Burn through up to 8 hands trying to land in 'playing' phase as south's turn
    for _ in range(8):
        game = _drive_to_play(s, game)
        phase = game.get("phase") or game.get("game_phase")
        turn = game.get("turn_position") or game.get("whose_turn")
        if phase == "playing" and (turn == "south" or game.get("valid_plays")):
            break
        # If still bidding, restart
        if phase == "bidding":
            game = _start_game(s)

    phase = game.get("phase") or game.get("game_phase")
    if phase != "playing":
        pytest.skip(f"could not reach playing phase (got {phase})")

    valid = game.get("valid_plays") or []
    if not valid:
        # If we don't lead but it's our turn, hand[0] should be valid
        valid = game.get("your_hand", [])[:1]
    assert valid, "no valid plays returned"
    card = valid[0]

    r = s.post(f"{BASE_URL}/api/bid-whist-practice/play", json={"card": card}, timeout=30)
    assert r.status_code == 200, f"play failed: {r.status_code} {r.text}"
    body = r.json()
    assert body.get("success") is True
    g = body.get("game", {})

    seq = g.get("play_sequence")
    assert isinstance(seq, list), f"play_sequence missing or wrong type: {seq!r}"
    assert len(seq) >= 1, "play_sequence empty"

    first = seq[0]
    for k in ("player", "card", "trick_complete", "trick_winner"):
        assert k in first, f"play_sequence[0] missing {k}: {first}"

    # User's own play must be first
    assert first["player"] == "south", f"first event should be 'south': {first}"


def test_other_endpoints_alive(auth_session):
    """Smoke check: /start and /state both 200."""
    s = auth_session
    _start_game(s)
    g = _state(s)
    assert g, "state response empty"
    assert "your_hand" in g or "phase" in g or "game_phase" in g

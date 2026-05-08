"""
Spades AAA — backend integration smoke tests.

Covers the AI-mode endpoints that power the new SpadesAAA frontend:

  • POST /api/spades-practice/start           (with ruleset selector)
  • GET  /api/spades-practice/state/{id}
  • POST /api/spades-practice/bid
  • POST /api/spades-practice/play
  • POST /api/spades-practice/new-hand/{id}

Plus the cross-reference rules endpoint:

  • GET  /api/spades/rulesets

Each test demo-logs a fresh user so balance and game-state assertions
are isolated.
"""
from __future__ import annotations

import pytest
import requests


@pytest.fixture()
def session_token(api_base: str) -> str:
    r = requests.post(f"{api_base}/auth/demo-login", json={}, timeout=15)
    r.raise_for_status()
    data = r.json()
    token = data.get("session_token") or data.get("token")
    assert token, f"demo-login did not return a token: {data}"
    return token


@pytest.fixture()
def auth(session_token: str) -> dict:
    return {"Authorization": f"Bearer {session_token}"}


# ─────────────────────────────────────────────────────── PUBLIC RULESETS

def test_rulesets_endpoint(api_base: str) -> None:
    r = requests.get(f"{api_base}/spades/rulesets", timeout=10)
    assert r.status_code == 200
    data = r.json()
    ids = {rs["id"] for rs in data["rulesets"]}
    assert "CLASSIC" in ids
    assert "BIG_WHEEL" in ids
    bw = next(rs for rs in data["rulesets"] if rs["id"] == "BIG_WHEEL")
    assert bw["deck_size"] == 54
    assert bw["has_jokers"] is True
    assert "BIG_JOKER" in bw["promoted_trumps"]


# ─────────────────────────────────────────────────────── AI START / STATE

def test_start_classic_returns_13_cards(api_base: str, auth: dict) -> None:
    r = requests.post(
        f"{api_base}/spades-practice/start",
        headers={**auth, "Content-Type": "application/json"},
        json={"ruleset": "CLASSIC"},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    g = body["game"]
    assert g["mode"] == "practice"
    assert g["ruleset"] == "CLASSIC"
    assert g["ruleset_label"] == "Classic"
    assert g["your_position"] == "south"
    assert len(g["your_hand"]) == 13
    assert g["phase"] == "bidding"
    # No promoted trumps in CLASSIC.
    assert all(not c.get("promoted") for c in g["your_hand"])


def test_start_big_wheel_includes_promoted_trumps_in_deck(
    api_base: str, auth: dict
) -> None:
    """Big Wheel ruleset adds 4 promoted trumps to the 54-card deck. We
    can't assert that THIS user got one (they're randomly distributed)
    but the response should at least surface the ruleset metadata so the
    frontend can render the Big-Wheel-specific UI."""
    r = requests.post(
        f"{api_base}/spades-practice/start",
        headers={**auth, "Content-Type": "application/json"},
        json={"ruleset": "BIG_WHEEL"},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    g = body["game"]
    assert g["ruleset"] == "BIG_WHEEL"
    assert g["ruleset_label"] == "Big Wheel"
    # Hand size is still 13 (one player gets the 14th card via dealer
    # discard rule — Spades AAA frontend doesn't implement the discard
    # yet, so we accept either 13 or 14 here for safety).
    assert len(g["your_hand"]) in (13, 14)


def test_start_rejects_unknown_ruleset(api_base: str, auth: dict) -> None:
    r = requests.post(
        f"{api_base}/spades-practice/start",
        headers={**auth, "Content-Type": "application/json"},
        json={"ruleset": "NOT_A_RULESET"},
        timeout=10,
    )
    assert r.status_code == 400


def test_state_returns_same_game(api_base: str, auth: dict) -> None:
    create = requests.post(
        f"{api_base}/spades-practice/start",
        headers={**auth, "Content-Type": "application/json"},
        json={"ruleset": "CLASSIC"},
        timeout=10,
    ).json()
    gid = create["game"]["game_id"]
    r = requests.get(
        f"{api_base}/spades-practice/state/{gid}",
        headers=auth,
        timeout=10,
    )
    assert r.status_code == 200
    assert r.json()["game_id"] == gid


# ─────────────────────────────────────────────────────────────── BID

def test_user_bid_advances_phase_to_playing(api_base: str, auth: dict) -> None:
    """Once SOUTH has bid, the bots auto-bid and the phase flips to
    playing. The response must include valid_plays for SOUTH so the
    frontend can render the legal subset."""
    create = requests.post(
        f"{api_base}/spades-practice/start",
        headers={**auth, "Content-Type": "application/json"},
        json={"ruleset": "CLASSIC"},
        timeout=10,
    ).json()
    gid = create["game"]["game_id"]

    r = requests.post(
        f"{api_base}/spades-practice/bid",
        headers={**auth, "Content-Type": "application/json"},
        json={"game_id": gid, "bid": 4},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["phase"] == "playing"
    assert body["your_bid"] == 4
    assert isinstance(body["valid_plays"], list)
    assert len(body["valid_plays"]) > 0


def test_bid_rejects_out_of_range(api_base: str, auth: dict) -> None:
    create = requests.post(
        f"{api_base}/spades-practice/start",
        headers={**auth, "Content-Type": "application/json"},
        json={"ruleset": "CLASSIC"},
        timeout=10,
    ).json()
    gid = create["game"]["game_id"]
    r = requests.post(
        f"{api_base}/spades-practice/bid",
        headers={**auth, "Content-Type": "application/json"},
        json={"game_id": gid, "bid": 14},
        timeout=10,
    )
    assert r.status_code == 400


# ───────────────────────────────────────────────────────────── PLAY CARD

def test_full_trick_advances_state(api_base: str, auth: dict) -> None:
    """Bid → play one valid card → backend should auto-play the bots
    around the table → trick completes → tricks_played increments by 1.
    The response must also include `play_sequence` so the frontend can
    stage card reveals one-by-one with visible pauses."""
    create = requests.post(
        f"{api_base}/spades-practice/start",
        headers={**auth, "Content-Type": "application/json"},
        json={"ruleset": "CLASSIC"},
        timeout=10,
    ).json()
    gid = create["game"]["game_id"]

    after_bid = requests.post(
        f"{api_base}/spades-practice/bid",
        headers={**auth, "Content-Type": "application/json"},
        json={"game_id": gid, "bid": 3},
        timeout=10,
    ).json()
    assert after_bid["phase"] == "playing"
    valid = after_bid["valid_plays"]
    assert valid, "Backend returned no valid plays after bidding"

    # Pick the first non-spade if any (avoids the spades-broken edge case).
    chosen = next(
        (c for c in valid if c["suit"] != "spades"),
        valid[0],
    )

    after_play = requests.post(
        f"{api_base}/spades-practice/play",
        headers={**auth, "Content-Type": "application/json"},
        json={"game_id": gid, "card": chosen},
        timeout=10,
    ).json()
    # Trick should have resolved (bots played, winner selected).
    assert after_play["tricks_played"] >= 1
    # We should have one fewer card in our hand.
    assert len(after_play["your_hand"]) == 12
    # play_sequence must be present with at least 4 entries (1 user + 3 bots).
    seq = after_play.get("play_sequence")
    assert isinstance(seq, list), "play_sequence missing from /play response"
    assert len(seq) >= 4, f"Expected ≥4 events, got {len(seq)}"
    # First event must be our play, and the trick must complete at some
    # point with a valid winner seat.
    assert seq[0]["player"] == "south"
    assert seq[0]["card"]["suit"] == chosen["suit"]
    trick_winners = [e for e in seq if e.get("trick_complete")]
    assert trick_winners, "No trick_complete event in play_sequence"
    assert trick_winners[-1]["trick_winner"] in {"north", "south", "east", "west"}


def test_play_invalid_card_rejected(api_base: str, auth: dict) -> None:
    """A card that isn't in the user's valid_plays for the current
    trick state must be rejected with 400."""
    create = requests.post(
        f"{api_base}/spades-practice/start",
        headers={**auth, "Content-Type": "application/json"},
        json={"ruleset": "CLASSIC"},
        timeout=10,
    ).json()
    gid = create["game"]["game_id"]
    requests.post(
        f"{api_base}/spades-practice/bid",
        headers={**auth, "Content-Type": "application/json"},
        json={"game_id": gid, "bid": 3},
        timeout=10,
    )
    # Random fake card — extremely unlikely to be in any valid_plays list.
    r = requests.post(
        f"{api_base}/spades-practice/play",
        headers={**auth, "Content-Type": "application/json"},
        json={
            "game_id": gid,
            "card": {
                "suit": "spades",
                "rank": "FAKE_CARD",
                "value": 999,
            },
        },
        timeout=10,
    )
    assert r.status_code == 400


# ───────────────────────────────────────────────────────── NEW HAND

def test_new_hand_redeals(api_base: str, auth: dict) -> None:
    create = requests.post(
        f"{api_base}/spades-practice/start",
        headers={**auth, "Content-Type": "application/json"},
        json={"ruleset": "CLASSIC"},
        timeout=10,
    ).json()
    gid = create["game"]["game_id"]
    r = requests.post(
        f"{api_base}/spades-practice/new-hand/{gid}",
        headers=auth,
        timeout=10,
    )
    assert r.status_code == 200
    body = r.json()
    assert len(body["your_hand"]) == 13
    assert body["phase"] == "bidding"
    assert body["your_bid"] == 0

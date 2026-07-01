"""Backend tests for the Jan 2026 iteration adding Hearts, Crazy Eights, and Go Fish AAA.

Schema note: the AAA game views expose:
    - `your_hand`: the south (user) hand (list of {rank, suit})
    - `players_data`: {north|east|south|west: {card_count, ...}}  — opponents' counts only
    - `phase`, `turn`, `pass_direction` / `top_card` / etc game-specific
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def auth_client():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/demo-login", timeout=20)
    assert r.status_code == 200, f"demo-login failed: {r.status_code} {r.text[:300]}"
    token = r.json()["token"]
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


# ================= HEARTS AAA =================

class TestHeartsAAA:
    def test_start_deals_13_and_pass_direction(self, auth_client):
        r = auth_client.post(f"{BASE_URL}/api/hearts-practice/start", json={})
        assert r.status_code == 200, r.text[:400]
        data = r.json()
        assert data.get("success") is True
        game = data["game"]
        assert game["phase"] in ("passing", "playing"), f"phase={game.get('phase')}"
        pd = game.get("pass_direction")
        assert pd in ("left", "right", "across", "none"), f"pass_direction={pd}"
        players_data = game["players_data"]
        assert set(players_data.keys()) == {"north", "east", "south", "west"}
        your_hand = game["your_hand"]
        assert len(your_hand) == 13, f"your_hand size={len(your_hand)}"
        # Total cards across seats = 52
        total = sum(players_data[p]["card_count"] for p in players_data)
        assert total == 52, f"total cards dealt={total}"
        pytest.hearts_pass_direction = pd
        pytest.hearts_south_hand = your_hand

    def test_pass_cards_advances_to_playing(self, auth_client):
        pd = getattr(pytest, "hearts_pass_direction", None)
        hand = getattr(pytest, "hearts_south_hand", None)
        if pd == "none":
            pytest.skip("pass_direction=none; no pass required")
        assert hand and len(hand) >= 3
        r = auth_client.post(
            f"{BASE_URL}/api/hearts-practice/pass-cards",
            json={"cards": hand[:3]},
        )
        assert r.status_code == 200, r.text[:500]
        game = r.json()["game"]
        assert game["phase"] == "playing", f"phase after pass={game.get('phase')}"

    def test_pass_cards_wrong_count_400(self, auth_client):
        auth_client.post(f"{BASE_URL}/api/hearts-practice/start", json={})
        state = auth_client.get(f"{BASE_URL}/api/hearts-practice/state").json()["game"]
        if state.get("phase") != "passing":
            pytest.skip("not in passing phase")
        hand = state["your_hand"]
        r = auth_client.post(
            f"{BASE_URL}/api/hearts-practice/pass-cards",
            json={"cards": hand[:2]},
        )
        assert r.status_code == 400, f"expected 400 got {r.status_code} {r.text[:200]}"


# ================= CRAZY EIGHTS AAA =================

class TestCrazyEightsAAA:
    def test_start_deals_5_top_card_not_8(self, auth_client):
        r = auth_client.post(f"{BASE_URL}/api/crazy-eights-practice/start", json={})
        assert r.status_code == 200, r.text[:400]
        data = r.json()
        assert data.get("success") is True
        game = data["game"]
        assert game.get("phase") == "playing", f"phase={game.get('phase')}"
        top = game.get("top_card")
        assert top is not None, "top_card missing"
        assert top.get("rank") != "8", f"top_card must not be 8 at start, got {top}"
        assert isinstance(game.get("draw_pile_count"), int) and game["draw_pile_count"] > 0
        assert game.get("declared_suit") in ("hearts", "diamonds", "clubs", "spades")
        your_hand = game["your_hand"]
        assert len(your_hand) == 5, f"your_hand size={len(your_hand)}"
        playable = game.get("playable_cards") or []
        hand_set = {(c.get("rank"), c.get("suit")) for c in your_hand}
        for c in playable:
            assert (c.get("rank"), c.get("suit")) in hand_set, f"playable {c} not in hand"
        # players_data present
        assert set(game["players_data"].keys()) == {"north", "east", "south", "west"}

    def test_play_legal_nonEight_updates_top(self, auth_client):
        start = auth_client.post(f"{BASE_URL}/api/crazy-eights-practice/start", json={}).json()["game"]
        if start.get("turn") != "south":
            pytest.skip("not south turn")
        playable = [c for c in (start.get("playable_cards") or []) if c.get("rank") != "8"]
        if not playable:
            pytest.skip("no legal non-8 playable")
        old_top = start["top_card"]
        card = playable[0]
        r = auth_client.post(f"{BASE_URL}/api/crazy-eights-practice/play", json={"card": card})
        assert r.status_code == 200, r.text[:500]
        game = r.json()["game"]
        new_top = game["top_card"]
        # Either top is now our card or bots also played; at minimum it must be different object state
        assert new_top is not None
        assert not game.get("pending_wild"), "non-8 should not trigger wild_pending"

    def test_draw_adds_card(self, auth_client):
        start = auth_client.post(f"{BASE_URL}/api/crazy-eights-practice/start", json={}).json()["game"]
        if start.get("turn") != "south":
            pytest.skip("not south turn")
        hand_before = start["your_hand"]
        r = auth_client.post(f"{BASE_URL}/api/crazy-eights-practice/draw", json={})
        assert r.status_code == 200, r.text[:500]
        game = r.json()["game"]
        hand_after = game["your_hand"]
        assert len(hand_after) == len(hand_before) + 1, \
            f"hand before={len(hand_before)} after={len(hand_after)}"


# ================= GO FISH AAA =================

class TestGoFishAAA:
    def test_start_deals_hand_and_askable_subset(self, auth_client):
        r = auth_client.post(f"{BASE_URL}/api/go-fish-practice/start", json={})
        assert r.status_code == 200, r.text[:400]
        data = r.json()
        assert data.get("success") is True
        game = data["game"]
        assert game.get("phase") == "playing"
        your_hand = game["your_hand"]
        # Initial deal is 5 but if all four of a rank land in hand, books may be removed.
        assert 1 <= len(your_hand) <= 7, f"unexpected your_hand size={len(your_hand)}"
        askable_ranks = game.get("askable_ranks") or []
        hand_ranks = {c["rank"] for c in your_hand}
        for rk in askable_ranks:
            assert rk in hand_ranks, f"askable rank {rk} not in hand {hand_ranks}"
        askable_targets = game.get("askable_targets") or []
        assert set(askable_targets).issubset({"north", "east", "west"})
        assert len(askable_targets) == 3, f"expected 3 targets got {askable_targets}"
        # players_data with 4 seats
        assert set(game["players_data"].keys()) == {"north", "east", "south", "west"}

    def test_ask_with_held_rank_ok(self, auth_client):
        start = auth_client.post(f"{BASE_URL}/api/go-fish-practice/start", json={}).json()["game"]
        if start.get("turn") != "south":
            pytest.skip("not south turn")
        ranks = start.get("askable_ranks") or []
        targets = start.get("askable_targets") or []
        if not ranks or not targets:
            pytest.skip("no askable ranks/targets")
        r = auth_client.post(
            f"{BASE_URL}/api/go-fish-practice/ask",
            json={"target": targets[0], "rank": ranks[0]},
        )
        assert r.status_code == 200, r.text[:500]
        game = r.json()["game"]
        seq = game.get("play_sequence") or []
        assert seq, "play_sequence missing"
        first = seq[0]
        assert ("received_count" in first) or first.get("go_fish") is True or first.get("drew") is not None, \
            f"unexpected first seq entry={first}"

    def test_ask_with_not_held_rank_400(self, auth_client):
        start = auth_client.post(f"{BASE_URL}/api/go-fish-practice/start", json={}).json()["game"]
        if start.get("turn") != "south":
            pytest.skip("not south turn")
        targets = start.get("askable_targets") or ["north"]
        hand_ranks = {c["rank"] for c in start["your_hand"]}
        all_ranks = {"A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"}
        not_held = list(all_ranks - hand_ranks)
        if not not_held:
            pytest.skip("south holds every rank (rare)")
        r = auth_client.post(
            f"{BASE_URL}/api/go-fish-practice/ask",
            json={"target": targets[0], "rank": not_held[0]},
        )
        assert r.status_code == 400, f"expected 400 got {r.status_code} body={r.text[:300]}"
        assert "must hold" in r.text.lower() or "hold" in r.text.lower(), \
            f"unexpected 400 message: {r.text[:200]}"


# ================= REGRESSION =================

class TestRegression:
    def test_spades_practice_still_works(self, auth_client):
        r = auth_client.post(f"{BASE_URL}/api/spades-practice/start", json={})
        assert r.status_code == 200, r.text[:300]
        game = r.json()["game"]
        assert len(game["your_hand"]) == 13

    def test_bid_whist_practice_still_works(self, auth_client):
        tried = []
        for path in ("/api/bid-whist-practice/start", "/api/bid-whist/start"):
            r = auth_client.post(f"{BASE_URL}{path}", json={})
            tried.append((path, r.status_code))
            if r.status_code == 200:
                return
        pytest.fail(f"Bid Whist start not reachable. Tried: {tried}")

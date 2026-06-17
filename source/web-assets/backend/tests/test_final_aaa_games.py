"""
Final AAA multiplayer card migration backend tests
Covers Gin Rummy, Rummy (Indian, 2/3/4 players), War + regression for prior 5 AAA games.
Response shape: game has `your_hand` (south's cards) + `players_data[seat].card_count`.
"""
from __future__ import annotations
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    resp = s.post(f"{BASE_URL}/api/auth/demo-login", json={})
    assert resp.status_code == 200, f"demo-login failed: {resp.status_code} {resp.text[:200]}"
    data = resp.json()
    token = data.get("token") or data.get("session_token")
    assert token, f"no token in demo-login: {list(data.keys())}"
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# ---------------------- Gin Rummy AAA ----------------------
class TestGinRummy:
    def test_start(self, client):
        r = client.post(f"{BASE_URL}/api/gin-rummy-practice/start", json={})
        assert r.status_code == 200, r.text[:300]
        g = r.json()["game"]
        assert g["phase"] == "draw"
        assert g["turn"] == "south"
        assert len(g["your_hand"]) == 10, f"expected 10 got {len(g['your_hand'])}"
        assert g.get("top_discard") is not None

    def test_draw_then_discard_advances_turn(self, client):
        client.post(f"{BASE_URL}/api/gin-rummy-practice/start", json={})
        r = client.post(f"{BASE_URL}/api/gin-rummy-practice/draw-stock", json={})
        assert r.status_code == 200, r.text[:300]
        g = r.json()["game"]
        assert g["phase"] == "discard"
        hand = g["your_hand"]
        assert len(hand) == 11
        card = hand[0]
        r2 = client.post(f"{BASE_URL}/api/gin-rummy-practice/discard",
                         json={"card": card, "knock": False})
        assert r2.status_code == 200, r2.text[:300]
        g2 = r2.json()["game"]
        if not g2.get("match_winner") and not g2.get("hand_summary"):
            # After south discards and bot plays, back to south draw (or hand ended)
            assert g2["phase"] == "draw"
            assert g2["turn"] == "south"

    def test_knock_with_high_deadwood_rejected(self, client):
        client.post(f"{BASE_URL}/api/gin-rummy-practice/start", json={})
        dr = client.post(f"{BASE_URL}/api/gin-rummy-practice/draw-stock", json={})
        g = dr.json()["game"]
        hand = g["your_hand"]
        deadwood = g.get("your_deadwood", 999)
        # Try knocking; when deadwood > 10 backend must reject
        card = hand[0]
        r = client.post(f"{BASE_URL}/api/gin-rummy-practice/discard",
                        json={"card": card, "knock": True})
        if deadwood > 10:
            assert r.status_code == 400, f"expected 400 for deadwood={deadwood}, got {r.status_code}: {r.text[:200]}"
            assert "deadwood" in r.text.lower() or "knock" in r.text.lower()
        else:
            # Rare case — hand legitimately knock-worthy
            assert r.status_code in (200, 400)


# ---------------------- Rummy (Indian) AAA ----------------------
class TestRummy:
    def test_start_4p(self, client):
        r = client.post(f"{BASE_URL}/api/rummy-practice/start", json={"num_players": 4})
        assert r.status_code == 200, r.text[:300]
        g = r.json()["game"]
        assert g["phase"] == "draw"
        assert len(g["your_hand"]) == 13
        assert g.get("wildcard_rank") is not None
        # 108 - 4*13 - 1 (discard) - 1 (wildcard) = 54
        assert g["stock_count"] == 54, f"expected 54 got {g['stock_count']}"
        assert set(g["active_positions"]) == {"north", "east", "south", "west"}
        # Other seats dealt 13 cards too
        pdata = g["players_data"]
        for seat in ("north", "east", "west"):
            assert pdata[seat]["card_count"] == 13, f"{seat} {pdata[seat]}"

    def test_start_2p(self, client):
        r = client.post(f"{BASE_URL}/api/rummy-practice/start", json={"num_players": 2})
        assert r.status_code == 200, r.text[:300]
        g = r.json()["game"]
        assert set(g["active_positions"]) == {"north", "south"}
        assert len(g["your_hand"]) == 13
        pdata = g["players_data"]
        assert pdata["north"]["card_count"] == 13
        # Inactive seats have 0 card count
        assert pdata.get("east", {}).get("card_count", 0) == 0
        assert pdata.get("west", {}).get("card_count", 0) == 0

    def test_draw_discard_cycle(self, client):
        client.post(f"{BASE_URL}/api/rummy-practice/start", json={"num_players": 4})
        r = client.post(f"{BASE_URL}/api/rummy-practice/draw-stock", json={})
        assert r.status_code == 200, r.text[:300]
        g = r.json()["game"]
        assert g["phase"] == "discard"
        hand = g["your_hand"]
        r2 = client.post(f"{BASE_URL}/api/rummy-practice/discard", json={"card": hand[0]})
        assert r2.status_code == 200, r2.text[:300]
        g2 = r2.json()["game"]
        if not g2.get("match_winner") and not g2.get("hand_summary"):
            assert g2["phase"] == "draw"
            assert g2["turn"] == "south"

    def test_declare_rejected_when_invalid(self, client):
        client.post(f"{BASE_URL}/api/rummy-practice/start", json={"num_players": 4})
        client.post(f"{BASE_URL}/api/rummy-practice/draw-stock", json={})
        # Empty groups payload -> must error
        r = client.post(f"{BASE_URL}/api/rummy-practice/declare", json={"groups": []})
        assert r.status_code == 400, r.text[:300]


# ---------------------- War AAA ----------------------
class TestWar:
    def test_start(self, client):
        r = client.post(f"{BASE_URL}/api/war-practice/start", json={})
        assert r.status_code == 200, r.text[:300]
        g = r.json()["game"]
        assert g["phase"] == "ready"
        assert g["north_count"] == 26
        assert g["south_count"] == 26

    def test_play_round(self, client):
        r = client.post(f"{BASE_URL}/api/war-practice/play-round", json={})
        assert r.status_code == 200, r.text[:300]
        g = r.json()["game"]
        last = g.get("last_round") or g.get("last_battle")
        assert last is not None, f"no last_round key: {list(g.keys())}"
        assert "winner" in last
        assert "war_depth" in last

    def test_match_finishes(self, client):
        client.post(f"{BASE_URL}/api/war-practice/start", json={"max_rounds": 50})
        finished = False
        for _ in range(80):
            rr = client.post(f"{BASE_URL}/api/war-practice/play-round", json={})
            if rr.status_code != 200:
                break
            gg = rr.json()["game"]
            if gg.get("phase") == "finished":
                assert "match_winner" in gg
                finished = True
                break
        assert finished, "War match did not finish within 80 rounds"


# ---------------------- Regression: prior 5 AAA games ----------------------
class TestRegressionPriorAAA:
    @pytest.mark.parametrize("endpoint", [
        "/api/spades-practice/start",
        "/api/bid-whist-practice/start",
        "/api/hearts-practice/start",
        "/api/crazy-eights-practice/start",
        "/api/go-fish-practice/start",
    ])
    def test_start_returns_200(self, client, endpoint):
        r = client.post(f"{BASE_URL}{endpoint}", json={})
        assert r.status_code == 200, f"{endpoint} -> {r.status_code} {r.text[:200]}"
        data = r.json()
        assert data.get("success") is True or "game" in data

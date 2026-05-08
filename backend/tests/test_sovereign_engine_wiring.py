"""Wave-2 wiring tests: war_of_attrition + sovereign_game_logic engines
plugged into the live 6-5-4 tournament TIE branch and Spades route.

These tests do NOT exercise the engines themselves (covered separately in
test_war_of_attrition.py and test_sovereign_game_logic.py) — they verify
the route layer correctly imports + invokes the canonical engines.
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from server import app


client = TestClient(app)


# ── Spades route exposes Sovereign Universal Tongue endpoints ─────────────

def test_spades_sovereign_constants_endpoint() -> None:
    r = client.get("/api/spades/sovereign/constants")
    assert r.status_code == 200, r.text
    body = r.json()
    assert "power_matrix" in body
    assert "UPTOWN" in body["power_matrix"]
    assert "DOWNTOWN" in body["power_matrix"]
    assert body["trump_priority_bonus"] == 200
    assert body["joker_powers"] == {"LJ": 90, "BJ": 100}


def test_spades_card_power_uptown_ace_no_trump() -> None:
    r = client.post(
        "/api/spades/sovereign/card-power",
        json={"rank": "A", "suit": "hearts", "bid_type": "UPTOWN", "trump_suit": "spades"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["power"] == 14   # Ace base power UPTOWN
    assert body["is_trump"] is False
    assert body["is_joker"] is False


def test_spades_card_power_trump_bonus_applied() -> None:
    r = client.post(
        "/api/spades/sovereign/card-power",
        json={"rank": "A", "suit": "spades", "bid_type": "UPTOWN", "trump_suit": "spades"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["power"] == 14 + 200   # Ace + trump bonus
    assert body["is_trump"] is True


def test_spades_card_power_big_joker_global() -> None:
    """Jokers are trump-independent — power 100 regardless of trump suit."""
    r = client.post(
        "/api/spades/sovereign/card-power",
        json={"rank": "BJ", "suit": "", "bid_type": "DOWNTOWN", "trump_suit": "hearts"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["power"] == 100
    assert r.json()["is_joker"] is True


def test_spades_card_power_invalid_rank_400() -> None:
    r = client.post(
        "/api/spades/sovereign/card-power",
        json={"rank": "ZZ", "suit": "spades", "bid_type": "UPTOWN", "trump_suit": "spades"},
    )
    assert r.status_code == 400


def test_spades_hot_card_alert_big_joker() -> None:
    r = client.post(
        "/api/spades/sovereign/hot-card-alert",
        json={"rank": "BJ", "suit": None, "player_id": "p1"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["is_joker"] is True
    assert body["sound_fx"] == "big_joker"
    assert "Big Joker" in body["label"]


def test_spades_bounty_warning_payload_shape() -> None:
    r = client.post(
        "/api/spades/sovereign/bounty-warning",
        json={
            "bounty": 25.0,
            "contenders": [
                {"player_id": "p1", "balance": 100.0},
                {"player_id": "p2", "balance": 10.0},
            ],
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["bounty"] == 25.0
    assert "$25.00" in body["label"]
    can_cover = {c["player_id"]: c["can_cover"] for c in body["contenders"]}
    assert can_cover["p1"] is True
    assert can_cover["p2"] is False


# ── 6-5-4 Tournament TIE branch wires resolve_multi_tie ───────────────────

def test_vibe_654_tournament_module_imports_canonical_engines() -> None:
    """Read the route file source and assert the canonical engines are
    actually imported. Catches accidental refactors that drop the wiring.
    """
    src = open("/app/backend/routes/vibe_654_tournament.py").read()
    assert "from services.sovereign_game_logic import" in src
    assert "resolve_multi_tie" in src
    assert "from services.war_of_attrition import" in src
    assert "compute_tie_tax_multiplier" in src
    assert "reopen_spectator_side_action" in src
    # And the response should include the new tax projection field
    assert "tax_projection" in src
    assert "tie_resolution_status" in src

"""
Integration tests for Vibe 654 Solo Vault — 5-dice classic rules.
"""
import os
import sys
from pathlib import Path

import httpx
import pytest
from dotenv import dotenv_values

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

_ENV = dotenv_values(Path(__file__).resolve().parents[1] / ".env")
BASE = os.getenv("BACKEND_TEST_URL", "http://localhost:8001")
API = f"{BASE}/api"


@pytest.fixture()
def client():
    with httpx.Client(base_url=API, timeout=10.0) as c:
        yield c


@pytest.fixture()
def token(client):
    r = client.post("/auth/demo-login", json={})
    assert r.status_code == 200
    return r.json()["token"]


def test_start_game_gives_5_dice_state_and_3_rolls(client, token):
    r = client.post(
        "/vibez-654/start",
        json={"bet": 100},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.text
    g = r.json()
    assert g["rolls_remaining"] == 3
    assert g["has_6"] is False
    assert g["has_5"] is False
    assert g["has_4"] is False
    assert g["qualified"] is False
    assert g["status"] == "active"


def test_roll_returns_exactly_five_dice_on_first_roll(client, token):
    r = client.post(
        "/vibez-654/start",
        json={"bet": 0},
        headers={"Authorization": f"Bearer {token}"},
    )
    gid = r.json()["game_id"]
    r = client.post(
        "/vibez-654/roll",
        json={"game_id": gid},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.text
    g = r.json()
    # First roll — zero qualifiers locked coming in → must roll all 5.
    assert len(g["last_roll_dice"]) == 5
    assert g["rolls"] == 1
    assert g["rolls_remaining"] == 2


def test_apply_654_pass_logic_unit():
    """
    Unit-level check of the sequential 6→5→4 peel. Hits the helper directly.
    """
    from routes.vibez_654 import _apply_654_pass
    # Roll containing 6,5,4 in random positions — qualifies immediately.
    out = _apply_654_pass([3, 4, 6, 5, 2], False, False, False)
    assert out["has_6"] is True and out["has_5"] is True and out["has_4"] is True
    assert out["qualified"] is True
    # Leftover should be the two non-qualifier dice.
    assert sorted(out["point_dice"]) == [2, 3]
    # residual_dice mirrors point_dice when qualified.
    assert sorted(out["residual_dice"]) == [2, 3]

    # Out-of-order 4 alone can't qualify before 6.
    out = _apply_654_pass([4, 4, 4, 4, 4], False, False, False)
    assert out["has_6"] is False and out["qualified"] is False
    # All 5 dice still IN PLAY because nothing got peeled.
    assert out["residual_dice"] == [4, 4, 4, 4, 4]

    # 6 then 5 but no 4 → not qualified, but flags updated.
    out = _apply_654_pass([6, 5, 3, 3, 2], False, False, False)
    assert out["has_6"] is True and out["has_5"] is True
    assert out["has_4"] is False and out["qualified"] is False
    # The 6 and 5 got REMOVED from the physical dice set per the rules.
    # residual_dice should be the 3 leftover dice [3, 3, 2].
    assert sorted(out["residual_dice"]) == [2, 3, 3]

    # Single qualifier this pass — only the 6 is peeled.
    out = _apply_654_pass([6, 3, 2, 1, 1], False, False, False)
    assert out["has_6"] is True and out["has_5"] is False and out["has_4"] is False
    assert sorted(out["residual_dice"]) == [1, 1, 2, 3]


def test_rolls_remaining_decrements_and_auto_ends_at_zero(client, token):
    r = client.post("/vibez-654/start", json={"bet": 0}, headers={"Authorization": f"Bearer {token}"})
    gid = r.json()["game_id"]
    for _ in range(3):
        r = client.post("/vibez-654/roll", json={"game_id": gid}, headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
    g = r.json()
    # By the 3rd roll the game MUST be ended (auto-stand when rolls run out).
    assert g["status"] == "ended"


def test_stand_before_qualifying_settles_zero_score(client, token):
    r = client.post("/vibez-654/start", json={"bet": 0}, headers={"Authorization": f"Bearer {token}"})
    gid = r.json()["game_id"]
    # Roll once but don't qualify — then stand immediately.
    client.post("/vibez-654/roll", json={"game_id": gid}, headers={"Authorization": f"Bearer {token}"})
    r = client.post("/vibez-654/stand", json={"game_id": gid}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    g = r.json()
    # If they didn't qualify, score must be 0 (the rules say BUST).
    if not g["qualified"]:
        assert g["score"] == 0
    else:
        # If the first roll already qualified, score = sum of 2 point dice.
        assert 2 <= g["score"] <= 12

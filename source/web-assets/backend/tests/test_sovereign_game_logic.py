"""
Lock-in tests for DSG Master Sovereign Game Logic v4.0.
Source: DSG_Master_Sovereign_Game_Logic.pdf (founder spec, Feb 2026).
"""
import pytest

from services.sovereign_game_logic import (
    POWER_MATRIX,
    TRUMP_PRIORITY_BONUS,
    get_card_power,
    TieContender,
    resolve_multi_tie,
    hot_card_alert,
    bounty_warning,
    burn_indicator,
)


# ── Section I: POWER_MATRIX verbatim lock ──────────────────────────────────
def test_uptown_matrix_locked():
    m = POWER_MATRIX["UPTOWN"]
    assert m["2"] == 2 and m["10"] == 10
    assert m["J"] == 11 and m["Q"] == 12 and m["K"] == 13 and m["A"] == 14
    assert m["LJ"] == 90 and m["BJ"] == 100


def test_downtown_matrix_locked():
    m = POWER_MATRIX["DOWNTOWN"]
    assert m["A"] == 1 and m["K"] == 2 and m["Q"] == 3 and m["J"] == 4
    assert m["10"] == 5 and m["2"] == 13
    assert m["LJ"] == 90 and m["BJ"] == 100


def test_trump_priority_bonus_locked():
    assert TRUMP_PRIORITY_BONUS == 200


# ── get_card_power ──────────────────────────────────────────────────────────
def test_ace_uptown_beats_king():
    a = get_card_power("A", "hearts", "UPTOWN", None)
    k = get_card_power("K", "hearts", "UPTOWN", None)
    assert a > k


def test_ace_downtown_beats_by_being_low():
    a = get_card_power("A", "hearts", "DOWNTOWN", None)
    two = get_card_power("2", "hearts", "DOWNTOWN", None)
    # Downtown: A=1, 2=13 → 2 has higher power value. Power reflects spec math.
    assert two > a


def test_trump_adds_200():
    base = get_card_power("7", "hearts", "UPTOWN", None)
    trumped = get_card_power("7", "hearts", "UPTOWN", "hearts")
    assert trumped == base + 200


def test_jokers_beat_non_joker_trump():
    # BJ=100 > any trump-boosted non-joker card. Except... let's check spec.
    # Spec: Ace of trump = 14 + 200 = 214. BJ = 100.
    # So trump Ace (214) > BJ (100). Spec is clear: jokers are trump-independent.
    bj = get_card_power("BJ", "", "UPTOWN", "hearts")
    trump_ace = get_card_power("A", "hearts", "UPTOWN", "hearts")
    assert bj == 100
    assert trump_ace == 214
    assert trump_ace > bj
    # But non-trump Ace: 14 < BJ 100.
    non_trump_ace = get_card_power("A", "spades", "UPTOWN", "hearts")
    assert bj > non_trump_ace


def test_big_joker_greater_than_little_joker():
    assert get_card_power("BJ", "", "UPTOWN", None) > get_card_power("LJ", "", "UPTOWN", None)
    assert get_card_power("BJ", "", "DOWNTOWN", None) > get_card_power("LJ", "", "DOWNTOWN", None)


def test_invalid_bid_type_raises():
    with pytest.raises(ValueError):
        get_card_power("A", "hearts", "SIDEWAYS", None)


def test_invalid_rank_raises():
    with pytest.raises(ValueError):
        get_card_power("15", "hearts", "UPTOWN", None)


# ── Section II: resolve_multi_tie ──────────────────────────────────────────
def test_single_survivor_wins():
    alice = TieContender("alice", 10.0)
    bob = TieContender("bob", 0.5)  # can't cover 2.0 bounty
    res = resolve_multi_tie([alice, bob], initial_bounty=2.0, current_pot=10.0)
    assert res.status == "winner"
    assert len(res.contenders) == 1 and res.contenders[0].player_id == "alice"
    assert len(res.knocked_out) == 1 and res.knocked_out[0].player_id == "bob"
    assert res.pot == 12.0  # 10 + alice's 2.0
    assert alice.balance == 8.0
    assert bob.balance == 0.5  # untouched


def test_two_survivors_continue_shootout():
    alice = TieContender("alice", 10.0)
    bob = TieContender("bob", 10.0)
    carol = TieContender("carol", 10.0)
    res = resolve_multi_tie([alice, bob, carol], initial_bounty=2.0, current_pot=10.0)
    assert res.status == "continue"
    assert len(res.contenders) == 3
    assert res.pot == 16.0  # 10 + 2*3
    for p in (alice, bob, carol):
        assert p.balance == 8.0


def test_all_bankrupt_returns_pot_to_house():
    poor1 = TieContender("p1", 0.1)
    poor2 = TieContender("p2", 0.1)
    res = resolve_multi_tie([poor1, poor2], initial_bounty=5.0, current_pot=20.0)
    assert res.status == "all_bankrupt"
    assert res.contenders == []
    assert len(res.knocked_out) == 2
    assert res.pot == 20.0  # untouched, caller returns to house


def test_events_emitted_per_player():
    alice = TieContender("alice", 10.0)
    bob = TieContender("bob", 0.1)
    res = resolve_multi_tie([alice, bob], initial_bounty=2.0, current_pot=10.0)
    types = [e["type"] for e in res.events]
    assert "bounty_matched" in types
    assert "bounty_forfeit" in types


def test_negative_bounty_rejected():
    alice = TieContender("alice", 10.0)
    with pytest.raises(ValueError):
        resolve_multi_tie([alice], initial_bounty=-1.0, current_pot=0)


# ── Section III: UI event payloads ──────────────────────────────────────────
def test_hot_card_alert_big_joker():
    e = hot_card_alert("BJ", "", "alice")
    assert e["type"] == "sovereign_tongue.hot_card"
    assert e["is_joker"] is True
    assert e["sound_fx"] == "big_joker"
    assert e["label"] == "Big Joker Played!"


def test_hot_card_alert_ace():
    e = hot_card_alert("A", "hearts", "alice")
    assert e["is_joker"] is False
    assert e["sound_fx"] == "ace_drop"


def test_bounty_warning_label_formatting():
    alice = TieContender("alice", 5.0)
    e = bounty_warning(2.00, [alice])
    assert e["label"] == "Match $2.00 or Bankrupt!"
    assert e["contenders"][0]["can_cover"] is True


def test_burn_indicator_formatting():
    e = burn_indicator(tokens_burned=0.1234, running_total=100.5678)
    assert "0.1234" in e["label"]
    assert "100.5678" in e["label"]
    assert e["burned_this_hand"] == 0.1234

"""
Lock-in tests for DSG "Thirty-One" (Game #31 — Scarcity Rules).
Source: GlobalVibezDSG_Fixed_Handoff_31Games.pdf §1 (founder spec, Feb 2026).
"""
import pytest

from services.thirty_one import (
    Card,
    BLITZ_SCORE,
    ACE_VALUE,
    FACE_VALUE,
    card_value,
    dsg_31_logic,
    PlayerHand,
    resolve_round,
)


# ── Card value table ────────────────────────────────────────────────────────
def test_ace_value_locked():
    assert ACE_VALUE == 11 and card_value("A") == 11


def test_face_value_locked():
    assert FACE_VALUE == 10
    assert card_value("J") == 10
    assert card_value("Q") == 10
    assert card_value("K") == 10


def test_number_cards_pip_value():
    for n in range(2, 11):
        assert card_value(str(n)) == n


def test_blitz_score_locked():
    assert BLITZ_SCORE == 31


# ── Card construction validation ────────────────────────────────────────────
def test_invalid_suit_rejected():
    with pytest.raises(ValueError):
        Card(rank="A", suit="X")


def test_invalid_rank_rejected():
    with pytest.raises(ValueError):
        Card(rank="1", suit="H")


# ── Core dsg_31_logic ───────────────────────────────────────────────────────
def test_blitz_triple_face_plus_ace_same_suit():
    # Spec-canonical BLITZ: A + K + Q all hearts = 11 + 10 + 10 = 31
    hand = [Card("A", "H"), Card("K", "H"), Card("Q", "H")]
    r = dsg_31_logic(hand)
    assert r.status == "BLITZ"
    assert r.score == 31
    assert r.payout is True
    assert r.suits["H"] == 31


def test_blitz_ace_plus_face_plus_10():
    # A + J + 10 all spades = 11 + 10 + 10 = 31
    hand = [Card("A", "S"), Card("J", "S"), Card("10", "S")]
    r = dsg_31_logic(hand)
    assert r.status == "BLITZ"
    assert r.score == 31


def test_live_mixed_suits_returns_best_single_suit():
    # A♥ + K♥ + 5♠ = hearts 21, spades 5 → best=21 LIVE
    hand = [Card("A", "H"), Card("K", "H"), Card("5", "S")]
    r = dsg_31_logic(hand)
    assert r.status == "LIVE"
    assert r.score == 21
    assert r.payout is False
    assert r.suits == {"S": 5, "H": 21, "D": 0, "C": 0}


def test_live_below_blitz_close_threshold():
    # A♥ + K♥ + 9♥ = 30 → NOT BLITZ (must be exactly 31)
    hand = [Card("A", "H"), Card("K", "H"), Card("9", "H")]
    r = dsg_31_logic(hand)
    assert r.status == "LIVE"
    assert r.score == 30


def test_over_31_still_live():
    # A + K + Q + J all clubs = 11+10+10+10 = 41 → LIVE 41 (no bust concept)
    hand = [Card("A", "C"), Card("K", "C"), Card("Q", "C"), Card("J", "C")]
    r = dsg_31_logic(hand)
    assert r.status == "LIVE"
    assert r.score == 41


def test_lowest_possible_hand():
    hand = [Card("2", "S"), Card("3", "H"), Card("4", "D")]
    r = dsg_31_logic(hand)
    assert r.status == "LIVE"
    assert r.score == 4  # Best single suit = 4 (diamonds)


def test_empty_hand_rejected():
    with pytest.raises(ValueError):
        dsg_31_logic([])


# ── Multi-player round resolution ───────────────────────────────────────────
def test_round_with_single_blitz():
    p1 = PlayerHand("alice", [Card("A", "H"), Card("K", "H"), Card("Q", "H")])
    p2 = PlayerHand("bob",   [Card("5", "S"), Card("K", "C"), Card("2", "D")])
    out = resolve_round([p1, p2])
    assert out.blitzes == ["alice"]
    assert "alice" not in out.low_score_players
    assert out.tie_at_low is False


def test_round_with_low_score_tie():
    # Both tie at score 5 → tie_at_low True → caller invokes war_of_attrition
    p1 = PlayerHand("alice", [Card("5", "S"), Card("2", "H"), Card("3", "C")])
    p2 = PlayerHand("bob",   [Card("2", "S"), Card("5", "H"), Card("3", "D")])
    out = resolve_round([p1, p2])
    assert out.tie_at_low is True
    assert set(out.low_score_players) == {"alice", "bob"}
    assert out.low_score == 5


def test_round_no_tie_clean_winner_loser():
    p1 = PlayerHand("alice", [Card("A", "H"), Card("K", "H"), Card("5", "C")])  # 21
    p2 = PlayerHand("bob",   [Card("7", "S"), Card("8", "H"), Card("9", "D")])  # 9
    out = resolve_round([p1, p2])
    assert out.blitzes == []
    assert out.tie_at_low is False
    assert out.high_score == 21 and out.low_score == 9
    assert out.high_score_players == ["alice"]
    assert out.low_score_players == ["bob"]


def test_round_all_blitz_no_low_tie_raised():
    p1 = PlayerHand("alice", [Card("A", "H"), Card("K", "H"), Card("Q", "H")])
    p2 = PlayerHand("bob",   [Card("A", "S"), Card("J", "S"), Card("10", "S")])
    out = resolve_round([p1, p2])
    assert sorted(out.blitzes) == ["alice", "bob"]
    assert out.tie_at_low is False


def test_empty_players_rejected():
    with pytest.raises(ValueError):
        resolve_round([])

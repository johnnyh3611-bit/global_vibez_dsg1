"""Tests for Bingo + Caribbean Stud engines."""
import pytest
from services.bingo import (
    generate_card, daub_card, evaluate_card, cell_index, number_letter,
    BingoCard, COLUMN_RANGES, COLUMN_LETTERS, FREE_CELL_INDEX,
    PAYOUT_LINE, PAYOUT_FOUR_CORNERS, PAYOUT_FULL_HOUSE,
)
from services.caribbean_stud import (
    Card, evaluate_hand, compare_hands, resolve_round, deal_round,
    HAND_RANK_ORDER,
)


# ── Bingo ───────────────────────────────────────────────────────────────────
def test_bingo_card_columns_in_range():
    card = generate_card(seed=42)
    for col in range(5):
        lo, hi = COLUMN_RANGES[col]
        for row in range(5):
            v = card.cells[row][col]
            if (row, col) == (2, 2):
                assert v == 0    # FREE space
            else:
                assert lo <= v <= hi


def test_bingo_free_cell_pre_daubed():
    card = generate_card(seed=1)
    assert FREE_CELL_INDEX in card.daubed


def test_bingo_letter_for_number():
    assert number_letter(1) == "B" and number_letter(15) == "B"
    assert number_letter(16) == "I" and number_letter(30) == "I"
    assert number_letter(31) == "N" and number_letter(45) == "N"
    assert number_letter(46) == "G" and number_letter(60) == "G"
    assert number_letter(61) == "O" and number_letter(75) == "O"


def test_bingo_daub_marks_cell():
    card = generate_card(seed=42)
    target = card.cells[0][0]
    assert daub_card(card, target) is True
    assert cell_index(0, 0) in card.daubed


def test_bingo_daub_miss_returns_false():
    card = generate_card(seed=42)
    # Use a number outside the card's range (force miss): pick something not present
    nums_on_card = {card.cells[r][c] for r in range(5) for c in range(5)}
    miss = next(n for n in range(1, 76) if n not in nums_on_card)
    assert daub_card(card, miss) is False


def test_bingo_full_house_pays_50():
    card = generate_card(seed=42)
    # Manually daub all 25 cells
    for i in range(25):
        card.daubed.add(i)
    res = evaluate_card(card, stake=10.0)
    assert res.has_win is True
    assert "full_house" in res.patterns
    assert res.base_payout_multiplier == PAYOUT_FULL_HOUSE
    # Sovereign Square is also satisfied since all cells daubed → 2x kicks in
    assert res.is_sovereign_square is True
    assert res.final_multiplier == PAYOUT_FULL_HOUSE * 2


def test_bingo_four_corners_pattern():
    card = generate_card(seed=42)
    card.daubed = {0, 4, 20, 24, FREE_CELL_INDEX}
    res = evaluate_card(card, stake=10.0)
    assert res.has_win is True
    assert "four_corners" in res.patterns
    # Sovereign Square (corners + center) is also true
    assert res.is_sovereign_square is True


def test_bingo_single_row_no_sovereign():
    card = generate_card(seed=42)
    card.daubed = {cell_index(0, c) for c in range(5)} | {FREE_CELL_INDEX}
    res = evaluate_card(card, stake=10.0)
    assert "row_0" in res.patterns
    assert res.is_sovereign_square is False
    assert res.final_multiplier == PAYOUT_LINE


def test_bingo_no_win():
    card = generate_card(seed=42)
    res = evaluate_card(card, stake=10.0)
    assert res.has_win is False
    assert res.gross_payout == 0.0


# ── Caribbean Stud ──────────────────────────────────────────────────────────
def test_eval_royal_flush():
    cat, _ = evaluate_hand([Card("A", "S"), Card("K", "S"), Card("Q", "S"), Card("J", "S"), Card("10", "S")])
    assert cat == "royal_flush"


def test_eval_straight_flush():
    cat, _ = evaluate_hand([Card("9", "H"), Card("8", "H"), Card("7", "H"), Card("6", "H"), Card("5", "H")])
    assert cat == "straight_flush"


def test_eval_four_of_a_kind():
    cat, _ = evaluate_hand([Card("Q", "S"), Card("Q", "H"), Card("Q", "D"), Card("Q", "C"), Card("3", "S")])
    assert cat == "four_of_a_kind"


def test_eval_full_house():
    cat, _ = evaluate_hand([Card("J", "S"), Card("J", "H"), Card("J", "D"), Card("4", "S"), Card("4", "C")])
    assert cat == "full_house"


def test_eval_pair():
    cat, _ = evaluate_hand([Card("9", "S"), Card("9", "H"), Card("Q", "D"), Card("3", "S"), Card("2", "C")])
    assert cat == "pair"


def test_eval_high_card():
    cat, _ = evaluate_hand([Card("A", "S"), Card("Q", "H"), Card("9", "D"), Card("5", "S"), Card("3", "C")])
    assert cat == "high_card"


def test_compare_higher_category_wins():
    a = [Card("A", "S"), Card("A", "H"), Card("3", "D"), Card("4", "S"), Card("5", "C")]   # pair of aces
    b = [Card("K", "S"), Card("K", "H"), Card("K", "D"), Card("4", "S"), Card("5", "C")]   # three kings
    assert compare_hands(a, b) == -1


def test_compare_kicker_resolves_tie():
    a = [Card("A", "S"), Card("A", "H"), Card("Q", "D"), Card("4", "S"), Card("5", "C")]
    b = [Card("A", "C"), Card("A", "D"), Card("J", "H"), Card("4", "C"), Card("5", "H")]
    assert compare_hands(a, b) == 1


def test_dealer_does_not_qualify_returns_play_pays_ante():
    # Player: pair, Dealer: high card less than AK → dealer doesn't qualify
    player = [Card("9", "S"), Card("9", "H"), Card("Q", "D"), Card("3", "S"), Card("2", "C")]
    dealer = [Card("Q", "H"), Card("J", "H"), Card("9", "C"), Card("4", "D"), Card("2", "H")]  # Q-high
    out = resolve_round(player, dealer, ante=10.0, raise_play=True)
    assert out.dealer_qualifies is False
    assert out.ante_payout == 10.0
    assert out.play_payout == 0.0
    assert out.gross_total == 10.0


def test_player_wins_dealer_qualifies_pair():
    player = [Card("A", "S"), Card("A", "H"), Card("5", "D"), Card("3", "S"), Card("2", "C")]
    dealer = [Card("A", "C"), Card("K", "H"), Card("9", "C"), Card("4", "D"), Card("2", "H")]  # A-K high (qualifies)
    out = resolve_round(player, dealer, ante=10.0, raise_play=True)
    assert out.dealer_qualifies is True
    assert out.ante_payout == 10.0     # 1:1 ante
    assert out.play_payout == 20.0     # pair pays 1:1 on $20 play
    assert out.gross_total == 30.0


def test_dealer_wins_player_loses_both_bets():
    player = [Card("9", "S"), Card("4", "H"), Card("7", "D"), Card("3", "S"), Card("2", "C")]  # 9-high
    dealer = [Card("A", "C"), Card("K", "H"), Card("Q", "C"), Card("J", "D"), Card("9", "H")]  # A-high (qualifies)
    out = resolve_round(player, dealer, ante=10.0, raise_play=True)
    assert out.dealer_qualifies is True
    assert out.gross_total == -30.0   # ante 10 + play 20 lost


def test_fold_loses_ante():
    player = [Card("2", "S"), Card("3", "H"), Card("4", "D"), Card("5", "S"), Card("7", "C")]
    dealer = [Card("A", "C"), Card("K", "H"), Card("Q", "C"), Card("J", "D"), Card("9", "H")]
    out = resolve_round(player, dealer, ante=10.0, raise_play=False)
    assert out.folded is True
    assert out.gross_total == -10.0


def test_deal_round_returns_two_5_card_hands():
    p, d = deal_round(seed=42)
    assert len(p) == 5 and len(d) == 5
    # No card duplicated
    assert len(set((c.rank, c.suit) for c in p + d)) == 10

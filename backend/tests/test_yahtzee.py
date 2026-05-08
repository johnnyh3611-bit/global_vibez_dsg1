"""
Lock-in tests for the Yahtzee scoring engine.
Standard Hasbro rules, exhaustive coverage of all 13 categories + bonuses.
"""
import pytest

from services.yahtzee import (
    NUM_DICE, UPPER_CATEGORIES, LOWER_CATEGORIES, ALL_CATEGORIES,
    UPPER_BONUS_THRESHOLD, UPPER_BONUS_VALUE, YAHTZEE_BONUS_VALUE,
    score_category, is_yahtzee,
    Scorecard, fill_category,
    compute_totals, best_categories_for,
)


# ── Constants ────────────────────────────────────────────────────────────────
def test_categories_total_thirteen():
    assert len(ALL_CATEGORIES) == 13
    assert len(UPPER_CATEGORIES) == 6
    assert len(LOWER_CATEGORIES) == 7


def test_constants_locked():
    assert UPPER_BONUS_THRESHOLD == 63
    assert UPPER_BONUS_VALUE == 35
    assert YAHTZEE_BONUS_VALUE == 100
    assert NUM_DICE == 5


# ── Validation ──────────────────────────────────────────────────────────────
def test_wrong_dice_count_rejected():
    with pytest.raises(ValueError):
        score_category("aces", [1, 1, 1])


def test_invalid_face_rejected():
    with pytest.raises(ValueError):
        score_category("aces", [1, 1, 7, 1, 1])


def test_unknown_category_rejected():
    with pytest.raises(ValueError):
        score_category("seven_of_a_kind", [1, 1, 1, 1, 1])


# ── Upper section ───────────────────────────────────────────────────────────
@pytest.mark.parametrize("cat,dice,expected", [
    ("aces",   [1, 2, 3, 4, 5], 1),
    ("aces",   [1, 1, 1, 4, 5], 3),
    ("aces",   [2, 3, 4, 5, 6], 0),
    ("twos",   [2, 2, 5, 6, 1], 4),
    ("threes", [3, 3, 3, 1, 2], 9),
    ("fours",  [4, 4, 4, 4, 1], 16),
    ("fives",  [5, 5, 5, 5, 5], 25),
    ("sixes",  [6, 6, 6, 1, 2], 18),
])
def test_upper_section_scoring(cat, dice, expected):
    assert score_category(cat, dice) == expected


# ── Three / Four of a kind ──────────────────────────────────────────────────
def test_three_of_a_kind_pays_total():
    assert score_category("three_of_a_kind", [3, 3, 3, 4, 5]) == 18


def test_three_of_a_kind_zero_when_under():
    assert score_category("three_of_a_kind", [1, 2, 3, 4, 5]) == 0


def test_four_of_a_kind_pays_total():
    assert score_category("four_of_a_kind", [4, 4, 4, 4, 6]) == 22


def test_four_of_a_kind_zero_when_only_three():
    assert score_category("four_of_a_kind", [4, 4, 4, 5, 6]) == 0


def test_yahtzee_qualifies_for_3_and_4_of_kind():
    assert score_category("three_of_a_kind", [5, 5, 5, 5, 5]) == 25
    assert score_category("four_of_a_kind",  [5, 5, 5, 5, 5]) == 25


# ── Full House ──────────────────────────────────────────────────────────────
def test_full_house_pays_25():
    assert score_category("full_house", [3, 3, 3, 5, 5]) == 25


def test_full_house_zero_for_yahtzee():
    # Standard rules: 5-of-a-kind is NOT a full house
    assert score_category("full_house", [4, 4, 4, 4, 4]) == 0


def test_full_house_zero_for_two_pair():
    assert score_category("full_house", [3, 3, 5, 5, 6]) == 0


# ── Straights ───────────────────────────────────────────────────────────────
@pytest.mark.parametrize("dice", [
    [1, 2, 3, 4, 6],
    [2, 3, 4, 5, 1],
    [3, 4, 5, 6, 2],
    [4, 1, 2, 3, 5],
])
def test_small_straight_pays_30(dice):
    assert score_category("small_straight", dice) == 30


def test_small_straight_zero_when_no_4_run():
    assert score_category("small_straight", [1, 2, 3, 5, 6]) == 0


def test_large_straight_pays_40():
    assert score_category("large_straight", [1, 2, 3, 4, 5]) == 40
    assert score_category("large_straight", [2, 3, 4, 5, 6]) == 40


def test_large_straight_zero_for_small():
    assert score_category("large_straight", [1, 2, 3, 4, 6]) == 0


# ── Yahtzee + Chance ────────────────────────────────────────────────────────
def test_yahtzee_pays_50():
    assert score_category("yahtzee", [6, 6, 6, 6, 6]) == 50


def test_yahtzee_zero_for_quad():
    assert score_category("yahtzee", [6, 6, 6, 6, 5]) == 0


def test_chance_always_pays_sum():
    assert score_category("chance", [1, 2, 3, 4, 5]) == 15
    assert score_category("chance", [6, 6, 6, 6, 6]) == 30


def test_is_yahtzee_helper():
    assert is_yahtzee([3, 3, 3, 3, 3]) is True
    assert is_yahtzee([3, 3, 3, 3, 4]) is False


# ── Scorecard mechanics ─────────────────────────────────────────────────────
def test_scorecard_starts_empty():
    sc = Scorecard()
    for cat in ALL_CATEGORIES:
        assert sc.is_filled(cat) is False
    assert sc.is_complete() is False


def test_filling_category_records_score():
    sc = Scorecard()
    fill_category(sc, "aces", [1, 1, 1, 4, 5])
    assert sc.categories["aces"] == 3
    assert sc.is_filled("aces") is True


def test_cannot_fill_same_category_twice():
    sc = Scorecard()
    fill_category(sc, "aces", [1, 1, 1, 4, 5])
    with pytest.raises(ValueError):
        fill_category(sc, "aces", [1, 1, 1, 1, 1])


def test_complete_scorecard_detected():
    sc = Scorecard()
    for cat in ALL_CATEGORIES:
        fill_category(sc, cat, [1, 2, 3, 4, 5])
    assert sc.is_complete() is True


# ── Totals + Bonuses ────────────────────────────────────────────────────────
def test_upper_bonus_triggers_at_63():
    sc = Scorecard()
    # 3 aces + 3 twos + 3 threes + 3 fours + 3 fives + 3 sixes = 3+6+9+12+15+18 = 63
    fill_category(sc, "aces",   [1, 1, 1, 5, 6])
    fill_category(sc, "twos",   [2, 2, 2, 4, 5])
    fill_category(sc, "threes", [3, 3, 3, 5, 6])
    fill_category(sc, "fours",  [4, 4, 4, 5, 6])
    fill_category(sc, "fives",  [5, 5, 5, 1, 2])
    fill_category(sc, "sixes",  [6, 6, 6, 1, 2])
    t = compute_totals(sc)
    assert t.upper_subtotal == 63
    assert t.upper_bonus == 35


def test_upper_bonus_not_triggered_below_63():
    sc = Scorecard()
    fill_category(sc, "aces", [1, 1, 1, 5, 6])  # 3
    t = compute_totals(sc)
    assert t.upper_bonus == 0


def test_yahtzee_bonus_first_yahtzee_no_bonus():
    sc = Scorecard()
    fill_category(sc, "yahtzee", [5, 5, 5, 5, 5])
    t = compute_totals(sc)
    assert sc.yahtzee_bonus_count == 0
    assert t.yahtzee_bonus == 0


def test_yahtzee_bonus_second_yahtzee_pays_100():
    sc = Scorecard()
    # First Yahtzee fills the yahtzee category for 50
    fill_category(sc, "yahtzee", [5, 5, 5, 5, 5])
    # Second Yahtzee (5,5,5,5,5) applied to fives → upper score 25 + +100 bonus
    fill_category(sc, "fives", [5, 5, 5, 5, 5])
    assert sc.yahtzee_bonus_count == 1
    t = compute_totals(sc)
    assert t.yahtzee_bonus == 100


def test_yahtzee_bonus_only_when_yahtzee_already_50():
    sc = Scorecard()
    # If yahtzee category is unused, then a new yahtzee roll going to 'fives'
    # does NOT trigger bonus per standard rules
    fill_category(sc, "fives", [5, 5, 5, 5, 5])
    assert sc.yahtzee_bonus_count == 0
    t = compute_totals(sc)
    assert t.yahtzee_bonus == 0


def test_grand_total_sums_everything():
    sc = Scorecard()
    fill_category(sc, "yahtzee", [5, 5, 5, 5, 5])  # 50
    fill_category(sc, "chance",  [6, 6, 6, 6, 6])  # 30 + Yahtzee bonus +100
    t = compute_totals(sc)
    assert t.yahtzee_bonus == 100
    assert t.grand_total == 180


# ── best_categories_for helper ──────────────────────────────────────────────
def test_best_categories_returns_unfilled_only():
    sc = Scorecard()
    fill_category(sc, "aces", [1, 1, 1, 4, 5])
    suggestions = best_categories_for([6, 6, 6, 6, 6], sc)
    cats = [c for c, _ in suggestions]
    assert "aces" not in cats
    # First suggestion should be yahtzee (50 points)
    assert suggestions[0] == ("yahtzee", 50)

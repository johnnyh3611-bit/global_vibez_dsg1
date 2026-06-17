"""
Yahtzee — pure scoring logic (standard 5-dice rules).
─────────────────────────────────────────────────────
Tested by backend/tests/test_yahtzee.py.
Wired by backend/routes/yahtzee_routes.py.

Categories implemented per Hasbro standard:

  Upper section:
    aces..sixes       sum of dice of that face value
    upper_bonus       +35 if upper subtotal >= 63

  Lower section:
    three_of_a_kind   sum of all 5 dice (requires >= 3 same)
    four_of_a_kind    sum of all 5 dice (requires >= 4 same)
    full_house        25 (requires 3-of + 2-of, two distinct values)
    small_straight    30 (any 4 consecutive)
    large_straight    40 (all 5 consecutive)
    yahtzee           50 (5 of a kind)
    chance            sum of all 5 dice (always available)
    yahtzee_bonus     +100 per *additional* Yahtzee after first

Pure module. Deterministic. No DB. No I/O.
"""
from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple


# ── Constants ────────────────────────────────────────────────────────────────
NUM_DICE: int = 5
DICE_FACES: Tuple[int, ...] = (1, 2, 3, 4, 5, 6)
UPPER_BONUS_THRESHOLD: int = 63
UPPER_BONUS_VALUE: int = 35
YAHTZEE_BONUS_VALUE: int = 100

UPPER_CATEGORIES: Tuple[str, ...] = ("aces", "twos", "threes", "fours", "fives", "sixes")
LOWER_CATEGORIES: Tuple[str, ...] = (
    "three_of_a_kind", "four_of_a_kind", "full_house",
    "small_straight", "large_straight", "yahtzee", "chance",
)
ALL_CATEGORIES: Tuple[str, ...] = UPPER_CATEGORIES + LOWER_CATEGORIES

# Map upper category -> face value
_UPPER_FACE: Dict[str, int] = {
    "aces": 1, "twos": 2, "threes": 3, "fours": 4, "fives": 5, "sixes": 6,
}


# ── Validation ──────────────────────────────────────────────────────────────
def _validate_roll(dice: List[int]) -> None:
    if len(dice) != NUM_DICE:
        raise ValueError(f"dice must have exactly {NUM_DICE} values")
    for d in dice:
        if d not in DICE_FACES:
            raise ValueError(f"dice values must be in {DICE_FACES}, got {d}")


# ── Per-category scoring ────────────────────────────────────────────────────
def score_category(category: str, dice: List[int]) -> int:
    """Score a single roll against a single category. Pure."""
    _validate_roll(dice)
    if category not in ALL_CATEGORIES:
        raise ValueError(f"unknown category: {category}")

    counts = Counter(dice)
    total = sum(dice)

    if category in UPPER_CATEGORIES:
        face = _UPPER_FACE[category]
        return counts.get(face, 0) * face

    if category == "three_of_a_kind":
        return total if max(counts.values()) >= 3 else 0
    if category == "four_of_a_kind":
        return total if max(counts.values()) >= 4 else 0
    if category == "full_house":
        # 3 of one + 2 of another (must be two distinct values).
        # 5-of-a-kind is NOT a full house in standard rules.
        vals = sorted(counts.values(), reverse=True)
        return 25 if vals == [3, 2] else 0
    if category == "small_straight":
        unique = set(dice)
        for run in ({1, 2, 3, 4}, {2, 3, 4, 5}, {3, 4, 5, 6}):
            if run.issubset(unique):
                return 30
        return 0
    if category == "large_straight":
        unique = set(dice)
        if unique in ({1, 2, 3, 4, 5}, {2, 3, 4, 5, 6}):
            return 40
        return 0
    if category == "yahtzee":
        return 50 if max(counts.values()) == NUM_DICE else 0
    if category == "chance":
        return total

    raise AssertionError(f"unhandled category: {category}")  # pragma: no cover


def is_yahtzee(dice: List[int]) -> bool:
    _validate_roll(dice)
    return len(set(dice)) == 1


# ── Scorecard ───────────────────────────────────────────────────────────────
@dataclass
class Scorecard:
    """
    Tracks one player's full game state. All 13 categories start as None
    (unfilled). When a category is filled, its int score is recorded.
    yahtzee_bonus_count tracks additional Yahtzees beyond the first.
    """
    categories: Dict[str, Optional[int]] = field(default_factory=lambda: {c: None for c in ALL_CATEGORIES})
    yahtzee_bonus_count: int = 0

    def is_filled(self, category: str) -> bool:
        if category not in self.categories:
            raise ValueError(f"unknown category: {category}")
        return self.categories[category] is not None

    def is_complete(self) -> bool:
        return all(v is not None for v in self.categories.values())


def fill_category(scorecard: Scorecard, category: str, dice: List[int]) -> Scorecard:
    """
    Fill one category on the scorecard with this roll. Returns the SAME
    scorecard (mutated) for fluent chaining.

    Yahtzee bonus rule:
      - First Yahtzee scores 50 in 'yahtzee' category.
      - Each subsequent Yahtzee (when 'yahtzee' is already filled with 50)
        adds +100 to yahtzee_bonus_count regardless of which category the
        roll is applied to.
    """
    if category not in ALL_CATEGORIES:
        raise ValueError(f"unknown category: {category}")
    if scorecard.is_filled(category):
        raise ValueError(f"category '{category}' already filled")

    score = score_category(category, dice)
    scorecard.categories[category] = score

    # Yahtzee bonus: 5-of-a-kind AND yahtzee category was already filled with 50.
    if (
        is_yahtzee(dice)
        and category != "yahtzee"
        and scorecard.categories.get("yahtzee") == 50
    ):
        scorecard.yahtzee_bonus_count += 1

    return scorecard


# ── Totals ──────────────────────────────────────────────────────────────────
@dataclass
class TotalBreakdown:
    upper_subtotal: int
    upper_bonus: int
    upper_total: int
    lower_subtotal: int
    yahtzee_bonus: int
    grand_total: int


def compute_totals(scorecard: Scorecard) -> TotalBreakdown:
    upper_sub = sum((scorecard.categories[c] or 0) for c in UPPER_CATEGORIES)
    upper_bonus = UPPER_BONUS_VALUE if upper_sub >= UPPER_BONUS_THRESHOLD else 0
    upper_total = upper_sub + upper_bonus
    lower_sub = sum((scorecard.categories[c] or 0) for c in LOWER_CATEGORIES)
    y_bonus = scorecard.yahtzee_bonus_count * YAHTZEE_BONUS_VALUE
    grand = upper_total + lower_sub + y_bonus
    return TotalBreakdown(
        upper_subtotal=upper_sub,
        upper_bonus=upper_bonus,
        upper_total=upper_total,
        lower_subtotal=lower_sub,
        yahtzee_bonus=y_bonus,
        grand_total=grand,
    )


# ── Helper: suggest best categories for a roll ──────────────────────────────
def best_categories_for(dice: List[int], scorecard: Scorecard) -> List[Tuple[str, int]]:
    """
    Return all unfilled categories with their potential scores, sorted high-to-low.
    Used by the frontend to highlight optimal choices.
    """
    _validate_roll(dice)
    suggestions: List[Tuple[str, int]] = []
    for cat in ALL_CATEGORIES:
        if not scorecard.is_filled(cat):
            suggestions.append((cat, score_category(cat, dice)))
    suggestions.sort(key=lambda x: x[1], reverse=True)
    return suggestions


__all__ = [
    "NUM_DICE", "DICE_FACES",
    "UPPER_BONUS_THRESHOLD", "UPPER_BONUS_VALUE", "YAHTZEE_BONUS_VALUE",
    "UPPER_CATEGORIES", "LOWER_CATEGORIES", "ALL_CATEGORIES",
    "score_category", "is_yahtzee",
    "Scorecard", "fill_category",
    "TotalBreakdown", "compute_totals",
    "best_categories_for",
]

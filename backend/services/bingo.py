"""
Bingo — DSG 30-Second Social variant.
Source: DSG_ComingSoon_Master_Engines.pdf §3 (founder spec).

Standard 75-ball Bingo with 5x5 card layout:
  B: 1-15 · I: 16-30 · N: 31-45 · G: 46-60 · O: 61-75
  Center cell (index 12) is the FREE space (always daubed).

Win patterns:
  - Row, column, diagonal, four corners
  - **Sovereign Square** (4 corners + center) → 2x payout multiplier per spec

Pure module. Tested by backend/tests/test_bingo.py.
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple

from services.coming_soon_engines import (
    BINGO_CARD_SIZE,
    BINGO_SOVEREIGN_SQUARE_INDICES,
    BINGO_SOVEREIGN_SQUARE_MULTIPLIER,
    is_bingo_sovereign_square,
)
from services.pricing_master_vault import SOVEREIGN_TAX_RATE


# ── Constants ───────────────────────────────────────────────────────────────
COLUMN_RANGES: Tuple[Tuple[int, int], ...] = (
    (1, 15), (16, 30), (31, 45), (46, 60), (61, 75),
)
COLUMN_LETTERS: Tuple[str, ...] = ("B", "I", "N", "G", "O")
FREE_CELL_INDEX: int = 12   # center of 5x5 grid

# Standard payouts (pre-tax multipliers on stake)
PAYOUT_LINE: float = 5.0       # any single line (row/col/diag)
PAYOUT_FOUR_CORNERS: float = 10.0
PAYOUT_FULL_HOUSE: float = 50.0  # all 25 cells
# Sovereign Square pattern from spec applies a 2x multiplier on top


@dataclass
class BingoCard:
    """A 5x5 Bingo card. cells[row][col] = number, except center = 0 (FREE)."""
    cells: List[List[int]]      # 5 rows × 5 cols
    daubed: Set[int] = field(default_factory=set)  # set of cell indices 0..24

    def __post_init__(self):
        # Center is always pre-daubed (FREE space)
        self.daubed.add(FREE_CELL_INDEX)


def generate_card(seed: Optional[int] = None) -> BingoCard:
    """Generate a fresh 5x5 Bingo card with proper column-range-locked numbers."""
    rng = random.Random(seed) if seed is not None else random.Random()
    cells: List[List[int]] = []
    for col_idx in range(BINGO_CARD_SIZE):
        lo, hi = COLUMN_RANGES[col_idx]
        col_numbers = rng.sample(range(lo, hi + 1), BINGO_CARD_SIZE)
        for row_idx in range(BINGO_CARD_SIZE):
            if len(cells) <= row_idx:
                cells.append([])
            cells[row_idx].append(col_numbers[row_idx])
    # Center FREE cell
    cells[2][2] = 0
    return BingoCard(cells=cells)


def cell_index(row: int, col: int) -> int:
    return row * BINGO_CARD_SIZE + col


def daub_card(card: BingoCard, called_number: int) -> bool:
    """If the called number is on the card, mark it daubed. Returns True if matched."""
    if called_number == 0:
        return False
    for r in range(BINGO_CARD_SIZE):
        for c in range(BINGO_CARD_SIZE):
            if card.cells[r][c] == called_number:
                card.daubed.add(cell_index(r, c))
                return True
    return False


# ── Win-pattern detectors ───────────────────────────────────────────────────
def _row_wins(daubed: Set[int]) -> List[int]:
    wins = []
    for r in range(BINGO_CARD_SIZE):
        if all(cell_index(r, c) in daubed for c in range(BINGO_CARD_SIZE)):
            wins.append(r)
    return wins


def _col_wins(daubed: Set[int]) -> List[int]:
    wins = []
    for c in range(BINGO_CARD_SIZE):
        if all(cell_index(r, c) in daubed for r in range(BINGO_CARD_SIZE)):
            wins.append(c)
    return wins


def _diag_wins(daubed: Set[int]) -> List[str]:
    wins = []
    if all(cell_index(i, i) in daubed for i in range(BINGO_CARD_SIZE)):
        wins.append("main")
    if all(cell_index(i, BINGO_CARD_SIZE - 1 - i) in daubed for i in range(BINGO_CARD_SIZE)):
        wins.append("anti")
    return wins


def _four_corners(daubed: Set[int]) -> bool:
    corners = {0, 4, 20, 24}
    return corners.issubset(daubed)


def _full_house(daubed: Set[int]) -> bool:
    # All 25 cells (FREE counts because it's pre-daubed)
    return len(daubed) == BINGO_CARD_SIZE * BINGO_CARD_SIZE


@dataclass
class BingoWinResult:
    """Outcome of evaluating a Bingo card after a number is called."""
    has_win: bool
    patterns: List[str]                    # human-readable list of patterns hit
    is_sovereign_square: bool              # spec multiplier flag
    base_payout_multiplier: float          # PAYOUT_LINE / FOUR_CORNERS / FULL_HOUSE
    final_multiplier: float                # base × 2 if Sovereign Square
    gross_payout: float
    sovereign_tax: float
    net_payout: float


def evaluate_card(card: BingoCard, stake: float) -> BingoWinResult:
    """Score a card. Returns the highest-paying pattern + Sovereign Square check."""
    if stake < 0:
        raise ValueError("stake must be non-negative")

    daubed = card.daubed
    patterns: List[str] = []

    # Detect every win pattern present
    if _full_house(daubed):
        patterns.append("full_house")
    rows = _row_wins(daubed)
    cols = _col_wins(daubed)
    diags = _diag_wins(daubed)
    corners = _four_corners(daubed)
    sovereign_sq = is_bingo_sovereign_square(daubed)

    for r in rows:
        patterns.append(f"row_{r}")
    for c in cols:
        patterns.append(f"col_{c}")
    for d in diags:
        patterns.append(f"diag_{d}")
    if corners:
        patterns.append("four_corners")
    if sovereign_sq:
        patterns.append("sovereign_square")

    has_win = bool(patterns)

    # Pick highest base multiplier among non-pattern-modifier patterns
    if "full_house" in patterns:
        base = PAYOUT_FULL_HOUSE
    elif "four_corners" in patterns:
        base = PAYOUT_FOUR_CORNERS
    elif rows or cols or diags:
        base = PAYOUT_LINE
    else:
        base = 0.0

    final_mult = base * (BINGO_SOVEREIGN_SQUARE_MULTIPLIER if sovereign_sq and base > 0 else 1.0)
    gross = round(stake * final_mult, 8)
    tax = round(gross * SOVEREIGN_TAX_RATE, 8)
    net = round(gross - tax, 8)

    return BingoWinResult(
        has_win=has_win,
        patterns=patterns,
        is_sovereign_square=sovereign_sq,
        base_payout_multiplier=base,
        final_multiplier=final_mult,
        gross_payout=gross,
        sovereign_tax=tax,
        net_payout=net,
    )


def number_letter(n: int) -> str:
    """Return the column letter for a Bingo number (B 1-15, I 16-30, etc.)."""
    if n < 1 or n > 75:
        raise ValueError("number must be 1..75")
    return COLUMN_LETTERS[(n - 1) // 15]


def call_number(rng: random.Random, already_called: Set[int]) -> int:
    """Draw a fresh number 1-75 not yet called. Raises if all 75 are exhausted."""
    available = [n for n in range(1, 76) if n not in already_called]
    if not available:
        raise ValueError("all 75 numbers already called")
    return rng.choice(available)


__all__ = [
    "COLUMN_RANGES", "COLUMN_LETTERS", "FREE_CELL_INDEX",
    "PAYOUT_LINE", "PAYOUT_FOUR_CORNERS", "PAYOUT_FULL_HOUSE",
    "BingoCard", "BingoWinResult",
    "generate_card", "daub_card", "evaluate_card",
    "number_letter", "call_number", "cell_index",
]

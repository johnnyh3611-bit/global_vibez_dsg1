"""
Caribbean Stud Poker — DSG variant.
Source: DSG_ComingSoon_Master_Engines.pdf §1.

Standard rules:
  - Player antes, optionally raises (Play bet) after seeing their 5 cards
  - Dealer must have Ace-King high or better to qualify
  - If dealer doesn't qualify: ante pays 1:1, Play returns
  - If dealer qualifies and player wins: ante pays 1:1, Play pays per payout table
  - If dealer qualifies and player loses: both bets lost

Pure module. Tested by backend/tests/test_caribbean_stud.py.
"""
from __future__ import annotations

import random
from collections import Counter
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from services.coming_soon_engines import (
    CARIBBEAN_STUD_PAYOUT_TABLE,
    caribbean_stud_dealer_qualifies,
)
from services.pricing_master_vault import SOVEREIGN_TAX_RATE


SUITS: Tuple[str, ...] = ("S", "H", "D", "C")
RANKS: Tuple[str, ...] = ("2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A")
RANK_VALUE: Dict[str, int] = {r: i + 2 for i, r in enumerate(RANKS)}


@dataclass(frozen=True)
class Card:
    rank: str
    suit: str

    def __post_init__(self):
        if self.rank not in RANKS:
            raise ValueError(f"invalid rank {self.rank}")
        if self.suit not in SUITS:
            raise ValueError(f"invalid suit {self.suit}")


def standard_deck() -> List[Card]:
    return [Card(r, s) for s in SUITS for r in RANKS]


def deal_round(seed: Optional[int] = None) -> Tuple[List[Card], List[Card]]:
    """Shuffle a 52-card deck, return (player_hand, dealer_hand)."""
    rng = random.Random(seed) if seed is not None else random.Random()
    deck = standard_deck()
    rng.shuffle(deck)
    return (deck[:5], deck[5:10])


# ── Hand evaluation ─────────────────────────────────────────────────────────
HAND_RANK_ORDER: Tuple[str, ...] = (
    "high_card", "pair", "two_pair", "three_of_a_kind", "straight", "flush",
    "full_house", "four_of_a_kind", "straight_flush", "royal_flush",
)


def _is_straight(values: List[int]) -> bool:
    s = sorted(set(values))
    if len(s) != 5:
        return False
    if s[-1] - s[0] == 4:
        return True
    # Ace-low straight: A,2,3,4,5
    return s == [2, 3, 4, 5, 14]


def evaluate_hand(hand: List[Card]) -> Tuple[str, List[int]]:
    """
    Return (category, tiebreaker_values) — values sorted high→low for comparison.
    """
    if len(hand) != 5:
        raise ValueError("hand must have 5 cards")

    values = [RANK_VALUE[c.rank] for c in hand]
    suits = [c.suit for c in hand]
    counts = Counter(values)
    sorted_counts = sorted(counts.items(), key=lambda kv: (-kv[1], -kv[0]))
    distinct_count_pattern = tuple(sorted(counts.values(), reverse=True))

    is_flush = len(set(suits)) == 1
    is_straight = _is_straight(values)
    is_royal = is_flush and is_straight and set(values) == {10, 11, 12, 13, 14}

    if is_royal:
        return ("royal_flush", sorted(values, reverse=True))
    if is_flush and is_straight:
        return ("straight_flush", sorted(values, reverse=True))
    if distinct_count_pattern == (4, 1):
        quad = sorted_counts[0][0]
        kicker = sorted_counts[1][0]
        return ("four_of_a_kind", [quad, kicker])
    if distinct_count_pattern == (3, 2):
        trips = sorted_counts[0][0]
        pair = sorted_counts[1][0]
        return ("full_house", [trips, pair])
    if is_flush:
        return ("flush", sorted(values, reverse=True))
    if is_straight:
        return ("straight", sorted(values, reverse=True))
    if distinct_count_pattern == (3, 1, 1):
        trips = sorted_counts[0][0]
        kickers = sorted([c[0] for c in sorted_counts[1:]], reverse=True)
        return ("three_of_a_kind", [trips] + kickers)
    if distinct_count_pattern == (2, 2, 1):
        pairs = sorted([c[0] for c in sorted_counts if c[1] == 2], reverse=True)
        kicker = [c[0] for c in sorted_counts if c[1] == 1][0]
        return ("two_pair", pairs + [kicker])
    if distinct_count_pattern == (2, 1, 1, 1):
        pair = sorted_counts[0][0]
        kickers = sorted([c[0] for c in sorted_counts[1:]], reverse=True)
        return ("pair", [pair] + kickers)
    return ("high_card", sorted(values, reverse=True))


def compare_hands(player: List[Card], dealer: List[Card]) -> int:
    """+1 if player wins, -1 if dealer wins, 0 if push (exact tie)."""
    p_cat, p_tb = evaluate_hand(player)
    d_cat, d_tb = evaluate_hand(dealer)
    p_idx = HAND_RANK_ORDER.index(p_cat)
    d_idx = HAND_RANK_ORDER.index(d_cat)
    if p_idx > d_idx:
        return 1
    if p_idx < d_idx:
        return -1
    if p_tb > d_tb:
        return 1
    if p_tb < d_tb:
        return -1
    return 0


def _dealer_qualifies(hand: List[Card]) -> bool:
    """Dealer qualifies if hand is at least Ace-King high (or any pair+)."""
    cat, tb = evaluate_hand(hand)
    if cat != "high_card":
        return True
    # high_card: must contain both A and K
    return tb[0] == 14 and tb[1] == 13


# ── Round resolution ────────────────────────────────────────────────────────
@dataclass
class CaribbeanStudOutcome:
    player_hand: List[Card]
    dealer_hand: List[Card]
    player_category: str
    dealer_category: str
    dealer_qualifies: bool
    folded: bool
    ante: float
    play_bet: float
    ante_payout: float       # gross from ante
    play_payout: float       # gross from play bet
    gross_total: float
    sovereign_tax: float
    net_total: float         # post-tax gross


def resolve_round(
    player_hand: List[Card],
    dealer_hand: List[Card],
    ante: float,
    raise_play: bool,
) -> CaribbeanStudOutcome:
    """
    Resolve a Caribbean Stud round.

    `raise_play=False` → player folds. Loses ante.
    `raise_play=True`  → player adds Play bet (= 2× ante per house rule).
    """
    if ante <= 0:
        raise ValueError("ante must be positive")

    p_cat, _ = evaluate_hand(player_hand)
    d_cat, _ = evaluate_hand(dealer_hand)
    play_bet = round(ante * 2, 8) if raise_play else 0.0

    if not raise_play:
        # Folded → ante lost
        gross = -ante
        tax = 0.0
        return CaribbeanStudOutcome(
            player_hand=player_hand, dealer_hand=dealer_hand,
            player_category=p_cat, dealer_category=d_cat,
            dealer_qualifies=_dealer_qualifies(dealer_hand),
            folded=True,
            ante=ante, play_bet=0.0,
            ante_payout=-ante, play_payout=0.0,
            gross_total=gross, sovereign_tax=tax, net_total=gross,
        )

    qualifies = _dealer_qualifies(dealer_hand)

    if not qualifies:
        # Ante pays 1:1, Play returns (no profit on Play)
        ante_payout = ante      # 1:1 win
        play_payout = 0.0       # returned, neither win nor loss
        gross = ante_payout
        tax = round(gross * SOVEREIGN_TAX_RATE, 8) if gross > 0 else 0.0
        return CaribbeanStudOutcome(
            player_hand=player_hand, dealer_hand=dealer_hand,
            player_category=p_cat, dealer_category=d_cat,
            dealer_qualifies=False, folded=False,
            ante=ante, play_bet=play_bet,
            ante_payout=ante_payout, play_payout=play_payout,
            gross_total=gross, sovereign_tax=tax, net_total=round(gross - tax, 8),
        )

    # Dealer qualifies; compare hands
    cmp = compare_hands(player_hand, dealer_hand)
    if cmp > 0:
        # Player wins
        ante_payout = ante                          # 1:1
        multiplier = CARIBBEAN_STUD_PAYOUT_TABLE.get(p_cat, 0)
        play_payout = round(play_bet * multiplier, 8)
        gross = ante_payout + play_payout
        tax = round(gross * SOVEREIGN_TAX_RATE, 8)
        return CaribbeanStudOutcome(
            player_hand=player_hand, dealer_hand=dealer_hand,
            player_category=p_cat, dealer_category=d_cat,
            dealer_qualifies=True, folded=False,
            ante=ante, play_bet=play_bet,
            ante_payout=ante_payout, play_payout=play_payout,
            gross_total=gross, sovereign_tax=tax, net_total=round(gross - tax, 8),
        )
    elif cmp < 0:
        # Dealer wins
        gross = -(ante + play_bet)
        return CaribbeanStudOutcome(
            player_hand=player_hand, dealer_hand=dealer_hand,
            player_category=p_cat, dealer_category=d_cat,
            dealer_qualifies=True, folded=False,
            ante=ante, play_bet=play_bet,
            ante_payout=-ante, play_payout=-play_bet,
            gross_total=gross, sovereign_tax=0.0, net_total=gross,
        )
    else:
        # Push — both bets returned
        return CaribbeanStudOutcome(
            player_hand=player_hand, dealer_hand=dealer_hand,
            player_category=p_cat, dealer_category=d_cat,
            dealer_qualifies=True, folded=False,
            ante=ante, play_bet=play_bet,
            ante_payout=0.0, play_payout=0.0,
            gross_total=0.0, sovereign_tax=0.0, net_total=0.0,
        )


__all__ = [
    "Card", "RANK_VALUE", "RANKS", "SUITS",
    "standard_deck", "deal_round",
    "evaluate_hand", "compare_hands",
    "CaribbeanStudOutcome", "resolve_round",
    "HAND_RANK_ORDER",
]

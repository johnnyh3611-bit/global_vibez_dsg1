"""
Card-meld detection helpers shared by Gin Rummy and Rummy.

Definitions:
  • SET — 3+ cards of the same rank (different suits).
  • RUN — 3+ cards of the same suit in consecutive ranks (A-low only here;
    the calling code can wrap aces if its ruleset supports it).

Both Gin and Rummy compute the BEST partition of a hand into melds that
minimises the unmelded "deadwood" total. We use a small DP over a sorted
hand. For real-world hand sizes (≤14) the brute-force exploration of
mutually-exclusive meld combinations is tractable.
"""
from __future__ import annotations
from typing import List, Dict, Any, Tuple, Optional, FrozenSet
from itertools import combinations

RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]
RANK_INDEX = {r: i for i, r in enumerate(RANKS)}
DEADWOOD_VALUE = {
    "A": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
    "10": 10, "J": 10, "Q": 10, "K": 10,
}
SUITS = ["clubs", "diamonds", "spades", "hearts"]


def card_value(card: Dict[str, Any]) -> int:
    if card.get("is_joker"):
        return 0
    return DEADWOOD_VALUE[card["rank"]]


def make_card(suit: str, rank: str) -> Dict[str, Any]:
    return {"suit": suit, "rank": rank, "value": RANK_INDEX[rank] + 1, "is_joker": False}


def make_joker(idx: int) -> Dict[str, Any]:
    return {"suit": "joker", "rank": "JOKER", "value": 0, "is_joker": True, "joker_id": idx}


def make_deck_with_jokers(num_jokers: int = 2) -> List[Dict[str, Any]]:
    deck = [make_card(s, r) for s in SUITS for r in RANKS]
    for i in range(num_jokers):
        deck.append(make_joker(i))
    return deck


def hand_total(cards: List[Dict[str, Any]]) -> int:
    return sum(card_value(c) for c in cards)


# ── meld discovery ─────────────────────────────────────────────────────


def _all_sets(cards: List[Dict[str, Any]]) -> List[Tuple[int, ...]]:
    """Return every set (3+ same rank) as tuples of indices into `cards`."""
    by_rank: Dict[str, List[int]] = {}
    for i, c in enumerate(cards):
        if c.get("is_joker"):
            continue
        by_rank.setdefault(c["rank"], []).append(i)
    melds: List[Tuple[int, ...]] = []
    for indices in by_rank.values():
        for size in range(3, len(indices) + 1):
            for combo in combinations(indices, size):
                # Only one of each suit allowed in a set
                suits_seen = {cards[i]["suit"] for i in combo}
                if len(suits_seen) == size:
                    melds.append(tuple(combo))
    return melds


def _all_runs(cards: List[Dict[str, Any]]) -> List[Tuple[int, ...]]:
    """Return every run (3+ consecutive same suit) as tuples of indices."""
    by_suit: Dict[str, List[Tuple[int, int]]] = {}  # suit -> [(rank_index, card_index)]
    for i, c in enumerate(cards):
        if c.get("is_joker"):
            continue
        by_suit.setdefault(c["suit"], []).append((RANK_INDEX[c["rank"]], i))
    melds: List[Tuple[int, ...]] = []
    for items in by_suit.values():
        items.sort()
        # Look at every contiguous block in rank order, dedup duplicates
        seen_at_rank: Dict[int, int] = {}
        ordered: List[Tuple[int, int]] = []
        for r, idx in items:
            if r not in seen_at_rank:
                seen_at_rank[r] = idx
                ordered.append((r, idx))
        # Walk ordered list, find consecutive sub-sequences of length >=3
        n = len(ordered)
        for start in range(n):
            for end in range(start + 2, n):
                # Check ranks are contiguous from start..end
                ok = all(ordered[k + 1][0] - ordered[k][0] == 1 for k in range(start, end))
                if ok:
                    melds.append(tuple(ordered[k][1] for k in range(start, end + 1)))
    return melds


def best_meld_partition(cards: List[Dict[str, Any]]) -> Tuple[int, List[List[int]]]:
    """Return (deadwood_total, list_of_melds). Each meld is a list of indices.
    Uses a recursive search over compatible meld combinations.
    """
    sets = _all_sets(cards)
    runs = _all_runs(cards)
    candidates: List[Tuple[int, ...]] = sets + runs

    best_dead = hand_total(cards)
    best_melds: List[List[int]] = []

    used: List[bool] = [False] * len(cards)

    def recurse(start: int, melds_so_far: List[Tuple[int, ...]], dead: int) -> None:
        nonlocal best_dead, best_melds
        # Compute current deadwood given current melds
        if dead < best_dead:
            best_dead = dead
            best_melds = [list(m) for m in melds_so_far]
        for ci in range(start, len(candidates)):
            meld = candidates[ci]
            if any(used[idx] for idx in meld):
                continue
            for idx in meld:
                used[idx] = True
            removed_value = sum(card_value(cards[idx]) for idx in meld)
            recurse(ci + 1, melds_so_far + [meld], dead - removed_value)
            for idx in meld:
                used[idx] = False

    recurse(0, [], hand_total(cards))
    return best_dead, best_melds


def best_deadwood(cards: List[Dict[str, Any]]) -> int:
    return best_meld_partition(cards)[0]


def is_gin(cards: List[Dict[str, Any]]) -> bool:
    return best_deadwood(cards) == 0


def can_knock(cards: List[Dict[str, Any]], threshold: int = 10) -> bool:
    return best_deadwood(cards) <= threshold

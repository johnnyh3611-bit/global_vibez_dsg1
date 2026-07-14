"""
BlackjackEngine — shared shoe + hand math for HTTP and multiplayer paths.

Split helpers live here so routes/blackjack.py and blackjack_multiplayer.py
share one implementation (no more "coming soon" / client-only split).
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
import secrets

secure_random = secrets.SystemRandom()


class Card:
    def __init__(self, rank: str, suit: str):
        self.rank = rank
        self.suit = suit

    def get_value(self) -> int:
        if self.rank in ["J", "Q", "K"]:
            return 10
        if self.rank == "A":
            return 11
        return int(self.rank)

    def to_string(self) -> str:
        return f"{self.rank}{self.suit[0].upper()}"

    def to_dict(self) -> Dict[str, str]:
        return {"rank": self.rank, "suit": self.suit, "id": f"{self.rank}_{self.suit}"}


class BlackjackEngine:
    def __init__(self):
        self.deck: List[Card] = []
        self.initialize_deck()

    def initialize_deck(self) -> None:
        """8-deck shoe — professional casino standard."""
        self.deck = []
        suits = ["hearts", "diamonds", "clubs", "spades"]
        ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]
        for _ in range(8):
            for suit in suits:
                for rank in ranks:
                    self.deck.append(Card(rank, suit))
        self.shuffle_deck()

    def shuffle_deck(self) -> None:
        for i in range(len(self.deck) - 1, 0, -1):
            j = secure_random.randint(0, i)
            self.deck[i], self.deck[j] = self.deck[j], self.deck[i]

    def deal_card(self) -> Card:
        if len(self.deck) < 52:
            self.initialize_deck()
        return self.deck.pop()

    def calculate_hand(self, cards: List[Card]) -> int:
        total = 0
        ace_count = 0
        for card in cards:
            total += card.get_value()
            if card.rank == "A":
                ace_count += 1
        while total > 21 and ace_count > 0:
            total -= 10
            ace_count -= 1
        return total

    def is_blackjack(self, cards: List[Card]) -> bool:
        return len(cards) == 2 and self.calculate_hand(cards) == 21

    def can_split(self, cards: List[Card]) -> bool:
        if len(cards) != 2:
            return False
        # Pair by rank; 10/J/Q/K all count as 10-value pairs for split
        a, b = cards[0], cards[1]
        if a.rank == b.rank:
            return True
        return a.get_value() == 10 and b.get_value() == 10

    def perform_split(
        self,
        hand: List[Card],
        bet_amount: float,
    ) -> Tuple[List[Card], List[Card], float, float]:
        """
        Split a two-card hand into two hands, deal one card to each.
        Returns (hand_a, hand_b, bet_a, bet_b).
        """
        if not self.can_split(hand):
            raise ValueError("Hand cannot be split")
        hand_a = [hand[0], self.deal_card()]
        hand_b = [hand[1], self.deal_card()]
        return hand_a, hand_b, bet_amount, bet_amount


def cards_from_dicts(cards: List[Dict[str, Any]]) -> List[Card]:
    out: List[Card] = []
    for c in cards:
        out.append(Card(c["rank"], c["suit"]))
    return out


def dicts_from_cards(cards: List[Card]) -> List[Dict[str, str]]:
    return [c.to_dict() for c in cards]


def split_dict_hand(
    hand: List[Dict[str, Any]],
    deck: List[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Multiplayer-table helper: split a dict-card hand using the table deck.
    Returns (hand_a, hand_b, remaining_deck).
    """
    if len(hand) != 2:
        raise ValueError("Can only split a two-card hand")
    r0, r1 = hand[0]["rank"], hand[1]["rank"]
    v0 = 10 if r0 in ("10", "J", "Q", "K") else (11 if r0 == "A" else int(r0))
    v1 = 10 if r1 in ("10", "J", "Q", "K") else (11 if r1 == "A" else int(r1))
    if r0 != r1 and not (v0 == 10 and v1 == 10):
        raise ValueError("Cards are not a pair")
    if len(deck) < 2:
        raise ValueError("Deck exhausted")
    deck = list(deck)
    hand_a = [hand[0], deck.pop()]
    hand_b = [hand[1], deck.pop()]
    return hand_a, hand_b, deck

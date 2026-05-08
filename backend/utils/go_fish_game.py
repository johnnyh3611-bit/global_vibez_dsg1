"""
Go Fish — pure-Python rule engine for the 2-4 player classic.

Standard 4-player ruleset:
  • 52-card deck. Deal 5 cards each, rest is the pool.
  • On your turn, ASK another player: "Do you have any <rank>?"
  • You must already have at least one card of that rank in your hand.
  • If they have any, they hand over ALL cards of that rank → you ask again.
  • If not, "Go fish!" → draw 1 from the pool.
       - If the drawn card matches what you asked, ask again (publicly).
       - Otherwise, turn passes left.
  • Collecting all 4 of a rank closes a "book" → set aside.
  • Game ends when all 13 books are claimed. Most books wins.
"""
from __future__ import annotations
from typing import List, Dict, Any, Optional
import secrets

POSITIONS = ["north", "east", "south", "west"]
SUITS = ["clubs", "diamonds", "spades", "hearts"]
RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]
RANK_VALUES = {r: i + 2 for i, r in enumerate(RANKS)}
INITIAL_HAND_SIZE = 5


def _next(pos: str) -> str:
    return POSITIONS[(POSITIONS.index(pos) + 1) % 4]


def make_card(suit: str, rank: str) -> Dict[str, Any]:
    return {"suit": suit, "rank": rank, "value": RANK_VALUES[rank]}


def make_deck() -> List[Dict[str, Any]]:
    return [make_card(s, r) for s in SUITS for r in RANKS]


def _check_books(hand: List[Dict[str, Any]]) -> List[str]:
    """Remove and return any rank that has 4 cards in hand."""
    by_rank: Dict[str, List[Dict[str, Any]]] = {}
    for c in hand:
        by_rank.setdefault(c["rank"], []).append(c)
    booked: List[str] = []
    for rank, cards in by_rank.items():
        if len(cards) == 4:
            booked.append(rank)
    if booked:
        kept = [c for c in hand if c["rank"] not in booked]
        hand.clear()
        hand.extend(kept)
    return booked


class GoFishGame:
    def __init__(self, user_position: str = "south"):
        self.rng = secrets.SystemRandom()
        self.user_position = user_position
        self.hands_played = 0
        self.match_winner: Optional[str] = None
        self.start_new_hand()

    # ----- per-hand setup -----------------------------------------------

    def start_new_hand(self) -> None:
        deck = make_deck()
        self.rng.shuffle(deck)
        self.hands: Dict[str, List[Dict[str, Any]]] = {
            pos: sorted(
                [deck.pop() for _ in range(INITIAL_HAND_SIZE)],
                key=lambda c: (RANKS.index(c["rank"]), SUITS.index(c["suit"])),
            )
            for pos in POSITIONS
        }
        self.pool: List[Dict[str, Any]] = deck
        self.books: Dict[str, List[str]] = {p: [] for p in POSITIONS}
        # Books from initial deal
        for pos in POSITIONS:
            taken = _check_books(self.hands[pos])
            if taken:
                self.books[pos].extend(taken)
        self.turn: str = "south"
        self.phase: str = "playing"
        self.last_action: Optional[Dict[str, Any]] = None
        # Track the bot AI's "memory" of what each opponent has asked for
        self.public_asks: List[Dict[str, Any]] = []

    # ----- mechanics ----------------------------------------------------

    def has_rank(self, pos: str, rank: str) -> bool:
        return any(c["rank"] == rank for c in self.hands[pos])

    def transfer_rank(self, sender: str, receiver: str, rank: str) -> List[Dict[str, Any]]:
        moved = [c for c in self.hands[sender] if c["rank"] == rank]
        self.hands[sender] = [c for c in self.hands[sender] if c["rank"] != rank]
        self.hands[receiver].extend(moved)
        self.hands[receiver].sort(key=lambda c: (RANKS.index(c["rank"]), SUITS.index(c["suit"])))
        return moved

    def draw_from_pool(self, pos: str) -> Optional[Dict[str, Any]]:
        if not self.pool:
            return None
        card = self.pool.pop()
        self.hands[pos].append(card)
        self.hands[pos].sort(key=lambda c: (RANKS.index(c["rank"]), SUITS.index(c["suit"])))
        return card

    def ask(self, asker: str, target: str, rank: str) -> Dict[str, Any]:
        if self.phase != "playing":
            raise ValueError("Not playing phase")
        if asker != self.turn:
            raise ValueError("Not your turn")
        if asker == target:
            raise ValueError("Cannot ask yourself")
        if target not in POSITIONS:
            raise ValueError("Invalid target")
        if not self.has_rank(asker, rank):
            raise ValueError("You must hold at least one of that rank to ask")
        self.public_asks.append({"asker": asker, "target": target, "rank": rank})

        result: Dict[str, Any] = {"asker": asker, "target": target, "rank": rank}
        if self.has_rank(target, rank):
            moved = self.transfer_rank(target, asker, rank)
            result["received_count"] = len(moved)
            result["received_cards"] = moved
            booked = _check_books(self.hands[asker])
            if booked:
                self.books[asker].extend(booked)
                result["booked"] = booked
            result["go_fish"] = False
            # Asker keeps the turn
        else:
            drew = self.draw_from_pool(asker)
            result["go_fish"] = True
            result["drew"] = drew
            if drew and drew["rank"] == rank:
                booked = _check_books(self.hands[asker])
                if booked:
                    self.books[asker].extend(booked)
                    result["booked"] = booked
                result["lucky"] = True  # Asker keeps the turn
            else:
                result["lucky"] = False
                self.turn = _next(self.turn)

        self.last_action = result
        self._check_round_end()
        return result

    def _check_round_end(self) -> None:
        total_books = sum(len(b) for b in self.books.values())
        all_hands_empty = all(not self.hands[p] for p in POSITIONS) and not self.pool
        if total_books == 13 or all_hands_empty:
            self.phase = "finished"
            self.match_winner = max(POSITIONS, key=lambda p: len(self.books[p]))

    # ----- bot ai --------------------------------------------------------

    def bot_choose(self, pos: str) -> tuple[str, str]:
        """Return (target, rank) for a bot. Avoids targets that obviously
        don't have what we want by tracking public asks."""
        ranks_in_hand = [c["rank"] for c in self.hands[pos]]
        # Prefer ranks we have multiple copies of (closer to a book)
        rank_counts: Dict[str, int] = {}
        for r in ranks_in_hand:
            rank_counts[r] = rank_counts.get(r, 0) + 1
        # Pick rank with most copies (that's still askable)
        ranks_sorted = sorted(rank_counts.items(), key=lambda kv: -kv[1])
        chosen_rank = ranks_sorted[0][0] if ranks_sorted else self.rng.choice(ranks_in_hand)
        # Target preference: anyone who recently went-fish on this rank → likely doesn't have it; skip them
        targets = [p for p in POSITIONS if p != pos and self.hands[p]]
        if not targets:
            targets = [p for p in POSITIONS if p != pos]
        target = self.rng.choice(targets)
        return (target, chosen_rank)

    def run_bots(self, max_steps: int = 24) -> List[Dict[str, Any]]:
        steps: List[Dict[str, Any]] = []
        for _ in range(max_steps):
            if self.phase != "playing":
                break
            if self.turn == self.user_position:
                break
            if not self.hands[self.turn]:
                # Bot has empty hand: draw if possible, else pass
                drew = self.draw_from_pool(self.turn)
                if drew:
                    booked = _check_books(self.hands[self.turn])
                    if booked:
                        self.books[self.turn].extend(booked)
                    steps.append({"asker": self.turn, "drew_only": True, "drew": drew, "booked": booked or []})
                else:
                    self.turn = _next(self.turn)
                    steps.append({"asker": self.turn, "passed": True})
                self._check_round_end()
                continue
            actor = self.turn
            target, rank = self.bot_choose(actor)
            try:
                res = self.ask(actor, target, rank)
                steps.append(res)
            except ValueError:
                # If bot somehow chose illegally (shouldn't happen) — pass
                self.turn = _next(self.turn)
                steps.append({"asker": actor, "passed": True})
        return steps

    # ----- view ----------------------------------------------------------

    def to_view(self) -> Dict[str, Any]:
        players_data = {
            pos: {
                "card_count": len(self.hands[pos]),
                "books": list(self.books[pos]),
                "books_count": len(self.books[pos]),
            }
            for pos in POSITIONS
        }
        ranks_in_hand = sorted(
            list({c["rank"] for c in self.hands[self.user_position]}),
            key=lambda r: RANKS.index(r),
        )
        return {
            "user_position": self.user_position,
            "phase": self.phase,
            "turn": self.turn,
            "pool_count": len(self.pool),
            "your_hand": self.hands[self.user_position],
            "askable_ranks": ranks_in_hand,
            "askable_targets": [p for p in POSITIONS if p != self.user_position and self.hands[p]],
            "players_data": players_data,
            "last_action": self.last_action,
            "match_winner": self.match_winner,
            "public_asks": self.public_asks[-12:],
        }

"""
Rummy (13-card / Indian Rummy) — pure-Python rule engine.

Standard ruleset (4-player target, scaling 2-6):
  • Two 52-card decks + 4 jokers (108 cards total).
  • Deal 13 cards each. One card flipped to seed discard. One random
    card is the WILDCARD JOKER — every card of that rank is a wild
    plus the printed jokers.
  • Each turn: pick STOCK or DISCARD, then DISCARD one (must end with 13).
  • DECLARE: arrange 13 cards into ≥2 sequences (one of which is a PURE
    sequence — no joker) and the rest into sets/sequences. Successful
    declaration ends the round. Opponents score deadwood (capped 80).
  • First to a configurable cumulative score (default 200) loses
    [Rummy is "high score loses"]; everyone else continues. The lowest
    final score wins. We simplify: the FIRST valid declaration wins
    the match outright in our prototype.
"""
from __future__ import annotations
from typing import List, Dict, Any, Optional, Tuple
import secrets

from utils.meld_detection import (
    SUITS, RANKS, RANK_INDEX, make_card, make_joker,
    best_meld_partition, hand_total,
)

POSITIONS_4 = ["north", "east", "south", "west"]
HAND_SIZE = 13
DEADWOOD_CAP = 80


def _next_4(pos: str) -> str:
    return POSITIONS_4[(POSITIONS_4.index(pos) + 1) % 4]


# ── helpers for full Rummy declaration validation ──────────────────────


def _is_pure_sequence(cards: List[Dict[str, Any]]) -> bool:
    """3+ consecutive same-suit cards with NO jokers (printed or wild)."""
    if len(cards) < 3:
        return False
    if any(c.get("is_joker") or c.get("is_wild") for c in cards):
        return False
    suit = cards[0]["suit"]
    if any(c["suit"] != suit for c in cards):
        return False
    ranks = sorted(RANK_INDEX[c["rank"]] for c in cards)
    for i in range(1, len(ranks)):
        if ranks[i] != ranks[i - 1] + 1:
            return False
    return True


def _is_sequence(cards: List[Dict[str, Any]]) -> bool:
    """3+ consecutive same-suit cards (jokers/wilds may substitute)."""
    if len(cards) < 3:
        return False
    fixed = [c for c in cards if not (c.get("is_joker") or c.get("is_wild"))]
    if not fixed:
        return False  # all jokers — invalid
    suit = fixed[0]["suit"]
    if any(c["suit"] != suit for c in fixed):
        return False
    fixed_ranks = sorted(RANK_INDEX[c["rank"]] for c in fixed)
    n = len(cards)
    # Try each contiguous window of width n in 0..12 and see if jokers cover
    # the missing slots.
    jokers_needed = n - len(fixed)
    for start in range(0, 13 - n + 1):
        window = list(range(start, start + n))
        missing = [r for r in window if r not in fixed_ranks]
        if len(missing) <= jokers_needed and all(r in window for r in fixed_ranks):
            return True
    return False


def _is_set(cards: List[Dict[str, Any]]) -> bool:
    """3+ same-rank, distinct suits (jokers may substitute)."""
    if len(cards) < 3 or len(cards) > 4:
        return False
    fixed = [c for c in cards if not (c.get("is_joker") or c.get("is_wild"))]
    if not fixed:
        return False
    rank = fixed[0]["rank"]
    if any(c["rank"] != rank for c in fixed):
        return False
    suits = {c["suit"] for c in fixed}
    if len(suits) != len(fixed):  # duplicate suits among fixed cards
        return False
    return True


def validate_declaration(groups: List[List[Dict[str, Any]]]) -> Tuple[bool, str]:
    """Return (ok, reason). Groups must total 13 cards, contain ≥2 seqs,
    one of which is pure."""
    flat = [c for g in groups for c in g]
    if len(flat) != HAND_SIZE:
        return False, f"Need {HAND_SIZE} cards total, got {len(flat)}"
    seqs = sum(1 for g in groups if _is_sequence(g))
    pure_seqs = sum(1 for g in groups if _is_pure_sequence(g))
    if seqs < 2:
        return False, "Need at least 2 sequences"
    if pure_seqs < 1:
        return False, "Need at least 1 pure sequence (no jokers)"
    for g in groups:
        if not (_is_set(g) or _is_sequence(g)):
            return False, "Invalid group: must be all sets or sequences"
    return True, "Valid declaration"


class RummyGame:
    def __init__(self, user_position: str = "south", num_players: int = 4):
        self.rng = secrets.SystemRandom()
        self.user_position = user_position
        self.num_players = max(2, min(4, num_players))
        # We always animate at 4 seats; for 2P we just don't deal east/west.
        self.scores: Dict[str, int] = {p: 0 for p in POSITIONS_4}
        self.match_winner: Optional[str] = None
        self.start_new_hand()

    # ----- per-hand setup -----------------------------------------------

    def start_new_hand(self) -> None:
        # Two decks + 4 jokers
        deck = [make_card(s, r) for _ in range(2) for s in SUITS for r in RANKS]
        for i in range(4):
            deck.append(make_joker(i))
        self.rng.shuffle(deck)

        active_positions = self._active_positions()
        self.hands: Dict[str, List[Dict[str, Any]]] = {}
        for pos in POSITIONS_4:
            if pos in active_positions:
                self.hands[pos] = sorted(
                    [deck.pop() for _ in range(HAND_SIZE)],
                    key=lambda c: (SUITS.index(c["suit"]) if not c.get("is_joker") else -1, RANK_INDEX.get(c["rank"], -1)),
                )
            else:
                self.hands[pos] = []

        # Wildcard joker rank — pick from non-joker top of stock
        wildcard_card = None
        while deck and wildcard_card is None:
            candidate = deck.pop(0)
            if not candidate.get("is_joker"):
                wildcard_card = candidate
                break
        self.wildcard_rank = wildcard_card["rank"] if wildcard_card else "A"
        # Mark wild cards in every hand
        for hand in self.hands.values():
            for c in hand:
                if c.get("is_joker"):
                    continue
                c["is_wild"] = c["rank"] == self.wildcard_rank

        self.discard: List[Dict[str, Any]] = [deck.pop()]
        self.stock: List[Dict[str, Any]] = deck
        self.turn = "south"
        self.phase = "draw"
        self.last_action: Optional[Dict[str, Any]] = None
        self.hand_summary: Optional[Dict[str, Any]] = None

    def _active_positions(self) -> List[str]:
        if self.num_players == 2:
            return ["north", "south"]
        if self.num_players == 3:
            return ["north", "south", "east"]
        return list(POSITIONS_4)

    def _next_active(self, pos: str) -> str:
        actives = self._active_positions()
        idx = actives.index(pos)
        return actives[(idx + 1) % len(actives)]

    # ----- mechanics ----------------------------------------------------

    def _sort_hand(self, pos: str) -> None:
        self.hands[pos].sort(key=lambda c: (
            -1 if c.get("is_joker") else SUITS.index(c["suit"]),
            -1 if c.get("is_joker") else RANK_INDEX[c["rank"]],
        ))

    def draw_stock(self, pos: str) -> Dict[str, Any]:
        if self.phase != "draw":
            raise ValueError("Not draw phase")
        if pos != self.turn:
            raise ValueError("Not your turn")
        if not self.stock:
            top = self.discard[-1]
            rest = self.discard[:-1]
            self.rng.shuffle(rest)
            self.stock = rest
            self.discard = [top]
        if not self.stock:
            self.hand_summary = {"scorer": None, "outcome": "stalemate", "points": 0}
            self.phase = "scoring"
            return {"stalemate": True}
        card = self.stock.pop()
        if not card.get("is_joker"):
            card["is_wild"] = card["rank"] == self.wildcard_rank
        self.hands[pos].append(card)
        self._sort_hand(pos)
        self.phase = "discard"
        self.last_action = {"player": pos, "drew": card, "from": "stock"}
        return {"drew": card, "from": "stock"}

    def take_discard(self, pos: str) -> Dict[str, Any]:
        if self.phase != "draw":
            raise ValueError("Not draw phase")
        if pos != self.turn:
            raise ValueError("Not your turn")
        if not self.discard:
            raise ValueError("No discard available")
        card = self.discard.pop()
        self.hands[pos].append(card)
        self._sort_hand(pos)
        self.phase = "discard"
        self.last_action = {"player": pos, "drew": card, "from": "discard"}
        return {"drew": card, "from": "discard"}

    def discard_card(self, pos: str, card: Dict[str, Any]) -> Dict[str, Any]:
        if self.phase != "discard":
            raise ValueError("Not discard phase")
        if pos != self.turn:
            raise ValueError("Not your turn")
        idx = next((i for i, c in enumerate(self.hands[pos])
                    if c["suit"] == card["suit"] and c["rank"] == card["rank"]
                    and c.get("is_joker") == card.get("is_joker", False)
                    and c.get("joker_id") == card.get("joker_id")), None)
        if idx is None:
            raise ValueError("Card not in hand")
        played = self.hands[pos].pop(idx)
        self.discard.append(played)
        self.last_action = {"player": pos, "discarded": played}
        self.turn = self._next_active(pos)
        self.phase = "draw"
        return {"end": False}

    def declare(self, pos: str, groups: List[List[Dict[str, Any]]]) -> Dict[str, Any]:
        """Validate the proposed grouping and end the hand if valid."""
        if pos != self.user_position:
            raise ValueError("Bots auto-declare")
        if self.phase != "discard":
            # Allow declare during own turn after a draw
            raise ValueError("Declare from your discard phase only")
        # Use the union of all groups vs. current hand (must be exact match)
        flat_groups = [c for g in groups for c in g]
        if len(flat_groups) != len(self.hands[pos]):
            raise ValueError(f"Groups must contain exactly {len(self.hands[pos])} cards")
        ok, reason = validate_declaration(groups)
        if not ok:
            raise ValueError(reason)
        # Settle: declarer wins, opponents incur deadwood
        opp_deadwood = {}
        for opp in self._active_positions():
            if opp == pos:
                continue
            d, _ = best_meld_partition(self.hands[opp])
            opp_deadwood[opp] = min(d, DEADWOOD_CAP)
            self.scores[opp] += opp_deadwood[opp]
        self.hand_summary = {
            "scorer": pos,
            "outcome": "declared",
            "opp_deadwood": opp_deadwood,
        }
        self.match_winner = pos  # Simplified: first valid declaration wins
        self.phase = "finished"
        return {"end": True}

    def begin_next_hand(self) -> None:
        if self.phase != "scoring":
            raise ValueError("Round not finished")
        self.start_new_hand()

    # ----- AI -----------------------------------------------------------

    def bot_act(self) -> Dict[str, Any]:
        actor = self.turn
        before_dead, _ = best_meld_partition(self.hands[actor])
        top = self.discard[-1] if self.discard else None
        took_discard = False
        if top is not None:
            simulated = self.hands[actor] + [top]
            after_dead, _ = best_meld_partition(simulated)
            if after_dead < before_dead:
                self.take_discard(actor)
                took_discard = True
        if not took_discard:
            res = self.draw_stock(actor)
            if res.get("stalemate"):
                return {"player": actor, "stalemate": True}
        # Choose discard that minimises post-discard deadwood
        hand = self.hands[actor]
        best_idx, best_dead = 0, hand_total(hand)
        for i in range(len(hand)):
            simulated = hand[:i] + hand[i + 1:]
            d, _ = best_meld_partition(simulated)
            if d < best_dead:
                best_dead = d
                best_idx = i
        choose = hand[best_idx]
        self.discard_card(actor, choose)
        return {
            "player": actor,
            "drew_from": "discard" if took_discard else "stock",
            "discarded": choose,
        }

    def run_bots(self, max_steps: int = 8) -> List[Dict[str, Any]]:
        steps: List[Dict[str, Any]] = []
        for _ in range(max_steps):
            if self.phase not in ("draw", "discard"):
                break
            if self.turn == self.user_position:
                break
            steps.append(self.bot_act())
            if self.phase != "draw":
                break
        return steps

    # ----- view ---------------------------------------------------------

    def to_view(self) -> Dict[str, Any]:
        deadwood, melds = best_meld_partition(self.hands[self.user_position])
        melded: set[int] = set()
        for m in melds:
            for idx in m:
                melded.add(idx)
        # Per-card meld_id so the frontend can render the hand grouped by
        # meld (and tell sets apart from runs). Loose cards = -1.
        hand = self.hands[self.user_position]
        card_meld_id: List[int] = [-1] * len(hand)
        meld_groups: List[Dict[str, Any]] = []
        for mid, m in enumerate(melds):
            for idx in m:
                card_meld_id[idx] = mid
            cards = [hand[idx] for idx in m]
            non_jokers = [c for c in cards if not (c.get("is_joker") or c.get("is_wild"))]
            if non_jokers and all(c["rank"] == non_jokers[0]["rank"] for c in non_jokers):
                kind = "set"
                label = f"Set · {len(cards)} {non_jokers[0]['rank']}s"
            else:
                kind = "run"
                suit = non_jokers[0]["suit"] if non_jokers else "?"
                label = f"Run · {suit}"
            meld_groups.append({
                "kind": kind,
                "label": label,
                "indices": list(m),
                "size": len(m),
            })
        annotated = [
            {**c, "in_meld": (i in melded), "meld_id": card_meld_id[i]}
            for i, c in enumerate(hand)
        ]
        # Auto-grouping for declaration: each meld becomes a group; loose
        # cards are returned as their own size-1 groups (frontend can use
        # this as a starting point, but `can_declare` is only true when no
        # loose cards remain AND the meld set satisfies declaration rules).
        groups: List[List[Dict[str, Any]]] = []
        for m in melds:
            groups.append([hand[idx] for idx in m])
        loose_indices = [i for i in range(len(hand)) if i not in melded]
        for i in loose_indices:
            groups.append([hand[i]])
        # Can declare? Only when no loose cards AND validate_declaration agrees.
        can_decl = False
        if not loose_indices and groups:
            ok, _ = validate_declaration(groups)
            can_decl = ok
        players_data = {
            pos: {
                "card_count": len(self.hands[pos]),
                "score": self.scores[pos],
                "active": pos in self._active_positions(),
            }
            for pos in POSITIONS_4
        }
        return {
            "user_position": self.user_position,
            "num_players": self.num_players,
            "active_positions": self._active_positions(),
            "phase": self.phase,
            "turn": self.turn,
            "stock_count": len(self.stock),
            "top_discard": self.discard[-1] if self.discard else None,
            "wildcard_rank": self.wildcard_rank,
            "your_hand": annotated,
            "your_deadwood": deadwood,
            "meld_groups": meld_groups,
            "auto_groups": groups,
            "can_declare": can_decl,
            "scores": self.scores,
            "players_data": players_data,
            "match_winner": self.match_winner,
            "hand_summary": self.hand_summary,
            "last_action": self.last_action,
        }

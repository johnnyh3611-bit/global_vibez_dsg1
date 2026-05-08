"""
Gin Rummy — pure-Python rule engine for the 2-player classic.

Standard ruleset:
  • 52-card deck (no jokers); deal 10 cards each.
  • Dealer flips top card to seed the discard pile; remainder is stock.
  • Non-dealer (south by convention) gets first option to take the upcard.
    For simplicity our engine starts with south's pick-or-discard turn;
    the upcard offer is collapsed into the standard pick-stock-OR-discard.
  • On your turn: pick from STOCK or take TOP-DISCARD, then DISCARD one.
  • You can KNOCK after discard if your deadwood (post-discard) is ≤ 10.
  • GIN = 0 deadwood after discard → +25 bonus + opponent's full deadwood.
  • UNDERCUT (defender ≤ knocker's deadwood, knocker non-Gin) → +25 bonus
    + difference instead of the knocker scoring.
  • First player to reach 100 points wins the match.
"""
from __future__ import annotations
from typing import List, Dict, Any, Optional
import secrets

from utils.meld_detection import (
    SUITS, RANKS, RANK_INDEX, make_card, hand_total, best_meld_partition,
    best_deadwood, is_gin, can_knock,
)

POSITIONS = ["north", "south"]
HAND_SIZE = 10
KNOCK_THRESHOLD = 10
MATCH_TARGET = 100
GIN_BONUS = 25
UNDERCUT_BONUS = 25


def _opp(pos: str) -> str:
    return "south" if pos == "north" else "north"


class GinRummyGame:
    def __init__(self, user_position: str = "south"):
        self.rng = secrets.SystemRandom()
        self.user_position = user_position
        self.scores: Dict[str, int] = {p: 0 for p in POSITIONS}
        self.match_winner: Optional[str] = None
        self.start_new_hand()

    # ----- per-hand setup -----------------------------------------------

    def start_new_hand(self) -> None:
        deck = [make_card(s, r) for s in SUITS for r in RANKS]
        self.rng.shuffle(deck)
        self.hands: Dict[str, List[Dict[str, Any]]] = {
            p: sorted([deck.pop() for _ in range(HAND_SIZE)], key=lambda c: (SUITS.index(c["suit"]), RANK_INDEX[c["rank"]]))
            for p in POSITIONS
        }
        self.discard: List[Dict[str, Any]] = [deck.pop()]
        self.stock: List[Dict[str, Any]] = deck
        self.turn: str = "south"
        self.phase: str = "draw"  # 'draw' → 'discard' → 'draw' → … or 'finished'
        self.last_action: Optional[Dict[str, Any]] = None
        self.hand_summary: Optional[Dict[str, Any]] = None

    # ----- helpers ------------------------------------------------------

    def _sort_hand(self, pos: str) -> None:
        self.hands[pos].sort(key=lambda c: (SUITS.index(c["suit"]), RANK_INDEX[c["rank"]]))

    def _settle_hand(self, knocker: str, gin: bool) -> None:
        defender = _opp(knocker)
        knocker_dead = best_deadwood(self.hands[knocker])
        defender_dead = best_deadwood(self.hands[defender])
        if gin:
            scorer = knocker
            points = GIN_BONUS + defender_dead
            outcome = "gin"
        elif defender_dead <= knocker_dead:
            scorer = defender
            points = UNDERCUT_BONUS + (knocker_dead - defender_dead)
            outcome = "undercut"
        else:
            scorer = knocker
            points = defender_dead - knocker_dead
            outcome = "knock"
        self.scores[scorer] += points
        self.hand_summary = {
            "scorer": scorer,
            "outcome": outcome,
            "points": points,
            "knocker_deadwood": knocker_dead,
            "defender_deadwood": defender_dead,
        }
        if self.scores[scorer] >= MATCH_TARGET:
            self.match_winner = scorer
            self.phase = "finished"
        else:
            self.phase = "scoring"

    # ----- mechanics ----------------------------------------------------

    def draw_stock(self, pos: str) -> Dict[str, Any]:
        if self.phase != "draw":
            raise ValueError("Not draw phase")
        if pos != self.turn:
            raise ValueError("Not your turn")
        if not self.stock:
            # Stock empty → reshuffle discard except top
            top = self.discard[-1]
            rest = self.discard[:-1]
            self.rng.shuffle(rest)
            self.stock = rest
            self.discard = [top]
        if not self.stock:
            # Still empty → tie & reset hand
            self.hand_summary = {"scorer": None, "outcome": "stalemate", "points": 0}
            self.phase = "scoring"
            return {"stalemate": True}
        card = self.stock.pop()
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
            raise ValueError("No discard to take")
        card = self.discard.pop()
        self.hands[pos].append(card)
        self._sort_hand(pos)
        self.phase = "discard"
        self.last_action = {"player": pos, "drew": card, "from": "discard"}
        return {"drew": card, "from": "discard"}

    def discard_card(self, pos: str, card: Dict[str, Any], knock: bool = False) -> Dict[str, Any]:
        if self.phase != "discard":
            raise ValueError("Not discard phase")
        if pos != self.turn:
            raise ValueError("Not your turn")
        idx = next((i for i, c in enumerate(self.hands[pos])
                    if c["suit"] == card["suit"] and c["rank"] == card["rank"]), None)
        if idx is None:
            raise ValueError("Card not in hand")
        played = self.hands[pos].pop(idx)
        self.discard.append(played)
        self.last_action = {"player": pos, "discarded": played, "knock": knock}
        # Check end-state
        if knock:
            gin = is_gin(self.hands[pos])
            if not gin and not can_knock(self.hands[pos], KNOCK_THRESHOLD):
                # Cannot knock — restore the card and reject
                self.discard.pop()
                self.hands[pos].append(played)
                self._sort_hand(pos)
                raise ValueError("Cannot knock with deadwood > 10")
            self._settle_hand(pos, gin)
            return {"end": True, "gin": gin}
        # Auto-detect Gin (deadwood == 0): settle automatically
        if is_gin(self.hands[pos]):
            self._settle_hand(pos, True)
            return {"end": True, "gin": True}
        # Pass turn
        self.turn = _opp(pos)
        self.phase = "draw"
        return {"end": False}

    def begin_next_hand(self) -> None:
        if self.phase != "scoring":
            raise ValueError("Round not finished")
        self.start_new_hand()

    # ----- AI -----------------------------------------------------------

    def bot_act(self) -> Dict[str, Any]:
        """Drive a full bot turn (draw + discard) and return a step record."""
        actor = self.turn
        # Draw decision: prefer top-discard if it slots into a meld + reduces deadwood
        before_dead = best_deadwood(self.hands[actor])
        top = self.discard[-1] if self.discard else None
        took_discard = False
        if top is not None:
            simulated = self.hands[actor] + [top]
            after_dead = best_deadwood(simulated)
            if after_dead < before_dead:
                self.take_discard(actor)
                took_discard = True
        if not took_discard:
            self.draw_stock(actor)
        # Discard the card that maximises post-discard deadwood reduction
        hand = self.hands[actor]
        best_idx = 0
        best_dead_after = best_deadwood(hand[1:])
        for i in range(1, len(hand)):
            simulated = hand[:i] + hand[i + 1:]
            d = best_deadwood(simulated)
            if d < best_dead_after:
                best_dead_after = d
                best_idx = i
        choose = hand[best_idx]
        # Knock if possible and prudent (deadwood ≤ 10 OR Gin)
        will_knock = best_dead_after <= KNOCK_THRESHOLD
        result = self.discard_card(actor, choose, knock=will_knock)
        return {
            "player": actor,
            "drew_from": "discard" if took_discard else "stock",
            "discarded": choose,
            "knock": will_knock,
            "end": result.get("end", False),
            "gin": result.get("gin", False),
        }

    def run_bots(self, max_steps: int = 6) -> List[Dict[str, Any]]:
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
        # Compute MELD HINT for the user (so the UI can colour their hand)
        deadwood, melds = best_meld_partition(self.hands[self.user_position])
        melded_set: set[int] = set()
        for m in melds:
            for idx in m:
                melded_set.add(idx)
        # Per-card meld_id (0,1,2,…) so the frontend can group cards
        # belonging to the same set/run together. Loose cards = -1.
        # Plus per-meld metadata (kind = "set" or "run") so the UI can
        # render a label like "Set · 3 Kings" or "Run · 4-5-6 ♠".
        card_meld_id: List[int] = [-1] * len(self.hands[self.user_position])
        meld_groups: List[Dict[str, Any]] = []
        for mid, m in enumerate(melds):
            for idx in m:
                card_meld_id[idx] = mid
            cards = [self.hands[self.user_position][idx] for idx in m]
            ranks = {c["rank"] for c in cards}
            kind = "set" if len(ranks) == 1 else "run"
            label = (
                f"Set · {len(cards)} {next(iter(ranks))}s"
                if kind == "set"
                else f"Run · {cards[0]['suit']}"
            )
            meld_groups.append({
                "kind": kind,
                "label": label,
                "indices": list(m),
                "size": len(m),
            })
        annotated_hand = [
            {**c, "in_meld": (i in melded_set), "meld_id": card_meld_id[i]}
            for i, c in enumerate(self.hands[self.user_position])
        ]
        players_data = {
            pos: {"card_count": len(self.hands[pos]), "score": self.scores[pos]}
            for pos in POSITIONS
        }
        return {
            "user_position": self.user_position,
            "phase": self.phase,
            "turn": self.turn,
            "stock_count": len(self.stock),
            "top_discard": self.discard[-1] if self.discard else None,
            "your_hand": annotated_hand,
            "your_deadwood": deadwood,
            "meld_groups": meld_groups,
            "can_knock": deadwood <= KNOCK_THRESHOLD,
            "is_gin": deadwood == 0,
            "scores": self.scores,
            "players_data": players_data,
            "match_winner": self.match_winner,
            "hand_summary": self.hand_summary,
            "last_action": self.last_action,
        }

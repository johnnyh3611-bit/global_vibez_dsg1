"""
Crazy Eights — pure-Python rule engine for the 2-4 player classic.

Standard 4-player ruleset:
  • 52-card deck (no jokers); deal 5 cards each.
  • Top card flipped to start the discard pile (re-flipped if it's an 8).
  • On your turn play a card matching the SUIT or RANK of the top card.
  • 8s are wild — play any 8, declare any suit; next player must match.
  • If you can't play, draw 1; if still no play, pass.
  • First to empty their hand wins; remaining card-pip totals score the others.
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


def cards_match(a: Dict[str, Any], b: Dict[str, Any]) -> bool:
    return a["suit"] == b["suit"] and a["rank"] == b["rank"]


def remove_card(hand: List[Dict[str, Any]], card: Dict[str, Any]) -> bool:
    for i, c in enumerate(hand):
        if cards_match(c, card):
            hand.pop(i)
            return True
    return False


def is_legal(card: Dict[str, Any], top: Dict[str, Any], declared_suit: str) -> bool:
    if card["rank"] == "8":
        return True
    return card["suit"] == declared_suit or card["rank"] == top["rank"]


def legal_plays(hand: List[Dict[str, Any]], top: Dict[str, Any], declared_suit: str) -> List[Dict[str, Any]]:
    return [c for c in hand if is_legal(c, top, declared_suit)]


def hand_pip_total(hand: List[Dict[str, Any]]) -> int:
    score = 0
    for c in hand:
        if c["rank"] == "8":
            score += 50
        elif c["rank"] in {"J", "Q", "K"}:
            score += 10
        elif c["rank"] == "A":
            score += 1
        else:
            score += int(c["rank"])
    return score


def ai_pick_play(hand: List[Dict[str, Any]], top: Dict[str, Any], declared_suit: str) -> Optional[Dict[str, Any]]:
    legal = legal_plays(hand, top, declared_suit)
    if not legal:
        return None
    # Prefer to dump high-pip cards. Save 8s unless we have nothing else useful.
    non_eights = [c for c in legal if c["rank"] != "8"]
    pool = non_eights if non_eights else legal
    return max(pool, key=lambda c: hand_pip_total([c]))


def ai_pick_suit(hand: List[Dict[str, Any]]) -> str:
    counts = {s: 0 for s in SUITS}
    for c in hand:
        if c["rank"] == "8":
            continue
        counts[c["suit"]] += 1
    # Strongest suit wins (ties → diamonds → spades → hearts → clubs by SUITS)
    best = max(SUITS, key=lambda s: counts[s])
    return best


class CrazyEightsGame:
    def __init__(self, user_position: str = "south"):
        self.rng = secrets.SystemRandom()
        self.user_position = user_position
        self.scores: Dict[str, int] = {p: 0 for p in POSITIONS}
        self.match_winner: Optional[str] = None
        self.start_new_hand()

    # ----- per-hand setup -----------------------------------------------

    def start_new_hand(self) -> None:
        deck = make_deck()
        self.rng.shuffle(deck)
        self.hands: Dict[str, List[Dict[str, Any]]] = {
            pos: sorted(
                [deck.pop() for _ in range(INITIAL_HAND_SIZE)],
                key=lambda c: (SUITS.index(c["suit"]), c["value"]),
            )
            for pos in POSITIONS
        }
        # Flip a starter card; if it's an 8 push it back & try again.
        starter = deck.pop()
        while starter["rank"] == "8":
            deck.insert(0, starter)
            starter = deck.pop()
        self.discard: List[Dict[str, Any]] = [starter]
        self.draw_pile: List[Dict[str, Any]] = deck
        self.declared_suit: str = starter["suit"]
        self.turn: str = "south"
        self.hand_winner: Optional[str] = None
        self.phase: str = "playing"
        self.last_action: Optional[Dict[str, Any]] = None
        self.pending_wild: bool = False  # waiting for the human to pick a suit

    # ----- mechanics -----------------------------------------------------

    def top_card(self) -> Dict[str, Any]:
        return self.discard[-1]

    def legal_for(self, pos: str) -> List[Dict[str, Any]]:
        return legal_plays(self.hands[pos], self.top_card(), self.declared_suit)

    def play(self, pos: str, card: Dict[str, Any], declared_suit: Optional[str] = None) -> Dict[str, Any]:
        if self.phase != "playing":
            raise ValueError("Not playing phase")
        if pos != self.turn:
            raise ValueError("Not your turn")
        if self.pending_wild and pos == self.user_position:
            raise ValueError("Pick a suit first")
        if not is_legal(card, self.top_card(), self.declared_suit):
            raise ValueError("Illegal play")
        actual = next((c for c in self.hands[pos] if cards_match(c, card)), None)
        if not actual:
            raise ValueError("Card not in hand")
        remove_card(self.hands[pos], actual)
        self.discard.append(actual)
        is_eight = actual["rank"] == "8"
        if is_eight:
            if pos == self.user_position:
                if not declared_suit:
                    # User must declare a suit on the next call.
                    self.pending_wild = True
                    self.last_action = {"player": pos, "card": actual, "wild": True}
                    return {"wild_pending": True}
                if declared_suit not in SUITS:
                    raise ValueError("Invalid suit")
                self.declared_suit = declared_suit
            else:
                self.declared_suit = ai_pick_suit(self.hands[pos])
        else:
            self.declared_suit = actual["suit"]
        self.last_action = {"player": pos, "card": actual, "wild": is_eight, "declared": self.declared_suit}
        if not self.hands[pos]:
            self.finalize_hand(winner=pos)
            return {"hand_complete": True, "winner": pos}
        self.turn = _next(self.turn)
        return {"hand_complete": False}

    def declare_suit(self, pos: str, suit: str) -> None:
        if not self.pending_wild:
            raise ValueError("No wild pending")
        if pos != self.user_position:
            raise ValueError("Bot wild auto-resolves")
        if suit not in SUITS:
            raise ValueError("Invalid suit")
        self.declared_suit = suit
        self.pending_wild = False
        if self.last_action:
            self.last_action["declared"] = suit
        if not self.hands[pos]:
            self.finalize_hand(winner=pos)
        else:
            self.turn = _next(self.turn)

    def draw(self, pos: str) -> Dict[str, Any]:
        if self.phase != "playing":
            raise ValueError("Not playing phase")
        if pos != self.turn:
            raise ValueError("Not your turn")
        if self.pending_wild and pos == self.user_position:
            raise ValueError("Pick a suit first")
        if not self.draw_pile:
            self._reshuffle_discard()
        if not self.draw_pile:
            # Stalemate — pass turn
            self.turn = _next(self.turn)
            return {"drawn": None, "pass": True}
        card = self.draw_pile.pop()
        self.hands[pos].append(card)
        self.hands[pos].sort(key=lambda c: (SUITS.index(c["suit"]), c["value"]))
        self.last_action = {"player": pos, "drew": True}
        # House rule: drawing ends your turn (one-card draw).
        self.turn = _next(self.turn)
        return {"drawn": card, "pass": False}

    def _reshuffle_discard(self) -> None:
        if len(self.discard) <= 1:
            return
        top = self.discard[-1]
        rest = self.discard[:-1]
        self.rng.shuffle(rest)
        self.draw_pile = rest
        self.discard = [top]

    def finalize_hand(self, winner: str) -> None:
        # Award points = sum of opponents' remaining pips.
        bonus = 0
        for p in POSITIONS:
            if p == winner:
                continue
            bonus += hand_pip_total(self.hands[p])
        self.scores[winner] += bonus
        self.hand_winner = winner
        self.phase = "scoring"
        if self.scores[winner] >= 200:
            self.match_winner = winner
            self.phase = "finished"

    def begin_next_hand(self) -> None:
        if self.phase != "scoring":
            raise ValueError("Round not finished")
        self.start_new_hand()

    # ----- bot loop ------------------------------------------------------

    def run_bots(self, max_steps: int = 32) -> List[Dict[str, Any]]:
        steps: List[Dict[str, Any]] = []
        for _ in range(max_steps):
            if self.phase != "playing":
                break
            if self.turn == self.user_position:
                break
            if self.pending_wild:
                break
            choice = ai_pick_play(self.hands[self.turn], self.top_card(), self.declared_suit)
            actor = self.turn
            if choice is None:
                self.draw(actor)
                steps.append({"player": actor, "drew": True})
            else:
                pre_phase = self.phase
                res = self.play(actor, choice)
                steps.append({
                    "player": actor,
                    "card": choice,
                    "wild": choice["rank"] == "8",
                    "declared": self.declared_suit,
                    "hand_complete": res.get("hand_complete", False),
                    "winner": res.get("winner"),
                })
                if pre_phase != self.phase:
                    break
        return steps

    # ----- view ----------------------------------------------------------

    def to_view(self) -> Dict[str, Any]:
        players_data = {
            pos: {
                "card_count": len(self.hands[pos]),
                "score": self.scores[pos],
            }
            for pos in POSITIONS
        }
        return {
            "user_position": self.user_position,
            "phase": self.phase,
            "turn": self.turn,
            "top_card": self.top_card(),
            "declared_suit": self.declared_suit,
            "draw_pile_count": len(self.draw_pile),
            "your_hand": self.hands[self.user_position],
            "playable_cards": self.legal_for(self.user_position) if self.phase == "playing" else [],
            "scores": self.scores,
            "players_data": players_data,
            "hand_winner": self.hand_winner,
            "match_winner": self.match_winner,
            "pending_wild": self.pending_wild,
            "last_action": self.last_action,
        }

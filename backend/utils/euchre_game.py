"""
Euchre — pure-Python rule engine for the 4-player partnership classic.

Standard ruleset (no going-alone for MVP):
  • 24-card deck (9, 10, J, Q, K, A in each of 4 suits).
  • Partners: north + south vs east + west.
  • Deal 5 each. Top of remaining 4-card kitty is the UPCARD.
  • BIDDING ROUND 1: each player in turn (clockwise from dealer's left)
    can either ORDER UP (force the dealer to take the upcard; trump =
    upcard's suit) or PASS. If anyone orders up, dealer adds upcard
    and discards one face-down.
  • BIDDING ROUND 2: if all pass, players choose a different suit as
    trump, or pass. If everyone passes again, hand is redealt.
  • TRUMP ranking (high → low):
      Right Bower (J of trump) > Left Bower (J of same colour as trump,
      treated as trump for everything) > A > K > Q > 10 > 9.
      Off-suit ranking: A > K > Q > J > 10 > 9.
  • 5 tricks per hand. Must follow led suit if possible.
  • SCORING:
      - Calling team makes 3-4 tricks: +1
      - Calling team makes all 5 (sweep): +2
      - Calling team makes < 3 ("euchred"): defending team +2
  • First team to 10 points wins the match.
"""
from __future__ import annotations
from typing import List, Dict, Any, Optional, Tuple
import secrets

POSITIONS = ["north", "east", "south", "west"]
PARTNER = {"north": "south", "south": "north", "east": "west", "west": "east"}
TEAMS = {"north": "team1", "south": "team1", "east": "team2", "west": "team2"}
SUITS = ["clubs", "diamonds", "spades", "hearts"]
SUIT_COLOR = {"clubs": "black", "spades": "black", "hearts": "red", "diamonds": "red"}
RANKS = ["9", "10", "J", "Q", "K", "A"]
RANK_VALUES = {r: i for i, r in enumerate(RANKS)}
HAND_SIZE = 5
MATCH_TARGET = 10


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


def left_bower_suit(trump: str) -> str:
    """Suit of the same colour as trump — Jack of which is the Left Bower."""
    if trump == "clubs": return "spades"
    if trump == "spades": return "clubs"
    if trump == "hearts": return "diamonds"
    return "hearts"


def effective_suit(card: Dict[str, Any], trump: str) -> str:
    """Left Bower is treated as trump for everything."""
    if card["rank"] == "J" and card["suit"] == left_bower_suit(trump):
        return trump
    return card["suit"]


def card_strength(card: Dict[str, Any], trump: str, led: Optional[str]) -> int:
    """Return a ranking integer; higher beats lower in a comparison.
    Off-suit (not trump and not led) cards always rank below led-suit cards."""
    eff = effective_suit(card, trump)
    is_trump = (eff == trump)
    is_right = is_trump and card["rank"] == "J" and card["suit"] == trump
    is_left  = is_trump and card["rank"] == "J" and card["suit"] == left_bower_suit(trump)
    if is_right:
        return 200
    if is_left:
        return 190
    if is_trump:
        # Map A,K,Q,10,9 to 100..150ish (J handled above)
        order = {"A": 150, "K": 140, "Q": 130, "10": 120, "9": 110}
        return order.get(card["rank"], 100)
    if led is not None and eff == led:
        # Following suit
        order = {"A": 60, "K": 55, "Q": 50, "J": 45, "10": 40, "9": 35}
        return order.get(card["rank"], 0)
    return 0  # off-suit non-trump non-led — can't win


class EuchreGame:
    def __init__(self, user_position: str = "south"):
        self.rng = secrets.SystemRandom()
        self.user_position = user_position
        self.dealer = "west"  # so first turn is north
        self.scores: Dict[str, int] = {"team1": 0, "team2": 0}
        self.match_winner: Optional[str] = None
        self.start_new_hand()

    # ----- per-hand setup -----------------------------------------------

    def start_new_hand(self) -> None:
        deck = make_deck()
        self.rng.shuffle(deck)
        self.hands: Dict[str, List[Dict[str, Any]]] = {
            pos: sorted(
                [deck.pop() for _ in range(HAND_SIZE)],
                key=lambda c: (SUITS.index(c["suit"]), RANK_VALUES[c["rank"]]),
            )
            for pos in POSITIONS
        }
        self.kitty: List[Dict[str, Any]] = deck  # 4 remaining
        self.upcard: Dict[str, Any] = self.kitty[0]
        # Bidding starts with player to dealer's left (clockwise = north
        # always at index 0 after wrapping, in our seat list).
        self.dealer = POSITIONS[(POSITIONS.index(self.dealer) + 1) % 4]
        self.bid_starter = POSITIONS[(POSITIONS.index(self.dealer) + 1) % 4]
        self.bid_turn = self.bid_starter
        self.bid_round = 1     # 1 = order-up the upcard, 2 = name a new suit
        self.passes_in_round = 0
        self.trump: Optional[str] = None
        self.calling_team: Optional[str] = None
        self.tricks_won: Dict[str, int] = {p: 0 for p in POSITIONS}
        self.team_tricks: Dict[str, int] = {"team1": 0, "team2": 0}
        self.current_trick: List[Dict[str, Any]] = []
        self.led_suit: Optional[str] = None
        self.tricks_played = 0
        self.turn = self.bid_starter
        self.phase = "bidding"  # bidding → ordered_dealer_discard → playing → scoring
        self.last_action: Optional[Dict[str, Any]] = None
        self.hand_summary: Optional[Dict[str, Any]] = None

    # ----- bidding ------------------------------------------------------

    def order_up(self, pos: str) -> Dict[str, Any]:
        if self.phase != "bidding":
            raise ValueError("Not bidding phase")
        if pos != self.bid_turn:
            raise ValueError("Not your turn to bid")
        if self.bid_round != 1:
            raise ValueError("Round 1 only — round 2 use name_trump")
        self.trump = self.upcard["suit"]
        self.calling_team = TEAMS[pos]
        # Dealer must add upcard + discard one
        self.hands[self.dealer].append(self.upcard)
        self._sort_hand(self.dealer)
        if self.dealer == self.user_position:
            # User must pick a discard; phase set to ordered_dealer_discard
            self.phase = "ordered_dealer_discard"
            self.turn = self.user_position
            self.last_action = {"player": pos, "action": "ordered_up"}
            return {"awaiting_discard": True}
        # Bot dealer auto-discards lowest off-trump card (or worst trump)
        worst = self._bot_pick_discard(self.dealer, self.trump)
        remove_card(self.hands[self.dealer], worst)
        self.kitty[0] = worst  # keep underneath as we go (cosmetic)
        self.last_action = {"player": pos, "action": "ordered_up", "dealer_discarded_hidden": True}
        self._begin_trick_phase()
        return {"trump": self.trump}

    def name_trump(self, pos: str, suit: str) -> Dict[str, Any]:
        if self.phase != "bidding":
            raise ValueError("Not bidding phase")
        if pos != self.bid_turn:
            raise ValueError("Not your turn to bid")
        if self.bid_round != 2:
            raise ValueError("Round 2 only")
        if suit not in SUITS:
            raise ValueError("Invalid suit")
        if suit == self.upcard["suit"]:
            raise ValueError("Cannot name the upcard's suit in round 2")
        self.trump = suit
        self.calling_team = TEAMS[pos]
        self.last_action = {"player": pos, "action": "named_trump", "trump": suit}
        self._begin_trick_phase()
        return {"trump": self.trump}

    def pass_bid(self, pos: str) -> Dict[str, Any]:
        if self.phase != "bidding":
            raise ValueError("Not bidding phase")
        if pos != self.bid_turn:
            raise ValueError("Not your turn to bid")
        self.passes_in_round += 1
        self.last_action = {"player": pos, "action": "passed", "round": self.bid_round}
        # Advance bid turn
        self.bid_turn = POSITIONS[(POSITIONS.index(self.bid_turn) + 1) % 4]
        if self.passes_in_round >= 4:
            if self.bid_round == 1:
                self.bid_round = 2
                self.passes_in_round = 0
            else:
                # All 8 passes → redeal
                self.start_new_hand()
                return {"redeal": True}
        return {}

    def discard_after_order(self, pos: str, card: Dict[str, Any]) -> None:
        if self.phase != "ordered_dealer_discard":
            raise ValueError("Not in dealer-discard phase")
        if pos != self.dealer:
            raise ValueError("Only dealer discards")
        if pos != self.user_position:
            raise ValueError("Bot dealer auto-discarded")
        if not remove_card(self.hands[pos], card):
            raise ValueError("Card not in hand")
        self._begin_trick_phase()

    def _begin_trick_phase(self) -> None:
        # First trick led by player to dealer's left
        self.turn = POSITIONS[(POSITIONS.index(self.dealer) + 1) % 4]
        self.phase = "playing"
        self.current_trick = []
        self.led_suit = None

    # ----- trick play ---------------------------------------------------

    def legal_for(self, pos: str) -> List[Dict[str, Any]]:
        if self.phase != "playing":
            return []
        if self.led_suit is None:
            return list(self.hands[pos])
        same = [c for c in self.hands[pos] if effective_suit(c, self.trump or "") == self.led_suit]
        return same if same else list(self.hands[pos])

    def play(self, pos: str, card: Dict[str, Any]) -> Dict[str, Any]:
        if self.phase != "playing":
            raise ValueError("Not playing phase")
        if pos != self.turn:
            raise ValueError("Not your turn")
        legal = self.legal_for(pos)
        if not any(cards_match(card, c) for c in legal):
            raise ValueError("Illegal play (must follow suit if possible)")
        actual = next(c for c in self.hands[pos] if cards_match(c, card))
        remove_card(self.hands[pos], actual)
        if not self.current_trick:
            self.led_suit = effective_suit(actual, self.trump or "")
        self.current_trick.append({"player": pos, "card": actual})

        result: Dict[str, Any] = {"trick_complete": False, "trick_winner": None}
        if len(self.current_trick) == 4:
            winner = self._determine_trick_winner()
            self.tricks_won[winner] += 1
            self.team_tricks[TEAMS[winner]] += 1
            self.tricks_played += 1
            result["trick_complete"] = True
            result["trick_winner"] = winner
            self.current_trick = []
            self.led_suit = None
            if self.tricks_played == 5:
                self._finalise_hand()
                result["round_complete"] = True
            else:
                self.turn = winner
        else:
            self.turn = POSITIONS[(POSITIONS.index(pos) + 1) % 4]
        return result

    def _determine_trick_winner(self) -> str:
        best_player = self.current_trick[0]["player"]
        best_strength = -1
        for play in self.current_trick:
            s = card_strength(play["card"], self.trump or "", self.led_suit)
            if s > best_strength:
                best_strength = s
                best_player = play["player"]
        return best_player

    def _finalise_hand(self) -> None:
        caller = self.calling_team or "team1"
        defender = "team1" if caller == "team2" else "team2"
        called_tricks = self.team_tricks[caller]
        if called_tricks >= 3:
            points = 1 if called_tricks < 5 else 2
            self.scores[caller] += points
            outcome = "march" if called_tricks == 5 else "made"
        else:
            self.scores[defender] += 2
            outcome = "euchred"
            points = 2
        self.hand_summary = {
            "caller": caller,
            "tricks_team1": self.team_tricks["team1"],
            "tricks_team2": self.team_tricks["team2"],
            "outcome": outcome,
            "points_awarded": points,
        }
        self.phase = "scoring" if max(self.scores.values()) < MATCH_TARGET else "finished"
        if self.phase == "finished":
            self.match_winner = max(self.scores, key=lambda k: self.scores[k])

    def begin_next_hand(self) -> None:
        if self.phase != "scoring":
            raise ValueError("Round not finished")
        self.start_new_hand()

    # ----- AI -----------------------------------------------------------

    def _bot_pick_discard(self, pos: str, trump: str) -> Dict[str, Any]:
        # Discard lowest-strength card (off-suit always loses)
        return min(self.hands[pos], key=lambda c: card_strength(c, trump, None))

    def _hand_strength(self, pos: str, trump: str) -> float:
        return sum(card_strength(c, trump, None) for c in self.hands[pos]) / 100.0

    def bot_bid(self) -> Dict[str, Any]:
        actor = self.bid_turn
        if self.bid_round == 1:
            # Order up if hand is strong in upcard's suit (3+ trump including bowers)
            trump_count = sum(1 for c in self.hands[actor] if effective_suit(c, self.upcard["suit"]) == self.upcard["suit"])
            if trump_count >= 3:
                return self.order_up(actor)
            return self.pass_bid(actor)
        else:
            # Round 2 — name our strongest non-upcard suit if 3+ trump card potential
            best_suit, best_count = None, 0
            for s in SUITS:
                if s == self.upcard["suit"]:
                    continue
                cnt = sum(1 for c in self.hands[actor] if effective_suit(c, s) == s)
                if cnt > best_count:
                    best_count = cnt
                    best_suit = s
            if best_suit and best_count >= 3:
                return self.name_trump(actor, best_suit)
            return self.pass_bid(actor)

    def bot_play(self) -> Dict[str, Any]:
        actor = self.turn
        legal = self.legal_for(actor)
        # Heuristic: if leading, lead high trump. Otherwise win cheaply or
        # dump worst.
        if not self.current_trick:
            choice = max(legal, key=lambda c: card_strength(c, self.trump or "", None))
        else:
            best_strength_on_table = max(
                card_strength(p["card"], self.trump or "", self.led_suit)
                for p in self.current_trick
            )
            winners = [c for c in legal if card_strength(c, self.trump or "", self.led_suit) > best_strength_on_table]
            if winners:
                choice = min(winners, key=lambda c: card_strength(c, self.trump or "", self.led_suit))
            else:
                choice = min(legal, key=lambda c: card_strength(c, self.trump or "", self.led_suit))
        res = self.play(actor, choice)
        return {"player": actor, "card": choice, **res}

    def run_bots(self, max_steps: int = 32) -> List[Dict[str, Any]]:
        steps: List[Dict[str, Any]] = []
        for _ in range(max_steps):
            if self.phase == "bidding":
                if self.bid_turn == self.user_position:
                    break
                steps.append({"player": self.bid_turn, "bid": self.bot_bid()})
            elif self.phase == "playing":
                if self.turn == self.user_position:
                    break
                steps.append(self.bot_play())
                if self.phase != "playing":
                    break
            else:
                break
        return steps

    # ----- view ---------------------------------------------------------

    def _sort_hand(self, pos: str) -> None:
        self.hands[pos].sort(key=lambda c: (SUITS.index(c["suit"]), RANK_VALUES[c["rank"]]))

    def to_view(self) -> Dict[str, Any]:
        legal = self.legal_for(self.user_position) if self.phase == "playing" else []
        players_data = {
            pos: {
                "card_count": len(self.hands[pos]),
                "tricks_won": self.tricks_won[pos],
                "team": TEAMS[pos],
            }
            for pos in POSITIONS
        }
        return {
            "user_position": self.user_position,
            "phase": self.phase,
            "turn": self.turn if self.phase == "playing" else self.bid_turn,
            "bid_turn": self.bid_turn,
            "bid_round": self.bid_round,
            "dealer": self.dealer,
            "upcard": self.upcard,
            "trump": self.trump,
            "calling_team": self.calling_team,
            "current_trick": self.current_trick,
            "led_suit": self.led_suit,
            "your_hand": self.hands[self.user_position],
            "playable_cards": legal,
            "scores": self.scores,
            "team_tricks": self.team_tricks,
            "tricks_played": self.tricks_played,
            "players_data": players_data,
            "match_winner": self.match_winner,
            "hand_summary": self.hand_summary,
            "last_action": self.last_action,
        }

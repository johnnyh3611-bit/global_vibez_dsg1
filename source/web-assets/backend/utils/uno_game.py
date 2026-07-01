"""
UNO — pure-Python rule engine for the 4-player classic.

Standard ruleset:
  • 108-card UNO deck:
      - Numbered cards 0-9 in red/yellow/green/blue
        (1 zero + 2 each of 1-9 per color = 76)
      - Action cards (Skip, Reverse, Draw Two) ×2 per color = 24
      - Wild cards (4 plain wild + 4 wild-draw-four) = 8
  • Deal 7 cards each. Top card flipped to start the discard.
    If the start card is a Wild Draw Four it's reshuffled in.
    If it's any other wild, dealer picks a color; in our engine the
    game starts with `pending_color = first_color_of_deck`.
  • Play matches by COLOR or NUMBER/ACTION.
    Wilds play any time, declare a color.
    Wild Draw Four next player draws 4 + skip.
    Draw Two next player draws 2 + skip.
    Skip next player skipped.
    Reverse direction inverted (in 2P play, acts as a Skip).
  • If you can't play, draw 1 (in our engine drawing ends the turn).
  • First to empty their hand wins; opponents score residual card pips.
  • First to 500 points wins the match.
"""
from __future__ import annotations
from typing import List, Dict, Any, Optional
import secrets

POSITIONS = ["north", "east", "south", "west"]
COLORS = ["red", "yellow", "green", "blue"]
NUMBERS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]
ACTION_NAMES = ["skip", "reverse", "draw2"]
HAND_SIZE = 7
MATCH_TARGET = 500


def _idx(p: str) -> int:
    return POSITIONS.index(p)


def _step(p: str, direction: int) -> str:
    return POSITIONS[(_idx(p) + direction) % 4]


def make_card(color: str, value: str) -> Dict[str, Any]:
    """Card schema: {color, value, kind} where kind ∈ number|action|wild."""
    if value in NUMBERS:
        kind = "number"
    elif value in ACTION_NAMES:
        kind = "action"
    elif value in ("wild", "wild4"):
        kind = "wild"
    else:
        raise ValueError(f"Unknown UNO value: {value}")
    return {"color": color, "value": value, "kind": kind}


def make_deck() -> List[Dict[str, Any]]:
    deck: List[Dict[str, Any]] = []
    for color in COLORS:
        deck.append(make_card(color, "0"))
        for n in NUMBERS[1:]:
            deck.append(make_card(color, n))
            deck.append(make_card(color, n))
        for action in ACTION_NAMES:
            deck.append(make_card(color, action))
            deck.append(make_card(color, action))
    for _ in range(4):
        deck.append(make_card("wild", "wild"))
        deck.append(make_card("wild", "wild4"))
    return deck


def card_value(card: Dict[str, Any]) -> int:
    """Penalty-points value for unmelded cards at end of hand."""
    if card["kind"] == "number":
        return int(card["value"])
    if card["kind"] == "action":
        return 20
    return 50  # any wild


def is_legal(card: Dict[str, Any], top: Dict[str, Any], pending_color: str) -> bool:
    if card["kind"] == "wild":
        return True  # plain wild and wild4 are always playable in our engine
    if card["color"] == pending_color:
        return True
    if card["value"] == top["value"] and card["kind"] != "wild":
        return True
    return False


def cards_match(a: Dict[str, Any], b: Dict[str, Any]) -> bool:
    return a.get("color") == b.get("color") and a.get("value") == b.get("value")


def remove_card(hand: List[Dict[str, Any]], card: Dict[str, Any]) -> bool:
    for i, c in enumerate(hand):
        if cards_match(c, card):
            hand.pop(i)
            return True
    return False


def hand_score(hand: List[Dict[str, Any]]) -> int:
    return sum(card_value(c) for c in hand)


class UnoGame:
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
            pos: [deck.pop() for _ in range(HAND_SIZE)] for pos in POSITIONS
        }
        # Flip a starter; if it's wild4, push it back & try again
        starter = deck.pop()
        while starter["value"] == "wild4":
            deck.insert(0, starter)
            starter = deck.pop()
        self.discard: List[Dict[str, Any]] = [starter]
        self.draw_pile: List[Dict[str, Any]] = deck
        self.pending_color: str = starter["color"] if starter["color"] in COLORS else self.rng.choice(COLORS)
        self.direction: int = 1  # 1 = clockwise, -1 = counter
        self.turn: str = "south"
        self.draw_penalty: int = 0  # accumulator for stacked draw cards (we don't stack — just apply)
        self.phase: str = "playing"
        self.hand_winner: Optional[str] = None
        self.last_action: Optional[Dict[str, Any]] = None
        self.pending_wild: bool = False
        # Challenge-window state for an ad-hoc Wild Draw Four. When set,
        # the named "victim" gets one decision to either challenge the
        # play (revealing the prior player's hand to test legality) or
        # accept it (draw 4, skip turn).
        self.wild4_challenge: Optional[Dict[str, Any]] = None
        # If starter is an action, apply its initial effect
        if starter["kind"] == "action":
            if starter["value"] == "skip":
                self.turn = _step(self.turn, self.direction)
            elif starter["value"] == "reverse":
                self.direction = -self.direction
                # In 4P, reverse on first play turns to dealer's right
                self.turn = _step("south", self.direction)
            elif starter["value"] == "draw2":
                # First player draws 2 and turn passes
                victim = self.turn
                for _ in range(2):
                    drew = self._draw_one(victim)
                    if not drew:
                        break
                self.turn = _step(self.turn, self.direction)

    # ----- helpers ------------------------------------------------------

    def top(self) -> Dict[str, Any]:
        return self.discard[-1]

    def legal_for(self, pos: str) -> List[Dict[str, Any]]:
        return [c for c in self.hands[pos] if is_legal(c, self.top(), self.pending_color)]

    def _draw_one(self, pos: str) -> Optional[Dict[str, Any]]:
        if not self.draw_pile:
            self._reshuffle_discard_into_pile()
        if not self.draw_pile:
            return None
        card = self.draw_pile.pop()
        self.hands[pos].append(card)
        return card

    def _reshuffle_discard_into_pile(self) -> None:
        if len(self.discard) <= 1:
            return
        top = self.discard[-1]
        rest = self.discard[:-1]
        self.rng.shuffle(rest)
        self.draw_pile = rest
        self.discard = [top]

    def _advance_turn(self) -> None:
        self.turn = _step(self.turn, self.direction)

    def _apply_action(self, card: Dict[str, Any]) -> Dict[str, Any]:
        """After a card is placed on discard, apply its action and advance the
        turn. Return a dict describing the side-effects for the UI."""
        info: Dict[str, Any] = {}
        if card["kind"] == "action":
            if card["value"] == "skip":
                self._advance_turn()  # skip next player
                self._advance_turn()
                info["skipped"] = True
            elif card["value"] == "reverse":
                self.direction = -self.direction
                self._advance_turn()
                info["reversed"] = True
            elif card["value"] == "draw2":
                victim = _step(self.turn, self.direction)
                drawn: List[Dict[str, Any]] = []
                for _ in range(2):
                    c = self._draw_one(victim)
                    if c:
                        drawn.append(c)
                self._advance_turn()  # land on victim
                self._advance_turn()  # skip them
                info["draw2_victim"] = victim
                info["draw2_count"] = len(drawn)
        elif card["kind"] == "wild":
            if card["value"] == "wild4":
                # Don't apply the +4 immediately. Open a challenge window
                # for the next player ("victim") and pause the turn there.
                # The victim either calls the bluff (revealing prior
                # player's hand for legality) or accepts the +4 + skip.
                victim = _step(self.turn, self.direction)
                self.wild4_challenge = {
                    "challenger": victim,
                    "previous_player": self.turn,
                    # `previous_player_had_color` is the truth-flag the
                    # challenge resolves against. The pending_color
                    # captured here is the colour BEFORE the wild4 was
                    # placed (we must read it from `pending_color_pre`
                    # which was set in `play()`).
                    "previous_color": getattr(self, "pending_color_pre", self.pending_color),
                    "previous_had_color": self._player_had_color_pre_wild4,
                }
                # The turn now sits with the victim awaiting their call.
                self.turn = victim
                self.phase = "wild4_challenge"
                info["wild4_challenge_open"] = True
                info["wild4_victim"] = victim
            else:
                self._advance_turn()
        else:
            # number card
            self._advance_turn()
        return info

    # ----- mechanics ----------------------------------------------------

    def play(self, pos: str, card: Dict[str, Any], declared_color: Optional[str] = None) -> Dict[str, Any]:
        if self.phase != "playing":
            raise ValueError("Not playing phase")
        if pos != self.turn:
            raise ValueError("Not your turn")
        if self.pending_wild and pos == self.user_position:
            raise ValueError("Pick a color first")
        if not is_legal(card, self.top(), self.pending_color):
            raise ValueError("Illegal play")
        actual = next((c for c in self.hands[pos] if cards_match(c, card)), None)
        if not actual:
            raise ValueError("Card not in hand")
        # Wilds: require a color declaration (defer for the human if missing)
        if actual["kind"] == "wild" and pos == self.user_position and not declared_color:
            self.pending_wild = True
            self.last_action = {"player": pos, "card": actual, "wild_pending": True}
            return {"wild_pending": True}
        # Snapshot pre-play state for Wild +4 challenge legality.
        # If the player had ANY card matching the current pending_color
        # (other than the wild4 itself), the wild4 is considered an
        # illegal "bluff" play that the next player can challenge.
        self.pending_color_pre = self.pending_color
        if actual["kind"] == "wild" and actual["value"] == "wild4":
            self._player_had_color_pre_wild4 = any(
                c["color"] == self.pending_color for c in self.hands[pos]
                if not (c["kind"] == "wild" and c["value"] == "wild4")
            )
        else:
            self._player_had_color_pre_wild4 = False
        remove_card(self.hands[pos], actual)
        self.discard.append(actual)
        if actual["kind"] == "wild":
            color = declared_color if declared_color in COLORS else (self._ai_pick_color(pos))
            self.pending_color = color
        else:
            self.pending_color = actual["color"]
        action_info = self._apply_action(actual)
        self.last_action = {"player": pos, "card": actual, "declared": self.pending_color, **action_info}
        if not self.hands[pos]:
            self.finalize_hand(winner=pos)
            return {"hand_complete": True, "winner": pos}
        return {"hand_complete": False, "info": action_info}

    def resolve_wild4_challenge(self, pos: str, challenge: bool) -> Dict[str, Any]:
        """Victim either CHALLENGES the wild4 (revealing the previous
        player's hand to test legality) or ACCEPTS it (draw 4 + skip).
        Per official UNO: if challenged AND prior player had a legal
        colour, prior player draws 4 instead. If they didn't, the
        challenger draws 6.
        """
        if self.phase != "wild4_challenge":
            raise ValueError("No wild4 challenge open")
        if not self.wild4_challenge:
            raise ValueError("Challenge state missing")
        if pos != self.wild4_challenge["challenger"]:
            raise ValueError("Only the named victim may resolve the challenge")
        prior = self.wild4_challenge["previous_player"]
        had_color = self.wild4_challenge["previous_had_color"]
        info: Dict[str, Any] = {
            "challenger": pos,
            "previous_player": prior,
            "previous_had_color": had_color,
            "challenged": challenge,
        }
        if challenge:
            if had_color:
                # Prior player bluffed → THEY draw 4 instead of victim.
                drawn: List[Dict[str, Any]] = []
                for _ in range(4):
                    c = self._draw_one(prior)
                    if c:
                        drawn.append(c)
                info["penalty_target"] = prior
                info["penalty_count"] = len(drawn)
                info["bluff_caught"] = True
                # Turn passes to victim normally (they get to play).
                self.turn = pos
            else:
                # Wrong challenge → challenger draws 6.
                drawn = []
                for _ in range(6):
                    c = self._draw_one(pos)
                    if c:
                        drawn.append(c)
                info["penalty_target"] = pos
                info["penalty_count"] = len(drawn)
                info["bluff_caught"] = False
                # Challenger forfeits their turn.
                self.turn = _step(pos, self.direction)
        else:
            # Accept: victim draws 4 + skip.
            drawn = []
            for _ in range(4):
                c = self._draw_one(pos)
                if c:
                    drawn.append(c)
            info["penalty_target"] = pos
            info["penalty_count"] = len(drawn)
            self.turn = _step(pos, self.direction)
        self.wild4_challenge = None
        self.phase = "playing"
        self.last_action = {"resolved_wild4": info, "player": pos}
        # Win-check after possibly handing cards out
        for player_pos in POSITIONS:
            if not self.hands[player_pos]:
                self.finalize_hand(winner=player_pos)
                break
        return info

    def declare_color(self, pos: str, color: str) -> Dict[str, Any]:
        """Resolve a pending wild for the human player."""
        if not self.pending_wild:
            raise ValueError("No wild pending")
        if pos != self.user_position:
            raise ValueError("Bots auto-declare")
        if color not in COLORS:
            raise ValueError("Invalid color")
        # The card is still in the user's hand at this point — replay the
        # play with the chosen color now provided.
        card = self.last_action.get("card") if self.last_action else None
        if card is None:
            raise ValueError("No pending wild card recorded")
        self.pending_wild = False
        return self.play(pos, card, declared_color=color)

    def _ai_pick_color(self, pos: str) -> str:
        counts = {c: 0 for c in COLORS}
        for c in self.hands[pos]:
            if c["color"] in counts:
                counts[c["color"]] += 1
        return max(COLORS, key=lambda c: counts[c])

    def draw(self, pos: str) -> Dict[str, Any]:
        if self.phase != "playing":
            raise ValueError("Not playing phase")
        if pos != self.turn:
            raise ValueError("Not your turn")
        if self.pending_wild and pos == self.user_position:
            raise ValueError("Pick a color first")
        drew = self._draw_one(pos)
        if not drew:
            self._advance_turn()
            return {"drew": None, "pass": True}
        self.last_action = {"player": pos, "drew": drew}
        # House rule: drawing ends your turn (no auto-play of the drawn card)
        self._advance_turn()
        return {"drew": drew, "pass": False}

    def finalize_hand(self, winner: str) -> None:
        bonus = 0
        for p in POSITIONS:
            if p == winner:
                continue
            bonus += hand_score(self.hands[p])
        self.scores[winner] += bonus
        self.hand_winner = winner
        self.phase = "scoring"
        if self.scores[winner] >= MATCH_TARGET:
            self.match_winner = winner
            self.phase = "finished"

    def begin_next_hand(self) -> None:
        if self.phase != "scoring":
            raise ValueError("Round not finished")
        self.start_new_hand()

    # ----- AI -----------------------------------------------------------

    def bot_act(self) -> Dict[str, Any]:
        # Wild4-challenge phase: bot must accept or challenge
        if self.phase == "wild4_challenge":
            return self._bot_resolve_wild4()
        actor = self.turn
        legal = self.legal_for(actor)
        if not legal:
            res = self.draw(actor)
            return {"player": actor, "drew": res.get("drew"), "passed": res.get("pass", False)}
        # Bots respect the official Wild4 rule: only play wild4 if they
        # have NO card matching pending_color.
        non_wild4_legal = [c for c in legal if not (c["kind"] == "wild" and c["value"] == "wild4")]
        has_color_card = any(c["color"] == self.pending_color for c in self.hands[actor])
        # If a non-wild4 alternative exists, prefer it.
        pool_options = non_wild4_legal if non_wild4_legal else legal
        # Among the pool, prefer non-wild plays first; among non-wild, dump high-value action cards
        non_wild = [c for c in pool_options if c["kind"] != "wild"]
        candidate_pool = non_wild if non_wild else pool_options
        choice = max(candidate_pool, key=card_value)
        # If the chosen card is a wild4 but the bot still holds the
        # pending color, swap to a plain wild if available.
        if choice["kind"] == "wild" and choice["value"] == "wild4" and has_color_card:
            plain_wild = next((c for c in legal if c["kind"] == "wild" and c["value"] == "wild"), None)
            if plain_wild is not None:
                choice = plain_wild
        declared: Optional[str] = None
        if choice["kind"] == "wild":
            declared = self._ai_pick_color(actor)
        result = self.play(actor, choice, declared_color=declared)
        return {
            "player": actor,
            "card": choice,
            "declared": declared,
            "info": result.get("info", {}),
            "hand_complete": result.get("hand_complete", False),
            "winner": result.get("winner"),
        }

    def _bot_resolve_wild4(self) -> Dict[str, Any]:
        """Bot decides to challenge or accept. Heuristic: challenge if
        the bot still holds many cards of pending_color (meaning it's
        likely the prior player did too)."""
        chal_pos = self.wild4_challenge["challenger"] if self.wild4_challenge else self.turn
        # Count how many cards of pending_color the bot itself has —
        # rough proxy for "how dense is this colour in the deck."
        same_color = sum(1 for c in self.hands[chal_pos] if c["color"] == self.pending_color_pre)
        challenge = same_color >= 3  # heuristic
        info = self.resolve_wild4_challenge(chal_pos, challenge)
        return {"player": chal_pos, "wild4_resolution": info}

    def run_bots(self, max_steps: int = 16) -> List[Dict[str, Any]]:
        steps: List[Dict[str, Any]] = []
        for _ in range(max_steps):
            if self.phase not in ("playing", "wild4_challenge"):
                break
            if self.turn == self.user_position:
                break
            if self.pending_wild:
                break
            steps.append(self.bot_act())
            if self.phase not in ("playing", "wild4_challenge"):
                break
        return steps

    # ----- view ---------------------------------------------------------

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
            "direction": self.direction,
            "top_card": self.top(),
            "pending_color": self.pending_color,
            "draw_pile_count": len(self.draw_pile),
            "your_hand": self.hands[self.user_position],
            "playable_cards": self.legal_for(self.user_position) if self.phase == "playing" else [],
            "scores": self.scores,
            "players_data": players_data,
            "hand_winner": self.hand_winner,
            "match_winner": self.match_winner,
            "pending_wild": self.pending_wild,
            "wild4_challenge_open": self.wild4_challenge is not None and self.wild4_challenge.get("challenger") == self.user_position,
            "wild4_challenge": self.wild4_challenge,
            "last_action": self.last_action,
        }

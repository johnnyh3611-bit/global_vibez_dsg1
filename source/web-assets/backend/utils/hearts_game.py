"""
Hearts — pure-Python rule engine for the 4-player classic.

Standard ruleset:
  • 52-card deck (no jokers); 13 cards per player.
  • Pass phase rotates per hand: left → right → across → no-pass → left …
    On a pass hand, every player simultaneously selects 3 cards to send.
  • Player holding 2♣ leads the FIRST trick of the hand and MUST lead 2♣.
  • Must follow suit. If unable, may play any card EXCEPT during the first
    trick where hearts and Q♠ are blocked unless that's all you have.
  • Hearts cannot be LED until they have been "broken" (a heart played on
    a trick where the player could not follow suit, or Q♠ played).
  • Each heart = 1 penalty point. Q♠ = 13 penalty points. 26 per hand.
  • Shooting the Moon: if a single player takes ALL 26 penalty points in
    a hand, they score 0 and every OTHER player scores 26 instead.
  • First player to ≥100 points loses; lowest score at that moment wins.
"""
from __future__ import annotations
from typing import List, Dict, Any, Optional, Tuple
import secrets

POSITIONS = ["north", "east", "south", "west"]
SUITS = ["clubs", "diamonds", "spades", "hearts"]
RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]
RANK_VALUES = {r: i + 2 for i, r in enumerate(RANKS)}  # 2 → 2 … A → 14

PASS_DIRECTIONS = ["left", "right", "across", "none"]
GAME_OVER_THRESHOLD = 100


def _next_pos(pos: str, step: int = 1) -> str:
    return POSITIONS[(POSITIONS.index(pos) + step) % 4]


def pass_target(direction: str, sender: str) -> Optional[str]:
    """Where the 3-card packet a player passes is delivered."""
    if direction == "left":   return _next_pos(sender, 1)
    if direction == "across": return _next_pos(sender, 2)
    if direction == "right":  return _next_pos(sender, 3)
    return None  # no pass


def make_card(suit: str, rank: str) -> Dict[str, Any]:
    return {"suit": suit, "rank": rank, "value": RANK_VALUES[rank]}


def make_deck() -> List[Dict[str, Any]]:
    return [make_card(s, r) for s in SUITS for r in RANKS]


def deal_hands(rng: secrets.SystemRandom) -> Dict[str, List[Dict[str, Any]]]:
    deck = make_deck()
    rng.shuffle(deck)
    hands: Dict[str, List[Dict[str, Any]]] = {}
    for i, pos in enumerate(POSITIONS):
        hands[pos] = sorted(
            deck[i * 13 : (i + 1) * 13],
            key=lambda c: (SUITS.index(c["suit"]), c["value"]),
        )
    return hands


def find_two_of_clubs_holder(hands: Dict[str, List[Dict[str, Any]]]) -> str:
    for pos, hand in hands.items():
        for c in hand:
            if c["suit"] == "clubs" and c["rank"] == "2":
                return pos
    raise RuntimeError("2♣ missing from deck")


def card_points(card: Dict[str, Any]) -> int:
    if card["suit"] == "hearts":
        return 1
    if card["suit"] == "spades" and card["rank"] == "Q":
        return 13
    return 0


def trick_points(trick: List[Dict[str, Any]]) -> int:
    return sum(card_points(t["card"]) for t in trick)


def determine_trick_winner(trick: List[Dict[str, Any]], led_suit: str) -> str:
    """Return position that won the trick. Highest card of led suit wins."""
    best_player, best_value = trick[0]["player"], -1
    for play in trick:
        if play["card"]["suit"] != led_suit:
            continue
        if play["card"]["value"] > best_value:
            best_value = play["card"]["value"]
            best_player = play["player"]
    return best_player


def cards_match(a: Dict[str, Any], b: Dict[str, Any]) -> bool:
    return a["suit"] == b["suit"] and a["rank"] == b["rank"]


def remove_card(hand: List[Dict[str, Any]], card: Dict[str, Any]) -> bool:
    for i, c in enumerate(hand):
        if cards_match(c, card):
            hand.pop(i)
            return True
    return False


def has_only_hearts_and_qs(hand: List[Dict[str, Any]]) -> bool:
    return all(card_points(c) > 0 for c in hand)


def has_suit(hand: List[Dict[str, Any]], suit: str) -> bool:
    return any(c["suit"] == suit for c in hand)


def is_first_trick_dirty(card: Dict[str, Any]) -> bool:
    return card_points(card) > 0


def valid_plays(
    hand: List[Dict[str, Any]],
    led_suit: Optional[str],
    is_first_trick: bool,
    hearts_broken: bool,
) -> List[Dict[str, Any]]:
    """Return the subset of `hand` legal to play under current state."""
    # Leading the first trick of the round must be 2♣
    if led_suit is None and is_first_trick:
        return [c for c in hand if c["suit"] == "clubs" and c["rank"] == "2"]

    # If following — must follow led suit if possible
    if led_suit is not None:
        if has_suit(hand, led_suit):
            options = [c for c in hand if c["suit"] == led_suit]
        else:
            options = list(hand)
        if is_first_trick:
            clean = [c for c in options if not is_first_trick_dirty(c)]
            return clean if clean else options
        return options

    # Leading later tricks
    if hearts_broken or all(c["suit"] == "hearts" for c in hand):
        return list(hand)
    return [c for c in hand if c["suit"] != "hearts"]


def apply_round_score(round_pts: Dict[str, int]) -> Dict[str, int]:
    """If anyone shot the moon (took all 26), invert the scoring."""
    moon = next((p for p, v in round_pts.items() if v == 26), None)
    if moon is None:
        return dict(round_pts)
    return {p: (0 if p == moon else 26) for p in POSITIONS}


def loser_of_match(scores: Dict[str, int]) -> Optional[str]:
    """If anyone has crossed the loss threshold, return the winner (lowest)."""
    if any(s >= GAME_OVER_THRESHOLD for s in scores.values()):
        return min(POSITIONS, key=lambda p: scores[p])
    return None


# ── AI helpers ──────────────────────────────────────────────────────────

def ai_select_pass(hand: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Pick 3 cards to pass: dump high spades + Q♠ first, then high hearts."""
    candidates = sorted(
        hand,
        key=lambda c: (
            0 if c["suit"] == "spades" and c["value"] >= 12 else 1,  # Q/K/A♠ first
            0 if c["suit"] == "hearts" and c["value"] >= 11 else 1,  # then high hearts
            -c["value"],                                              # otherwise high cards
            SUITS.index(c["suit"]),
        ),
    )
    return candidates[:3]


def ai_select_play(
    hand: List[Dict[str, Any]],
    legal: List[Dict[str, Any]],
    led_suit: Optional[str],
    trick_so_far: List[Dict[str, Any]],
    hearts_broken: bool,
) -> Dict[str, Any]:
    """Light-touch heuristic: dump high penalty cards when safe, else slough low."""
    if not legal:
        raise ValueError("No legal play")

    # If led: try to win the trick with the lowest-still-winning card if no
    # penalties on the table yet, else lose with the highest-value-without-winning.
    if led_suit is not None:
        on_table_pts = sum(card_points(t["card"]) for t in trick_so_far)
        same_suit = [c for c in legal if c["suit"] == led_suit]
        if same_suit:
            highest_on_table = max(
                (t["card"]["value"] for t in trick_so_far if t["card"]["suit"] == led_suit),
                default=0,
            )
            losers = [c for c in same_suit if c["value"] < highest_on_table]
            if on_table_pts > 0 and losers:
                return max(losers, key=lambda c: c["value"])
            if on_table_pts == 0:
                # Try to take but cheaply
                return min(same_suit, key=lambda c: c["value"])
            return min(same_suit, key=lambda c: c["value"])

        # Off-suit dump — Q♠ first if safe to do so, else high hearts
        qspade = [c for c in legal if c["suit"] == "spades" and c["rank"] == "Q"]
        if qspade:
            return qspade[0]
        hearts = [c for c in legal if c["suit"] == "hearts"]
        if hearts:
            return max(hearts, key=lambda c: c["value"])
        return max(legal, key=lambda c: c["value"])

    # We're leading — play low non-heart if possible
    non_hearts = [c for c in legal if c["suit"] != "hearts"]
    pool = non_hearts if non_hearts else legal
    return min(pool, key=lambda c: c["value"])


# ── HeartsGame primary state holder ─────────────────────────────────────


class HeartsGame:
    """All in-memory state for a single 4-player Hearts match."""

    def __init__(self, user_position: str = "south"):
        self.rng = secrets.SystemRandom()
        self.user_position = user_position
        self.scores: Dict[str, int] = {p: 0 for p in POSITIONS}
        self.hands_played = 0
        self.match_winner: Optional[str] = None
        self.start_new_hand()

    # ----- per-hand setup -----------------------------------------------

    def start_new_hand(self) -> None:
        self.hands: Dict[str, List[Dict[str, Any]]] = deal_hands(self.rng)
        self.round_points: Dict[str, int] = {p: 0 for p in POSITIONS}
        self.tricks_won: Dict[str, int] = {p: 0 for p in POSITIONS}
        self.current_trick: List[Dict[str, Any]] = []
        self.led_suit: Optional[str] = None
        self.hearts_broken = False
        self.tricks_played = 0
        self.is_first_trick = True

        self.pass_direction = PASS_DIRECTIONS[self.hands_played % 4]
        if self.pass_direction == "none":
            self.phase = "playing"
            self.pass_packets: Dict[str, List[Dict[str, Any]]] = {}
            self.pending_human_pass = False
            self.turn = find_two_of_clubs_holder(self.hands)
        else:
            self.phase = "passing"
            self.pass_packets = {}
            self.pending_human_pass = True
            self.turn = self.user_position  # placeholder until passing resolves

    # ----- passing phase -------------------------------------------------

    def submit_pass(self, sender: str, cards: List[Dict[str, Any]]) -> None:
        if self.phase != "passing":
            raise ValueError("Not in passing phase")
        if sender in self.pass_packets:
            raise ValueError("Already passed")
        if len(cards) != 3:
            raise ValueError("Must pass exactly 3 cards")
        hand = self.hands[sender]
        chosen = []
        for c in cards:
            match = next((h for h in hand if cards_match(h, c)), None)
            if not match:
                raise ValueError(f"Card not in hand: {c}")
            chosen.append(match)
        # Remove now (we'll deliver after all 4 packets are in)
        for c in chosen:
            remove_card(hand, c)
        self.pass_packets[sender] = chosen

    def all_bots_pass(self) -> None:
        for pos in POSITIONS:
            if pos == self.user_position or pos in self.pass_packets:
                continue
            self.submit_pass(pos, ai_select_pass(self.hands[pos]))

    def resolve_passes(self) -> None:
        if len(self.pass_packets) != 4:
            raise ValueError("Not all packets received")
        for sender in POSITIONS:
            target = pass_target(self.pass_direction, sender)
            if target is None:
                continue
            self.hands[target].extend(self.pass_packets[sender])
        for pos in POSITIONS:
            self.hands[pos].sort(key=lambda c: (SUITS.index(c["suit"]), c["value"]))
        self.pass_packets = {}
        self.pending_human_pass = False
        self.phase = "playing"
        self.turn = find_two_of_clubs_holder(self.hands)

    # ----- playing phase -------------------------------------------------

    def legal_plays_for(self, pos: str) -> List[Dict[str, Any]]:
        return valid_plays(
            self.hands[pos],
            self.led_suit,
            self.is_first_trick,
            self.hearts_broken,
        )

    def play_card(self, pos: str, card: Dict[str, Any]) -> Dict[str, Any]:
        if self.phase != "playing":
            raise ValueError("Not in playing phase")
        if pos != self.turn:
            raise ValueError(f"Not {pos}'s turn")
        legal = self.legal_plays_for(pos)
        if not any(cards_match(card, c) for c in legal):
            raise ValueError("Illegal play")

        actual = next(c for c in self.hands[pos] if cards_match(c, card))
        remove_card(self.hands[pos], actual)

        if not self.current_trick:
            self.led_suit = actual["suit"]
        self.current_trick.append({"player": pos, "card": actual})

        if actual["suit"] == "hearts" or (
            actual["suit"] == "spades" and actual["rank"] == "Q"
        ):
            self.hearts_broken = True

        result = {"trick_complete": False, "trick_winner": None, "round_complete": False}

        if len(self.current_trick) == 4:
            winner = determine_trick_winner(self.current_trick, self.led_suit)
            pts = trick_points(self.current_trick)
            self.round_points[winner] += pts
            self.tricks_won[winner] += 1
            self.tricks_played += 1
            self.is_first_trick = False
            result["trick_complete"] = True
            result["trick_winner"] = winner
            result["trick_points"] = pts
            self.current_trick = []
            self.led_suit = None

            if self.tricks_played == 13:
                self.finalize_round()
                result["round_complete"] = True
            else:
                self.turn = winner
        else:
            self.turn = _next_pos(self.turn)

        return result

    def finalize_round(self) -> None:
        adjusted = apply_round_score(self.round_points)
        for p in POSITIONS:
            self.scores[p] += adjusted[p]
        self.last_round_breakdown = {
            "raw": dict(self.round_points),
            "scored": adjusted,
            "shot_moon": next((p for p, v in self.round_points.items() if v == 26), None),
        }
        self.match_winner = loser_of_match(self.scores)
        self.phase = "scoring" if self.match_winner is None else "finished"
        self.hands_played += 1

    def begin_next_hand(self) -> None:
        if self.phase != "scoring":
            raise ValueError("Cannot begin next hand right now")
        self.start_new_hand()

    # ----- bot run loop --------------------------------------------------

    def play_bot_turns(self, max_steps: int = 60) -> List[Dict[str, Any]]:
        """Run until it's the user's turn or the round/match ends."""
        steps: List[Dict[str, Any]] = []
        for _ in range(max_steps):
            if self.phase != "playing":
                break
            if self.turn == self.user_position:
                break
            legal = self.legal_plays_for(self.turn)
            choice = ai_select_play(
                self.hands[self.turn],
                legal,
                self.led_suit,
                self.current_trick,
                self.hearts_broken,
            )
            position = self.turn
            res = self.play_card(self.turn, choice)
            steps.append({
                "player": position,
                "card": choice,
                "trick_winner": res.get("trick_winner"),
                "trick_complete": res.get("trick_complete", False),
                "round_complete": res.get("round_complete", False),
            })
            if res.get("round_complete"):
                break
        return steps

    # ----- view ----------------------------------------------------------

    def to_view(self) -> Dict[str, Any]:
        players_data = {
            pos: {
                "card_count": len(self.hands[pos]),
                "round_points": self.round_points[pos],
                "tricks_won": self.tricks_won[pos],
                "total_score": self.scores[pos],
                "passed": pos in self.pass_packets,
            }
            for pos in POSITIONS
        }
        return {
            "user_position": self.user_position,
            "phase": self.phase,
            "turn": self.turn,
            "hands_played": self.hands_played,
            "pass_direction": self.pass_direction,
            "hearts_broken": self.hearts_broken,
            "is_first_trick": self.is_first_trick,
            "tricks_played": self.tricks_played,
            "current_trick": self.current_trick,
            "led_suit": self.led_suit,
            "scores": self.scores,
            "round_points": self.round_points,
            "tricks_won": self.tricks_won,
            "players_data": players_data,
            "match_winner": self.match_winner,
            "your_hand": self.hands[self.user_position],
            "playable_cards": self.legal_plays_for(self.user_position)
            if self.phase == "playing"
            else [],
            "pending_human_pass": self.pending_human_pass,
            "last_round_breakdown": getattr(self, "last_round_breakdown", None),
        }

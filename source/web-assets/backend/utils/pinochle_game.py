"""
Pinochle — pure-Python rule engine for the 4-player partnership classic.

Standard ruleset (4P partnership, no-passing variant):
  • 48-card double-deck: 2 copies of 9 / J / Q / K / 10 / A in each suit.
  • Partners: north + south vs east + west.
  • Deal 12 each (no kitty in 4P partnership).
  • BIDDING: starting at 250, increments of 10. Highest bidder names
    trump. Each player passes once.
  • MELD PHASE: every player auto-detects their melds and adds points
    for their team:
      Run / Around: A-10-K-Q-J of trump = 150 (300 if double)
      Royal Marriages: K + Q of trump   = 40
      Common Marriages: K + Q same suit = 20
      Aces around (1 ace in each suit)  = 100 (1000 if double)
      Kings around                       = 80 (600 if double)
      Queens around                      = 60 (480 if double)
      Jacks around                       = 40 (400 if double)
      Pinochle (J♦ + Q♠)                = 40 (300 if double)
      Dix (9 of trump)                  = 10 each
  • TRICK PHASE: 12 tricks. Special rank order in trick play:
        A > 10 > K > Q > J > 9   (10 ranks above K!)
    Must follow suit AND, if possible, must beat the highest played
    card of that suit. If can't follow, must trump if possible.
  • COUNTER POINTS in tricks:
        A = 11, 10 = 10, K = 4, Q = 3, J = 2, 9 = 0
    Last trick winner gets +10 ("last").
    Total trick points = 250.
  • Bidding team must hit their bid (meld + tricks). If short, they
    are "set" — bid amount subtracted from their score.
  • First team to 1500 wins.
"""
from __future__ import annotations
from typing import List, Dict, Any, Optional
import secrets

POSITIONS = ["north", "east", "south", "west"]
PARTNER = {"north": "south", "south": "north", "east": "west", "west": "east"}
TEAMS = {"north": "team1", "south": "team1", "east": "team2", "west": "team2"}
SUITS = ["clubs", "diamonds", "spades", "hearts"]
SUIT_COLOR = {"clubs": "black", "spades": "black", "hearts": "red", "diamonds": "red"}
RANKS = ["9", "J", "Q", "K", "10", "A"]
RANK_VALUE = {"9": 0, "J": 2, "Q": 3, "K": 4, "10": 10, "A": 11}
RANK_ORDER = {"9": 0, "J": 1, "Q": 2, "K": 3, "10": 4, "A": 5}

HAND_SIZE = 12
HAND_SIZE_DOUBLE = 20  # double-deck Pinochle (no 9s, 4 copies of each card)
BID_MIN = 250
BID_MIN_DOUBLE = 500
BID_INCREMENT = 10
MATCH_TARGET = 1500
MATCH_TARGET_DOUBLE = 5000
LAST_TRICK_BONUS = 10


def make_card(suit: str, rank: str, copy_id: int = 0) -> Dict[str, Any]:
    return {"suit": suit, "rank": rank, "value": RANK_ORDER[rank], "copy": copy_id}


def make_deck(mode: str = "single") -> List[Dict[str, Any]]:
    """Build a Pinochle deck.

    mode="single": 48 cards = 2 copies × 4 suits × 6 ranks (9,J,Q,K,10,A).
    mode="double": 80 cards = 4 copies × 4 suits × 5 ranks (no 9s).
    """
    deck: List[Dict[str, Any]] = []
    if mode == "double":
        ranks_in_deck = ["J", "Q", "K", "10", "A"]
        copies = 4
    else:
        ranks_in_deck = RANKS
        copies = 2
    for s in SUITS:
        for r in ranks_in_deck:
            for cid in range(copies):
                deck.append(make_card(s, r, cid))
    return deck


def cards_match(a: Dict[str, Any], b: Dict[str, Any]) -> bool:
    return a["suit"] == b["suit"] and a["rank"] == b["rank"] and a.get("copy", 0) == b.get("copy", 0)


def remove_card(hand: List[Dict[str, Any]], card: Dict[str, Any]) -> bool:
    for i, c in enumerate(hand):
        if cards_match(c, card):
            hand.pop(i)
            return True
    return False


def card_counter_points(card: Dict[str, Any]) -> int:
    return RANK_VALUE[card["rank"]]


def trick_winner(trick: List[Dict[str, Any]], trump: str, led: str) -> str:
    """Highest trump if any played; else highest of led suit."""
    best_player = trick[0]["player"]
    best_strength = -1
    for play in trick:
        c = play["card"]
        if c["suit"] == trump:
            s = 100 + RANK_ORDER[c["rank"]] + 0.01 * play.get("order", 0)
        elif c["suit"] == led:
            s = RANK_ORDER[c["rank"]] + 0.01 * play.get("order", 0)
        else:
            continue
        if s > best_strength:
            best_strength = s
            best_player = play["player"]
    return best_player


# ── meld detection ─────────────────────────────────────────────────────


def detect_melds(hand: List[Dict[str, Any]], trump: str) -> Dict[str, Any]:
    """Auto-score every meld in `hand`. Returns {melds: [...], total: int}."""
    found: List[Dict[str, Any]] = []

    def has(rank: str, suit: str, copy: int) -> bool:
        return any(c["rank"] == rank and c["suit"] == suit and c["copy"] == copy for c in hand)

    def count(rank: str, suit: str) -> int:
        return sum(1 for c in hand if c["rank"] == rank and c["suit"] == suit)

    # Run / Around in trump: A-10-K-Q-J of trump
    run_ranks = ["A", "10", "K", "Q", "J"]
    run_copies = [count(r, trump) for r in run_ranks]
    n_runs = min(run_copies)
    if n_runs >= 2:
        found.append({"name": "Double Run", "points": 1500, "trump": trump})
    elif n_runs == 1:
        found.append({"name": "Run", "points": 150, "trump": trump})

    # Royal Marriages (K+Q of trump) — only counts beyond what's used in run
    used_kq = n_runs  # the run used n_runs copies of K + Q
    rm_extra = min(count("K", trump), count("Q", trump)) - used_kq
    for _ in range(max(rm_extra, 0)):
        found.append({"name": "Royal Marriage", "points": 40, "trump": trump})

    # Common Marriages (K+Q same suit, non-trump)
    for s in SUITS:
        if s == trump:
            continue
        cm = min(count("K", s), count("Q", s))
        for _ in range(cm):
            found.append({"name": "Marriage", "points": 20, "suit": s})

    # Arounds — one of <rank> in each of the 4 suits
    for rank, base, double, label in [
        ("A", 100, 1000, "Aces Around"),
        ("K", 80, 600, "Kings Around"),
        ("Q", 60, 480, "Queens Around"),
        ("J", 40, 400, "Jacks Around"),
    ]:
        per_suit = [count(rank, s) for s in SUITS]
        n = min(per_suit)
        if n >= 2:
            found.append({"name": f"Double {label}", "points": double})
        elif n == 1:
            found.append({"name": label, "points": base})

    # Pinochle: J♦ + Q♠
    j_diamond = count("J", "diamonds")
    q_spade = count("Q", "spades")
    pinochles = min(j_diamond, q_spade)
    if pinochles >= 2:
        found.append({"name": "Double Pinochle", "points": 300})
    elif pinochles == 1:
        found.append({"name": "Pinochle", "points": 40})

    # Dix (9 of trump): 10 each
    nines_trump = count("9", trump)
    for _ in range(nines_trump):
        found.append({"name": "Dix (9 of trump)", "points": 10})

    total = sum(m["points"] for m in found)
    return {"melds": found, "total": total}


# ── valid plays ────────────────────────────────────────────────────────


def valid_plays(
    hand: List[Dict[str, Any]],
    trick: List[Dict[str, Any]],
    trump: str,
    led: Optional[str],
) -> List[Dict[str, Any]]:
    """Pinochle is strict: must follow suit + beat current high if possible.
    If can't follow led suit, must play trump if any. Else play any."""
    if led is None:
        return list(hand)

    in_led = [c for c in hand if c["suit"] == led]
    if in_led:
        # Must follow led suit. Among same-suit, must beat highest of led
        # currently winning the trick (if it's still led, not over-trumped).
        highest_led = max(
            (RANK_ORDER[p["card"]["rank"]] for p in trick if p["card"]["suit"] == led),
            default=-1,
        )
        # Are any trumps already in trick? If yes, the led-suit cards
        # are no longer winning, so beat-rule doesn't apply.
        any_trumps = any(p["card"]["suit"] == trump for p in trick)
        if not any_trumps:
            higher = [c for c in in_led if RANK_ORDER[c["rank"]] > highest_led]
            return higher if higher else in_led
        return in_led

    in_trump = [c for c in hand if c["suit"] == trump]
    if in_trump:
        # Must trump. Among trumps, must over-trump if possible.
        highest_trump_in_trick = max(
            (RANK_ORDER[p["card"]["rank"]] for p in trick if p["card"]["suit"] == trump),
            default=-1,
        )
        higher = [c for c in in_trump if RANK_ORDER[c["rank"]] > highest_trump_in_trick]
        return higher if higher else in_trump

    return list(hand)


# ── PinochleGame ───────────────────────────────────────────────────────


class PinochleGame:
    def __init__(self, user_position: str = "south", mode: str = "single"):
        self.rng = secrets.SystemRandom()
        self.user_position = user_position
        self.mode = mode if mode in ("single", "double") else "single"
        # Resolve mode-specific tunables. Stored as instance attrs so
        # all the existing references keep working but now read the
        # right value for the mode.
        if self.mode == "double":
            self.hand_size = HAND_SIZE_DOUBLE
            self.bid_min = BID_MIN_DOUBLE
            self.match_target = MATCH_TARGET_DOUBLE
        else:
            self.hand_size = HAND_SIZE
            self.bid_min = BID_MIN
            self.match_target = MATCH_TARGET
        self.dealer = "west"
        self.scores: Dict[str, int] = {"team1": 0, "team2": 0}
        self.match_winner: Optional[str] = None
        self.start_new_hand()

    # ----- per-hand setup -----------------------------------------------

    def start_new_hand(self) -> None:
        deck = make_deck(self.mode)
        self.rng.shuffle(deck)
        self.hands: Dict[str, List[Dict[str, Any]]] = {
            pos: sorted([deck.pop() for _ in range(self.hand_size)],
                        key=lambda c: (SUITS.index(c["suit"]), RANK_ORDER[c["rank"]], c["copy"]))
            for pos in POSITIONS
        }
        self.dealer = POSITIONS[(POSITIONS.index(self.dealer) + 1) % 4]
        self.bid_starter = POSITIONS[(POSITIONS.index(self.dealer) + 1) % 4]
        self.bid_turn = self.bid_starter
        self.high_bid = 0
        self.high_bidder: Optional[str] = None
        self.passed: List[str] = []
        self.trump: Optional[str] = None
        self.calling_team: Optional[str] = None
        self.melds: Dict[str, Dict[str, Any]] = {}
        self.team_meld: Dict[str, int] = {"team1": 0, "team2": 0}
        self.team_trick: Dict[str, int] = {"team1": 0, "team2": 0}
        self.tricks_played = 0
        self.current_trick: List[Dict[str, Any]] = []
        self.led_suit: Optional[str] = None
        self.tricks_won: Dict[str, int] = {p: 0 for p in POSITIONS}
        self.turn = self.bid_starter
        self.phase = "bidding"  # bidding → naming_trump → meld → playing → scoring → finished
        self.last_action: Optional[Dict[str, Any]] = None
        self.hand_summary: Optional[Dict[str, Any]] = None

    # ----- bidding -------------------------------------------------------

    def place_bid(self, pos: str, amount: int) -> None:
        if self.phase != "bidding":
            raise ValueError("Not bidding phase")
        if pos != self.bid_turn:
            raise ValueError("Not your turn to bid")
        if pos in self.passed:
            raise ValueError("Already passed")
        if amount < max(self.bid_min, self.high_bid + BID_INCREMENT):
            raise ValueError(f"Bid must be ≥ {max(self.bid_min, self.high_bid + BID_INCREMENT)}")
        if amount % BID_INCREMENT != 0:
            raise ValueError(f"Bid must be a multiple of {BID_INCREMENT}")
        self.high_bid = amount
        self.high_bidder = pos
        self.last_action = {"player": pos, "action": "bid", "amount": amount}
        self._advance_bid_turn()

    def pass_bid(self, pos: str) -> None:
        if self.phase != "bidding":
            raise ValueError("Not bidding phase")
        if pos != self.bid_turn:
            raise ValueError("Not your turn to bid")
        if pos in self.passed:
            raise ValueError("Already passed")
        self.passed.append(pos)
        self.last_action = {"player": pos, "action": "passed"}
        self._advance_bid_turn()

    def _advance_bid_turn(self) -> None:
        # Bidding ends when 3 of 4 have passed
        if len(self.passed) == 3 and self.high_bidder:
            self.phase = "naming_trump"
            self.turn = self.high_bidder
            return
        # If 4 passed (no bids at all) — re-deal
        if len(self.passed) >= 4 and not self.high_bidder:
            self.start_new_hand()
            return
        # Move to the next non-passed player
        for _ in range(4):
            self.bid_turn = POSITIONS[(POSITIONS.index(self.bid_turn) + 1) % 4]
            if self.bid_turn not in self.passed:
                return

    def name_trump(self, pos: str, suit: str) -> None:
        if self.phase != "naming_trump":
            raise ValueError("Not naming trump phase")
        if pos != self.high_bidder:
            raise ValueError("Only the high bidder names trump")
        if suit not in SUITS:
            raise ValueError("Invalid suit")
        self.trump = suit
        self.calling_team = TEAMS[pos]
        self.last_action = {"player": pos, "action": "named_trump", "trump": suit}
        self._compute_melds()

    def _compute_melds(self) -> None:
        self.melds = {}
        team_totals = {"team1": 0, "team2": 0}
        for p in POSITIONS:
            self.melds[p] = detect_melds(self.hands[p], self.trump or "")
            team_totals[TEAMS[p]] += self.melds[p]["total"]
        self.team_meld = team_totals
        self.phase = "playing"
        self.turn = POSITIONS[(POSITIONS.index(self.dealer) + 1) % 4]

    # ----- trick play ---------------------------------------------------

    def legal_for(self, pos: str) -> List[Dict[str, Any]]:
        if self.phase != "playing":
            return []
        return valid_plays(self.hands[pos], self.current_trick, self.trump or "", self.led_suit)

    def play(self, pos: str, card: Dict[str, Any]) -> Dict[str, Any]:
        if self.phase != "playing":
            raise ValueError("Not playing phase")
        if pos != self.turn:
            raise ValueError("Not your turn")
        legal = self.legal_for(pos)
        if not any(cards_match(card, c) for c in legal):
            raise ValueError("Illegal play (Pinochle: must follow + beat / must trump)")
        actual = next(c for c in self.hands[pos] if cards_match(c, card))
        remove_card(self.hands[pos], actual)
        if not self.current_trick:
            self.led_suit = actual["suit"]
        self.current_trick.append({"player": pos, "card": actual, "order": len(self.current_trick)})
        result: Dict[str, Any] = {"trick_complete": False, "trick_winner": None}
        if len(self.current_trick) == 4:
            winner = trick_winner(self.current_trick, self.trump or "", self.led_suit or "")
            counters = sum(card_counter_points(p["card"]) for p in self.current_trick)
            self.team_trick[TEAMS[winner]] += counters
            self.tricks_won[winner] += 1
            self.tricks_played += 1
            result["trick_complete"] = True
            result["trick_winner"] = winner
            result["counters"] = counters
            self.current_trick = []
            self.led_suit = None
            if self.tricks_played == self.hand_size:
                # Last trick bonus
                self.team_trick[TEAMS[winner]] += LAST_TRICK_BONUS
                self._finalise_hand()
                result["round_complete"] = True
            else:
                self.turn = winner
        else:
            self.turn = POSITIONS[(POSITIONS.index(pos) + 1) % 4]
        return result

    def _finalise_hand(self) -> None:
        caller = self.calling_team or "team1"
        defender = "team1" if caller == "team2" else "team2"
        caller_total = self.team_meld[caller] + self.team_trick[caller]
        defender_total = self.team_meld[defender] + self.team_trick[defender]
        outcome = "made" if caller_total >= self.high_bid else "set"
        if outcome == "made":
            self.scores[caller] += caller_total
        else:
            self.scores[caller] -= self.high_bid
        # Defenders always score their total
        self.scores[defender] += defender_total
        self.hand_summary = {
            "bidder": self.high_bidder,
            "caller": caller,
            "high_bid": self.high_bid,
            "caller_meld": self.team_meld[caller],
            "caller_trick": self.team_trick[caller],
            "defender_meld": self.team_meld[defender],
            "defender_trick": self.team_trick[defender],
            "outcome": outcome,
            "scores": dict(self.scores),
        }
        if max(self.scores.values()) >= self.match_target:
            self.match_winner = max(self.scores, key=lambda k: self.scores[k])
            self.phase = "finished"
        else:
            self.phase = "scoring"

    def begin_next_hand(self) -> None:
        if self.phase != "scoring":
            raise ValueError("Round not finished")
        self.start_new_hand()

    # ----- AI -----------------------------------------------------------

    def _bot_estimate_meld(self, pos: str) -> int:
        # Try every suit; take the best meld total
        return max(detect_melds(self.hands[pos], s)["total"] for s in SUITS)

    def bot_bid(self) -> Dict[str, Any]:
        actor = self.bid_turn
        # Estimate hand strength: best meld + 60% of A/10 trick potential
        meld = self._bot_estimate_meld(actor)
        a_count = sum(1 for c in self.hands[actor] if c["rank"] == "A")
        ten_count = sum(1 for c in self.hands[actor] if c["rank"] == "10")
        trick_est = a_count * 9 + ten_count * 6  # rough
        hand_value = meld + trick_est
        threshold = max(self.bid_min, self.high_bid + BID_INCREMENT)
        if hand_value >= threshold + 30:
            self.place_bid(actor, threshold)
            return {"player": actor, "action": "bid", "amount": threshold}
        self.pass_bid(actor)
        return {"player": actor, "action": "passed"}

    def bot_name_trump(self) -> Dict[str, Any]:
        actor = self.high_bidder
        if not actor:
            return {}
        best = max(SUITS, key=lambda s: detect_melds(self.hands[actor], s)["total"])
        self.name_trump(actor, best)
        return {"player": actor, "action": "named_trump", "trump": best}

    def bot_play(self) -> Dict[str, Any]:
        actor = self.turn
        legal = self.legal_for(actor)
        # Lead high A's; otherwise win-cheap or dump-low
        if not self.current_trick:
            choice = max(legal, key=lambda c: card_counter_points(c))
        else:
            best_in_trick = max(
                (RANK_ORDER[p["card"]["rank"]] for p in self.current_trick
                 if p["card"]["suit"] in (self.led_suit, self.trump)),
                default=-1,
            )
            winners = [c for c in legal
                       if (c["suit"] == self.trump and not any(p["card"]["suit"] == self.trump for p in self.current_trick))
                       or RANK_ORDER[c["rank"]] > best_in_trick]
            if winners:
                choice = max(winners, key=card_counter_points)
            else:
                choice = min(legal, key=card_counter_points)
        res = self.play(actor, choice)
        return {"player": actor, "card": choice, **res}

    def run_bots(self, max_steps: int = 80) -> List[Dict[str, Any]]:
        steps: List[Dict[str, Any]] = []
        for _ in range(max_steps):
            if self.phase == "bidding":
                if self.bid_turn == self.user_position:
                    break
                steps.append(self.bot_bid())
            elif self.phase == "naming_trump":
                if self.high_bidder == self.user_position:
                    break
                steps.append(self.bot_name_trump())
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

    def to_view(self) -> Dict[str, Any]:
        legal = self.legal_for(self.user_position) if self.phase == "playing" else []
        # Hand sorted by suit (trump highlighted) → rank descending
        sorted_hand = sorted(
            self.hands[self.user_position],
            key=lambda c: (
                0 if (self.trump and c["suit"] == self.trump) else 1,
                SUITS.index(c["suit"]),
                -RANK_ORDER[c["rank"]],
                c["copy"],
            ),
        )
        players_data = {
            pos: {
                "card_count": len(self.hands[pos]),
                "tricks_won": self.tricks_won[pos],
                "team": TEAMS[pos],
                "meld": self.melds.get(pos, {}).get("total", 0),
            }
            for pos in POSITIONS
        }
        return {
            "user_position": self.user_position,
            "mode": self.mode,
            "match_target": self.match_target,
            "phase": self.phase,
            "turn": self.turn if self.phase == "playing" else self.bid_turn,
            "bid_turn": self.bid_turn,
            "high_bid": self.high_bid,
            "high_bidder": self.high_bidder,
            "passed": list(self.passed),
            "min_next_bid": max(self.bid_min, self.high_bid + BID_INCREMENT) if self.phase == "bidding" else None,
            "dealer": self.dealer,
            "trump": self.trump,
            "calling_team": self.calling_team,
            "current_trick": self.current_trick,
            "led_suit": self.led_suit,
            "your_hand": sorted_hand,
            "playable_cards": legal,
            "your_meld": self.melds.get(self.user_position) if self.melds else None,
            "scores": self.scores,
            "team_meld": self.team_meld,
            "team_trick": self.team_trick,
            "tricks_played": self.tricks_played,
            "players_data": players_data,
            "match_winner": self.match_winner,
            "hand_summary": self.hand_summary,
            "last_action": self.last_action,
        }

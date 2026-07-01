"""
War — pure-Python rule engine for the 2-player classic.

Standard ruleset:
  • 52-card deck split 26/26 between the two players.
  • Each round both players FLIP the top of their face-down pile.
  • Higher rank wins both cards; loser's card joins the winner's stack.
  • Tie → WAR: each player burns 3 face-down + 1 face-up. Higher face-up
    takes the entire pile. (If a player runs out of cards mid-war,
    they lose the round and the game.)
  • First to capture all 52 cards wins. We also support a SHORT MATCH
    mode that ends after `max_rounds` (most cards wins).
"""
from __future__ import annotations
from typing import List, Dict, Any, Optional
import secrets

from utils.meld_detection import SUITS, RANKS, RANK_INDEX, make_card

POSITIONS = ["north", "south"]


class WarGame:
    def __init__(self, user_position: str = "south", max_rounds: int = 50):
        self.rng = secrets.SystemRandom()
        self.user_position = user_position
        self.max_rounds = max_rounds
        self.match_winner: Optional[str] = None
        self.start_new_match()

    def start_new_match(self) -> None:
        deck = [make_card(s, r) for s in SUITS for r in RANKS]
        self.rng.shuffle(deck)
        self.piles: Dict[str, List[Dict[str, Any]]] = {
            "north": deck[:26],
            "south": deck[26:],
        }
        self.captures: Dict[str, List[Dict[str, Any]]] = {p: [] for p in POSITIONS}
        self.battle_log: List[Dict[str, Any]] = []
        self.round_no = 0
        self.phase = "ready"  # ready → playing → finished
        self.match_winner = None
        self.last_round: Optional[Dict[str, Any]] = None

    # ----- mechanics ----------------------------------------------------

    def _flip(self, pos: str) -> Optional[Dict[str, Any]]:
        if not self.piles[pos]:
            # Refill from captures
            self.piles[pos] = self.captures[pos]
            self.rng.shuffle(self.piles[pos])
            self.captures[pos] = []
        if not self.piles[pos]:
            return None
        return self.piles[pos].pop(0)

    def play_round(self, _user_pos: str) -> Dict[str, Any]:
        if self.phase == "finished":
            raise ValueError("Match over")
        self.round_no += 1
        self.phase = "playing"

        battle: List[Dict[str, Any]] = []  # cards staked this round
        north_card = self._flip("north")
        south_card = self._flip("south")
        if not north_card or not south_card:
            return self._finalise_match()
        battle.append({"player": "north", "card": north_card})
        battle.append({"player": "south", "card": south_card})

        wars = 0
        while north_card["value"] == south_card["value"]:
            wars += 1
            # Each player burns up to 3 face-down + 1 face-up
            for pos in POSITIONS:
                for _ in range(3):
                    burnt = self._flip(pos)
                    if burnt:
                        battle.append({"player": pos, "card": burnt, "face_down": True})
            n2 = self._flip("north")
            s2 = self._flip("south")
            if not n2 or not s2:
                # Whoever has cards left wins the war
                winner = "south" if not n2 else "north"
                self.captures[winner].extend([b["card"] for b in battle if b.get("card")])
                self.last_round = {
                    "round": self.round_no,
                    "war_depth": wars,
                    "winner": winner,
                    "battle": battle,
                    "elimination": True,
                }
                self.battle_log.append(self.last_round)
                return self._finalise_match()
            battle.append({"player": "north", "card": n2})
            battle.append({"player": "south", "card": s2})
            north_card, south_card = n2, s2

        winner = "north" if north_card["value"] > south_card["value"] else "south"
        self.captures[winner].extend([b["card"] for b in battle if b.get("card")])

        self.last_round = {
            "round": self.round_no,
            "war_depth": wars,
            "winner": winner,
            "battle": battle,
            "elimination": False,
        }
        self.battle_log.append(self.last_round)

        # End-of-match check
        if self.round_no >= self.max_rounds:
            return self._finalise_match()
        empty = [p for p in POSITIONS if not self.piles[p] and not self.captures[p]]
        if empty:
            return self._finalise_match()
        self.phase = "ready"
        return self.last_round

    def _finalise_match(self) -> Dict[str, Any]:
        self.phase = "finished"
        north_total = len(self.piles["north"]) + len(self.captures["north"])
        south_total = len(self.piles["south"]) + len(self.captures["south"])
        if north_total > south_total:
            self.match_winner = "north"
        elif south_total > north_total:
            self.match_winner = "south"
        else:
            self.match_winner = None  # draw
        return {
            "match_finished": True,
            "winner": self.match_winner,
            "north_count": north_total,
            "south_count": south_total,
        }

    # ----- view ---------------------------------------------------------

    def to_view(self) -> Dict[str, Any]:
        north_total = len(self.piles["north"]) + len(self.captures["north"])
        south_total = len(self.piles["south"]) + len(self.captures["south"])
        players_data = {
            "north": {"card_count": north_total},
            "east":  {"card_count": 0},
            "south": {"card_count": south_total},
            "west":  {"card_count": 0},
        }
        return {
            "user_position": self.user_position,
            "phase": self.phase,
            "round_no": self.round_no,
            "max_rounds": self.max_rounds,
            "north_count": north_total,
            "south_count": south_total,
            "last_round": self.last_round,
            "battle_log_tail": self.battle_log[-3:],
            "match_winner": self.match_winner,
            "players_data": players_data,
        }

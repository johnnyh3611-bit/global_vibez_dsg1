"""
Dominoes — pure-Python rule engine for the AAA Block Dominoes room.

Standard Block Dominoes (Double-Six) ruleset:
  • 28-tile double-six set: every {a,b} pair where 0 <= a <= b <= 6.
  • 2-player match: each player draws 7 tiles; remaining 14 tiles are
    the "boneyard" (drawing pile).
  • Round-start: highest double in any hand opens (e.g., [6|6]). If
    nobody holds a double the highest tile (max pip total) opens.
  • Players alternate. On your turn you must play a tile whose left
    or right pip matches the open end on either side of the chain.
    If you can't play, you draw from the boneyard until you can — if
    the boneyard is empty AND you can't play, you must PASS.
  • A round ends when:
        - A player plays their last tile ("DOMINO!") — they score
          the sum of their opponent's remaining pip counts.
        - The board is BLOCKED (both players pass in a row, boneyard
          empty). Lower pip-count player wins the round and scores
          the difference. Tie → no points.
  • First player to reach `target_score` (default 150) wins the match.

Reference: Vibe Dominoes Superior Build PDF — "The Arena" rules.
We keep mechanics minimal-but-correct; visual polish (Hype Feed,
Boneyard Ring, SLAP impact) is implemented client-side.
"""
from __future__ import annotations
from typing import Any, Dict, List, Optional, Tuple
import secrets


POSITIONS = ["north", "south"]


def build_double_six_set() -> List[Dict[str, Any]]:
    """28 ordered tiles {id, left, right} where left <= right."""
    tiles: List[Dict[str, Any]] = []
    for a in range(7):
        for b in range(a, 7):
            tiles.append({"id": f"{a}-{b}", "left": a, "right": b})
    return tiles


def pip_count(tile_ids: List[str], lookup: Dict[str, Dict[str, Any]]) -> int:
    return sum(lookup[tid]["left"] + lookup[tid]["right"] for tid in tile_ids)


class DominoesGame:
    """Block Dominoes (Double-Six), single-player vs 1 AI bot."""

    def __init__(self, user_position: str = "south", target_score: int = 150, multiplayer: bool = False):
        self.rng = secrets.SystemRandom()
        self.user_position = user_position
        self.bot_position = "north" if user_position == "south" else "south"
        self.target_score = max(50, min(target_score, 500))
        self.multiplayer = multiplayer  # when True, _run_bot_turns is a no-op
        self.round_no = 0
        self.match_winner: Optional[str] = None
        self.scores: Dict[str, int] = {p: 0 for p in POSITIONS}
        self.last_round_summary: Optional[Dict[str, Any]] = None
        self._tile_lookup: Dict[str, Dict[str, Any]] = {t["id"]: t for t in build_double_six_set()}
        self.start_new_round(opener=None)

    # --------------------------------------------------------------- helpers

    def _all_tiles(self) -> List[Dict[str, Any]]:
        return [dict(t) for t in build_double_six_set()]

    def _highest_double_holder(self) -> Tuple[Optional[str], Optional[str]]:
        """Return (position, tile_id) of the highest double currently held."""
        best_double = -1
        holder, tile_id = None, None
        for pos in POSITIONS:
            for tid in self.hands[pos]:
                t = self._tile_lookup[tid]
                if t["left"] == t["right"] and t["left"] > best_double:
                    best_double = t["left"]
                    holder = pos
                    tile_id = tid
        if holder:
            return holder, tile_id
        # No doubles in any hand — fall back to highest pip-total tile.
        best_pips = -1
        for pos in POSITIONS:
            for tid in self.hands[pos]:
                t = self._tile_lookup[tid]
                pips = t["left"] + t["right"]
                if pips > best_pips:
                    best_pips = pips
                    holder = pos
                    tile_id = tid
        return holder, tile_id

    def _open_ends(self) -> Tuple[Optional[int], Optional[int]]:
        if not self.chain:
            return None, None
        return self.chain[0]["left"], self.chain[-1]["right"]

    def _can_play(self, tile_id: str, side: Optional[str] = None) -> bool:
        t = self._tile_lookup[tile_id]
        left_end, right_end = self._open_ends()
        if left_end is None:
            return True  # board empty → anything plays
        if side == "left":
            return t["left"] == left_end or t["right"] == left_end
        if side == "right":
            return t["left"] == right_end or t["right"] == right_end
        return (
            t["left"] == left_end or t["right"] == left_end
            or t["left"] == right_end or t["right"] == right_end
        )

    def _has_any_playable(self, pos: str) -> bool:
        return any(self._can_play(tid) for tid in self.hands[pos])

    def _orient_and_append(self, tile_id: str, side: str) -> Dict[str, Any]:
        """Place the tile on `side` of the chain, flipping if needed.
        Returns the oriented tile dict actually appended to the chain."""
        t = self._tile_lookup[tile_id]
        left_end, right_end = self._open_ends()
        if left_end is None:
            placed = {"id": tile_id, "left": t["left"], "right": t["right"]}
            self.chain.append(placed)
            return placed
        if side == "left":
            # The tile's right side must touch the existing left_end.
            if t["right"] == left_end:
                placed = {"id": tile_id, "left": t["left"], "right": t["right"]}
            elif t["left"] == left_end:
                placed = {"id": tile_id, "left": t["right"], "right": t["left"]}
            else:
                raise ValueError("Tile does not match the left end")
            self.chain.insert(0, placed)
            return placed
        # side == "right"
        if t["left"] == right_end:
            placed = {"id": tile_id, "left": t["left"], "right": t["right"]}
        elif t["right"] == right_end:
            placed = {"id": tile_id, "left": t["right"], "right": t["left"]}
        else:
            raise ValueError("Tile does not match the right end")
        self.chain.append(placed)
        return placed

    # --------------------------------------------------------------- round mgmt

    def start_new_round(self, opener: Optional[str]) -> None:
        deck = self._all_tiles()
        self.rng.shuffle(deck)
        self.hands: Dict[str, List[str]] = {p: [] for p in POSITIONS}
        for i in range(7):
            self.hands["south"].append(deck[i]["id"])
        for i in range(7, 14):
            self.hands["north"].append(deck[i]["id"])
        self.boneyard: List[str] = [t["id"] for t in deck[14:]]
        self.chain: List[Dict[str, Any]] = []
        self.passes_in_a_row = 0
        self.draws_this_turn = 0
        self.round_no += 1
        self.phase = "playing"  # playing | round_over | finished

        # Determine opener
        forced_opener, forced_tile = self._highest_double_holder()
        if opener is None:
            self.current_turn = forced_opener or "south"
            self.opening_tile = forced_tile  # informational only
        else:
            self.current_turn = opener
            self.opening_tile = None

        # Bot opens automatically if it's their turn
        if self.current_turn == self.bot_position:
            self._run_bot_turns()

    def _end_round(self, winner: Optional[str], reason: str) -> None:
        """Finalise the round. winner=None means a tied block."""
        south_pips = pip_count(self.hands["south"], self._tile_lookup)
        north_pips = pip_count(self.hands["north"], self._tile_lookup)
        delta = 0
        if winner is not None:
            loser = "north" if winner == "south" else "south"
            delta = pip_count(self.hands[loser], self._tile_lookup)
            self.scores[winner] += delta
        self.last_round_summary = {
            "round_no": self.round_no,
            "winner": winner,
            "reason": reason,  # "domino" | "blocked" | "tied_block"
            "delta": delta,
            "south_pips": south_pips,
            "north_pips": north_pips,
            "scores": dict(self.scores),
        }
        if any(s >= self.target_score for s in self.scores.values()):
            self.phase = "finished"
            self.match_winner = max(POSITIONS, key=lambda p: self.scores[p])
        else:
            self.phase = "round_over"

    # --------------------------------------------------------------- bot AI

    def _bot_pick_move(self) -> Optional[Tuple[str, str]]:
        """Greedy: prefer playing the highest pip-count tile that fits.
        Returns (tile_id, side) or None if can't play."""
        playable: List[Tuple[int, str, str]] = []
        left_end, right_end = self._open_ends()
        for tid in self.hands[self.bot_position]:
            t = self._tile_lookup[tid]
            pips = t["left"] + t["right"]
            if left_end is None:
                # First move — bias toward biggest double else biggest tile
                playable.append((pips + (10 if t["left"] == t["right"] else 0), tid, "left"))
                continue
            if t["left"] == right_end or t["right"] == right_end:
                playable.append((pips, tid, "right"))
            elif t["left"] == left_end or t["right"] == left_end:
                playable.append((pips, tid, "left"))
        if not playable:
            return None
        playable.sort(reverse=True)
        _, tid, side = playable[0]
        return tid, side

    def _run_bot_turns(self) -> None:
        """Run bot turns until control returns to user or round ends.

        In multiplayer mode this is a no-op — the opponent is a real
        WebSocket peer who'll send their own moves."""
        if self.multiplayer:
            return
        while self.phase == "playing" and self.current_turn == self.bot_position:
            move = self._bot_pick_move()
            if move:
                tid, side = move
                self._apply_play(self.bot_position, tid, side)
                self.draws_this_turn = 0
                continue
            # Can't play — try drawing
            if self.boneyard:
                drawn = self.boneyard.pop(0)
                self.hands[self.bot_position].append(drawn)
                # Continue loop — maybe drawn tile is playable
                continue
            # Boneyard empty and no playable → pass
            self._apply_pass(self.bot_position)
            self.draws_this_turn = 0

    # --------------------------------------------------------------- actions

    def _apply_play(self, pos: str, tile_id: str, side: str) -> Dict[str, Any]:
        if tile_id not in self.hands[pos]:
            raise ValueError("Tile not in hand")
        if not self._can_play(tile_id, side):
            raise ValueError("Illegal move — tile does not match that end")
        placed = self._orient_and_append(tile_id, side)
        self.hands[pos].remove(tile_id)
        self.passes_in_a_row = 0
        if not self.hands[pos]:
            # DOMINO! Round won by reaching empty hand.
            self._end_round(winner=pos, reason="domino")
            return placed
        # Otherwise, hand control to the opponent.
        self.current_turn = "north" if pos == "south" else "south"
        return placed

    def _apply_pass(self, pos: str) -> None:
        self.passes_in_a_row += 1
        if self.passes_in_a_row >= 2:
            # Both players passed in a row → blocked.
            south_pips = pip_count(self.hands["south"], self._tile_lookup)
            north_pips = pip_count(self.hands["north"], self._tile_lookup)
            if south_pips < north_pips:
                self._end_round(winner="south", reason="blocked")
            elif north_pips < south_pips:
                self._end_round(winner="north", reason="blocked")
            else:
                self._end_round(winner=None, reason="tied_block")
            return
        self.current_turn = "north" if pos == "south" else "south"

    # ----- public actions (user) ----

    def play(self, tile_id: str, side: str) -> Dict[str, Any]:
        if self.phase != "playing":
            raise ValueError("Round not active")
        if self.current_turn != self.user_position:
            raise ValueError("Not your turn")
        if side not in ("left", "right"):
            raise ValueError("side must be 'left' or 'right'")
        placed = self._apply_play(self.user_position, tile_id, side)
        self.draws_this_turn = 0
        if self.phase == "playing":
            self._run_bot_turns()
        return placed

    def draw(self) -> Dict[str, Any]:
        if self.phase != "playing":
            raise ValueError("Round not active")
        if self.current_turn != self.user_position:
            raise ValueError("Not your turn")
        if self._has_any_playable(self.user_position):
            raise ValueError("You have a playable tile — no draw needed")
        if not self.boneyard:
            raise ValueError("Boneyard empty — you must pass")
        drawn = self.boneyard.pop(0)
        self.hands[self.user_position].append(drawn)
        self.draws_this_turn += 1
        return self._tile_lookup[drawn]

    def pass_turn(self) -> None:
        if self.phase != "playing":
            raise ValueError("Round not active")
        if self.current_turn != self.user_position:
            raise ValueError("Not your turn")
        if self._has_any_playable(self.user_position):
            raise ValueError("You have a playable tile — cannot pass")
        if self.boneyard:
            raise ValueError("Boneyard not empty — you must draw first")
        self._apply_pass(self.user_position)
        self.draws_this_turn = 0
        if self.phase == "playing":
            self._run_bot_turns()

    def next_round(self) -> None:
        if self.phase != "round_over":
            raise ValueError("Match still active or finished")
        # Loser opens next round (if tied, alternate)
        last = self.last_round_summary or {}
        winner = last.get("winner")
        if winner is None:
            opener = "south" if self.round_no % 2 == 0 else "north"
        else:
            opener = "north" if winner == "south" else "south"
        self.start_new_round(opener=opener)

    # --------------------------------------------------------------- view

    def to_view(self, requester: str = "south") -> Dict[str, Any]:
        """Produce a JSON-safe view from the requester's perspective."""
        opp = "north" if requester == "south" else "south"
        left_end, right_end = self._open_ends()

        # Hide opponent tile IDs (only count + pip total revealed at round end)
        my_hand = [self._tile_lookup[t] for t in self.hands[requester]]

        # Mark which of my tiles are playable on each side for the UI.
        playable_map: Dict[str, Dict[str, bool]] = {}
        for tid in self.hands[requester]:
            playable_map[tid] = {
                "left": self._can_play(tid, "left"),
                "right": self._can_play(tid, "right"),
                "any": self._can_play(tid),
            }

        return {
            "user_position": requester,
            "phase": self.phase,
            "round_no": self.round_no,
            "current_turn": self.current_turn,
            "target_score": self.target_score,
            "scores": dict(self.scores),
            "match_winner": self.match_winner,
            "chain": [dict(t) for t in self.chain],
            "left_end": left_end,
            "right_end": right_end,
            "boneyard_count": len(self.boneyard),
            "opening_tile": self.opening_tile,
            "passes_in_a_row": self.passes_in_a_row,
            "players_data": {
                requester: {
                    "hand": my_hand,
                    "hand_count": len(self.hands[requester]),
                    "playable": playable_map,
                    "has_playable": self._has_any_playable(requester),
                    "is_bot": False,
                },
                opp: {
                    "hand_count": len(self.hands[opp]),
                    "is_bot": True,
                },
            },
            "last_round_summary": self.last_round_summary,
        }

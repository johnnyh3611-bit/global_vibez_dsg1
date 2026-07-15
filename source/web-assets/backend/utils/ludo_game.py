"""
Simplified 2-player Ludo engine for practice mode.

Rules:
- 4 pieces per player.
- Track is 56 spaces long (0-55). Player enters at 0, AI at 28.
- A piece starts in base (distance -1). A roll of 6 brings it onto the
  board at distance 0 (the entry square).
- Pieces move clockwise by the die value. You need an exact roll to reach
  home (distance 56).
- Entry squares (0 and 28) and the quarter squares 14 and 42 are safe.
- Landing on a single opponent piece that is not on a safe square sends it
  back to base. Squares with 2+ opponent pieces are blockades and cannot be
  landed on.
- First player to get all 4 pieces home wins.
"""
from __future__ import annotations
from typing import Dict, Any, List, Optional
import secrets

_TRACK_SIZE = 56
_HOME = 56
_ENTRIES = {"player": 0, "ai": 28}
_SAFE_SQUARES = {0, 14, 28, 42}


def _roll_die() -> int:
    return secrets.SystemRandom().randint(1, 6)


def _track_position(player: str, distance: int) -> Optional[int]:
    """Return the global track square for a piece, or None if in base/home."""
    if distance < 0 or distance >= _TRACK_SIZE:
        return None
    return (_ENTRIES[player] + distance) % _TRACK_SIZE


def _piece_state() -> List[Dict[str, Any]]:
    return [{"distance": -1, "finished": False} for _ in range(4)]


def initialize_game() -> Dict[str, Any]:
    return {
        "player_pieces": _piece_state(),
        "ai_pieces": _piece_state(),
        "last_roll": None,
        "winner": None,
    }


def _opponent(player: str) -> str:
    return "ai" if player == "player" else "player"


def _pieces_on_square(
    state: Dict[str, Any], player: str, square: int
) -> List[int]:
    """Return indices of a player's pieces on a given track square."""
    pieces = state[f"{player}_pieces"]
    result = []
    for idx, piece in enumerate(pieces):
        if piece["finished"]:
            continue
        pos = _track_position(player, piece["distance"])
        if pos is not None and pos == square:
            result.append(idx)
    return result


def _legal_move_indices(
    state: Dict[str, Any], player: str, roll: int
) -> List[int]:
    """Return the piece indices that can legally move with `roll`."""
    pieces = state[f"{player}_pieces"]
    legal = []
    for idx, piece in enumerate(pieces):
        distance = piece["distance"]
        if distance == -1:
            if roll == 6:
                legal.append(idx)
        elif 0 <= distance < _HOME:
            new_distance = distance + roll
            if new_distance <= _HOME:
                # Blockade check: can't land on a square with 2+ opponents.
                if new_distance < _HOME:
                    new_pos = _track_position(player, new_distance)
                    opp = _opponent(player)
                    if len(_pieces_on_square(state, opp, new_pos)) > 1:
                        continue
                legal.append(idx)
    return legal


def _move_piece(
    state: Dict[str, Any], player: str, piece_index: int, roll: int
) -> None:
    pieces = state[f"{player}_pieces"]
    piece = pieces[piece_index]
    distance = piece["distance"]

    if distance == -1:
        if roll != 6:
            raise ValueError("Must roll a 6 to leave base")
        piece["distance"] = 0
    else:
        new_distance = distance + roll
        if new_distance > _HOME:
            raise ValueError("Overshoot: need an exact roll to reach home")
        if new_distance == _HOME:
            piece["distance"] = _HOME
            piece["finished"] = True
        else:
            new_pos = _track_position(player, new_distance)
            opp = _opponent(player)
            # Capture a lone opponent piece if the new square is not safe.
            if new_pos not in _SAFE_SQUARES:
                opp_pieces = _pieces_on_square(state, opp, new_pos)
                if len(opp_pieces) == 1:
                    state[f"{opp}_pieces"][opp_pieces[0]]["distance"] = -1
                elif len(opp_pieces) > 1:
                    raise ValueError("Cannot land on an opponent blockade")
            piece["distance"] = new_distance


def apply_move(
    state: Dict[str, Any],
    player: str,
    move: Dict[str, Any],
) -> Dict[str, Any]:
    """Apply a Ludo move. If `move` omits a roll, one is generated."""
    roll = move.get("roll")
    if roll is None:
        roll = _roll_die()
    state["last_roll"] = roll

    legal = _legal_move_indices(state, player, roll)
    if not legal:
        # No legal move; turn passes silently.
        return state

    piece_index = move.get("piece_index")
    if piece_index is None or piece_index not in legal:
        piece_index = legal[0]

    _move_piece(state, player, piece_index, roll)
    state["winner"] = check_winner(state)
    return state


def check_winner(state: Dict[str, Any]) -> Optional[str]:
    for player in ("player", "ai"):
        if all(p["finished"] for p in state[f"{player}_pieces"]):
            return player
    return None


def _move_score(
    state: Dict[str, Any], player: str, piece_index: int, roll: int
) -> float:
    """Heuristic score for a candidate move. Higher is better."""
    pieces = state[f"{player}_pieces"]
    piece = pieces[piece_index]
    distance = piece["distance"]
    score = 0.0

    if distance == -1 and roll == 6:
        # Bringing a piece onto the board is valuable.
        return 10.0

    new_distance = distance + roll
    if new_distance > _HOME:
        return -1000.0

    if new_distance == _HOME:
        score += 20.0
    else:
        new_pos = _track_position(player, new_distance)
        if new_pos in _SAFE_SQUARES:
            score += 3.0
        opp = _opponent(player)
        opp_pieces = _pieces_on_square(state, opp, new_pos)
        if len(opp_pieces) == 1:
            score += 15.0
        elif len(opp_pieces) > 1:
            return -1000.0

    # Prefer advancing the piece that is furthest along.
    score += new_distance * 0.2
    return score


def get_ai_move(state: Dict[str, Any], player: str = "ai") -> Dict[str, Any]:
    """Choose a piece to move and (optionally) roll the die for it."""
    roll = _roll_die()
    legal = _legal_move_indices(state, player, roll)
    if not legal:
        return {"roll": roll, "piece_index": 0}
    best = max(legal, key=lambda idx: _move_score(state, player, idx, roll))
    return {"roll": roll, "piece_index": best}

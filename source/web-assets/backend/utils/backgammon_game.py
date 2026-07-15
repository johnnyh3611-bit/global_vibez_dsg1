"""
Simplified 2-player Backgammon engine for practice mode.

Rules:
- 24 points, 15 checkers per player.
- Player (white) moves from point 24 toward 1; AI (black) moves from 1 to 24.
- A single opponent checker on a point is a "blot" and gets hit to the bar.
- You must re-enter from the bar before moving other checkers.
- Player re-enters on point (25 - die), AI re-enters on point die.
- Bearing off removes checkers once all 15 are in the home board
  (player: 1-6, AI: 19-24). Higher-point exact bear-off is preferred,
  but a checker on a lower point can bear off if no checker exists on a
  higher point in the home board.
- First player to bear off all 15 checkers wins.
"""
from __future__ import annotations
from typing import Dict, Any, List, Optional, Tuple
import secrets

_HOME_PLAYER = (1, 6)
_HOME_AI = (19, 24)


def _roll_die() -> int:
    return secrets.SystemRandom().randint(1, 6)


def _initial_points() -> List[int]:
    """Standard backgammon starting position as signed counts.

    Positive = player checkers, negative = AI checkers.
    """
    points = [0] * 24
    # Player (white) starts on high points.
    points[23] = 2  # point 24
    points[12] = 5  # point 13
    points[7] = 3   # point 8
    points[5] = 5   # point 6
    # AI (black) starts on low points.
    points[0] = -2  # point 1
    points[11] = -5  # point 12
    points[16] = -3  # point 17
    points[18] = -5  # point 19
    return points


def initialize_game() -> Dict[str, Any]:
    return {
        "points": _initial_points(),
        "bar": {"player": 0, "ai": 0},
        "off": {"player": 0, "ai": 0},
        "last_roll": None,
        "winner": None,
        "moves": 0,
    }


def _opponent(player: str) -> str:
    return "ai" if player == "player" else "player"


def _all_home(state: Dict[str, Any], player: str) -> bool:
    """Check if all of a player's live checkers are in the home board."""
    points = state["points"]
    bar = state["bar"][player]
    if bar > 0:
        return False

    low, high = (_HOME_PLAYER if player == "player" else _HOME_AI)
    for idx, count in enumerate(points):
        point_num = idx + 1
        if player == "player":
            if count > 0 and not (low <= point_num <= high):
                return False
        else:
            if count < 0 and not (low <= point_num <= high):
                return False
    return True


def _higher_home_point_exists(
    state: Dict[str, Any], player: str, point: int
) -> bool:
    """For bear-off: are there any checkers on a higher home-board point?"""
    low, high = (_HOME_PLAYER if player == "player" else _HOME_AI)
    points = state["points"]
    for p in range(point + 1, high + 1):
        idx = p - 1
        count = points[idx]
        if player == "player" and count > 0:
            return True
        if player == "ai" and count < 0:
            return True
    return False


def _legal_moves(
    state: Dict[str, Any], player: str, die: int
) -> List[Tuple[str, int]]:
    """Return legal (source, target_point) moves for `die`.

    Source is either "bar" or a 1-based point number. Target is 1-24 or 0
    for a player bear-off and 25 for an AI bear-off.
    """
    points = state["points"]
    legal: List[Tuple[str, int]] = []

    def _can_land(target: int, by_player: str) -> bool:
        if not 1 <= target <= 24:
            return False
        idx = target - 1
        count = points[idx]
        if by_player == "player":
            return count >= -1  # own, empty, or single blot
        else:
            return count <= 1

    if state["bar"][player] > 0:
        if player == "player":
            target = 25 - die
            if _can_land(target, player):
                legal.append(("bar", target))
        else:
            target = die
            if _can_land(target, player):
                legal.append(("bar", target))
        return legal

    if player == "player":
        home_low, home_high = _HOME_PLAYER
        for point in range(1, 25):
            idx = point - 1
            if points[idx] <= 0:
                continue
            target = point - die
            if target >= 1:
                if _can_land(target, player):
                    legal.append((point, target))
            elif target <= 0:
                # Bear-off candidate
                if _all_home(state, player):
                    if point == die or (
                        point < die and not _higher_home_point_exists(
                            state, player, point)):
                        legal.append((point, 0))  # 0 means off
    else:
        home_low, home_high = _HOME_AI
        for point in range(1, 25):
            idx = point - 1
            if points[idx] >= 0:
                continue
            target = point + die
            if target <= 24:
                if _can_land(target, player):
                    legal.append((point, target))
            elif target >= 25:
                # Bear-off candidate
                if _all_home(state, player):
                    # AI bear-off: point 25-die can bear off with exact,
                    # or higher point if no checker exists on a lower home
                    # point.
                    exact = 25 - die
                    if point == exact or (
                        point > exact and not _higher_home_point_exists(
                            state, player, point)):
                        legal.append((point, 25))  # 25 means off

    return legal


def _move_checker(
    state: Dict[str, Any], player: str, source: Any, target: int, die: int
) -> None:
    points = state["points"]

    if source == "bar":
        state["bar"][player] -= 1
        if player == "player":
            if target != 25 - die:
                raise ValueError("Invalid bar re-entry")
        else:
            if target != die:
                raise ValueError("Invalid bar re-entry")
    else:
        source_point = int(source)
        source_idx = source_point - 1
        if player == "player":
            points[source_idx] -= 1
            if target == 0:
                state["off"][player] += 1
                return
            if source_point - die != target:
                raise ValueError("Target does not match die from source")
        else:
            points[source_idx] += 1
            if target == 25:
                state["off"][player] += 1
                return
            if source_point + die != target:
                raise ValueError("Target does not match die from source")

    # Normal landing on a point (1-24)
    target_idx = target - 1
    target_count = points[target_idx]
    opp = _opponent(player)
    if player == "player":
        # Hitting an AI blot
        if target_count == -1:
            points[target_idx] = 1
            state["bar"][opp] += 1
        else:
            points[target_idx] += 1
    else:
        # Hitting a player blot
        if target_count == 1:
            points[target_idx] = -1
            state["bar"][opp] += 1
        else:
            points[target_idx] -= 1


def apply_move(
    state: Dict[str, Any],
    player: str,
    move: Dict[str, Any],
) -> Dict[str, Any]:
    """Apply a Backgammon move. If `move` omits a die, one is generated."""
    die = move.get("die")
    if die is None:
        die = _roll_die()
    state["last_roll"] = die

    legal = _legal_moves(state, player, die)
    if not legal:
        # No legal move; turn passes.
        return state

    source = move.get("from")
    target = move.get("to")
    chosen = None
    if source is not None:
        # Source may be an int point or "bar"; normalise.
        if source != "bar":
            source = int(source)
        # If both source and target are supplied and legal, use them.
        if (source, target) in legal:
            chosen = (source, target)
        else:
            # If source is supplied, try to find any legal target from it.
            for s, t in legal:
                if s == source:
                    chosen = (s, t)
                    break
    if chosen is None:
        chosen = legal[0]

    _move_checker(state, player, chosen[0], chosen[1], die)
    state["moves"] = state.get("moves", 0) + 1
    state["winner"] = check_winner(state)
    return state


def _progress(state: Dict[str, Any], player: str) -> int:
    """Count checkers already off or in the home board."""
    off = state["off"][player]
    home_low, home_high = (_HOME_PLAYER if player == "player" else _HOME_AI)
    home = 0
    for idx, count in enumerate(state["points"]):
        point = idx + 1
        if player == "player":
            if count > 0 and home_low <= point <= home_high:
                home += count
        else:
            if count < 0 and home_low <= point <= home_high:
                home += -count
    return off + home


def check_winner(state: Dict[str, Any]) -> Optional[str]:
    for player in ("player", "ai"):
        if state["off"][player] >= 15:
            return player

    # Practice safety cap: after 200 half-moves, the side further along wins.
    if state["moves"] >= 200:
        player_progress = _progress(state, "player")
        ai_progress = _progress(state, "ai")
        if player_progress > ai_progress:
            return "player"
        if ai_progress > player_progress:
            return "ai"
        return "draw"

    return None


def _move_score(
    state: Dict[str, Any], player: str, source: Any, target: int, die: int
) -> float:
    """Score a candidate Backgammon move."""
    score = 0.0

    # Bearing off is best.
    if player == "player" and target == 0:
        score += 50.0
    if player == "ai" and target == 25:
        score += 50.0

    # Hitting a blot is very good.
    if source != "bar":
        points = state["points"]
        if player == "player" and target >= 1:
            if points[target - 1] == -1:
                score += 25.0
        if player == "ai" and target <= 24:
            if points[target - 1] == 1:
                score += 25.0

    # Re-entering from the bar is important.
    if source == "bar":
        score += 15.0

    # Move checkers toward home and prefer moving the most distant checker.
    if source != "bar" and target not in (0, 25):
        source_point = int(source)
        if player == "player":
            score += (source_point - target) * 0.5
            score += source_point * 0.2  # prefer moving furthest-back pieces
        else:
            score += (target - source_point) * 0.5
            score += (24 - source_point) * 0.2  # prefer furthest-back pieces

    return score


def get_ai_move(state: Dict[str, Any], player: str = "ai") -> Dict[str, Any]:
    """Choose a Backgammon move and (optionally) roll the die for it."""
    die = _roll_die()
    legal = _legal_moves(state, player, die)
    if not legal:
        return {"die": die, "from": 1, "to": 1}
    best = max(
        legal,
        key=lambda m: _move_score(state, player, m[0], m[1], die)
    )
    return {"die": die, "from": best[0], "to": best[1]}

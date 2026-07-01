"""
Tic Tac Toe — official "Five in a Row" ruleset (LOCKED 2026-02-16).

Founder directive: standard 3×3 board produced too many forced draws.
Now plays on a **12×12 board** with a **5-in-a-row** win condition
(horizontal, vertical, or diagonal). Both single-player + multiplayer
rooms inherit this engine.
"""
from typing import Any, Dict, List, Optional

from .base import BaseGameLogic, GameRoom

# Per-cell value: "X" | "O" | None.
Cell = Optional[str]
Board = List[List[Cell]]
GameState = Dict[str, Any]

# ── Locked rule constants (LOCKED 2026-02-16) ────────────────────────────
BOARD_SIZE: int = 12
WIN_LENGTH: int = 5

# In-memory storage for Tic Tac Toe games
tictactoe_games: Dict[str, GameState] = {}


def _empty_board() -> Board:
    return [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]


def _max_moves() -> int:
    return BOARD_SIZE * BOARD_SIZE


class TicTacToeGame(BaseGameLogic):
    """Tic Tac Toe game handler — 12×12 / 5-in-a-row."""

    def __init__(self, room: GameRoom) -> None:
        super().__init__(room)

    def initialize_game(self) -> GameState:
        game_state: GameState = {
            'board': _empty_board(),
            'board_size': BOARD_SIZE,
            'win_length': WIN_LENGTH,
            'current_player': 'X',
            'x_player': self.room.host.session_id,
            'o_player': self.room.guest.session_id if self.room.guest else None,
            'winner': None,
            'winning_line': None,
            'game_over': False,
            'moves_count': 0,
        }
        tictactoe_games[self.room.room_code] = game_state
        return game_state

    def make_move(self, player_id: str, move_data: Dict[str, Any]) -> Dict[str, Any]:
        game = tictactoe_games.get(self.room.room_code)
        if not game or game['game_over']:
            return {'success': False, 'error': 'Game not found or already over'}

        row: Optional[int] = move_data.get('row')
        col: Optional[int] = move_data.get('col')

        if row is None or col is None or row < 0 or row >= BOARD_SIZE or col < 0 or col >= BOARD_SIZE:
            return {'success': False, 'error': 'Invalid position'}

        if game['board'][row][col] is not None:
            return {'success': False, 'error': 'Position already taken'}

        # Check turn ownership
        current_symbol: str = game['current_player']
        if (current_symbol == 'X' and player_id != game['x_player']) or \
           (current_symbol == 'O' and player_id != game['o_player']):
            return {'success': False, 'error': 'Not your turn'}

        # Place
        game['board'][row][col] = current_symbol
        game['moves_count'] += 1

        # Check 5-in-a-row from the freshly placed cell
        win = _detect_winning_line(game['board'], row, col)
        if win:
            game['winner'] = current_symbol
            game['winning_line'] = win
            game['game_over'] = True
        elif game['moves_count'] == _max_moves():
            game['winner'] = 'draw'
            game['game_over'] = True
        else:
            game['current_player'] = 'O' if current_symbol == 'X' else 'X'

        return {'success': True, 'game_state': game}

    def get_state_for_player(self, player_id: str) -> Dict[str, Any]:
        game = tictactoe_games.get(self.room.room_code, {})
        return {
            'board': game.get('board'),
            'board_size': game.get('board_size', BOARD_SIZE),
            'win_length': game.get('win_length', WIN_LENGTH),
            'current_player': game.get('current_player'),
            'your_symbol': 'X' if player_id == game.get('x_player') else 'O',
            'winner': game.get('winner'),
            'winning_line': game.get('winning_line'),
            'game_over': game.get('game_over', False),
        }

    def is_game_over(self) -> bool:
        game = tictactoe_games.get(self.room.room_code)
        return game.get('game_over', False) if game else False

    def get_winner(self) -> Optional[str]:
        game = tictactoe_games.get(self.room.room_code)
        return game.get('winner') if game else None


# ── Helper functions for Socket.IO handlers ──────────────────────────────
def create_tictactoe_game(room_code: str, host_id: str, guest_id: str) -> GameState:
    game_state: GameState = {
        'board': _empty_board(),
        'board_size': BOARD_SIZE,
        'win_length': WIN_LENGTH,
        'current_player': 'X',
        'x_player': host_id,
        'o_player': guest_id,
        'winner': None,
        'winning_line': None,
        'game_over': False,
        'moves_count': 0,
    }
    tictactoe_games[room_code] = game_state
    return game_state


def make_tictactoe_move(
    room_code: str, player_id: str, row: int, col: int,
) -> Optional[GameState]:
    game = tictactoe_games.get(room_code)
    if not game or game['game_over']:
        return None

    if row < 0 or row >= BOARD_SIZE or col < 0 or col >= BOARD_SIZE or game['board'][row][col]:
        return None

    current_symbol: str = game['current_player']
    if (current_symbol == 'X' and player_id != game['x_player']) or \
       (current_symbol == 'O' and player_id != game['o_player']):
        return None

    game['board'][row][col] = current_symbol
    game['moves_count'] += 1

    win = _detect_winning_line(game['board'], row, col)
    if win:
        game['winner'] = current_symbol
        game['winning_line'] = win
        game['game_over'] = True
    elif game['moves_count'] == _max_moves():
        game['winner'] = 'draw'
        game['game_over'] = True
    else:
        game['current_player'] = 'O' if current_symbol == 'X' else 'X'

    return game


# ── Win detection (5-in-a-row, 4 directions, scan from last move) ───────
def _detect_winning_line(
    board: Board, r: int, c: int,
) -> Optional[List[List[int]]]:
    """Return the cells of a 5-in-a-row containing (r,c), else None."""
    mark = board[r][c]
    if mark is None:
        return None
    # 4 directions: horizontal, vertical, two diagonals
    dirs = ((0, 1), (1, 0), (1, 1), (1, -1))
    for dr, dc in dirs:
        line = [[r, c]]
        # forward
        for k in range(1, WIN_LENGTH):
            nr, nc = r + dr * k, c + dc * k
            if not (0 <= nr < BOARD_SIZE and 0 <= nc < BOARD_SIZE):
                break
            if board[nr][nc] != mark:
                break
            line.append([nr, nc])
        # backward
        for k in range(1, WIN_LENGTH):
            nr, nc = r - dr * k, c - dc * k
            if not (0 <= nr < BOARD_SIZE and 0 <= nc < BOARD_SIZE):
                break
            if board[nr][nc] != mark:
                break
            line.insert(0, [nr, nc])
        if len(line) >= WIN_LENGTH:
            return line[:WIN_LENGTH]
    return None

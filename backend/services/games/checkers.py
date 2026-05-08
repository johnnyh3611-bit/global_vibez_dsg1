"""
Checkers Game Logic
8x8 board game for 2 players
"""
from typing import Any, Dict, List, Optional, Tuple

from .base import BaseGameLogic, GameRoom

# Per-cell value: a piece dict {color, king} or None.
Piece = Dict[str, Any]
Cell = Optional[Piece]
Board = List[List[Cell]]
GameState = Dict[str, Any]

# In-memory storage
checkers_games: Dict[str, GameState] = {}


class CheckersGame(BaseGameLogic):
    """Checkers game handler"""

    def __init__(self, room: GameRoom) -> None:
        super().__init__(room)

    def initialize_game(self) -> GameState:
        """Initialize a new Checkers game"""
        # Initialize 8x8 board with pieces
        board: Board = [[None for _ in range(8)] for _ in range(8)]

        # Place red pieces (top 3 rows)
        for row in range(3):
            for col in range(8):
                if (row + col) % 2 == 1:
                    board[row][col] = {'color': 'red', 'king': False}

        # Place black pieces (bottom 3 rows)
        for row in range(5, 8):
            for col in range(8):
                if (row + col) % 2 == 1:
                    board[row][col] = {'color': 'black', 'king': False}

        game_state: GameState = {
            'board': board,
            'current_player': 'black',
            'red_player': self.room.host.session_id,
            'black_player': self.room.guest.session_id if self.room.guest else None,
            'winner': None,
            'game_over': False,
            'must_jump': None,  # If a piece must jump
            'moves_count': 0,
        }
        checkers_games[self.room.room_code] = game_state
        return game_state

    def make_move(self, player_id: str, move_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process a move"""
        game = checkers_games.get(self.room.room_code)
        if not game or game['game_over']:
            return {'success': False, 'error': 'Game not found or over'}

        from_row: Optional[int] = move_data.get('from_row')
        from_col: Optional[int] = move_data.get('from_col')
        to_row: Optional[int] = move_data.get('to_row')
        to_col: Optional[int] = move_data.get('to_col')

        # Validate positions
        if any(p is None or p < 0 or p > 7 for p in [from_row, from_col, to_row, to_col]):
            return {'success': False, 'error': 'Invalid position'}

        # Check turn
        current_color: str = game['current_player']
        if (current_color == 'red' and player_id != game['red_player']) or \
           (current_color == 'black' and player_id != game['black_player']):
            return {'success': False, 'error': 'Not your turn'}

        # Validate move
        piece: Cell = game['board'][from_row][from_col]
        if not piece or piece['color'] != current_color:
            return {'success': False, 'error': 'Invalid piece'}

        if game['board'][to_row][to_col] is not None:
            return {'success': False, 'error': 'Destination occupied'}

        # Check if move is valid (simplified - regular moves and jumps)
        is_jump, jumped_piece = self._is_valid_move(game['board'], from_row, from_col, to_row, to_col, piece)

        if not is_jump and jumped_piece is None:
            # Regular move
            game['board'][to_row][to_col] = piece
            game['board'][from_row][from_col] = None
        elif is_jump and jumped_piece:
            # Jump move - remove jumped piece
            game['board'][to_row][to_col] = piece
            game['board'][from_row][from_col] = None
            game['board'][jumped_piece[0]][jumped_piece[1]] = None
        else:
            return {'success': False, 'error': 'Invalid move'}

        # Check for king promotion
        if (current_color == 'black' and to_row == 0) or (current_color == 'red' and to_row == 7):
            game['board'][to_row][to_col]['king'] = True

        game['moves_count'] += 1

        # Check for winner (simplified - no pieces left)
        if not self._has_pieces(game['board'], 'red'):
            game['winner'] = 'black'
            game['game_over'] = True
        elif not self._has_pieces(game['board'], 'black'):
            game['winner'] = 'red'
            game['game_over'] = True
        else:
            # Switch turn
            game['current_player'] = 'red' if current_color == 'black' else 'black'

        return {'success': True, 'game_state': game}

    def _is_valid_move(
        self,
        board: Board,
        from_r: int,
        from_c: int,
        to_r: int,
        to_c: int,
        piece: Piece,
    ) -> Tuple[bool, Optional[Tuple[int, int]]]:
        """Check if move is valid - returns (is_jump, jumped_piece_position)"""
        row_diff = abs(to_r - from_r)
        col_diff = abs(to_c - from_c)

        # Regular move (1 diagonal)
        if row_diff == 1 and col_diff == 1:
            # Check direction (non-kings can only move forward)
            if not piece['king']:
                if piece['color'] == 'black' and to_r >= from_r:
                    return False, None
                if piece['color'] == 'red' and to_r <= from_r:
                    return False, None
            return False, None

        # Jump move (2 diagonal)
        if row_diff == 2 and col_diff == 2:
            mid_r = (from_r + to_r) // 2
            mid_c = (from_c + to_c) // 2
            mid_piece = board[mid_r][mid_c]

            if mid_piece and mid_piece['color'] != piece['color']:
                return True, (mid_r, mid_c)

        return False, None

    def _has_pieces(self, board: Board, color: str) -> bool:
        """Check if player has any pieces left"""
        for row in board:
            for cell in row:
                if cell and cell['color'] == color:
                    return True
        return False

    def get_state_for_player(self, player_id: str) -> Dict[str, Any]:
        """Get game state for player"""
        game = checkers_games.get(self.room.room_code, {})
        return {
            'board': game.get('board'),
            'current_player': game.get('current_player'),
            'your_color': 'red' if player_id == game.get('red_player') else 'black',
            'winner': game.get('winner'),
            'game_over': game.get('game_over', False),
        }

    def is_game_over(self) -> bool:
        game = checkers_games.get(self.room.room_code)
        return game.get('game_over', False) if game else False

    def get_winner(self) -> Optional[str]:
        game = checkers_games.get(self.room.room_code)
        return game.get('winner') if game else None


# Helper functions
def create_checkers_game(room_code: str, host_id: str, guest_id: str) -> GameState:
    """Create new Checkers game"""
    board: Board = [[None for _ in range(8)] for _ in range(8)]

    for row in range(3):
        for col in range(8):
            if (row + col) % 2 == 1:
                board[row][col] = {'color': 'red', 'king': False}

    for row in range(5, 8):
        for col in range(8):
            if (row + col) % 2 == 1:
                board[row][col] = {'color': 'black', 'king': False}

    game_state: GameState = {
        'board': board,
        'current_player': 'black',
        'red_player': host_id,
        'black_player': guest_id,
        'winner': None,
        'game_over': False,
        'moves_count': 0,
    }
    checkers_games[room_code] = game_state
    return game_state

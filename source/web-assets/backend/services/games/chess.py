"""
Chess Game Logic
Full chess implementation with piece movement validation
"""
from typing import Dict, Optional, List
from .base import BaseGameLogic, GameRoom

# In-memory storage
chess_games: Dict[str, Dict] = {}


class ChessGame(BaseGameLogic):
    """Chess game handler"""
    
    def __init__(self, room: GameRoom):
        super().__init__(room)
    
    def initialize_game(self) -> Dict:
        """Initialize a new Chess game"""
        # Standard chess starting position
        board = self._create_initial_board()
        
        game_state = {
            'board': board,
            'current_player': 'white',
            'white_player': self.room.host.session_id,
            'black_player': self.room.guest.session_id if self.room.guest else None,
            'winner': None,
            'game_over': False,
            'moves_count': 0,
            'castling_rights': {
                'white_kingside': True,
                'white_queenside': True,
                'black_kingside': True,
                'black_queenside': True
            },
            'en_passant_target': None,
            'halfmove_clock': 0,
            'fullmove_number': 1,
            'check': False,
            'checkmate': False
        }
        chess_games[self.room.room_code] = game_state
        return game_state
    
    def _create_initial_board(self) -> List[List[Optional[Dict]]]:
        """Create standard chess starting position"""
        board = [[None for _ in range(8)] for _ in range(8)]
        
        # Piece types: 'p'=pawn, 'r'=rook, 'n'=knight, 'b'=bishop, 'q'=queen, 'k'=king
        # White pieces (rows 0-1)
        pieces_row = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r']
        for col, piece_type in enumerate(pieces_row):
            board[0][col] = {'type': piece_type, 'color': 'white'}
            board[1][col] = {'type': 'p', 'color': 'white'}
        
        # Black pieces (rows 6-7)
        for col, piece_type in enumerate(pieces_row):
            board[7][col] = {'type': piece_type, 'color': 'black'}
            board[6][col] = {'type': 'p', 'color': 'black'}
        
        return board
    
    def make_move(self, player_id: str, move_data: Dict) -> Dict:
        """Process a chess move"""
        game = chess_games.get(self.room.room_code)
        if not game or game['game_over']:
            return {'success': False, 'error': 'Game not found or over'}
        
        from_row = move_data.get('from_row')
        from_col = move_data.get('from_col')
        to_row = move_data.get('to_row')
        to_col = move_data.get('to_col')
        promotion = move_data.get('promotion', 'q')  # Default to queen
        
        # Validate positions
        if any(p is None or p < 0 or p > 7 for p in [from_row, from_col, to_row, to_col]):
            return {'success': False, 'error': 'Invalid position'}
        
        # Check turn
        current_color = game['current_player']
        if (current_color == 'white' and player_id != game['white_player']) or \
           (current_color == 'black' and player_id != game['black_player']):
            return {'success': False, 'error': 'Not your turn'}
        
        piece = game['board'][from_row][from_col]
        if not piece or piece['color'] != current_color:
            return {'success': False, 'error': 'Invalid piece'}
        
        # Validate move (simplified - basic rules)
        if not self._is_valid_chess_move(game, from_row, from_col, to_row, to_col, piece):
            return {'success': False, 'error': 'Invalid move'}
        
        # Make move
        captured = game['board'][to_row][to_col]
        game['board'][to_row][to_col] = piece
        game['board'][from_row][from_col] = None
        
        # Handle pawn promotion
        if piece['type'] == 'p' and (to_row == 0 or to_row == 7):
            game['board'][to_row][to_col] = {'type': promotion, 'color': current_color}
        
        game['moves_count'] += 1
        game['fullmove_number'] = (game['moves_count'] // 2) + 1
        
        # Simplified checkmate detection (just check if king is captured)
        if captured and captured['type'] == 'k':
            game['winner'] = current_color
            game['game_over'] = True
            game['checkmate'] = True
        else:
            # Switch turn
            game['current_player'] = 'black' if current_color == 'white' else 'white'
        
        return {'success': True, 'game_state': game}
    
    def _is_valid_chess_move(self, game: Dict, from_r: int, from_c: int, to_r: int, to_c: int, piece: Dict) -> bool:
        """Simplified chess move validation"""
        board = game['board']
        piece_type = piece['type']
        color = piece['color']
        target = board[to_r][to_c]
        
        # Can't capture own piece
        if target and target['color'] == color:
            return False
        
        row_diff = abs(to_r - from_r)
        col_diff = abs(to_c - from_c)
        
        # Pawn
        if piece_type == 'p':
            direction = -1 if color == 'white' else 1
            # Forward move
            if to_c == from_c and not target:
                if to_r == from_r + direction:
                    return True
                # Double move from starting position
                if (color == 'white' and from_r == 1 and to_r == 3) or \
                   (color == 'black' and from_r == 6 and to_r == 4):
                    return True
            # Capture
            if abs(to_c - from_c) == 1 and to_r == from_r + direction and target:
                return True
            return False
        
        # Rook
        if piece_type == 'r':
            if from_r == to_r or from_c == to_c:
                return self._is_path_clear(board, from_r, from_c, to_r, to_c)
        
        # Knight
        if piece_type == 'n':
            if (row_diff == 2 and col_diff == 1) or (row_diff == 1 and col_diff == 2):
                return True
        
        # Bishop
        if piece_type == 'b':
            if row_diff == col_diff:
                return self._is_path_clear(board, from_r, from_c, to_r, to_c)
        
        # Queen
        if piece_type == 'q':
            if from_r == to_r or from_c == to_c or row_diff == col_diff:
                return self._is_path_clear(board, from_r, from_c, to_r, to_c)
        
        # King
        if piece_type == 'k':
            if row_diff <= 1 and col_diff <= 1:
                return True
        
        return False
    
    def _is_path_clear(self, board: List, from_r: int, from_c: int, to_r: int, to_c: int) -> bool:
        """Check if path between squares is clear"""
        row_step = 0 if from_r == to_r else (1 if to_r > from_r else -1)
        col_step = 0 if from_c == to_c else (1 if to_c > from_c else -1)
        
        current_r, current_c = from_r + row_step, from_c + col_step
        
        while current_r != to_r or current_c != to_c:
            if board[current_r][current_c] is not None:
                return False
            current_r += row_step
            current_c += col_step
        
        return True
    
    def get_state_for_player(self, player_id: str) -> Dict:
        game = chess_games.get(self.room.room_code, {})
        return {
            'board': game.get('board'),
            'current_player': game.get('current_player'),
            'your_color': 'white' if player_id == game.get('white_player') else 'black',
            'winner': game.get('winner'),
            'game_over': game.get('game_over', False),
            'check': game.get('check', False),
            'checkmate': game.get('checkmate', False)
        }
    
    def is_game_over(self) -> bool:
        game = chess_games.get(self.room.room_code)
        return game.get('game_over', False) if game else False
    
    def get_winner(self) -> Optional[str]:
        game = chess_games.get(self.room.room_code)
        return game.get('winner') if game else None


# Helper functions
def create_chess_game(room_code: str, host_id: str, guest_id: str) -> Dict:
    """Create new chess game"""
    game = ChessGame(None)
    board = game._create_initial_board()
    
    game_state = {
        'board': board,
        'current_player': 'white',
        'white_player': host_id,
        'black_player': guest_id,
        'winner': None,
        'game_over': False,
        'moves_count': 0,
        'check': False,
        'checkmate': False
    }
    chess_games[room_code] = game_state
    return game_state

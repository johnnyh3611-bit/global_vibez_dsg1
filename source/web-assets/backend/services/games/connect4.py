"""
Connect 4 Game Logic
7x6 grid game for 2 players
"""
from typing import Dict, Optional, List
from .base import BaseGameLogic, GameRoom

# In-memory storage for Connect 4 games
connect4_games: Dict[str, Dict] = {}

ROWS = 6
COLS = 7


class Connect4Game(BaseGameLogic):
    """Connect 4 game handler"""
    
    def __init__(self, room: GameRoom):
        super().__init__(room)
    
    def initialize_game(self) -> Dict:
        """Initialize a new Connect 4 game"""
        game_state: Dict = {
            'board': [[None for _ in range(COLS)] for _ in range(ROWS)],
            'current_player': 'red',
            'red_player': self.room.host.session_id,
            'yellow_player': self.room.guest.session_id if self.room.guest else None,
            'winner': None,
            'game_over': False,
            'moves_count': 0
        }
        connect4_games[self.room.room_code] = game_state
        return game_state
    
    def make_move(self, player_id: str, move_data: Dict) -> Dict:
        """Process a player move (drop disc in column)"""
        game = connect4_games.get(self.room.room_code)
        if not game or game['game_over']:
            return {'success': False, 'error': 'Game not found or already over'}
        
        col = move_data.get('col')
        
        # Validate column
        if col is None or col < 0 or col >= COLS:
            return {'success': False, 'error': 'Invalid column'}
        
        # Check if column is full
        if game['board'][0][col] is not None:
            return {'success': False, 'error': 'Column is full'}
        
        # Check if it's player's turn
        current_color = game['current_player']
        if (current_color == 'red' and player_id != game['red_player']) or \
           (current_color == 'yellow' and player_id != game['yellow_player']):
            return {'success': False, 'error': 'Not your turn'}
        
        # Drop disc to lowest available row
        row = self._get_lowest_row(game['board'], col)
        if row is None:
            return {'success': False, 'error': 'Column is full'}
        
        game['board'][row][col] = current_color
        game['moves_count'] += 1
        
        # Check for winner
        if self._check_winner(game['board'], row, col, current_color):
            game['winner'] = current_color
            game['game_over'] = True
        elif game['moves_count'] == ROWS * COLS:
            game['game_over'] = True
            game['winner'] = 'draw'
        else:
            # Switch turn
            game['current_player'] = 'yellow' if current_color == 'red' else 'red'
        
        return {'success': True, 'game_state': game, 'row': row}
    
    def _get_lowest_row(self, board: List[List[Optional[str]]], col: int) -> Optional[int]:
        """Get lowest available row in column"""
        for row in range(ROWS - 1, -1, -1):
            if board[row][col] is None:
                return row
        return None
    
    def _check_winner(self, board: List[List[Optional[str]]], row: int, col: int, color: str) -> bool:
        """Check if last move resulted in a win"""
        # Check horizontal
        count = 1
        # Check left
        for c in range(col - 1, -1, -1):
            if board[row][c] == color:
                count += 1
            else:
                break
        # Check right
        for c in range(col + 1, COLS):
            if board[row][c] == color:
                count += 1
            else:
                break
        if count >= 4:
            return True
        
        # Check vertical
        count = 1
        for r in range(row + 1, ROWS):
            if board[r][col] == color:
                count += 1
            else:
                break
        if count >= 4:
            return True
        
        # Check diagonal (top-left to bottom-right)
        count = 1
        r, c = row - 1, col - 1
        while r >= 0 and c >= 0 and board[r][c] == color:
            count += 1
            r -= 1
            c -= 1
        r, c = row + 1, col + 1
        while r < ROWS and c < COLS and board[r][c] == color:
            count += 1
            r += 1
            c += 1
        if count >= 4:
            return True
        
        # Check diagonal (bottom-left to top-right)
        count = 1
        r, c = row + 1, col - 1
        while r < ROWS and c >= 0 and board[r][c] == color:
            count += 1
            r += 1
            c -= 1
        r, c = row - 1, col + 1
        while r >= 0 and c < COLS and board[r][c] == color:
            count += 1
            r -= 1
            c += 1
        if count >= 4:
            return True
        
        return False
    
    def get_state_for_player(self, player_id: str) -> Dict:
        """Get game state for specific player"""
        game = connect4_games.get(self.room.room_code, {})
        return {
            'board': game.get('board'),
            'current_player': game.get('current_player'),
            'your_color': 'red' if player_id == game.get('red_player') else 'yellow',
            'winner': game.get('winner'),
            'game_over': game.get('game_over', False)
        }
    
    def is_game_over(self) -> bool:
        """Check if game is over"""
        game = connect4_games.get(self.room.room_code)
        return game.get('game_over', False) if game else False
    
    def get_winner(self) -> Optional[str]:
        """Get winner if game is over"""
        game = connect4_games.get(self.room.room_code)
        return game.get('winner') if game else None


# Helper functions
def create_connect4_game(room_code: str, host_id: str, guest_id: str) -> Dict:
    """Create a new Connect 4 game"""
    game_state = {
        'board': [[None for _ in range(COLS)] for _ in range(ROWS)],
        'current_player': 'red',
        'red_player': host_id,
        'yellow_player': guest_id,
        'winner': None,
        'game_over': False,
        'moves_count': 0
    }
    connect4_games[room_code] = game_state
    return game_state


def make_connect4_move(room_code: str, player_id: str, col: int) -> Optional[Dict]:
    """Make a move in Connect 4"""
    game = connect4_games.get(room_code)
    if not game or game['game_over']:
        return None
    
    if col < 0 or col >= COLS or game['board'][0][col] is not None:
        return None
    
    current_color = game['current_player']
    if (current_color == 'red' and player_id != game['red_player']) or \
       (current_color == 'yellow' and player_id != game['yellow_player']):
        return None
    
    # Find lowest row
    row = None
    for r in range(ROWS - 1, -1, -1):
        if game['board'][r][col] is None:
            row = r
            break
    
    if row is None:
        return None
    
    game['board'][row][col] = current_color
    game['moves_count'] += 1
    
    # Check winner (simplified - check after each move)
    if _check_connect4_winner(game['board'], row, col, current_color):
        game['winner'] = current_color
        game['game_over'] = True
    elif game['moves_count'] == ROWS * COLS:
        game['game_over'] = True
        game['winner'] = 'draw'
    else:
        game['current_player'] = 'yellow' if current_color == 'red' else 'red'
    
    return game


def _check_connect4_winner(board: List[List[Optional[str]]], row: int, col: int, color: str) -> bool:
    """Simplified winner check"""
    # This is a simplified version - full logic in the class
    return False  # Placeholder

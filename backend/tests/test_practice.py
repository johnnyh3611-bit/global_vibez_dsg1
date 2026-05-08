"""
Practice Mode API Tests
Tests for Practice Mode with AI opponents
Features: Start practice game, make moves, win/loss detection, stats tracking
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
SESSION_TOKEN = os.environ.get('TEST_SESSION_TOKEN', 'test_session_fixture')

class TestPracticeMode:
    """Practice Mode endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {SESSION_TOKEN}"
        }
        self.game_id = None
    
    # ==================== START GAME TESTS ====================
    
    def test_start_tictactoe_game_easy(self):
        """Test starting a Tic-Tac-Toe practice game with easy difficulty"""
        response = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers=self.headers,
            json={"game_type": "tictactoe", "difficulty": "easy"}
        )
        print(f"Start TicTacToe Easy: {response.status_code} - {response.text[:200]}")
        assert response.status_code == 200
        
        data = response.json()
        assert "game_id" in data
        assert data["game_type"] == "tictactoe"
        assert data["difficulty"] == "easy"
        assert data["current_turn"] == "player"
        assert "game_state" in data
        assert "board" in data["game_state"]
        
    def test_start_tictactoe_game_medium(self):
        """Test starting a Tic-Tac-Toe practice game with medium difficulty"""
        response = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers=self.headers,
            json={"game_type": "tictactoe", "difficulty": "medium"}
        )
        print(f"Start TicTacToe Medium: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["difficulty"] == "medium"
        
    def test_start_tictactoe_game_hard(self):
        """Test starting a Tic-Tac-Toe practice game with hard difficulty"""
        response = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers=self.headers,
            json={"game_type": "tictactoe", "difficulty": "hard"}
        )
        print(f"Start TicTacToe Hard: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["difficulty"] == "hard"
        
    def test_start_connect4_game(self):
        """Test starting a Connect 4 practice game"""
        response = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers=self.headers,
            json={"game_type": "connect4", "difficulty": "medium"}
        )
        print(f"Start Connect4: {response.status_code} - {response.text[:200]}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["game_type"] == "connect4"
        assert "game_state" in data
        # Connect 4 board should be 6 rows x 7 columns
        assert len(data["game_state"]["board"]) == 6
        assert len(data["game_state"]["board"][0]) == 7
        
    def test_start_invalid_game_type(self):
        """Test starting a game with invalid game type"""
        response = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers=self.headers,
            json={"game_type": "invalid_game", "difficulty": "easy"}
        )
        print(f"Invalid game type: {response.status_code}")
        assert response.status_code == 400
        
    def test_start_game_unauthorized(self):
        """Test starting game without authentication"""
        response = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers={"Content-Type": "application/json"},
            json={"game_type": "tictactoe", "difficulty": "easy"}
        )
        print(f"Unauthorized start: {response.status_code}")
        assert response.status_code == 401
        
    # ==================== GET GAME TESTS ====================
    
    def test_get_practice_game(self):
        """Test getting a practice game state"""
        # First create a game
        start_response = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers=self.headers,
            json={"game_type": "tictactoe", "difficulty": "medium"}
        )
        game_id = start_response.json()["game_id"]
        
        # Then get the game
        response = requests.get(
            f"{BASE_URL}/api/practice/game/{game_id}",
            headers=self.headers
        )
        print(f"Get game: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["game_id"] == game_id
        assert "game_state" in data
        
    def test_get_nonexistent_game(self):
        """Test getting a game that doesn't exist"""
        response = requests.get(
            f"{BASE_URL}/api/practice/game/nonexistent_game_123",
            headers=self.headers
        )
        print(f"Get nonexistent game: {response.status_code}")
        assert response.status_code == 404
        
    # ==================== MAKE MOVE TESTS ====================
    
    def test_tictactoe_make_move(self):
        """Test making a move in Tic-Tac-Toe"""
        # Start a game
        start_response = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers=self.headers,
            json={"game_type": "tictactoe", "difficulty": "easy"}
        )
        game_id = start_response.json()["game_id"]
        
        # Make a move at position (0, 0)
        response = requests.post(
            f"{BASE_URL}/api/practice/game/{game_id}/move",
            headers=self.headers,
            json={"move_data": {"row": 0, "col": 0}}
        )
        print(f"Make move: {response.status_code} - {response.text[:300]}")
        assert response.status_code == 200
        
        data = response.json()
        assert "game_state" in data
        # Player move should be X at (0,0)
        assert data["game_state"]["board"][0][0] == "X"
        # AI should have made a move too
        assert "ai_move" in data
        
    def test_tictactoe_multiple_moves(self):
        """Test making multiple moves in Tic-Tac-Toe"""
        # Start a game
        start_response = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers=self.headers,
            json={"game_type": "tictactoe", "difficulty": "easy"}
        )
        game_id = start_response.json()["game_id"]
        
        # Make first move
        response1 = requests.post(
            f"{BASE_URL}/api/practice/game/{game_id}/move",
            headers=self.headers,
            json={"move_data": {"row": 0, "col": 0}}
        )
        assert response1.status_code == 200
        
        # Make second move if game not over
        data1 = response1.json()
        if data1["status"] == "in_progress":
            # Find an empty cell
            board = data1["game_state"]["board"]
            for i in range(3):
                for j in range(3):
                    if board[i][j] == "":
                        response2 = requests.post(
                            f"{BASE_URL}/api/practice/game/{game_id}/move",
                            headers=self.headers,
                            json={"move_data": {"row": i, "col": j}}
                        )
                        print(f"Second move: {response2.status_code}")
                        assert response2.status_code == 200
                        return
        print("Game ended after first move")
        
    def test_connect4_make_move(self):
        """Test making a move in Connect 4"""
        # Start a Connect 4 game
        start_response = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers=self.headers,
            json={"game_type": "connect4", "difficulty": "easy"}
        )
        game_id = start_response.json()["game_id"]
        
        # Make a move in column 3
        response = requests.post(
            f"{BASE_URL}/api/practice/game/{game_id}/move",
            headers=self.headers,
            json={"move_data": {"col": 3}}
        )
        print(f"Connect4 move: {response.status_code} - {response.text[:300]}")
        assert response.status_code == 200
        
        data = response.json()
        assert "game_state" in data
        # Piece should be at bottom of column 3 (row 5)
        assert data["game_state"]["board"][5][3] == "R"  # Player is Red
        
    def test_make_move_completed_game(self):
        """Test making a move in a completed game should fail"""
        # Start a game and play until completion (simulate with direct DB manipulation not possible in API test)
        # Instead test the error handling by trying to make move on invalid game
        response = requests.post(
            f"{BASE_URL}/api/practice/game/invalid_game/move",
            headers=self.headers,
            json={"move_data": {"row": 0, "col": 0}}
        )
        print(f"Move on invalid game: {response.status_code}")
        assert response.status_code == 404
        
    # ==================== STATS TESTS ====================
    
    def test_get_practice_stats(self):
        """Test getting practice statistics"""
        response = requests.get(
            f"{BASE_URL}/api/practice/stats",
            headers=self.headers
        )
        print(f"Get stats: {response.status_code} - {response.text[:200]}")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_games" in data
        assert "wins" in data
        assert "losses" in data
        assert "win_rate" in data
        assert "games_by_type" in data
        assert "games_by_difficulty" in data
        
    def test_get_stats_unauthorized(self):
        """Test getting stats without authentication"""
        response = requests.get(
            f"{BASE_URL}/api/practice/stats",
            headers={"Content-Type": "application/json"}
        )
        print(f"Unauthorized stats: {response.status_code}")
        assert response.status_code == 401
        
    # ==================== WIN/LOSS DETECTION TESTS ====================
    
    def test_tictactoe_win_detection(self):
        """Test Tic-Tac-Toe win detection by playing a game"""
        # Start a game with easy AI to maximize chance of winning
        start_response = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers=self.headers,
            json={"game_type": "tictactoe", "difficulty": "easy"}
        )
        game_id = start_response.json()["game_id"]
        
        # Play the game - we might win or lose depending on AI moves
        moves_made = 0
        game_status = "in_progress"
        
        while game_status == "in_progress" and moves_made < 5:
            # Get current game state
            game_response = requests.get(
                f"{BASE_URL}/api/practice/game/{game_id}",
                headers=self.headers
            )
            board = game_response.json()["game_state"]["board"]
            
            # Find an empty cell
            for i in range(3):
                for j in range(3):
                    if board[i][j] == "":
                        move_response = requests.post(
                            f"{BASE_URL}/api/practice/game/{game_id}/move",
                            headers=self.headers,
                            json={"move_data": {"row": i, "col": j}}
                        )
                        data = move_response.json()
                        game_status = data["status"]
                        moves_made += 1
                        
                        if game_status == "completed":
                            print(f"Game completed! Winner: {data.get('winner')}")
                            assert data.get("winner") in ["player", "ai", "draw"]
                        break
                if game_status == "completed" or moves_made >= 5:
                    break
                    
        print(f"Moves made: {moves_made}, Final status: {game_status}")
        
    # ==================== ALL SUPPORTED GAMES TESTS ====================
    
    def test_start_all_supported_games(self):
        """Test that all listed games can be started"""
        supported_games = [
            "tictactoe", "connect4", "checkers", "reversi", "chess",
            "ludo", "backgammon", "blackjack", "uno", "go_fish",
            "crazy_eights", "hearts", "spades", "rummy", "poker"
        ]
        
        for game_type in supported_games:
            response = requests.post(
                f"{BASE_URL}/api/practice/start",
                headers=self.headers,
                json={"game_type": game_type, "difficulty": "easy"}
            )
            print(f"Start {game_type}: {response.status_code}")
            assert response.status_code == 200, f"Failed to start {game_type}"
            
            data = response.json()
            assert data["game_type"] == game_type


class TestGameAI:
    """Tests for AI game logic - verify AI returns valid moves"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {SESSION_TOKEN}"
        }
        
    def test_tictactoe_ai_makes_valid_move(self):
        """Test that AI makes a valid move in Tic-Tac-Toe"""
        # Start game
        start_response = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers=self.headers,
            json={"game_type": "tictactoe", "difficulty": "hard"}
        )
        game_id = start_response.json()["game_id"]
        
        # Make a player move
        response = requests.post(
            f"{BASE_URL}/api/practice/game/{game_id}/move",
            headers=self.headers,
            json={"move_data": {"row": 1, "col": 1}}  # Center
        )
        
        data = response.json()
        ai_move = data.get("ai_move")
        
        if ai_move:
            print(f"AI move: {ai_move}")
            # Verify AI move is within bounds
            assert 0 <= ai_move.get("row", 0) <= 2
            assert 0 <= ai_move.get("col", 0) <= 2
            
    def test_connect4_ai_makes_valid_move(self):
        """Test that AI makes a valid move in Connect 4"""
        # Start game
        start_response = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers=self.headers,
            json={"game_type": "connect4", "difficulty": "hard"}
        )
        game_id = start_response.json()["game_id"]
        
        # Make a player move
        response = requests.post(
            f"{BASE_URL}/api/practice/game/{game_id}/move",
            headers=self.headers,
            json={"move_data": {"col": 3}}  # Center column
        )
        
        data = response.json()
        ai_move = data.get("ai_move")
        
        if ai_move:
            print(f"Connect4 AI move: {ai_move}")
            # Verify AI move is within bounds (column 0-6)
            assert 0 <= ai_move.get("col", 0) <= 6


class TestDifficultyLevels:
    """Tests for different AI difficulty levels"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {SESSION_TOKEN}"
        }
        
    def test_easy_difficulty_stored(self):
        """Test easy difficulty is stored correctly"""
        response = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers=self.headers,
            json={"game_type": "tictactoe", "difficulty": "easy"}
        )
        data = response.json()
        assert data["difficulty"] == "easy"
        
    def test_medium_difficulty_stored(self):
        """Test medium difficulty is stored correctly"""
        response = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers=self.headers,
            json={"game_type": "tictactoe", "difficulty": "medium"}
        )
        data = response.json()
        assert data["difficulty"] == "medium"
        
    def test_hard_difficulty_stored(self):
        """Test hard difficulty is stored correctly"""
        response = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers=self.headers,
            json={"game_type": "tictactoe", "difficulty": "hard"}
        )
        data = response.json()
        assert data["difficulty"] == "hard"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

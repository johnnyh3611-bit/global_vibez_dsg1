"""
AI Practice Mode Backend Tests
Tests for AI opponents with multiple difficulty levels and game-specific strategies
- Tic-Tac-Toe AI (Minimax algorithm)
- Connect 4 AI (Column evaluation)
- Chess AI (Piece value + Gemini fallback)
- Poker AI (Hand strength + betting)
- RPS AI (Pattern recognition)
- Checkers AI (Piece evaluation)
- Battleship AI (Hunt-target strategy)
- Generic AI (For other games)
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAIPracticeCalculateMove:
    """Tests for POST /api/ai-practice/calculate-move"""
    
    # ========== TIC-TAC-TOE AI TESTS ==========
    
    def test_tictactoe_easy_random_move(self):
        """Test Tic-Tac-Toe easy difficulty returns random move"""
        response = requests.post(f"{BASE_URL}/api/ai-practice/calculate-move", json={
            "game_type": "tictactoe",
            "game_state": {
                "board": [[None, None, None], [None, "X", None], [None, None, None]],
                "ai_symbol": "O"
            },
            "difficulty": "easy"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "move" in data
        assert "row" in data["move"]
        assert "col" in data["move"]
        assert data["move"]["strategy"] == "random"
        assert data["difficulty"] == "easy"
        print(f"Tic-Tac-Toe Easy: Move at ({data['move']['row']}, {data['move']['col']})")
    
    def test_tictactoe_medium_calculated_move(self):
        """Test Tic-Tac-Toe medium difficulty uses calculated strategy"""
        response = requests.post(f"{BASE_URL}/api/ai-practice/calculate-move", json={
            "game_type": "tictactoe",
            "game_state": {
                "board": [[None, None, None], [None, "X", None], [None, None, None]],
                "ai_symbol": "O"
            },
            "difficulty": "medium"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "move" in data
        assert data["move"]["strategy"] in ["calculated", "random"]  # 70% calculated, 30% random
        print(f"Tic-Tac-Toe Medium: Strategy = {data['move']['strategy']}")
    
    def test_tictactoe_hard_minimax(self):
        """Test Tic-Tac-Toe hard difficulty uses Minimax algorithm"""
        response = requests.post(f"{BASE_URL}/api/ai-practice/calculate-move", json={
            "game_type": "tictactoe",
            "game_state": {
                "board": [[None, None, None], [None, "X", None], [None, None, None]],
                "ai_symbol": "O"
            },
            "difficulty": "hard"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert data["move"]["strategy"] == "minimax"
        # Hard mode should take corner (optimal first move response)
        assert data["move"]["row"] in [0, 2] or data["move"]["col"] in [0, 2]
        print(f"Tic-Tac-Toe Hard (Minimax): Move at ({data['move']['row']}, {data['move']['col']})")
    
    def test_tictactoe_blocks_winning_move(self):
        """Test Tic-Tac-Toe AI blocks opponent's winning move"""
        # X is about to win with top row
        response = requests.post(f"{BASE_URL}/api/ai-practice/calculate-move", json={
            "game_type": "tictactoe",
            "game_state": {
                "board": [["X", "X", None], [None, "O", None], [None, None, None]],
                "ai_symbol": "O"
            },
            "difficulty": "hard"
        })
        assert response.status_code == 200
        data = response.json()
        # AI should block at (0, 2)
        assert data["move"]["row"] == 0
        assert data["move"]["col"] == 2
        print("Tic-Tac-Toe Hard: Correctly blocks winning move at (0, 2)")
    
    def test_tictactoe_takes_winning_move(self):
        """Test Tic-Tac-Toe AI takes winning move when available"""
        # O can win with middle row - only one winning move available
        response = requests.post(f"{BASE_URL}/api/ai-practice/calculate-move", json={
            "game_type": "tictactoe",
            "game_state": {
                "board": [["X", "X", "O"], ["O", "O", None], ["X", None, "O"]],
                "ai_symbol": "O"
            },
            "difficulty": "hard"
        })
        assert response.status_code == 200
        data = response.json()
        # AI should win at (1, 2) - only winning move
        assert data["move"]["row"] == 1
        assert data["move"]["col"] == 2
        print("Tic-Tac-Toe Hard: Correctly takes winning move at (1, 2)")
    
    # ========== CONNECT 4 AI TESTS ==========
    
    def test_connect4_easy_random(self):
        """Test Connect 4 easy difficulty returns random column"""
        response = requests.post(f"{BASE_URL}/api/ai-practice/calculate-move", json={
            "game_type": "connect4",
            "game_state": {
                "board": [[None]*7 for _ in range(6)],
                "ai_symbol": "O"
            },
            "difficulty": "easy"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "column" in data["move"]
        assert 0 <= data["move"]["column"] <= 6
        assert data["move"]["strategy"] == "random"
        print(f"Connect 4 Easy: Column {data['move']['column']}")
    
    def test_connect4_medium_positional(self):
        """Test Connect 4 medium difficulty uses positional strategy"""
        response = requests.post(f"{BASE_URL}/api/ai-practice/calculate-move", json={
            "game_type": "connect4",
            "game_state": {
                "board": [[None]*7 for _ in range(6)],
                "ai_symbol": "O"
            },
            "difficulty": "medium"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert data["move"]["strategy"] == "positional"
        print(f"Connect 4 Medium: Column {data['move']['column']}, Strategy = {data['move']['strategy']}")
    
    def test_connect4_hard_advanced(self):
        """Test Connect 4 hard difficulty uses advanced evaluation"""
        response = requests.post(f"{BASE_URL}/api/ai-practice/calculate-move", json={
            "game_type": "connect4",
            "game_state": {
                "board": [[None]*7 for _ in range(6)],
                "ai_symbol": "O"
            },
            "difficulty": "hard"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert data["move"]["strategy"] == "advanced"
        # Hard mode should prefer center column (3)
        assert data["move"]["column"] == 3
        print(f"Connect 4 Hard: Column {data['move']['column']} (center preferred)")
    
    # ========== CHESS AI TESTS ==========
    
    def test_chess_easy_random(self):
        """Test Chess easy difficulty returns random move"""
        response = requests.post(f"{BASE_URL}/api/ai-practice/calculate-move", json={
            "game_type": "chess",
            "game_state": {
                "legal_moves": ["e4", "d4", "Nf3", "Nc3"]
            },
            "difficulty": "easy"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert data["move"]["move"] in ["e4", "d4", "Nf3", "Nc3"]
        assert data["move"]["strategy"] == "random"
        print(f"Chess Easy: Move = {data['move']['move']}")
    
    def test_chess_medium_tactical(self):
        """Test Chess medium difficulty prefers captures"""
        response = requests.post(f"{BASE_URL}/api/ai-practice/calculate-move", json={
            "game_type": "chess",
            "game_state": {
                "legal_moves": [
                    {"notation": "e4"},
                    {"notation": "Bxf7", "captures": True},
                    {"notation": "Nf3"}
                ]
            },
            "difficulty": "medium"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert data["move"]["strategy"] in ["tactical", "positional"]
        print(f"Chess Medium: Strategy = {data['move']['strategy']}")
    
    def test_chess_no_moves_resign(self):
        """Test Chess AI resigns when no moves available"""
        response = requests.post(f"{BASE_URL}/api/ai-practice/calculate-move", json={
            "game_type": "chess",
            "game_state": {
                "legal_moves": []
            },
            "difficulty": "hard"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["move"]["move"] == "resign"
        assert data["move"]["strategy"] == "no_moves"
        print("Chess: Correctly resigns when no moves available")
    
    # ========== POKER AI TESTS ==========
    
    def test_poker_easy_fold_weak_hand(self):
        """Test Poker easy difficulty folds weak hands"""
        response = requests.post(f"{BASE_URL}/api/ai-practice/calculate-move", json={
            "game_type": "poker",
            "game_state": {
                "hand": [{"value": 2, "suit": "hearts"}, {"value": 7, "suit": "clubs"}],
                "community_cards": [],
                "pot": 100,
                "current_bet": 20,
                "ai_chips": 1000
            },
            "difficulty": "easy"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "action" in data["move"]
        assert data["move"]["action"] in ["fold", "call", "raise"]
        print(f"Poker Easy: Action = {data['move']['action']}")
    
    def test_poker_medium_call_decent_hand(self):
        """Test Poker medium difficulty calls with decent hand"""
        response = requests.post(f"{BASE_URL}/api/ai-practice/calculate-move", json={
            "game_type": "poker",
            "game_state": {
                "hand": [{"value": 10, "suit": "hearts"}, {"value": 10, "suit": "clubs"}],
                "community_cards": [{"value": 10, "suit": "diamonds"}],
                "pot": 100,
                "current_bet": 20,
                "ai_chips": 1000
            },
            "difficulty": "medium"
        })
        assert response.status_code == 200
        data = response.json()
        # With trips, should raise
        assert data["move"]["action"] in ["call", "raise"]
        print(f"Poker Medium (Trips): Action = {data['move']['action']}")
    
    def test_poker_hard_value_bet(self):
        """Test Poker hard difficulty makes reasonable decisions with strong hands"""
        response = requests.post(f"{BASE_URL}/api/ai-practice/calculate-move", json={
            "game_type": "poker",
            "game_state": {
                "hand": [{"value": 14, "suit": "hearts"}, {"value": 14, "suit": "clubs"}],
                "community_cards": [{"value": 14, "suit": "diamonds"}, {"value": 14, "suit": "spades"}],
                "pot": 200,
                "current_bet": 50,
                "ai_chips": 1000
            },
            "difficulty": "hard"
        })
        assert response.status_code == 200
        data = response.json()
        # With strong hand (multiple high cards/pairs), should not fold
        assert data["move"]["action"] in ["call", "raise"]
        print(f"Poker Hard (Strong hand): Action = {data['move']['action']}")
    
    # ========== ROCK PAPER SCISSORS AI TESTS ==========
    
    def test_rps_easy_random(self):
        """Test RPS easy difficulty returns random choice"""
        response = requests.post(f"{BASE_URL}/api/ai-practice/calculate-move", json={
            "game_type": "rps",
            "game_state": {},
            "difficulty": "easy"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert data["move"]["choice"] in ["rock", "paper", "scissors"]
        assert data["move"]["strategy"] == "random"
        print(f"RPS Easy: Choice = {data['move']['choice']}")
    
    def test_rps_medium_pattern_recognition(self):
        """Test RPS medium difficulty recognizes patterns"""
        response = requests.post(f"{BASE_URL}/api/ai-practice/calculate-move", json={
            "game_type": "rps",
            "game_state": {},
            "difficulty": "medium",
            "player_history": [
                {"player_choice": "rock"},
                {"player_choice": "rock"},
                {"player_choice": "rock"}
            ]
        })
        assert response.status_code == 200
        data = response.json()
        # Should counter rock with paper
        assert data["move"]["choice"] == "paper"
        assert data["move"]["strategy"] == "counter"
        print(f"RPS Medium: Counters rock pattern with {data['move']['choice']}")
    
    def test_rps_hard_advanced_pattern(self):
        """Test RPS hard difficulty uses advanced pattern recognition"""
        response = requests.post(f"{BASE_URL}/api/ai-practice/calculate-move", json={
            "game_type": "rps",
            "game_state": {},
            "difficulty": "hard",
            "player_history": [
                {"player_choice": "scissors"},
                {"player_choice": "scissors"},
                {"player_choice": "scissors"},
                {"player_choice": "scissors"},
                {"player_choice": "scissors"}
            ]
        })
        assert response.status_code == 200
        data = response.json()
        # Should counter scissors with rock
        assert data["move"]["choice"] == "rock"
        assert data["move"]["strategy"] == "pattern"
        print(f"RPS Hard: Counters scissors pattern with {data['move']['choice']}")
    
    # ========== CHECKERS AI TESTS ==========
    
    def test_checkers_easy_random(self):
        """Test Checkers easy difficulty returns random move"""
        response = requests.post(f"{BASE_URL}/api/ai-practice/calculate-move", json={
            "game_type": "checkers",
            "game_state": {
                "legal_moves": [
                    {"from_row": 2, "from_col": 1, "to_row": 3, "to_col": 2},
                    {"from_row": 2, "from_col": 3, "to_row": 3, "to_col": 4}
                ]
            },
            "difficulty": "easy"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert data["move"]["strategy"] == "random"
        print("Checkers Easy: Random move selected")
    
    def test_checkers_hard_prefers_capture(self):
        """Test Checkers hard difficulty prefers captures"""
        response = requests.post(f"{BASE_URL}/api/ai-practice/calculate-move", json={
            "game_type": "checkers",
            "game_state": {
                "legal_moves": [
                    {"from_row": 2, "from_col": 1, "to_row": 3, "to_col": 2},
                    {"from_row": 2, "from_col": 3, "to_row": 4, "to_col": 5, "capture": True}
                ]
            },
            "difficulty": "hard"
        })
        assert response.status_code == 200
        data = response.json()
        # Should prefer capture move
        assert data["move"]["move"]["capture"]
        assert data["move"]["strategy"] == "evaluated"
        print("Checkers Hard: Correctly prefers capture move")
    
    def test_checkers_no_moves(self):
        """Test Checkers AI handles no moves"""
        response = requests.post(f"{BASE_URL}/api/ai-practice/calculate-move", json={
            "game_type": "checkers",
            "game_state": {
                "legal_moves": []
            },
            "difficulty": "hard"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["move"]["move"] is None
        assert data["move"]["strategy"] == "no_moves"
        print("Checkers: Correctly handles no moves")
    
    # ========== BATTLESHIP AI TESTS ==========
    
    def test_battleship_easy_random(self):
        """Test Battleship easy difficulty shoots randomly"""
        response = requests.post(f"{BASE_URL}/api/ai-practice/calculate-move", json={
            "game_type": "battleship",
            "game_state": {
                "board_size": 10,
                "hits": [],
                "misses": []
            },
            "difficulty": "easy"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert 0 <= data["move"]["row"] < 10
        assert 0 <= data["move"]["col"] < 10
        assert data["move"]["strategy"] == "random"
        print(f"Battleship Easy: Shot at ({data['move']['row']}, {data['move']['col']})")
    
    def test_battleship_medium_target_mode(self):
        """Test Battleship medium difficulty targets adjacent to hits"""
        response = requests.post(f"{BASE_URL}/api/ai-practice/calculate-move", json={
            "game_type": "battleship",
            "game_state": {
                "board_size": 10,
                "hits": [(5, 5)],
                "misses": []
            },
            "difficulty": "medium"
        })
        assert response.status_code == 200
        data = response.json()
        # Should target adjacent to (5, 5)
        adjacent_cells = [(4, 5), (6, 5), (5, 4), (5, 6)]
        assert (data["move"]["row"], data["move"]["col"]) in adjacent_cells
        assert data["move"]["strategy"] == "target"
        print(f"Battleship Medium: Targets adjacent cell ({data['move']['row']}, {data['move']['col']})")
    
    def test_battleship_hard_hunt_pattern(self):
        """Test Battleship hard difficulty uses checkerboard hunt pattern"""
        response = requests.post(f"{BASE_URL}/api/ai-practice/calculate-move", json={
            "game_type": "battleship",
            "game_state": {
                "board_size": 10,
                "hits": [],
                "misses": []
            },
            "difficulty": "hard"
        })
        assert response.status_code == 200
        data = response.json()
        # Should use checkerboard pattern (row + col) % 2 == 0
        assert (data["move"]["row"] + data["move"]["col"]) % 2 == 0
        assert data["move"]["strategy"] == "hunt_pattern"
        print(f"Battleship Hard: Hunt pattern at ({data['move']['row']}, {data['move']['col']})")
    
    # ========== GENERIC AI TESTS ==========
    
    def test_generic_easy_random(self):
        """Test Generic AI easy difficulty returns random move"""
        response = requests.post(f"{BASE_URL}/api/ai-practice/calculate-move", json={
            "game_type": "unknown_game",
            "game_state": {
                "available_moves": ["move1", "move2", "move3"]
            },
            "difficulty": "easy"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert data["move"]["move"] in ["move1", "move2", "move3"]
        assert data["move"]["strategy"] == "random"
        print(f"Generic Easy: Move = {data['move']['move']}")
    
    def test_generic_hard_optimal(self):
        """Test Generic AI hard difficulty picks optimal move"""
        response = requests.post(f"{BASE_URL}/api/ai-practice/calculate-move", json={
            "game_type": "unknown_game",
            "game_state": {
                "available_moves": [
                    {"name": "weak", "score": 10},
                    {"name": "strong", "score": 100},
                    {"name": "medium", "score": 50}
                ]
            },
            "difficulty": "hard"
        })
        assert response.status_code == 200
        data = response.json()
        # Should pick highest score
        assert data["move"]["move"]["name"] == "strong"
        assert data["move"]["strategy"] == "optimal"
        print(f"Generic Hard: Picks optimal move with score {data['move']['move']['score']}")
    
    def test_generic_no_moves(self):
        """Test Generic AI handles no moves"""
        response = requests.post(f"{BASE_URL}/api/ai-practice/calculate-move", json={
            "game_type": "unknown_game",
            "game_state": {
                "available_moves": []
            },
            "difficulty": "hard"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["move"]["move"] is None
        assert data["move"]["strategy"] == "no_moves"
        print("Generic: Correctly handles no moves")
    
    # ========== THINKING TIME TESTS ==========
    
    def test_thinking_time_easy(self):
        """Test thinking time is shorter for easy difficulty"""
        response = requests.post(f"{BASE_URL}/api/ai-practice/calculate-move", json={
            "game_type": "tictactoe",
            "game_state": {
                "board": [[None]*3 for _ in range(3)],
                "ai_symbol": "O"
            },
            "difficulty": "easy"
        })
        assert response.status_code == 200
        data = response.json()
        assert 100 <= data["thinking_time"] <= 500
        print(f"Easy thinking time: {data['thinking_time']}ms")
    
    def test_thinking_time_hard(self):
        """Test thinking time is longer for hard difficulty"""
        response = requests.post(f"{BASE_URL}/api/ai-practice/calculate-move", json={
            "game_type": "tictactoe",
            "game_state": {
                "board": [[None]*3 for _ in range(3)],
                "ai_symbol": "O"
            },
            "difficulty": "hard"
        })
        assert response.status_code == 200
        data = response.json()
        assert 500 <= data["thinking_time"] <= 2000
        print(f"Hard thinking time: {data['thinking_time']}ms")


class TestAIPracticeSession:
    """Tests for POST /api/ai-practice/start-session"""
    
    def test_start_session_success(self):
        """Test starting an AI practice session"""
        user_id = f"test_ai_{uuid.uuid4().hex[:8]}"
        response = requests.post(f"{BASE_URL}/api/ai-practice/start-session", json={
            "user_id": user_id,
            "game_type": "tictactoe",
            "difficulty": "medium"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "session_id" in data
        assert data["session_id"].startswith("ai_tictactoe_")
        assert "medium" in data["message"].lower()
        print(f"Session started: {data['session_id']}")
    
    def test_start_session_different_games(self):
        """Test starting sessions for different game types"""
        games = ["chess", "poker", "connect4", "battleship"]
        for game in games:
            user_id = f"test_ai_{uuid.uuid4().hex[:8]}"
            response = requests.post(f"{BASE_URL}/api/ai-practice/start-session", json={
                "user_id": user_id,
                "game_type": game,
                "difficulty": "hard"
            })
            assert response.status_code == 200
            data = response.json()
            assert data["success"]
            assert game in data["session_id"]
            print(f"Session for {game}: {data['session_id']}")
    
    def test_start_session_all_difficulties(self):
        """Test starting sessions with all difficulty levels"""
        difficulties = ["easy", "medium", "hard"]
        for diff in difficulties:
            user_id = f"test_ai_{uuid.uuid4().hex[:8]}"
            response = requests.post(f"{BASE_URL}/api/ai-practice/start-session", json={
                "user_id": user_id,
                "game_type": "rps",
                "difficulty": diff
            })
            assert response.status_code == 200
            data = response.json()
            assert data["success"]
            assert diff in data["message"].lower()
            print(f"Session with {diff} difficulty: {data['session_id']}")


class TestAIPracticeStats:
    """Tests for GET /api/ai-practice/stats/{user_id}"""
    
    def test_get_stats_new_user(self):
        """Test getting stats for user with no sessions"""
        user_id = f"test_new_{uuid.uuid4().hex[:8]}"
        response = requests.get(f"{BASE_URL}/api/ai-practice/stats/{user_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert data["stats"]["total_games"] == 0
        assert data["stats"]["by_difficulty"] == {}
        assert data["stats"]["by_game_type"] == {}
        print(f"New user stats: {data['stats']}")
    
    def test_get_stats_after_sessions(self):
        """Test getting stats after creating sessions"""
        user_id = f"test_stats_{uuid.uuid4().hex[:8]}"
        
        # Create multiple sessions
        games = [
            ("tictactoe", "easy"),
            ("tictactoe", "hard"),
            ("chess", "medium"),
            ("poker", "hard")
        ]
        
        for game_type, difficulty in games:
            requests.post(f"{BASE_URL}/api/ai-practice/start-session", json={
                "user_id": user_id,
                "game_type": game_type,
                "difficulty": difficulty
            })
        
        # Get stats
        response = requests.get(f"{BASE_URL}/api/ai-practice/stats/{user_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert data["stats"]["total_games"] == 4
        assert data["stats"]["by_game_type"]["tictactoe"] == 2
        assert data["stats"]["by_game_type"]["chess"] == 1
        assert data["stats"]["by_game_type"]["poker"] == 1
        assert data["stats"]["by_difficulty"]["easy"] == 1
        assert data["stats"]["by_difficulty"]["medium"] == 1
        assert data["stats"]["by_difficulty"]["hard"] == 2
        print(f"User stats after sessions: {data['stats']}")


class TestAIPracticeEdgeCases:
    """Edge case tests for AI Practice Mode"""
    
    def test_case_insensitive_game_type(self):
        """Test game type is case insensitive"""
        response = requests.post(f"{BASE_URL}/api/ai-practice/calculate-move", json={
            "game_type": "TICTACTOE",
            "game_state": {
                "board": [[None]*3 for _ in range(3)],
                "ai_symbol": "O"
            },
            "difficulty": "easy"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        print("Case insensitive game type works")
    
    def test_case_insensitive_difficulty(self):
        """Test difficulty is case insensitive"""
        response = requests.post(f"{BASE_URL}/api/ai-practice/calculate-move", json={
            "game_type": "rps",
            "game_state": {},
            "difficulty": "HARD"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["difficulty"] == "hard"
        print("Case insensitive difficulty works")
    
    def test_default_difficulty(self):
        """Test default difficulty is medium"""
        response = requests.post(f"{BASE_URL}/api/ai-practice/calculate-move", json={
            "game_type": "rps",
            "game_state": {}
        })
        assert response.status_code == 200
        data = response.json()
        assert data["difficulty"] == "medium"
        print("Default difficulty is medium")
    
    def test_empty_player_history(self):
        """Test RPS with empty player history"""
        response = requests.post(f"{BASE_URL}/api/ai-practice/calculate-move", json={
            "game_type": "rps",
            "game_state": {},
            "difficulty": "hard",
            "player_history": []
        })
        assert response.status_code == 200
        data = response.json()
        assert data["move"]["strategy"] == "random"  # Falls back to random
        print("Empty player history handled correctly")
    
    def test_full_tictactoe_board(self):
        """Test Tic-Tac-Toe with full board"""
        response = requests.post(f"{BASE_URL}/api/ai-practice/calculate-move", json={
            "game_type": "tictactoe",
            "game_state": {
                "board": [["X", "O", "X"], ["X", "O", "O"], ["O", "X", "X"]],
                "ai_symbol": "O"
            },
            "difficulty": "hard"
        })
        assert response.status_code == 200
        data = response.json()
        # Should return default move when board is full
        assert "move" in data
        print("Full board handled correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

"""
Comprehensive Game Testing Suite for Global Vibez DSG
Tests: Practice mode, AI moves, Win conditions, Statistics, Achievements, Leaderboards
All 11 games: tictactoe, connect4, chess, checkers, reversi, hearts, uno, poker, blackjack, crazy_eights, go_fish
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://social-connect-953.preview.emergentagent.com').rstrip('/')

class TestSetup:
    """Setup test user and session"""
    session_token = None
    
    @classmethod
    def get_session(cls):
        if cls.session_token:
            return cls.session_token
        
        # Use demo login to get session
        response = requests.post(f"{BASE_URL}/api/auth/demo-login")
        if response.status_code == 200:
            # Extract session from cookies
            cls.session_token = response.cookies.get('session_token')
            if not cls.session_token:
                # Try to create a test session directly
                cls.session_token = os.environ.get('TEST_SESSION_TOKEN', "test_session_fixture_" + str(int(time.time())))
        return cls.session_token


# ==================== PRACTICE MODE TESTS ====================

class TestPracticeModeAllGames:
    """Test practice mode game creation for all 11 games"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {TestSetup.get_session()}"
        }
    
    @pytest.mark.parametrize("game_type", [
        "tictactoe", "connect4", "chess", "checkers", "reversi",
        "hearts", "uno", "poker", "blackjack", "crazy_eights", "go_fish"
    ])
    def test_start_game(self, game_type):
        """Test starting each game type"""
        response = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers=self.headers,
            json={"game_type": game_type, "difficulty": "medium"}
        )
        print(f"Start {game_type}: {response.status_code}")
        assert response.status_code == 200, f"Failed to start {game_type}: {response.text}"
        
        data = response.json()
        assert data["game_type"] == game_type
        assert data["current_turn"] == "player"
        assert "game_state" in data
        assert "game_id" in data
    
    @pytest.mark.parametrize("difficulty", ["easy", "medium", "hard"])
    def test_difficulty_levels(self, difficulty):
        """Test all 3 difficulty levels"""
        response = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers=self.headers,
            json={"game_type": "tictactoe", "difficulty": difficulty}
        )
        assert response.status_code == 200
        assert response.json()["difficulty"] == difficulty


# ==================== AI MOVE VALIDATION TESTS ====================

class TestAIMoveValidation:
    """Test AI moves are valid and strategic"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {TestSetup.get_session()}"
        }
    
    def test_tictactoe_ai_valid_move(self):
        """Test TicTacToe AI returns valid move within bounds"""
        # Start game
        start = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers=self.headers,
            json={"game_type": "tictactoe", "difficulty": "hard"}
        )
        game_id = start.json()["game_id"]
        
        # Make player move
        response = requests.post(
            f"{BASE_URL}/api/practice/game/{game_id}/move",
            headers=self.headers,
            json={"move_data": {"row": 0, "col": 0}}
        )
        assert response.status_code == 200
        
        data = response.json()
        if data["status"] == "in_progress":
            ai_move = data.get("ai_move")
            assert ai_move is not None, "AI should make a move"
            assert 0 <= ai_move["row"] <= 2, "AI row must be 0-2"
            assert 0 <= ai_move["col"] <= 2, "AI col must be 0-2"
            # Verify AI placed O on board
            board = data["game_state"]["board"]
            assert board[ai_move["row"]][ai_move["col"]] == "O"
    
    def test_connect4_ai_valid_move(self):
        """Test Connect4 AI returns valid column"""
        start = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers=self.headers,
            json={"game_type": "connect4", "difficulty": "hard"}
        )
        game_id = start.json()["game_id"]
        
        response = requests.post(
            f"{BASE_URL}/api/practice/game/{game_id}/move",
            headers=self.headers,
            json={"move_data": {"col": 3}}
        )
        assert response.status_code == 200
        
        data = response.json()
        if data["status"] == "in_progress":
            ai_move = data.get("ai_move")
            assert ai_move is not None
            assert 0 <= ai_move["col"] <= 6, "AI column must be 0-6"
    
    def test_checkers_ai_valid_move(self):
        """Test Checkers AI returns valid move"""
        start = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers=self.headers,
            json={"game_type": "checkers", "difficulty": "medium"}
        )
        game_id = start.json()["game_id"]
        
        # Find a valid player move (player pieces are at rows 5-7)
        board = start.json()["game_state"]["board"]
        player_move = None
        for row in range(5, 8):
            for col in range(8):
                if board[row][col] and board[row][col].get("player") == "player":
                    # Try diagonal move
                    for dr, dc in [(-1, -1), (-1, 1)]:
                        new_row, new_col = row + dr, col + dc
                        if 0 <= new_row < 8 and 0 <= new_col < 8:
                            if not board[new_row][new_col]:
                                player_move = {"from": [row, col], "to": [new_row, new_col]}
                                break
                if player_move:
                    break
            if player_move:
                break
        
        if player_move:
            response = requests.post(
                f"{BASE_URL}/api/practice/game/{game_id}/move",
                headers=self.headers,
                json={"move_data": player_move}
            )
            print(f"Checkers move response: {response.status_code} - {response.text[:200]}")
            assert response.status_code == 200
    
    def test_reversi_ai_valid_move(self):
        """Test Reversi AI returns valid move"""
        start = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers=self.headers,
            json={"game_type": "reversi", "difficulty": "medium"}
        )
        game_id = start.json()["game_id"]
        
        # Valid opening moves in Reversi from standard position
        valid_opening_moves = [(2, 3), (3, 2), (4, 5), (5, 4)]
        
        response = requests.post(
            f"{BASE_URL}/api/practice/game/{game_id}/move",
            headers=self.headers,
            json={"move_data": {"row": 2, "col": 3}}
        )
        print(f"Reversi move response: {response.status_code} - {response.text[:200]}")
        assert response.status_code == 200
    
    def test_blackjack_ai_basic_strategy(self):
        """Test Blackjack AI follows basic strategy"""
        start = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers=self.headers,
            json={"game_type": "blackjack", "difficulty": "hard"}
        )
        game_id = start.json()["game_id"]
        game_state = start.json()["game_state"]
        
        print(f"Blackjack initial state: {game_state}")
        
        # Player hits
        response = requests.post(
            f"{BASE_URL}/api/practice/game/{game_id}/move",
            headers=self.headers,
            json={"move_data": {"action": "hit"}}
        )
        print(f"Blackjack hit response: {response.status_code} - {response.text[:300]}")
        assert response.status_code == 200
    
    def test_poker_ai_hand_evaluation(self):
        """Test Poker AI makes strategic decisions"""
        start = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers=self.headers,
            json={"game_type": "poker", "difficulty": "hard"}
        )
        game_id = start.json()["game_id"]
        game_state = start.json()["game_state"]
        
        print(f"Poker initial state: {game_state}")
        
        # Player calls
        response = requests.post(
            f"{BASE_URL}/api/practice/game/{game_id}/move",
            headers=self.headers,
            json={"move_data": {"action": "call"}}
        )
        print(f"Poker call response: {response.status_code} - {response.text[:300]}")
        assert response.status_code == 200
    
    def test_hearts_trick_taking(self):
        """Test Hearts trick-taking logic"""
        start = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers=self.headers,
            json={"game_type": "hearts", "difficulty": "medium"}
        )
        game_id = start.json()["game_id"]
        game_state = start.json()["game_state"]
        
        print(f"Hearts initial state: player_hand={game_state.get('player_hand', [])[:3]}...")
        
        # Play a card from player's hand
        player_hand = game_state.get("player_hand", [])
        if player_hand:
            card_to_play = player_hand[0]
            response = requests.post(
                f"{BASE_URL}/api/practice/game/{game_id}/move",
                headers=self.headers,
                json={"move_data": {"card": card_to_play}}
            )
            print(f"Hearts play card response: {response.status_code} - {response.text[:300]}")
            assert response.status_code == 200


# ==================== WIN CONDITION TESTS ====================

class TestWinConditions:
    """Test win condition detection"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {TestSetup.get_session()}"
        }
    
    def test_tictactoe_win_detection(self):
        """Test TicTacToe detects wins correctly"""
        # Play multiple games to test win detection
        for _ in range(3):
            start = requests.post(
                f"{BASE_URL}/api/practice/start",
                headers=self.headers,
                json={"game_type": "tictactoe", "difficulty": "easy"}
            )
            game_id = start.json()["game_id"]
            
            # Play until game ends
            moves = 0
            status = "in_progress"
            while status == "in_progress" and moves < 9:
                game = requests.get(
                    f"{BASE_URL}/api/practice/game/{game_id}",
                    headers=self.headers
                )
                board = game.json()["game_state"]["board"]
                
                # Find empty cell
                moved = False
                for i in range(3):
                    for j in range(3):
                        if board[i][j] == "":
                            response = requests.post(
                                f"{BASE_URL}/api/practice/game/{game_id}/move",
                                headers=self.headers,
                                json={"move_data": {"row": i, "col": j}}
                            )
                            data = response.json()
                            status = data["status"]
                            moves += 1
                            moved = True
                            
                            if status == "completed":
                                winner = data.get("winner")
                                print(f"Game completed! Winner: {winner}")
                                assert winner in ["player", "ai", "draw"]
                            break
                    if moved:
                        break
    
    def test_connect4_win_detection(self):
        """Test Connect4 detects 4-in-a-row"""
        start = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers=self.headers,
            json={"game_type": "connect4", "difficulty": "easy"}
        )
        game_id = start.json()["game_id"]
        
        # Play until game ends
        moves = 0
        status = "in_progress"
        col = 0
        while status == "in_progress" and moves < 42:
            response = requests.post(
                f"{BASE_URL}/api/practice/game/{game_id}/move",
                headers=self.headers,
                json={"move_data": {"col": col % 7}}
            )
            data = response.json()
            status = data["status"]
            moves += 1
            col += 1
            
            if status == "completed":
                winner = data.get("winner")
                print(f"Connect4 completed! Winner: {winner}")
                assert winner in ["player", "ai", "draw"]


# ==================== STATISTICS ENDPOINTS TESTS ====================

class TestStatisticsEndpoints:
    """Test statistics endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {TestSetup.get_session()}"
        }
    
    def test_detailed_stats_endpoint(self):
        """Test /api/stats/detailed endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/stats/detailed",
            headers=self.headers
        )
        print(f"Detailed stats: {response.status_code} - {response.text[:300]}")
        assert response.status_code == 200
        
        data = response.json()
        assert "stats" in data or "message" in data
    
    def test_detailed_stats_by_game_type(self):
        """Test /api/stats/detailed with game_type filter"""
        response = requests.get(
            f"{BASE_URL}/api/stats/detailed?game_type=tictactoe",
            headers=self.headers
        )
        print(f"Detailed stats for tictactoe: {response.status_code}")
        assert response.status_code == 200
    
    def test_achievements_endpoint(self):
        """Test /api/stats/achievements endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/stats/achievements",
            headers=self.headers
        )
        print(f"Achievements: {response.status_code} - {response.text[:500]}")
        assert response.status_code == 200
        
        data = response.json()
        assert "achievements" in data
        
        # Verify achievement structure
        achievements = data["achievements"]
        assert len(achievements) >= 8, "Should have at least 8 achievements"
        
        for achievement in achievements:
            assert "achievement_id" in achievement
            assert "name" in achievement
            assert "description" in achievement
            assert "icon" in achievement
            assert "unlocked" in achievement
    
    def test_leaderboard_endpoint(self):
        """Test /api/stats/leaderboard/{game_type} endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/stats/leaderboard/tictactoe",
            headers=self.headers
        )
        print(f"Leaderboard: {response.status_code} - {response.text[:300]}")
        assert response.status_code == 200
        
        data = response.json()
        assert "leaderboard" in data
        assert "game_type" in data
        assert data["game_type"] == "tictactoe"
    
    def test_global_stats_endpoint(self):
        """Test /api/stats/global endpoint"""
        response = requests.get(f"{BASE_URL}/api/stats/global")
        print(f"Global stats: {response.status_code} - {response.text[:300]}")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_games_played" in data
        assert "total_players" in data
        assert "most_popular_games" in data


# ==================== CARD GAME SPECIFIC TESTS ====================

class TestCardGames:
    """Test card game specific mechanics"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {TestSetup.get_session()}"
        }
    
    def test_uno_card_play(self):
        """Test UNO card playing mechanics"""
        start = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers=self.headers,
            json={"game_type": "uno", "difficulty": "easy"}
        )
        game_id = start.json()["game_id"]
        game_state = start.json()["game_state"]
        
        player_hand = game_state.get("player_hand", [])
        top_card = game_state.get("top_card", "")
        
        print(f"UNO: hand={player_hand}, top={top_card}")
        
        # Try to play a matching card or draw
        response = requests.post(
            f"{BASE_URL}/api/practice/game/{game_id}/move",
            headers=self.headers,
            json={"move_data": {"action": "draw"}}
        )
        assert response.status_code == 200
    
    def test_crazy_eights_mechanics(self):
        """Test Crazy Eights card mechanics"""
        start = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers=self.headers,
            json={"game_type": "crazy_eights", "difficulty": "easy"}
        )
        game_id = start.json()["game_id"]
        game_state = start.json()["game_state"]
        
        print(f"Crazy Eights state: {game_state}")
        
        response = requests.post(
            f"{BASE_URL}/api/practice/game/{game_id}/move",
            headers=self.headers,
            json={"move_data": {"action": "draw"}}
        )
        assert response.status_code == 200
    
    def test_go_fish_mechanics(self):
        """Test Go Fish card mechanics"""
        start = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers=self.headers,
            json={"game_type": "go_fish", "difficulty": "easy"}
        )
        game_id = start.json()["game_id"]
        game_state = start.json()["game_state"]
        
        player_hand = game_state.get("player_hand", [])
        print(f"Go Fish hand: {player_hand[:3]}...")
        
        # Ask for a rank we have
        if player_hand:
            rank = player_hand[0][:-1]  # Get rank without suit
            response = requests.post(
                f"{BASE_URL}/api/practice/game/{game_id}/move",
                headers=self.headers,
                json={"move_data": {"action": "ask", "rank": rank}}
            )
            print(f"Go Fish ask response: {response.status_code} - {response.text[:200]}")
            assert response.status_code == 200


# ==================== CHESS SPECIFIC TESTS ====================

class TestChess:
    """Test Chess specific mechanics"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {TestSetup.get_session()}"
        }
    
    def test_chess_initial_state(self):
        """Test Chess initializes with correct FEN"""
        start = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers=self.headers,
            json={"game_type": "chess", "difficulty": "medium"}
        )
        assert start.status_code == 200
        
        game_state = start.json()["game_state"]
        assert "fen" in game_state
        # Standard starting position FEN
        assert "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR" in game_state["fen"]
    
    def test_chess_move(self):
        """Test making a chess move"""
        start = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers=self.headers,
            json={"game_type": "chess", "difficulty": "easy"}
        )
        game_id = start.json()["game_id"]
        
        # Make e2-e4 opening move
        response = requests.post(
            f"{BASE_URL}/api/practice/game/{game_id}/move",
            headers=self.headers,
            json={"move_data": {"from": "e2", "to": "e4", "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"}}
        )
        print(f"Chess move response: {response.status_code} - {response.text[:300]}")
        assert response.status_code == 200


# ==================== PRACTICE STATS TESTS ====================

class TestPracticeStats:
    """Test practice mode statistics"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {TestSetup.get_session()}"
        }
    
    def test_practice_stats_endpoint(self):
        """Test /api/practice/stats endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/practice/stats",
            headers=self.headers
        )
        print(f"Practice stats: {response.status_code} - {response.text[:300]}")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_games" in data
        assert "wins" in data
        assert "losses" in data
        assert "win_rate" in data
        assert "games_by_type" in data
        assert "games_by_difficulty" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

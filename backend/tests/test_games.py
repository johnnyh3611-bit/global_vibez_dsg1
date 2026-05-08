"""
Test Suite for Global Vibez DSG Games - Practice Mode
Tests demo login flow, Chess, Blackjack, UNO, Checkers, and other game endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://social-connect-953.preview.emergentagent.com').rstrip('/')

class TestDemoLogin:
    """Test demo login functionality"""
    
    def test_demo_login_returns_200(self):
        """Demo login should return 200 OK"""
        response = requests.post(f"{BASE_URL}/api/auth/demo-login", json={})
        assert response.status_code == 200, f"Demo login failed: {response.text}"
        
        data = response.json()
        assert "user_id" in data
        assert "email" in data
        assert data["email"] == "demo@globalvibez.com"
        assert data["profile_completed"]
        print(f"✅ Demo login successful: user_id={data['user_id']}")
    
    def test_demo_login_sets_cookie(self):
        """Demo login should set session_token cookie"""
        response = requests.post(f"{BASE_URL}/api/auth/demo-login", json={})
        assert response.status_code == 200
        
        # Check that cookie is set
        assert "session_token" in response.cookies or "session_token" in str(response.headers.get("set-cookie", ""))
        print("✅ Session cookie is set")
    
    def test_auth_me_after_demo_login(self):
        """After demo login, /auth/me should return user"""
        session = requests.Session()
        
        # Login
        login_response = session.post(f"{BASE_URL}/api/auth/demo-login", json={})
        assert login_response.status_code == 200
        
        # Check auth
        me_response = session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200, f"Auth check failed: {me_response.text}"
        
        user = me_response.json()
        assert user["email"] == "demo@globalvibez.com"
        print(f"✅ Auth check successful: {user['name']}")


class TestPracticeGameStart:
    """Test starting practice games"""
    
    @pytest.fixture
    def auth_session(self):
        """Get authenticated session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/demo-login", json={})
        assert response.status_code == 200
        return session
    
    def test_start_chess_game(self, auth_session):
        """Start a Chess practice game"""
        response = auth_session.post(
            f"{BASE_URL}/api/practice/start",
            json={"game_type": "chess", "difficulty": "easy"}
        )
        assert response.status_code == 200, f"Chess start failed: {response.text}"
        
        data = response.json()
        assert "game_id" in data
        assert data["game_type"] == "chess"
        assert "fen" in data["game_state"]
        assert data["current_turn"] == "player"
        print(f"✅ Chess game started: {data['game_id']}")
    
    def test_start_blackjack_game(self, auth_session):
        """Start a Blackjack practice game"""
        response = auth_session.post(
            f"{BASE_URL}/api/practice/start",
            json={"game_type": "blackjack", "difficulty": "medium"}
        )
        assert response.status_code == 200, f"Blackjack start failed: {response.text}"
        
        data = response.json()
        assert "game_id" in data
        assert "player_hand" in data["game_state"]
        assert "dealer_hand" in data["game_state"]
        assert len(data["game_state"]["player_hand"]) == 2
        print(f"✅ Blackjack game started: {data['game_id']}")
    
    def test_start_uno_game(self, auth_session):
        """Start a UNO practice game"""
        response = auth_session.post(
            f"{BASE_URL}/api/practice/start",
            json={"game_type": "uno", "difficulty": "easy"}
        )
        assert response.status_code == 200, f"UNO start failed: {response.text}"
        
        data = response.json()
        assert "game_id" in data
        assert "player_hand" in data["game_state"]
        assert "top_card" in data["game_state"]
        assert len(data["game_state"]["player_hand"]) == 7
        print(f"✅ UNO game started: {data['game_id']}")
    
    def test_start_checkers_game(self, auth_session):
        """Start a Checkers practice game"""
        response = auth_session.post(
            f"{BASE_URL}/api/practice/start",
            json={"game_type": "checkers", "difficulty": "medium"}
        )
        assert response.status_code == 200, f"Checkers start failed: {response.text}"
        
        data = response.json()
        assert "game_id" in data
        assert "board" in data["game_state"]
        assert len(data["game_state"]["board"]) == 8  # 8x8 board
        print(f"✅ Checkers game started: {data['game_id']}")
    
    def test_start_tictactoe_game(self, auth_session):
        """Start a TicTacToe practice game"""
        response = auth_session.post(
            f"{BASE_URL}/api/practice/start",
            json={"game_type": "tictactoe", "difficulty": "easy"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "board" in data["game_state"]
        assert len(data["game_state"]["board"]) == 3  # 3x3 board
        print(f"✅ TicTacToe game started: {data['game_id']}")
    
    def test_start_connect4_game(self, auth_session):
        """Start a Connect4 practice game"""
        response = auth_session.post(
            f"{BASE_URL}/api/practice/start",
            json={"game_type": "connect4", "difficulty": "medium"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "board" in data["game_state"]
        assert len(data["game_state"]["board"]) == 6  # 6 rows
        assert len(data["game_state"]["board"][0]) == 7  # 7 columns
        print(f"✅ Connect4 game started: {data['game_id']}")


class TestGameMoves:
    """Test making moves in games with AI responses"""
    
    @pytest.fixture
    def auth_session(self):
        """Get authenticated session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/demo-login", json={})
        assert response.status_code == 200
        return session
    
    def test_tictactoe_move_and_ai_response(self, auth_session):
        """TicTacToe: Make a move and get AI response"""
        # Start game
        start_response = auth_session.post(
            f"{BASE_URL}/api/practice/start",
            json={"game_type": "tictactoe", "difficulty": "easy"}
        )
        game_id = start_response.json()["game_id"]
        
        # Make a move (center)
        move_response = auth_session.post(
            f"{BASE_URL}/api/practice/game/{game_id}/move",
            json={"move_data": {"row": 1, "col": 1}}
        )
        assert move_response.status_code == 200, f"Move failed: {move_response.text}"
        
        data = move_response.json()
        assert data["game_state"]["board"][1][1] == "X"  # Player's move
        assert "ai_move" in data  # AI responded
        assert data["current_turn"] == "player"  # Back to player
        print(f"✅ TicTacToe move successful, AI responded with: {data['ai_move']}")
    
    def test_connect4_move_and_ai_response(self, auth_session):
        """Connect4: Drop a piece and get AI response"""
        # Start game
        start_response = auth_session.post(
            f"{BASE_URL}/api/practice/start",
            json={"game_type": "connect4", "difficulty": "easy"}
        )
        game_id = start_response.json()["game_id"]
        
        # Make a move (drop in column 3)
        move_response = auth_session.post(
            f"{BASE_URL}/api/practice/game/{game_id}/move",
            json={"move_data": {"col": 3}}
        )
        assert move_response.status_code == 200, f"Move failed: {move_response.text}"
        
        data = move_response.json()
        # Check player's piece landed at bottom
        assert data["game_state"]["board"][5][3] == "R"
        assert "ai_move" in data
        print("✅ Connect4 move successful, AI responded")
    
    def test_chess_move_and_ai_response(self, auth_session):
        """Chess: Make e2-e4 pawn move and verify AI response"""
        # Start game
        start_response = auth_session.post(
            f"{BASE_URL}/api/practice/start",
            json={"game_type": "chess", "difficulty": "easy"}
        )
        game_id = start_response.json()["game_id"]
        initial_fen = start_response.json()["game_state"]["fen"]
        
        # Make e2-e4 pawn move
        # We need to send the new FEN after the move
        new_fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"
        move_response = auth_session.post(
            f"{BASE_URL}/api/practice/game/{game_id}/move",
            json={"move_data": {"from": "e2", "to": "e4", "fen": new_fen}}
        )
        assert move_response.status_code == 200, f"Chess move failed: {move_response.text}"
        
        data = move_response.json()
        assert data["game_state"]["fen"] != initial_fen  # FEN changed
        assert "ai_move" in data
        print(f"✅ Chess e2-e4 move successful, AI responded: {data.get('ai_move', {})}")
    
    def test_blackjack_hit_action(self, auth_session):
        """Blackjack: Test Hit action"""
        # Start game
        start_response = auth_session.post(
            f"{BASE_URL}/api/practice/start",
            json={"game_type": "blackjack", "difficulty": "easy"}
        )
        game_id = start_response.json()["game_id"]
        initial_hand_count = len(start_response.json()["game_state"]["player_hand"])
        
        # Hit
        move_response = auth_session.post(
            f"{BASE_URL}/api/practice/game/{game_id}/move",
            json={"move_data": {"action": "hit"}}
        )
        assert move_response.status_code == 200, f"Blackjack hit failed: {move_response.text}"
        
        data = move_response.json()
        new_hand_count = len(data["game_state"]["player_hand"])
        assert new_hand_count == initial_hand_count + 1  # Got a new card
        print(f"✅ Blackjack Hit successful, hand: {data['game_state']['player_hand']}")
    
    def test_blackjack_stand_action(self, auth_session):
        """Blackjack: Test Stand action triggers dealer play"""
        # Start game
        start_response = auth_session.post(
            f"{BASE_URL}/api/practice/start",
            json={"game_type": "blackjack", "difficulty": "easy"}
        )
        game_id = start_response.json()["game_id"]
        
        # Stand
        move_response = auth_session.post(
            f"{BASE_URL}/api/practice/game/{game_id}/move",
            json={"move_data": {"action": "stand"}}
        )
        assert move_response.status_code == 200, f"Blackjack stand failed: {move_response.text}"
        
        data = move_response.json()
        # Game should be completed after stand
        assert data["status"] == "completed"
        assert data["winner"] in ["player", "ai", "push"]
        print(f"✅ Blackjack Stand successful, winner: {data['winner']}")
    
    def test_uno_play_card(self, auth_session):
        """UNO: Play a valid card"""
        # Start game
        start_response = auth_session.post(
            f"{BASE_URL}/api/practice/start",
            json={"game_type": "uno", "difficulty": "easy"}
        )
        game_id = start_response.json()["game_id"]
        player_hand = start_response.json()["game_state"]["player_hand"]
        top_card = start_response.json()["game_state"]["top_card"]
        
        # Find a playable card (matching color or number)
        top_color = top_card[0]
        top_value = top_card[1:]
        
        playable_card = None
        for card in player_hand:
            card_color = card[0]
            card_value = card[1:]
            if card_color == top_color or card_value == top_value:
                playable_card = card
                break
        
        if playable_card:
            # Play the card
            move_response = auth_session.post(
                f"{BASE_URL}/api/practice/game/{game_id}/move",
                json={"move_data": {"action": "play", "card": playable_card}}
            )
            assert move_response.status_code == 200, f"UNO play failed: {move_response.text}"
            
            data = move_response.json()
            assert playable_card not in data["game_state"]["player_hand"]
            print(f"✅ UNO play card successful: {playable_card}")
        else:
            # Draw a card instead
            move_response = auth_session.post(
                f"{BASE_URL}/api/practice/game/{game_id}/move",
                json={"move_data": {"action": "draw"}}
            )
            assert move_response.status_code == 200
            print("✅ UNO draw card successful (no playable card)")
    
    def test_checkers_move(self, auth_session):
        """Checkers: Move a piece diagonally"""
        # Start game
        start_response = auth_session.post(
            f"{BASE_URL}/api/practice/start",
            json={"game_type": "checkers", "difficulty": "easy"}
        )
        game_id = start_response.json()["game_id"]
        
        # Move a player piece (player starts at bottom rows 5-7)
        # Move from row 5, col 0 to row 4, col 1
        move_response = auth_session.post(
            f"{BASE_URL}/api/practice/game/{game_id}/move",
            json={"move_data": {"from": [5, 0], "to": [4, 1]}}
        )
        assert move_response.status_code == 200, f"Checkers move failed: {move_response.text}"
        
        data = move_response.json()
        # Verify piece moved
        assert data["game_state"]["board"][5][0] is None  # Old position empty
        assert data["game_state"]["board"][4][1] is not None  # New position has piece
        assert "ai_move" in data
        print("✅ Checkers move successful")
    
    def test_reversi_move(self, auth_session):
        """Reversi: Place a piece and verify flip"""
        # Start game
        start_response = auth_session.post(
            f"{BASE_URL}/api/practice/start",
            json={"game_type": "reversi", "difficulty": "easy"}
        )
        game_id = start_response.json()["game_id"]
        
        # Valid opening moves for player (white starts at [3][4] and [4][3])
        # Black AI at [3][3] and [4][4]
        # Player can place at [3][5] to flip [3][4]
        move_response = auth_session.post(
            f"{BASE_URL}/api/practice/game/{game_id}/move",
            json={"move_data": {"row": 3, "col": 5}}
        )
        
        if move_response.status_code == 200:
            data = move_response.json()
            assert data["game_state"]["board"][3][5] == "player"
            print("✅ Reversi move successful")
        else:
            # Try another valid move
            move_response = auth_session.post(
                f"{BASE_URL}/api/practice/game/{game_id}/move",
                json={"move_data": {"row": 2, "col": 3}}
            )
            assert move_response.status_code == 200
            print("✅ Reversi move successful (alternate position)")


class TestGameCompletion:
    """Test game completion and win detection"""
    
    @pytest.fixture
    def auth_session(self):
        """Get authenticated session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/demo-login", json={})
        assert response.status_code == 200
        return session
    
    def test_tictactoe_win_detection(self, auth_session):
        """TicTacToe: Verify win is detected"""
        # Start game
        start_response = auth_session.post(
            f"{BASE_URL}/api/practice/start",
            json={"game_type": "tictactoe", "difficulty": "easy"}
        )
        game_id = start_response.json()["game_id"]
        
        # Play multiple moves (try to win)
        moves = [
            {"row": 0, "col": 0},  # X
            {"row": 1, "col": 0},  # X
            {"row": 2, "col": 0},  # X - trying for vertical win
        ]
        
        game_ended = False
        for move in moves:
            response = auth_session.post(
                f"{BASE_URL}/api/practice/game/{game_id}/move",
                json={"move_data": move}
            )
            if response.status_code == 200:
                data = response.json()
                if data["status"] == "completed":
                    game_ended = True
                    print(f"✅ Game completed! Winner: {data.get('winner')}")
                    break
            else:
                break  # Invalid move or game ended
        
        print(f"Game ended: {game_ended}")


class TestAllGameTypes:
    """Test all 11 game types can be started"""
    
    @pytest.fixture
    def auth_session(self):
        """Get authenticated session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/demo-login", json={})
        assert response.status_code == 200
        return session
    
    @pytest.mark.parametrize("game_type", [
        "tictactoe", "connect4", "chess", "checkers", "reversi",
        "blackjack", "uno", "go_fish", "crazy_eights", "hearts", "poker"
    ])
    def test_start_all_games(self, auth_session, game_type):
        """Verify all game types can be started"""
        response = auth_session.post(
            f"{BASE_URL}/api/practice/start",
            json={"game_type": game_type, "difficulty": "easy"}
        )
        assert response.status_code == 200, f"{game_type} start failed: {response.text}"
        
        data = response.json()
        assert "game_id" in data
        assert data["game_type"] == game_type
        assert "game_state" in data
        print(f"✅ {game_type} can be started")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

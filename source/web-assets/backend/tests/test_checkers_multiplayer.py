"""
Checkers Multiplayer Backend Tests
Tests HTTP multiplayer endpoints for Checkers game with Tower Stacking mechanic
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user data
TEST_USER1_ID = f"test_checkers_user1_{uuid.uuid4().hex[:8]}"
TEST_USER1_NAME = "TestPlayer1"
TEST_USER2_ID = f"test_checkers_user2_{uuid.uuid4().hex[:8]}"
TEST_USER2_NAME = "TestPlayer2"


class TestHttpMultiplayerStats:
    """Test multiplayer stats endpoint"""
    
    def test_get_stats(self):
        """Test GET /api/http-multiplayer/stats returns valid stats"""
        response = requests.get(f"{BASE_URL}/api/http-multiplayer/stats")
        assert response.status_code == 200
        
        data = response.json()
        assert "active_games" in data
        assert "total_games" in data
        assert "online_players" in data
        assert "matchmaking_queues" in data
        assert isinstance(data["active_games"], int)
        assert isinstance(data["total_games"], int)
        print(f"✅ Stats: {data}")


class TestHeartbeat:
    """Test heartbeat endpoint for session management"""
    
    def test_heartbeat_creates_session(self):
        """Test POST /api/http-multiplayer/heartbeat creates session"""
        response = requests.post(
            f"{BASE_URL}/api/http-multiplayer/heartbeat",
            params={"user_id": TEST_USER1_ID}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        assert "session_id" in data
        print(f"✅ Heartbeat session created: {data['session_id']}")


class TestMatchmaking:
    """Test matchmaking queue endpoints"""
    
    def test_join_queue_success(self):
        """Test POST /api/http-multiplayer/join-queue adds player to queue"""
        response = requests.post(
            f"{BASE_URL}/api/http-multiplayer/join-queue",
            json={
                "game_type": "checkers",
                "user_id": TEST_USER1_ID,
                "user_name": TEST_USER1_NAME
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        # Either match found or in queue
        assert "match_found" in data
        print(f"✅ Join queue result: match_found={data.get('match_found')}, queue_position={data.get('queue_position')}")
    
    def test_check_match_status(self):
        """Test GET /api/http-multiplayer/check-match/{user_id} returns status"""
        response = requests.get(
            f"{BASE_URL}/api/http-multiplayer/check-match/{TEST_USER1_ID}",
            params={"game_type": "checkers"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "match_found" in data
        print(f"✅ Check match status: {data}")
    
    def test_leave_queue(self):
        """Test POST /api/http-multiplayer/leave-queue removes player"""
        response = requests.post(
            f"{BASE_URL}/api/http-multiplayer/leave-queue",
            params={"user_id": TEST_USER1_ID}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        print("✅ Left matchmaking queue")


class TestCheckersMatchmaking:
    """Test full Checkers matchmaking flow with 2 players"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup unique user IDs for each test"""
        self.user1_id = f"checkers_p1_{uuid.uuid4().hex[:8]}"
        self.user2_id = f"checkers_p2_{uuid.uuid4().hex[:8]}"
        self.game_id = None
        yield
        # Cleanup - leave queues
        requests.post(f"{BASE_URL}/api/http-multiplayer/leave-queue", params={"user_id": self.user1_id})
        requests.post(f"{BASE_URL}/api/http-multiplayer/leave-queue", params={"user_id": self.user2_id})
    
    def test_two_player_matchmaking(self):
        """Test that 2 players joining queue creates a game"""
        # Player 1 joins queue
        response1 = requests.post(
            f"{BASE_URL}/api/http-multiplayer/join-queue",
            json={
                "game_type": "checkers",
                "user_id": self.user1_id,
                "user_name": "Player1"
            }
        )
        assert response1.status_code == 200
        data1 = response1.json()
        assert data1["success"]
        
        # If match found immediately (another player was waiting), test passes
        if data1.get("match_found"):
            print(f"✅ Player 1 matched immediately with game_id: {data1['game_id']}")
            self.game_id = data1["game_id"]
            return
        
        print(f"✅ Player 1 in queue, position: {data1.get('queue_position')}")
        
        # Player 2 joins queue - should create match
        response2 = requests.post(
            f"{BASE_URL}/api/http-multiplayer/join-queue",
            json={
                "game_type": "checkers",
                "user_id": self.user2_id,
                "user_name": "Player2"
            }
        )
        assert response2.status_code == 200
        data2 = response2.json()
        assert data2["success"]
        assert data2["match_found"]
        assert "game_id" in data2
        
        self.game_id = data2["game_id"]
        print(f"✅ Match created! Game ID: {self.game_id}")
        
        # Verify Player 1 can see the match
        check_response = requests.get(
            f"{BASE_URL}/api/http-multiplayer/check-match/{self.user1_id}",
            params={"game_type": "checkers"}
        )
        assert check_response.status_code == 200
        check_data = check_response.json()
        assert check_data["match_found"]
        assert check_data["game_id"] == self.game_id
        print(f"✅ Player 1 sees match: {check_data}")


class TestCheckersGameState:
    """Test Checkers game state and board initialization"""
    
    @pytest.fixture(autouse=True)
    def setup_game(self):
        """Create a game for testing"""
        self.user1_id = f"checkers_game_p1_{uuid.uuid4().hex[:8]}"
        self.user2_id = f"checkers_game_p2_{uuid.uuid4().hex[:8]}"
        
        # Player 1 joins
        requests.post(
            f"{BASE_URL}/api/http-multiplayer/join-queue",
            json={"game_type": "checkers", "user_id": self.user1_id, "user_name": "GamePlayer1"}
        )
        
        # Player 2 joins - creates match
        response = requests.post(
            f"{BASE_URL}/api/http-multiplayer/join-queue",
            json={"game_type": "checkers", "user_id": self.user2_id, "user_name": "GamePlayer2"}
        )
        data = response.json()
        self.game_id = data.get("game_id")
        
        yield
        
        # Cleanup
        requests.post(f"{BASE_URL}/api/http-multiplayer/leave-queue", params={"user_id": self.user1_id})
        requests.post(f"{BASE_URL}/api/http-multiplayer/leave-queue", params={"user_id": self.user2_id})
    
    def test_get_game_state(self):
        """Test GET /api/http-multiplayer/game/{game_id} returns valid state"""
        if not self.game_id:
            pytest.skip("No game created")
        
        response = requests.get(
            f"{BASE_URL}/api/http-multiplayer/game/{self.game_id}",
            params={"user_id": self.user1_id}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["game_id"] == self.game_id
        assert data["game_type"] == "checkers"
        assert data["status"] == "playing"
        assert data["my_role"] == "player1"
        assert "game_state" in data
        assert "board" in data["game_state"]
        print(f"✅ Game state retrieved: status={data['status']}, my_role={data['my_role']}")
    
    def test_checkers_board_initialization(self):
        """Test that Checkers board is initialized correctly with 8x8 grid"""
        if not self.game_id:
            pytest.skip("No game created")
        
        response = requests.get(
            f"{BASE_URL}/api/http-multiplayer/game/{self.game_id}",
            params={"user_id": self.user1_id}
        )
        data = response.json()
        board = data["game_state"]["board"]
        
        # Verify 8x8 board
        assert len(board) == 8, f"Expected 8 rows, got {len(board)}"
        for row in board:
            assert len(row) == 8, f"Expected 8 columns, got {len(row)}"
        
        # Count pieces
        player1_pieces = 0
        player2_pieces = 0
        
        for row_idx, row in enumerate(board):
            for col_idx, cell in enumerate(row):
                if cell:
                    if cell["owner"] == "player1":
                        player1_pieces += 1
                        # Player 1 (red) should be in rows 0-2
                        assert row_idx < 3, f"Player1 piece at wrong row: {row_idx}"
                        assert cell["color"] == "red"
                        assert not cell["isKing"]
                        assert "stack" in cell
                        assert cell["stack"] == ["red"]
                    elif cell["owner"] == "player2":
                        player2_pieces += 1
                        # Player 2 (black) should be in rows 5-7
                        assert row_idx >= 5, f"Player2 piece at wrong row: {row_idx}"
                        assert cell["color"] == "black"
                        assert not cell["isKing"]
                        assert "stack" in cell
                        assert cell["stack"] == ["black"]
        
        assert player1_pieces == 12, f"Expected 12 player1 pieces, got {player1_pieces}"
        assert player2_pieces == 12, f"Expected 12 player2 pieces, got {player2_pieces}"
        print("✅ Board initialized correctly: 8x8 grid, 12 red pieces (rows 0-2), 12 black pieces (rows 5-7)")
    
    def test_tower_stacking_structure(self):
        """Test that pieces have tower stacking structure"""
        if not self.game_id:
            pytest.skip("No game created")
        
        response = requests.get(
            f"{BASE_URL}/api/http-multiplayer/game/{self.game_id}",
            params={"user_id": self.user1_id}
        )
        data = response.json()
        board = data["game_state"]["board"]
        
        # Check first piece has stack array
        for row in board:
            for cell in row:
                if cell:
                    assert "stack" in cell, "Piece missing 'stack' property for tower stacking"
                    assert isinstance(cell["stack"], list), "Stack should be a list"
                    assert len(cell["stack"]) >= 1, "Stack should have at least 1 element"
                    print(f"✅ Tower stacking structure verified: {cell}")
                    return
        
        pytest.fail("No pieces found on board")


class TestCheckersMoveSubmission:
    """Test move submission for Checkers"""
    
    @pytest.fixture(autouse=True)
    def setup_game(self):
        """Create a game for testing moves"""
        self.user1_id = f"checkers_move_p1_{uuid.uuid4().hex[:8]}"
        self.user2_id = f"checkers_move_p2_{uuid.uuid4().hex[:8]}"
        
        # Create game
        requests.post(
            f"{BASE_URL}/api/http-multiplayer/join-queue",
            json={"game_type": "checkers", "user_id": self.user1_id, "user_name": "MovePlayer1"}
        )
        response = requests.post(
            f"{BASE_URL}/api/http-multiplayer/join-queue",
            json={"game_type": "checkers", "user_id": self.user2_id, "user_name": "MovePlayer2"}
        )
        data = response.json()
        self.game_id = data.get("game_id")
        
        yield
        
        requests.post(f"{BASE_URL}/api/http-multiplayer/leave-queue", params={"user_id": self.user1_id})
        requests.post(f"{BASE_URL}/api/http-multiplayer/leave-queue", params={"user_id": self.user2_id})
    
    def test_make_move_success(self):
        """Test POST /api/http-multiplayer/make-move submits move"""
        if not self.game_id:
            pytest.skip("No game created")
        
        # Get initial game state
        state_response = requests.get(
            f"{BASE_URL}/api/http-multiplayer/game/{self.game_id}",
            params={"user_id": self.user1_id}
        )
        initial_state = state_response.json()
        board = initial_state["game_state"]["board"]
        
        # Find a valid move for player1 (red pieces in rows 0-2)
        # Red pieces move down (increasing row)
        from_row, from_col = None, None
        to_row, to_col = None, None
        
        for row_idx in range(3):
            for col_idx in range(8):
                piece = board[row_idx][col_idx]
                if piece and piece["owner"] == "player1":
                    # Try to move diagonally down
                    for d_col in [-1, 1]:
                        new_row = row_idx + 1
                        new_col = col_idx + d_col
                        if 0 <= new_col < 8 and board[new_row][new_col] is None:
                            from_row, from_col = row_idx, col_idx
                            to_row, to_col = new_row, new_col
                            break
                if from_row is not None:
                    break
            if from_row is not None:
                break
        
        if from_row is None:
            pytest.skip("No valid move found")
        
        # Create new board state with move
        new_board = [row[:] for row in board]
        piece = new_board[from_row][from_col]
        new_board[to_row][to_col] = piece
        new_board[from_row][from_col] = None
        
        # Convert to position strings
        from_pos = chr(65 + from_col) + str(from_row + 1)
        to_pos = chr(65 + to_col) + str(to_row + 1)
        
        # Submit move
        move_response = requests.post(
            f"{BASE_URL}/api/http-multiplayer/make-move",
            params={"user_id": self.user1_id},
            json={
                "game_id": self.game_id,
                "move": {"from": from_pos, "to": to_pos},
                "new_game_state": {"board": new_board}
            }
        )
        assert move_response.status_code == 200
        
        move_data = move_response.json()
        assert move_data["success"]
        assert move_data["current_turn"] == "player2"  # Turn switched
        print(f"✅ Move submitted: {from_pos} -> {to_pos}, turn switched to player2")
    
    def test_make_move_not_your_turn(self):
        """Test that making move when not your turn returns error"""
        if not self.game_id:
            pytest.skip("No game created")
        
        # Player 2 tries to move when it's player 1's turn
        move_response = requests.post(
            f"{BASE_URL}/api/http-multiplayer/make-move",
            params={"user_id": self.user2_id},
            json={
                "game_id": self.game_id,
                "move": {"from": "A6", "to": "B5"},
                "new_game_state": {"board": []}
            }
        )
        assert move_response.status_code == 400
        print("✅ Correctly rejected move when not player's turn")


class TestCheckersEndGame:
    """Test end game functionality"""
    
    @pytest.fixture(autouse=True)
    def setup_game(self):
        """Create a game for testing"""
        self.user1_id = f"checkers_end_p1_{uuid.uuid4().hex[:8]}"
        self.user2_id = f"checkers_end_p2_{uuid.uuid4().hex[:8]}"
        
        requests.post(
            f"{BASE_URL}/api/http-multiplayer/join-queue",
            json={"game_type": "checkers", "user_id": self.user1_id, "user_name": "EndPlayer1"}
        )
        response = requests.post(
            f"{BASE_URL}/api/http-multiplayer/join-queue",
            json={"game_type": "checkers", "user_id": self.user2_id, "user_name": "EndPlayer2"}
        )
        data = response.json()
        self.game_id = data.get("game_id")
        
        yield
        
        requests.post(f"{BASE_URL}/api/http-multiplayer/leave-queue", params={"user_id": self.user1_id})
        requests.post(f"{BASE_URL}/api/http-multiplayer/leave-queue", params={"user_id": self.user2_id})
    
    def test_end_game(self):
        """Test POST /api/http-multiplayer/end-game ends game with winner"""
        if not self.game_id:
            pytest.skip("No game created")
        
        response = requests.post(
            f"{BASE_URL}/api/http-multiplayer/end-game",
            params={
                "game_id": self.game_id,
                "user_id": self.user1_id,
                "winner": "player1"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        assert data["winner"] == "player1"
        
        # Verify game state shows completed
        state_response = requests.get(
            f"{BASE_URL}/api/http-multiplayer/game/{self.game_id}",
            params={"user_id": self.user1_id}
        )
        state_data = state_response.json()
        assert state_data["status"] == "completed"
        assert state_data["winner"] == "player1"
        print("✅ Game ended with winner: player1")


class TestGameNotFound:
    """Test error handling for non-existent games"""
    
    def test_get_nonexistent_game(self):
        """Test GET /api/http-multiplayer/game/{game_id} returns 404 for invalid game"""
        response = requests.get(
            f"{BASE_URL}/api/http-multiplayer/game/nonexistent_game_id",
            params={"user_id": "test_user"}
        )
        assert response.status_code == 404
        print("✅ Correctly returned 404 for non-existent game")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

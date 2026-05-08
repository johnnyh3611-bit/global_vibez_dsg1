"""
Test Phase 1 Fixes:
1. Connect 4 - All 7 columns should be clickable and functional
2. Tic-Tac-Toe - All 9 cells should be clickable and functional
3. HouseViews routing (frontend test)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
SESSION_TOKEN = os.environ.get('TEST_SESSION_TOKEN', 'test_session_fixture')

class TestConnect4AllColumns:
    """Test Connect 4 - verify ALL 7 columns work (user reported 'only one spot works')"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session for each test"""
        self.session = requests.Session()
        self.session.cookies.set('session_token', SESSION_TOKEN)
        self.session.headers.update({'Content-Type': 'application/json'})
    
    def test_start_connect4_game(self):
        """Test starting a Connect 4 practice game"""
        response = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "connect4",
            "difficulty": "easy"
        })
        assert response.status_code == 200, f"Failed to start game: {response.text}"
        data = response.json()
        assert "game_id" in data
        assert data["game_type"] == "connect4"
        assert data["current_turn"] == "player"
        # Verify board == 6x7 (6 rows, 7 columns)
        board = data["game_state"]["board"]
        assert len(board) == 6, f"Expected 6 rows, got {len(board)}"
        assert len(board[0]) == 7, f"Expected 7 columns, got {len(board[0])}"
        # Verify colors are set correctly (red/yellow not R/Y)
        assert data["game_state"]["player_color"] == "red"
        assert data["game_state"]["ai_color"] == "yellow"
        return data["game_id"]
    
    def test_connect4_column_0(self):
        """Test clicking column 0 (leftmost)"""
        # Start game
        start_resp = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "connect4", "difficulty": "easy"
        })
        game_id = start_resp.json()["game_id"]
        
        # Make move in column 0
        move_resp = self.session.post(f"{BASE_URL}/api/practice/game/{game_id}/move", json={
            "move_data": {"column": 0}
        })
        assert move_resp.status_code == 200, f"Column 0 failed: {move_resp.text}"
        data = move_resp.json()
        # Verify piece was placed in column 0, bottom row (row 5)
        board = data["game_state"]["board"]
        assert board[5][0] == "red", f"Expected 'red' at [5][0], got '{board[5][0]}'"
    
    def test_connect4_column_1(self):
        """Test clicking column 1"""
        start_resp = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "connect4", "difficulty": "easy"
        })
        game_id = start_resp.json()["game_id"]
        
        move_resp = self.session.post(f"{BASE_URL}/api/practice/game/{game_id}/move", json={
            "move_data": {"column": 1}
        })
        assert move_resp.status_code == 200, f"Column 1 failed: {move_resp.text}"
        board = move_resp.json()["game_state"]["board"]
        assert board[5][1] == "red", f"Expected 'red' at [5][1], got '{board[5][1]}'"
    
    def test_connect4_column_2(self):
        """Test clicking column 2"""
        start_resp = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "connect4", "difficulty": "easy"
        })
        game_id = start_resp.json()["game_id"]
        
        move_resp = self.session.post(f"{BASE_URL}/api/practice/game/{game_id}/move", json={
            "move_data": {"column": 2}
        })
        assert move_resp.status_code == 200, f"Column 2 failed: {move_resp.text}"
        board = move_resp.json()["game_state"]["board"]
        assert board[5][2] == "red", f"Expected 'red' at [5][2], got '{board[5][2]}'"
    
    def test_connect4_column_3(self):
        """Test clicking column 3 (center)"""
        start_resp = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "connect4", "difficulty": "easy"
        })
        game_id = start_resp.json()["game_id"]
        
        move_resp = self.session.post(f"{BASE_URL}/api/practice/game/{game_id}/move", json={
            "move_data": {"column": 3}
        })
        assert move_resp.status_code == 200, f"Column 3 failed: {move_resp.text}"
        board = move_resp.json()["game_state"]["board"]
        assert board[5][3] == "red", f"Expected 'red' at [5][3], got '{board[5][3]}'"
    
    def test_connect4_column_4(self):
        """Test clicking column 4"""
        start_resp = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "connect4", "difficulty": "easy"
        })
        game_id = start_resp.json()["game_id"]
        
        move_resp = self.session.post(f"{BASE_URL}/api/practice/game/{game_id}/move", json={
            "move_data": {"column": 4}
        })
        assert move_resp.status_code == 200, f"Column 4 failed: {move_resp.text}"
        board = move_resp.json()["game_state"]["board"]
        assert board[5][4] == "red", f"Expected 'red' at [5][4], got '{board[5][4]}'"
    
    def test_connect4_column_5(self):
        """Test clicking column 5"""
        start_resp = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "connect4", "difficulty": "easy"
        })
        game_id = start_resp.json()["game_id"]
        
        move_resp = self.session.post(f"{BASE_URL}/api/practice/game/{game_id}/move", json={
            "move_data": {"column": 5}
        })
        assert move_resp.status_code == 200, f"Column 5 failed: {move_resp.text}"
        board = move_resp.json()["game_state"]["board"]
        assert board[5][5] == "red", f"Expected 'red' at [5][5], got '{board[5][5]}'"
    
    def test_connect4_column_6(self):
        """Test clicking column 6 (rightmost)"""
        start_resp = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "connect4", "difficulty": "easy"
        })
        game_id = start_resp.json()["game_id"]
        
        move_resp = self.session.post(f"{BASE_URL}/api/practice/game/{game_id}/move", json={
            "move_data": {"column": 6}
        })
        assert move_resp.status_code == 200, f"Column 6 failed: {move_resp.text}"
        board = move_resp.json()["game_state"]["board"]
        assert board[5][6] == "red", f"Expected 'red' at [5][6], got '{board[5][6]}'"
    
    def test_connect4_ai_responds(self):
        """Test that AI responds after player move"""
        start_resp = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "connect4", "difficulty": "easy"
        })
        game_id = start_resp.json()["game_id"]
        
        move_resp = self.session.post(f"{BASE_URL}/api/practice/game/{game_id}/move", json={
            "move_data": {"column": 3}
        })
        assert move_resp.status_code == 200
        data = move_resp.json()
        
        # AI should have made a move
        assert "ai_move" in data, "AI did not respond with a move"
        assert data["current_turn"] == "player", "Turn should be back to player"
        
        # Count pieces on board - should be 2 (player + AI)
        board = data["game_state"]["board"]
        piece_count = sum(1 for row in board for cell in row if cell != "")
        assert piece_count == 2, f"Expected 2 pieces on board, got {piece_count}"
    
    def test_connect4_multiple_moves_same_column(self):
        """Test stacking pieces in the same column"""
        start_resp = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "connect4", "difficulty": "easy"
        })
        game_id = start_resp.json()["game_id"]
        
        # First move in column 3
        move1 = self.session.post(f"{BASE_URL}/api/practice/game/{game_id}/move", json={
            "move_data": {"column": 3}
        })
        assert move1.status_code == 200
        
        # Second move in column 3 (should stack on top)
        move2 = self.session.post(f"{BASE_URL}/api/practice/game/{game_id}/move", json={
            "move_data": {"column": 3}
        })
        assert move2.status_code == 200
        
        board = move2.json()["game_state"]["board"]
        # Player pieces should be at rows 5 and 4 (or 3 if AI also played there)
        col3_pieces = [board[row][3] for row in range(6) if board[row][3] != ""]
        assert len(col3_pieces) >= 2, f"Expected at least 2 pieces in column 3, got {len(col3_pieces)}"


class TestTicTacToeAllCells:
    """Test Tic-Tac-Toe - verify ALL 9 cells work"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session for each test"""
        self.session = requests.Session()
        self.session.cookies.set('session_token', SESSION_TOKEN)
        self.session.headers.update({'Content-Type': 'application/json'})
    
    def test_start_tictactoe_game(self):
        """Test starting a Tic-Tac-Toe practice game"""
        response = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "tictactoe",
            "difficulty": "easy"
        })
        assert response.status_code == 200, f"Failed to start game: {response.text}"
        data = response.json()
        assert "game_id" in data
        assert data["game_type"] == "tictactoe"
        assert data["current_turn"] == "player"
        # Verify board == 3x3
        board = data["game_state"]["board"]
        assert len(board) == 3, f"Expected 3 rows, got {len(board)}"
        assert len(board[0]) == 3, f"Expected 3 columns, got {len(board[0])}"
    
    def test_tictactoe_cell_0_0(self):
        """Test clicking cell (0,0) - top left"""
        start_resp = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "tictactoe", "difficulty": "easy"
        })
        game_id = start_resp.json()["game_id"]
        
        move_resp = self.session.post(f"{BASE_URL}/api/practice/game/{game_id}/move", json={
            "move_data": {"row": 0, "col": 0}
        })
        assert move_resp.status_code == 200, f"Cell (0,0) failed: {move_resp.text}"
        board = move_resp.json()["game_state"]["board"]
        assert board[0][0] == "X", f"Expected 'X' at [0][0], got '{board[0][0]}'"
    
    def test_tictactoe_cell_0_1(self):
        """Test clicking cell (0,1) - top center"""
        start_resp = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "tictactoe", "difficulty": "easy"
        })
        game_id = start_resp.json()["game_id"]
        
        move_resp = self.session.post(f"{BASE_URL}/api/practice/game/{game_id}/move", json={
            "move_data": {"row": 0, "col": 1}
        })
        assert move_resp.status_code == 200, f"Cell (0,1) failed: {move_resp.text}"
        board = move_resp.json()["game_state"]["board"]
        assert board[0][1] == "X", f"Expected 'X' at [0][1], got '{board[0][1]}'"
    
    def test_tictactoe_cell_0_2(self):
        """Test clicking cell (0,2) - top right"""
        start_resp = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "tictactoe", "difficulty": "easy"
        })
        game_id = start_resp.json()["game_id"]
        
        move_resp = self.session.post(f"{BASE_URL}/api/practice/game/{game_id}/move", json={
            "move_data": {"row": 0, "col": 2}
        })
        assert move_resp.status_code == 200, f"Cell (0,2) failed: {move_resp.text}"
        board = move_resp.json()["game_state"]["board"]
        assert board[0][2] == "X", f"Expected 'X' at [0][2], got '{board[0][2]}'"
    
    def test_tictactoe_cell_1_0(self):
        """Test clicking cell (1,0) - middle left"""
        start_resp = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "tictactoe", "difficulty": "easy"
        })
        game_id = start_resp.json()["game_id"]
        
        move_resp = self.session.post(f"{BASE_URL}/api/practice/game/{game_id}/move", json={
            "move_data": {"row": 1, "col": 0}
        })
        assert move_resp.status_code == 200, f"Cell (1,0) failed: {move_resp.text}"
        board = move_resp.json()["game_state"]["board"]
        assert board[1][0] == "X", f"Expected 'X' at [1][0], got '{board[1][0]}'"
    
    def test_tictactoe_cell_1_1(self):
        """Test clicking cell (1,1) - center"""
        start_resp = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "tictactoe", "difficulty": "easy"
        })
        game_id = start_resp.json()["game_id"]
        
        move_resp = self.session.post(f"{BASE_URL}/api/practice/game/{game_id}/move", json={
            "move_data": {"row": 1, "col": 1}
        })
        assert move_resp.status_code == 200, f"Cell (1,1) failed: {move_resp.text}"
        board = move_resp.json()["game_state"]["board"]
        assert board[1][1] == "X", f"Expected 'X' at [1][1], got '{board[1][1]}'"
    
    def test_tictactoe_cell_1_2(self):
        """Test clicking cell (1,2) - middle right"""
        start_resp = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "tictactoe", "difficulty": "easy"
        })
        game_id = start_resp.json()["game_id"]
        
        move_resp = self.session.post(f"{BASE_URL}/api/practice/game/{game_id}/move", json={
            "move_data": {"row": 1, "col": 2}
        })
        assert move_resp.status_code == 200, f"Cell (1,2) failed: {move_resp.text}"
        board = move_resp.json()["game_state"]["board"]
        assert board[1][2] == "X", f"Expected 'X' at [1][2], got '{board[1][2]}'"
    
    def test_tictactoe_cell_2_0(self):
        """Test clicking cell (2,0) - bottom left"""
        start_resp = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "tictactoe", "difficulty": "easy"
        })
        game_id = start_resp.json()["game_id"]
        
        move_resp = self.session.post(f"{BASE_URL}/api/practice/game/{game_id}/move", json={
            "move_data": {"row": 2, "col": 0}
        })
        assert move_resp.status_code == 200, f"Cell (2,0) failed: {move_resp.text}"
        board = move_resp.json()["game_state"]["board"]
        assert board[2][0] == "X", f"Expected 'X' at [2][0], got '{board[2][0]}'"
    
    def test_tictactoe_cell_2_1(self):
        """Test clicking cell (2,1) - bottom center"""
        start_resp = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "tictactoe", "difficulty": "easy"
        })
        game_id = start_resp.json()["game_id"]
        
        move_resp = self.session.post(f"{BASE_URL}/api/practice/game/{game_id}/move", json={
            "move_data": {"row": 2, "col": 1}
        })
        assert move_resp.status_code == 200, f"Cell (2,1) failed: {move_resp.text}"
        board = move_resp.json()["game_state"]["board"]
        assert board[2][1] == "X", f"Expected 'X' at [2][1], got '{board[2][1]}'"
    
    def test_tictactoe_cell_2_2(self):
        """Test clicking cell (2,2) - bottom right"""
        start_resp = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "tictactoe", "difficulty": "easy"
        })
        game_id = start_resp.json()["game_id"]
        
        move_resp = self.session.post(f"{BASE_URL}/api/practice/game/{game_id}/move", json={
            "move_data": {"row": 2, "col": 2}
        })
        assert move_resp.status_code == 200, f"Cell (2,2) failed: {move_resp.text}"
        board = move_resp.json()["game_state"]["board"]
        assert board[2][2] == "X", f"Expected 'X' at [2][2], got '{board[2][2]}'"
    
    def test_tictactoe_ai_responds(self):
        """Test that AI responds after player move"""
        start_resp = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "tictactoe", "difficulty": "easy"
        })
        game_id = start_resp.json()["game_id"]
        
        move_resp = self.session.post(f"{BASE_URL}/api/practice/game/{game_id}/move", json={
            "move_data": {"row": 1, "col": 1}
        })
        assert move_resp.status_code == 200
        data = move_resp.json()
        
        # AI should have made a move
        assert "ai_move" in data, "AI did not respond with a move"
        
        # Count pieces on board - should be 2 (player + AI)
        board = data["game_state"]["board"]
        piece_count = sum(1 for row in board for cell in row if cell != "")
        assert piece_count == 2, f"Expected 2 pieces on board, got {piece_count}"


class TestHouseViewsAPI:
    """Test HouseViews related APIs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session for each test"""
        self.session = requests.Session()
        self.session.cookies.set('session_token', SESSION_TOKEN)
        self.session.headers.update({'Content-Type': 'application/json'})
    
    def test_tables_available_endpoint(self):
        """Test /api/tables/available endpoint"""
        response = self.session.get(f"{BASE_URL}/api/tables/available")
        # This endpoint may or may not exist - just check it doesn't 500
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
    
    def test_profile_endpoint(self):
        """Test /api/profile endpoint (used by HouseViews)"""
        response = self.session.get(f"{BASE_URL}/api/profile")
        assert response.status_code == 200, f"Profile endpoint failed: {response.text}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

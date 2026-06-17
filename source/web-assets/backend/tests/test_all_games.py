"""
Comprehensive Practice Games API Tests
Tests all 12 practice games: 7 Card Games + 5 Board Games
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test session token - from environment or fixture
SESSION_TOKEN = os.environ.get('TEST_SESSION_TOKEN', 'test_session_fixture')

class TestPracticeGamesAPI:
    """Test all practice game endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session for all tests"""
        self.session = requests.Session()
        self.session.cookies.set('session_token', SESSION_TOKEN)
        self.session.headers.update({'Content-Type': 'application/json'})
    
    # ==================== CARD GAMES (7) ====================
    
    def test_01_uno_game_start(self):
        """Test UNO game initialization"""
        response = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "uno",
            "difficulty": "medium"
        })
        assert response.status_code == 200, f"UNO start failed: {response.text}"
        data = response.json()
        
        # Verify game state structure
        assert "game_id" in data
        assert data["game_type"] == "uno"
        assert "game_state" in data
        
        game_state = data["game_state"]
        assert "player_hand" in game_state, "UNO should have player_hand"
        assert "ai_hand_count" in game_state, "UNO should have ai_hand_count"
        assert "top_card" in game_state, "UNO should have top_card"
        assert len(game_state["player_hand"]) == 7, "UNO player should start with 7 cards"
        assert game_state["ai_hand_count"] == 7, "UNO AI should start with 7 cards"
        
        print(f"✅ UNO game started: {data['game_id']}")
        print(f"   Player hand: {game_state['player_hand']}")
        print(f"   Top card: {game_state['top_card']}")
        return data["game_id"]
    
    def test_02_poker_game_start(self):
        """Test Poker game initialization"""
        response = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "poker",
            "difficulty": "medium"
        })
        assert response.status_code == 200, f"Poker start failed: {response.text}"
        data = response.json()
        
        game_state = data["game_state"]
        assert "player_hand" in game_state, "Poker should have player_hand"
        assert "community_cards" in game_state, "Poker should have community_cards"
        assert "pot" in game_state, "Poker should have pot"
        assert "player_chips" in game_state, "Poker should have player_chips"
        assert len(game_state["player_hand"]) == 2, "Poker player should start with 2 cards"
        
        print(f"✅ Poker game started: {data['game_id']}")
        print(f"   Player hand: {game_state['player_hand']}")
        print(f"   Pot: {game_state['pot']}, Chips: {game_state['player_chips']}")
    
    def test_03_spades_game_start(self):
        """Test Spades game initialization - Revolutionary with bidding system"""
        response = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "spades",
            "difficulty": "medium"
        })
        assert response.status_code == 200, f"Spades start failed: {response.text}"
        data = response.json()
        
        game_state = data["game_state"]
        assert "player_hand" in game_state, "Spades should have player_hand"
        assert "partner_hand" in game_state, "Spades should have partner_hand (4-player)"
        assert "opp1_hand" in game_state, "Spades should have opp1_hand"
        assert "opp2_hand" in game_state, "Spades should have opp2_hand"
        assert "phase" in game_state, "Spades should have phase"
        assert game_state["phase"] == "bidding", "Spades should start in bidding phase"
        assert "team_scores" in game_state, "Spades should have team_scores"
        assert "team_bids" in game_state, "Spades should have team_bids"
        assert "bags" in game_state, "Spades should have bags"
        assert len(game_state["player_hand"]) == 13, "Spades player should have 13 cards"
        
        # Verify card structure
        first_card = game_state["player_hand"][0]
        assert "suit" in first_card, "Spades cards should have suit"
        assert "rank" in first_card, "Spades cards should have rank"
        assert "value" in first_card, "Spades cards should have value"
        
        print(f"✅ Spades game started: {data['game_id']}")
        print(f"   Phase: {game_state['phase']}")
        print(f"   Player cards: {len(game_state['player_hand'])}")
        print(f"   Team scores: {game_state['team_scores']}")
        return data["game_id"]
    
    def test_04_hearts_game_start(self):
        """Test Hearts game initialization"""
        response = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "hearts",
            "difficulty": "medium"
        })
        assert response.status_code == 200, f"Hearts start failed: {response.text}"
        data = response.json()
        
        game_state = data["game_state"]
        assert "player_hand" in game_state, "Hearts should have player_hand"
        assert "ai_hand" in game_state, "Hearts should have ai_hand"
        assert "current_trick" in game_state, "Hearts should have current_trick"
        assert "player_score" in game_state, "Hearts should have player_score"
        assert "ai_score" in game_state, "Hearts should have ai_score"
        assert len(game_state["player_hand"]) == 13, "Hearts player should have 13 cards"
        
        print(f"✅ Hearts game started: {data['game_id']}")
        print(f"   Player cards: {len(game_state['player_hand'])}")
    
    def test_05_go_fish_game_start(self):
        """Test Go Fish game initialization"""
        response = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "go_fish",
            "difficulty": "easy"
        })
        assert response.status_code == 200, f"Go Fish start failed: {response.text}"
        data = response.json()
        
        game_state = data["game_state"]
        assert "player_hand" in game_state, "Go Fish should have player_hand"
        assert "ai_hand_count" in game_state, "Go Fish should have ai_hand_count"
        assert "deck_count" in game_state, "Go Fish should have deck_count"
        assert len(game_state["player_hand"]) == 7, "Go Fish player should start with 7 cards"
        
        print(f"✅ Go Fish game started: {data['game_id']}")
    
    def test_06_crazy_eights_game_start(self):
        """Test Crazy Eights game initialization"""
        response = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "crazy_eights",
            "difficulty": "easy"
        })
        assert response.status_code == 200, f"Crazy Eights start failed: {response.text}"
        data = response.json()
        
        game_state = data["game_state"]
        assert "player_hand" in game_state, "Crazy Eights should have player_hand"
        assert "ai_hand_count" in game_state, "Crazy Eights should have ai_hand_count"
        assert "top_card" in game_state, "Crazy Eights should have top_card"
        assert len(game_state["player_hand"]) == 8, "Crazy Eights player should start with 8 cards"
        
        print(f"✅ Crazy Eights game started: {data['game_id']}")
    
    def test_07_blackjack_game_start(self):
        """Test Blackjack game initialization"""
        response = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "blackjack",
            "difficulty": "medium"
        })
        assert response.status_code == 200, f"Blackjack start failed: {response.text}"
        data = response.json()
        
        game_state = data["game_state"]
        assert "player_hand" in game_state, "Blackjack should have player_hand"
        assert "dealer_hand" in game_state, "Blackjack should have dealer_hand"
        assert "deck" in game_state, "Blackjack should have deck"
        assert len(game_state["player_hand"]) == 2, "Blackjack player should start with 2 cards"
        assert len(game_state["dealer_hand"]) == 2, "Blackjack dealer should start with 2 cards"
        
        print(f"✅ Blackjack game started: {data['game_id']}")
        print(f"   Player hand: {game_state['player_hand']}")
    
    # ==================== BOARD GAMES (5) ====================
    
    def test_08_tictactoe_game_start(self):
        """Test Tic-Tac-Toe game initialization"""
        response = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "tictactoe",
            "difficulty": "easy"
        })
        assert response.status_code == 200, f"Tic-Tac-Toe start failed: {response.text}"
        data = response.json()
        
        game_state = data["game_state"]
        assert "board" in game_state, "Tic-Tac-Toe should have board"
        assert len(game_state["board"]) == 3, "Tic-Tac-Toe board should be 3x3"
        assert len(game_state["board"][0]) == 3, "Tic-Tac-Toe board should be 3x3"
        
        print(f"✅ Tic-Tac-Toe game started: {data['game_id']}")
        return data["game_id"]
    
    def test_09_connect4_game_start(self):
        """Test Connect 4 game initialization"""
        response = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "connect4",
            "difficulty": "medium"
        })
        assert response.status_code == 200, f"Connect 4 start failed: {response.text}"
        data = response.json()
        
        game_state = data["game_state"]
        assert "board" in game_state, "Connect 4 should have board"
        assert len(game_state["board"]) == 6, "Connect 4 board should be 6 rows"
        assert len(game_state["board"][0]) == 7, "Connect 4 board should be 7 columns"
        
        print(f"✅ Connect 4 game started: {data['game_id']}")
    
    def test_10_checkers_game_start(self):
        """Test Checkers game initialization"""
        response = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "checkers",
            "difficulty": "medium"
        })
        assert response.status_code == 200, f"Checkers start failed: {response.text}"
        data = response.json()
        
        game_state = data["game_state"]
        assert "board" in game_state, "Checkers should have board"
        assert len(game_state["board"]) == 8, "Checkers board should be 8x8"
        
        # Count pieces
        player_pieces = 0
        ai_pieces = 0
        for row in game_state["board"]:
            for cell in row:
                if cell and cell.get("player") == "player":
                    player_pieces += 1
                elif cell and cell.get("player") == "ai":
                    ai_pieces += 1
        
        assert player_pieces == 12, f"Checkers player should have 12 pieces, got {player_pieces}"
        assert ai_pieces == 12, f"Checkers AI should have 12 pieces, got {ai_pieces}"
        
        print(f"✅ Checkers game started: {data['game_id']}")
        print(f"   Player pieces: {player_pieces}, AI pieces: {ai_pieces}")
    
    def test_11_chess_game_start(self):
        """Test Chess game initialization"""
        response = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "chess",
            "difficulty": "hard"
        })
        assert response.status_code == 200, f"Chess start failed: {response.text}"
        data = response.json()
        
        game_state = data["game_state"]
        assert "fen" in game_state, "Chess should have FEN notation"
        assert "moves_history" in game_state, "Chess should have moves_history"
        
        # Verify starting FEN
        expected_start = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        assert game_state["fen"] == expected_start, "Chess should start with standard position"
        
        print(f"✅ Chess game started: {data['game_id']}")
        print(f"   FEN: {game_state['fen']}")
        return data["game_id"]
    
    def test_12_reversi_game_start(self):
        """Test Reversi game initialization"""
        response = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "reversi",
            "difficulty": "medium"
        })
        assert response.status_code == 200, f"Reversi start failed: {response.text}"
        data = response.json()
        
        game_state = data["game_state"]
        assert "board" in game_state, "Reversi should have board"
        assert len(game_state["board"]) == 8, "Reversi board should be 8x8"
        
        # Verify starting position (center 4 pieces)
        board = game_state["board"]
        assert board[3][3] == "ai", "Reversi center should have AI piece"
        assert board[3][4] == "player", "Reversi center should have player piece"
        assert board[4][3] == "player", "Reversi center should have player piece"
        assert board[4][4] == "ai", "Reversi center should have AI piece"
        
        print(f"✅ Reversi game started: {data['game_id']}")
    
    # ==================== GAME MOVES TESTS ====================
    
    def test_13_tictactoe_make_move(self):
        """Test making a move in Tic-Tac-Toe"""
        # Start game
        start_response = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "tictactoe",
            "difficulty": "easy"
        })
        game_id = start_response.json()["game_id"]
        
        # Make move
        move_response = self.session.post(f"{BASE_URL}/api/practice/game/{game_id}/move", json={
            "move_data": {"row": 1, "col": 1}  # Center
        })
        assert move_response.status_code == 200, f"Move failed: {move_response.text}"
        data = move_response.json()
        
        # Verify move was applied
        board = data["game_state"]["board"]
        assert board[1][1] == "X", "Player move should be X"
        
        # AI should have responded
        ai_moved = any(cell == "O" for row in board for cell in row)
        assert ai_moved, "AI should have made a move"
        
        print("✅ Tic-Tac-Toe move successful")
        print(f"   Board: {board}")
    
    def test_14_uno_draw_card(self):
        """Test drawing a card in UNO"""
        # Start game
        start_response = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "uno",
            "difficulty": "easy"
        })
        game_id = start_response.json()["game_id"]
        initial_hand_size = len(start_response.json()["game_state"]["player_hand"])
        
        # Draw card
        move_response = self.session.post(f"{BASE_URL}/api/practice/game/{game_id}/move", json={
            "move_data": {"action": "draw"}
        })
        assert move_response.status_code == 200, f"Draw failed: {move_response.text}"
        data = move_response.json()
        
        # Verify card was drawn
        new_hand_size = len(data["game_state"]["player_hand"])
        assert new_hand_size == initial_hand_size + 1, "Player should have 1 more card after draw"
        
        print("✅ UNO draw card successful")
        print(f"   Hand size: {initial_hand_size} -> {new_hand_size}")
    
    def test_15_spades_bidding(self):
        """Test Spades bidding phase"""
        # Start game
        start_response = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "spades",
            "difficulty": "medium"
        })
        game_id = start_response.json()["game_id"]
        
        # Place bid
        move_response = self.session.post(f"{BASE_URL}/api/practice/game/{game_id}/move", json={
            "move_data": {"action": "bid", "bid": 3}
        })
        assert move_response.status_code == 200, f"Bid failed: {move_response.text}"
        data = move_response.json()
        
        game_state = data["game_state"]
        
        # Verify bid was recorded
        assert game_state["bids"]["player"] == 3, "Player bid should be 3"
        
        # Verify AI bids were made
        assert game_state["bids"]["partner"] is not None, "Partner should have bid"
        assert game_state["bids"]["opp1"] is not None, "Opp1 should have bid"
        assert game_state["bids"]["opp2"] is not None, "Opp2 should have bid"
        
        # Verify phase changed to playing
        assert game_state["phase"] == "playing", "Phase should change to playing after bidding"
        
        # Verify team bids calculated
        expected_team1_bid = game_state["bids"]["player"] + game_state["bids"]["partner"]
        assert game_state["team_bids"]["team1"] == expected_team1_bid, "Team 1 bid should be sum of player + partner"
        
        print("✅ Spades bidding successful")
        print(f"   Player bid: {game_state['bids']['player']}")
        print(f"   Team bids: {game_state['team_bids']}")
        print(f"   Phase: {game_state['phase']}")
    
    def test_16_blackjack_hit(self):
        """Test Blackjack hit action"""
        # Start game
        start_response = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "blackjack",
            "difficulty": "medium"
        })
        game_id = start_response.json()["game_id"]
        initial_hand_size = len(start_response.json()["game_state"]["player_hand"])
        
        # Hit
        move_response = self.session.post(f"{BASE_URL}/api/practice/game/{game_id}/move", json={
            "move_data": {"action": "hit"}
        })
        assert move_response.status_code == 200, f"Hit failed: {move_response.text}"
        data = move_response.json()
        
        # Verify card was dealt
        new_hand_size = len(data["game_state"]["player_hand"])
        assert new_hand_size == initial_hand_size + 1, "Player should have 1 more card after hit"
        
        print("✅ Blackjack hit successful")
        print(f"   Hand: {data['game_state']['player_hand']}")
    
    def test_17_reversi_make_move(self):
        """Test making a move in Reversi"""
        # Start game
        start_response = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "reversi",
            "difficulty": "medium"
        })
        game_id = start_response.json()["game_id"]
        
        # Make valid move (one of the 4 valid starting moves)
        move_response = self.session.post(f"{BASE_URL}/api/practice/game/{game_id}/move", json={
            "move_data": {"row": 2, "col": 3}  # Valid opening move
        })
        assert move_response.status_code == 200, f"Move failed: {move_response.text}"
        data = move_response.json()
        
        # Verify move was applied
        board = data["game_state"]["board"]
        assert board[2][3] == "player", "Player move should be placed"
        
        print("✅ Reversi move successful")
    
    def test_18_connect4_make_move(self):
        """Test making a move in Connect 4"""
        # Start game
        start_response = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "connect4",
            "difficulty": "medium"
        })
        game_id = start_response.json()["game_id"]
        
        # Drop piece in center column
        move_response = self.session.post(f"{BASE_URL}/api/practice/game/{game_id}/move", json={
            "move_data": {"col": 3}
        })
        assert move_response.status_code == 200, f"Move failed: {move_response.text}"
        data = move_response.json()
        
        # Verify piece dropped to bottom
        board = data["game_state"]["board"]
        assert board[5][3] == "R", "Player piece should be at bottom of column"
        
        # AI should have responded
        ai_moved = any(cell == "Y" for row in board for cell in row)
        assert ai_moved, "AI should have made a move"
        
        print("✅ Connect 4 move successful")
    
    # ==================== GAME RETRIEVAL TEST ====================
    
    def test_19_get_game_state(self):
        """Test retrieving game state"""
        # Start game
        start_response = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "tictactoe",
            "difficulty": "easy"
        })
        game_id = start_response.json()["game_id"]
        
        # Get game
        get_response = self.session.get(f"{BASE_URL}/api/practice/game/{game_id}")
        assert get_response.status_code == 200, f"Get game failed: {get_response.text}"
        data = get_response.json()
        
        assert data["game_id"] == game_id
        assert data["game_type"] == "tictactoe"
        assert "game_state" in data
        
        print("✅ Game retrieval successful")
    
    def test_20_practice_stats(self):
        """Test practice stats endpoint"""
        response = self.session.get(f"{BASE_URL}/api/practice/stats")
        assert response.status_code == 200, f"Stats failed: {response.text}"
        data = response.json()
        
        assert "total_games" in data
        assert "wins" in data
        assert "losses" in data
        assert "win_rate" in data
        
        print("✅ Practice stats retrieved")
        print(f"   Total games: {data['total_games']}")


class TestGameValidation:
    """Test game validation and error handling"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.cookies.set('session_token', SESSION_TOKEN)
        self.session.headers.update({'Content-Type': 'application/json'})
    
    def test_invalid_game_type(self):
        """Test starting invalid game type"""
        response = self.session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "invalid_game",
            "difficulty": "medium"
        })
        assert response.status_code == 400, "Should reject invalid game type"
        print("✅ Invalid game type rejected correctly")
    
    def test_game_not_found(self):
        """Test accessing non-existent game"""
        response = self.session.get(f"{BASE_URL}/api/practice/game/nonexistent_game_id")
        assert response.status_code == 404, "Should return 404 for non-existent game"
        print("✅ Non-existent game returns 404")
    
    def test_unauthenticated_access(self):
        """Test unauthenticated access"""
        session = requests.Session()  # No auth
        response = session.post(f"{BASE_URL}/api/practice/start", json={
            "game_type": "tictactoe",
            "difficulty": "easy"
        })
        assert response.status_code == 401, "Should reject unauthenticated request"
        print("✅ Unauthenticated access rejected")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

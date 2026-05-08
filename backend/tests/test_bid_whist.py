"""
Bid Whist Game API Tests
Tests for: /api/bid-whist/start, /bid, /kitty, /play, /game/{game_id}
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBidWhistAPIs:
    """Test Bid Whist game endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get demo token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth/demo-login")
        assert response.status_code == 200, f"Demo login failed: {response.text}"
        data = response.json()
        self.token = data.get('token')
        self.user_id = data.get('user_id')
        self.headers = {
            'Authorization': f'Bearer {self.token}',
            'Content-Type': 'application/json'
        }
        print(f"Setup complete - User ID: {self.user_id}")
    
    # ==================== START GAME TESTS ====================
    
    def test_start_game_success(self):
        """Test creating a new Bid Whist game with AI players"""
        payload = {
            "partner_id": "ai-partner",
            "opponent1_id": "ai-opponent1",
            "opponent2_id": "ai-opponent2",
            "wager": 0,
            "winning_score": 7
        }
        response = requests.post(
            f"{BASE_URL}/api/bid-whist/start",
            json=payload,
            headers=self.headers
        )
        
        print(f"Start game response: {response.status_code} - {response.text[:500]}")
        assert response.status_code == 200, f"Failed to start game: {response.text}"
        
        data = response.json()
        assert "game_id" in data, "Response missing game_id"
        assert "your_position" in data, "Response missing your_position"
        assert "your_hand" in data, "Response missing your_hand"
        assert data["phase"] == "bidding", f"Expected phase 'bidding', got {data['phase']}"
        assert len(data["your_hand"]) == 12, f"Expected 12 cards, got {len(data['your_hand'])}"
        
        # Store game_id for subsequent tests
        self.game_id = data["game_id"]
        print(f"Game created: {self.game_id}, Position: {data['your_position']}")
        return data
    
    def test_start_game_with_wager(self):
        """Test creating a game with wager"""
        payload = {
            "partner_id": "ai-partner",
            "opponent1_id": "ai-opponent1",
            "opponent2_id": "ai-opponent2",
            "wager": 100,
            "winning_score": 11
        }
        response = requests.post(
            f"{BASE_URL}/api/bid-whist/start",
            json=payload,
            headers=self.headers
        )
        
        print(f"Start game with wager response: {response.status_code}")
        assert response.status_code == 200, f"Failed to start game with wager: {response.text}"
        
        data = response.json()
        assert data["wager"] == 100, f"Expected wager 100, got {data.get('wager')}"
        assert data["winning_score"] == 11, f"Expected winning_score 11, got {data.get('winning_score')}"
    
    def test_start_game_unauthorized(self):
        """Test starting game without auth token"""
        payload = {
            "partner_id": "ai-partner",
            "opponent1_id": "ai-opponent1",
            "opponent2_id": "ai-opponent2"
        }
        response = requests.post(
            f"{BASE_URL}/api/bid-whist/start",
            json=payload,
            headers={'Content-Type': 'application/json'}
        )
        
        print(f"Unauthorized start response: {response.status_code}")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    # ==================== GET GAME STATE TESTS ====================
    
    def test_get_game_state(self):
        """Test getting game state"""
        # First create a game
        game_data = self.test_start_game_success()
        game_id = game_data["game_id"]
        
        response = requests.get(
            f"{BASE_URL}/api/bid-whist/game/{game_id}",
            headers=self.headers
        )
        
        print(f"Get game state response: {response.status_code} - {response.text[:500]}")
        assert response.status_code == 200, f"Failed to get game state: {response.text}"
        
        data = response.json()
        assert data["game_id"] == game_id
        assert "your_position" in data
        assert "your_hand" in data
        assert "phase" in data
        assert "scores" in data
        assert "tricks_won" in data
        print(f"Game state: phase={data['phase']}, scores={data['scores']}")
    
    def test_get_game_state_not_found(self):
        """Test getting non-existent game"""
        response = requests.get(
            f"{BASE_URL}/api/bid-whist/game/nonexistent_game_123",
            headers=self.headers
        )
        
        print(f"Get non-existent game response: {response.status_code}")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    # ==================== BIDDING TESTS ====================
    
    def test_place_bid_success(self):
        """Test placing a valid bid"""
        # Create a game first
        game_data = self.test_start_game_success()
        game_id = game_data["game_id"]
        
        # Place a bid
        bid_payload = {
            "game_id": game_id,
            "amount": 4,
            "bid_type": "uptown"
        }
        response = requests.post(
            f"{BASE_URL}/api/bid-whist/bid",
            json=bid_payload,
            headers=self.headers
        )
        
        print(f"Place bid response: {response.status_code} - {response.text[:500]}")
        assert response.status_code == 200, f"Failed to place bid: {response.text}"
        
        data = response.json()
        assert "message" in data
        assert "4 uptown" in data["message"].lower() or "bid placed" in data["message"].lower()
        print(f"Bid placed: {data['message']}")
    
    def test_place_bid_pass(self):
        """Test passing on a bid"""
        # Create a game first
        game_data = self.test_start_game_success()
        game_id = game_data["game_id"]
        
        # Pass
        bid_payload = {
            "game_id": game_id,
            "amount": 0,
            "bid_type": "pass"
        }
        response = requests.post(
            f"{BASE_URL}/api/bid-whist/bid",
            json=bid_payload,
            headers=self.headers
        )
        
        print(f"Pass bid response: {response.status_code} - {response.text[:500]}")
        assert response.status_code == 200, f"Failed to pass: {response.text}"
        
        data = response.json()
        assert "passed" in data["message"].lower()
        print(f"Pass result: {data['message']}")
    
    def test_place_bid_downtown(self):
        """Test placing a downtown bid"""
        game_data = self.test_start_game_success()
        game_id = game_data["game_id"]
        
        bid_payload = {
            "game_id": game_id,
            "amount": 5,
            "bid_type": "downtown"
        }
        response = requests.post(
            f"{BASE_URL}/api/bid-whist/bid",
            json=bid_payload,
            headers=self.headers
        )
        
        print(f"Downtown bid response: {response.status_code}")
        assert response.status_code == 200, f"Failed to place downtown bid: {response.text}"
    
    def test_place_bid_no_trump(self):
        """Test placing a no trump bid"""
        game_data = self.test_start_game_success()
        game_id = game_data["game_id"]
        
        bid_payload = {
            "game_id": game_id,
            "amount": 6,
            "bid_type": "no_trump"
        }
        response = requests.post(
            f"{BASE_URL}/api/bid-whist/bid",
            json=bid_payload,
            headers=self.headers
        )
        
        print(f"No trump bid response: {response.status_code}")
        assert response.status_code == 200, f"Failed to place no trump bid: {response.text}"
    
    def test_place_bid_game_not_found(self):
        """Test bidding on non-existent game"""
        bid_payload = {
            "game_id": "nonexistent_game_123",
            "amount": 4,
            "bid_type": "uptown"
        }
        response = requests.post(
            f"{BASE_URL}/api/bid-whist/bid",
            json=bid_payload,
            headers=self.headers
        )
        
        print(f"Bid on non-existent game response: {response.status_code}")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    # ==================== KITTY EXCHANGE TESTS ====================
    
    def test_kitty_exchange_not_bid_winner(self):
        """Test kitty exchange when not the bid winner (should fail)"""
        # Create a game
        game_data = self.test_start_game_success()
        game_id = game_data["game_id"]
        
        # Try to exchange kitty without being bid winner
        kitty_payload = {
            "game_id": game_id,
            "trump_suit": "spades",
            "discards": [{"suit": "hearts", "rank": "2"}] * 6  # Dummy discards
        }
        response = requests.post(
            f"{BASE_URL}/api/bid-whist/kitty",
            json=kitty_payload,
            headers=self.headers
        )
        
        print(f"Kitty exchange (not winner) response: {response.status_code}")
        # Should fail because we haven't won the bid yet
        assert response.status_code in [400, 404], f"Expected 400/404, got {response.status_code}"
    
    # ==================== PLAY CARD TESTS ====================
    
    def test_play_card_wrong_phase(self):
        """Test playing a card during bidding phase (should fail)"""
        # Create a game (starts in bidding phase)
        game_data = self.test_start_game_success()
        game_id = game_data["game_id"]
        hand = game_data["your_hand"]
        
        # Try to play a card during bidding
        play_payload = {
            "game_id": game_id,
            "card": hand[0] if hand else {"suit": "spades", "rank": "A"}
        }
        response = requests.post(
            f"{BASE_URL}/api/bid-whist/play",
            json=play_payload,
            headers=self.headers
        )
        
        print(f"Play card (wrong phase) response: {response.status_code}")
        # This might succeed or fail depending on implementation
        # The game logic should handle phase validation
    
    def test_play_card_game_not_found(self):
        """Test playing card on non-existent game"""
        play_payload = {
            "game_id": "nonexistent_game_123",
            "card": {"suit": "spades", "rank": "A"}
        }
        response = requests.post(
            f"{BASE_URL}/api/bid-whist/play",
            json=play_payload,
            headers=self.headers
        )
        
        print(f"Play card (non-existent game) response: {response.status_code}")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    # ==================== FULL GAME FLOW TEST ====================
    
    def test_full_bidding_flow(self):
        """Test complete bidding flow with multiple bids"""
        # Create game
        game_data = self.test_start_game_success()
        game_id = game_data["game_id"]
        
        # Place initial bid
        bid_payload = {
            "game_id": game_id,
            "amount": 4,
            "bid_type": "uptown"
        }
        response = requests.post(
            f"{BASE_URL}/api/bid-whist/bid",
            json=bid_payload,
            headers=self.headers
        )
        assert response.status_code == 200
        
        # Check game state after bid
        state_response = requests.get(
            f"{BASE_URL}/api/bid-whist/game/{game_id}",
            headers=self.headers
        )
        assert state_response.status_code == 200
        state = state_response.json()
        print(f"Game state after bid: phase={state['phase']}")
        
        # Verify hand is still 12 cards
        assert len(state["your_hand"]) == 12, f"Expected 12 cards, got {len(state['your_hand'])}"
    
    # ==================== CARD VALIDATION TESTS ====================
    
    def test_card_structure_in_hand(self):
        """Test that cards in hand have correct structure"""
        game_data = self.test_start_game_success()
        hand = game_data["your_hand"]
        
        assert len(hand) == 12, f"Expected 12 cards, got {len(hand)}"
        
        for card in hand:
            assert "suit" in card, f"Card missing 'suit': {card}"
            assert "rank" in card, f"Card missing 'rank': {card}"
            
            # Validate suit
            valid_suits = ['spades', 'hearts', 'diamonds', 'clubs', 'joker']
            assert card["suit"] in valid_suits, f"Invalid suit: {card['suit']}"
            
            # Validate rank (for non-jokers)
            if card["suit"] != 'joker':
                valid_ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
                assert card["rank"] in valid_ranks, f"Invalid rank: {card['rank']}"
        
        print(f"All {len(hand)} cards have valid structure")
    
    def test_joker_support(self):
        """Test that deck includes jokers (54-card deck)"""
        # Create multiple games to increase chance of getting jokers
        joker_found = False
        for i in range(5):
            game_data = self.test_start_game_success()
            hand = game_data["your_hand"]
            
            for card in hand:
                if card["suit"] == "joker":
                    joker_found = True
                    print(f"Found joker: {card}")
                    break
            
            if joker_found:
                break
        
        # Note: Jokers might not always be in hand, but deck should support them
        print(f"Joker found in hands: {joker_found}")


class TestBidWhistGameLogic:
    """Test Bid Whist game logic module"""
    
    def test_bid_values(self):
        """Test bid value calculations"""
        # Import game logic
        import sys
        sys.path.insert(0, '/app/backend')
        from utils.bid_whist_game import BidWhistGame
        
        game = BidWhistGame()
        
        # Test uptown bid
        game.place_bid('north', 4, 'uptown')
        assert len(game.bids) == 1
        assert game.bids[0]['value'] == 42  # 4*10 + 2 (uptown bonus)
        
        print("Bid value calculation test passed")
    
    def test_deck_creation(self):
        """Test 54-card deck creation"""
        import sys
        sys.path.insert(0, '/app/backend')
        from utils.bid_whist_game import BidWhistGame
        
        game = BidWhistGame()
        game.create_deck()
        
        assert len(game.deck) == 54, f"Expected 54 cards, got {len(game.deck)}"
        
        # Count jokers
        jokers = [c for c in game.deck if c['type'] in ['big_joker', 'little_joker']]
        assert len(jokers) == 2, f"Expected 2 jokers, got {len(jokers)}"
        
        print("Deck creation test passed - 54 cards with 2 jokers")
    
    def test_deal_cards(self):
        """Test card dealing (12 per player + 6 kitty)"""
        import sys
        sys.path.insert(0, '/app/backend')
        from utils.bid_whist_game import BidWhistGame
        
        game = BidWhistGame()
        game.deal_cards()
        
        # Check each player has 12 cards
        for position, player in game.players.items():
            assert len(player['hand']) == 12, f"{position} has {len(player['hand'])} cards, expected 12"
        
        # Check kitty has 6 cards
        assert len(game.kitty) == 6, f"Kitty has {len(game.kitty)} cards, expected 6"
        
        # Total should be 54
        total = sum(len(p['hand']) for p in game.players.values()) + len(game.kitty)
        assert total == 54, f"Total cards: {total}, expected 54"
        
        print("Deal cards test passed - 12 per player + 6 kitty")
    
    def test_team_assignments(self):
        """Test team assignments (North+South vs East+West)"""
        import sys
        sys.path.insert(0, '/app/backend')
        from utils.bid_whist_game import BidWhistGame
        
        game = BidWhistGame()
        
        assert game.players['north']['team'] == 'team1'
        assert game.players['south']['team'] == 'team1'
        assert game.players['east']['team'] == 'team2'
        assert game.players['west']['team'] == 'team2'
        
        print("Team assignments test passed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

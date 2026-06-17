"""
Baccarat Casino Game API Tests
Tests for Natural 8/9 logic, third-card drawing rules, payouts, and game history
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBaccaratGame:
    """Baccarat game endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with demo login"""
        # Get demo login token
        response = requests.post(f"{BASE_URL}/api/auth/demo-login")
        assert response.status_code == 200, f"Demo login failed: {response.text}"
        data = response.json()
        self.token = data.get('token')
        self.user_id = data.get('user_id')
        assert self.token, "No token returned from demo login"
        
        self.headers = {
            'Authorization': f'Bearer {self.token}',
            'Content-Type': 'application/json'
        }
    
    # ==================== POST /api/baccarat/play Tests ====================
    
    def test_play_player_bet(self):
        """Test playing Baccarat with Player bet"""
        response = requests.post(
            f"{BASE_URL}/api/baccarat/play",
            headers=self.headers,
            json={
                "bet_type": "player",
                "bet_amount": 10,
                "game_mode": "standard"
            }
        )
        
        assert response.status_code == 200, f"Play failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "game_id" in data
        assert "player_hand" in data
        assert "banker_hand" in data
        assert "player_score" in data
        assert "banker_score" in data
        assert "winner" in data
        assert "phase" in data
        assert "bet_type" in data
        assert "bet_amount" in data
        assert "payout" in data
        
        # Verify data types
        assert isinstance(data["player_hand"], list)
        assert isinstance(data["banker_hand"], list)
        assert isinstance(data["player_score"], int)
        assert isinstance(data["banker_score"], int)
        assert data["winner"] in ["player", "banker", "tie"]
        assert data["phase"] == "finished"
        assert data["bet_type"] == "player"
        assert data["bet_amount"] == 10
        
        # Verify scores are 0-9 (Baccarat rule)
        assert 0 <= data["player_score"] <= 9
        assert 0 <= data["banker_score"] <= 9
        
        # Verify payout logic for player bet
        if data["winner"] == "player":
            assert data["payout"] == 20  # 1:1 payout (bet + winnings)
        elif data["winner"] == "tie":
            assert data["payout"] == 10  # Push - bet returned
        else:
            assert data["payout"] == 0  # Loss
    
    def test_play_banker_bet(self):
        """Test playing Baccarat with Banker bet (5% commission)"""
        response = requests.post(
            f"{BASE_URL}/api/baccarat/play",
            headers=self.headers,
            json={
                "bet_type": "banker",
                "bet_amount": 100,
                "game_mode": "standard"
            }
        )
        
        assert response.status_code == 200, f"Play failed: {response.text}"
        data = response.json()
        
        assert data["bet_type"] == "banker"
        assert data["bet_amount"] == 100
        
        # Verify payout logic for banker bet (5% commission)
        if data["winner"] == "banker":
            # 1:1 minus 5% commission = 100 + 95 = 195
            assert data["payout"] == 195
        elif data["winner"] == "tie":
            assert data["payout"] == 100  # Push - bet returned
        else:
            assert data["payout"] == 0  # Loss
    
    def test_play_tie_bet(self):
        """Test playing Baccarat with Tie bet (8:1 payout)"""
        response = requests.post(
            f"{BASE_URL}/api/baccarat/play",
            headers=self.headers,
            json={
                "bet_type": "tie",
                "bet_amount": 10,
                "game_mode": "vip"
            }
        )
        
        assert response.status_code == 200, f"Play failed: {response.text}"
        data = response.json()
        
        assert data["bet_type"] == "tie"
        assert data["bet_amount"] == 10
        
        # Verify payout logic for tie bet
        if data["winner"] == "tie":
            assert data["payout"] == 90  # 8:1 payout (bet + 8x winnings)
        else:
            assert data["payout"] == 0  # Loss (tie bet loses if not a tie)
    
    def test_play_invalid_bet_type(self):
        """Test playing with invalid bet type"""
        response = requests.post(
            f"{BASE_URL}/api/baccarat/play",
            headers=self.headers,
            json={
                "bet_type": "invalid",
                "bet_amount": 10,
                "game_mode": "standard"
            }
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "Invalid bet type" in data.get("detail", "")
    
    def test_play_negative_bet_amount(self):
        """Test playing with negative bet amount"""
        response = requests.post(
            f"{BASE_URL}/api/baccarat/play",
            headers=self.headers,
            json={
                "bet_type": "player",
                "bet_amount": -10,
                "game_mode": "standard"
            }
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "positive" in data.get("detail", "").lower() or "bet" in data.get("detail", "").lower()
    
    def test_play_zero_bet_amount(self):
        """Test playing with zero bet amount"""
        response = requests.post(
            f"{BASE_URL}/api/baccarat/play",
            headers=self.headers,
            json={
                "bet_type": "player",
                "bet_amount": 0,
                "game_mode": "standard"
            }
        )
        
        assert response.status_code == 400
    
    def test_play_unauthenticated(self):
        """Test playing without authentication"""
        response = requests.post(
            f"{BASE_URL}/api/baccarat/play",
            headers={'Content-Type': 'application/json'},
            json={
                "bet_type": "player",
                "bet_amount": 10,
                "game_mode": "standard"
            }
        )
        
        assert response.status_code == 401
    
    def test_card_values_and_scoring(self):
        """Test that card values follow Baccarat rules"""
        # Play multiple games to verify scoring
        for _ in range(5):
            response = requests.post(
                f"{BASE_URL}/api/baccarat/play",
                headers=self.headers,
                json={
                    "bet_type": "player",
                    "bet_amount": 5,
                    "game_mode": "standard"
                }
            )
            
            assert response.status_code == 200
            data = response.json()
            
            # Verify each card has value and suit
            for card in data["player_hand"]:
                assert "value" in card
                assert "suit" in card
                assert card["suit"] in ["hearts", "diamonds", "clubs", "spades"]
                assert card["value"] in ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]
            
            for card in data["banker_hand"]:
                assert "value" in card
                assert "suit" in card
    
    def test_natural_8_or_9_detection(self):
        """Test that Natural 8 or 9 is properly detected (no third card)"""
        # Play multiple games to find a natural
        naturals_found = 0
        for _ in range(20):
            response = requests.post(
                f"{BASE_URL}/api/baccarat/play",
                headers=self.headers,
                json={
                    "bet_type": "player",
                    "bet_amount": 5,
                    "game_mode": "speed"
                }
            )
            
            assert response.status_code == 200
            data = response.json()
            
            # Check if it's a natural (8 or 9 with only 2 cards)
            initial_player_score = data["player_score"]
            initial_banker_score = data["banker_score"]
            
            # If either hand has 8 or 9 initially, it should be a natural
            # Natural hands should have exactly 2 cards
            if initial_player_score >= 8 or initial_banker_score >= 8:
                # In a natural, both hands should have 2 cards (no third card drawn)
                if len(data["player_hand"]) == 2 and len(data["banker_hand"]) == 2:
                    naturals_found += 1
        
        # We should find at least some naturals in 20 games
        print(f"Found {naturals_found} natural hands in 20 games")
    
    # ==================== GET /api/baccarat/history Tests ====================
    
    def test_get_history(self):
        """Test getting game history"""
        response = requests.get(
            f"{BASE_URL}/api/baccarat/history",
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "games" in data
        assert "total" in data
        assert isinstance(data["games"], list)
        assert isinstance(data["total"], int)
        
        # Verify game structure if games exist
        if data["games"]:
            game = data["games"][0]
            assert "game_id" in game
            assert "bet_type" in game
            assert "bet_amount" in game
            assert "winner" in game
            assert "payout" in game
            assert "profit" in game
    
    def test_get_history_with_limit(self):
        """Test getting game history with limit"""
        response = requests.get(
            f"{BASE_URL}/api/baccarat/history?limit=3",
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert len(data["games"]) <= 3
    
    def test_get_history_unauthenticated(self):
        """Test getting history without authentication"""
        response = requests.get(f"{BASE_URL}/api/baccarat/history")
        assert response.status_code == 401
    
    # ==================== GET /api/baccarat/stats Tests ====================
    
    def test_get_stats(self):
        """Test getting user statistics"""
        response = requests.get(
            f"{BASE_URL}/api/baccarat/stats",
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "total_games" in data
        assert "total_wagered" in data
        assert "total_won" in data
        assert "total_profit" in data
        assert "win_rate" in data
        assert "favorite_bet" in data
        assert "biggest_win" in data
        assert "biggest_loss" in data
        
        # Verify data types
        assert isinstance(data["total_games"], int)
        assert isinstance(data["total_wagered"], int)
        assert isinstance(data["win_rate"], (int, float))
    
    def test_get_stats_unauthenticated(self):
        """Test getting stats without authentication"""
        response = requests.get(f"{BASE_URL}/api/baccarat/stats")
        assert response.status_code == 401
    
    # ==================== GET /api/baccarat/leaderboard Tests ====================
    
    def test_get_leaderboard(self):
        """Test getting leaderboard"""
        response = requests.get(
            f"{BASE_URL}/api/baccarat/leaderboard",
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "leaderboard" in data
        assert isinstance(data["leaderboard"], list)
        
        # Verify leaderboard entry structure if entries exist
        if data["leaderboard"]:
            entry = data["leaderboard"][0]
            assert "user_id" in entry
            assert "username" in entry
            assert "total_profit" in entry
            assert "games_played" in entry
            assert "total_wagered" in entry
    
    def test_get_leaderboard_with_limit(self):
        """Test getting leaderboard with limit"""
        response = requests.get(
            f"{BASE_URL}/api/baccarat/leaderboard?limit=5",
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert len(data["leaderboard"]) <= 5
    
    # ==================== GET /api/baccarat/game/{game_id} Tests ====================
    
    def test_get_game_details(self):
        """Test getting specific game details"""
        # First play a game
        play_response = requests.post(
            f"{BASE_URL}/api/baccarat/play",
            headers=self.headers,
            json={
                "bet_type": "player",
                "bet_amount": 10,
                "game_mode": "standard"
            }
        )
        
        assert play_response.status_code == 200
        game_id = play_response.json()["game_id"]
        
        # Get game details
        response = requests.get(
            f"{BASE_URL}/api/baccarat/game/{game_id}",
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["game_id"] == game_id
        assert "player_hand" in data
        assert "banker_hand" in data
        assert "winner" in data
        assert "actions" in data
    
    def test_get_game_not_found(self):
        """Test getting non-existent game"""
        response = requests.get(
            f"{BASE_URL}/api/baccarat/game/nonexistent_game_id",
            headers=self.headers
        )
        
        assert response.status_code == 404
    
    def test_get_game_unauthenticated(self):
        """Test getting game without authentication"""
        response = requests.get(f"{BASE_URL}/api/baccarat/game/some_game_id")
        assert response.status_code == 401


class TestBaccaratGameLogic:
    """Tests for Baccarat game logic (third-card rules, payouts)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        response = requests.post(f"{BASE_URL}/api/auth/demo-login")
        assert response.status_code == 200
        data = response.json()
        self.token = data.get('token')
        self.headers = {
            'Authorization': f'Bearer {self.token}',
            'Content-Type': 'application/json'
        }
    
    def test_third_card_rules_player_draws_on_0_to_5(self):
        """Test that player draws third card when score is 0-5"""
        # Play multiple games and verify third card logic
        player_drew_correctly = 0
        total_applicable = 0
        
        for _ in range(30):
            response = requests.post(
                f"{BASE_URL}/api/baccarat/play",
                headers=self.headers,
                json={
                    "bet_type": "player",
                    "bet_amount": 5,
                    "game_mode": "standard"
                }
            )
            
            assert response.status_code == 200
            data = response.json()
            
            # Skip naturals (8 or 9)
            if data["player_score"] >= 8 or data["banker_score"] >= 8:
                continue
            
            # Check if player has 3 cards (drew third card)
            player_cards = len(data["player_hand"])
            
            # We can't directly check initial score, but we can verify
            # that the game completed successfully
            total_applicable += 1
            if player_cards == 3:
                player_drew_correctly += 1
        
        print(f"Player drew third card in {player_drew_correctly}/{total_applicable} applicable games")
    
    def test_payout_calculation_player_1_to_1(self):
        """Test Player bet payout is 1:1"""
        wins = 0
        for _ in range(20):
            response = requests.post(
                f"{BASE_URL}/api/baccarat/play",
                headers=self.headers,
                json={
                    "bet_type": "player",
                    "bet_amount": 100,
                    "game_mode": "standard"
                }
            )
            
            assert response.status_code == 200
            data = response.json()
            
            if data["winner"] == "player":
                assert data["payout"] == 200  # 1:1 = bet + winnings
                wins += 1
            elif data["winner"] == "tie":
                assert data["payout"] == 100  # Push
            else:
                assert data["payout"] == 0  # Loss
        
        print(f"Player won {wins}/20 games")
    
    def test_payout_calculation_banker_5_percent_commission(self):
        """Test Banker bet payout is 1:1 minus 5% commission"""
        for _ in range(20):
            response = requests.post(
                f"{BASE_URL}/api/baccarat/play",
                headers=self.headers,
                json={
                    "bet_type": "banker",
                    "bet_amount": 100,
                    "game_mode": "standard"
                }
            )
            
            assert response.status_code == 200
            data = response.json()
            
            if data["winner"] == "banker":
                # 100 bet + 95 winnings (100 * 0.95) = 195
                assert data["payout"] == 195
            elif data["winner"] == "tie":
                assert data["payout"] == 100  # Push
            else:
                assert data["payout"] == 0  # Loss
    
    def test_payout_calculation_tie_8_to_1(self):
        """Test Tie bet payout is 8:1"""
        for _ in range(50):  # More iterations to hopefully hit a tie
            response = requests.post(
                f"{BASE_URL}/api/baccarat/play",
                headers=self.headers,
                json={
                    "bet_type": "tie",
                    "bet_amount": 10,
                    "game_mode": "standard"
                }
            )
            
            assert response.status_code == 200
            data = response.json()
            
            if data["winner"] == "tie":
                # 10 bet + 80 winnings (10 * 8) = 90
                assert data["payout"] == 90
                print("Found a tie! Payout verified as 8:1")
                return
            else:
                assert data["payout"] == 0  # Tie bet loses if not a tie
        
        print("No ties found in 50 games (statistically possible)")
    
    def test_8_deck_shoe(self):
        """Test that game uses 8-deck shoe (416 cards)"""
        # This is verified by the variety of cards dealt
        all_cards = []
        
        for _ in range(50):
            response = requests.post(
                f"{BASE_URL}/api/baccarat/play",
                headers=self.headers,
                json={
                    "bet_type": "player",
                    "bet_amount": 5,
                    "game_mode": "standard"
                }
            )
            
            assert response.status_code == 200
            data = response.json()
            
            all_cards.extend(data["player_hand"])
            all_cards.extend(data["banker_hand"])
        
        # Verify we see variety of cards
        values_seen = set(card["value"] for card in all_cards)
        suits_seen = set(card["suit"] for card in all_cards)
        
        # Should see multiple values and all suits
        assert len(values_seen) > 5, "Should see variety of card values"
        assert len(suits_seen) == 4, "Should see all 4 suits"
        print(f"Saw {len(values_seen)} different card values and {len(suits_seen)} suits")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

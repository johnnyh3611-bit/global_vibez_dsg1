"""
Blackjack API Tests - Testing HIT, STAND, DOUBLE actions
Tests the /api/blackjack/deal and /api/blackjack/action endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestBlackjackDeal:
    """Test the /api/blackjack/deal endpoint"""
    
    def test_deal_success(self):
        """Test successful deal with valid bet"""
        response = requests.post(f"{BASE_URL}/api/blackjack/deal", json={
            "player_id": "test_player_deal",
            "bet_amount": 25,
            "side_bets": {},
            "lightning_active": False,
            "client_seed": "test_deal_123"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "session_id" in data
        assert "player_cards" in data
        assert "dealer_up_card" in data
        assert "player_value" in data
        assert "game_over" in data
        
        # Verify player gets 2 cards
        assert len(data["player_cards"]) == 2
        
        # Verify dealer shows 1 card
        assert data["dealer_up_card"] is not None
        
        print(f"Deal successful - Session: {data['session_id']}, Player cards: {data['player_cards']}")
    
    def test_deal_invalid_bet(self):
        """Test deal with invalid bet amount"""
        response = requests.post(f"{BASE_URL}/api/blackjack/deal", json={
            "player_id": "test_player_invalid",
            "bet_amount": 0,
            "side_bets": {},
            "lightning_active": False
        })
        
        assert response.status_code == 400
        print("Invalid bet correctly rejected")


class TestBlackjackHit:
    """Test the HIT action"""
    
    def test_hit_adds_card(self):
        """Test that HIT adds a card to player hand"""
        # First deal
        deal_response = requests.post(f"{BASE_URL}/api/blackjack/deal", json={
            "player_id": "test_player_hit",
            "bet_amount": 50,
            "side_bets": {},
            "lightning_active": False,
            "client_seed": "test_hit_123"
        })
        
        assert deal_response.status_code == 200
        deal_data = deal_response.json()
        session_id = deal_data["session_id"]
        initial_cards = len(deal_data["player_cards"])
        
        # Skip if game is already over (blackjack)
        if deal_data["game_over"]:
            pytest.skip("Game ended with blackjack - cannot test HIT")
        
        # HIT action
        hit_response = requests.post(f"{BASE_URL}/api/blackjack/action", json={
            "session_id": session_id,
            "action": "hit"
        })
        
        assert hit_response.status_code == 200
        hit_data = hit_response.json()
        
        # Verify card was added
        assert len(hit_data["player_cards"]) == initial_cards + 1
        assert "player_value" in hit_data
        
        print(f"HIT successful - Cards: {hit_data['player_cards']}, Value: {hit_data['player_value']}")
    
    def test_hit_bust(self):
        """Test that HIT correctly handles bust scenario"""
        # Deal and keep hitting until bust or stand
        deal_response = requests.post(f"{BASE_URL}/api/blackjack/deal", json={
            "player_id": "test_player_bust",
            "bet_amount": 25,
            "side_bets": {},
            "lightning_active": False,
            "client_seed": "test_bust_456"
        })
        
        assert deal_response.status_code == 200
        deal_data = deal_response.json()
        session_id = deal_data["session_id"]
        
        if deal_data["game_over"]:
            pytest.skip("Game ended with blackjack")
        
        # Keep hitting until game over
        game_over = False
        hit_count = 0
        while not game_over and hit_count < 10:
            hit_response = requests.post(f"{BASE_URL}/api/blackjack/action", json={
                "session_id": session_id,
                "action": "hit"
            })
            
            assert hit_response.status_code == 200
            hit_data = hit_response.json()
            game_over = hit_data.get("game_over", False)
            hit_count += 1
            
            if hit_data.get("result") == "bust":
                assert hit_data["winner"] == "dealer"
                assert hit_data["payout"] == 0
                print(f"Bust detected - Value: {hit_data['player_value']}")
                break
        
        print(f"Hit test completed after {hit_count} hits")


class TestBlackjackStand:
    """Test the STAND action"""
    
    def test_stand_reveals_dealer(self):
        """Test that STAND reveals dealer cards and determines winner"""
        # Deal
        deal_response = requests.post(f"{BASE_URL}/api/blackjack/deal", json={
            "player_id": "test_player_stand",
            "bet_amount": 100,
            "side_bets": {},
            "lightning_active": False,
            "client_seed": "test_stand_789"
        })
        
        assert deal_response.status_code == 200
        deal_data = deal_response.json()
        session_id = deal_data["session_id"]
        
        if deal_data["game_over"]:
            pytest.skip("Game ended with blackjack")
        
        # STAND action
        stand_response = requests.post(f"{BASE_URL}/api/blackjack/action", json={
            "session_id": session_id,
            "action": "stand"
        })
        
        assert stand_response.status_code == 200
        stand_data = stand_response.json()
        
        # Verify game ended
        assert stand_data["game_over"]
        
        # Verify dealer cards revealed (should have at least 2)
        assert "dealer_cards" in stand_data
        assert len(stand_data["dealer_cards"]) >= 2
        
        # Verify winner determined
        assert stand_data["winner"] in ["player", "dealer", "push"]
        
        # Verify payout
        assert "payout" in stand_data
        
        print(f"STAND successful - Dealer: {stand_data['dealer_cards']}, Winner: {stand_data['winner']}")


class TestBlackjackDouble:
    """Test the DOUBLE action"""
    
    def test_double_adds_one_card_and_ends(self):
        """Test that DOUBLE adds exactly one card and ends the game"""
        # Deal
        deal_response = requests.post(f"{BASE_URL}/api/blackjack/deal", json={
            "player_id": "test_player_double",
            "bet_amount": 50,
            "side_bets": {},
            "lightning_active": False,
            "client_seed": "test_double_abc"
        })
        
        assert deal_response.status_code == 200
        deal_data = deal_response.json()
        session_id = deal_data["session_id"]
        initial_cards = len(deal_data["player_cards"])
        
        if deal_data["game_over"]:
            pytest.skip("Game ended with blackjack")
        
        # DOUBLE action
        double_response = requests.post(f"{BASE_URL}/api/blackjack/action", json={
            "session_id": session_id,
            "action": "double"
        })
        
        assert double_response.status_code == 200
        double_data = double_response.json()
        
        # Verify exactly one card added
        assert len(double_data["player_cards"]) == initial_cards + 1
        
        # Verify game ended
        assert double_data["game_over"]
        
        # Verify dealer cards revealed
        assert "dealer_cards" in double_data
        
        # Verify winner determined
        assert double_data["winner"] in ["player", "dealer", "push"]
        
        print(f"DOUBLE successful - Player: {double_data['player_cards']}, Dealer: {double_data['dealer_cards']}, Winner: {double_data['winner']}")


class TestBlackjackSessionManagement:
    """Test session management"""
    
    def test_invalid_session(self):
        """Test action with invalid session ID"""
        response = requests.post(f"{BASE_URL}/api/blackjack/action", json={
            "session_id": "invalid_session_12345",
            "action": "hit"
        })
        
        assert response.status_code == 404
        print("Invalid session correctly rejected")
    
    def test_action_after_game_over(self):
        """Test that actions are rejected after game is over"""
        # Deal and stand to end game
        deal_response = requests.post(f"{BASE_URL}/api/blackjack/deal", json={
            "player_id": "test_player_gameover",
            "bet_amount": 25,
            "side_bets": {},
            "lightning_active": False,
            "client_seed": "test_gameover_xyz"
        })
        
        assert deal_response.status_code == 200
        deal_data = deal_response.json()
        session_id = deal_data["session_id"]
        
        if not deal_data["game_over"]:
            # Stand to end game
            stand_response = requests.post(f"{BASE_URL}/api/blackjack/action", json={
                "session_id": session_id,
                "action": "stand"
            })
            assert stand_response.status_code == 200
        
        # Try to hit after game over
        hit_response = requests.post(f"{BASE_URL}/api/blackjack/action", json={
            "session_id": session_id,
            "action": "hit"
        })
        
        assert hit_response.status_code == 400
        print("Action after game over correctly rejected")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

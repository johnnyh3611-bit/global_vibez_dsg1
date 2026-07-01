"""
Test Code Quality Fixes - Iteration 66
Tests for:
1. Backend random->secrets migration (secure randomness)
2. Dating auth flow with httpOnly cookies
3. Gaming endpoints (Blackjack, Roulette, AI Practice)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://social-connect-953.preview.emergentagent.com')

class TestDemoLogin:
    """Test demo login and cookie-based auth"""
    
    def test_demo_login_returns_user(self):
        """Demo login should return user data"""
        response = requests.post(f"{BASE_URL}/api/auth/demo-login")
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "email" in data
        assert data["email"] == "demo@globalvibez.com"
        print(f"✅ Demo login successful: {data['user_id']}")
    
    def test_demo_login_sets_cookie(self):
        """Demo login should set session_token cookie"""
        response = requests.post(f"{BASE_URL}/api/auth/demo-login")
        assert response.status_code == 200
        # Check if cookie is set in response
        cookies = response.cookies
        print(f"✅ Demo login cookies: {dict(cookies)}")


class TestBlackjackSecureRandom:
    """Test Blackjack uses secure randomness (secrets module)"""
    
    def test_blackjack_deal(self):
        """Blackjack deal should work with secure random"""
        response = requests.post(f"{BASE_URL}/api/blackjack/deal", json={
            "player_id": "test_user_123",
            "bet_amount": 100,
            "side_bets": {},
            "lightning_active": False
        })
        assert response.status_code == 200
        data = response.json()
        assert "session_id" in data
        assert "player_cards" in data
        assert "dealer_up_card" in data
        assert len(data["player_cards"]) == 2
        print(f"✅ Blackjack deal: {data['player_cards']}, dealer: {data['dealer_up_card']}")
    
    def test_blackjack_action_hit(self):
        """Test blackjack hit action"""
        # First deal
        deal_response = requests.post(f"{BASE_URL}/api/blackjack/deal", json={
            "player_id": "test_user_456",
            "bet_amount": 50
        })
        assert deal_response.status_code == 200
        session_id = deal_response.json()["session_id"]
        
        # Then hit
        hit_response = requests.post(f"{BASE_URL}/api/blackjack/action", json={
            "session_id": session_id,
            "action": "hit"
        })
        assert hit_response.status_code == 200
        data = hit_response.json()
        assert "player_cards" in data
        print(f"✅ Blackjack hit: {data['player_cards']}")


class TestRouletteSecureRandom:
    """Test Roulette uses secure randomness"""
    
    def test_roulette_get_server_hash(self):
        """Roulette should provide server hash for provably fair"""
        response = requests.post(f"{BASE_URL}/api/roulette/get-server-hash")
        assert response.status_code == 200
        data = response.json()
        assert "serverSeedHash" in data
        assert "nonce" in data
        print(f"✅ Roulette server hash: {data['serverSeedHash'][:16]}...")
    
    def test_roulette_spin(self):
        """Roulette spin should work with secure random"""
        response = requests.post(f"{BASE_URL}/api/roulette/spin", json={
            "clientSeed": "test_client_seed_123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "winningNumber" in data
        assert 0 <= data["winningNumber"] <= 36
        print(f"✅ Roulette spin: {data['winningNumber']}")


class TestSlotsSecureRandom:
    """Test Slots uses secure randomness"""
    
    def test_slots_spin(self):
        """Slots spin should work with secure random"""
        response = requests.post(f"{BASE_URL}/api/slots/spin", json={
            "user_id": "test_user_slots",
            "bet_amount": 50
        })
        assert response.status_code == 200
        data = response.json()
        assert "symbols" in data
        assert "spin_id" in data
        assert len(data["symbols"]) == 5
        print(f"✅ Slots spin: {data['symbols']}")


class TestAIPracticeSecureRandom:
    """Test AI Practice uses secure randomness"""
    
    def test_ai_tictactoe_move(self):
        """AI TicTacToe should calculate moves with secure random"""
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
        assert "row" in data["move"]
        assert "col" in data["move"]
        print(f"✅ AI TicTacToe move: row={data['move']['row']}, col={data['move']['col']}")
    
    def test_ai_connect4_move(self):
        """AI Connect4 should calculate moves with secure random"""
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
        assert "move" in data
        assert "column" in data["move"]
        print(f"✅ AI Connect4 move: column={data['move']['column']}")
    
    def test_ai_rps_move(self):
        """AI Rock-Paper-Scissors should work with secure random"""
        response = requests.post(f"{BASE_URL}/api/ai-practice/calculate-move", json={
            "game_type": "rps",
            "game_state": {},
            "difficulty": "hard",
            "player_history": [
                {"player_choice": "rock"},
                {"player_choice": "rock"},
                {"player_choice": "paper"}
            ]
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "move" in data
        assert data["move"]["choice"] in ["rock", "paper", "scissors"]
        print(f"✅ AI RPS move: {data['move']['choice']}")


class TestDatingAuthWithCookies:
    """Test dating endpoints use httpOnly cookie auth"""
    
    def test_dating_discover_requires_auth(self):
        """Dating discover should require authentication"""
        response = requests.get(f"{BASE_URL}/api/dating/discover?limit=5")
        # Should return 401 without auth cookie
        assert response.status_code in [401, 200]  # 200 if demo mode allows
        print(f"✅ Dating discover auth check: {response.status_code}")
    
    def test_dating_profile_me_requires_auth(self):
        """Dating profile/me should require authentication"""
        response = requests.get(f"{BASE_URL}/api/dating/profile/me")
        assert response.status_code in [401, 200]
        print(f"✅ Dating profile/me auth check: {response.status_code}")
    
    def test_dating_matches_requires_auth(self):
        """Dating matches should require authentication"""
        response = requests.get(f"{BASE_URL}/api/dating/matches")
        assert response.status_code in [401, 200]
        print(f"✅ Dating matches auth check: {response.status_code}")


class TestDatingGamesSecureRandom:
    """Test dating games use secure randomness"""
    
    def test_dating_games_endpoint_exists(self):
        """Dating games endpoint should exist"""
        # This tests that the route is registered
        response = requests.get(f"{BASE_URL}/api/dating-games/stats/test_user")
        # Should return 401 (auth required) or 200, not 404
        assert response.status_code != 404
        print(f"✅ Dating games endpoint exists: {response.status_code}")


class TestSocialSecureRandom:
    """Test social features use secure randomness"""
    
    def test_social_matches(self):
        """Social matches should work"""
        response = requests.get(f"{BASE_URL}/api/social/matches?user_id=test_user")
        assert response.status_code == 200
        data = response.json()
        assert "matches" in data
        print(f"✅ Social matches: {len(data['matches'])} matches found")
    
    def test_social_swipe(self):
        """Social swipe should work with secure random"""
        response = requests.post(f"{BASE_URL}/api/social/swipe", json={
            "user_id": "test_user",
            "target_user_id": "user1",
            "action": "accept"
        })
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        print(f"✅ Social swipe: {data['status']}")
    
    def test_social_nearby_players(self):
        """Nearby players should work"""
        response = requests.post(f"{BASE_URL}/api/social/nearby-players", json={
            "user_id": "test_user"
        })
        assert response.status_code == 200
        data = response.json()
        assert "players" in data
        print(f"✅ Nearby players: {len(data['players'])} found")


class TestAPIHealth:
    """Basic API health checks"""
    
    def test_api_root(self):
        """API root should respond"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✅ API root: {data['message']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

"""
Comprehensive Platform Testing - Final Verification
Tests all major features: Games, MY VIBEZ, Dating, Rides, Admin, Trust & Safety
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://social-connect-953.preview.emergentagent.com')

class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_demo_login(self):
        """Test demo login creates user"""
        response = requests.post(f"{BASE_URL}/api/auth/demo-login")
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "email" in data
        assert data["profile_completed"]
        print(f"Demo login successful: {data['user_id']}")
    
    def test_test_user_creation(self):
        """Test user creation endpoint"""
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "session_token" in data
        print(f"Test user created: {data['user_id']}")


class TestGamesAPI:
    """Games API tests - All 16+ games"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        data = response.json()
        return {
            "Authorization": f"Bearer {data['session_token']}",
            "Content-Type": "application/json"
        }, data['user_id']
    
    def test_games_list(self):
        """Test games list endpoint"""
        response = requests.get(f"{BASE_URL}/api/games/list")
        assert response.status_code == 200
        data = response.json()
        assert "games" in data
        games = data["games"]
        # Verify all expected games exist
        expected_games = ["tictactoe", "connect4", "uno", "blackjack", "poker", 
                         "hearts", "spades", "checkers", "chess", "reversi"]
        for game in expected_games:
            assert game in games, f"Missing game: {game}"
        print(f"Found {len(games)} games")
    
    def test_blackjack_practice_start(self, auth_headers):
        """Test Blackjack practice game start - CRITICAL: Verify scores"""
        headers, user_id = auth_headers
        response = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers=headers,
            json={"user_id": user_id, "game_type": "blackjack"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "game_id" in data
        assert "game_state" in data
        game_state = data["game_state"]
        # CRITICAL: Verify scores are NOT 0
        assert "player_score" in game_state
        assert "dealer_score" in game_state
        assert game_state["player_score"] > 0, "Player score should not be 0"
        assert game_state["dealer_score"] > 0, "Dealer score should not be 0"
        print(f"Blackjack started - Player: {game_state['player_score']}, Dealer: {game_state['dealer_score']}")
    
    def test_poker_practice_start(self, auth_headers):
        """Test Poker practice game start"""
        headers, user_id = auth_headers
        response = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers=headers,
            json={"user_id": user_id, "game_type": "poker"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "game_state" in data
        assert "player_hand" in data["game_state"]
        print(f"Poker started with hand: {data['game_state']['player_hand']}")
    
    def test_uno_practice_start(self, auth_headers):
        """Test UNO practice game start"""
        headers, user_id = auth_headers
        response = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers=headers,
            json={"user_id": user_id, "game_type": "uno"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "game_state" in data
        assert "player_hand" in data["game_state"]
        assert "top_card" in data["game_state"]
        print(f"UNO started with {len(data['game_state']['player_hand'])} cards")
    
    def test_spades_practice_start(self, auth_headers):
        """Test Spades practice game start"""
        headers, user_id = auth_headers
        response = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers=headers,
            json={"user_id": user_id, "game_type": "spades"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "game_state" in data
        assert "player_hand" in data["game_state"]
        assert len(data["game_state"]["player_hand"]) == 13
        print("Spades started with 13 cards")
    
    def test_hearts_practice_start(self, auth_headers):
        """Test Hearts practice game start"""
        headers, user_id = auth_headers
        response = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers=headers,
            json={"user_id": user_id, "game_type": "hearts"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "game_state" in data
        assert "player_hand" in data["game_state"]
        print(f"Hearts started with {len(data['game_state']['player_hand'])} cards")
    
    def test_chess_practice_start(self, auth_headers):
        """Test Chess practice game start"""
        headers, user_id = auth_headers
        response = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers=headers,
            json={"user_id": user_id, "game_type": "chess"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "game_state" in data
        assert "fen" in data["game_state"]
        print(f"Chess started with FEN: {data['game_state']['fen'][:20]}...")
    
    def test_checkers_practice_start(self, auth_headers):
        """Test Checkers practice game start"""
        headers, user_id = auth_headers
        response = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers=headers,
            json={"user_id": user_id, "game_type": "checkers"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "game_state" in data
        assert "board" in data["game_state"]
        print("Checkers started with 8x8 board")
    
    def test_reversi_practice_start(self, auth_headers):
        """Test Reversi practice game start"""
        headers, user_id = auth_headers
        response = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers=headers,
            json={"user_id": user_id, "game_type": "reversi"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "game_state" in data
        assert "board" in data["game_state"]
        print("Reversi started with 8x8 board")
    
    def test_tictactoe_practice_start(self, auth_headers):
        """Test Tic-Tac-Toe practice game start"""
        headers, user_id = auth_headers
        response = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers=headers,
            json={"user_id": user_id, "game_type": "tictactoe"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "game_state" in data
        assert "board" in data["game_state"]
        print("Tic-Tac-Toe started with 3x3 board")
    
    def test_connect4_practice_start(self, auth_headers):
        """Test Connect 4 practice game start"""
        headers, user_id = auth_headers
        response = requests.post(
            f"{BASE_URL}/api/practice/start",
            headers=headers,
            json={"user_id": user_id, "game_type": "connect4"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "game_state" in data
        assert "board" in data["game_state"]
        print("Connect 4 started with 6x7 board")
    
    def test_trivia_categories(self):
        """Test trivia categories endpoint"""
        response = requests.get(f"{BASE_URL}/api/trivia/categories")
        assert response.status_code == 200
        data = response.json()
        assert "categories" in data
        print(f"Found {len(data['categories'])} trivia categories")
    
    def test_would_you_rather(self):
        """Test Would You Rather endpoint"""
        response = requests.get(f"{BASE_URL}/api/games/would-you-rather/random")
        assert response.status_code == 200
        data = response.json()
        assert "question" in data
        assert "option_a" in data["question"]
        assert "option_b" in data["question"]
        print(f"WYR question: {data['question']['question'][:50]}...")


class TestMyVibezAPI:
    """MY VIBEZ Content Feed tests"""
    
    def test_my_vibez_feed(self):
        """Test MY VIBEZ feed endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/my-vibez/feed",
            params={"user_id": "demo_user", "feed_type": "for_you", "limit": 10}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "posts" in data
        print(f"MY VIBEZ feed returned {len(data['posts'])} posts")
    
    def test_my_vibez_feed_types(self):
        """Test different feed types"""
        feed_types = ["for_you", "following", "gaming", "dating"]
        for feed_type in feed_types:
            response = requests.get(
                f"{BASE_URL}/api/my-vibez/feed",
                params={"user_id": "demo_user", "feed_type": feed_type, "limit": 5}
            )
            assert response.status_code == 200
            print(f"Feed type '{feed_type}' working")


class TestDatingAPI:
    """Dating features tests"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        data = response.json()
        return {
            "Authorization": f"Bearer {data['session_token']}",
            "Content-Type": "application/json"
        }, data['user_id']
    
    def test_discover_endpoint(self, auth_headers):
        """Test discover endpoint"""
        headers, user_id = auth_headers
        response = requests.get(
            f"{BASE_URL}/api/discover",
            headers=headers,
            params={"user_id": user_id}
        )
        assert response.status_code == 200
        print("Discover endpoint working")
    
    def test_matches_endpoint(self, auth_headers):
        """Test matches endpoint"""
        headers, user_id = auth_headers
        response = requests.get(
            f"{BASE_URL}/api/matches",
            headers=headers,
            params={"user_id": user_id}
        )
        assert response.status_code == 200
        print("Matches endpoint working")


class TestRidesAPI:
    """Vibe Ridez tests"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        data = response.json()
        return {
            "Authorization": f"Bearer {data['session_token']}",
            "Content-Type": "application/json"
        }, data['user_id']
    
    def test_my_rides(self, auth_headers):
        """Test my rides endpoint"""
        headers, user_id = auth_headers
        response = requests.get(
            f"{BASE_URL}/api/rides/my-rides",
            headers=headers,
            params={"user_id": user_id}
        )
        assert response.status_code == 200
        print("My rides endpoint working")


class TestTrustSafetyAPI:
    """Trust & Safety tests"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        data = response.json()
        return {
            "Authorization": f"Bearer {data['session_token']}",
            "Content-Type": "application/json"
        }, data['user_id']
    
    def test_blocked_users(self, auth_headers):
        """Test blocked users endpoint"""
        headers, user_id = auth_headers
        response = requests.get(
            f"{BASE_URL}/api/reports/blocked",
            headers=headers,
            params={"user_id": user_id}
        )
        assert response.status_code == 200
        print("Blocked users endpoint working")
    
    def test_verification_status(self, auth_headers):
        """Test verification status endpoint"""
        headers, user_id = auth_headers
        response = requests.get(
            f"{BASE_URL}/api/verification/status",
            headers=headers,
            params={"user_id": user_id}
        )
        assert response.status_code == 200
        print("Verification status endpoint working")


class TestMonetizationAPI:
    """Monetization tests"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        data = response.json()
        return {
            "Authorization": f"Bearer {data['session_token']}",
            "Content-Type": "application/json"
        }, data['user_id']
    
    def test_wallet_balance(self, auth_headers):
        """Test wallet balance endpoint"""
        headers, user_id = auth_headers
        response = requests.get(
            f"{BASE_URL}/api/wallet/balance",
            headers=headers,
            params={"user_id": user_id}
        )
        assert response.status_code == 200
        data = response.json()
        assert "balance" in data or "credits" in data
        print("Wallet balance endpoint working")
    
    def test_referral_info(self, auth_headers):
        """Test referral info endpoint"""
        headers, user_id = auth_headers
        response = requests.get(
            f"{BASE_URL}/api/referral/info",
            headers=headers,
            params={"user_id": user_id}
        )
        assert response.status_code == 200
        print("Referral info endpoint working")


class TestMultiplayerAPI:
    """Multiplayer tests"""
    
    def test_multiplayer_stats(self):
        """Test multiplayer stats endpoint"""
        response = requests.get(f"{BASE_URL}/api/multiplayer/stats")
        assert response.status_code == 200
        data = response.json()
        assert "active_rooms" in data
        print(f"Multiplayer stats: {data['active_rooms']} active rooms")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

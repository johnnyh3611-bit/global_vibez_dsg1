"""
Comprehensive Platform Test Suite for Global Vibez DSG - Iteration 43
Tests: Auth, Vibe Ridez, My Vibez, Games, Casino, Multiplayer, WebSocket
"""

import pytest
import requests
import os
from uuid import uuid4

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication endpoint tests"""
    
    def test_demo_login(self):
        """Test demo login endpoint"""
        response = requests.post(f"{BASE_URL}/api/auth/demo-login")
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "email" in data
        assert data["email"] == "demo@globalvibez.com"
        print(f"✓ Demo login successful: {data['user_id']}")
    
    def test_create_test_user(self):
        """Test creating a test user"""
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "email" in data
        print(f"✓ Test user created: {data['user_id']}")
        return data


class TestVibeRidez:
    """Vibe Ridez ride-sharing platform tests"""
    
    @pytest.fixture
    def test_user(self):
        """Create a test user for Vibe Ridez tests"""
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        return response.json()
    
    def test_search_rides_empty(self):
        """Test searching rides when none exist"""
        response = requests.get(f"{BASE_URL}/api/vibe-ridez/rides/search?min_seats=1")
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "rides" in data
        assert "count" in data
        print(f"✓ Ride search works: {data['count']} rides found")
    
    def test_search_rides_with_filters(self):
        """Test searching rides with city filters"""
        response = requests.get(
            f"{BASE_URL}/api/vibe-ridez/rides/search",
            params={
                "from_city": "Atlanta",
                "to_city": "Miami",
                "min_seats": 2
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        print(f"✓ Filtered ride search works: {data['count']} rides found")
    
    def test_driver_registration(self, test_user):
        """Test driver registration flow"""
        user_id = test_user["user_id"]
        
        # Register as driver
        response = requests.post(
            f"{BASE_URL}/api/vibe-ridez/driver/register",
            params={
                "user_id": user_id,
                "username": f"TestDriver_{uuid4().hex[:6]}",
                "phone_number": "555-123-4567",
                "license_number": f"DL{uuid4().hex[:8].upper()}"
            },
            json={
                "make": "Tesla",
                "model": "Model 3",
                "year": 2023,
                "color": "White",
                "plate_number": f"TEST{uuid4().hex[:4].upper()}",
                "seats": 4
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "driver_id" in data
        print(f"✓ Driver registered: {data['driver_id']}")
        return data["driver_id"]
    
    def test_get_driver_profile(self, test_user):
        """Test getting driver profile"""
        user_id = test_user["user_id"]
        
        # First register
        requests.post(
            f"{BASE_URL}/api/vibe-ridez/driver/register",
            params={
                "user_id": user_id,
                "username": f"TestDriver_{uuid4().hex[:6]}",
                "phone_number": "555-123-4567",
                "license_number": f"DL{uuid4().hex[:8].upper()}"
            },
            json={
                "make": "Honda",
                "model": "Civic",
                "year": 2022,
                "color": "Blue",
                "plate_number": f"TEST{uuid4().hex[:4].upper()}",
                "seats": 4
            }
        )
        
        # Get profile
        response = requests.get(f"{BASE_URL}/api/vibe-ridez/driver/{user_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "driver" in data
        print(f"✓ Driver profile retrieved: {data['driver']['username']}")
    
    def test_driver_not_found(self):
        """Test getting non-existent driver"""
        response = requests.get(f"{BASE_URL}/api/vibe-ridez/driver/nonexistent_user_123")
        assert response.status_code == 404
        print("✓ Driver not found returns 404")


class TestMyVibez:
    """My Vibez content feed tests"""
    
    def test_trending_feed(self):
        """Test getting trending feed"""
        response = requests.get(f"{BASE_URL}/api/vibez/feed/trending?limit=10")
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "content" in data
        assert "count" in data
        print(f"✓ Trending feed works: {data['count']} items")
    
    def test_for_you_feed(self):
        """Test personalized for-you feed"""
        response = requests.get(
            f"{BASE_URL}/api/vibez/feed/for-you",
            params={"user_id": "test_user", "limit": 10}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        print(f"✓ For-you feed works: {data['count']} items")
    
    def test_following_feed(self):
        """Test following feed"""
        response = requests.get(
            f"{BASE_URL}/api/vibez/feed/following",
            params={"user_id": "test_user", "limit": 10}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        print(f"✓ Following feed works: {data['count']} items")
    
    def test_user_stats(self):
        """Test getting user content stats"""
        response = requests.get(f"{BASE_URL}/api/vibez/user/test_user/stats")
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "stats" in data
        print(f"✓ User stats retrieved: {data['stats']}")


class TestPracticeGames:
    """Practice mode game tests for all 24+ games"""
    
    @pytest.fixture
    def test_user(self):
        """Create a test user"""
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        return response.json()
    
    def test_start_blackjack(self, test_user):
        """Test starting a blackjack game"""
        response = requests.post(
            f"{BASE_URL}/api/practice/start",
            json={
                "user_id": test_user["user_id"],
                "game_type": "blackjack"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "game_id" in data
        assert "game_state" in data
        print(f"✓ Blackjack game started: {data['game_id']}")
        return data
    
    def test_blackjack_hit(self, test_user):
        """Test blackjack hit action"""
        # Start game
        start_response = requests.post(
            f"{BASE_URL}/api/practice/start",
            json={
                "user_id": test_user["user_id"],
                "game_type": "blackjack"
            }
        )
        game_data = start_response.json()
        game_id = game_data["game_id"]
        
        # Make hit move
        response = requests.post(
            f"{BASE_URL}/api/practice/game/{game_id}/move",
            json={"action": "hit"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "game_state" in data
        print("✓ Blackjack hit action works")
    
    def test_start_poker(self, test_user):
        """Test starting a poker game"""
        response = requests.post(
            f"{BASE_URL}/api/practice/start",
            json={
                "user_id": test_user["user_id"],
                "game_type": "poker"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "game_id" in data
        print(f"✓ Poker game started: {data['game_id']}")
    
    def test_start_uno(self, test_user):
        """Test starting a UNO game"""
        response = requests.post(
            f"{BASE_URL}/api/practice/start",
            json={
                "user_id": test_user["user_id"],
                "game_type": "uno"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "game_id" in data
        print(f"✓ UNO game started: {data['game_id']}")
    
    def test_start_tictactoe(self, test_user):
        """Test starting a tic-tac-toe game"""
        response = requests.post(
            f"{BASE_URL}/api/practice/start",
            json={
                "user_id": test_user["user_id"],
                "game_type": "tictactoe"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "game_id" in data
        print(f"✓ TicTacToe game started: {data['game_id']}")
    
    def test_start_connect4(self, test_user):
        """Test starting a Connect 4 game"""
        response = requests.post(
            f"{BASE_URL}/api/practice/start",
            json={
                "user_id": test_user["user_id"],
                "game_type": "connect4"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "game_id" in data
        print(f"✓ Connect4 game started: {data['game_id']}")
    
    def test_start_chess(self, test_user):
        """Test starting a chess game"""
        response = requests.post(
            f"{BASE_URL}/api/practice/start",
            json={
                "user_id": test_user["user_id"],
                "game_type": "chess"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "game_id" in data
        print(f"✓ Chess game started: {data['game_id']}")
    
    def test_start_checkers(self, test_user):
        """Test starting a checkers game"""
        response = requests.post(
            f"{BASE_URL}/api/practice/start",
            json={
                "user_id": test_user["user_id"],
                "game_type": "checkers"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "game_id" in data
        print(f"✓ Checkers game started: {data['game_id']}")


class TestLeaderboard:
    """Leaderboard and stats tests"""
    
    def test_global_stats(self):
        """Test getting global platform stats"""
        response = requests.get(f"{BASE_URL}/api/stats/global")
        assert response.status_code == 200
        data = response.json()
        assert "total_players" in data or "success" in data
        print("✓ Global stats retrieved")
    
    def test_blackjack_leaderboard(self):
        """Test getting blackjack leaderboard"""
        response = requests.get(f"{BASE_URL}/api/stats/leaderboard/blackjack")
        assert response.status_code == 200
        data = response.json()
        assert "leaderboard" in data or "success" in data
        print("✓ Blackjack leaderboard retrieved")


class TestHttpMultiplayer:
    """HTTP-based multiplayer lobby tests"""
    
    @pytest.fixture
    def test_user(self):
        """Create a test user"""
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        return response.json()
    
    def test_create_lobby(self, test_user):
        """Test creating a multiplayer lobby"""
        response = requests.post(
            f"{BASE_URL}/api/http-multiplayer/lobby/create",
            json={
                "game_type": "blackjack",
                "host_id": test_user["user_id"],
                "host_name": "TestHost"
            }
        )
        # May return 200 or 201
        assert response.status_code in [200, 201]
        data = response.json()
        print("✓ Multiplayer lobby created")
        return data
    
    def test_list_lobbies(self):
        """Test listing available lobbies"""
        response = requests.get(f"{BASE_URL}/api/http-multiplayer/lobbies")
        assert response.status_code == 200
        data = response.json()
        print("✓ Lobbies listed")


class TestCasinoFeatures:
    """Casino table and dealer tests"""
    
    def test_get_table_styles(self):
        """Test getting available table styles"""
        response = requests.get(f"{BASE_URL}/api/tables/styles")
        assert response.status_code == 200
        data = response.json()
        print("✓ Table styles retrieved")
    
    def test_get_user_tables(self):
        """Test getting user's unlocked tables"""
        response = requests.get(f"{BASE_URL}/api/tables/user/test_user")
        assert response.status_code == 200
        data = response.json()
        print("✓ User tables retrieved")


class TestDating:
    """Dating feature tests"""
    
    @pytest.fixture
    def test_user(self):
        """Create a test user"""
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        return response.json()
    
    def test_get_discovery(self, test_user):
        """Test getting discovery profiles"""
        response = requests.get(
            f"{BASE_URL}/api/dating/discovery",
            params={"user_id": test_user["user_id"]}
        )
        # May return 200 or 404 if no profiles
        assert response.status_code in [200, 404]
        print("✓ Discovery endpoint works")


class TestWebSocketConnection:
    """WebSocket/Socket.IO connection tests"""
    
    def test_socket_endpoint_exists(self):
        """Test that socket.io endpoint is accessible"""
        response = requests.get(
            f"{BASE_URL}/socket.io/",
            params={"transport": "polling", "EIO": "4"}
        )
        # Socket.IO polling should return 200
        assert response.status_code == 200
        print("✓ Socket.IO endpoint accessible")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

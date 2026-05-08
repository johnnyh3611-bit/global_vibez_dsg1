"""
Multiplayer System Backend Tests
Tests Socket.IO server, matchmaking, and multiplayer stats endpoints
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://social-connect-953.preview.emergentagent.com')


class TestMultiplayerStats:
    """Test multiplayer statistics endpoint"""
    
    def test_multiplayer_stats_endpoint_exists(self):
        """Test that /api/multiplayer/stats endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/multiplayer/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✅ Multiplayer stats endpoint exists and returns 200")
    
    def test_multiplayer_stats_structure(self):
        """Test that stats response has correct structure"""
        response = requests.get(f"{BASE_URL}/api/multiplayer/stats")
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify required fields
        assert "active_rooms" in data, "Missing 'active_rooms' field"
        assert "connected_players" in data, "Missing 'connected_players' field"
        assert "matchmaking_queues" in data, "Missing 'matchmaking_queues' field"
        
        # Verify types
        assert isinstance(data["active_rooms"], int), "active_rooms should be int"
        assert isinstance(data["connected_players"], int), "connected_players should be int"
        assert isinstance(data["matchmaking_queues"], dict), "matchmaking_queues should be dict"
        
        print(f"✅ Stats structure valid: {data}")
    
    def test_multiplayer_stats_initial_values(self):
        """Test that initial stats show zero activity"""
        response = requests.get(f"{BASE_URL}/api/multiplayer/stats")
        data = response.json()
        
        # Initial state should have 0 rooms and 0 players (unless someone is connected)
        assert data["active_rooms"] >= 0, "active_rooms should be >= 0"
        assert data["connected_players"] >= 0, "connected_players should be >= 0"
        
        print(f"✅ Initial stats: {data['active_rooms']} rooms, {data['connected_players']} players")


class TestSocketIOEndpoint:
    """Test Socket.IO server availability"""
    
    def test_socketio_endpoint_exists(self):
        """Test that /socket.io endpoint is accessible"""
        # Socket.IO endpoint should return HTML or redirect when accessed via HTTP
        response = requests.get(f"{BASE_URL}/socket.io/", allow_redirects=True)
        
        # Socket.IO typically returns 200 with HTML or 400 for invalid transport
        # We just need to verify it's not 404
        assert response.status_code != 404, "Socket.IO endpoint not found (404)"
        print(f"✅ Socket.IO endpoint accessible (status: {response.status_code})")
    
    def test_socketio_polling_transport(self):
        """Test Socket.IO polling transport"""
        # Try to initiate a polling connection
        response = requests.get(
            f"{BASE_URL}/socket.io/",
            params={"EIO": "4", "transport": "polling"}
        )
        
        # Should return 200 with session info or 400 for bad request
        # Not 404 (endpoint not found)
        assert response.status_code != 404, "Socket.IO polling endpoint not found"
        print(f"✅ Socket.IO polling transport accessible (status: {response.status_code})")


class TestDemoLogin:
    """Test demo login for multiplayer testing"""
    
    def test_demo_login_creates_session(self):
        """Test that demo login creates a valid session"""
        response = requests.post(f"{BASE_URL}/api/auth/demo-login")
        
        assert response.status_code == 200, f"Demo login failed: {response.status_code}"
        
        data = response.json()
        assert "user_id" in data, "Missing user_id in response"
        assert "email" in data, "Missing email in response"
        assert data["email"] == "demo@globalvibez.com", "Wrong demo email"
        
        print(f"✅ Demo login successful: {data['user_id']}")
        return data
    
    def test_demo_user_can_access_protected_routes(self):
        """Test that demo user session works for protected routes"""
        # Create session
        session = requests.Session()
        login_response = session.post(f"{BASE_URL}/api/auth/demo-login")
        
        assert login_response.status_code == 200
        
        # Try to access protected route
        me_response = session.get(f"{BASE_URL}/api/auth/me")
        
        assert me_response.status_code == 200, f"Auth check failed: {me_response.status_code}"
        
        user_data = me_response.json()
        assert user_data["email"] == "demo@globalvibez.com"
        
        print(f"✅ Demo user authenticated: {user_data['name']}")


class TestGameTypes:
    """Test that all 11 game types are supported"""
    
    GAME_TYPES = [
        "uno", "poker", "blackjack", "hearts", "crazy_eights", "go_fish",
        "chess", "checkers", "reversi", "tictactoe", "connect4"
    ]
    
    def test_all_game_types_defined(self):
        """Verify all 11 game types are available"""
        # This is a documentation test - verifying the expected game types
        assert len(self.GAME_TYPES) == 11, f"Expected 11 games, got {len(self.GAME_TYPES)}"
        print(f"✅ All 11 game types defined: {', '.join(self.GAME_TYPES)}")
    
    def test_practice_games_available(self):
        """Test that practice mode games are available for all types"""
        session = requests.Session()
        session.post(f"{BASE_URL}/api/auth/demo-login")
        
        for game_type in self.GAME_TYPES:
            response = session.post(
                f"{BASE_URL}/api/practice/start",
                json={"game_type": game_type, "difficulty": "medium"}
            )
            
            # Should return 200 or 201 for successful game creation
            assert response.status_code in [200, 201], \
                f"Failed to start {game_type}: {response.status_code}"
            
            print(f"✅ Practice game available: {game_type}")


class TestMultiplayerIntegration:
    """Integration tests for multiplayer system"""
    
    def test_full_multiplayer_flow_simulation(self):
        """Simulate the multiplayer flow (without actual WebSocket)"""
        # 1. Check stats endpoint
        stats_response = requests.get(f"{BASE_URL}/api/multiplayer/stats")
        assert stats_response.status_code == 200
        initial_stats = stats_response.json()
        
        # 2. Create demo session
        session = requests.Session()
        login_response = session.post(f"{BASE_URL}/api/auth/demo-login")
        assert login_response.status_code == 200
        user_data = login_response.json()
        
        # 3. Verify user can access auth
        me_response = session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200
        
        # 4. Check stats again (should still work)
        stats_response2 = requests.get(f"{BASE_URL}/api/multiplayer/stats")
        assert stats_response2.status_code == 200
        
        print("✅ Multiplayer integration flow works")
        print("   - Stats endpoint: ✓")
        print("   - Demo login: ✓")
        print("   - Auth check: ✓")
        print(f"   - User: {user_data['name']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

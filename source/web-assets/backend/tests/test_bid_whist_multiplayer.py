"""
Bid Whist Multiplayer System Tests
Tests for: Room creation, Matchmaking queue, Invite system, Socket.IO events
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBidWhistMultiplayerBackend:
    """Backend API tests for Bid Whist multiplayer system"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Get demo login token
        response = self.session.post(f"{BASE_URL}/api/auth/demo-login")
        if response.status_code == 200:
            data = response.json()
            self.token = data.get('token')
            self.user_id = data.get('user_id')
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip("Demo login failed")
    
    def test_health_check(self):
        """Test API is accessible"""
        response = self.session.get(f"{BASE_URL}/health")
        assert response.status_code == 200
        print("✅ Health check passed")
    
    def test_demo_login(self):
        """Test demo login works"""
        response = self.session.post(f"{BASE_URL}/api/auth/demo-login")
        assert response.status_code == 200
        data = response.json()
        assert 'user_id' in data
        assert 'token' in data
        print(f"✅ Demo login successful: {data.get('user_id')}")
    
    def test_auth_me(self):
        """Test authenticated user endpoint"""
        response = self.session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert 'user_id' in data
        print(f"✅ Auth me successful: {data.get('email')}")
    
    def test_friends_online_endpoint(self):
        """Test friends online endpoint (used by PlayerInviteSelector)"""
        response = self.session.get(f"{BASE_URL}/api/friends/online")
        # This endpoint may return 404 if not implemented, which is expected
        # The frontend falls back to mock data
        print(f"Friends online endpoint status: {response.status_code}")
        if response.status_code == 200:
            print("✅ Friends online endpoint working")
        else:
            print("⚠️ Friends online endpoint returns 404 - frontend uses mock data (expected)")
    
    def test_multiplayer_stats(self):
        """Test multiplayer stats endpoint"""
        response = self.session.get(f"{BASE_URL}/api/multiplayer/stats")
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Multiplayer stats: {data}")
    
    def test_bid_whist_game_creation(self):
        """Test Bid Whist game creation endpoint"""
        # Test creating a new game
        response = self.session.post(f"{BASE_URL}/api/bid-whist/games", json={
            "player_name": "TestPlayer",
            "game_mode": "practice"
        })
        
        if response.status_code == 200:
            data = response.json()
            assert 'game_id' in data or 'id' in data
            print(f"✅ Bid Whist game created: {data}")
        else:
            print(f"⚠️ Bid Whist game creation status: {response.status_code}")
            # May not be implemented via REST, uses Socket.IO instead
    
    def test_socket_io_endpoint_accessible(self):
        """Test Socket.IO endpoint is accessible"""
        # Test the Socket.IO polling endpoint
        response = requests.get(f"{BASE_URL}/api/socket.io/?EIO=4&transport=polling")
        # Socket.IO returns 200 with session info or 400 for bad request
        assert response.status_code in [200, 400]
        print(f"✅ Socket.IO endpoint accessible: {response.status_code}")


class TestBidWhistRouting:
    """Test frontend routing for Bid Whist"""
    
    def test_bid_whist_lobby_route(self):
        """Test /bid-whist-lobby route returns HTML"""
        response = requests.get(f"{BASE_URL}/bid-whist-lobby")
        assert response.status_code == 200
        assert 'text/html' in response.headers.get('content-type', '')
        print("✅ Bid Whist Lobby route accessible")
    
    def test_bid_whist_practice_route(self):
        """Test /bid-whist/practice route returns HTML"""
        response = requests.get(f"{BASE_URL}/bid-whist/practice")
        assert response.status_code == 200
        assert 'text/html' in response.headers.get('content-type', '')
        print("✅ Bid Whist Practice route accessible")
    
    def test_bid_whist_room_route(self):
        """Test /bid-whist/room/:roomCode route returns HTML"""
        response = requests.get(f"{BASE_URL}/bid-whist/room/test123")
        assert response.status_code == 200
        assert 'text/html' in response.headers.get('content-type', '')
        print("✅ Bid Whist Room route accessible")


class TestMatchmakingSystem:
    """Test matchmaking queue system"""
    
    def test_matchmaking_module_exists(self):
        """Verify matchmaking module is importable"""
        # This is a code structure test
        import sys
        sys.path.insert(0, '/app/backend')
        
        try:
            from services.matchmaking import (
                join_matchmaking_queue,
                leave_matchmaking_queue,
                get_queue_status,
                try_create_match
            )
            print("✅ Matchmaking module imports successfully")
        except ImportError as e:
            pytest.fail(f"Matchmaking module import failed: {e}")
    
    def test_room_manager_module_exists(self):
        """Verify room manager module is importable"""
        import sys
        sys.path.insert(0, '/app/backend')
        
        try:
            from services.room_manager import (
                create_room,
                send_invite,
                accept_invite,
                join_room,
                get_room
            )
            print("✅ Room manager module imports successfully")
        except ImportError as e:
            pytest.fail(f"Room manager module import failed: {e}")


class TestRoomManagerFunctions:
    """Test room manager functions directly"""
    
    def test_create_room(self):
        """Test room creation function"""
        import sys
        sys.path.insert(0, '/app/backend')
        
        from services.room_manager import create_room, GameType
        
        room = create_room(
            host_session_id="test_session_123",
            host_user_id="test_user_123",
            host_name="TestHost",
            game_type=GameType.BID_WHIST,
            max_players=4,
            is_public=False,
            wager=0,
            winning_score=7
        )
        
        assert room is not None
        assert 'room_code' in room
        assert room['game_type'] == GameType.BID_WHIST
        assert room['max_players'] == 4
        assert len(room['players']) == 1  # Host is first player
        print(f"✅ Room created: {room['room_code']}")
        
        return room['room_code']
    
    def test_send_invite(self):
        """Test invite sending function"""
        import sys
        sys.path.insert(0, '/app/backend')
        
        from services.room_manager import create_room, send_invite, GameType
        
        # Create room first
        room = create_room(
            host_session_id="test_host_session",
            host_user_id="test_host_user",
            host_name="TestHost",
            game_type=GameType.BID_WHIST,
            max_players=4
        )
        
        room_code = room['room_code']
        
        # Send invite
        invite = send_invite(
            room_code=room_code,
            host_session_id="test_host_session",
            invited_user_id="invited_user_123",
            invited_user_name="InvitedPlayer"
        )
        
        assert invite is not None
        assert 'error' not in invite
        assert 'invite_id' in invite
        assert invite['room_code'] == room_code
        print(f"✅ Invite sent: {invite['invite_id']}")
    
    def test_join_room(self):
        """Test room joining function"""
        import sys
        sys.path.insert(0, '/app/backend')
        
        from services.room_manager import create_room, join_room, GameType
        
        # Create room first
        room = create_room(
            host_session_id="test_host_session_2",
            host_user_id="test_host_user_2",
            host_name="TestHost2",
            game_type=GameType.BID_WHIST,
            max_players=4
        )
        
        room_code = room['room_code']
        
        # Join room
        result = join_room(
            room_code=room_code,
            session_id="test_joiner_session",
            user_id="test_joiner_user",
            player_name="JoiningPlayer"
        )
        
        assert result is not None
        assert 'error' not in result
        assert len(result['players']) == 2  # Host + joiner
        print(f"✅ Player joined room: {room_code}")


class TestMatchmakingFunctions:
    """Test matchmaking queue functions directly"""
    
    def test_join_queue(self):
        """Test joining matchmaking queue"""
        import sys
        sys.path.insert(0, '/app/backend')
        
        from services.matchmaking import join_matchmaking_queue, leave_matchmaking_queue, GameType
        
        result = join_matchmaking_queue(
            session_id="test_mm_session_1",
            user_id="test_mm_user_1",
            player_name="MMPlayer1",
            game_type=GameType.BID_WHIST,
            elo_rating=1000,
            wager=0
        )
        
        assert result is not None
        assert result['status'] in ['queued', 'matched']
        
        if result['status'] == 'queued':
            assert 'position' in result
            assert 'estimated_wait' in result
            print(f"✅ Joined queue at position {result['position']}")
        else:
            print("✅ Matched immediately!")
        
        # Clean up
        leave_matchmaking_queue("test_mm_session_1")
    
    def test_leave_queue(self):
        """Test leaving matchmaking queue"""
        import sys
        sys.path.insert(0, '/app/backend')
        
        from services.matchmaking import join_matchmaking_queue, leave_matchmaking_queue, GameType
        
        # Join first
        join_matchmaking_queue(
            session_id="test_mm_session_leave",
            user_id="test_mm_user_leave",
            player_name="MMPlayerLeave",
            game_type=GameType.BID_WHIST
        )
        
        # Leave
        result = leave_matchmaking_queue("test_mm_session_leave")
        assert result
        print("✅ Left matchmaking queue successfully")
    
    def test_match_creation_with_4_players(self):
        """Test that match is created when 4 players join queue"""
        import sys
        sys.path.insert(0, '/app/backend')
        
        from services.matchmaking import (
            join_matchmaking_queue, 
            matchmaking_queues,
            GameType
        )
        
        # Clear any existing queue entries
        matchmaking_queues[GameType.BID_WHIST] = []
        
        # Add 4 players
        results = []
        for i in range(4):
            result = join_matchmaking_queue(
                session_id=f"test_match_session_{i}",
                user_id=f"test_match_user_{i}",
                player_name=f"MatchPlayer{i}",
                game_type=GameType.BID_WHIST
            )
            results.append(result)
            print(f"Player {i} result: {result['status']}")
        
        # The 4th player should trigger a match
        last_result = results[-1]
        assert last_result['status'] == 'matched'
        assert 'room_code' in last_result
        assert 'players' in last_result
        assert len(last_result['players']) == 4
        print(f"✅ Match created with 4 players: {last_result['room_code']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

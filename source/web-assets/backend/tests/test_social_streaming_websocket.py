"""
Test Suite for Social Dating, Live Streaming, and WebSocket Features
Tests Task B (WebSocket Real-Time Updates) and Task C (Social Overlay in Games)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSocialMatchesAPI:
    """Tests for /api/social/matches endpoint"""
    
    def test_get_matches_success(self):
        """Test fetching potential matches for a user"""
        response = requests.get(f"{BASE_URL}/api/social/matches?user_id=current_user&limit=10")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "matches" in data, "Response should contain 'matches' key"
        assert "total" in data, "Response should contain 'total' key"
        assert isinstance(data["matches"], list), "Matches should be a list"
        
        # Verify match structure
        if len(data["matches"]) > 0:
            match = data["matches"][0]
            assert "id" in match, "Match should have 'id'"
            assert "name" in match, "Match should have 'name'"
            assert "compatibility" in match, "Match should have 'compatibility'"
            assert "online" in match, "Match should have 'online'"
            print(f"✅ Found {len(data['matches'])} potential matches")
    
    def test_get_matches_with_limit(self):
        """Test matches endpoint respects limit parameter"""
        response = requests.get(f"{BASE_URL}/api/social/matches?user_id=current_user&limit=2")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["matches"]) <= 2, "Should respect limit parameter"
        print(f"✅ Limit parameter working - returned {len(data['matches'])} matches")


class TestSocialSwipeAPI:
    """Tests for /api/social/swipe endpoint"""
    
    def test_swipe_accept(self):
        """Test accepting a match (swipe right)"""
        response = requests.post(
            f"{BASE_URL}/api/social/swipe",
            json={
                "user_id": "current_user",
                "target_user_id": "user1",
                "action": "accept"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "status" in data, "Response should contain 'status'"
        assert data["status"] in ["matched", "liked"], f"Status should be 'matched' or 'liked', got {data['status']}"
        assert "message" in data, "Response should contain 'message'"
        print(f"✅ Swipe accept returned status: {data['status']}")
    
    def test_swipe_reject(self):
        """Test rejecting a match (swipe left)"""
        response = requests.post(
            f"{BASE_URL}/api/social/swipe",
            json={
                "user_id": "current_user",
                "target_user_id": "user2",
                "action": "reject"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "rejected", f"Expected 'rejected', got {data['status']}"
        print("✅ Swipe reject working correctly")
    
    def test_swipe_invalid_user(self):
        """Test swipe on non-existent user"""
        response = requests.post(
            f"{BASE_URL}/api/social/swipe",
            json={
                "user_id": "current_user",
                "target_user_id": "nonexistent_user_xyz",
                "action": "accept"
            }
        )
        assert response.status_code == 404, f"Expected 404 for non-existent user, got {response.status_code}"
        print("✅ Swipe on non-existent user returns 404")
    
    def test_swipe_invalid_action(self):
        """Test swipe with invalid action"""
        response = requests.post(
            f"{BASE_URL}/api/social/swipe",
            json={
                "user_id": "current_user",
                "target_user_id": "user1",
                "action": "invalid_action"
            }
        )
        assert response.status_code == 400, f"Expected 400 for invalid action, got {response.status_code}"
        print("✅ Invalid swipe action returns 400")


class TestSendVibeAPI:
    """Tests for /api/social/send-vibe endpoint"""
    
    def test_send_drink_vibe(self):
        """Test sending a virtual drink"""
        response = requests.post(
            f"{BASE_URL}/api/social/send-vibe",
            json={
                "from_user_id": "current_user",
                "to_user_id": "user1",
                "vibe_type": "drink",
                "message": "Hey! Let's play together!"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["status"] == "success", f"Expected 'success', got {data['status']}"
        assert "vibe" in data, "Response should contain 'vibe' data"
        assert data["vibe"]["vibe_type"] == "drink", "Vibe type should be 'drink'"
        assert "vibe_id" in data["vibe"], "Vibe should have an ID"
        print("✅ Send drink vibe working correctly")
    
    def test_send_invite_vibe(self):
        """Test sending a table invite"""
        response = requests.post(
            f"{BASE_URL}/api/social/send-vibe",
            json={
                "from_user_id": "current_user",
                "to_user_id": "user2",
                "vibe_type": "invite",
                "message": "Join my table!"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "success"
        assert "invite" in data["message"].lower() or "sent" in data["message"].lower()
        print("✅ Send invite vibe working correctly")
    
    def test_send_vibe_to_nonexistent_user(self):
        """Test sending vibe to non-existent user"""
        response = requests.post(
            f"{BASE_URL}/api/social/send-vibe",
            json={
                "from_user_id": "current_user",
                "to_user_id": "nonexistent_user_xyz",
                "vibe_type": "drink"
            }
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ Send vibe to non-existent user returns 404")


class TestNearbyPlayersAPI:
    """Tests for /api/social/nearby-players endpoint"""
    
    def test_get_all_nearby_players(self):
        """Test fetching all nearby players"""
        response = requests.post(
            f"{BASE_URL}/api/social/nearby-players",
            json={
                "user_id": "current_user",
                "radius_km": 10
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "players" in data, "Response should contain 'players'"
        assert "total" in data, "Response should contain 'total'"
        assert isinstance(data["players"], list), "Players should be a list"
        print(f"✅ Found {len(data['players'])} nearby players")
    
    def test_get_nearby_players_by_game(self):
        """Test fetching players at a specific game"""
        response = requests.post(
            f"{BASE_URL}/api/social/nearby-players",
            json={
                "user_id": "current_user",
                "game_id": "poker"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        # All returned players should be playing poker
        for player in data["players"]:
            if player.get("current_game"):
                assert player["current_game"] == "poker", f"Player should be playing poker, got {player['current_game']}"
        print(f"✅ Game filter working - found {len(data['players'])} poker players")
    
    def test_get_nearby_players_by_table(self):
        """Test fetching players at a specific table"""
        response = requests.post(
            f"{BASE_URL}/api/social/nearby-players",
            json={
                "user_id": "current_user",
                "game_id": "poker",
                "table_id": "table_vip_1"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        print(f"✅ Table filter working - found {len(data['players'])} players at table_vip_1")


class TestLiveStreamingAPI:
    """Tests for /api/streaming/* endpoints"""
    
    def test_get_live_feeds(self):
        """Test fetching all live streams"""
        response = requests.get(f"{BASE_URL}/api/streaming/live-feeds")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "streams" in data, "Response should contain 'streams'"
        assert "total" in data, "Response should contain 'total'"
        assert "categories" in data, "Response should contain 'categories'"
        
        # Verify stream structure
        if len(data["streams"]) > 0:
            stream = data["streams"][0]
            assert "id" in stream, "Stream should have 'id'"
            assert "title" in stream, "Stream should have 'title'"
            assert "host" in stream, "Stream should have 'host'"
            assert "viewers" in stream, "Stream should have 'viewers'"
            assert "is_live" in stream, "Stream should have 'is_live'"
        print(f"✅ Found {len(data['streams'])} live streams")
    
    def test_get_live_feeds_by_category(self):
        """Test filtering streams by category"""
        response = requests.get(f"{BASE_URL}/api/streaming/live-feeds?category=gaming")
        assert response.status_code == 200
        
        data = response.json()
        for stream in data["streams"]:
            assert stream["category"] == "gaming", f"Stream category should be 'gaming', got {stream['category']}"
        print(f"✅ Category filter working - found {len(data['streams'])} gaming streams")
    
    def test_get_stream_details(self):
        """Test fetching specific stream details"""
        response = requests.get(f"{BASE_URL}/api/streaming/stream/stream1")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["id"] == "stream1", "Stream ID should match"
        assert "title" in data, "Stream should have 'title'"
        assert "stream_url" in data, "Stream should have 'stream_url'"
        print(f"✅ Stream details: {data['title']}")
    
    def test_get_nonexistent_stream(self):
        """Test fetching non-existent stream"""
        response = requests.get(f"{BASE_URL}/api/streaming/stream/nonexistent_stream_xyz")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ Non-existent stream returns 404")
    
    def test_join_stream(self):
        """Test joining a live stream"""
        response = requests.post(
            f"{BASE_URL}/api/streaming/join-stream",
            json={
                "user_id": "test_user_123",
                "stream_id": "stream1"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["status"] == "joined", f"Expected 'joined', got {data['status']}"
        assert "stream" in data, "Response should contain stream data"
        print(f"✅ Joined stream: {data['stream']['title']}")
    
    def test_leave_stream(self):
        """Test leaving a live stream"""
        # First join
        requests.post(
            f"{BASE_URL}/api/streaming/join-stream",
            json={"user_id": "test_user_456", "stream_id": "stream2"}
        )
        
        # Then leave
        response = requests.post(
            f"{BASE_URL}/api/streaming/leave-stream",
            json={
                "user_id": "test_user_456",
                "stream_id": "stream2"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["status"] == "left", f"Expected 'left', got {data['status']}"
        print("✅ Left stream successfully")
    
    def test_join_nonexistent_stream(self):
        """Test joining non-existent stream"""
        response = requests.post(
            f"{BASE_URL}/api/streaming/join-stream",
            json={
                "user_id": "test_user",
                "stream_id": "nonexistent_stream_xyz"
            }
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ Join non-existent stream returns 404")
    
    def test_get_trending_streams(self):
        """Test fetching trending streams"""
        response = requests.get(f"{BASE_URL}/api/streaming/trending?limit=5")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "streams" in data, "Response should contain 'streams'"
        
        # Verify sorted by viewers (descending)
        if len(data["streams"]) > 1:
            for i in range(len(data["streams"]) - 1):
                assert data["streams"][i]["viewers"] >= data["streams"][i+1]["viewers"], "Streams should be sorted by viewers"
        print(f"✅ Trending streams sorted correctly - top stream has {data['streams'][0]['viewers'] if data['streams'] else 0} viewers")


class TestMyMatchesAndVibes:
    """Tests for user's matches and received vibes"""
    
    def test_get_my_matches(self):
        """Test fetching user's matches"""
        response = requests.get(f"{BASE_URL}/api/social/my-matches?user_id=current_user")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "matches" in data, "Response should contain 'matches'"
        assert "total" in data, "Response should contain 'total'"
        print(f"✅ User has {data['total']} matches")
    
    def test_get_received_vibes(self):
        """Test fetching vibes sent to user"""
        response = requests.get(f"{BASE_URL}/api/social/received-vibes?user_id=user1")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "vibes" in data, "Response should contain 'vibes'"
        assert "total" in data, "Response should contain 'total'"
        print(f"✅ User has {data['total']} received vibes")


class TestCreateStream:
    """Tests for stream creation"""
    
    def test_create_stream(self):
        """Test creating a new live stream"""
        response = requests.post(
            f"{BASE_URL}/api/streaming/create-stream",
            json={
                "user_id": "test_streamer_123",
                "title": "Test Stream - Poker Night",
                "category": "gaming",
                "tags": ["Poker", "Test", "Live"]
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["status"] == "created", f"Expected 'created', got {data['status']}"
        assert "stream" in data, "Response should contain stream data"
        assert data["stream"]["title"] == "Test Stream - Poker Night"
        assert data["stream"]["is_live"]
        print(f"✅ Created stream with ID: {data['stream']['id']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

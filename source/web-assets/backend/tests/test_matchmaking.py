"""
Skill-Based Dating Matchmaking API Tests
Tests for: Profile CRUD, Match Finding, Match Requests, ELO Rating System
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMatchmakingProfile:
    """Tests for matchmaking profile creation and retrieval"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test user IDs"""
        self.test_user_id = f"test_user_{uuid.uuid4().hex[:8]}"
        self.test_user_id_2 = f"test_user_{uuid.uuid4().hex[:8]}"
        self.test_user_id_3 = f"test_user_{uuid.uuid4().hex[:8]}"
    
    def test_create_matchmaking_profile(self):
        """Test creating a new matchmaking profile"""
        profile_data = {
            "user_id": self.test_user_id,
            "name": "Test Player",
            "age": 25,
            "bio": "Love playing blackjack and poker!",
            "favorite_games": ["blackjack", "poker", "bid_whist"],
            "skill_scores": {"blackjack": 1200, "poker": 1100},
            "total_games_played": 50,
            "win_rate": 0.55,
            "preferences": {
                "age_min": 21,
                "age_max": 35,
                "preferred_games": ["blackjack", "poker"],
                "skill_level_min": 1,
                "skill_level_max": 10,
                "distance_max": 50,
                "looking_for": "dating"
            }
        }
        
        response = requests.post(f"{BASE_URL}/api/matchmaking/profile", json=profile_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"]
        assert data["message"] == "Matchmaking profile created successfully"
        assert data["profile"]["user_id"] == self.test_user_id
        assert data["profile"]["name"] == "Test Player"
        assert data["profile"]["age"] == 25
        assert "blackjack" in data["profile"]["favorite_games"]
        print(f"✓ Profile created for user: {self.test_user_id}")
    
    def test_get_matchmaking_profile(self):
        """Test retrieving a matchmaking profile"""
        # First create a profile
        profile_data = {
            "user_id": self.test_user_id,
            "name": "Retrieval Test User",
            "age": 28,
            "bio": "Testing profile retrieval",
            "favorite_games": ["roulette"],
            "skill_scores": {},
            "total_games_played": 10,
            "win_rate": 0.4,
            "preferences": {
                "age_min": 18,
                "age_max": 99,
                "preferred_games": [],
                "skill_level_min": 1,
                "skill_level_max": 10,
                "distance_max": 50,
                "looking_for": "friendship"
            }
        }
        
        create_response = requests.post(f"{BASE_URL}/api/matchmaking/profile", json=profile_data)
        assert create_response.status_code == 200
        
        # Now retrieve it
        get_response = requests.get(f"{BASE_URL}/api/matchmaking/profile/{self.test_user_id}")
        assert get_response.status_code == 200, f"Expected 200, got {get_response.status_code}"
        
        data = get_response.json()
        assert data["success"]
        assert data["profile"]["user_id"] == self.test_user_id
        assert data["profile"]["name"] == "Retrieval Test User"
        print(f"✓ Profile retrieved successfully for: {self.test_user_id}")
    
    def test_get_nonexistent_profile(self):
        """Test retrieving a profile that doesn't exist"""
        response = requests.get(f"{BASE_URL}/api/matchmaking/profile/nonexistent_user_12345")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Correctly returns 404 for nonexistent profile")
    
    def test_update_profile(self):
        """Test updating an existing profile"""
        # Create initial profile
        profile_data = {
            "user_id": self.test_user_id,
            "name": "Original Name",
            "age": 22,
            "bio": "Original bio",
            "favorite_games": ["blackjack"],
            "skill_scores": {"blackjack": 1000},
            "total_games_played": 5,
            "win_rate": 0.5,
            "preferences": {
                "age_min": 18,
                "age_max": 99,
                "preferred_games": ["blackjack"],
                "skill_level_min": 1,
                "skill_level_max": 10,
                "distance_max": 50,
                "looking_for": "gaming_partner"
            }
        }
        
        requests.post(f"{BASE_URL}/api/matchmaking/profile", json=profile_data)
        
        # Update profile
        updated_data = {
            "user_id": self.test_user_id,
            "name": "Updated Name",
            "age": 23,
            "bio": "Updated bio with more info",
            "favorite_games": ["blackjack", "poker", "baccarat"],
            "skill_scores": {"blackjack": 1100, "poker": 1050},
            "total_games_played": 20,
            "win_rate": 0.6,
            "preferences": {
                "age_min": 21,
                "age_max": 40,
                "preferred_games": ["blackjack", "poker"],
                "skill_level_min": 1,
                "skill_level_max": 10,
                "distance_max": 100,
                "looking_for": "dating"
            }
        }
        
        response = requests.post(f"{BASE_URL}/api/matchmaking/profile", json=updated_data)
        assert response.status_code == 200
        
        # Verify update
        get_response = requests.get(f"{BASE_URL}/api/matchmaking/profile/{self.test_user_id}")
        data = get_response.json()
        
        assert data["profile"]["name"] == "Updated Name"
        assert data["profile"]["age"] == 23
        assert len(data["profile"]["favorite_games"]) == 3
        print("✓ Profile updated successfully")


class TestMatchFinding:
    """Tests for finding compatible matches"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create test users for matching"""
        self.user1_id = f"match_test_user1_{uuid.uuid4().hex[:8]}"
        self.user2_id = f"match_test_user2_{uuid.uuid4().hex[:8]}"
        self.user3_id = f"match_test_user3_{uuid.uuid4().hex[:8]}"
        
        # Create user 1 - Blackjack lover
        profile1 = {
            "user_id": self.user1_id,
            "name": "Blackjack Pro",
            "age": 28,
            "bio": "Professional blackjack player",
            "favorite_games": ["blackjack", "poker"],
            "skill_scores": {"blackjack": 1500, "poker": 1200},
            "total_games_played": 100,
            "win_rate": 0.65,
            "preferences": {
                "age_min": 25,
                "age_max": 35,
                "preferred_games": ["blackjack", "poker"],
                "skill_level_min": 1,
                "skill_level_max": 10,
                "distance_max": 50,
                "looking_for": "dating"
            }
        }
        requests.post(f"{BASE_URL}/api/matchmaking/profile", json=profile1)
        
        # Create user 2 - Similar to user 1 (high compatibility)
        profile2 = {
            "user_id": self.user2_id,
            "name": "Card Shark",
            "age": 30,
            "bio": "Love card games!",
            "favorite_games": ["blackjack", "poker", "baccarat"],
            "skill_scores": {"blackjack": 1400, "poker": 1300},
            "total_games_played": 80,
            "win_rate": 0.60,
            "preferences": {
                "age_min": 25,
                "age_max": 40,
                "preferred_games": ["blackjack", "poker"],
                "skill_level_min": 1,
                "skill_level_max": 10,
                "distance_max": 50,
                "looking_for": "dating"
            }
        }
        requests.post(f"{BASE_URL}/api/matchmaking/profile", json=profile2)
        
        # Create user 3 - Different preferences (lower compatibility)
        profile3 = {
            "user_id": self.user3_id,
            "name": "Slots Fan",
            "age": 45,
            "bio": "Casual slots player",
            "favorite_games": ["roulette"],
            "skill_scores": {"roulette": 900},
            "total_games_played": 20,
            "win_rate": 0.35,
            "preferences": {
                "age_min": 40,
                "age_max": 60,
                "preferred_games": ["roulette"],
                "skill_level_min": 1,
                "skill_level_max": 10,
                "distance_max": 50,
                "looking_for": "friendship"
            }
        }
        requests.post(f"{BASE_URL}/api/matchmaking/profile", json=profile3)
    
    def test_find_matches(self):
        """Test finding compatible matches for a user"""
        response = requests.get(f"{BASE_URL}/api/matchmaking/find-matches/{self.user1_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["success"]
        assert "matches" in data
        assert "total_found" in data
        print(f"✓ Found {data['total_found']} matches for user")
    
    def test_compatibility_algorithm(self):
        """Test that compatibility scores are calculated correctly"""
        response = requests.get(f"{BASE_URL}/api/matchmaking/find-matches/{self.user1_id}")
        data = response.json()
        
        if data["matches"]:
            for match in data["matches"]:
                score = match["match_score"]
                
                # Verify all compatibility components exist
                assert "compatibility_score" in score
                assert "game_compatibility" in score
                assert "skill_compatibility" in score
                assert "preference_match" in score
                assert "shared_interests" in score
                
                # Verify scores are within valid range
                assert 0 <= score["compatibility_score"] <= 100
                assert 0 <= score["game_compatibility"] <= 100
                assert 0 <= score["skill_compatibility"] <= 100
                assert 0 <= score["preference_match"] <= 100
                
                print(f"✓ Match {match['user']['name']}: {score['compatibility_score']}% compatibility")
    
    def test_find_matches_nonexistent_user(self):
        """Test finding matches for a user that doesn't exist"""
        response = requests.get(f"{BASE_URL}/api/matchmaking/find-matches/nonexistent_user_xyz")
        assert response.status_code == 404
        print("✓ Correctly returns 404 for nonexistent user")
    
    def test_match_limit(self):
        """Test that match limit parameter works"""
        response = requests.get(f"{BASE_URL}/api/matchmaking/find-matches/{self.user1_id}?limit=1")
        data = response.json()
        
        assert len(data["matches"]) <= 1
        print("✓ Match limit parameter works correctly")


class TestMatchRequests:
    """Tests for sending and responding to match requests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create test users for match requests"""
        self.sender_id = f"sender_{uuid.uuid4().hex[:8]}"
        self.receiver_id = f"receiver_{uuid.uuid4().hex[:8]}"
        
        # Create sender profile
        sender_profile = {
            "user_id": self.sender_id,
            "name": "Request Sender",
            "age": 25,
            "bio": "Sending match requests",
            "favorite_games": ["blackjack"],
            "skill_scores": {},
            "total_games_played": 10,
            "win_rate": 0.5,
            "preferences": {
                "age_min": 18,
                "age_max": 99,
                "preferred_games": [],
                "skill_level_min": 1,
                "skill_level_max": 10,
                "distance_max": 50,
                "looking_for": "dating"
            }
        }
        requests.post(f"{BASE_URL}/api/matchmaking/profile", json=sender_profile)
        
        # Create receiver profile
        receiver_profile = {
            "user_id": self.receiver_id,
            "name": "Request Receiver",
            "age": 27,
            "bio": "Receiving match requests",
            "favorite_games": ["blackjack"],
            "skill_scores": {},
            "total_games_played": 15,
            "win_rate": 0.55,
            "preferences": {
                "age_min": 18,
                "age_max": 99,
                "preferred_games": [],
                "skill_level_min": 1,
                "skill_level_max": 10,
                "distance_max": 50,
                "looking_for": "dating"
            }
        }
        requests.post(f"{BASE_URL}/api/matchmaking/profile", json=receiver_profile)
    
    def test_send_match_request(self):
        """Test sending a match request"""
        response = requests.post(
            f"{BASE_URL}/api/matchmaking/send-request",
            params={"from_user_id": self.sender_id, "to_user_id": self.receiver_id}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"]
        assert "request_id" in data
        assert data["message"] == "Match request sent successfully!"
        print(f"✓ Match request sent: {data['request_id']}")
        
        return data["request_id"]
    
    def test_send_match_request_with_message(self):
        """Test sending a match request with custom message"""
        response = requests.post(
            f"{BASE_URL}/api/matchmaking/send-request",
            params={
                "from_user_id": self.sender_id, 
                "to_user_id": self.receiver_id,
                "message": "Hey! I saw you love blackjack too. Want to play?"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        print("✓ Match request with custom message sent")
    
    def test_send_request_nonexistent_user(self):
        """Test sending request to nonexistent user"""
        response = requests.post(
            f"{BASE_URL}/api/matchmaking/send-request",
            params={"from_user_id": self.sender_id, "to_user_id": "nonexistent_user"}
        )
        assert response.status_code == 404
        print("✓ Correctly returns 404 for nonexistent user")
    
    def test_accept_match_request(self):
        """Test accepting a match request"""
        # First send a request
        send_response = requests.post(
            f"{BASE_URL}/api/matchmaking/send-request",
            params={"from_user_id": self.sender_id, "to_user_id": self.receiver_id}
        )
        request_id = send_response.json()["request_id"]
        
        # Accept the request
        response = requests.post(
            f"{BASE_URL}/api/matchmaking/respond-request/{request_id}",
            params={"accept": True}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        assert data["matched"]
        assert data["message"] == "Match accepted! Start playing together!"
        print("✓ Match request accepted successfully")
    
    def test_decline_match_request(self):
        """Test declining a match request"""
        # First send a request
        send_response = requests.post(
            f"{BASE_URL}/api/matchmaking/send-request",
            params={"from_user_id": self.sender_id, "to_user_id": self.receiver_id}
        )
        request_id = send_response.json()["request_id"]
        
        # Decline the request
        response = requests.post(
            f"{BASE_URL}/api/matchmaking/respond-request/{request_id}",
            params={"accept": False}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        assert not data["matched"]
        assert data["message"] == "Match declined"
        print("✓ Match request declined successfully")
    
    def test_respond_nonexistent_request(self):
        """Test responding to nonexistent request"""
        response = requests.post(
            f"{BASE_URL}/api/matchmaking/respond-request/nonexistent_req_123",
            params={"accept": True}
        )
        assert response.status_code == 404
        print("✓ Correctly returns 404 for nonexistent request")
    
    def test_get_pending_requests(self):
        """Test getting pending requests for a user"""
        # Send a request first
        requests.post(
            f"{BASE_URL}/api/matchmaking/send-request",
            params={"from_user_id": self.sender_id, "to_user_id": self.receiver_id}
        )
        
        # Get pending requests for receiver
        response = requests.get(f"{BASE_URL}/api/matchmaking/requests/{self.receiver_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        assert "requests" in data
        assert "count" in data
        print(f"✓ Retrieved {data['count']} pending requests")
    
    def test_get_active_matches(self):
        """Test getting active matches for a user"""
        # Send and accept a request
        send_response = requests.post(
            f"{BASE_URL}/api/matchmaking/send-request",
            params={"from_user_id": self.sender_id, "to_user_id": self.receiver_id}
        )
        request_id = send_response.json()["request_id"]
        
        requests.post(
            f"{BASE_URL}/api/matchmaking/respond-request/{request_id}",
            params={"accept": True}
        )
        
        # Get active matches
        response = requests.get(f"{BASE_URL}/api/matchmaking/matches/{self.sender_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        assert "matches" in data
        assert "count" in data
        print(f"✓ Retrieved {data['count']} active matches")


class TestELORatingSystem:
    """Tests for ELO rating updates after games"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create test user for ELO tests"""
        self.user_id = f"elo_test_{uuid.uuid4().hex[:8]}"
        
        profile = {
            "user_id": self.user_id,
            "name": "ELO Test User",
            "age": 25,
            "bio": "Testing ELO system",
            "favorite_games": ["blackjack", "poker"],
            "skill_scores": {"blackjack": 1000, "poker": 1000},
            "total_games_played": 0,
            "win_rate": 0.5,
            "preferences": {
                "age_min": 18,
                "age_max": 99,
                "preferred_games": [],
                "skill_level_min": 1,
                "skill_level_max": 10,
                "distance_max": 50,
                "looking_for": "gaming_partner"
            }
        }
        requests.post(f"{BASE_URL}/api/matchmaking/profile", json=profile)
    
    def test_update_skill_after_win(self):
        """Test skill rating increases after a win"""
        response = requests.post(
            f"{BASE_URL}/api/matchmaking/update-skill",
            params={
                "user_id": self.user_id,
                "game_type": "blackjack",
                "won": True,
                "opponent_skill": 1000
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        assert data["new_skill"] > data["old_skill"], "Skill should increase after win"
        assert data["change"] > 0
        assert data["game_type"] == "blackjack"
        print(f"✓ Skill increased from {data['old_skill']} to {data['new_skill']} after win")
    
    def test_update_skill_after_loss(self):
        """Test skill rating decreases after a loss"""
        response = requests.post(
            f"{BASE_URL}/api/matchmaking/update-skill",
            params={
                "user_id": self.user_id,
                "game_type": "poker",
                "won": False,
                "opponent_skill": 1000
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        assert data["new_skill"] < data["old_skill"], "Skill should decrease after loss"
        assert data["change"] < 0
        print(f"✓ Skill decreased from {data['old_skill']} to {data['new_skill']} after loss")
    
    def test_update_skill_new_game(self):
        """Test skill rating for a new game type"""
        response = requests.post(
            f"{BASE_URL}/api/matchmaking/update-skill",
            params={
                "user_id": self.user_id,
                "game_type": "baccarat",
                "won": True
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        assert data["old_skill"] == 1000  # Default starting skill
        print(f"✓ New game type skill initialized and updated: {data['new_skill']}")
    
    def test_update_skill_nonexistent_user(self):
        """Test updating skill for nonexistent user"""
        response = requests.post(
            f"{BASE_URL}/api/matchmaking/update-skill",
            params={
                "user_id": "nonexistent_user_xyz",
                "game_type": "blackjack",
                "won": True
            }
        )
        assert response.status_code == 404
        print("✓ Correctly returns 404 for nonexistent user")


class TestGameBasedSuggestions:
    """Tests for game-based match suggestions"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create test users for game suggestions"""
        self.user_id = f"game_suggest_{uuid.uuid4().hex[:8]}"
        self.similar_user_id = f"similar_skill_{uuid.uuid4().hex[:8]}"
        
        # Create main user
        profile = {
            "user_id": self.user_id,
            "name": "Game Suggester",
            "age": 25,
            "bio": "Testing game suggestions",
            "favorite_games": ["blackjack"],
            "skill_scores": {"blackjack": 1000},
            "total_games_played": 10,
            "win_rate": 0.5,
            "preferences": {
                "age_min": 18,
                "age_max": 99,
                "preferred_games": ["blackjack"],
                "skill_level_min": 1,
                "skill_level_max": 10,
                "distance_max": 50,
                "looking_for": "gaming_partner"
            }
        }
        requests.post(f"{BASE_URL}/api/matchmaking/profile", json=profile)
        
        # Create similar skill user
        similar_profile = {
            "user_id": self.similar_user_id,
            "name": "Similar Skill Player",
            "age": 27,
            "bio": "Similar skill level",
            "favorite_games": ["blackjack"],
            "skill_scores": {"blackjack": 1050},
            "total_games_played": 15,
            "win_rate": 0.52,
            "preferences": {
                "age_min": 18,
                "age_max": 99,
                "preferred_games": ["blackjack"],
                "skill_level_min": 1,
                "skill_level_max": 10,
                "distance_max": 50,
                "looking_for": "gaming_partner"
            }
        }
        requests.post(f"{BASE_URL}/api/matchmaking/profile", json=similar_profile)
    
    def test_suggest_from_game(self):
        """Test getting match suggestions based on game performance"""
        response = requests.post(
            f"{BASE_URL}/api/matchmaking/suggest-from-game",
            params={
                "user_id": self.user_id,
                "game_type": "blackjack",
                "performance_score": 75  # Good performance
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        assert "suggestions" in data
        assert "your_new_skill" in data
        assert data["game_type"] == "blackjack"
        print(f"✓ Got {len(data['suggestions'])} suggestions, new skill: {data['your_new_skill']}")
    
    def test_suggest_from_game_nonexistent_user(self):
        """Test suggestions for nonexistent user"""
        response = requests.post(
            f"{BASE_URL}/api/matchmaking/suggest-from-game",
            params={
                "user_id": "nonexistent_xyz",
                "game_type": "blackjack",
                "performance_score": 50
            }
        )
        assert response.status_code == 404
        print("✓ Correctly returns 404 for nonexistent user")


class TestIntegrationFlow:
    """End-to-end integration tests for matchmaking flow"""
    
    def test_full_matchmaking_flow(self):
        """Test complete flow: Create profile → Find matches → Send request → Accept → Play"""
        # Step 1: Create two users
        user1_id = f"flow_user1_{uuid.uuid4().hex[:8]}"
        user2_id = f"flow_user2_{uuid.uuid4().hex[:8]}"
        
        profile1 = {
            "user_id": user1_id,
            "name": "Flow User 1",
            "age": 25,
            "bio": "Testing full flow",
            "favorite_games": ["blackjack", "poker"],
            "skill_scores": {"blackjack": 1100},
            "total_games_played": 20,
            "win_rate": 0.55,
            "preferences": {
                "age_min": 20,
                "age_max": 35,
                "preferred_games": ["blackjack"],
                "skill_level_min": 1,
                "skill_level_max": 10,
                "distance_max": 50,
                "looking_for": "dating"
            }
        }
        
        profile2 = {
            "user_id": user2_id,
            "name": "Flow User 2",
            "age": 27,
            "bio": "Also testing flow",
            "favorite_games": ["blackjack", "poker"],
            "skill_scores": {"blackjack": 1150},
            "total_games_played": 25,
            "win_rate": 0.58,
            "preferences": {
                "age_min": 20,
                "age_max": 35,
                "preferred_games": ["blackjack"],
                "skill_level_min": 1,
                "skill_level_max": 10,
                "distance_max": 50,
                "looking_for": "dating"
            }
        }
        
        # Create profiles
        r1 = requests.post(f"{BASE_URL}/api/matchmaking/profile", json=profile1)
        r2 = requests.post(f"{BASE_URL}/api/matchmaking/profile", json=profile2)
        assert r1.status_code == 200 and r2.status_code == 200
        print("✓ Step 1: Both profiles created")
        
        # Step 2: Find matches for user 1
        matches_response = requests.get(f"{BASE_URL}/api/matchmaking/find-matches/{user1_id}")
        assert matches_response.status_code == 200
        matches_data = matches_response.json()
        print(f"✓ Step 2: Found {matches_data['total_found']} potential matches")
        
        # Step 3: Send match request
        send_response = requests.post(
            f"{BASE_URL}/api/matchmaking/send-request",
            params={"from_user_id": user1_id, "to_user_id": user2_id}
        )
        assert send_response.status_code == 200
        request_id = send_response.json()["request_id"]
        print(f"✓ Step 3: Match request sent (ID: {request_id})")
        
        # Step 4: Check pending requests for user 2
        pending_response = requests.get(f"{BASE_URL}/api/matchmaking/requests/{user2_id}")
        assert pending_response.status_code == 200
        pending_data = pending_response.json()
        assert pending_data["count"] >= 1
        print(f"✓ Step 4: User 2 has {pending_data['count']} pending request(s)")
        
        # Step 5: Accept the request
        accept_response = requests.post(
            f"{BASE_URL}/api/matchmaking/respond-request/{request_id}",
            params={"accept": True}
        )
        assert accept_response.status_code == 200
        assert accept_response.json()["matched"]
        print("✓ Step 5: Match request accepted")
        
        # Step 6: Verify active matches
        active_response = requests.get(f"{BASE_URL}/api/matchmaking/matches/{user1_id}")
        assert active_response.status_code == 200
        active_data = active_response.json()
        assert active_data["count"] >= 1
        print(f"✓ Step 6: User 1 has {active_data['count']} active match(es)")
        
        # Step 7: Simulate game and update skill
        skill_response = requests.post(
            f"{BASE_URL}/api/matchmaking/update-skill",
            params={
                "user_id": user1_id,
                "game_type": "blackjack",
                "won": True,
                "opponent_skill": 1150
            }
        )
        assert skill_response.status_code == 200
        skill_data = skill_response.json()
        print(f"✓ Step 7: Skill updated after game: {skill_data['old_skill']} → {skill_data['new_skill']}")
        
        print("\n✅ FULL MATCHMAKING FLOW COMPLETED SUCCESSFULLY!")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

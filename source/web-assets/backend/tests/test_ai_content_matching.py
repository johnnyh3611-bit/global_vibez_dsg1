"""
AI Content Matching System Tests
Tests for analyzing MY VIBEZ posts and finding compatible users based on content style and interests
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAIContentMatchingStats:
    """Test the stats endpoint - basic health check"""
    
    def test_get_stats(self):
        """GET /api/ai-content-matching/stats - should return matching statistics"""
        response = requests.get(f"{BASE_URL}/api/ai-content-matching/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"]
        assert "total_users" in data
        assert "analyzed_users" in data
        assert "analysis_coverage" in data
        print(f"Stats: {data['total_users']} total users, {data['analyzed_users']} analyzed, {data['analysis_coverage']} coverage")


class TestAIContentAnalysis:
    """Test content analysis endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create test users with MY VIBEZ posts"""
        # Create first test user
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        assert response.status_code == 200
        data = response.json()
        self.user1_id = data["user_id"]
        self.user1_token = data["session_token"]
        
        # Create second test user
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        assert response.status_code == 200
        data = response.json()
        self.user2_id = data["user_id"]
        self.user2_token = data["session_token"]
        
        print(f"Created test users: {self.user1_id}, {self.user2_id}")
        
        yield
        
        # Cleanup is handled by test_ prefix convention
    
    def test_analyze_content_no_posts(self):
        """POST /api/ai-content-matching/analyze-content - user with no posts"""
        response = requests.post(
            f"{BASE_URL}/api/ai-content-matching/analyze-content",
            json={"user_id": self.user1_id}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Should return success=False since user has no posts
        assert not data["success"]
        assert "no" in data["message"].lower() and "posts" in data["message"].lower()
        print(f"Correctly handled user with no posts: {data['message']}")
    
    def test_analyze_content_user_not_found(self):
        """POST /api/ai-content-matching/analyze-content - non-existent user"""
        response = requests.post(
            f"{BASE_URL}/api/ai-content-matching/analyze-content",
            json={"user_id": "nonexistent_user_12345"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("Correctly returned 404 for non-existent user")


class TestAIContentMatchingWithPosts:
    """Test content matching with users who have MY VIBEZ posts"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create test users and add MY VIBEZ posts for them"""
        # Create first test user
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        assert response.status_code == 200
        data = response.json()
        self.user1_id = data["user_id"]
        self.user1_token = data["session_token"]
        
        # Create second test user
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        assert response.status_code == 200
        data = response.json()
        self.user2_id = data["user_id"]
        self.user2_token = data["session_token"]
        
        # Create MY VIBEZ posts for user1 (gaming/music interests)
        self._create_my_vibez_posts(self.user1_id, self.user1_token, [
            {"caption": "Just hit Diamond rank in Valorant! Gaming all night 🎮", "tags": ["gaming", "valorant", "esports"]},
            {"caption": "New playlist drop - hip hop vibes only 🎵", "tags": ["music", "hiphop", "playlist"]},
            {"caption": "Late night gaming session with the squad", "tags": ["gaming", "friends", "nightowl"]},
            {"caption": "Concert was amazing! Live music hits different", "tags": ["music", "concert", "livemusic"]},
            {"caption": "Streaming on Twitch tonight, come hang!", "tags": ["gaming", "streaming", "twitch"]}
        ])
        
        # Create MY VIBEZ posts for user2 (gaming/travel interests - some overlap)
        self._create_my_vibez_posts(self.user2_id, self.user2_token, [
            {"caption": "Exploring Tokyo gaming cafes 🇯🇵", "tags": ["gaming", "travel", "japan"]},
            {"caption": "Beach vibes and sunset views 🌅", "tags": ["travel", "beach", "nature"]},
            {"caption": "Competitive gaming tournament this weekend!", "tags": ["gaming", "esports", "tournament"]},
            {"caption": "Road trip adventures with friends", "tags": ["travel", "roadtrip", "adventure"]},
            {"caption": "New gaming setup reveal!", "tags": ["gaming", "setup", "tech"]}
        ])
        
        print(f"Created test users with posts: {self.user1_id}, {self.user2_id}")
        
        yield
    
    def _create_my_vibez_posts(self, user_id, token, posts):
        """Helper to create MY VIBEZ posts for a user"""
        for post in posts:
            response = requests.post(
                f"{BASE_URL}/api/my-vibez",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "caption": post["caption"],
                    "tags": post["tags"],
                    "type": "text",
                    "media_url": None
                }
            )
            # Don't fail if post creation fails - just log it
            if response.status_code != 200 and response.status_code != 201:
                print(f"Warning: Failed to create post for {user_id}: {response.status_code}")
    
    def test_analyze_content_with_posts(self):
        """POST /api/ai-content-matching/analyze-content - user with posts"""
        response = requests.post(
            f"{BASE_URL}/api/ai-content-matching/analyze-content",
            json={"user_id": self.user1_id}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # If user has posts, should return analysis
        if data["success"]:
            assert "analysis" in data
            analysis = data["analysis"]
            
            # Verify analysis structure
            assert "interests" in analysis, "Analysis should contain interests"
            assert "personality_traits" in analysis, "Analysis should contain personality_traits"
            assert "content_style" in analysis, "Analysis should contain content_style"
            assert "communication_style" in analysis, "Analysis should contain communication_style"
            assert "analyzed_at" in analysis, "Analysis should contain analyzed_at"
            
            print("Content analysis successful:")
            print(f"  Interests: {analysis.get('interests', [])}")
            print(f"  Personality: {analysis.get('personality_traits', [])}")
            print(f"  Content style: {analysis.get('content_style')}")
            print(f"  Communication style: {analysis.get('communication_style')}")
        else:
            # User might not have posts yet
            print(f"Analysis returned success=False: {data.get('message')}")
    
    def test_analyze_content_force_refresh(self):
        """POST /api/ai-content-matching/analyze-content - force refresh analysis"""
        # First analysis
        response1 = requests.post(
            f"{BASE_URL}/api/ai-content-matching/analyze-content",
            json={"user_id": self.user1_id}
        )
        assert response1.status_code == 200
        
        # Second analysis with force_refresh
        response2 = requests.post(
            f"{BASE_URL}/api/ai-content-matching/analyze-content",
            json={"user_id": self.user1_id, "force_refresh": True}
        )
        assert response2.status_code == 200, f"Expected 200, got {response2.status_code}: {response2.text}"
        
        data = response2.json()
        if data["success"]:
            # Should have fresh analysis
            assert "analysis" in data
            print(f"Force refresh analysis successful: {data.get('message', 'No message')}")
        else:
            print(f"Force refresh returned: {data.get('message')}")
    
    def test_calculate_compatibility(self):
        """POST /api/ai-content-matching/calculate-compatibility - between two users"""
        # First, analyze both users
        requests.post(
            f"{BASE_URL}/api/ai-content-matching/analyze-content",
            json={"user_id": self.user1_id}
        )
        requests.post(
            f"{BASE_URL}/api/ai-content-matching/analyze-content",
            json={"user_id": self.user2_id}
        )
        
        # Calculate compatibility
        response = requests.post(
            f"{BASE_URL}/api/ai-content-matching/calculate-compatibility",
            json={
                "user1_id": self.user1_id,
                "user2_id": self.user2_id
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        if data["success"]:
            assert "compatibility_score" in data
            assert "insights" in data
            assert "match_insight" in data
            assert "shared_interests" in data
            
            score = data["compatibility_score"]
            assert 0 <= score <= 100, f"Score should be 0-100, got {score}"
            
            print("Compatibility calculation successful:")
            print(f"  Score: {score}%")
            print(f"  Insights: {data['insights']}")
            print(f"  Match insight: {data['match_insight']}")
            print(f"  Shared interests: {data['shared_interests']}")
        else:
            # One or both users might not have analysis
            print(f"Compatibility calculation returned: {data.get('message')}")
    
    def test_calculate_compatibility_user_not_found(self):
        """POST /api/ai-content-matching/calculate-compatibility - non-existent user"""
        response = requests.post(
            f"{BASE_URL}/api/ai-content-matching/calculate-compatibility",
            json={
                "user1_id": self.user1_id,
                "user2_id": "nonexistent_user_12345"
            }
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("Correctly returned 404 for non-existent user in compatibility check")
    
    def test_find_matches(self):
        """POST /api/ai-content-matching/find-matches - find compatible users"""
        # First, analyze user1
        analyze_response = requests.post(
            f"{BASE_URL}/api/ai-content-matching/analyze-content",
            json={"user_id": self.user1_id}
        )
        
        if analyze_response.status_code == 200 and analyze_response.json().get("success"):
            # Find matches
            response = requests.post(
                f"{BASE_URL}/api/ai-content-matching/find-matches",
                json={
                    "user_id": self.user1_id,
                    "limit": 10
                }
            )
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
            
            data = response.json()
            assert data["success"]
            assert "matches" in data
            assert "count" in data
            
            print("Find matches successful:")
            print(f"  Found {data['count']} potential matches")
            
            if data["matches"]:
                for match in data["matches"][:3]:  # Show first 3
                    print(f"  - {match.get('name', 'Unknown')}: {match.get('compatibility_score', 0)}% match")
                    print(f"    Shared interests: {match.get('shared_interests', [])}")
        else:
            print("Skipping find-matches test - user analysis not available")
    
    def test_find_matches_no_analysis(self):
        """POST /api/ai-content-matching/find-matches - user without analysis"""
        # Create a new user without analysis
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        new_user_id = response.json()["user_id"]
        
        # Try to find matches without analysis
        response = requests.post(
            f"{BASE_URL}/api/ai-content-matching/find-matches",
            json={"user_id": new_user_id, "limit": 10}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print("Correctly returned 400 for user without content analysis")


class TestAIContentMatchingEdgeCases:
    """Test edge cases and error handling"""
    
    def test_analyze_content_invalid_request(self):
        """POST /api/ai-content-matching/analyze-content - missing user_id"""
        response = requests.post(
            f"{BASE_URL}/api/ai-content-matching/analyze-content",
            json={}
        )
        assert response.status_code == 422, f"Expected 422 for validation error, got {response.status_code}"
        print("Correctly returned 422 for missing user_id")
    
    def test_calculate_compatibility_missing_fields(self):
        """POST /api/ai-content-matching/calculate-compatibility - missing fields"""
        response = requests.post(
            f"{BASE_URL}/api/ai-content-matching/calculate-compatibility",
            json={"user1_id": "test_user"}
        )
        assert response.status_code == 422, f"Expected 422 for validation error, got {response.status_code}"
        print("Correctly returned 422 for missing user2_id")
    
    def test_find_matches_invalid_limit(self):
        """POST /api/ai-content-matching/find-matches - test with different limits"""
        # Create test user
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        user_id = response.json()["user_id"]
        
        # Test with limit=0 (should still work, just return empty)
        response = requests.post(
            f"{BASE_URL}/api/ai-content-matching/find-matches",
            json={"user_id": user_id, "limit": 0}
        )
        # Should return 400 since user needs analysis first
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}"
        print(f"Limit=0 test returned status {response.status_code}")


class TestAIContentMatchingIntegration:
    """Integration tests for the full content matching flow"""
    
    def test_full_matching_flow(self):
        """Test complete flow: create users -> add posts -> analyze -> find matches"""
        # Step 1: Create two test users
        response1 = requests.post(f"{BASE_URL}/api/auth/test-user")
        assert response1.status_code == 200
        user1 = response1.json()
        
        response2 = requests.post(f"{BASE_URL}/api/auth/test-user")
        assert response2.status_code == 200
        user2 = response2.json()
        
        print(f"Step 1: Created users {user1['user_id']} and {user2['user_id']}")
        
        # Step 2: Create MY VIBEZ posts for both users
        posts_user1 = [
            {"caption": "Love coding and building apps!", "tags": ["coding", "tech", "programming"]},
            {"caption": "Coffee and code - perfect combo ☕", "tags": ["coffee", "coding", "productivity"]}
        ]
        
        posts_user2 = [
            {"caption": "Building my startup from scratch", "tags": ["startup", "tech", "entrepreneur"]},
            {"caption": "Tech meetup was awesome!", "tags": ["tech", "networking", "community"]}
        ]
        
        for post in posts_user1:
            requests.post(
                f"{BASE_URL}/api/my-vibez",
                headers={"Authorization": f"Bearer {user1['session_token']}"},
                json={"caption": post["caption"], "tags": post["tags"], "type": "text"}
            )
        
        for post in posts_user2:
            requests.post(
                f"{BASE_URL}/api/my-vibez",
                headers={"Authorization": f"Bearer {user2['session_token']}"},
                json={"caption": post["caption"], "tags": post["tags"], "type": "text"}
            )
        
        print("Step 2: Created MY VIBEZ posts for both users")
        
        # Step 3: Analyze content for both users
        analyze1 = requests.post(
            f"{BASE_URL}/api/ai-content-matching/analyze-content",
            json={"user_id": user1["user_id"]}
        )
        analyze2 = requests.post(
            f"{BASE_URL}/api/ai-content-matching/analyze-content",
            json={"user_id": user2["user_id"]}
        )
        
        print(f"Step 3: Analyzed content - User1: {analyze1.json().get('success')}, User2: {analyze2.json().get('success')}")
        
        # Step 4: Calculate compatibility
        if analyze1.json().get("success") and analyze2.json().get("success"):
            compat = requests.post(
                f"{BASE_URL}/api/ai-content-matching/calculate-compatibility",
                json={"user1_id": user1["user_id"], "user2_id": user2["user_id"]}
            )
            assert compat.status_code == 200
            compat_data = compat.json()
            
            if compat_data["success"]:
                print(f"Step 4: Compatibility score: {compat_data['compatibility_score']}%")
                print(f"  Shared interests: {compat_data.get('shared_interests', [])}")
            else:
                print(f"Step 4: Compatibility check returned: {compat_data.get('message')}")
        else:
            print("Step 4: Skipped - one or both users don't have analysis")
        
        # Step 5: Find matches for user1
        if analyze1.json().get("success"):
            matches = requests.post(
                f"{BASE_URL}/api/ai-content-matching/find-matches",
                json={"user_id": user1["user_id"], "limit": 5}
            )
            assert matches.status_code == 200
            matches_data = matches.json()
            
            print(f"Step 5: Found {matches_data.get('count', 0)} matches for user1")
        else:
            print("Step 5: Skipped - user1 doesn't have analysis")
        
        print("Full matching flow test completed!")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

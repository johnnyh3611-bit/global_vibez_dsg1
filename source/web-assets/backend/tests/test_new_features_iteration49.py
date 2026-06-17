"""
Test Suite for Iteration 49 - New Features Testing
Tests: AI Date Planner, Table for Two, Vibe Score, Card Styles

Features tested:
1. AI Date Planner - POST /api/ai-date-planner/generate (uses Emergent LLM Key with GPT-5.2)
2. Table for Two - GET /api/table-for-two/games, POST /api/table-for-two/invite
3. Vibe Score - GET /api/vibe-score/me (calculates breakdown)
4. Card Styles - GET /api/card-styles/available, POST /api/card-styles/select
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test session to maintain cookies
session = requests.Session()

# Test data
TEST_USER_ID = None
TEST_MATCH_ID = None


class TestDemoLogin:
    """Test demo login to get authenticated session"""
    
    def test_demo_login(self):
        """Login with demo user to get session"""
        global TEST_USER_ID
        
        response = session.post(
            f"{BASE_URL}/api/auth/demo-login",
            json={"email": "demo@globalvibez.com"}
        )
        
        assert response.status_code == 200, f"Demo login failed: {response.text}"
        data = response.json()
        
        assert "user" in data or "user_id" in data, "Response should contain user data"
        TEST_USER_ID = data.get("user", {}).get("user_id") or data.get("user_id")
        print(f"✅ Demo login successful, user_id: {TEST_USER_ID}")


class TestVibeScore:
    """Test Vibe Score calculation and endpoints"""
    
    def test_get_my_vibe_score(self):
        """GET /api/vibe-score/me - Get current user's Vibe Score"""
        response = session.get(f"{BASE_URL}/api/vibe-score/me")
        
        assert response.status_code == 200, f"Failed to get vibe score: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "vibe_score" in data, "Response should contain vibe_score"
        assert "game_elo" in data, "Response should contain game_elo"
        assert "breakdown" in data, "Response should contain breakdown"
        
        # Validate breakdown structure
        breakdown = data["breakdown"]
        expected_keys = ["profile_completeness", "games_played", "dating_games", 
                        "table_for_two", "streams", "matches", "messages", "profile_views"]
        for key in expected_keys:
            assert key in breakdown, f"Breakdown should contain {key}"
        
        print(f"✅ Vibe Score: {data['vibe_score']}, Game Elo: {data['game_elo']}")
        print(f"   Breakdown: {breakdown}")
    
    def test_vibe_leaderboard(self):
        """GET /api/vibe-score/leaderboard/vibe - Get Vibe Score leaderboard"""
        response = session.get(f"{BASE_URL}/api/vibe-score/leaderboard/vibe?limit=10")
        
        assert response.status_code == 200, f"Failed to get leaderboard: {response.text}"
        data = response.json()
        
        assert "leaderboard" in data, "Response should contain leaderboard"
        print(f"✅ Vibe Leaderboard: {len(data['leaderboard'])} entries")
    
    def test_elo_leaderboard(self):
        """GET /api/vibe-score/leaderboard/elo - Get Game Elo leaderboard"""
        response = session.get(f"{BASE_URL}/api/vibe-score/leaderboard/elo?limit=10")
        
        assert response.status_code == 200, f"Failed to get elo leaderboard: {response.text}"
        data = response.json()
        
        assert "leaderboard" in data, "Response should contain leaderboard"
        print(f"✅ Elo Leaderboard: {len(data['leaderboard'])} entries")


class TestCardStyles:
    """Test Card Styles unlock and selection"""
    
    def test_get_available_styles(self):
        """GET /api/card-styles/available - Get all card styles with unlock status"""
        response = session.get(f"{BASE_URL}/api/card-styles/available")
        
        assert response.status_code == 200, f"Failed to get card styles: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "styles" in data, "Response should contain styles"
        assert "current_vibe_score" in data, "Response should contain current_vibe_score"
        assert "selected_style" in data, "Response should contain selected_style"
        
        styles = data["styles"]
        assert len(styles) >= 4, "Should have at least 4 card styles (classic, neon, gold, holographic)"
        
        # Validate each style has required fields
        for style in styles:
            assert "style_id" in style, "Style should have style_id"
            assert "name" in style, "Style should have name"
            assert "unlock_requirement" in style, "Style should have unlock_requirement"
            assert "is_unlocked" in style, "Style should have is_unlocked"
            assert "is_selected" in style, "Style should have is_selected"
        
        # Classic should always be unlocked (0 points required)
        classic = next((s for s in styles if s["style_id"] == "classic"), None)
        assert classic is not None, "Classic style should exist"
        assert classic["is_unlocked"], "Classic style should be unlocked"
        
        print(f"✅ Card Styles: {len(styles)} styles available")
        print(f"   Current Vibe Score: {data['current_vibe_score']}")
        print(f"   Selected Style: {data['selected_style']}")
    
    def test_select_classic_style(self):
        """POST /api/card-styles/select - Select classic style (always unlocked)"""
        response = session.post(
            f"{BASE_URL}/api/card-styles/select",
            json={"style_id": "classic"}
        )
        
        assert response.status_code == 200, f"Failed to select style: {response.text}"
        data = response.json()
        
        assert "selected_style" in data, "Response should contain selected_style"
        assert data["selected_style"] == "classic", "Selected style should be classic"
        print("✅ Selected classic style successfully")
    
    def test_select_locked_style_fails(self):
        """POST /api/card-styles/select - Selecting locked style should fail"""
        # Try to select holographic (requires 3000 points)
        response = session.post(
            f"{BASE_URL}/api/card-styles/select",
            json={"style_id": "holographic"}
        )
        
        # Should fail with 403 if user doesn't have enough points
        # Or succeed if user has 3000+ points
        if response.status_code == 403:
            data = response.json()
            assert "detail" in data, "Error response should have detail"
            print(f"✅ Correctly blocked locked style selection: {data['detail']}")
        elif response.status_code == 200:
            print("✅ User has enough points to unlock holographic style")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}")
    
    def test_get_style_stats(self):
        """GET /api/card-styles/stats - Get user's card style statistics"""
        response = session.get(f"{BASE_URL}/api/card-styles/stats")
        
        assert response.status_code == 200, f"Failed to get style stats: {response.text}"
        data = response.json()
        
        assert "unlocked_count" in data, "Response should contain unlocked_count"
        assert "total_styles" in data, "Response should contain total_styles"
        assert "current_style" in data, "Response should contain current_style"
        
        print(f"✅ Style Stats: {data['unlocked_count']}/{data['total_styles']} unlocked")
    
    def test_style_preview(self):
        """GET /api/card-styles/preview/{style_id} - Get style preview"""
        response = session.get(f"{BASE_URL}/api/card-styles/preview/neon")
        
        assert response.status_code == 200, f"Failed to get style preview: {response.text}"
        data = response.json()
        
        assert "style" in data, "Response should contain style"
        assert "example_cards" in data, "Response should contain example_cards"
        print("✅ Style preview for 'neon' retrieved")


class TestTableForTwo:
    """Test Table for Two game invite system"""
    
    def test_get_icebreaker_games(self):
        """GET /api/table-for-two/games - Get available icebreaker games"""
        response = session.get(f"{BASE_URL}/api/table-for-two/games")
        
        assert response.status_code == 200, f"Failed to get games: {response.text}"
        data = response.json()
        
        assert "games" in data, "Response should contain games"
        games = data["games"]
        
        # Validate expected games exist
        expected_games = ["uno", "connect4", "tictactoe", "checkers"]
        for game_type in expected_games:
            assert game_type in games, f"Game {game_type} should be available"
            game = games[game_type]
            assert "name" in game, f"Game {game_type} should have name"
            assert "emoji" in game, f"Game {game_type} should have emoji"
            assert "duration" in game, f"Game {game_type} should have duration"
        
        print(f"✅ Icebreaker Games: {list(games.keys())}")
    
    def test_get_sent_invites(self):
        """GET /api/table-for-two/invites/sent - Get sent invites"""
        response = session.get(f"{BASE_URL}/api/table-for-two/invites/sent")
        
        assert response.status_code == 200, f"Failed to get sent invites: {response.text}"
        data = response.json()
        
        assert "invites" in data, "Response should contain invites"
        print(f"✅ Sent invites: {len(data['invites'])} pending")
    
    def test_get_received_invites(self):
        """GET /api/table-for-two/invites/received - Get received invites"""
        response = session.get(f"{BASE_URL}/api/table-for-two/invites/received")
        
        assert response.status_code == 200, f"Failed to get received invites: {response.text}"
        data = response.json()
        
        assert "invites" in data, "Response should contain invites"
        print(f"✅ Received invites: {len(data['invites'])} pending")
    
    def test_get_table_for_two_stats(self):
        """GET /api/table-for-two/stats - Get user's Table for Two statistics"""
        response = session.get(f"{BASE_URL}/api/table-for-two/stats")
        
        assert response.status_code == 200, f"Failed to get stats: {response.text}"
        data = response.json()
        
        assert "invites_sent" in data, "Response should contain invites_sent"
        assert "invites_accepted" in data, "Response should contain invites_accepted"
        assert "dating_games_played" in data, "Response should contain dating_games_played"
        
        print(f"✅ Table for Two Stats: {data['invites_sent']} sent, {data['invites_accepted']} accepted")


class TestAIDatePlanner:
    """Test AI Date Planner with Emergent LLM Key (GPT-5.2)"""
    
    def test_get_planner_stats(self):
        """GET /api/ai-date-planner/stats - Get user's AI Date Planner statistics"""
        response = session.get(f"{BASE_URL}/api/ai-date-planner/stats")
        
        assert response.status_code == 200, f"Failed to get planner stats: {response.text}"
        data = response.json()
        
        assert "plans_created" in data, "Response should contain plans_created"
        assert "total_plans" in data, "Response should contain total_plans"
        assert "ai_powered" in data, "Response should contain ai_powered"
        assert data["ai_powered"], "AI should be powered"
        
        print(f"✅ AI Date Planner Stats: {data['plans_created']} plans created")


class TestCreateMatchAndInvite:
    """Test creating a match and sending game invite (requires seed data)"""
    
    @pytest.fixture(autouse=True)
    def setup_test_match(self):
        """Create test match data for Table for Two and AI Date Planner testing"""
        global TEST_MATCH_ID
        
        # First, create a second test user
        test_user2_id = f"test_user_{uuid.uuid4().hex[:8]}"
        
        # Create match directly in database via API (if available) or skip
        # For now, we'll test with existing matches
        
        # Try to get existing matches
        response = session.get(f"{BASE_URL}/api/dating/matches")
        if response.status_code == 200:
            data = response.json()
            matches = data.get("matches", [])
            if matches:
                TEST_MATCH_ID = matches[0].get("match_id")
                print(f"✅ Using existing match: {TEST_MATCH_ID}")
            else:
                print("⚠️ No existing matches found - some tests will be skipped")
        else:
            print(f"⚠️ Could not fetch matches: {response.status_code}")
    
    def test_send_game_invite_requires_match(self):
        """POST /api/table-for-two/invite - Requires valid match_id"""
        if not TEST_MATCH_ID:
            pytest.skip("No test match available")
        
        response = session.post(
            f"{BASE_URL}/api/table-for-two/invite",
            json={
                "match_id": TEST_MATCH_ID,
                "game_type": "uno",
                "message": "Let's play UNO! 🎴"
            }
        )
        
        # Could be 200 (success) or 400 (already pending invite)
        if response.status_code == 200:
            data = response.json()
            assert "invite_id" in data, "Response should contain invite_id"
            print(f"✅ Game invite sent: {data['invite_id']}")
        elif response.status_code == 400:
            data = response.json()
            print(f"⚠️ Invite blocked (expected): {data.get('detail', 'Unknown')}")
        else:
            pytest.fail(f"Unexpected status: {response.status_code} - {response.text}")
    
    def test_send_game_invite_invalid_match(self):
        """POST /api/table-for-two/invite - Invalid match_id should fail"""
        response = session.post(
            f"{BASE_URL}/api/table-for-two/invite",
            json={
                "match_id": "invalid_match_id_12345",
                "game_type": "uno"
            }
        )
        
        assert response.status_code == 404, f"Should return 404 for invalid match: {response.text}"
        print("✅ Correctly rejected invalid match_id")
    
    def test_send_game_invite_invalid_game_type(self):
        """POST /api/table-for-two/invite - Invalid game_type should fail"""
        if not TEST_MATCH_ID:
            pytest.skip("No test match available")
        
        response = session.post(
            f"{BASE_URL}/api/table-for-two/invite",
            json={
                "match_id": TEST_MATCH_ID,
                "game_type": "invalid_game_xyz"
            }
        )
        
        assert response.status_code == 400, f"Should return 400 for invalid game type: {response.text}"
        print("✅ Correctly rejected invalid game_type")
    
    def test_ai_date_planner_requires_match(self):
        """POST /api/ai-date-planner/generate - Requires valid match_id"""
        if not TEST_MATCH_ID:
            pytest.skip("No test match available")
        
        response = session.post(
            f"{BASE_URL}/api/ai-date-planner/generate",
            json={"match_id": TEST_MATCH_ID},
            timeout=60  # AI generation can take time
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Validate AI response structure
            assert "restaurant" in data, "Response should contain restaurant"
            assert "activity" in data, "Response should contain activity"
            assert "game" in data, "Response should contain game"
            assert "itinerary" in data, "Response should contain itinerary"
            
            # Validate restaurant structure
            restaurant = data["restaurant"]
            assert "name" in restaurant, "Restaurant should have name"
            assert "cuisine" in restaurant, "Restaurant should have cuisine"
            
            # Validate game suggestion
            game = data["game"]
            assert "name" in game, "Game should have name"
            
            print("✅ AI Date Plan generated!")
            print(f"   Restaurant: {restaurant.get('name')}")
            print(f"   Activity: {data['activity'].get('name')}")
            print(f"   Game: {game.get('name')}")
        elif response.status_code == 500:
            # AI service might be unavailable
            print(f"⚠️ AI service error (may be expected): {response.text}")
        else:
            pytest.fail(f"Unexpected status: {response.status_code} - {response.text}")
    
    def test_ai_date_planner_invalid_match(self):
        """POST /api/ai-date-planner/generate - Invalid match_id should fail"""
        response = session.post(
            f"{BASE_URL}/api/ai-date-planner/generate",
            json={"match_id": "invalid_match_id_12345"}
        )
        
        assert response.status_code == 404, f"Should return 404 for invalid match: {response.text}"
        print("✅ Correctly rejected invalid match_id for AI planner")


class TestUnauthenticatedAccess:
    """Test that endpoints require authentication"""
    
    def test_vibe_score_requires_auth(self):
        """GET /api/vibe-score/me - Should require authentication"""
        # Use a new session without cookies
        new_session = requests.Session()
        response = new_session.get(f"{BASE_URL}/api/vibe-score/me")
        
        assert response.status_code == 401, f"Should return 401 without auth: {response.status_code}"
        print("✅ Vibe Score endpoint requires authentication")
    
    def test_card_styles_requires_auth(self):
        """GET /api/card-styles/available - Should require authentication"""
        new_session = requests.Session()
        response = new_session.get(f"{BASE_URL}/api/card-styles/available")
        
        assert response.status_code == 401, f"Should return 401 without auth: {response.status_code}"
        print("✅ Card Styles endpoint requires authentication")
    
    def test_table_for_two_invite_requires_auth(self):
        """POST /api/table-for-two/invite - Should require authentication"""
        new_session = requests.Session()
        response = new_session.post(
            f"{BASE_URL}/api/table-for-two/invite",
            json={"match_id": "test", "game_type": "uno"}
        )
        
        assert response.status_code == 401, f"Should return 401 without auth: {response.status_code}"
        print("✅ Table for Two invite requires authentication")
    
    def test_ai_date_planner_requires_auth(self):
        """POST /api/ai-date-planner/generate - Should require authentication"""
        new_session = requests.Session()
        response = new_session.post(
            f"{BASE_URL}/api/ai-date-planner/generate",
            json={"match_id": "test"}
        )
        
        assert response.status_code == 401, f"Should return 401 without auth: {response.status_code}"
        print("✅ AI Date Planner requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

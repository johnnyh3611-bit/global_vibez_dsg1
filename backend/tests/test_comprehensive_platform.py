"""
Comprehensive Platform Test Suite for Global Vibez DSG
Tests ALL major features: Auth, Dating, Gaming, Rides, Social, Admin, Safety, Monetization
Updated with correct API endpoint paths
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuthenticationSystem:
    """Authentication endpoint tests - Demo login, Test user, Session management"""
    
    def test_demo_login(self):
        """Test demo login endpoint"""
        response = requests.post(f"{BASE_URL}/api/auth/demo-login")
        assert response.status_code == 200, f"Demo login failed: {response.text}"
        data = response.json()
        assert "user_id" in data
        assert "email" in data
        assert data["email"] == "demo@globalvibez.com"
        print(f"Demo login successful: {data['user_id']}")
    
    def test_create_test_user(self):
        """Test creating a unique test user"""
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        assert response.status_code == 200, f"Test user creation failed: {response.text}"
        data = response.json()
        assert "user_id" in data
        assert "session_token" in data
        assert "email" in data
        print(f"Test user created: {data['user_id']}")
    
    def test_auth_me_unauthorized(self):
        """Test /auth/me without authentication"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        print("Auth/me correctly returns 401 for unauthenticated")
    
    def test_auth_me_with_token(self):
        """Test /auth/me with valid session token"""
        create_resp = requests.post(f"{BASE_URL}/api/auth/test-user")
        token = create_resp.json()["session_token"]
        
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        print(f"Auth/me successful for user: {data['user_id']}")


class TestDatingFeatures:
    """Dating system tests - Discover, Swipe, Matches, Chat"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        return response.json()["session_token"]
    
    def test_discover_feed(self, auth_token):
        """Test discovery feed endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/discover",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Discover feed returned {len(data)} profiles")
    
    def test_matches_list(self, auth_token):
        """Test matches list endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/matches",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Matches list returned {len(data)} matches")
    
    def test_conversations_list(self, auth_token):
        """Test conversations list endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/messages/conversations",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Conversations list returned {len(data)} conversations")
    
    def test_profile_update(self, auth_token):
        """Test profile update endpoint"""
        response = requests.put(
            f"{BASE_URL}/api/profile",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"bio": f"Test bio updated at {datetime.now().isoformat()}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "bio" in data
        print("Profile update successful")
    
    def test_dating_profile(self, auth_token):
        """Test dating profile endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/dating/profile/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        print("Dating profile endpoint working")


class TestGamingSystem:
    """Gaming system tests - Games list, Practice, Tournaments, Multiplayer"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        return response.json()["session_token"]
    
    def test_games_list(self, auth_token):
        """Test games list endpoint - /api/games/list"""
        response = requests.get(
            f"{BASE_URL}/api/games/list",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "games" in data
        print(f"Games list returned {len(data['games'])} games")
    
    def test_my_active_games(self, auth_token):
        """Test my active games endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/games/my-games/active",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "games" in data
        print(f"Active games: {len(data['games'])}")
    
    def test_tournaments_list(self, auth_token):
        """Test tournaments list endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/tournaments",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        print(f"Tournaments endpoint working: {type(data)}")
    
    def test_practice_games(self, auth_token):
        """Test practice games endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/practice/games",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        print("Practice games endpoint working")
    
    def test_trivia_categories(self, auth_token):
        """Test trivia categories endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/trivia/categories",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "categories" in data
        print(f"Trivia categories returned {len(data['categories'])} categories")
    
    def test_would_you_rather(self, auth_token):
        """Test Would You Rather endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/games/would-you-rather/random",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        print("Would You Rather endpoint working")
    
    def test_multiplayer_stats(self, auth_token):
        """Test multiplayer stats endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/multiplayer/stats",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        print(f"Multiplayer stats: {data}")


class TestVibeRidezSystem:
    """Vibe Ridez tests - Rides, Drivers, Safety, Ratings"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        return response.json()["session_token"]
    
    def test_my_rides(self, auth_token):
        """Test my rides endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/rides/my-rides",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "rides" in data
        print(f"My rides returned {len(data['rides'])} rides")
    
    def test_driver_me(self, auth_token):
        """Test driver me endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/drivers/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        # May return 404 if not a driver, or 200 if driver
        assert response.status_code in [200, 404]
        print(f"Driver me check: {response.status_code}")
    
    def test_rides_safety_settings(self, auth_token):
        """Test rides safety settings endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/rides/safety/settings",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        print(f"Safety settings: {data}")


class TestSocialFeatures:
    """Social features tests - Friends, MY VIBEZ, Streaming, Video Calls"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        return response.json()
    
    def test_friends_list(self, auth_token):
        """Test friends list endpoint"""
        user_id = auth_token["user_id"]
        token = auth_token["session_token"]
        response = requests.get(
            f"{BASE_URL}/api/api/friends/list/{user_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "friends" in data
        print(f"Friends list returned {len(data['friends'])} friends")
    
    def test_my_vibez_posts(self, auth_token):
        """Test MY VIBEZ posts endpoint"""
        user_id = auth_token["user_id"]
        token = auth_token["session_token"]
        response = requests.get(
            f"{BASE_URL}/api/my-vibez/posts/{user_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        print("MY VIBEZ posts endpoint working")
    
    def test_live_streams_active(self, auth_token):
        """Test live streams active endpoint"""
        token = auth_token["session_token"]
        response = requests.get(
            f"{BASE_URL}/api/live-streaming/active",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        print("Live streams endpoint working")
    
    def test_video_call_status(self, auth_token):
        """Test video call status endpoint"""
        token = auth_token["session_token"]
        response = requests.get(
            f"{BASE_URL}/api/video-call/status",
            headers={"Authorization": f"Bearer {token}"}
        )
        # May return 200 or 404 depending on active calls
        assert response.status_code in [200, 404]
        print(f"Video call status: {response.status_code}")


class TestTrustAndSafety:
    """Trust & Safety tests - Reports, Blocking, Verification, Ratings"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        return response.json()["session_token"]
    
    def test_blocked_users_list(self, auth_token):
        """Test blocked users list endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/reports/blocked",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "blocked_users" in data
        print(f"Blocked users list returned {len(data['blocked_users'])} users")
    
    def test_my_reports(self, auth_token):
        """Test my reports endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/reports/my-reports",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "user_reports" in data
        assert "content_reports" in data
        print(f"My reports: {data['total']} total")
    
    def test_verification_status(self, auth_token):
        """Test verification status endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/verification/status",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        print(f"Verification status: {data}")
    
    def test_block_unblock_flow(self, auth_token):
        """Test block and unblock user flow"""
        # Create another test user to block
        other_user_resp = requests.post(f"{BASE_URL}/api/auth/test-user")
        other_user_id = other_user_resp.json()["user_id"]
        
        # Block user
        block_resp = requests.post(
            f"{BASE_URL}/api/reports/block/{other_user_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert block_resp.status_code == 200
        print(f"Blocked user: {other_user_id}")
        
        # Check if blocked
        check_resp = requests.get(
            f"{BASE_URL}/api/reports/is-blocked/{other_user_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert check_resp.status_code == 200
        assert check_resp.json()["blocked_by_me"]
        
        # Unblock user
        unblock_resp = requests.post(
            f"{BASE_URL}/api/reports/unblock/{other_user_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert unblock_resp.status_code == 200
        print(f"Unblocked user: {other_user_id}")


class TestMonetization:
    """Monetization tests - Wallet, Subscriptions, Pricing"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        return response.json()["session_token"]
    
    def test_wallet_balance(self, auth_token):
        """Test wallet balance endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/wallet/balance",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "credit_balance" in data or "balance" in data or "credits" in data
        print(f"Wallet balance: {data}")
    
    def test_subscription_tiers(self, auth_token):
        """Test subscription tiers endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/tiers",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        print(f"Subscription tiers: {data}")
    
    def test_referral_info(self, auth_token):
        """Test referral info endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/referral/info",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "referral_code" in data
        print(f"Referral code: {data['referral_code']}")
    
    def test_monetization_pricing(self, auth_token):
        """Test monetization pricing endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/monetization/pricing",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        print("Monetization pricing endpoint working")


class TestAdminEndpoints:
    """Admin endpoints tests - Dashboard, Users, Moderation"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        return response.json()["session_token"]
    
    def test_admin_dashboard_requires_admin(self, auth_token):
        """Test admin dashboard requires admin privileges"""
        response = requests.get(
            f"{BASE_URL}/api/admin/dashboard",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        # Should return 403 for non-admin users
        assert response.status_code == 403
        print("Admin dashboard correctly requires admin privileges")
    
    def test_verification_admin_stats(self, auth_token):
        """Test verification admin stats endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/verification/admin/stats",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        # May require admin or return stats
        assert response.status_code in [200, 403]
        print(f"Verification admin stats: {response.status_code}")


class TestContentFeatures:
    """Content features tests - Restaurants, Date Planner, Categories"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        return response.json()["session_token"]
    
    def test_restaurants_list(self, auth_token):
        """Test restaurants list endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/restaurants",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        print("Restaurants endpoint working")
    
    def test_categories_all(self, auth_token):
        """Test categories all endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/categories/all",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        print(f"Categories: {data}")
    
    def test_dating_games(self, auth_token):
        """Test dating games endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/dating-games/stats/test",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        # May return 200 or 404 depending on user
        assert response.status_code in [200, 404]
        print(f"Dating games stats: {response.status_code}")


class TestAIFeatures:
    """AI features tests - AI Practice, AI Content Matching, AI Coach"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        return response.json()["session_token"]
    
    def test_ai_content_matching_stats(self, auth_token):
        """Test AI content matching stats endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/ai-content-matching/stats",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        print("AI content matching stats working")


class TestEngagement:
    """Engagement features tests - Stats, Activity"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        return response.json()
    
    def test_engagement_notifications(self, auth_token):
        """Test engagement notifications endpoint"""
        user_id = auth_token["user_id"]
        token = auth_token["session_token"]
        response = requests.get(
            f"{BASE_URL}/api/engagement/notifications/{user_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        print("Engagement notifications working")
    
    def test_engagement_activity_feed(self, auth_token):
        """Test engagement activity feed endpoint"""
        user_id = auth_token["user_id"]
        token = auth_token["session_token"]
        response = requests.get(
            f"{BASE_URL}/api/engagement/activity-feed/{user_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        print("Engagement activity feed working")


class TestAvatars:
    """Avatar system tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        return response.json()["session_token"]
    
    def test_avatars_me(self, auth_token):
        """Test avatars me endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/avatars/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        print("Avatars me endpoint working")


class TestGroupPlanner:
    """Group planner tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        return response.json()["session_token"]
    
    def test_group_plans_list(self, auth_token):
        """Test group plans list endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/group-planner/plans",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        print("Group planner endpoint working")


class TestQuiz:
    """Quiz system tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        return response.json()["session_token"]
    
    def test_quiz_questions(self, auth_token):
        """Test quiz questions endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/quiz/questions",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        print("Quiz questions endpoint working")


class TestGiftCards:
    """Gift cards system tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        return response.json()["session_token"]
    
    def test_gift_cards_list(self, auth_token):
        """Test gift cards list endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/gift-cards",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        print("Gift cards endpoint working")


class TestStats:
    """Stats system tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        return response.json()["session_token"]
    
    def test_user_stats(self, auth_token):
        """Test user stats endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/stats/user",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        print("User stats endpoint working")


class TestTables:
    """Tables system tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        return response.json()["session_token"]
    
    def test_tables_list(self, auth_token):
        """Test tables list endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/tables",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        print("Tables endpoint working")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

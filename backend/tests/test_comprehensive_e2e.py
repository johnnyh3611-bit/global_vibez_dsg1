"""
Comprehensive E2E Backend Tests for Global Vibez DSG Platform
Tests all major endpoints including fixed messaging, vibez, and matchmaking routes
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://social-connect-953.preview.emergentagent.com')

class TestAuthenticationFlow:
    """Test authentication endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.token = None
        self.user_id = None
    
    def test_demo_login(self):
        """Test demo login endpoint"""
        response = self.session.post(f"{BASE_URL}/api/auth/demo-login")
        assert response.status_code == 200
        data = response.json()
        assert "token" in data or "user_id" in data
        self.token = data.get("token")
        self.user_id = data.get("user_id")
        print(f"Demo login successful - user_id: {self.user_id}")
    
    def test_get_current_user(self):
        """Test get current user endpoint"""
        # First login
        login_response = self.session.post(f"{BASE_URL}/api/auth/demo-login")
        token = login_response.json().get("token")
        
        headers = {"Authorization": f"Bearer {token}"}
        response = self.session.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data or "email" in data
        print("Current user retrieved successfully")


class TestMessagingEndpoints:
    """Test messaging endpoints - FIXED in this iteration"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authenticated session"""
        self.session = requests.Session()
        login_response = self.session.post(f"{BASE_URL}/api/auth/demo-login")
        self.token = login_response.json().get("token")
        self.user_id = login_response.json().get("user_id")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_conversations(self):
        """Test conversations endpoint - FIXED"""
        response = self.session.get(
            f"{BASE_URL}/api/messaging/conversations",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "conversations" in data
        print(f"Conversations endpoint working - found {len(data.get('conversations', []))} conversations")
    
    def test_get_unread_count(self):
        """Test unread message count endpoint"""
        response = self.session.get(
            f"{BASE_URL}/api/messaging/unread-count",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "unread_count" in data
        print(f"Unread count: {data.get('unread_count', 0)}")


class TestVibezFeedEndpoints:
    """Test My Vibez content feed endpoints - FIXED in this iteration"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authenticated session"""
        self.session = requests.Session()
        login_response = self.session.post(f"{BASE_URL}/api/auth/demo-login")
        self.token = login_response.json().get("token")
        self.user_id = login_response.json().get("user_id")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_trending_feed(self):
        """Test trending feed endpoint"""
        response = self.session.get(
            f"{BASE_URL}/api/vibez/feed/trending?limit=10",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        assert "content" in data
        print(f"Trending feed working - found {len(data.get('content', []))} items")
    
    def test_for_you_feed(self):
        """Test for-you personalized feed endpoint - FIXED"""
        response = self.session.get(
            f"{BASE_URL}/api/vibez/feed/for-you?user_id={self.user_id}&limit=10",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        assert "content" in data
        print(f"For-you feed working - found {len(data.get('content', []))} items")
    
    def test_user_stats(self):
        """Test user stats endpoint"""
        response = self.session.get(
            f"{BASE_URL}/api/vibez/user/{self.user_id}/stats",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        print("User stats retrieved successfully")


class TestMatchmakingEndpoints:
    """Test matchmaking endpoints - FIXED random import"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authenticated session"""
        self.session = requests.Session()
        login_response = self.session.post(f"{BASE_URL}/api/auth/demo-login")
        self.token = login_response.json().get("token")
        self.user_id = login_response.json().get("user_id")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_create_matchmaking_profile(self):
        """Test creating matchmaking profile"""
        profile_data = {
            "user_id": f"TEST_{self.user_id}",
            "name": "Test Player",
            "age": 25,
            "bio": "Test bio",
            "favorite_games": ["blackjack", "poker"],
            "skill_scores": {"blackjack": 1000, "poker": 1200},
            "total_games_played": 10,
            "win_rate": 0.5,
            "preferences": {
                "age_min": 18,
                "age_max": 40,
                "preferred_games": ["blackjack"],
                "skill_level_min": 1,
                "skill_level_max": 10,
                "distance_max": 50,
                "looking_for": "gaming_partner"
            }
        }
        response = self.session.post(
            f"{BASE_URL}/api/matchmaking/profile",
            headers=self.headers,
            json=profile_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success")
        print("Matchmaking profile created successfully")
    
    def test_find_matches(self):
        """Test find matches endpoint"""
        # First create a profile
        profile_data = {
            "user_id": f"TEST_MATCH_{self.user_id}",
            "name": "Match Finder",
            "age": 25,
            "favorite_games": ["blackjack"],
            "skill_scores": {"blackjack": 1000},
            "preferences": {
                "age_min": 18,
                "age_max": 40,
                "preferred_games": ["blackjack"],
                "looking_for": "gaming_partner"
            }
        }
        self.session.post(
            f"{BASE_URL}/api/matchmaking/profile",
            headers=self.headers,
            json=profile_data
        )
        
        response = self.session.get(
            f"{BASE_URL}/api/matchmaking/find-matches/TEST_MATCH_{self.user_id}?limit=5",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        print(f"Find matches working - found {data.get('total_found', 0)} potential matches")


class TestCasinoGames:
    """Test casino game endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authenticated session"""
        self.session = requests.Session()
        login_response = self.session.post(f"{BASE_URL}/api/auth/demo-login")
        self.token = login_response.json().get("token")
        self.user_id = login_response.json().get("user_id")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_baccarat_play(self):
        """Test baccarat play endpoint"""
        response = self.session.post(
            f"{BASE_URL}/api/baccarat/play",
            headers=self.headers,
            json={"bet_type": "player", "bet_amount": 10, "game_mode": "standard"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "success" in data or "winner" in data
        print("Baccarat play endpoint working")
    
    def test_baccarat_history(self):
        """Test baccarat history endpoint"""
        response = self.session.get(
            f"{BASE_URL}/api/baccarat/history?limit=5",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "games" in data or isinstance(data, list)
        print("Baccarat history endpoint working")
    
    def test_baccarat_stats(self):
        """Test baccarat stats endpoint"""
        response = self.session.get(
            f"{BASE_URL}/api/baccarat/stats",
            headers=self.headers
        )
        assert response.status_code == 200
        print("Baccarat stats endpoint working")
    
    def test_bid_whist_start(self):
        """Test bid whist start endpoint"""
        response = self.session.post(
            f"{BASE_URL}/api/bid-whist/start",
            headers=self.headers,
            json={
                "partner_id": "ai-partner",
                "opponent1_id": "ai-1",
                "opponent2_id": "ai-2",
                "wager": 0,
                "winning_score": 7
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "success" in data or "game_id" in data
        print("Bid Whist start endpoint working")
    
    def test_vibe654_play(self):
        """Test Vibez 654 dice game endpoint"""
        response = self.session.post(
            f"{BASE_URL}/api/games/vibe654/play",
            headers=self.headers,
            json={
                "user_id": self.user_id,
                "table_id": "test_table",
                "main_bet": 10,
                "side_bets": [],
                "dealer_personality": "nova"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "success" in data or "dice_roll" in data
        print("Vibez 654 play endpoint working")


class TestPremiumFeatures:
    """Test premium features endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authenticated session"""
        self.session = requests.Session()
        login_response = self.session.post(f"{BASE_URL}/api/auth/demo-login")
        self.token = login_response.json().get("token")
        self.user_id = login_response.json().get("user_id")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_vibe_suites_discover(self):
        """Test vibe suites discovery endpoint"""
        response = self.session.get(
            f"{BASE_URL}/api/vibe-suites/discover?limit=10",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "suites" in data or isinstance(data, list)
        print("Vibe Suites discover endpoint working")
    
    def test_jftn_rooms(self):
        """Test Just For The Night rooms endpoint"""
        response = self.session.get(
            f"{BASE_URL}/api/jftn/rooms",
            headers=self.headers
        )
        # May return 200 or 404 if no rooms exist
        assert response.status_code in [200, 404]
        print("JFTN rooms endpoint accessible")


class TestWalletSystem:
    """Test wallet system endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authenticated session"""
        self.session = requests.Session()
        login_response = self.session.post(f"{BASE_URL}/api/auth/demo-login")
        self.token = login_response.json().get("token")
        self.user_id = login_response.json().get("user_id")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_wallet_balance(self):
        """Test wallet balance endpoint"""
        response = self.session.get(
            f"{BASE_URL}/api/wallet/balance/{self.user_id}",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "balance" in data or "success" in data
        print(f"Wallet balance: {data.get('balance', 'N/A')}")
    
    def test_wallet_packages(self):
        """Test wallet packages endpoint"""
        response = self.session.get(
            f"{BASE_URL}/api/wallet/packages",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "packages" in data or isinstance(data, list)
        print("Wallet packages endpoint working")


class TestAdminEndpoints:
    """Test admin dashboard endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authenticated session"""
        self.session = requests.Session()
        login_response = self.session.post(f"{BASE_URL}/api/auth/demo-login")
        self.token = login_response.json().get("token")
        self.user_id = login_response.json().get("user_id")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_admin_dashboard(self):
        """Test admin dashboard endpoint"""
        response = self.session.get(
            f"{BASE_URL}/api/admin/dashboard",
            headers=self.headers
        )
        # May return 200 or 403 depending on user permissions
        assert response.status_code in [200, 403]
        print(f"Admin dashboard status: {response.status_code}")
    
    def test_god_mode_casino_analytics(self):
        """Test god mode casino analytics"""
        response = self.session.get(
            f"{BASE_URL}/api/god-mode/casino-analytics",
            headers=self.headers
        )
        # May return 200 or 401/403 depending on admin status
        assert response.status_code in [200, 401, 403]
        print(f"God mode analytics status: {response.status_code}")


# Cleanup fixture
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_data():
    """Cleanup test data after all tests"""
    yield
    # Cleanup would go here if needed
    print("Test session completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

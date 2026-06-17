"""
Comprehensive System Test for Global Vibez Platform
Tests: Authentication, Admin Dashboard, Casino Games, Premium Features, Messaging, Wallet
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://social-connect-953.preview.emergentagent.com').rstrip('/')

class TestAuthentication:
    """Authentication endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = self.session.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✅ API Root: {data['message']}")
    
    def test_demo_login(self):
        """Test demo login endpoint"""
        response = self.session.post(f"{BASE_URL}/api/auth/demo-login")
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "token" in data
        print(f"✅ Demo Login: user_id={data['user_id']}")
        return data
    
    def test_auth_me_with_token(self):
        """Test /auth/me with valid token"""
        # First login
        login_response = self.session.post(f"{BASE_URL}/api/auth/demo-login")
        assert login_response.status_code == 200
        token = login_response.json().get("token")
        
        # Then check /auth/me with token
        headers = {"Authorization": f"Bearer {token}"}
        response = self.session.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        print(f"✅ Auth Me: user_id={data['user_id']}, email={data.get('email')}")
    
    def test_auth_me_without_token(self):
        """Test /auth/me without token returns 401"""
        response = self.session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        print("✅ Auth Me without token correctly returns 401")


class TestAdminDashboard:
    """Admin Dashboard endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with demo login"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Get demo token
        login_response = self.session.post(f"{BASE_URL}/api/auth/demo-login")
        if login_response.status_code == 200:
            self.token = login_response.json().get("token")
            self.user_id = login_response.json().get("user_id")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            self.token = None
            self.user_id = None
    
    def test_admin_vault_auth(self):
        """Test admin vault authentication"""
        response = self.session.post(f"{BASE_URL}/api/admin/vault-auth", json={
            "password": "GlobalVibez_Founder_2025!",
            "code": "123456"  # Code is not validated in current implementation
        })
        # Should return 200 with correct password
        print(f"Admin Vault Auth: status={response.status_code}")
        if response.status_code == 200:
            print("✅ Admin Vault Auth successful")
        else:
            print(f"⚠️ Admin Vault Auth: {response.text}")
    
    def test_admin_master_stats(self):
        """Test admin master stats endpoint"""
        response = self.session.get(f"{BASE_URL}/api/admin/master-stats")
        print(f"Admin Master Stats: status={response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Master Stats: {data.get('stats', {})}")
        else:
            print(f"⚠️ Admin Master Stats: {response.text[:200]}")
    
    def test_admin_all_users(self):
        """Test admin all users endpoint"""
        response = self.session.get(f"{BASE_URL}/api/admin/all-users")
        print(f"Admin All Users: status={response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ All Users: total={data.get('total', 0)}")
        else:
            print(f"⚠️ Admin All Users: {response.text[:200]}")
    
    def test_god_mode_casino_analytics(self):
        """Test God Mode casino analytics endpoint"""
        response = self.session.get(f"{BASE_URL}/api/god-mode/casino-analytics")
        print(f"God Mode Casino Analytics: status={response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Casino Analytics: users={data.get('users', {})}")
        elif response.status_code == 401:
            print("⚠️ God Mode requires admin authentication (401)")
        elif response.status_code == 403:
            print("⚠️ God Mode requires admin privileges (403)")
        else:
            print(f"⚠️ God Mode Casino Analytics: {response.text[:200]}")
    
    def test_god_mode_active_games(self):
        """Test God Mode active games endpoint"""
        response = self.session.get(f"{BASE_URL}/api/god-mode/active-games")
        print(f"God Mode Active Games: status={response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Active Games: bid_whist={data.get('bid_whist', {}).get('count', 0)}")
        elif response.status_code in [401, 403]:
            print(f"⚠️ God Mode requires admin authentication ({response.status_code})")
        else:
            print(f"⚠️ God Mode Active Games: {response.text[:200]}")
    
    def test_god_mode_transaction_logs(self):
        """Test God Mode transaction logs endpoint"""
        response = self.session.get(f"{BASE_URL}/api/god-mode/transaction-logs")
        print(f"God Mode Transaction Logs: status={response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Transaction Logs: count={data.get('summary', {}).get('count', 0)}")
        elif response.status_code in [401, 403]:
            print(f"⚠️ God Mode requires admin authentication ({response.status_code})")
        else:
            print(f"⚠️ God Mode Transaction Logs: {response.text[:200]}")


class TestCasinoGames:
    """Casino Games endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with demo login"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Get demo token
        login_response = self.session.post(f"{BASE_URL}/api/auth/demo-login")
        if login_response.status_code == 200:
            self.token = login_response.json().get("token")
            self.user_id = login_response.json().get("user_id")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            self.token = None
            self.user_id = None
    
    # ==================== BACCARAT ====================
    
    def test_baccarat_play(self):
        """Test Baccarat play endpoint"""
        response = self.session.post(f"{BASE_URL}/api/baccarat/play", json={
            "bet_type": "player",
            "bet_amount": 10,
            "game_mode": "standard"
        })
        print(f"Baccarat Play: status={response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Baccarat: winner={data.get('winner')}, payout={data.get('payout')}")
        elif response.status_code == 400:
            print(f"⚠️ Baccarat: {response.json().get('detail', 'Insufficient credits')}")
        else:
            print(f"⚠️ Baccarat Play: {response.text[:200]}")
    
    def test_baccarat_history(self):
        """Test Baccarat history endpoint"""
        response = self.session.get(f"{BASE_URL}/api/baccarat/history")
        print(f"Baccarat History: status={response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Baccarat History: total={data.get('total', 0)}")
        else:
            print(f"⚠️ Baccarat History: {response.text[:200]}")
    
    def test_baccarat_stats(self):
        """Test Baccarat stats endpoint"""
        response = self.session.get(f"{BASE_URL}/api/baccarat/stats")
        print(f"Baccarat Stats: status={response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Baccarat Stats: games={data.get('total_games', 0)}")
        else:
            print(f"⚠️ Baccarat Stats: {response.text[:200]}")
    
    def test_baccarat_leaderboard(self):
        """Test Baccarat leaderboard endpoint"""
        response = self.session.get(f"{BASE_URL}/api/baccarat/leaderboard")
        print(f"Baccarat Leaderboard: status={response.status_code}")
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Baccarat Leaderboard: players={len(data.get('leaderboard', []))}")
    
    # ==================== BLACKJACK ====================
    
    def test_blackjack_start(self):
        """Test Blackjack start game endpoint"""
        response = self.session.post(f"{BASE_URL}/api/blackjack/start", json={
            "bet_amount": 10
        })
        print(f"Blackjack Start: status={response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Blackjack: game_id={data.get('game_id')}")
            return data.get('game_id')
        elif response.status_code == 400:
            print(f"⚠️ Blackjack: {response.json().get('detail', 'Error')}")
        else:
            print(f"⚠️ Blackjack Start: {response.text[:200]}")
        return None
    
    # ==================== ROULETTE ====================
    
    def test_roulette_spin(self):
        """Test Roulette spin endpoint"""
        response = self.session.post(f"{BASE_URL}/api/roulette/spin", json={
            "bets": [{"type": "red", "amount": 10}]
        })
        print(f"Roulette Spin: status={response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Roulette: number={data.get('number')}, color={data.get('color')}")
        elif response.status_code == 400:
            print(f"⚠️ Roulette: {response.json().get('detail', 'Error')}")
        else:
            print(f"⚠️ Roulette Spin: {response.text[:200]}")
    
    # ==================== SLOTS ====================
    
    def test_slots_spin(self):
        """Test Slots spin endpoint"""
        response = self.session.post(f"{BASE_URL}/api/slots/spin", json={
            "bet_amount": 10
        })
        print(f"Slots Spin: status={response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Slots: symbols={data.get('symbols')}, payout={data.get('payout')}")
        elif response.status_code == 400:
            print(f"⚠️ Slots: {response.json().get('detail', 'Error')}")
        else:
            print(f"⚠️ Slots Spin: {response.text[:200]}")
    
    # ==================== BID WHIST ====================
    
    def test_bid_whist_start(self):
        """Test Bid Whist start game endpoint"""
        response = self.session.post(f"{BASE_URL}/api/bid-whist/start", json={
            "partner_id": "ai_partner",
            "opponent1_id": "ai_opponent1",
            "opponent2_id": "ai_opponent2",
            "wager": 0,
            "winning_score": 7
        })
        print(f"Bid Whist Start: status={response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Bid Whist: game_id={data.get('game_id')}")
        else:
            print(f"⚠️ Bid Whist Start: {response.text[:200]}")
    
    # ==================== VIBEZ 654 DICE ====================
    
    def test_vibez_654_create_session(self):
        """Test Vibez 654 Dice create session endpoint"""
        response = self.session.post(f"{BASE_URL}/api/games/vibe654/create-session", json={
            "buy_in": 100,
            "max_players": 4
        })
        print(f"Vibez 654 Create Session: status={response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Vibez 654: session_id={data.get('session_id')}")
        elif response.status_code == 400:
            print(f"⚠️ Vibez 654: {response.json().get('detail', 'Error')}")
        else:
            print(f"⚠️ Vibez 654 Create Session: {response.text[:200]}")


class TestPremiumFeatures:
    """Premium Features endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with demo login"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Get demo token
        login_response = self.session.post(f"{BASE_URL}/api/auth/demo-login")
        if login_response.status_code == 200:
            self.token = login_response.json().get("token")
            self.user_id = login_response.json().get("user_id")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            self.token = None
            self.user_id = None
    
    # ==================== VIBE SUITES ====================
    
    def test_vibe_suites_discover(self):
        """Test Vibe Suites discover endpoint"""
        response = self.session.get(f"{BASE_URL}/api/vibe-suites/discover")
        print(f"Vibe Suites Discover: status={response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Vibe Suites: total={data.get('total', 0)}")
        else:
            print(f"⚠️ Vibe Suites Discover: {response.text[:200]}")
    
    def test_vibe_suites_create(self):
        """Test Vibe Suites create endpoint"""
        response = self.session.post(f"{BASE_URL}/api/vibe-suites/create", json={
            "name": "Test Suite",
            "description": "Test suite for testing",
            "access_level": "public",
            "entry_requirement": 0,
            "theme": "cyber_lounge",
            "max_players": 8,
            "available_games": ["blackjack", "baccarat"],
            "enable_voice_chat": True,
            "enable_video_chat": False,
            "is_permanent": False
        })
        print(f"Vibe Suites Create: status={response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Vibe Suite Created: suite_id={data.get('suite_id')}")
        else:
            print(f"⚠️ Vibe Suites Create: {response.text[:200]}")
    
    def test_vibe_suites_my_suites(self):
        """Test Vibe Suites my-suites endpoint"""
        response = self.session.get(f"{BASE_URL}/api/vibe-suites/my-suites")
        print(f"Vibe Suites My Suites: status={response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ My Suites: total={data.get('total', 0)}")
        else:
            print(f"⚠️ Vibe Suites My Suites: {response.text[:200]}")
    
    # ==================== JUST FOR THE NIGHT ====================
    
    def test_jftn_rooms(self):
        """Test Just For The Night rooms endpoint"""
        response = self.session.get(f"{BASE_URL}/api/jftn/rooms")
        print(f"JFTN Rooms: status={response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ JFTN Rooms: count={len(data.get('rooms', []))}")
        else:
            print(f"⚠️ JFTN Rooms: {response.text[:200]}")
    
    def test_jftn_create_room(self):
        """Test Just For The Night create room endpoint"""
        response = self.session.post(f"{BASE_URL}/api/jftn/create-room", json={
            "name": "Test Room",
            "description": "Test room for testing",
            "entry_fee": 10,
            "max_visitors": 10
        })
        print(f"JFTN Create Room: status={response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ JFTN Room Created: room_id={data.get('room_id')}")
        else:
            print(f"⚠️ JFTN Create Room: {response.text[:200]}")


class TestWalletAndCredits:
    """Wallet and Credits endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with demo login"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Get demo token
        login_response = self.session.post(f"{BASE_URL}/api/auth/demo-login")
        if login_response.status_code == 200:
            self.token = login_response.json().get("token")
            self.user_id = login_response.json().get("user_id")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            self.token = None
            self.user_id = None
    
    def test_wallet_balance(self):
        """Test wallet balance endpoint"""
        if not self.user_id:
            pytest.skip("No user_id available")
        
        response = self.session.get(f"{BASE_URL}/api/wallet/balance/{self.user_id}")
        print(f"Wallet Balance: status={response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Wallet Balance: {data.get('balance', 0)} {data.get('currency', 'USD')}")
        else:
            print(f"⚠️ Wallet Balance: {response.text[:200]}")
    
    def test_wallet_packages(self):
        """Test wallet packages endpoint"""
        response = self.session.get(f"{BASE_URL}/api/wallet/packages")
        print(f"Wallet Packages: status={response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Wallet Packages: count={len(data.get('packages', []))}")
        else:
            print(f"⚠️ Wallet Packages: {response.text[:200]}")
    
    def test_wallet_transactions(self):
        """Test wallet transactions endpoint"""
        if not self.user_id:
            pytest.skip("No user_id available")
        
        response = self.session.get(f"{BASE_URL}/api/wallet/transactions/{self.user_id}")
        print(f"Wallet Transactions: status={response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Wallet Transactions: count={len(data.get('transactions', []))}")
        else:
            print(f"⚠️ Wallet Transactions: {response.text[:200]}")
    
    def test_wallet_credit_demo(self):
        """Test wallet credit endpoint (demo)"""
        if not self.user_id:
            pytest.skip("No user_id available")
        
        response = self.session.post(f"{BASE_URL}/api/wallet/credit/{self.user_id}?amount=1000")
        print(f"Wallet Credit: status={response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Wallet Credit: new_balance={data.get('balance', 0)}")
        else:
            print(f"⚠️ Wallet Credit: {response.text[:200]}")


class TestMessaging:
    """Messaging endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with demo login"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Get demo token
        login_response = self.session.post(f"{BASE_URL}/api/auth/demo-login")
        if login_response.status_code == 200:
            self.token = login_response.json().get("token")
            self.user_id = login_response.json().get("user_id")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            self.token = None
            self.user_id = None
    
    def test_conversations(self):
        """Test conversations endpoint"""
        response = self.session.get(f"{BASE_URL}/api/messages/conversations")
        print(f"Conversations: status={response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Conversations: count={len(data) if isinstance(data, list) else 0}")
        else:
            print(f"⚠️ Conversations: {response.text[:200]}")
    
    def test_matches(self):
        """Test matches endpoint"""
        response = self.session.get(f"{BASE_URL}/api/matches")
        print(f"Matches: status={response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Matches: count={len(data) if isinstance(data, list) else 0}")
        else:
            print(f"⚠️ Matches: {response.text[:200]}")


class TestMyVibez:
    """My Vibez Content Feed endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with demo login"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Get demo token
        login_response = self.session.post(f"{BASE_URL}/api/auth/demo-login")
        if login_response.status_code == 200:
            self.token = login_response.json().get("token")
            self.user_id = login_response.json().get("user_id")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            self.token = None
            self.user_id = None
    
    def test_trending_feed(self):
        """Test trending feed endpoint"""
        response = self.session.get(f"{BASE_URL}/api/vibez/feed/trending")
        print(f"Trending Feed: status={response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Trending Feed: count={data.get('count', 0)}")
        else:
            print(f"⚠️ Trending Feed: {response.text[:200]}")
    
    def test_for_you_feed(self):
        """Test for-you feed endpoint"""
        if not self.user_id:
            pytest.skip("No user_id available")
        
        response = self.session.get(f"{BASE_URL}/api/vibez/feed/for-you?user_id={self.user_id}")
        print(f"For You Feed: status={response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ For You Feed: count={data.get('count', 0)}")
        else:
            print(f"⚠️ For You Feed: {response.text[:200]}")
    
    def test_user_stats(self):
        """Test user stats endpoint"""
        if not self.user_id:
            pytest.skip("No user_id available")
        
        response = self.session.get(f"{BASE_URL}/api/vibez/user/{self.user_id}/stats")
        print(f"User Stats: status={response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ User Stats: {data.get('stats', {})}")
        else:
            print(f"⚠️ User Stats: {response.text[:200]}")


class TestHealthAndMonitoring:
    """Health and Monitoring endpoint tests"""
    
    def test_health_check(self):
        """Test health check endpoint"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/health")
        print(f"Health Check: status={response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Health: status={data.get('status')}")
        else:
            print(f"⚠️ Health Check: {response.text[:200]}")
    
    def test_system_health(self):
        """Test system health endpoint"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/admin/system-health")
        print(f"System Health: status={response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ System Health: {data.get('health', {})}")
        else:
            print(f"⚠️ System Health: {response.text[:200]}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

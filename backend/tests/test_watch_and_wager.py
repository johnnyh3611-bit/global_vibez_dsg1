"""
Watch-and-Wager Betting System & Coin Economy Tests
Tests for: Coin balance, daily bonus, game win awards, betting pools, place bets, 
community odds calculation, bet settlement, my bets history, active pools
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Constants from the system
STARTING_BALANCE = 2000  # 2,000 coins = $1
DAILY_LOGIN_BONUS = 100
PRACTICE_GAME_WIN = 0  # No coins for practice
MULTIPLAYER_GAME_WIN = 100
TOURNAMENT_WIN = 500
MIN_BET = 50
MAX_BET = 100
HOUSE_EDGE = 5  # 5%
COINS_PER_DOLLAR = 2000


class TestCoinEconomy:
    """Tests for coin balance, daily bonus, and game win awards"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create a test user for each test"""
        self.session = requests.Session()
        # Create unique test user
        response = self.session.post(f"{BASE_URL}/api/auth/test-user")
        assert response.status_code == 200, f"Failed to create test user: {response.text}"
        data = response.json()
        self.user_id = data["user_id"]
        self.session_token = data["session_token"]
        self.session.cookies.set("session_token", self.session_token)
        yield
        # Cleanup handled by test user expiry
    
    def test_get_balance_initializes_2000_coins(self):
        """GET /api/coins/balance should initialize new user with 2,000 coins"""
        response = self.session.get(f"{BASE_URL}/api/coins/balance")
        assert response.status_code == 200, f"Failed to get balance: {response.text}"
        
        data = response.json()
        assert "coins" in data, "Response should contain 'coins' field"
        assert "user_id" in data, "Response should contain 'user_id' field"
        assert "lifetime_earned" in data, "Response should contain 'lifetime_earned' field"
        assert "lifetime_spent" in data, "Response should contain 'lifetime_spent' field"
        
        # CRITICAL: Starting balance should be 2,000 coins (not 1,000)
        assert data["coins"] == STARTING_BALANCE, f"Expected {STARTING_BALANCE} starting coins, got {data['coins']}"
        print(f"✓ User initialized with {data['coins']} coins (${data['coins']/COINS_PER_DOLLAR:.2f})")
    
    def test_daily_bonus_awards_100_coins(self):
        """POST /api/coins/daily-bonus should award 100 coins"""
        # Get initial balance
        balance_response = self.session.get(f"{BASE_URL}/api/coins/balance")
        initial_balance = balance_response.json()["coins"]
        
        # Claim daily bonus
        response = self.session.post(f"{BASE_URL}/api/coins/daily-bonus")
        assert response.status_code == 200, f"Failed to claim daily bonus: {response.text}"
        
        data = response.json()
        assert "coins_earned" in data, "Response should contain 'coins_earned'"
        assert "new_balance" in data, "Response should contain 'new_balance'"
        assert data["coins_earned"] == DAILY_LOGIN_BONUS, f"Expected {DAILY_LOGIN_BONUS} coins, got {data['coins_earned']}"
        assert data["new_balance"] == initial_balance + DAILY_LOGIN_BONUS, "New balance should be initial + bonus"
        print(f"✓ Daily bonus awarded: +{data['coins_earned']} coins, new balance: {data['new_balance']}")
    
    def test_daily_bonus_rejects_duplicate_claim(self):
        """POST /api/coins/daily-bonus should reject second claim same day"""
        # First claim
        response1 = self.session.post(f"{BASE_URL}/api/coins/daily-bonus")
        assert response1.status_code == 200, "First claim should succeed"
        
        # Second claim should fail
        response2 = self.session.post(f"{BASE_URL}/api/coins/daily-bonus")
        assert response2.status_code == 400, f"Second claim should fail with 400, got {response2.status_code}"
        
        data = response2.json()
        assert "already claimed" in data.get("detail", "").lower(), "Error should mention already claimed"
        print("✓ Duplicate daily bonus claim correctly rejected")
    
    def test_practice_game_win_awards_0_coins(self):
        """POST /api/coins/award-game-win with practice type should award 0 coins"""
        # Get initial balance
        balance_response = self.session.get(f"{BASE_URL}/api/coins/balance")
        initial_balance = balance_response.json()["coins"]
        
        # Award practice game win
        game_id = f"test_game_{uuid.uuid4().hex[:8]}"
        response = self.session.post(
            f"{BASE_URL}/api/coins/award-game-win",
            params={"game_type": "practice", "game_id": game_id}
        )
        assert response.status_code == 200, f"Failed to award game win: {response.text}"
        
        data = response.json()
        assert data["coins_earned"] == PRACTICE_GAME_WIN, f"Practice should award {PRACTICE_GAME_WIN} coins, got {data['coins_earned']}"
        assert data["new_balance"] == initial_balance, "Balance should not change for practice"
        print(f"✓ Practice game win correctly awards {data['coins_earned']} coins")
    
    def test_multiplayer_game_win_awards_100_coins(self):
        """POST /api/coins/award-game-win with multiplayer type should award 100 coins"""
        # Get initial balance
        balance_response = self.session.get(f"{BASE_URL}/api/coins/balance")
        initial_balance = balance_response.json()["coins"]
        
        # Award multiplayer game win
        game_id = f"test_game_{uuid.uuid4().hex[:8]}"
        response = self.session.post(
            f"{BASE_URL}/api/coins/award-game-win",
            params={"game_type": "multiplayer", "game_id": game_id}
        )
        assert response.status_code == 200, f"Failed to award game win: {response.text}"
        
        data = response.json()
        assert data["coins_earned"] == MULTIPLAYER_GAME_WIN, f"Multiplayer should award {MULTIPLAYER_GAME_WIN} coins, got {data['coins_earned']}"
        assert data["new_balance"] == initial_balance + MULTIPLAYER_GAME_WIN, "Balance should increase by 100"
        print(f"✓ Multiplayer game win correctly awards {data['coins_earned']} coins")
    
    def test_tournament_win_awards_500_coins(self):
        """POST /api/coins/award-game-win with tournament type should award 500 coins"""
        # Get initial balance
        balance_response = self.session.get(f"{BASE_URL}/api/coins/balance")
        initial_balance = balance_response.json()["coins"]
        
        # Award tournament win
        game_id = f"test_game_{uuid.uuid4().hex[:8]}"
        response = self.session.post(
            f"{BASE_URL}/api/coins/award-game-win",
            params={"game_type": "tournament", "game_id": game_id}
        )
        assert response.status_code == 200, f"Failed to award game win: {response.text}"
        
        data = response.json()
        assert data["coins_earned"] == TOURNAMENT_WIN, f"Tournament should award {TOURNAMENT_WIN} coins, got {data['coins_earned']}"
        assert data["new_balance"] == initial_balance + TOURNAMENT_WIN, "Balance should increase by 500"
        print(f"✓ Tournament win correctly awards {data['coins_earned']} coins")
    
    def test_get_transactions_returns_history(self):
        """GET /api/coins/transactions should return transaction history"""
        # First make some transactions
        self.session.post(f"{BASE_URL}/api/coins/daily-bonus")
        game_id = f"test_game_{uuid.uuid4().hex[:8]}"
        self.session.post(
            f"{BASE_URL}/api/coins/award-game-win",
            params={"game_type": "multiplayer", "game_id": game_id}
        )
        
        # Get transactions
        response = self.session.get(f"{BASE_URL}/api/coins/transactions")
        assert response.status_code == 200, f"Failed to get transactions: {response.text}"
        
        data = response.json()
        assert "transactions" in data, "Response should contain 'transactions'"
        assert len(data["transactions"]) >= 2, "Should have at least 2 transactions"
        
        # Check transaction structure
        tx = data["transactions"][0]
        assert "transaction_id" in tx, "Transaction should have ID"
        assert "amount" in tx, "Transaction should have amount"
        assert "transaction_type" in tx, "Transaction should have type"
        assert "description" in tx, "Transaction should have description"
        print(f"✓ Transaction history returned {len(data['transactions'])} transactions")
    
    def test_leaderboard_returns_top_earners(self):
        """GET /api/coins/leaderboard should return top earners"""
        response = self.session.get(f"{BASE_URL}/api/coins/leaderboard")
        assert response.status_code == 200, f"Failed to get leaderboard: {response.text}"
        
        data = response.json()
        assert "leaderboard" in data, "Response should contain 'leaderboard'"
        print(f"✓ Leaderboard returned {len(data['leaderboard'])} users")


class TestBettingPools:
    """Tests for creating and managing betting pools"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create a test user for each test"""
        self.session = requests.Session()
        response = self.session.post(f"{BASE_URL}/api/auth/test-user")
        assert response.status_code == 200, f"Failed to create test user: {response.text}"
        data = response.json()
        self.user_id = data["user_id"]
        self.session_token = data["session_token"]
        self.session.cookies.set("session_token", self.session_token)
        yield
    
    def test_create_betting_pool(self):
        """POST /api/watch-and-wager/create-pool should create pool with equal 2.0x odds"""
        game_id = f"test_pool_{uuid.uuid4().hex[:8]}"
        
        # Note: This endpoint uses query parameters, not JSON body
        response = self.session.post(
            f"{BASE_URL}/api/watch-and-wager/create-pool",
            params={
                "game_id": game_id,
                "game_type": "multiplayer",
                "possible_outcomes": ["Player A", "Player B"]
            }
        )
        assert response.status_code == 200, f"Failed to create pool: {response.text}"
        
        data = response.json()
        assert "pool" in data, "Response should contain 'pool'"
        pool = data["pool"]
        
        # Verify pool structure
        assert pool["game_id"] == game_id, "Pool should have correct game_id"
        assert pool["game_type"] == "multiplayer", "Pool should have correct game_type"
        assert pool["status"] == "open", "Pool should be open"
        assert pool["total_pool"] == 0, "New pool should have 0 total"
        assert pool["bet_count"] == 0, "New pool should have 0 bets"
        assert pool["house_edge_percent"] == HOUSE_EDGE, f"House edge should be {HOUSE_EDGE}%"
        
        # Verify equal starting odds
        assert "current_odds" in pool, "Pool should have current_odds"
        for outcome, odds in pool["current_odds"].items():
            assert odds == 2.0, f"Starting odds should be 2.0x, got {odds}x for {outcome}"
        
        print("✓ Betting pool created with equal 2.0x odds for all outcomes")
    
    def test_get_pool_returns_pool_data(self):
        """GET /api/watch-and-wager/pool/{game_id} should return pool data"""
        # First create a pool
        game_id = f"test_pool_{uuid.uuid4().hex[:8]}"
        self.session.post(
            f"{BASE_URL}/api/watch-and-wager/create-pool",
            params={
                "game_id": game_id,
                "game_type": "multiplayer",
                "possible_outcomes": ["Player A", "Player B"]
            }
        )
        
        # Get pool
        response = self.session.get(f"{BASE_URL}/api/watch-and-wager/pool/{game_id}")
        assert response.status_code == 200, f"Failed to get pool: {response.text}"
        
        data = response.json()
        assert "pool" in data, "Response should contain 'pool'"
        assert "total_bets" in data, "Response should contain 'total_bets'"
        assert data["pool"]["game_id"] == game_id, "Pool should have correct game_id"
        print("✓ Pool data retrieved successfully")
    
    def test_get_nonexistent_pool_returns_404(self):
        """GET /api/watch-and-wager/pool/{game_id} should return 404 for nonexistent pool"""
        response = self.session.get(f"{BASE_URL}/api/watch-and-wager/pool/nonexistent_pool_12345")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Nonexistent pool correctly returns 404")
    
    def test_active_pools_returns_open_pools(self):
        """GET /api/watch-and-wager/active-pools should return only open pools"""
        # Create a pool
        game_id = f"test_pool_{uuid.uuid4().hex[:8]}"
        self.session.post(
            f"{BASE_URL}/api/watch-and-wager/create-pool",
            params={
                "game_id": game_id,
                "game_type": "multiplayer",
                "possible_outcomes": ["Player A", "Player B"]
            }
        )
        
        # Get active pools
        response = self.session.get(f"{BASE_URL}/api/watch-and-wager/active-pools")
        assert response.status_code == 200, f"Failed to get active pools: {response.text}"
        
        data = response.json()
        assert "pools" in data, "Response should contain 'pools'"
        
        # All returned pools should be open
        for pool in data["pools"]:
            assert pool["status"] == "open", f"Active pool should be open, got {pool['status']}"
        
        print(f"✓ Active pools returned {len(data['pools'])} open pools")
    
    def test_active_pools_filter_by_game_type(self):
        """GET /api/watch-and-wager/active-pools?game_type=multiplayer should filter by type"""
        # Create pools of different types
        mp_game_id = f"test_mp_{uuid.uuid4().hex[:8]}"
        self.session.post(
            f"{BASE_URL}/api/watch-and-wager/create-pool",
            params={
                "game_id": mp_game_id,
                "game_type": "multiplayer",
                "possible_outcomes": ["Player A", "Player B"]
            }
        )
        
        # Get filtered pools
        response = self.session.get(f"{BASE_URL}/api/watch-and-wager/active-pools?game_type=multiplayer")
        assert response.status_code == 200, f"Failed to get filtered pools: {response.text}"
        
        data = response.json()
        for pool in data["pools"]:
            assert pool["game_type"] == "multiplayer", f"Filtered pool should be multiplayer, got {pool['game_type']}"
        
        print("✓ Active pools correctly filtered by game_type")


class TestPlaceBet:
    """Tests for placing bets and odds calculation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create a test user and betting pool for each test"""
        self.session = requests.Session()
        response = self.session.post(f"{BASE_URL}/api/auth/test-user")
        assert response.status_code == 200, f"Failed to create test user: {response.text}"
        data = response.json()
        self.user_id = data["user_id"]
        self.session_token = data["session_token"]
        self.session.cookies.set("session_token", self.session_token)
        
        # Create a betting pool
        self.game_id = f"test_bet_{uuid.uuid4().hex[:8]}"
        self.session.post(
            f"{BASE_URL}/api/watch-and-wager/create-pool",
            params={
                "game_id": self.game_id,
                "game_type": "multiplayer",
                "possible_outcomes": ["Player A", "Player B"]
            }
        )
        yield
    
    def test_place_bet_success(self):
        """POST /api/watch-and-wager/place-bet should place bet and deduct coins"""
        # Get initial balance
        balance_response = self.session.get(f"{BASE_URL}/api/coins/balance")
        initial_balance = balance_response.json()["coins"]
        
        bet_amount = 50
        response = self.session.post(
            f"{BASE_URL}/api/watch-and-wager/place-bet",
            json={
                "game_id": self.game_id,
                "game_type": "multiplayer",
                "prediction": "Player A",
                "amount": bet_amount
            }
        )
        assert response.status_code == 200, f"Failed to place bet: {response.text}"
        
        data = response.json()
        assert "bet" in data, "Response should contain 'bet'"
        assert "new_balance" in data, "Response should contain 'new_balance'"
        assert "updated_odds" in data, "Response should contain 'updated_odds'"
        
        # Verify bet details
        bet = data["bet"]
        assert bet["amount"] == bet_amount, f"Bet amount should be {bet_amount}"
        assert bet["prediction"] == "Player A", "Prediction should be Player A"
        assert bet["status"] == "pending", "Bet status should be pending"
        assert "odds" in bet, "Bet should have odds"
        assert "potential_payout" in bet, "Bet should have potential_payout"
        
        # Verify balance deducted
        assert data["new_balance"] == initial_balance - bet_amount, "Balance should be deducted"
        
        print(f"✓ Bet placed: {bet_amount} coins on Player A at {bet['odds']}x odds")
    
    def test_place_bet_validates_min_amount(self):
        """POST /api/watch-and-wager/place-bet should reject bet below minimum"""
        response = self.session.post(
            f"{BASE_URL}/api/watch-and-wager/place-bet",
            json={
                "game_id": self.game_id,
                "game_type": "multiplayer",
                "prediction": "Player A",
                "amount": MIN_BET - 1  # Below minimum
            }
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "minimum" in response.json().get("detail", "").lower(), "Error should mention minimum"
        print(f"✓ Bet below minimum ({MIN_BET} coins) correctly rejected")
    
    def test_place_bet_validates_max_amount(self):
        """POST /api/watch-and-wager/place-bet should reject bet above maximum"""
        response = self.session.post(
            f"{BASE_URL}/api/watch-and-wager/place-bet",
            json={
                "game_id": self.game_id,
                "game_type": "multiplayer",
                "prediction": "Player A",
                "amount": MAX_BET + 1  # Above maximum
            }
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "maximum" in response.json().get("detail", "").lower(), "Error should mention maximum"
        print(f"✓ Bet above maximum ({MAX_BET} coins) correctly rejected")
    
    def test_place_bet_validates_sufficient_balance(self):
        """POST /api/watch-and-wager/place-bet should reject bet with insufficient balance"""
        # First spend most of the balance
        for i in range(20):  # 20 bets of 100 = 2000 coins
            game_id = f"test_drain_{uuid.uuid4().hex[:8]}"
            self.session.post(
                f"{BASE_URL}/api/watch-and-wager/create-pool",
                params={
                    "game_id": game_id,
                    "game_type": "multiplayer",
                    "possible_outcomes": ["Player A", "Player B"]
                }
            )
            self.session.post(
                f"{BASE_URL}/api/watch-and-wager/place-bet",
                json={
                    "game_id": game_id,
                    "game_type": "multiplayer",
                    "prediction": "Player A",
                    "amount": MAX_BET
                }
            )
        
        # Now try to bet more than remaining balance
        new_game_id = f"test_insufficient_{uuid.uuid4().hex[:8]}"
        self.session.post(
            f"{BASE_URL}/api/watch-and-wager/create-pool",
            params={
                "game_id": new_game_id,
                "game_type": "multiplayer",
                "possible_outcomes": ["Player A", "Player B"]
            }
        )
        
        response = self.session.post(
            f"{BASE_URL}/api/watch-and-wager/place-bet",
            json={
                "game_id": new_game_id,
                "game_type": "multiplayer",
                "prediction": "Player A",
                "amount": MAX_BET
            }
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "insufficient" in response.json().get("detail", "").lower(), "Error should mention insufficient"
        print("✓ Bet with insufficient balance correctly rejected")
    
    def test_place_bet_rejects_duplicate_bet_on_same_game(self):
        """POST /api/watch-and-wager/place-bet should reject second bet on same game"""
        # First bet
        response1 = self.session.post(
            f"{BASE_URL}/api/watch-and-wager/place-bet",
            json={
                "game_id": self.game_id,
                "game_type": "multiplayer",
                "prediction": "Player A",
                "amount": 50
            }
        )
        assert response1.status_code == 200, "First bet should succeed"
        
        # Second bet on same game
        response2 = self.session.post(
            f"{BASE_URL}/api/watch-and-wager/place-bet",
            json={
                "game_id": self.game_id,
                "game_type": "multiplayer",
                "prediction": "Player B",
                "amount": 50
            }
        )
        assert response2.status_code == 400, f"Expected 400, got {response2.status_code}"
        assert "already" in response2.json().get("detail", "").lower(), "Error should mention already bet"
        print("✓ Duplicate bet on same game correctly rejected")


class TestCommunityOdds:
    """Tests for parimutuel odds calculation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create test users and betting pool"""
        self.sessions = []
        self.user_ids = []
        
        # Create 3 test users
        for i in range(3):
            session = requests.Session()
            response = session.post(f"{BASE_URL}/api/auth/test-user")
            assert response.status_code == 200, f"Failed to create test user {i}: {response.text}"
            data = response.json()
            session.cookies.set("session_token", data["session_token"])
            self.sessions.append(session)
            self.user_ids.append(data["user_id"])
        
        # Create a betting pool
        self.game_id = f"test_odds_{uuid.uuid4().hex[:8]}"
        self.sessions[0].post(
            f"{BASE_URL}/api/watch-and-wager/create-pool",
            params={
                "game_id": self.game_id,
                "game_type": "multiplayer",
                "possible_outcomes": ["Player A", "Player B"]
            }
        )
        yield
    
    def test_odds_recalculate_after_bet(self):
        """Odds should recalculate after each bet (parimutuel system)"""
        # User 1 bets 70 on Player A
        response1 = self.sessions[0].post(
            f"{BASE_URL}/api/watch-and-wager/place-bet",
            json={
                "game_id": self.game_id,
                "game_type": "multiplayer",
                "prediction": "Player A",
                "amount": 70
            }
        )
        assert response1.status_code == 200
        odds_after_bet1 = response1.json()["updated_odds"]
        
        # User 2 bets 30 on Player B
        response2 = self.sessions[1].post(
            f"{BASE_URL}/api/watch-and-wager/place-bet",
            json={
                "game_id": self.game_id,
                "game_type": "multiplayer",
                "prediction": "Player B",
                "amount": 30
            }
        )
        assert response2.status_code == 200
        odds_after_bet2 = response2.json()["updated_odds"]
        
        # Verify odds changed
        # Total pool: 100 coins
        # Prize pool after 5% house edge: 95 coins
        # Player A: 70 coins bet -> odds = 95/70 = 1.36x
        # Player B: 30 coins bet -> odds = 95/30 = 3.17x
        
        pool_response = self.sessions[0].get(f"{BASE_URL}/api/watch-and-wager/pool/{self.game_id}")
        pool = pool_response.json()["pool"]
        
        assert pool["total_pool"] == 100, f"Total pool should be 100, got {pool['total_pool']}"
        assert pool["prize_pool"] == 95, f"Prize pool should be 95 (after 5% house edge), got {pool['prize_pool']}"
        
        # Check odds are approximately correct (allowing for rounding)
        odds_a = pool["current_odds"]["Player A"]
        odds_b = pool["current_odds"]["Player B"]
        
        assert 1.3 <= odds_a <= 1.4, f"Player A odds should be ~1.36x, got {odds_a}x"
        assert 3.1 <= odds_b <= 3.2, f"Player B odds should be ~3.17x, got {odds_b}x"
        
        print("✓ Community odds calculated correctly:")
        print(f"  - Total pool: {pool['total_pool']} coins")
        print(f"  - Prize pool: {pool['prize_pool']} coins (after 5% house edge)")
        print(f"  - Player A (70 coins): {odds_a}x odds")
        print(f"  - Player B (30 coins): {odds_b}x odds")
    
    def test_all_bets_on_one_side_gives_max_odds_to_other(self):
        """When all bets are on one side, other side should get max odds (10.0x)"""
        # All users bet on Player A
        for i, session in enumerate(self.sessions):
            response = session.post(
                f"{BASE_URL}/api/watch-and-wager/place-bet",
                json={
                    "game_id": self.game_id,
                    "game_type": "multiplayer",
                    "prediction": "Player A",
                    "amount": 50
                }
            )
            assert response.status_code == 200, f"User {i} bet failed: {response.text}"
        
        # Check odds
        pool_response = self.sessions[0].get(f"{BASE_URL}/api/watch-and-wager/pool/{self.game_id}")
        pool = pool_response.json()["pool"]
        
        odds_b = pool["current_odds"]["Player B"]
        assert odds_b == 10.0, f"Player B (no bets) should have max odds 10.0x, got {odds_b}x"
        
        print(f"✓ No bets on Player B correctly gives max odds: {odds_b}x")


class TestBetSettlement:
    """Tests for settling bets and distributing winnings"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create test users and betting pool with bets"""
        self.sessions = []
        self.user_ids = []
        
        # Create 2 test users
        for i in range(2):
            session = requests.Session()
            response = session.post(f"{BASE_URL}/api/auth/test-user")
            assert response.status_code == 200
            data = response.json()
            session.cookies.set("session_token", data["session_token"])
            self.sessions.append(session)
            self.user_ids.append(data["user_id"])
        
        # Create a betting pool
        self.game_id = f"test_settle_{uuid.uuid4().hex[:8]}"
        self.sessions[0].post(
            f"{BASE_URL}/api/watch-and-wager/create-pool",
            params={
                "game_id": self.game_id,
                "game_type": "multiplayer",
                "possible_outcomes": ["Player A", "Player B"]
            }
        )
        
        # User 1 bets on Player A
        self.sessions[0].post(
            f"{BASE_URL}/api/watch-and-wager/place-bet",
            json={
                "game_id": self.game_id,
                "game_type": "multiplayer",
                "prediction": "Player A",
                "amount": 50
            }
        )
        
        # User 2 bets on Player B
        self.sessions[1].post(
            f"{BASE_URL}/api/watch-and-wager/place-bet",
            json={
                "game_id": self.game_id,
                "game_type": "multiplayer",
                "prediction": "Player B",
                "amount": 50
            }
        )
        yield
    
    def test_settle_bets_distributes_winnings(self):
        """POST /api/watch-and-wager/settle-bets should distribute winnings to winners"""
        # Get balances before settlement
        balance1_before = self.sessions[0].get(f"{BASE_URL}/api/coins/balance").json()["coins"]
        balance2_before = self.sessions[1].get(f"{BASE_URL}/api/coins/balance").json()["coins"]
        
        # Settle bets - Player A wins
        response = self.sessions[0].post(
            f"{BASE_URL}/api/watch-and-wager/settle-bets/{self.game_id}",
            params={"winning_outcome": "Player A"}
        )
        assert response.status_code == 200, f"Failed to settle bets: {response.text}"
        
        data = response.json()
        assert "winners" in data, "Response should contain 'winners'"
        assert "losers" in data, "Response should contain 'losers'"
        assert "total_pool" in data, "Response should contain 'total_pool'"
        assert "prize_pool" in data, "Response should contain 'prize_pool'"
        assert "house_profit" in data, "Response should contain 'house_profit'"
        
        # Verify winner got payout
        assert len(data["winners"]) == 1, "Should have 1 winner"
        assert len(data["losers"]) == 1, "Should have 1 loser"
        
        winner = data["winners"][0]
        assert winner["user_id"] == self.user_ids[0], "User 1 should be winner"
        assert winner["payout"] > winner["bet_amount"], "Winner payout should be > bet amount"
        
        # Verify balances updated
        balance1_after = self.sessions[0].get(f"{BASE_URL}/api/coins/balance").json()["coins"]
        balance2_after = self.sessions[1].get(f"{BASE_URL}/api/coins/balance").json()["coins"]
        
        assert balance1_after > balance1_before, "Winner balance should increase"
        assert balance2_after == balance2_before, "Loser balance should not change (already deducted)"
        
        print("✓ Bets settled correctly:")
        print(f"  - Total pool: {data['total_pool']} coins")
        print(f"  - Prize pool: {data['prize_pool']} coins")
        print(f"  - House profit: {data['house_profit']} coins")
        print(f"  - Winner payout: {winner['payout']} coins (profit: {winner['profit']})")
    
    def test_settle_bets_marks_bet_status(self):
        """Settlement should mark bets as won/lost"""
        # Settle bets - Player A wins
        self.sessions[0].post(
            f"{BASE_URL}/api/watch-and-wager/settle-bets/{self.game_id}",
            params={"winning_outcome": "Player A"}
        )
        
        # Check User 1's bets (winner)
        bets1 = self.sessions[0].get(f"{BASE_URL}/api/watch-and-wager/my-bets").json()
        user1_bet = next((b for b in bets1["bets"] if b["game_id"] == self.game_id), None)
        assert user1_bet is not None, "User 1 should have bet"
        assert user1_bet["status"] == "won", f"User 1 bet should be 'won', got {user1_bet['status']}"
        
        # Check User 2's bets (loser)
        bets2 = self.sessions[1].get(f"{BASE_URL}/api/watch-and-wager/my-bets").json()
        user2_bet = next((b for b in bets2["bets"] if b["game_id"] == self.game_id), None)
        assert user2_bet is not None, "User 2 should have bet"
        assert user2_bet["status"] == "lost", f"User 2 bet should be 'lost', got {user2_bet['status']}"
        
        print("✓ Bet statuses correctly updated to won/lost")
    
    def test_settle_bets_rejects_already_settled(self):
        """Settlement should reject if already settled"""
        # First settlement
        response1 = self.sessions[0].post(
            f"{BASE_URL}/api/watch-and-wager/settle-bets/{self.game_id}",
            params={"winning_outcome": "Player A"}
        )
        assert response1.status_code == 200
        
        # Second settlement should fail
        response2 = self.sessions[0].post(
            f"{BASE_URL}/api/watch-and-wager/settle-bets/{self.game_id}",
            params={"winning_outcome": "Player A"}
        )
        assert response2.status_code == 400, f"Expected 400, got {response2.status_code}"
        assert "already settled" in response2.json().get("detail", "").lower()
        
        print("✓ Double settlement correctly rejected")


class TestMyBets:
    """Tests for user's betting history"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create a test user with some bets"""
        self.session = requests.Session()
        response = self.session.post(f"{BASE_URL}/api/auth/test-user")
        assert response.status_code == 200
        data = response.json()
        self.user_id = data["user_id"]
        self.session.cookies.set("session_token", data["session_token"])
        
        # Create some bets
        for i in range(3):
            game_id = f"test_mybets_{uuid.uuid4().hex[:8]}"
            self.session.post(
                f"{BASE_URL}/api/watch-and-wager/create-pool",
                params={
                    "game_id": game_id,
                    "game_type": "multiplayer",
                    "possible_outcomes": ["Player A", "Player B"]
                }
            )
            self.session.post(
                f"{BASE_URL}/api/watch-and-wager/place-bet",
                json={
                    "game_id": game_id,
                    "game_type": "multiplayer",
                    "prediction": "Player A",
                    "amount": 50
                }
            )
        yield
    
    def test_my_bets_returns_history_with_stats(self):
        """GET /api/watch-and-wager/my-bets should return history and stats"""
        response = self.session.get(f"{BASE_URL}/api/watch-and-wager/my-bets")
        assert response.status_code == 200, f"Failed to get my bets: {response.text}"
        
        data = response.json()
        assert "bets" in data, "Response should contain 'bets'"
        assert "stats" in data, "Response should contain 'stats'"
        
        # Verify bets
        assert len(data["bets"]) >= 3, f"Should have at least 3 bets, got {len(data['bets'])}"
        
        # Verify stats structure
        stats = data["stats"]
        assert "total_bets" in stats, "Stats should have total_bets"
        assert "wins" in stats, "Stats should have wins"
        assert "losses" in stats, "Stats should have losses"
        assert "pending" in stats, "Stats should have pending"
        assert "total_bet" in stats, "Stats should have total_bet"
        assert "total_won" in stats, "Stats should have total_won"
        assert "profit" in stats, "Stats should have profit"
        assert "win_rate" in stats, "Stats should have win_rate"
        
        print(f"✓ My bets returned {len(data['bets'])} bets with stats:")
        print(f"  - Total bets: {stats['total_bets']}")
        print(f"  - Pending: {stats['pending']}")
        print(f"  - Total bet: {stats['total_bet']} coins")
    
    def test_my_bets_filter_by_status(self):
        """GET /api/watch-and-wager/my-bets?status=pending should filter by status"""
        response = self.session.get(f"{BASE_URL}/api/watch-and-wager/my-bets?status=pending")
        assert response.status_code == 200
        
        data = response.json()
        for bet in data["bets"]:
            assert bet["status"] == "pending", f"Filtered bet should be pending, got {bet['status']}"
        
        print("✓ My bets correctly filtered by status=pending")


class TestAuthentication:
    """Tests for authentication requirements"""
    
    def test_balance_requires_auth(self):
        """GET /api/coins/balance should require authentication"""
        response = requests.get(f"{BASE_URL}/api/coins/balance")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Balance endpoint requires authentication")
    
    def test_place_bet_requires_auth(self):
        """POST /api/watch-and-wager/place-bet should require authentication"""
        response = requests.post(
            f"{BASE_URL}/api/watch-and-wager/place-bet",
            json={
                "game_id": "test",
                "game_type": "multiplayer",
                "prediction": "Player A",
                "amount": 50
            }
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Place bet endpoint requires authentication")
    
    def test_my_bets_requires_auth(self):
        """GET /api/watch-and-wager/my-bets should require authentication"""
        response = requests.get(f"{BASE_URL}/api/watch-and-wager/my-bets")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ My bets endpoint requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

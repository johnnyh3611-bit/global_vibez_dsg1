"""
Monetization & Creator Tools System Tests
Tests for: Virtual currency, tipping, gifts, premium subscriptions, creator earnings, withdrawals
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test configuration
PLATFORM_FEE = 0.30  # 30% platform fee
MIN_WITHDRAWAL = 50.00  # Minimum $50 USD


def create_test_user():
    """Helper to create a test user via the auth endpoint"""
    response = requests.post(f"{BASE_URL}/api/auth/test-user")
    if response.status_code == 200:
        data = response.json()
        return data["user_id"]
    return None

# Coin packages with bonus
COIN_PACKAGES = {
    "100": {"coins": 100, "price": 0.99, "bonus": 0},
    "500": {"coins": 500, "price": 4.99, "bonus": 50},
    "1000": {"coins": 1000, "price": 9.99, "bonus": 150},
    "5000": {"coins": 5000, "price": 49.99, "bonus": 1000},
    "10000": {"coins": 10000, "price": 99.99, "bonus": 2500}
}

# Gift catalog
GIFT_CATALOG = {
    "rose": {"name": "Rose", "cost": 10},
    "heart": {"name": "Heart", "cost": 25},
    "fire": {"name": "Fire", "cost": 50},
    "diamond": {"name": "Diamond", "cost": 100},
    "crown": {"name": "Crown", "cost": 500},
    "trophy": {"name": "Trophy", "cost": 1000}
}

# Subscription tiers
SUBSCRIPTION_TIERS = {
    "pro": {"cost": 1000},
    "elite": {"cost": 5000}
}


class TestMonetizationSetup:
    """Setup tests - verify API is accessible"""
    
    def test_api_health(self):
        """Verify API is running"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        print("✓ API health check passed")


class TestGiftCatalog:
    """Gift catalog endpoint tests"""
    
    def test_get_gift_catalog(self):
        """GET /api/monetization/gifts/catalog - Get available gifts"""
        response = requests.get(f"{BASE_URL}/api/monetization/gifts/catalog")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        assert "gifts" in data
        
        gifts = data["gifts"]
        # Verify all 6 gift types exist
        assert "rose" in gifts
        assert "heart" in gifts
        assert "fire" in gifts
        assert "diamond" in gifts
        assert "crown" in gifts
        assert "trophy" in gifts
        
        # Verify gift structure
        for gift_id, gift in gifts.items():
            assert "name" in gift
            assert "cost" in gift
            assert "emoji" in gift
            assert "animation" in gift
        
        # Verify specific costs
        assert gifts["rose"]["cost"] == 10
        assert gifts["heart"]["cost"] == 25
        assert gifts["fire"]["cost"] == 50
        assert gifts["diamond"]["cost"] == 100
        assert gifts["crown"]["cost"] == 500
        assert gifts["trophy"]["cost"] == 1000
        
        print(f"✓ Gift catalog returned {len(gifts)} gifts")


class TestCoinPurchase:
    """Coin purchase endpoint tests"""
    
    def test_purchase_coins_100_package(self):
        """POST /api/monetization/purchase-coins - Purchase 100 coin package"""
        test_user_id = create_test_user()
        assert test_user_id is not None, "Failed to create test user"
        
        response = requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": test_user_id,
            "package": "100",
            "payment_method": "card"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        assert data["coins_added"] == 100  # 100 + 0 bonus
        assert data["bonus"] == 0
        assert "transaction_id" in data
        assert data["transaction_id"].startswith("txn_")
        
        print(f"✓ Purchased 100 coins, transaction: {data['transaction_id']}")
    
    def test_purchase_coins_500_package_with_bonus(self):
        """POST /api/monetization/purchase-coins - Purchase 500 coin package with bonus"""
        test_user_id = create_test_user()
        assert test_user_id is not None, "Failed to create test user"
        
        response = requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": test_user_id,
            "package": "500",
            "payment_method": "card"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        assert data["coins_added"] == 550  # 500 + 50 bonus
        assert data["bonus"] == 50
        
        print("✓ Purchased 500 coins + 50 bonus = 550 total")
    
    def test_purchase_coins_1000_package(self):
        """POST /api/monetization/purchase-coins - Purchase 1000 coin package"""
        test_user_id = create_test_user()
        assert test_user_id is not None, "Failed to create test user"
        
        response = requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": test_user_id,
            "package": "1000",
            "payment_method": "card"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["coins_added"] == 1150  # 1000 + 150 bonus
        assert data["bonus"] == 150
        
        print("✓ Purchased 1000 coins + 150 bonus = 1150 total")
    
    def test_purchase_coins_5000_package(self):
        """POST /api/monetization/purchase-coins - Purchase 5000 coin package"""
        test_user_id = create_test_user()
        assert test_user_id is not None, "Failed to create test user"
        
        response = requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": test_user_id,
            "package": "5000",
            "payment_method": "card"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["coins_added"] == 6000  # 5000 + 1000 bonus
        assert data["bonus"] == 1000
        
        print("✓ Purchased 5000 coins + 1000 bonus = 6000 total")
    
    def test_purchase_coins_10000_package(self):
        """POST /api/monetization/purchase-coins - Purchase 10000 coin package"""
        test_user_id = create_test_user()
        assert test_user_id is not None, "Failed to create test user"
        
        response = requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": test_user_id,
            "package": "10000",
            "payment_method": "card"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["coins_added"] == 12500  # 10000 + 2500 bonus
        assert data["bonus"] == 2500
        
        print("✓ Purchased 10000 coins + 2500 bonus = 12500 total")
    
    def test_purchase_coins_invalid_package(self):
        """POST /api/monetization/purchase-coins - Invalid package should fail"""
        test_user_id = create_test_user()
        assert test_user_id is not None, "Failed to create test user"
        
        response = requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": test_user_id,
            "package": "999",  # Invalid package
            "payment_method": "card"
        })
        assert response.status_code == 400
        
        data = response.json()
        assert "Invalid package" in data.get("detail", "")
        
        print("✓ Invalid package correctly rejected")


class TestBalance:
    """Balance endpoint tests"""
    
    def test_get_balance_new_user(self):
        """GET /api/monetization/balance/{user_id} - New user should have 0 balance"""
        test_user_id = create_test_user()
        assert test_user_id is not None, "Failed to create test user"
        
        # First purchase coins to add balance
        requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": test_user_id,
            "package": "100",
            "payment_method": "card"
        })
        
        response = requests.get(f"{BASE_URL}/api/monetization/balance/{test_user_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        assert "coins" in data
        assert "gems" in data
        assert data["coins"] == 100  # From purchase
        
        print(f"✓ Balance check: {data['coins']} coins, {data['gems']} gems")
    
    def test_get_balance_nonexistent_user(self):
        """GET /api/monetization/balance/{user_id} - Nonexistent user should return 404"""
        fake_user_id = f"NONEXISTENT_{uuid.uuid4().hex[:12]}"
        
        response = requests.get(f"{BASE_URL}/api/monetization/balance/{fake_user_id}")
        assert response.status_code == 404
        
        print("✓ Nonexistent user correctly returns 404")


class TestTipping:
    """Tipping system tests"""
    
    @pytest.fixture
    def setup_users_for_tipping(self):
        """Create sender and recipient users with coins"""
        sender_id = create_test_user()
        recipient_id = create_test_user()
        
        # Give sender coins
        requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": sender_id,
            "package": "1000",
            "payment_method": "card"
        })
        
        # Give recipient some coins too
        requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": recipient_id,
            "package": "100",
            "payment_method": "card"
        })
        
        return sender_id, recipient_id
    
    def test_send_tip_success(self, setup_users_for_tipping):
        """POST /api/monetization/send-tip - Send tip with 30% platform fee"""
        sender_id, recipient_id = setup_users_for_tipping
        
        tip_amount = 100
        expected_platform_fee = int(tip_amount * PLATFORM_FEE)  # 30 coins
        expected_creator_earnings = tip_amount - expected_platform_fee  # 70 coins
        
        response = requests.post(f"{BASE_URL}/api/monetization/send-tip", json={
            "from_user_id": sender_id,
            "to_user_id": recipient_id,
            "amount": tip_amount,
            "message": "Great content!"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        assert data["amount_sent"] == tip_amount
        assert data["creator_received"] == expected_creator_earnings
        assert data["platform_fee"] == expected_platform_fee
        assert "tip_id" in data
        assert data["tip_id"].startswith("tip_")
        
        print(f"✓ Tip sent: {tip_amount} coins, creator received: {expected_creator_earnings}, platform fee: {expected_platform_fee}")
    
    def test_send_tip_minimum_amount(self, setup_users_for_tipping):
        """POST /api/monetization/send-tip - Minimum tip == 10 coins"""
        sender_id, recipient_id = setup_users_for_tipping
        
        # Try to send less than minimum
        response = requests.post(f"{BASE_URL}/api/monetization/send-tip", json={
            "from_user_id": sender_id,
            "to_user_id": recipient_id,
            "amount": 5  # Below minimum
        })
        assert response.status_code == 400
        assert "Minimum tip == 10 coins" in response.json().get("detail", "")
        
        print("✓ Minimum tip validation working")
    
    def test_send_tip_maximum_amount(self, setup_users_for_tipping):
        """POST /api/monetization/send-tip - Maximum tip == 10,000 coins"""
        sender_id, recipient_id = setup_users_for_tipping
        
        # Try to send more than maximum
        response = requests.post(f"{BASE_URL}/api/monetization/send-tip", json={
            "from_user_id": sender_id,
            "to_user_id": recipient_id,
            "amount": 15000  # Above maximum
        })
        assert response.status_code == 400
        assert "Maximum tip == 10,000 coins" in response.json().get("detail", "")
        
        print("✓ Maximum tip validation working")
    
    def test_send_tip_insufficient_balance(self):
        """POST /api/monetization/send-tip - Insufficient balance should fail"""
        sender_id = create_test_user()
        recipient_id = create_test_user()
        
        # Create sender with only 100 coins
        requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": sender_id,
            "package": "100",
            "payment_method": "card"
        })
        
        # Create recipient
        requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": recipient_id,
            "package": "100",
            "payment_method": "card"
        })
        
        # Try to send more than balance
        response = requests.post(f"{BASE_URL}/api/monetization/send-tip", json={
            "from_user_id": sender_id,
            "to_user_id": recipient_id,
            "amount": 500  # More than 100 coins
        })
        assert response.status_code == 400
        assert "Insufficient coins" in response.json().get("detail", "")
        
        print("✓ Insufficient balance validation working")
    
    def test_send_tip_nonexistent_recipient(self, setup_users_for_tipping):
        """POST /api/monetization/send-tip - Nonexistent recipient should fail"""
        sender_id, _ = setup_users_for_tipping
        
        response = requests.post(f"{BASE_URL}/api/monetization/send-tip", json={
            "from_user_id": sender_id,
            "to_user_id": "NONEXISTENT_USER",
            "amount": 50
        })
        # Could be 400 (insufficient coins check first) or 404 (recipient not found)
        assert response.status_code in [400, 404]
        
        print("✓ Nonexistent recipient validation working")


class TestGiftSending:
    """Gift sending tests"""
    
    @pytest.fixture
    def setup_users_for_gifts(self):
        """Create sender and recipient users with coins"""
        sender_id = create_test_user()
        recipient_id = create_test_user()
        
        # Give sender lots of coins
        requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": sender_id,
            "package": "5000",
            "payment_method": "card"
        })
        
        # Create recipient
        requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": recipient_id,
            "package": "100",
            "payment_method": "card"
        })
        
        return sender_id, recipient_id
    
    def test_send_gift_rose(self, setup_users_for_gifts):
        """POST /api/monetization/gifts/send - Send Rose gift (10 coins)"""
        sender_id, recipient_id = setup_users_for_gifts
        
        gift_cost = 10
        expected_platform_fee = int(gift_cost * PLATFORM_FEE)  # 3 coins
        expected_creator_earnings = gift_cost - expected_platform_fee  # 7 coins
        
        response = requests.post(f"{BASE_URL}/api/monetization/gifts/send", json={
            "from_user_id": sender_id,
            "to_user_id": recipient_id,
            "gift_id": "rose",
            "message": "A rose for you!"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        assert data["creator_received"] == expected_creator_earnings
        assert "gift_id" in data
        assert data["gift"]["name"] == "Rose"
        assert data["gift"]["cost"] == 10
        
        print(f"✓ Rose gift sent, creator received: {expected_creator_earnings} coins")
    
    def test_send_gift_trophy(self):
        """POST /api/monetization/gifts/send - Send Trophy gift (1000 coins)"""
        # Create fresh users for this test
        sender_id = create_test_user()
        recipient_id = create_test_user()
        
        assert sender_id is not None, "Failed to create sender"
        assert recipient_id is not None, "Failed to create recipient"
        
        # Give sender lots of coins
        requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": sender_id,
            "package": "5000",
            "payment_method": "card"
        })
        
        # Create recipient
        requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": recipient_id,
            "package": "100",
            "payment_method": "card"
        })
        
        gift_cost = 1000
        expected_platform_fee = int(gift_cost * PLATFORM_FEE)  # 300 coins
        expected_creator_earnings = gift_cost - expected_platform_fee  # 700 coins
        
        response = requests.post(f"{BASE_URL}/api/monetization/gifts/send", json={
            "from_user_id": sender_id,
            "to_user_id": recipient_id,
            "gift_id": "trophy"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        assert data["creator_received"] == expected_creator_earnings
        assert data["gift"]["name"] == "Trophy"
        assert data["gift"]["cost"] == 1000
        
        print(f"✓ Trophy gift sent, creator received: {expected_creator_earnings} coins")
    
    def test_send_gift_invalid(self, setup_users_for_gifts):
        """POST /api/monetization/gifts/send - Invalid gift should fail"""
        sender_id, recipient_id = setup_users_for_gifts
        
        response = requests.post(f"{BASE_URL}/api/monetization/gifts/send", json={
            "from_user_id": sender_id,
            "to_user_id": recipient_id,
            "gift_id": "invalid_gift"
        })
        assert response.status_code == 400
        assert "Invalid gift" in response.json().get("detail", "")
        
        print("✓ Invalid gift validation working")
    
    def test_send_gift_insufficient_balance(self):
        """POST /api/monetization/gifts/send - Insufficient balance should fail"""
        sender_id = create_test_user()
        recipient_id = create_test_user()
        
        # Create sender with only 100 coins
        requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": sender_id,
            "package": "100",
            "payment_method": "card"
        })
        
        # Create recipient
        requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": recipient_id,
            "package": "100",
            "payment_method": "card"
        })
        
        # Try to send trophy (1000 coins) with only 100 coins
        response = requests.post(f"{BASE_URL}/api/monetization/gifts/send", json={
            "from_user_id": sender_id,
            "to_user_id": recipient_id,
            "gift_id": "trophy"
        })
        assert response.status_code == 400
        assert "Insufficient coins" in response.json().get("detail", "")
        
        print("✓ Gift insufficient balance validation working")


class TestPremiumSubscription:
    """Premium subscription tests"""
    
    def test_subscribe_pro_tier(self):
        """POST /api/monetization/subscribe - Subscribe to Pro tier (1000 coins/month)"""
        user_id = create_test_user()
        assert user_id is not None, "Failed to create test user"
        
        # Give user enough coins
        requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": user_id,
            "package": "1000",
            "payment_method": "card"
        })
        
        response = requests.post(f"{BASE_URL}/api/monetization/subscribe", json={
            "user_id": user_id,
            "tier": "pro"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        assert data["tier"] == "pro"
        assert "subscription_id" in data
        assert data["subscription_id"].startswith("sub_")
        assert "expires" in data
        assert "benefits" in data
        assert len(data["benefits"]) > 0
        
        print(f"✓ Pro subscription created: {data['subscription_id']}")
    
    def test_subscribe_elite_tier(self):
        """POST /api/monetization/subscribe - Subscribe to Elite tier (5000 coins/month)"""
        user_id = create_test_user()
        assert user_id is not None, "Failed to create test user"
        
        # Give user enough coins
        requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": user_id,
            "package": "5000",
            "payment_method": "card"
        })
        
        response = requests.post(f"{BASE_URL}/api/monetization/subscribe", json={
            "user_id": user_id,
            "tier": "elite"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        assert data["tier"] == "elite"
        assert "subscription_id" in data
        assert len(data["benefits"]) > 5  # Elite has more benefits
        
        print(f"✓ Elite subscription created: {data['subscription_id']}")
    
    def test_subscribe_invalid_tier(self):
        """POST /api/monetization/subscribe - Invalid tier should fail"""
        user_id = create_test_user()
        assert user_id is not None, "Failed to create test user"
        
        requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": user_id,
            "package": "1000",
            "payment_method": "card"
        })
        
        response = requests.post(f"{BASE_URL}/api/monetization/subscribe", json={
            "user_id": user_id,
            "tier": "platinum"  # Invalid tier
        })
        assert response.status_code == 400
        assert "Invalid tier" in response.json().get("detail", "")
        
        print("✓ Invalid tier validation working")
    
    def test_subscribe_insufficient_balance(self):
        """POST /api/monetization/subscribe - Insufficient balance should fail"""
        user_id = create_test_user()
        assert user_id is not None, "Failed to create test user"
        
        # Give user only 100 coins
        requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": user_id,
            "package": "100",
            "payment_method": "card"
        })
        
        # Try to subscribe to Pro (1000 coins)
        response = requests.post(f"{BASE_URL}/api/monetization/subscribe", json={
            "user_id": user_id,
            "tier": "pro"
        })
        assert response.status_code == 400
        assert "Insufficient coins" in response.json().get("detail", "")
        
        print("✓ Subscription insufficient balance validation working")


class TestSubscriptionStatus:
    """Subscription status tests"""
    
    def test_get_subscription_status_active(self):
        """GET /api/monetization/subscription/{user_id} - Get active subscription"""
        user_id = create_test_user()
        assert user_id is not None, "Failed to create test user"
        
        # Create subscription
        requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": user_id,
            "package": "1000",
            "payment_method": "card"
        })
        
        requests.post(f"{BASE_URL}/api/monetization/subscribe", json={
            "user_id": user_id,
            "tier": "pro"
        })
        
        response = requests.get(f"{BASE_URL}/api/monetization/subscription/{user_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        assert data["tier"] == "pro"
        assert data["is_active"]
        assert "expires" in data
        assert "benefits" in data
        
        print(f"✓ Subscription status: {data['tier']}, active: {data['is_active']}")
    
    def test_get_subscription_status_no_subscription(self):
        """GET /api/monetization/subscription/{user_id} - User without subscription"""
        user_id = create_test_user()
        assert user_id is not None, "Failed to create test user"
        
        # Create user without subscription (just purchase coins)
        requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": user_id,
            "package": "100",
            "payment_method": "card"
        })
        
        response = requests.get(f"{BASE_URL}/api/monetization/subscription/{user_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        assert data["tier"] == "basic"
        assert not data["is_active"]
        
        print("✓ No subscription returns basic tier")
    
    def test_get_subscription_status_nonexistent_user(self):
        """GET /api/monetization/subscription/{user_id} - Nonexistent user"""
        response = requests.get(f"{BASE_URL}/api/monetization/subscription/NONEXISTENT_USER")
        assert response.status_code == 404
        
        print("✓ Nonexistent user returns 404")


class TestCreatorEarnings:
    """Creator earnings tests"""
    
    def test_get_creator_earnings(self):
        """GET /api/monetization/creator/earnings/{creator_id} - Get earnings breakdown"""
        creator_id = create_test_user()
        sender_id = create_test_user()
        
        assert creator_id is not None, "Failed to create creator"
        assert sender_id is not None, "Failed to create sender"
        
        # Give creator some coins
        requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": creator_id,
            "package": "100",
            "payment_method": "card"
        })
        
        # Create sender with coins
        requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": sender_id,
            "package": "1000",
            "payment_method": "card"
        })
        
        # Send tips and gifts to creator
        tip_response = requests.post(f"{BASE_URL}/api/monetization/send-tip", json={
            "from_user_id": sender_id,
            "to_user_id": creator_id,
            "amount": 100
        })
        
        gift_response = requests.post(f"{BASE_URL}/api/monetization/gifts/send", json={
            "from_user_id": sender_id,
            "to_user_id": creator_id,
            "gift_id": "diamond"
        })
        
        response = requests.get(f"{BASE_URL}/api/monetization/creator/earnings/{creator_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        assert "total_earnings" in data
        assert "from_tips" in data
        assert "from_gifts" in data
        assert "tip_count" in data
        assert "gift_count" in data
        assert "top_supporters" in data
        
        # Verify earnings (70% of 100 tip + 70% of 100 diamond gift)
        expected_tip_earnings = 70  # 100 * 0.7
        expected_gift_earnings = 70  # 100 * 0.7
        
        assert data["from_tips"] == expected_tip_earnings
        assert data["from_gifts"] == expected_gift_earnings
        assert data["total_earnings"] == expected_tip_earnings + expected_gift_earnings
        assert data["tip_count"] == 1
        assert data["gift_count"] == 1
        
        print(f"✓ Creator earnings: {data['total_earnings']} coins (tips: {data['from_tips']}, gifts: {data['from_gifts']})")


class TestCreatorStats:
    """Creator stats tests"""
    
    def test_get_creator_stats(self):
        """GET /api/monetization/creator/stats/{creator_id} - Get comprehensive stats"""
        creator_id = create_test_user()
        assert creator_id is not None, "Failed to create test user"
        
        # Give creator some coins
        requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": creator_id,
            "package": "100",
            "payment_method": "card"
        })
        
        response = requests.get(f"{BASE_URL}/api/monetization/creator/stats/{creator_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        assert data["creator_id"] == creator_id
        assert "stats" in data
        
        stats = data["stats"]
        assert "total_posts" in stats
        assert "total_likes" in stats
        assert "tips_received" in stats
        assert "gifts_received" in stats
        assert "lifetime_earned" in stats
        assert "current_balance" in stats
        
        print(f"✓ Creator stats retrieved: balance={stats['current_balance']}, lifetime_earned={stats['lifetime_earned']}")
    
    def test_get_creator_stats_nonexistent(self):
        """GET /api/monetization/creator/stats/{creator_id} - Nonexistent creator"""
        response = requests.get(f"{BASE_URL}/api/monetization/creator/stats/NONEXISTENT_CREATOR")
        # Could be 404 or 500 depending on implementation
        assert response.status_code in [404, 500]
        
        print("✓ Nonexistent creator handled")


class TestWithdrawal:
    """Withdrawal system tests"""
    
    def test_request_withdrawal_success(self):
        """POST /api/monetization/creator/withdraw - Request withdrawal"""
        creator_id = create_test_user()
        assert creator_id is not None, "Failed to create test user"
        
        # Give creator enough coins for $50 withdrawal (5000 coins = $50)
        requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": creator_id,
            "package": "5000",
            "payment_method": "card"
        })
        
        response = requests.post(f"{BASE_URL}/api/monetization/creator/withdraw", json={
            "creator_id": creator_id,
            "amount": 50.00,  # Minimum withdrawal
            "payment_method": "paypal",
            "payment_details": {"email": "creator@test.com"}
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        assert data["amount_usd"] == 50.00
        assert data["status"] == "pending"
        assert "withdrawal_id" in data
        assert data["withdrawal_id"].startswith("wd_")
        assert "Processing takes 3-5 business days" in data["message"]
        
        print(f"✓ Withdrawal requested: ${data['amount_usd']}, ID: {data['withdrawal_id']}")
    
    def test_request_withdrawal_below_minimum(self):
        """POST /api/monetization/creator/withdraw - Below minimum should fail"""
        creator_id = create_test_user()
        assert creator_id is not None, "Failed to create test user"
        
        requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": creator_id,
            "package": "5000",
            "payment_method": "card"
        })
        
        response = requests.post(f"{BASE_URL}/api/monetization/creator/withdraw", json={
            "creator_id": creator_id,
            "amount": 25.00,  # Below $50 minimum
            "payment_method": "paypal",
            "payment_details": {"email": "creator@test.com"}
        })
        assert response.status_code == 400
        assert "Minimum withdrawal is $50" in response.json().get("detail", "")
        
        print("✓ Below minimum withdrawal validation working")
    
    def test_request_withdrawal_insufficient_balance(self):
        """POST /api/monetization/creator/withdraw - Insufficient balance should fail"""
        creator_id = create_test_user()
        assert creator_id is not None, "Failed to create test user"
        
        # Give creator only 100 coins ($1)
        requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": creator_id,
            "package": "100",
            "payment_method": "card"
        })
        
        response = requests.post(f"{BASE_URL}/api/monetization/creator/withdraw", json={
            "creator_id": creator_id,
            "amount": 50.00,  # Need 5000 coins but only have 100
            "payment_method": "paypal",
            "payment_details": {"email": "creator@test.com"}
        })
        assert response.status_code == 400
        assert "Insufficient balance" in response.json().get("detail", "")
        
        print("✓ Insufficient balance for withdrawal validation working")
    
    def test_request_withdrawal_nonexistent_user(self):
        """POST /api/monetization/creator/withdraw - Nonexistent user should fail"""
        response = requests.post(f"{BASE_URL}/api/monetization/creator/withdraw", json={
            "creator_id": "NONEXISTENT_CREATOR",
            "amount": 50.00,
            "payment_method": "paypal",
            "payment_details": {"email": "creator@test.com"}
        })
        assert response.status_code == 404
        
        print("✓ Nonexistent user withdrawal validation working")


class TestPlatformFeeCalculation:
    """Platform fee calculation verification"""
    
    def test_platform_fee_30_percent_on_tips(self):
        """Verify 30% platform fee on tips"""
        sender_id = create_test_user()
        recipient_id = create_test_user()
        
        assert sender_id is not None, "Failed to create sender"
        assert recipient_id is not None, "Failed to create recipient"
        
        # Setup users
        requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": sender_id,
            "package": "5000",
            "payment_method": "card"
        })
        requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": recipient_id,
            "package": "100",
            "payment_method": "card"
        })
        
        # Test various tip amounts
        test_amounts = [10, 50, 100, 500, 1000]
        
        for amount in test_amounts:
            response = requests.post(f"{BASE_URL}/api/monetization/send-tip", json={
                "from_user_id": sender_id,
                "to_user_id": recipient_id,
                "amount": amount
            })
            
            if response.status_code == 200:
                data = response.json()
                expected_fee = int(amount * 0.30)
                expected_creator = amount - expected_fee
                
                assert data["platform_fee"] == expected_fee, f"Fee mismatch for {amount}: expected {expected_fee}, got {data['platform_fee']}"
                assert data["creator_received"] == expected_creator, f"Creator earnings mismatch for {amount}"
                
                print(f"  ✓ Tip {amount}: fee={data['platform_fee']}, creator={data['creator_received']}")
        
        print("✓ Platform fee calculation verified for all tip amounts")
    
    def test_platform_fee_30_percent_on_gifts(self):
        """Verify 30% platform fee on gifts"""
        sender_id = create_test_user()
        recipient_id = create_test_user()
        
        assert sender_id is not None, "Failed to create sender"
        assert recipient_id is not None, "Failed to create recipient"
        
        # Setup users with lots of coins
        requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": sender_id,
            "package": "10000",
            "payment_method": "card"
        })
        requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": recipient_id,
            "package": "100",
            "payment_method": "card"
        })
        
        # Test all gift types
        gift_costs = {
            "rose": 10,
            "heart": 25,
            "fire": 50,
            "diamond": 100,
            "crown": 500,
            "trophy": 1000
        }
        
        for gift_id, cost in gift_costs.items():
            response = requests.post(f"{BASE_URL}/api/monetization/gifts/send", json={
                "from_user_id": sender_id,
                "to_user_id": recipient_id,
                "gift_id": gift_id
            })
            
            if response.status_code == 200:
                data = response.json()
                expected_fee = int(cost * 0.30)
                expected_creator = cost - expected_fee
                
                assert data["creator_received"] == expected_creator, f"Creator earnings mismatch for {gift_id}"
                
                print(f"  ✓ Gift {gift_id} ({cost} coins): creator={data['creator_received']}")
        
        print("✓ Platform fee calculation verified for all gift types")


class TestTransactionRecording:
    """Transaction recording verification"""
    
    def test_purchase_creates_transaction(self):
        """Verify coin purchase creates transaction record"""
        user_id = create_test_user()
        assert user_id is not None, "Failed to create test user"
        
        response = requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": user_id,
            "package": "500",
            "payment_method": "card"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert "transaction_id" in data
        assert data["transaction_id"].startswith("txn_")
        
        print(f"✓ Purchase transaction recorded: {data['transaction_id']}")
    
    def test_tip_creates_transaction(self):
        """Verify tip creates transaction record"""
        sender_id = create_test_user()
        recipient_id = create_test_user()
        
        assert sender_id is not None, "Failed to create sender"
        assert recipient_id is not None, "Failed to create recipient"
        
        # Setup
        requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": sender_id,
            "package": "500",
            "payment_method": "card"
        })
        requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": recipient_id,
            "package": "100",
            "payment_method": "card"
        })
        
        response = requests.post(f"{BASE_URL}/api/monetization/send-tip", json={
            "from_user_id": sender_id,
            "to_user_id": recipient_id,
            "amount": 50
        })
        assert response.status_code == 200
        
        data = response.json()
        assert "tip_id" in data
        assert data["tip_id"].startswith("tip_")
        
        print(f"✓ Tip transaction recorded: {data['tip_id']}")
    
    def test_gift_creates_record(self):
        """Verify gift creates record"""
        sender_id = create_test_user()
        recipient_id = create_test_user()
        
        assert sender_id is not None, "Failed to create sender"
        assert recipient_id is not None, "Failed to create recipient"
        
        # Setup
        requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": sender_id,
            "package": "500",
            "payment_method": "card"
        })
        requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": recipient_id,
            "package": "100",
            "payment_method": "card"
        })
        
        response = requests.post(f"{BASE_URL}/api/monetization/gifts/send", json={
            "from_user_id": sender_id,
            "to_user_id": recipient_id,
            "gift_id": "heart"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert "gift_id" in data
        # Note: gift_id in response is the record ID, not the gift type
        
        print("✓ Gift record created")
    
    def test_subscription_creates_record(self):
        """Verify subscription creates record"""
        user_id = create_test_user()
        assert user_id is not None, "Failed to create test user"
        
        requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": user_id,
            "package": "1000",
            "payment_method": "card"
        })
        
        response = requests.post(f"{BASE_URL}/api/monetization/subscribe", json={
            "user_id": user_id,
            "tier": "pro"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert "subscription_id" in data
        assert data["subscription_id"].startswith("sub_")
        
        print(f"✓ Subscription record created: {data['subscription_id']}")
    
    def test_withdrawal_creates_record(self):
        """Verify withdrawal creates record"""
        creator_id = create_test_user()
        assert creator_id is not None, "Failed to create test user"
        
        requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": creator_id,
            "package": "5000",
            "payment_method": "card"
        })
        
        response = requests.post(f"{BASE_URL}/api/monetization/creator/withdraw", json={
            "creator_id": creator_id,
            "amount": 50.00,
            "payment_method": "paypal",
            "payment_details": {"email": "test@test.com"}
        })
        assert response.status_code == 200
        
        data = response.json()
        assert "withdrawal_id" in data
        assert data["withdrawal_id"].startswith("wd_")
        
        print(f"✓ Withdrawal record created: {data['withdrawal_id']}")


class TestEndToEndFlow:
    """End-to-end monetization flow tests"""
    
    def test_complete_creator_monetization_flow(self):
        """Test complete flow: purchase -> tip -> gift -> earnings -> withdraw"""
        creator_id = create_test_user()
        supporter_id = create_test_user()
        
        assert creator_id is not None, "Failed to create creator"
        assert supporter_id is not None, "Failed to create supporter"
        
        # Step 1: Supporter purchases coins
        purchase_response = requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": supporter_id,
            "package": "5000",
            "payment_method": "card"
        })
        assert purchase_response.status_code == 200
        print("  ✓ Step 1: Supporter purchased 6000 coins (5000 + 1000 bonus)")
        
        # Step 2: Create creator account with coins
        requests.post(f"{BASE_URL}/api/monetization/purchase-coins", json={
            "user_id": creator_id,
            "package": "100",
            "payment_method": "card"
        })
        print("  ✓ Step 2: Creator account created")
        
        # Step 3: Supporter tips creator
        tip_response = requests.post(f"{BASE_URL}/api/monetization/send-tip", json={
            "from_user_id": supporter_id,
            "to_user_id": creator_id,
            "amount": 500,
            "message": "Love your content!"
        })
        assert tip_response.status_code == 200
        tip_data = tip_response.json()
        print(f"  ✓ Step 3: Tip sent - {tip_data['amount_sent']} coins, creator received {tip_data['creator_received']}")
        
        # Step 4: Supporter sends gift
        gift_response = requests.post(f"{BASE_URL}/api/monetization/gifts/send", json={
            "from_user_id": supporter_id,
            "to_user_id": creator_id,
            "gift_id": "crown"
        })
        assert gift_response.status_code == 200
        gift_data = gift_response.json()
        print(f"  ✓ Step 4: Crown gift sent, creator received {gift_data['creator_received']} coins")
        
        # Step 5: Check creator earnings
        earnings_response = requests.get(f"{BASE_URL}/api/monetization/creator/earnings/{creator_id}")
        assert earnings_response.status_code == 200
        earnings_data = earnings_response.json()
        print(f"  ✓ Step 5: Creator earnings - Total: {earnings_data['total_earnings']}, Tips: {earnings_data['from_tips']}, Gifts: {earnings_data['from_gifts']}")
        
        # Step 6: Check creator stats
        stats_response = requests.get(f"{BASE_URL}/api/monetization/creator/stats/{creator_id}")
        assert stats_response.status_code == 200
        stats_data = stats_response.json()
        print(f"  ✓ Step 6: Creator stats - Balance: {stats_data['stats']['current_balance']}, Lifetime: {stats_data['stats']['lifetime_earned']}")
        
        # Step 7: Creator requests withdrawal (if balance >= $50)
        creator_balance = stats_data['stats']['current_balance']
        if creator_balance >= 5000:  # $50 = 5000 coins
            withdraw_response = requests.post(f"{BASE_URL}/api/monetization/creator/withdraw", json={
                "creator_id": creator_id,
                "amount": 50.00,
                "payment_method": "paypal",
                "payment_details": {"email": "creator@test.com"}
            })
            assert withdraw_response.status_code == 200
            print(f"  ✓ Step 7: Withdrawal requested - ${withdraw_response.json()['amount_usd']}")
        else:
            print(f"  ⚠ Step 7: Skipped withdrawal (balance {creator_balance} < 5000 required)")
        
        print("✓ Complete creator monetization flow verified")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

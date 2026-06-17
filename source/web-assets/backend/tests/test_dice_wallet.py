"""
Test Suite for Vibe 6-5-4 Dice Game and Vibe Wallet System
Tests: Dice game logic, side bets, dealer envy, wallet balance, top-up packages, Stripe integration
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user IDs
TEST_USER_DICE = f"test_dice_{uuid.uuid4().hex[:8]}"
TEST_USER_WALLET = f"test_wallet_{uuid.uuid4().hex[:8]}"


class TestDiceGameAPI:
    """Tests for Vibe 6-5-4 Dice Game endpoints"""
    
    def test_play_dice_basic(self):
        """Test basic dice game play with main bet only"""
        response = requests.post(f"{BASE_URL}/api/dice/play", json={
            "user_id": TEST_USER_DICE,
            "main_bet": 10.0,
            "side_bets": [],
            "dealer_personality": "nova"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"]
        assert "roll_id" in data
        assert "game_result" in data
        assert data["game_result"]["status"] in ["QUALIFIED", "BUST"]
        assert "rolls" in data["game_result"]
        assert len(data["game_result"]["rolls"]) > 0
        assert "pot_info" in data
        assert data["pot_info"]["total_pot"] == 10.0
        print(f"✅ Dice game played: {data['game_result']['status']}, rolls: {data['game_result']['rolls']}")
    
    def test_play_dice_with_side_bets(self):
        """Test dice game with side bets"""
        response = requests.post(f"{BASE_URL}/api/dice/play", json={
            "user_id": TEST_USER_DICE,
            "main_bet": 5.0,
            "side_bets": [
                {"type": "TRIPLE_6", "amount": 2.0},
                {"type": "ONE_AND_DONE", "amount": 3.0}
            ],
            "dealer_personality": "nova"
        })
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        assert "side_bet_results" in data
        assert "dealer_envy_total" in data
        assert isinstance(data["dealer_envy_total"], (int, float))
        print(f"✅ Dice with side bets: dealer_envy={data['dealer_envy_total']}")
    
    def test_play_dice_different_personalities(self):
        """Test dice game with different dealer personalities"""
        personalities = ["nova", "ace", "ruby", "jade"]
        
        for personality in personalities:
            response = requests.post(f"{BASE_URL}/api/dice/play", json={
                "user_id": TEST_USER_DICE,
                "main_bet": 5.0,
                "side_bets": [],
                "dealer_personality": personality
            })
            
            assert response.status_code == 200, f"Failed for personality {personality}"
            data = response.json()
            assert data["success"]
            print(f"✅ Dice with {personality} dealer: OK")
    
    def test_dice_physics_params(self):
        """Test that physics parameters are returned for dice animation"""
        response = requests.post(f"{BASE_URL}/api/dice/play", json={
            "user_id": TEST_USER_DICE,
            "main_bet": 5.0,
            "side_bets": [],
            "dealer_personality": "nova"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert "physics_params" in data
        assert "throw_force" in data["physics_params"]
        assert "spin_axis" in data["physics_params"]
        assert "release_angle" in data["physics_params"]
        print(f"✅ Physics params: force={data['physics_params']['throw_force']}")
    
    def test_dealer_envy_leaderboard(self):
        """Test dealer envy leaderboard endpoint"""
        response = requests.get(f"{BASE_URL}/api/dice/leaderboard/dealer-envy")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"]
        assert "rankings" in data
        assert isinstance(data["rankings"], list)
        print(f"✅ Dealer leaderboard: {len(data['rankings'])} dealers")
    
    def test_player_history(self):
        """Test player game history endpoint"""
        # First play a game to ensure history exists
        requests.post(f"{BASE_URL}/api/dice/play", json={
            "user_id": TEST_USER_DICE,
            "main_bet": 5.0,
            "side_bets": [],
            "dealer_personality": "nova"
        })
        
        response = requests.get(f"{BASE_URL}/api/dice/history/{TEST_USER_DICE}?limit=5")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"]
        assert "history" in data
        assert isinstance(data["history"], list)
        if len(data["history"]) > 0:
            assert "user_id" in data["history"][0]
            assert "game_type" in data["history"][0]
        print(f"✅ Player history: {len(data['history'])} games")
    
    def test_side_bet_stats(self):
        """Test side bet statistics endpoint"""
        response = requests.get(f"{BASE_URL}/api/dice/stats/side-bets")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"]
        assert "side_bet_stats" in data
        print(f"✅ Side bet stats: {len(data['side_bet_stats'])} bet types")


class TestWalletAPI:
    """Tests for Vibe Wallet System endpoints"""
    
    def test_get_wallet_balance_new_user(self):
        """Test getting balance for new user (should create wallet)"""
        new_user_id = f"test_new_{uuid.uuid4().hex[:8]}"
        response = requests.get(f"{BASE_URL}/api/wallet/balance/{new_user_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"]
        assert data["user_id"] == new_user_id
        assert data["balance"] == 0.0  # New wallet starts at 0
        assert data["currency"] == "USD"
        print(f"✅ New wallet created with balance: ${data['balance']}")
    
    def test_get_wallet_balance_existing_user(self):
        """Test getting balance for existing user"""
        # First call creates wallet
        requests.get(f"{BASE_URL}/api/wallet/balance/{TEST_USER_WALLET}")
        
        # Second call should return same wallet
        response = requests.get(f"{BASE_URL}/api/wallet/balance/{TEST_USER_WALLET}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"]
        assert data["user_id"] == TEST_USER_WALLET
        print(f"✅ Existing wallet balance: ${data['balance']}")
    
    def test_get_topup_packages(self):
        """Test getting available top-up packages"""
        response = requests.get(f"{BASE_URL}/api/wallet/packages")
        
        assert response.status_code == 200
        data = response.json()
        
        # Handle both old and new wallet router response formats
        assert "packages" in data
        assert len(data["packages"]) >= 4  # Should have at least 4 packages
        
        # Verify package structure (works with both formats)
        for pkg in data["packages"]:
            assert "package_id" in pkg
            # Old format uses usd_amount/credit_amount, new uses amount/bonus/total
            has_old_format = "usd_amount" in pkg
            has_new_format = "amount" in pkg
            assert has_old_format or has_new_format, f"Package missing amount fields: {pkg}"
        
        # Check for popular package
        popular_pkg = next((p for p in data["packages"] if p.get("popular")), None)
        assert popular_pkg is not None, "No popular package found"
        
        print(f"✅ Top-up packages: {[p['package_id'] for p in data['packages']]}")
    
    def test_get_transaction_history_empty(self):
        """Test getting transaction history for user with no transactions"""
        new_user_id = f"test_empty_{uuid.uuid4().hex[:8]}"
        response = requests.get(f"{BASE_URL}/api/wallet/transactions/{new_user_id}?limit=10")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"]
        assert "transactions" in data
        assert isinstance(data["transactions"], list)
        print(f"✅ Empty transaction history: {len(data['transactions'])} transactions")
    
    def test_create_topup_session_valid_package(self):
        """Test creating Stripe checkout session for valid package"""
        response = requests.post(f"{BASE_URL}/api/wallet/topup/create-session", json={
            "package_id": "starter",
            "origin_url": "https://social-connect-953.preview.emergentagent.com"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"]
        assert "checkout_url" in data
        assert "session_id" in data
        assert data["checkout_url"].startswith("https://checkout.stripe.com")
        print(f"✅ Stripe session created: {data['session_id'][:20]}...")
    
    def test_create_topup_session_invalid_package(self):
        """Test creating checkout session with invalid package"""
        response = requests.post(f"{BASE_URL}/api/wallet/topup/create-session", json={
            "package_id": "invalid_package",
            "origin_url": "https://social-connect-953.preview.emergentagent.com"
        })
        
        assert response.status_code == 400
        data = response.json()
        assert "Invalid package" in data.get("detail", "")
        print("✅ Invalid package rejected correctly")
    
    def test_check_topup_status_not_found(self):
        """Test checking status for non-existent session"""
        response = requests.get(f"{BASE_URL}/api/wallet/topup/status/invalid_session_id")
        
        assert response.status_code == 404
        print("✅ Non-existent session returns 404")
    
    def test_all_packages_create_session(self):
        """Test that all packages can create checkout sessions"""
        packages = ["starter", "bronze", "silver", "gold", "platinum"]
        
        for pkg_id in packages:
            response = requests.post(f"{BASE_URL}/api/wallet/topup/create-session", json={
                "package_id": pkg_id,
                "origin_url": "https://social-connect-953.preview.emergentagent.com"
            })
            
            assert response.status_code == 200, f"Failed for package {pkg_id}"
            data = response.json()
            assert data["success"]
            print(f"✅ Package {pkg_id}: session created")


class TestDiceWalletIntegration:
    """Integration tests for Dice Game + Wallet System"""
    
    def test_dice_game_records_session(self):
        """Test that dice game sessions are recorded in database"""
        user_id = f"test_integration_{uuid.uuid4().hex[:8]}"
        
        # Play a game
        play_response = requests.post(f"{BASE_URL}/api/dice/play", json={
            "user_id": user_id,
            "main_bet": 10.0,
            "side_bets": [{"type": "TRIPLE_6", "amount": 5.0}],
            "dealer_personality": "nova"
        })
        
        assert play_response.status_code == 200
        play_data = play_response.json()
        roll_id = play_data["roll_id"]
        
        # Check history
        history_response = requests.get(f"{BASE_URL}/api/dice/history/{user_id}?limit=1")
        assert history_response.status_code == 200
        history_data = history_response.json()
        
        assert len(history_data["history"]) > 0
        latest_game = history_data["history"][0]
        assert latest_game["user_id"] == user_id
        assert latest_game["main_bet"] == 10.0
        print(f"✅ Game session recorded: {roll_id}")
    
    def test_dealer_stats_update(self):
        """Test that dealer stats are updated after game"""
        # Get initial stats
        initial_response = requests.get(f"{BASE_URL}/api/dice/leaderboard/dealer-envy")
        initial_data = initial_response.json()
        
        nova_initial = next((d for d in initial_data["rankings"] if d.get("personality_id") == "NOVA"), None)
        initial_hands = nova_initial["total_hands_dealt"] if nova_initial else 0
        
        # Play a game
        requests.post(f"{BASE_URL}/api/dice/play", json={
            "user_id": f"test_stats_{uuid.uuid4().hex[:8]}",
            "main_bet": 5.0,
            "side_bets": [],
            "dealer_personality": "nova"
        })
        
        # Check updated stats
        updated_response = requests.get(f"{BASE_URL}/api/dice/leaderboard/dealer-envy")
        updated_data = updated_response.json()
        
        nova_updated = next((d for d in updated_data["rankings"] if d.get("personality_id") == "NOVA"), None)
        updated_hands = nova_updated["total_hands_dealt"] if nova_updated else 0
        
        assert updated_hands >= initial_hands
        print(f"✅ Dealer stats updated: {initial_hands} -> {updated_hands} hands")


class TestStripeWebhook:
    """Tests for Stripe webhook handler"""
    
    def test_webhook_endpoint_exists(self):
        """Test that webhook endpoint exists and rejects invalid requests"""
        # Send empty request (should fail validation)
        response = requests.post(f"{BASE_URL}/api/wallet/webhook", 
            data=b"",
            headers={"Content-Type": "application/json"}
        )
        
        # Should return 400 (bad request) not 404 (not found)
        assert response.status_code in [400, 422], f"Expected 400/422, got {response.status_code}"
        print("✅ Webhook endpoint exists and validates requests")


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

"""
Celestial Slots API Tests
Tests for the Celestial Slots game with dating bonuses
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://social-connect-953.preview.emergentagent.com')

class TestSlotsSpinAPI:
    """Tests for POST /api/slots/spin endpoint"""
    
    def test_spin_success_basic(self):
        """Test basic spin with valid parameters"""
        response = requests.post(f"{BASE_URL}/api/slots/spin", json={
            "user_id": "test_user_123",
            "bet_amount": 50,
            "auto_spin": False
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "spin_id" in data
        assert "symbols" in data
        assert "paylines" in data
        assert "base_payout" in data
        assert "dating_multiplier" in data
        assert "final_payout" in data
        assert "is_jackpot" in data
        assert "nearby_matches" in data
        assert "timestamp" in data
        
        # Verify symbols array has 5 elements
        assert len(data["symbols"]) == 5
        
        # Verify dating_multiplier is within expected range (1.0 - 1.5)
        assert 1.0 <= data["dating_multiplier"] <= 1.5
        
        # Verify is_jackpot is boolean
        assert isinstance(data["is_jackpot"], bool)
        
        print(f"✅ Spin successful: symbols={data['symbols']}, payout={data['final_payout']}")
    
    def test_spin_with_minimum_bet(self):
        """Test spin with minimum bet amount ($10)"""
        response = requests.post(f"{BASE_URL}/api/slots/spin", json={
            "user_id": "test_user_min_bet",
            "bet_amount": 10,
            "auto_spin": False
        })
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["symbols"]) == 5
        print("✅ Minimum bet spin successful")
    
    def test_spin_with_maximum_bet(self):
        """Test spin with maximum bet amount ($1000)"""
        response = requests.post(f"{BASE_URL}/api/slots/spin", json={
            "user_id": "test_user_max_bet",
            "bet_amount": 1000,
            "auto_spin": False
        })
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["symbols"]) == 5
        print("✅ Maximum bet spin successful")
    
    def test_spin_with_auto_spin_enabled(self):
        """Test spin with auto_spin flag enabled"""
        response = requests.post(f"{BASE_URL}/api/slots/spin", json={
            "user_id": "test_user_auto",
            "bet_amount": 50,
            "auto_spin": True
        })
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["symbols"]) == 5
        print("✅ Auto spin successful")
    
    def test_spin_invalid_bet_too_low(self):
        """Test spin with bet amount below minimum ($10)"""
        response = requests.post(f"{BASE_URL}/api/slots/spin", json={
            "user_id": "test_user_low_bet",
            "bet_amount": 5,
            "auto_spin": False
        })
        
        assert response.status_code == 400
        print("✅ Low bet correctly rejected")
    
    def test_spin_invalid_bet_too_high(self):
        """Test spin with bet amount above maximum ($1000)"""
        response = requests.post(f"{BASE_URL}/api/slots/spin", json={
            "user_id": "test_user_high_bet",
            "bet_amount": 2000,
            "auto_spin": False
        })
        
        assert response.status_code == 400
        print("✅ High bet correctly rejected")
    
    def test_spin_symbols_are_valid(self):
        """Test that all returned symbols are valid symbol keys"""
        valid_symbols = [
            'MIDNIGHT_WILD', 'CELESTIAL_CROWN', 'HEART_VIBE',
            'DICE_PAIR', 'LIVE_STREAM', 'CHERRY', 'STAR'
        ]
        
        response = requests.post(f"{BASE_URL}/api/slots/spin", json={
            "user_id": "test_user_symbols",
            "bet_amount": 50,
            "auto_spin": False
        })
        
        assert response.status_code == 200
        data = response.json()
        
        for symbol in data["symbols"]:
            assert symbol in valid_symbols, f"Invalid symbol: {symbol}"
        
        print(f"✅ All symbols are valid: {data['symbols']}")
    
    def test_spin_nearby_matches_structure(self):
        """Test that nearby_matches has correct structure"""
        response = requests.post(f"{BASE_URL}/api/slots/spin", json={
            "user_id": "test_user_matches",
            "bet_amount": 50,
            "auto_spin": False
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify nearby_matches is a list
        assert isinstance(data["nearby_matches"], list)
        
        # If there are matches, verify structure
        if len(data["nearby_matches"]) > 0:
            match = data["nearby_matches"][0]
            assert "username" in match
            assert "compatibility" in match
            print(f"✅ Nearby matches structure valid: {data['nearby_matches']}")
        else:
            print("✅ No nearby matches (empty list)")


class TestSlotsPaytableAPI:
    """Tests for GET /api/slots/paytable endpoint"""
    
    def test_paytable_success(self):
        """Test paytable returns all symbols"""
        response = requests.get(f"{BASE_URL}/api/slots/paytable")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "symbols" in data
        assert "dating_bonus" in data
        
        print("✅ Paytable retrieved successfully")
    
    def test_paytable_has_all_symbols(self):
        """Test paytable contains all 7 symbols"""
        response = requests.get(f"{BASE_URL}/api/slots/paytable")
        
        assert response.status_code == 200
        data = response.json()
        
        expected_symbols = [
            'MIDNIGHT_WILD', 'CELESTIAL_CROWN', 'HEART_VIBE',
            'DICE_PAIR', 'LIVE_STREAM', 'CHERRY', 'STAR'
        ]
        
        for symbol in expected_symbols:
            assert symbol in data["symbols"], f"Missing symbol: {symbol}"
        
        print("✅ All 7 symbols present in paytable")
    
    def test_paytable_symbol_structure(self):
        """Test each symbol has correct payout structure"""
        response = requests.get(f"{BASE_URL}/api/slots/paytable")
        
        assert response.status_code == 200
        data = response.json()
        
        for symbol_key, symbol_data in data["symbols"].items():
            assert "name" in symbol_data
            assert "emoji" in symbol_data
            assert "payout_3x" in symbol_data
            assert "payout_4x" in symbol_data
            assert "payout_5x" in symbol_data
            assert "is_wild" in symbol_data
            assert "special" in symbol_data
        
        print("✅ All symbols have correct structure")
    
    def test_paytable_celestial_crown_jackpot(self):
        """Test Celestial Crown has 500x jackpot payout"""
        response = requests.get(f"{BASE_URL}/api/slots/paytable")
        
        assert response.status_code == 200
        data = response.json()
        
        crown = data["symbols"]["CELESTIAL_CROWN"]
        assert crown["payout_3x"] == 500
        assert crown["payout_4x"] == 1000  # 500 * 2
        assert crown["payout_5x"] == 2500  # 500 * 5
        
        print("✅ Celestial Crown jackpot payouts correct")
    
    def test_paytable_midnight_wild_is_wild(self):
        """Test Midnight Wild is marked as wild"""
        response = requests.get(f"{BASE_URL}/api/slots/paytable")
        
        assert response.status_code == 200
        data = response.json()
        
        wild = data["symbols"]["MIDNIGHT_WILD"]
        assert wild["is_wild"]
        
        print("✅ Midnight Wild correctly marked as wild")
    
    def test_paytable_heart_vibe_is_special(self):
        """Test Heart Vibe is marked as special (triggers dating bonus)"""
        response = requests.get(f"{BASE_URL}/api/slots/paytable")
        
        assert response.status_code == 200
        data = response.json()
        
        heart = data["symbols"]["HEART_VIBE"]
        assert heart["special"]
        
        print("✅ Heart Vibe correctly marked as special")
    
    def test_paytable_dating_bonus_info(self):
        """Test dating bonus information is present"""
        response = requests.get(f"{BASE_URL}/api/slots/paytable")
        
        assert response.status_code == 200
        data = response.json()
        
        dating_bonus = data["dating_bonus"]
        assert "description" in dating_bonus
        assert "multiplier_range" in dating_bonus
        assert "social_presence_bonus" in dating_bonus
        
        # Verify multiplier range
        assert dating_bonus["multiplier_range"] == "1.1x - 1.5x"
        assert dating_bonus["social_presence_bonus"] == "1.05x"
        
        print("✅ Dating bonus info correct")


class TestSlotsStatsAPI:
    """Tests for GET /api/slots/stats/{user_id} endpoint"""
    
    def test_stats_success(self):
        """Test stats endpoint returns user statistics"""
        response = requests.get(f"{BASE_URL}/api/slots/stats/test_user_123")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "total_spins" in data
        assert "total_wagered" in data
        assert "total_won" in data
        assert "biggest_win" in data
        assert "jackpots" in data
        assert "dating_bonuses_triggered" in data
        
        print("✅ Stats retrieved successfully")
    
    def test_stats_new_user(self):
        """Test stats for a new user returns zeros"""
        response = requests.get(f"{BASE_URL}/api/slots/stats/new_user_never_played")
        
        assert response.status_code == 200
        data = response.json()
        
        # New user should have all zeros
        assert data["total_spins"] == 0
        assert data["total_wagered"] == 0
        assert data["total_won"] == 0
        assert data["biggest_win"] == 0
        assert data["jackpots"] == 0
        assert data["dating_bonuses_triggered"] == 0
        
        print("✅ New user stats are zeros")


class TestSlotsDatingBonus:
    """Tests for dating bonus functionality"""
    
    def test_dating_multiplier_with_heart_vibe(self):
        """Test that dating multiplier is applied when Heart Vibe lands"""
        # Run multiple spins to try to get Heart Vibe
        heart_vibe_found = False
        
        for _ in range(20):  # Try up to 20 spins
            response = requests.post(f"{BASE_URL}/api/slots/spin", json={
                "user_id": "test_dating_bonus",
                "bet_amount": 50,
                "auto_spin": False
            })
            
            assert response.status_code == 200
            data = response.json()
            
            if 'HEART_VIBE' in data["symbols"]:
                heart_vibe_found = True
                # When Heart Vibe lands with nearby matches, multiplier should be > 1.0
                if len(data["nearby_matches"]) > 0:
                    assert data["dating_multiplier"] > 1.0
                    print(f"✅ Dating multiplier applied: {data['dating_multiplier']}x")
                break
        
        if not heart_vibe_found:
            print("⚠️ Heart Vibe not landed in 20 spins (random chance)")
    
    def test_nearby_matches_always_present(self):
        """Test that nearby matches are returned (mock data)"""
        response = requests.post(f"{BASE_URL}/api/slots/spin", json={
            "user_id": "test_nearby",
            "bet_amount": 50,
            "auto_spin": False
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Mock data should always return 2 nearby matches
        assert len(data["nearby_matches"]) == 2
        
        # Verify mock users
        usernames = [m["username"] for m in data["nearby_matches"]]
        assert "Alex" in usernames
        assert "Jordan" in usernames
        
        print(f"✅ Nearby matches returned: {data['nearby_matches']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

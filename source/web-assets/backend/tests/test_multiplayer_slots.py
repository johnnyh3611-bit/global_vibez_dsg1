"""
Test Multiplayer Celestial Slots Feature
"""
from fastapi.testclient import TestClient
from server import app

client = TestClient(app)

def test_get_multiplayer_slots_rooms():
    """Test fetching available multiplayer slots rooms"""
    response = client.get("/api/multiplayer-slots/rooms")
    assert response.status_code == 200
    
    data = response.json()
    assert data["success"]
    assert len(data["rooms"]) == 3
    
    # Verify room structure
    room = data["rooms"][0]
    assert "room_id" in room
    assert "name" in room
    assert "jackpot_amount" in room
    assert "min_bet" in room
    assert "max_bet" in room
    assert "players_count" in room

def test_multiplayer_slots_spin():
    """Test spinning in multiplayer mode"""
    spin_data = {
        "user_id": "test_user_123",
        "username": "TestPlayer",
        "room_id": "cosmic_lounge",
        "bet_amount": 50,
        "team_id": None
    }
    
    response = client.post("/api/multiplayer-slots/spin", json=spin_data)
    assert response.status_code == 200
    
    data = response.json()
    assert data["success"]
    
    result = data["result"]
    assert "spin_id" in result
    assert "symbols" in result
    assert len(result["symbols"]) == 5
    assert "base_payout" in result
    assert "team_multiplier" in result
    assert "final_payout" in result
    assert "jackpot_pool_after" in result

def test_multiplayer_slots_invalid_bet():
    """Test that invalid bet amounts are rejected"""
    spin_data = {
        "user_id": "test_user_123",
        "username": "TestPlayer",
        "room_id": "cosmic_lounge",
        "bet_amount": 5,  # Below minimum
        "team_id": None
    }
    
    response = client.post("/api/multiplayer-slots/spin", json=spin_data)
    assert response.status_code == 400

def test_multiplayer_slots_team_bonus():
    """Test team bonus calculation"""
    spin_data = {
        "user_id": "test_user_123",
        "username": "TestPlayer",
        "room_id": "cosmic_lounge",
        "bet_amount": 50,
        "team_id": "team_alpha"
    }
    
    response = client.post("/api/multiplayer-slots/spin", json=spin_data)
    assert response.status_code == 200
    
    data = response.json()
    result = data["result"]
    
    # Team multiplier should be at least 1.0
    assert result["team_multiplier"] >= 1.0

def test_jackpot_contribution():
    """Test that each spin contributes to jackpot pool"""
    # Get initial jackpot
    rooms_response = client.get("/api/multiplayer-slots/rooms")
    initial_jackpot = rooms_response.json()["rooms"][0]["jackpot_amount"]
    
    # Perform spin
    spin_data = {
        "user_id": "test_user_456",
        "username": "TestPlayer2",
        "room_id": "cosmic_lounge",
        "bet_amount": 100
    }
    
    response = client.post("/api/multiplayer-slots/spin", json=spin_data)
    result = response.json()["result"]
    
    # Jackpot should increase by 10% of bet (unless jackpot was won)
    if not result["is_jackpot"]:
        expected_increase = 10  # 10% of 100
        assert result["jackpot_pool_after"] >= initial_jackpot + expected_increase

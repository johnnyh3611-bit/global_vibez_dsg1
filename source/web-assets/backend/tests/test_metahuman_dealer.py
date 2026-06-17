"""
MetaHuman Dealer Smart Table System Tests
Tests for: Table Management, GV Coin Security, Dealer Animations, Spectator Betting, Matchmaking
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestTableManagement:
    """Smart Table CRUD operations"""
    
    def test_list_tables_empty(self):
        """Test listing tables returns valid response"""
        response = requests.get(f"{BASE_URL}/api/tables/list")
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "tables" in data
        assert isinstance(data["tables"], list)
        print(f"PASS: List tables - {data['total']} tables found")
    
    def test_create_poker_table(self):
        """Test creating a Poker table"""
        payload = {
            "table_name": f"TEST_Poker_{uuid.uuid4().hex[:8]}",
            "game_type": "Poker_Holdem",
            "max_players": 9,
            "assets": {},
            "spatial_data": {}
        }
        response = requests.post(f"{BASE_URL}/api/tables/create", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "table_id" in data
        assert data["game_type"] == "Poker_Holdem"
        assert data["max_players"] == 9
        print(f"PASS: Created Poker table - {data['table_id']}")
        return data["table_id"]
    
    def test_create_bid_whist_table(self):
        """Test creating a Bid Whist table"""
        payload = {
            "table_name": f"TEST_BidWhist_{uuid.uuid4().hex[:8]}",
            "game_type": "Bid_Whist",
            "max_players": 4,
            "assets": {},
            "spatial_data": {}
        }
        response = requests.post(f"{BASE_URL}/api/tables/create", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert data["game_type"] == "Bid_Whist"
        assert data["max_players"] == 4
        print(f"PASS: Created Bid Whist table - {data['table_id']}")
    
    def test_create_baccarat_table(self):
        """Test creating a Baccarat table"""
        payload = {
            "table_name": f"TEST_Baccarat_{uuid.uuid4().hex[:8]}",
            "game_type": "Baccarat",
            "max_players": 14,
            "assets": {},
            "spatial_data": {}
        }
        response = requests.post(f"{BASE_URL}/api/tables/create", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert data["game_type"] == "Baccarat"
        assert data["max_players"] == 14
        print(f"PASS: Created Baccarat table - {data['table_id']}")
    
    def test_get_table_state(self):
        """Test getting table state after creation"""
        # First create a table
        payload = {
            "table_name": f"TEST_State_{uuid.uuid4().hex[:8]}",
            "game_type": "Poker_Holdem",
            "max_players": 9,
            "assets": {},
            "spatial_data": {"P1_Camera": [100.0, 200.0, 50.0]}
        }
        create_response = requests.post(f"{BASE_URL}/api/tables/create", json=payload)
        table_id = create_response.json()["table_id"]
        
        # Get table state
        response = requests.get(f"{BASE_URL}/api/tables/{table_id}/state")
        assert response.status_code == 200
        data = response.json()
        assert data["table_id"] == table_id
        assert data["game_type"] == "Poker_Holdem"
        assert "game_state" in data
        assert "seats" in data
        print(f"PASS: Get table state - phase: {data['game_state']['phase']}")
    
    def test_table_not_found(self):
        """Test 404 for non-existent table"""
        response = requests.get(f"{BASE_URL}/api/tables/nonexistent_table_id/state")
        assert response.status_code == 404
        print("PASS: Table not found returns 404")


class TestCurrencySecurity:
    """Global Vibez Coin security and bet verification"""
    
    def test_get_balance(self):
        """Test getting player balance"""
        response = requests.get(f"{BASE_URL}/api/balance/demo_user")
        assert response.status_code == 200
        data = response.json()
        assert data["player_id"] == "demo_user"
        assert "available_balance" in data
        assert "locked_balance" in data
        assert "total_balance" in data
        print(f"PASS: Get balance - {data['available_balance']} GV Coins available")
    
    def test_verify_bet_approved(self):
        """Test bet verification with sufficient funds"""
        response = requests.post(
            f"{BASE_URL}/api/verify-bet",
            params={
                "player_id": "demo_user",
                "amount": 100,
                "table_id": "test_table",
                "game_type": "Poker_Holdem"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "APPROVED"
        assert "lock_id" in data
        assert "transaction_id" in data
        assert "new_pending_balance" in data
        print(f"PASS: Bet approved - lock_id: {data['lock_id']}")
        return data["lock_id"]
    
    def test_verify_bet_insufficient_funds(self):
        """Test bet verification with insufficient funds"""
        response = requests.post(
            f"{BASE_URL}/api/verify-bet",
            params={
                "player_id": "broke_user",
                "amount": 1000000,
                "table_id": "test_table",
                "game_type": "Poker_Holdem"
            }
        )
        assert response.status_code == 400
        print("PASS: Insufficient funds returns 400")
    
    def test_add_balance(self):
        """Test adding balance to player"""
        test_player = f"test_player_{uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/balance/{test_player}/add",
            params={"amount": 5000}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert data["new_balance"] == 5000
        print(f"PASS: Added 5000 GV Coins to {test_player}")
    
    def test_release_bet_return(self):
        """Test releasing bet back to player"""
        # First lock some funds
        lock_response = requests.post(
            f"{BASE_URL}/api/verify-bet",
            params={
                "player_id": "demo_user",
                "amount": 50,
                "table_id": "release_test",
                "game_type": "Poker_Holdem"
            }
        )
        lock_id = lock_response.json()["lock_id"]
        
        # Release without winner (return to player)
        response = requests.post(f"{BASE_URL}/api/release-bet/{lock_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "RETURNED"
        assert data["amount_returned"] == 50
        print(f"PASS: Bet released - returned {data['amount_returned']} GV Coins")


class TestDealerAnimations:
    """MetaHuman dealer animation triggers"""
    
    def test_list_animations(self):
        """Test listing all dealer animations"""
        response = requests.get(f"{BASE_URL}/api/dealer/animations")
        assert response.status_code == 200
        data = response.json()
        assert "total_animations" in data
        assert data["total_animations"] >= 10
        assert "animations" in data
        assert "WELCOME_PLAYER" in data["animations"]
        assert "BET_APPROVED" in data["animations"]
        print(f"PASS: Listed {data['total_animations']} dealer animations")
    
    def test_trigger_welcome_animation(self):
        """Test triggering welcome animation"""
        response = requests.post(
            f"{BASE_URL}/api/dealer/trigger/test_table/WELCOME_PLAYER",
            params={"player_id": "demo_user"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert data["event"] == "WELCOME_PLAYER"
        assert "animation" in data
        assert "speech" in data
        print(f"PASS: Triggered WELCOME_PLAYER - {data['speech'][:50]}...")
    
    def test_trigger_bet_approved_animation(self):
        """Test triggering bet approved animation"""
        response = requests.post(
            f"{BASE_URL}/api/dealer/trigger/test_table/BET_APPROVED",
            params={"player_id": "demo_user"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert data["event"] == "BET_APPROVED"
        print("PASS: Triggered BET_APPROVED animation")
    
    def test_trigger_bid_whist_animation(self):
        """Test triggering Bid Whist specific animation"""
        response = requests.post(
            f"{BASE_URL}/api/dealer/trigger/test_table/BID_WHIST_TEN_FOR_200"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "Ten tricks bid" in data["speech"]
        print("PASS: Triggered BID_WHIST_TEN_FOR_200 animation")
    
    def test_trigger_unknown_animation(self):
        """Test triggering unknown animation returns error"""
        response = requests.post(
            f"{BASE_URL}/api/dealer/trigger/test_table/UNKNOWN_EVENT"
        )
        assert response.status_code == 200
        data = response.json()
        assert "error" in data
        print("PASS: Unknown animation returns error message")


class TestSpectatorBetting:
    """Spectator betting and live odds"""
    
    def test_place_spectator_bet(self):
        """Test placing a spectator bet"""
        payload = {
            "table_id": "spectator_test_table",
            "spectator_id": f"spectator_{uuid.uuid4().hex[:8]}",
            "amount": 100,
            "prediction": "player_1_wins"
        }
        response = requests.post(f"{BASE_URL}/api/spectator/bet", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "BET_LOCKED"
        assert "bet_id" in data
        assert "odds" in data
        assert "potential_payout" in data
        assert data["odds"] >= 1.5
        print(f"PASS: Spectator bet placed - odds: {data['odds']}x, potential: {data['potential_payout']}")
    
    def test_get_spectator_pot(self):
        """Test getting spectator pot for a table"""
        # First place a bet
        payload = {
            "table_id": "pot_test_table",
            "spectator_id": "spectator_pot_test",
            "amount": 200,
            "prediction": "next_card_red"
        }
        requests.post(f"{BASE_URL}/api/spectator/bet", json=payload)
        
        # Get pot
        response = requests.get(f"{BASE_URL}/api/spectator/pot/pot_test_table")
        assert response.status_code == 200
        data = response.json()
        assert data["table_id"] == "pot_test_table"
        assert "total_pot" in data
        assert "bet_count" in data
        print(f"PASS: Spectator pot - total: {data['total_pot']}, bets: {data['bet_count']}")
    
    def test_distribute_winnings(self):
        """Test distributing spectator winnings"""
        table_id = f"payout_test_{uuid.uuid4().hex[:8]}"
        
        # Place a winning bet
        payload = {
            "table_id": table_id,
            "spectator_id": "winner_spectator",
            "amount": 100,
            "prediction": "player_1_wins"
        }
        requests.post(f"{BASE_URL}/api/spectator/bet", json=payload)
        
        # Distribute winnings
        response = requests.post(
            f"{BASE_URL}/api/spectator/payout/{table_id}",
            params={"winning_prediction": "player_1_wins"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "PAYOUTS_DISTRIBUTED"
        assert "winners_count" in data
        assert "total_distributed" in data
        print(f"PASS: Distributed winnings - {data['winners_count']} winners, {data['total_distributed']} GV Coins")


class TestMatchmaking:
    """Skill-based matchmaking (ELO system)"""
    
    def test_get_player_elo(self):
        """Test getting player ELO rating"""
        response = requests.get(f"{BASE_URL}/api/matchmaking/elo/demo_user")
        assert response.status_code == 200
        data = response.json()
        assert data["player_id"] == "demo_user"
        assert "elo" in data
        assert "tier" in data
        assert data["elo"] >= 0
        print(f"PASS: Player ELO - {data['elo']} ({data['tier']})")
    
    def test_find_match_queued(self):
        """Test joining matchmaking queue"""
        player_id = f"test_player_{uuid.uuid4().hex[:8]}"
        payload = {
            "player_id": player_id,
            "game_type": "Poker_Holdem",
            "preferred_skill_range": 100
        }
        response = requests.post(f"{BASE_URL}/api/matchmaking/find", json=payload)
        assert response.status_code == 200
        data = response.json()
        # Should be queued since no other players
        assert data["status"] in ["QUEUED", "MATCH_FOUND"]
        if data["status"] == "QUEUED":
            assert "position" in data
            assert "your_elo" in data
            print(f"PASS: Player queued - position: {data['position']}, ELO: {data['your_elo']}")
        else:
            print("PASS: Match found immediately")
    
    def test_update_elo_win(self):
        """Test ELO update after winning"""
        player_id = f"elo_test_{uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/matchmaking/update-elo",
            params={
                "player_id": player_id,
                "won": True,
                "opponent_elo": 1200
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "old_elo" in data
        assert "new_elo" in data
        assert "change" in data
        assert data["change"] > 0  # Should increase after win
        print(f"PASS: ELO updated after win - {data['old_elo']} -> {data['new_elo']} (+{data['change']})")
    
    def test_update_elo_loss(self):
        """Test ELO update after losing"""
        player_id = f"elo_loss_test_{uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/matchmaking/update-elo",
            params={
                "player_id": player_id,
                "won": False,
                "opponent_elo": 1200
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["change"] < 0  # Should decrease after loss
        print(f"PASS: ELO updated after loss - {data['old_elo']} -> {data['new_elo']} ({data['change']})")


class TestJackpot:
    """Random jackpot trigger system"""
    
    def test_check_jackpot(self):
        """Test jackpot check endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/jackpot/check/test_table",
            params={"total_activity": 500}
        )
        assert response.status_code == 200
        data = response.json()
        assert "triggered" in data
        if data["triggered"]:
            assert "jackpot_amount" in data
            print(f"PASS: Jackpot triggered! Amount: {data['jackpot_amount']}")
        else:
            assert "next_check_in" in data
            print(f"PASS: No jackpot - next check in {data['next_check_in']}s")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

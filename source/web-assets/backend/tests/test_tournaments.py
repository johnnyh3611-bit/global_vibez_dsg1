"""
Tournament System Tests
Tests for tournament creation, joining, starting, match results, and completion
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data prefix for cleanup
TEST_PREFIX = "TEST_TOUR_"


class TestTournamentSystem:
    """Tournament System API Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.test_user_ids = []
        self.test_tournament_ids = []
        yield
        # Cleanup would go here if needed
    
    # ========== TOURNAMENT LIST ==========
    
    def test_list_tournaments_empty(self):
        """Test listing tournaments when none exist"""
        response = self.session.get(f"{BASE_URL}/api/tournaments/list")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        assert "tournaments" in data
        assert "count" in data
        print(f"✅ List tournaments: {data['count']} tournaments found")
    
    def test_list_tournaments_with_status_filter(self):
        """Test listing tournaments with status filter"""
        response = self.session.get(f"{BASE_URL}/api/tournaments/list?status=registration")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        print(f"✅ List tournaments with filter: {data['count']} registration tournaments")
    
    # ========== CREATE TEST USERS ==========
    
    def create_test_user(self, name_suffix=""):
        """Helper to create a test user via demo-login"""
        user_id = f"{TEST_PREFIX}user_{uuid.uuid4().hex[:8]}"
        
        # Create user via demo-login
        response = self.session.post(f"{BASE_URL}/api/auth/demo-login", json={
            "name": f"Test Player {name_suffix}",
            "email": f"{user_id}@test.com"
        })
        
        if response.status_code == 200:
            data = response.json()
            actual_user_id = data.get("user", {}).get("user_id", user_id)
            self.test_user_ids.append(actual_user_id)
            
            # Give user some XP for entry fees
            self.session.post(f"{BASE_URL}/api/engagement/xp/add", json={
                "user_id": actual_user_id,
                "amount": 1000,
                "reason": "Test XP"
            })
            
            return actual_user_id
        return user_id
    
    # ========== TOURNAMENT CREATION ==========
    
    def test_create_tournament_success(self):
        """Test creating a tournament"""
        organizer_id = self.create_test_user("Organizer")
        
        tournament_data = {
            "name": f"{TEST_PREFIX}Poker Championship",
            "game_id": "poker",
            "organizer_id": organizer_id,
            "max_players": 4,
            "entry_fee": 50,
            "tournament_type": "single_elimination"
        }
        
        response = self.session.post(f"{BASE_URL}/api/tournaments/create", json=tournament_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        assert "tournament_id" in data
        
        self.test_tournament_ids.append(data["tournament_id"])
        print(f"✅ Tournament created: {data['tournament_id']}")
        return data["tournament_id"], organizer_id
    
    def test_create_tournament_all_types(self):
        """Test creating tournaments of all types"""
        organizer_id = self.create_test_user("TypeTest")
        
        for tour_type in ["single_elimination", "double_elimination", "round_robin"]:
            tournament_data = {
                "name": f"{TEST_PREFIX}{tour_type.replace('_', ' ').title()} Test",
                "game_id": "chess",
                "organizer_id": organizer_id,
                "max_players": 4,
                "entry_fee": 0,
                "tournament_type": tour_type
            }
            
            response = self.session.post(f"{BASE_URL}/api/tournaments/create", json=tournament_data)
            assert response.status_code == 200
            
            data = response.json()
            assert data["success"]
            self.test_tournament_ids.append(data["tournament_id"])
            print(f"✅ Created {tour_type} tournament: {data['tournament_id']}")
    
    # ========== TOURNAMENT DETAILS ==========
    
    def test_get_tournament_details(self):
        """Test getting tournament details"""
        tournament_id, _ = self.test_create_tournament_success()
        
        response = self.session.get(f"{BASE_URL}/api/tournaments/details/{tournament_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        assert "tournament" in data
        
        tournament = data["tournament"]
        assert tournament["id"] == tournament_id
        assert tournament["status"] == "registration"
        assert tournament["current_players"] == 0
        print(f"✅ Tournament details retrieved: {tournament['name']}")
    
    def test_get_tournament_details_not_found(self):
        """Test getting details for non-existent tournament"""
        response = self.session.get(f"{BASE_URL}/api/tournaments/details/nonexistent_tour_123")
        assert response.status_code == 404
        print("✅ Non-existent tournament returns 404")
    
    # ========== JOIN TOURNAMENT ==========
    
    def test_join_tournament_success(self):
        """Test joining a tournament"""
        # Create tournament with 0 entry fee for this test
        organizer_id = self.create_test_user("JoinOrganizer")
        
        tournament_data = {
            "name": f"{TEST_PREFIX}Join Test Tournament",
            "game_id": "poker",
            "organizer_id": organizer_id,
            "max_players": 4,
            "entry_fee": 0,  # No entry fee for join test
            "tournament_type": "single_elimination"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/tournaments/create", json=tournament_data)
        tournament_id = create_response.json()["tournament_id"]
        self.test_tournament_ids.append(tournament_id)
        
        player_id = self.create_test_user("Player1")
        
        join_data = {
            "tournament_id": tournament_id,
            "user_id": player_id,
            "skill_level": 50
        }
        
        response = self.session.post(f"{BASE_URL}/api/tournaments/join", json=join_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        print(f"✅ Player joined tournament: {player_id}")
        
        # Verify player count increased
        details_response = self.session.get(f"{BASE_URL}/api/tournaments/details/{tournament_id}")
        details = details_response.json()
        assert details["tournament"]["current_players"] == 1
        print("✅ Player count updated correctly")
    
    def test_join_tournament_already_registered(self):
        """Test joining a tournament when already registered"""
        # Create tournament with 0 entry fee
        organizer_id = self.create_test_user("DupOrganizer")
        
        tournament_data = {
            "name": f"{TEST_PREFIX}Duplicate Join Test",
            "game_id": "poker",
            "organizer_id": organizer_id,
            "max_players": 4,
            "entry_fee": 0,
            "tournament_type": "single_elimination"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/tournaments/create", json=tournament_data)
        tournament_id = create_response.json()["tournament_id"]
        self.test_tournament_ids.append(tournament_id)
        
        player_id = self.create_test_user("DuplicatePlayer")
        
        join_data = {
            "tournament_id": tournament_id,
            "user_id": player_id,
            "skill_level": 50
        }
        
        # First join
        response1 = self.session.post(f"{BASE_URL}/api/tournaments/join", json=join_data)
        assert response1.status_code == 200
        
        # Second join should fail
        response2 = self.session.post(f"{BASE_URL}/api/tournaments/join", json=join_data)
        assert response2.status_code == 400
        print("✅ Duplicate registration prevented")
    
    def test_join_tournament_not_found(self):
        """Test joining non-existent tournament"""
        player_id = self.create_test_user("LostPlayer")
        
        join_data = {
            "tournament_id": "nonexistent_tour_123",
            "user_id": player_id,
            "skill_level": 50
        }
        
        response = self.session.post(f"{BASE_URL}/api/tournaments/join", json=join_data)
        assert response.status_code == 404
        print("✅ Join non-existent tournament returns 404")
    
    # ========== START TOURNAMENT ==========
    
    def test_start_tournament_success(self):
        """Test starting a tournament with enough players"""
        # Create tournament
        organizer_id = self.create_test_user("StartOrganizer")
        
        tournament_data = {
            "name": f"{TEST_PREFIX}Start Test Tournament",
            "game_id": "poker",
            "organizer_id": organizer_id,
            "max_players": 4,
            "entry_fee": 0,
            "tournament_type": "single_elimination"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/tournaments/create", json=tournament_data)
        tournament_id = create_response.json()["tournament_id"]
        self.test_tournament_ids.append(tournament_id)
        
        # Add 4 players
        for i in range(4):
            player_id = self.create_test_user(f"StartPlayer{i}")
            self.session.post(f"{BASE_URL}/api/tournaments/join", json={
                "tournament_id": tournament_id,
                "user_id": player_id,
                "skill_level": 50 + i * 10
            })
        
        # Start tournament
        response = self.session.post(
            f"{BASE_URL}/api/tournaments/start/{tournament_id}?organizer_id={organizer_id}"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        assert "bracket" in data
        print(f"✅ Tournament started with bracket: {len(data['bracket']['matches'])} matches")
        
        # Verify status changed
        details_response = self.session.get(f"{BASE_URL}/api/tournaments/details/{tournament_id}")
        details = details_response.json()
        assert details["tournament"]["status"] == "in_progress"
        print("✅ Tournament status changed to in_progress")
        
        return tournament_id, organizer_id
    
    def test_start_tournament_not_enough_players(self):
        """Test starting tournament with less than 2 players"""
        organizer_id = self.create_test_user("NotEnoughOrganizer")
        
        tournament_data = {
            "name": f"{TEST_PREFIX}Not Enough Players Test",
            "game_id": "chess",
            "organizer_id": organizer_id,
            "max_players": 8,
            "entry_fee": 0,
            "tournament_type": "single_elimination"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/tournaments/create", json=tournament_data)
        tournament_id = create_response.json()["tournament_id"]
        self.test_tournament_ids.append(tournament_id)
        
        # Add only 1 player
        player_id = self.create_test_user("LonelyPlayer")
        self.session.post(f"{BASE_URL}/api/tournaments/join", json={
            "tournament_id": tournament_id,
            "user_id": player_id,
            "skill_level": 50
        })
        
        # Try to start
        response = self.session.post(
            f"{BASE_URL}/api/tournaments/start/{tournament_id}?organizer_id={organizer_id}"
        )
        assert response.status_code == 400
        print("✅ Cannot start tournament with < 2 players")
    
    def test_start_tournament_not_authorized(self):
        """Test starting tournament by non-organizer"""
        tournament_id, organizer_id = self.test_create_tournament_success()
        
        # Add 2 players
        for i in range(2):
            player_id = self.create_test_user(f"AuthPlayer{i}")
            self.session.post(f"{BASE_URL}/api/tournaments/join", json={
                "tournament_id": tournament_id,
                "user_id": player_id,
                "skill_level": 50
            })
        
        # Try to start with wrong organizer
        fake_organizer = "fake_organizer_123"
        response = self.session.post(
            f"{BASE_URL}/api/tournaments/start/{tournament_id}?organizer_id={fake_organizer}"
        )
        assert response.status_code == 403
        print("✅ Non-organizer cannot start tournament")
    
    # ========== MATCH RESULTS ==========
    
    def test_report_match_result(self):
        """Test reporting a match result"""
        # Create and start tournament
        organizer_id = self.create_test_user("MatchOrganizer")
        
        tournament_data = {
            "name": f"{TEST_PREFIX}Match Result Test",
            "game_id": "poker",
            "organizer_id": organizer_id,
            "max_players": 4,
            "entry_fee": 0,
            "tournament_type": "single_elimination"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/tournaments/create", json=tournament_data)
        tournament_id = create_response.json()["tournament_id"]
        self.test_tournament_ids.append(tournament_id)
        
        # Add 4 players
        player_ids = []
        for i in range(4):
            player_id = self.create_test_user(f"MatchPlayer{i}")
            player_ids.append(player_id)
            self.session.post(f"{BASE_URL}/api/tournaments/join", json={
                "tournament_id": tournament_id,
                "user_id": player_id,
                "skill_level": 50 + i * 10
            })
        
        # Start tournament
        start_response = self.session.post(
            f"{BASE_URL}/api/tournaments/start/{tournament_id}?organizer_id={organizer_id}"
        )
        bracket = start_response.json()["bracket"]
        
        # Find first pending match
        pending_match = None
        for match in bracket["matches"]:
            if match["status"] == "pending" and match["player1"] and match["player2"]:
                pending_match = match
                break
        
        if pending_match:
            # Report result
            result_data = {
                "tournament_id": tournament_id,
                "match_id": pending_match["match_id"],
                "winner_id": pending_match["player1"],
                "loser_id": pending_match["player2"],
                "score": "3-1",
                "reported_by": pending_match["player1"]
            }
            
            response = self.session.post(f"{BASE_URL}/api/tournaments/match/result", json=result_data)
            assert response.status_code == 200
            
            data = response.json()
            assert data["success"]
            print(f"✅ Match result reported: {pending_match['player1']} won")
            
            # Verify match updated
            details_response = self.session.get(f"{BASE_URL}/api/tournaments/details/{tournament_id}")
            details = details_response.json()
            
            updated_match = None
            for match in details["tournament"]["bracket"]["matches"]:
                if match["match_id"] == pending_match["match_id"]:
                    updated_match = match
                    break
            
            assert updated_match["status"] == "completed"
            assert updated_match["winner"] == pending_match["player1"]
            print("✅ Match status updated to completed")
        else:
            print("⚠️ No pending match found to test")
    
    # ========== TOURNAMENT COMPLETION ==========
    
    def test_full_tournament_flow(self):
        """Test complete tournament flow: create -> join -> start -> play -> complete"""
        # Create tournament
        organizer_id = self.create_test_user("FullFlowOrganizer")
        
        tournament_data = {
            "name": f"{TEST_PREFIX}Full Flow Tournament",
            "game_id": "chess",
            "organizer_id": organizer_id,
            "max_players": 2,  # Small tournament for quick test
            "entry_fee": 0,
            "tournament_type": "single_elimination"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/tournaments/create", json=tournament_data)
        assert create_response.status_code == 200
        tournament_id = create_response.json()["tournament_id"]
        self.test_tournament_ids.append(tournament_id)
        print(f"✅ Step 1: Tournament created: {tournament_id}")
        
        # Add 2 players
        player1_id = self.create_test_user("FullFlowPlayer1")
        player2_id = self.create_test_user("FullFlowPlayer2")
        
        self.session.post(f"{BASE_URL}/api/tournaments/join", json={
            "tournament_id": tournament_id,
            "user_id": player1_id,
            "skill_level": 60
        })
        self.session.post(f"{BASE_URL}/api/tournaments/join", json={
            "tournament_id": tournament_id,
            "user_id": player2_id,
            "skill_level": 50
        })
        print("✅ Step 2: Players joined")
        
        # Start tournament
        start_response = self.session.post(
            f"{BASE_URL}/api/tournaments/start/{tournament_id}?organizer_id={organizer_id}"
        )
        assert start_response.status_code == 200
        bracket = start_response.json()["bracket"]
        print(f"✅ Step 3: Tournament started with {len(bracket['matches'])} matches")
        
        # Report final match result
        final_match = bracket["matches"][0]  # Only one match in 2-player tournament
        
        result_data = {
            "tournament_id": tournament_id,
            "match_id": final_match["match_id"],
            "winner_id": player1_id,
            "loser_id": player2_id,
            "score": "2-0",
            "reported_by": player1_id
        }
        
        result_response = self.session.post(f"{BASE_URL}/api/tournaments/match/result", json=result_data)
        assert result_response.status_code == 200
        print("✅ Step 4: Match result reported")
        
        # Verify tournament completed
        details_response = self.session.get(f"{BASE_URL}/api/tournaments/details/{tournament_id}")
        details = details_response.json()
        
        # Tournament should be completed with winner
        assert details["tournament"]["status"] == "completed"
        assert details["tournament"]["winner_id"] == player1_id
        print(f"✅ Step 5: Tournament completed! Winner: {player1_id}")
    
    # ========== LEADERBOARD ==========
    
    def test_tournament_leaderboard(self):
        """Test tournament leaderboard endpoint"""
        response = self.session.get(f"{BASE_URL}/api/tournaments/leaderboard")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        assert "leaderboard" in data
        print(f"✅ Leaderboard retrieved: {len(data['leaderboard'])} entries")


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

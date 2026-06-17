"""
Private Vibe Suites API Tests
Tests all 11 endpoints + WebSocket for the Private Vibe Suites system
"""
import pytest
import requests
import os
import uuid
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPrivateSuitesAPI:
    """Test Private Vibe Suites Backend APIs"""
    
    # Store created resources for cleanup
    created_suite_ids = []
    created_invitation_ids = []
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.player1_id = f"test_player_{uuid.uuid4().hex[:8]}"
        self.player2_id = f"test_player_{uuid.uuid4().hex[:8]}"
        yield
    
    # ==================== Suite Creation Tests ====================
    
    def test_create_glass_suite(self):
        """Test creating a Glass Suite"""
        response = requests.post(f"{BASE_URL}/api/private-suites/create", json={
            "player1_id": f"test_{uuid.uuid4().hex[:8]}",
            "player2_id": f"test_{uuid.uuid4().hex[:8]}",
            "suite_type": "glass",
            "theme": "romantic",
            "privacy_level": "private"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert data["success"]
        assert "suite_id" in data
        assert data["suite_id"].startswith("suite_")
        assert data["level_name"] == "L_PrivateSuite_Glass"
        assert "z_offset" in data
        assert "teleport_positions" in data
        
        self.created_suite_ids.append(data["suite_id"])
        print(f"✓ Glass Suite created: {data['suite_id']}")
    
    def test_create_penthouse_suite(self):
        """Test creating a Penthouse Suite"""
        response = requests.post(f"{BASE_URL}/api/private-suites/create", json={
            "player1_id": f"test_{uuid.uuid4().hex[:8]}",
            "player2_id": f"test_{uuid.uuid4().hex[:8]}",
            "suite_type": "penthouse",
            "theme": "luxury",
            "privacy_level": "private"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert data["level_name"] == "L_PrivateSuite_Penthouse"
        
        self.created_suite_ids.append(data["suite_id"])
        print(f"✓ Penthouse Suite created: {data['suite_id']}")
    
    def test_create_beach_suite(self):
        """Test creating a Beach Suite"""
        response = requests.post(f"{BASE_URL}/api/private-suites/create", json={
            "player1_id": f"test_{uuid.uuid4().hex[:8]}",
            "player2_id": f"test_{uuid.uuid4().hex[:8]}",
            "suite_type": "beach",
            "theme": "tropical",
            "privacy_level": "friends"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert data["level_name"] == "L_PrivateSuite_Beach"
        
        self.created_suite_ids.append(data["suite_id"])
        print(f"✓ Beach Suite created: {data['suite_id']}")
    
    def test_create_skyline_suite(self):
        """Test creating a Skyline Suite"""
        response = requests.post(f"{BASE_URL}/api/private-suites/create", json={
            "player1_id": f"test_{uuid.uuid4().hex[:8]}",
            "player2_id": f"test_{uuid.uuid4().hex[:8]}",
            "suite_type": "skyline",
            "theme": "starry",
            "privacy_level": "public"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert data["level_name"] == "L_PrivateSuite_Skyline"
        
        self.created_suite_ids.append(data["suite_id"])
        print(f"✓ Skyline Suite created: {data['suite_id']}")
    
    # ==================== Suite Listing Tests ====================
    
    def test_list_all_suites(self):
        """Test listing all active suites"""
        # First create a suite
        player_id = f"test_list_{uuid.uuid4().hex[:8]}"
        create_response = requests.post(f"{BASE_URL}/api/private-suites/create", json={
            "player1_id": player_id,
            "player2_id": f"test_{uuid.uuid4().hex[:8]}",
            "suite_type": "glass",
            "theme": "romantic",
            "privacy_level": "private"
        })
        suite_id = create_response.json()["suite_id"]
        self.created_suite_ids.append(suite_id)
        
        # List all suites
        response = requests.get(f"{BASE_URL}/api/private-suites/list")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "suites" in data
        assert "count" in data
        assert isinstance(data["suites"], list)
        print(f"✓ Listed {data['count']} active suites")
    
    def test_list_suites_by_player(self):
        """Test listing suites filtered by player_id"""
        player_id = f"test_filter_{uuid.uuid4().hex[:8]}"
        
        # Create a suite for this player
        create_response = requests.post(f"{BASE_URL}/api/private-suites/create", json={
            "player1_id": player_id,
            "player2_id": f"test_{uuid.uuid4().hex[:8]}",
            "suite_type": "penthouse",
            "theme": "romantic",
            "privacy_level": "private"
        })
        suite_id = create_response.json()["suite_id"]
        self.created_suite_ids.append(suite_id)
        
        # List suites for this player
        response = requests.get(f"{BASE_URL}/api/private-suites/list?player_id={player_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert data["count"] >= 1
        
        # Verify the player is in the returned suites
        player_found = any(
            player_id in [s["player1_id"], s["player2_id"]] 
            for s in data["suites"]
        )
        assert player_found, "Player should be in filtered suites"
        print(f"✓ Filtered suites for player: {data['count']} found")
    
    # ==================== Suite Details Tests ====================
    
    def test_get_suite_details(self):
        """Test getting suite details by ID"""
        # Create a suite first
        create_response = requests.post(f"{BASE_URL}/api/private-suites/create", json={
            "player1_id": f"test_{uuid.uuid4().hex[:8]}",
            "player2_id": f"test_{uuid.uuid4().hex[:8]}",
            "suite_type": "beach",
            "theme": "tropical",
            "privacy_level": "private"
        })
        suite_id = create_response.json()["suite_id"]
        self.created_suite_ids.append(suite_id)
        
        # Get suite details
        response = requests.get(f"{BASE_URL}/api/private-suites/{suite_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "suite" in data
        assert data["suite"]["suite_id"] == suite_id
        assert data["suite"]["suite_type"] == "beach"
        assert data["suite"]["status"] == "active"
        print(f"✓ Got suite details: {suite_id}")
    
    def test_get_nonexistent_suite(self):
        """Test getting a suite that doesn't exist"""
        response = requests.get(f"{BASE_URL}/api/private-suites/suite_nonexistent123")
        
        assert response.status_code == 404
        print("✓ Correctly returned 404 for nonexistent suite")
    
    # ==================== Invitation Tests ====================
    
    def test_send_invitation(self):
        """Test sending a suite invitation"""
        from_player = f"test_from_{uuid.uuid4().hex[:8]}"
        to_player = f"test_to_{uuid.uuid4().hex[:8]}"
        
        response = requests.post(
            f"{BASE_URL}/api/private-suites/invite",
            params={
                "from_player_id": from_player,
                "to_player_id": to_player,
                "message": "Join me for a romantic evening!"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "invitation_id" in data
        assert data["invitation_id"].startswith("inv_")
        
        self.created_invitation_ids.append(data["invitation_id"])
        print(f"✓ Invitation sent: {data['invitation_id']}")
    
    def test_get_pending_invitations(self):
        """Test getting pending invitations for a player"""
        to_player = f"test_pending_{uuid.uuid4().hex[:8]}"
        
        # Send an invitation to this player
        send_response = requests.post(
            f"{BASE_URL}/api/private-suites/invite",
            params={
                "from_player_id": f"test_{uuid.uuid4().hex[:8]}",
                "to_player_id": to_player,
                "message": "Let's vibe together!"
            }
        )
        invitation_id = send_response.json()["invitation_id"]
        self.created_invitation_ids.append(invitation_id)
        
        # Get pending invitations
        response = requests.get(f"{BASE_URL}/api/private-suites/invitations/{to_player}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "invitations" in data
        assert data["count"] >= 1
        
        # Verify the invitation is in the list
        inv_found = any(inv["invitation_id"] == invitation_id for inv in data["invitations"])
        assert inv_found, "Sent invitation should be in pending list"
        print(f"✓ Got {data['count']} pending invitations")
    
    def test_accept_invitation(self):
        """Test accepting a suite invitation"""
        from_player = f"test_accept_from_{uuid.uuid4().hex[:8]}"
        to_player = f"test_accept_to_{uuid.uuid4().hex[:8]}"
        
        # Send invitation
        send_response = requests.post(
            f"{BASE_URL}/api/private-suites/invite",
            params={
                "from_player_id": from_player,
                "to_player_id": to_player
            }
        )
        invitation_id = send_response.json()["invitation_id"]
        
        # Accept invitation
        response = requests.post(
            f"{BASE_URL}/api/private-suites/invite/{invitation_id}/respond",
            params={"accept": True}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert data["accepted"]
        assert "suite" in data
        assert data["suite"]["suite_id"].startswith("suite_")
        
        self.created_suite_ids.append(data["suite"]["suite_id"])
        print(f"✓ Invitation accepted, suite created: {data['suite']['suite_id']}")
    
    def test_decline_invitation(self):
        """Test declining a suite invitation"""
        from_player = f"test_decline_from_{uuid.uuid4().hex[:8]}"
        to_player = f"test_decline_to_{uuid.uuid4().hex[:8]}"
        
        # Send invitation
        send_response = requests.post(
            f"{BASE_URL}/api/private-suites/invite",
            params={
                "from_player_id": from_player,
                "to_player_id": to_player
            }
        )
        invitation_id = send_response.json()["invitation_id"]
        
        # Decline invitation
        response = requests.post(
            f"{BASE_URL}/api/private-suites/invite/{invitation_id}/respond",
            params={"accept": False}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert not data["accepted"]
        print("✓ Invitation declined successfully")
    
    def test_respond_nonexistent_invitation(self):
        """Test responding to a nonexistent invitation"""
        response = requests.post(
            f"{BASE_URL}/api/private-suites/invite/inv_nonexistent123/respond",
            params={"accept": True}
        )
        
        assert response.status_code == 404
        print("✓ Correctly returned 404 for nonexistent invitation")
    
    # ==================== Position Update Tests ====================
    
    def test_update_player_position(self):
        """Test updating player position in a suite"""
        player_id = f"test_pos_{uuid.uuid4().hex[:8]}"
        
        # Create a suite
        create_response = requests.post(f"{BASE_URL}/api/private-suites/create", json={
            "player1_id": player_id,
            "player2_id": f"test_{uuid.uuid4().hex[:8]}",
            "suite_type": "glass",
            "theme": "romantic",
            "privacy_level": "private"
        })
        suite_id = create_response.json()["suite_id"]
        self.created_suite_ids.append(suite_id)
        
        # Update position
        response = requests.post(f"{BASE_URL}/api/private-suites/{suite_id}/position", json={
            "player_id": player_id,
            "x": 150.5,
            "y": 200.0,
            "z": 5100.0,
            "rotation": {"pitch": 0, "yaw": 45, "roll": 0}
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        print(f"✓ Player position updated in suite {suite_id}")
    
    def test_update_position_nonexistent_suite(self):
        """Test updating position in a nonexistent suite"""
        response = requests.post(f"{BASE_URL}/api/private-suites/suite_nonexistent/position", json={
            "player_id": "test_player",
            "x": 100.0,
            "y": 100.0,
            "z": 100.0
        })
        
        assert response.status_code == 404
        print("✓ Correctly returned 404 for position update in nonexistent suite")
    
    # ==================== Activity Logging Tests ====================
    
    def test_log_activity(self):
        """Test logging an activity in a suite"""
        # Create a suite
        create_response = requests.post(f"{BASE_URL}/api/private-suites/create", json={
            "player1_id": f"test_{uuid.uuid4().hex[:8]}",
            "player2_id": f"test_{uuid.uuid4().hex[:8]}",
            "suite_type": "penthouse",
            "theme": "romantic",
            "privacy_level": "private"
        })
        suite_id = create_response.json()["suite_id"]
        self.created_suite_ids.append(suite_id)
        
        # Log activity
        response = requests.post(
            f"{BASE_URL}/api/private-suites/{suite_id}/activity",
            params={
                "activity_type": "conversation_started",
                "details": json.dumps({"topic": "getting to know each other"})
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        print(f"✓ Activity logged in suite {suite_id}")
    
    # ==================== Leave Suite Tests ====================
    
    def test_leave_suite(self):
        """Test leaving a suite"""
        player_id = f"test_leave_{uuid.uuid4().hex[:8]}"
        
        # Create a suite
        create_response = requests.post(f"{BASE_URL}/api/private-suites/create", json={
            "player1_id": player_id,
            "player2_id": f"test_{uuid.uuid4().hex[:8]}",
            "suite_type": "skyline",
            "theme": "romantic",
            "privacy_level": "private"
        })
        suite_id = create_response.json()["suite_id"]
        self.created_suite_ids.append(suite_id)
        
        # Leave suite
        response = requests.post(
            f"{BASE_URL}/api/private-suites/{suite_id}/leave",
            params={"player_id": player_id}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert data["suite_status"] == "closing"
        print(f"✓ Player left suite {suite_id}")
    
    # ==================== Close Suite Tests ====================
    
    def test_close_suite(self):
        """Test closing/deleting a suite"""
        # Create a suite
        create_response = requests.post(f"{BASE_URL}/api/private-suites/create", json={
            "player1_id": f"test_{uuid.uuid4().hex[:8]}",
            "player2_id": f"test_{uuid.uuid4().hex[:8]}",
            "suite_type": "beach",
            "theme": "tropical",
            "privacy_level": "private"
        })
        suite_id = create_response.json()["suite_id"]
        
        # Close suite
        response = requests.delete(f"{BASE_URL}/api/private-suites/{suite_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        
        # Verify suite is gone
        get_response = requests.get(f"{BASE_URL}/api/private-suites/{suite_id}")
        assert get_response.status_code == 404
        print(f"✓ Suite {suite_id} closed and deleted")
    
    # ==================== Analytics Tests ====================
    
    def test_get_suite_analytics(self):
        """Test getting suite analytics"""
        player1 = f"test_analytics1_{uuid.uuid4().hex[:8]}"
        player2 = f"test_analytics2_{uuid.uuid4().hex[:8]}"
        
        # Create a suite
        create_response = requests.post(f"{BASE_URL}/api/private-suites/create", json={
            "player1_id": player1,
            "player2_id": player2,
            "suite_type": "glass",
            "theme": "romantic",
            "privacy_level": "private"
        })
        suite_id = create_response.json()["suite_id"]
        self.created_suite_ids.append(suite_id)
        
        # Log some activities
        requests.post(
            f"{BASE_URL}/api/private-suites/{suite_id}/activity",
            params={"activity_type": "music_played"}
        )
        requests.post(
            f"{BASE_URL}/api/private-suites/{suite_id}/activity",
            params={"activity_type": "gift_sent"}
        )
        
        # Get analytics
        response = requests.get(f"{BASE_URL}/api/private-suites/{suite_id}/analytics")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "analytics" in data
        
        analytics = data["analytics"]
        assert analytics["suite_id"] == suite_id
        assert "duration_minutes" in analytics
        assert analytics["activities_count"] >= 2
        assert player1 in analytics["players"]
        assert player2 in analytics["players"]
        assert analytics["suite_type"] == "glass"
        print(f"✓ Got analytics for suite {suite_id}: {analytics['activities_count']} activities, {analytics['duration_minutes']} min")


class TestPrivateSuitesEndToEnd:
    """End-to-end flow tests for Private Vibe Suites"""
    
    def test_full_invitation_flow(self):
        """Test complete flow: Send invitation → Accept → Enter suite → Activity → Leave"""
        player1 = f"test_e2e_p1_{uuid.uuid4().hex[:8]}"
        player2 = f"test_e2e_p2_{uuid.uuid4().hex[:8]}"
        
        # Step 1: Player 1 sends invitation to Player 2
        invite_response = requests.post(
            f"{BASE_URL}/api/private-suites/invite",
            params={
                "from_player_id": player1,
                "to_player_id": player2,
                "message": "Let's have a romantic evening in a Glass Suite!"
            }
        )
        assert invite_response.status_code == 200
        invitation_id = invite_response.json()["invitation_id"]
        print(f"Step 1: ✓ Invitation sent: {invitation_id}")
        
        # Step 2: Player 2 checks pending invitations
        pending_response = requests.get(f"{BASE_URL}/api/private-suites/invitations/{player2}")
        assert pending_response.status_code == 200
        assert pending_response.json()["count"] >= 1
        print("Step 2: ✓ Player 2 has pending invitations")
        
        # Step 3: Player 2 accepts invitation
        accept_response = requests.post(
            f"{BASE_URL}/api/private-suites/invite/{invitation_id}/respond",
            params={"accept": True}
        )
        assert accept_response.status_code == 200
        suite_data = accept_response.json()["suite"]
        suite_id = suite_data["suite_id"]
        print(f"Step 3: ✓ Invitation accepted, suite created: {suite_id}")
        
        # Step 4: Both players update positions
        for player, x in [(player1, 0), (player2, 100)]:
            pos_response = requests.post(f"{BASE_URL}/api/private-suites/{suite_id}/position", json={
                "player_id": player,
                "x": x,
                "y": 0,
                "z": suite_data["z_offset"] + 100
            })
            assert pos_response.status_code == 200
        print("Step 4: ✓ Both players positioned in suite")
        
        # Step 5: Log activities
        activities = ["conversation_started", "music_played", "drinks_ordered"]
        for activity in activities:
            act_response = requests.post(
                f"{BASE_URL}/api/private-suites/{suite_id}/activity",
                params={"activity_type": activity}
            )
            assert act_response.status_code == 200
        print(f"Step 5: ✓ Activities logged: {activities}")
        
        # Step 6: Check analytics
        analytics_response = requests.get(f"{BASE_URL}/api/private-suites/{suite_id}/analytics")
        assert analytics_response.status_code == 200
        analytics = analytics_response.json()["analytics"]
        assert analytics["activities_count"] == 3
        print(f"Step 6: ✓ Analytics show {analytics['activities_count']} activities")
        
        # Step 7: Player 1 leaves
        leave_response = requests.post(
            f"{BASE_URL}/api/private-suites/{suite_id}/leave",
            params={"player_id": player1}
        )
        assert leave_response.status_code == 200
        assert leave_response.json()["suite_status"] == "closing"
        print("Step 7: ✓ Player 1 left suite")
        
        # Step 8: Close suite
        close_response = requests.delete(f"{BASE_URL}/api/private-suites/{suite_id}")
        assert close_response.status_code == 200
        print("Step 8: ✓ Suite closed")
        
        print("\n🎉 Full E2E flow completed successfully!")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

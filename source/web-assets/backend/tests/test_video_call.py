"""
Video Call System API Tests
Tests for 1-on-1 WebRTC video call functionality:
- Call initiation, accept, reject, end
- Call history retrieval
- Active calls listing
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestVideoCallSystem:
    """Video Call API endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create test users for video call testing"""
        # Create caller user
        response1 = requests.post(f"{BASE_URL}/api/auth/test-user")
        assert response1.status_code == 200, f"Failed to create caller: {response1.text}"
        self.caller = response1.json()
        self.caller_id = self.caller["user_id"]
        self.caller_token = self.caller["session_token"]
        
        # Create callee user
        response2 = requests.post(f"{BASE_URL}/api/auth/test-user")
        assert response2.status_code == 200, f"Failed to create callee: {response2.text}"
        self.callee = response2.json()
        self.callee_id = self.callee["user_id"]
        self.callee_token = self.callee["session_token"]
        
        print(f"✅ Created test users: caller={self.caller_id}, callee={self.callee_id}")
        
        yield
        
        # Cleanup - no explicit cleanup needed as test users are unique
    
    # ========== CALL INITIATION TESTS ==========
    
    def test_initiate_video_call_success(self):
        """Test successful video call initiation"""
        response = requests.post(
            f"{BASE_URL}/api/video-call/initiate",
            json={
                "caller_id": self.caller_id,
                "callee_id": self.callee_id,
                "call_type": "video"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert data["success"]
        assert "call_id" in data
        assert data["call_id"].startswith("call_")
        assert data["message"] == "Call initiated"
        
        print(f"✅ Video call initiated: {data['call_id']}")
    
    def test_initiate_audio_call_success(self):
        """Test audio call initiation"""
        response = requests.post(
            f"{BASE_URL}/api/video-call/initiate",
            json={
                "caller_id": self.caller_id,
                "callee_id": self.callee_id,
                "call_type": "audio"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "call_id" in data
        
        print(f"✅ Audio call initiated: {data['call_id']}")
    
    def test_initiate_call_invalid_user(self):
        """Test call initiation with non-existent user"""
        response = requests.post(
            f"{BASE_URL}/api/video-call/initiate",
            json={
                "caller_id": self.caller_id,
                "callee_id": "nonexistent_user_12345",
                "call_type": "video"
            }
        )
        
        assert response.status_code == 404
        data = response.json()
        assert "not found" in data["detail"].lower()
        
        print("✅ Correctly rejected call to non-existent user")
    
    def test_initiate_call_user_busy(self):
        """Test call initiation when callee is already in a call"""
        # First call
        response1 = requests.post(
            f"{BASE_URL}/api/video-call/initiate",
            json={
                "caller_id": self.caller_id,
                "callee_id": self.callee_id,
                "call_type": "video"
            }
        )
        assert response1.status_code == 200
        
        # Create another caller
        response_new = requests.post(f"{BASE_URL}/api/auth/test-user")
        new_caller = response_new.json()
        
        # Second call to same callee should fail (user busy)
        response2 = requests.post(
            f"{BASE_URL}/api/video-call/initiate",
            json={
                "caller_id": new_caller["user_id"],
                "callee_id": self.callee_id,
                "call_type": "video"
            }
        )
        
        assert response2.status_code == 409
        data = response2.json()
        assert "busy" in data["detail"].lower()
        
        print("✅ Correctly rejected call to busy user")
    
    # ========== CALL ACCEPT TESTS ==========
    
    def test_accept_call_success(self):
        """Test successful call acceptance"""
        # Initiate call
        init_response = requests.post(
            f"{BASE_URL}/api/video-call/initiate",
            json={
                "caller_id": self.caller_id,
                "callee_id": self.callee_id,
                "call_type": "video"
            }
        )
        assert init_response.status_code == 200
        call_id = init_response.json()["call_id"]
        
        # Accept call
        accept_response = requests.post(
            f"{BASE_URL}/api/video-call/accept",
            json={
                "call_id": call_id,
                "user_id": self.callee_id
            }
        )
        
        assert accept_response.status_code == 200
        data = accept_response.json()
        assert data["success"]
        assert data["message"] == "Call accepted"
        assert data["call_id"] == call_id
        
        print(f"✅ Call accepted: {call_id}")
    
    def test_accept_call_not_found(self):
        """Test accepting non-existent call"""
        response = requests.post(
            f"{BASE_URL}/api/video-call/accept",
            json={
                "call_id": "call_nonexistent123",
                "user_id": self.callee_id
            }
        )
        
        assert response.status_code == 404
        data = response.json()
        assert "not found" in data["detail"].lower()
        
        print("✅ Correctly rejected accept for non-existent call")
    
    def test_accept_call_unauthorized(self):
        """Test accepting call by wrong user"""
        # Initiate call
        init_response = requests.post(
            f"{BASE_URL}/api/video-call/initiate",
            json={
                "caller_id": self.caller_id,
                "callee_id": self.callee_id,
                "call_type": "video"
            }
        )
        call_id = init_response.json()["call_id"]
        
        # Try to accept as caller (should fail)
        accept_response = requests.post(
            f"{BASE_URL}/api/video-call/accept",
            json={
                "call_id": call_id,
                "user_id": self.caller_id  # Wrong user
            }
        )
        
        assert accept_response.status_code == 403
        data = accept_response.json()
        assert "not authorized" in data["detail"].lower()
        
        print("✅ Correctly rejected unauthorized accept")
    
    # ========== CALL REJECT TESTS ==========
    
    def test_reject_call_success(self):
        """Test successful call rejection"""
        # Initiate call
        init_response = requests.post(
            f"{BASE_URL}/api/video-call/initiate",
            json={
                "caller_id": self.caller_id,
                "callee_id": self.callee_id,
                "call_type": "video"
            }
        )
        call_id = init_response.json()["call_id"]
        
        # Reject call
        reject_response = requests.post(
            f"{BASE_URL}/api/video-call/reject",
            json={
                "call_id": call_id,
                "user_id": self.callee_id
            }
        )
        
        assert reject_response.status_code == 200
        data = reject_response.json()
        assert data["success"]
        assert data["message"] == "Call rejected"
        
        print(f"✅ Call rejected: {call_id}")
    
    def test_reject_call_unauthorized(self):
        """Test rejecting call by wrong user"""
        # Initiate call
        init_response = requests.post(
            f"{BASE_URL}/api/video-call/initiate",
            json={
                "caller_id": self.caller_id,
                "callee_id": self.callee_id,
                "call_type": "video"
            }
        )
        call_id = init_response.json()["call_id"]
        
        # Try to reject as caller (should fail)
        reject_response = requests.post(
            f"{BASE_URL}/api/video-call/reject",
            json={
                "call_id": call_id,
                "user_id": self.caller_id  # Wrong user
            }
        )
        
        assert reject_response.status_code == 403
        
        print("✅ Correctly rejected unauthorized reject")
    
    # ========== CALL END TESTS ==========
    
    def test_end_call_by_caller(self):
        """Test ending call by caller"""
        # Initiate and accept call
        init_response = requests.post(
            f"{BASE_URL}/api/video-call/initiate",
            json={
                "caller_id": self.caller_id,
                "callee_id": self.callee_id,
                "call_type": "video"
            }
        )
        call_id = init_response.json()["call_id"]
        
        requests.post(
            f"{BASE_URL}/api/video-call/accept",
            json={"call_id": call_id, "user_id": self.callee_id}
        )
        
        # End call by caller
        end_response = requests.post(
            f"{BASE_URL}/api/video-call/end",
            json={
                "call_id": call_id,
                "user_id": self.caller_id,
                "duration_seconds": 120
            }
        )
        
        assert end_response.status_code == 200
        data = end_response.json()
        assert data["success"]
        assert data["message"] == "Call ended"
        
        print(f"✅ Call ended by caller: {call_id}")
    
    def test_end_call_by_callee(self):
        """Test ending call by callee"""
        # Initiate and accept call
        init_response = requests.post(
            f"{BASE_URL}/api/video-call/initiate",
            json={
                "caller_id": self.caller_id,
                "callee_id": self.callee_id,
                "call_type": "video"
            }
        )
        call_id = init_response.json()["call_id"]
        
        requests.post(
            f"{BASE_URL}/api/video-call/accept",
            json={"call_id": call_id, "user_id": self.callee_id}
        )
        
        # End call by callee
        end_response = requests.post(
            f"{BASE_URL}/api/video-call/end",
            json={
                "call_id": call_id,
                "user_id": self.callee_id,
                "duration_seconds": 60
            }
        )
        
        assert end_response.status_code == 200
        data = end_response.json()
        assert data["success"]
        
        print(f"✅ Call ended by callee: {call_id}")
    
    def test_end_call_unauthorized(self):
        """Test ending call by unauthorized user"""
        # Initiate call
        init_response = requests.post(
            f"{BASE_URL}/api/video-call/initiate",
            json={
                "caller_id": self.caller_id,
                "callee_id": self.callee_id,
                "call_type": "video"
            }
        )
        call_id = init_response.json()["call_id"]
        
        # Create third user
        third_user = requests.post(f"{BASE_URL}/api/auth/test-user").json()
        
        # Try to end call as third user
        end_response = requests.post(
            f"{BASE_URL}/api/video-call/end",
            json={
                "call_id": call_id,
                "user_id": third_user["user_id"],
                "duration_seconds": 30
            }
        )
        
        assert end_response.status_code == 403
        
        print("✅ Correctly rejected unauthorized end call")
    
    # ========== CALL HISTORY TESTS ==========
    
    def test_get_call_history(self):
        """Test retrieving call history for a user"""
        # Create a call and end it, then create another
        for i in range(2):
            # Create different callees for each call
            callee_resp = requests.post(f"{BASE_URL}/api/auth/test-user")
            temp_callee = callee_resp.json()
            
            init_resp = requests.post(
                f"{BASE_URL}/api/video-call/initiate",
                json={
                    "caller_id": self.caller_id,
                    "callee_id": temp_callee["user_id"],
                    "call_type": "video"
                }
            )
            if init_resp.status_code == 200:
                call_id = init_resp.json()["call_id"]
                # End the call so we can make another
                requests.post(
                    f"{BASE_URL}/api/video-call/end",
                    json={
                        "call_id": call_id,
                        "user_id": self.caller_id,
                        "duration_seconds": 30
                    }
                )
        
        # Get call history
        response = requests.get(f"{BASE_URL}/api/video-call/history/{self.caller_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"]
        assert "calls" in data
        assert isinstance(data["calls"], list)
        assert data["count"] >= 1  # At least one call in history
        
        # Verify call structure
        if data["calls"]:
            call = data["calls"][0]
            assert "id" in call
            assert "caller_id" in call
            assert "callee_id" in call
            assert "call_type" in call
            assert "status" in call
            assert "started_at" in call
        
        print(f"✅ Retrieved call history: {data['count']} calls")
    
    def test_get_call_history_empty(self):
        """Test call history for user with no calls"""
        # Create new user with no calls
        new_user = requests.post(f"{BASE_URL}/api/auth/test-user").json()
        
        response = requests.get(f"{BASE_URL}/api/video-call/history/{new_user['user_id']}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"]
        assert data["calls"] == []
        assert data["count"] == 0
        
        print("✅ Empty call history returned correctly")
    
    # ========== ACTIVE CALLS TESTS ==========
    
    def test_get_active_calls(self):
        """Test retrieving active calls list"""
        # Initiate a call (will be in ringing state)
        requests.post(
            f"{BASE_URL}/api/video-call/initiate",
            json={
                "caller_id": self.caller_id,
                "callee_id": self.callee_id,
                "call_type": "video"
            }
        )
        
        # Get active calls
        response = requests.get(f"{BASE_URL}/api/video-call/active")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"]
        assert "active_calls" in data
        assert isinstance(data["active_calls"], list)
        assert "count" in data
        
        print(f"✅ Active calls retrieved: {data['count']} calls")
    
    # ========== CALL FLOW INTEGRATION TEST ==========
    
    def test_complete_call_flow(self):
        """Test complete call flow: initiate -> accept -> end"""
        # Step 1: Initiate call
        init_response = requests.post(
            f"{BASE_URL}/api/video-call/initiate",
            json={
                "caller_id": self.caller_id,
                "callee_id": self.callee_id,
                "call_type": "video"
            }
        )
        assert init_response.status_code == 200
        call_id = init_response.json()["call_id"]
        print(f"  Step 1: Call initiated - {call_id}")
        
        # Step 2: Accept call
        accept_response = requests.post(
            f"{BASE_URL}/api/video-call/accept",
            json={
                "call_id": call_id,
                "user_id": self.callee_id
            }
        )
        assert accept_response.status_code == 200
        print("  Step 2: Call accepted")
        
        # Step 3: End call with duration
        end_response = requests.post(
            f"{BASE_URL}/api/video-call/end",
            json={
                "call_id": call_id,
                "user_id": self.caller_id,
                "duration_seconds": 180  # 3 minutes
            }
        )
        assert end_response.status_code == 200
        print("  Step 3: Call ended")
        
        # Step 4: Verify in history
        history_response = requests.get(f"{BASE_URL}/api/video-call/history/{self.caller_id}")
        assert history_response.status_code == 200
        calls = history_response.json()["calls"]
        
        # Find our call
        our_call = next((c for c in calls if c["id"] == call_id), None)
        assert our_call is not None
        assert our_call["status"] == "ended"
        assert our_call["duration_seconds"] == 180
        print("  Step 4: Call verified in history")
        
        print("✅ Complete call flow test passed")
    
    def test_rejected_call_flow(self):
        """Test call flow with rejection"""
        # Initiate call
        init_response = requests.post(
            f"{BASE_URL}/api/video-call/initiate",
            json={
                "caller_id": self.caller_id,
                "callee_id": self.callee_id,
                "call_type": "video"
            }
        )
        call_id = init_response.json()["call_id"]
        
        # Reject call
        reject_response = requests.post(
            f"{BASE_URL}/api/video-call/reject",
            json={
                "call_id": call_id,
                "user_id": self.callee_id
            }
        )
        assert reject_response.status_code == 200
        
        # Verify in history
        history_response = requests.get(f"{BASE_URL}/api/video-call/history/{self.caller_id}")
        calls = history_response.json()["calls"]
        
        our_call = next((c for c in calls if c["id"] == call_id), None)
        assert our_call is not None
        assert our_call["status"] == "rejected"
        
        print("✅ Rejected call flow test passed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

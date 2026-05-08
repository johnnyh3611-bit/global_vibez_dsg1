"""
Google Auth Flow Tests for Global Vibez DSG
Tests the Emergent-managed Google Auth integration
"""
import pytest
import requests
import os

# Get the backend URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://social-connect-953.preview.emergentagent.com')

class TestDemoLogin:
    """Test demo login as baseline for auth flow"""
    
    def test_demo_login_success(self):
        """Test that demo login creates session and returns user data"""
        response = requests.post(
            f"{BASE_URL}/api/auth/demo-login",
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200, f"Demo login failed: {response.text}"
        
        data = response.json()
        assert "user_id" in data, "Response missing user_id"
        assert "email" in data, "Response missing email"
        assert "name" in data, "Response missing name"
        assert data["email"] == "demo@globalvibez.com", "Unexpected demo email"
        assert data["profile_completed"], "Demo user should have completed profile"
        
        # Check that session cookie was set
        assert "session_token" in response.cookies, "Session cookie not set"
        
        print(f"✅ Demo login successful: {data['name']}")
        return response.cookies.get("session_token")
    
    def test_demo_login_session_persistence(self):
        """Test that demo login session persists and /auth/me works"""
        # First login
        login_response = requests.post(
            f"{BASE_URL}/api/auth/demo-login",
            headers={"Content-Type": "application/json"}
        )
        assert login_response.status_code == 200
        
        session_token = login_response.cookies.get("session_token")
        assert session_token, "No session token in cookies"
        
        # Test /auth/me with session cookie
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            cookies={"session_token": session_token}
        )
        
        assert me_response.status_code == 200, f"Auth/me failed: {me_response.text}"
        
        user_data = me_response.json()
        assert user_data["email"] == "demo@globalvibez.com"
        assert "user_id" in user_data
        
        print(f"✅ Session persistence verified for: {user_data['name']}")


class TestGoogleAuthSession:
    """Test the /api/auth/session endpoint for Google Auth"""
    
    def test_session_endpoint_rejects_invalid_session_id(self):
        """Test that invalid session_id returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/session",
            json={"session_id": "invalid_session_123"},
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data
        assert data["detail"] == "Invalid session ID"
        
        print("✅ Invalid session_id correctly rejected")
    
    def test_session_endpoint_rejects_empty_session_id(self):
        """Test that empty session_id returns error"""
        response = requests.post(
            f"{BASE_URL}/api/auth/session",
            json={"session_id": ""},
            headers={"Content-Type": "application/json"}
        )
        
        # Should return 401 or 422 (validation error)
        assert response.status_code in [401, 422], f"Expected 401/422, got {response.status_code}"
        print("✅ Empty session_id correctly rejected")
    
    def test_session_endpoint_rejects_missing_session_id(self):
        """Test that missing session_id returns validation error"""
        response = requests.post(
            f"{BASE_URL}/api/auth/session",
            json={},
            headers={"Content-Type": "application/json"}
        )
        
        # Should return 422 (validation error)
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print("✅ Missing session_id correctly rejected")


class TestAuthMe:
    """Test the /api/auth/me endpoint"""
    
    def test_auth_me_without_session(self):
        """Test that /auth/me returns 401 without session"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data
        assert data["detail"] == "Not authenticated"
        
        print("✅ Auth/me correctly rejects unauthenticated requests")
    
    def test_auth_me_with_invalid_session(self):
        """Test that /auth/me returns 401 with invalid session token"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            cookies={"session_token": "invalid_token_123"}
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Auth/me correctly rejects invalid session tokens")
    
    def test_auth_me_with_bearer_token(self):
        """Test that /auth/me works with Bearer token in Authorization header"""
        # First get a valid session token via demo login
        login_response = requests.post(f"{BASE_URL}/api/auth/demo-login")
        assert login_response.status_code == 200
        
        session_token = login_response.cookies.get("session_token")
        
        # Test with Bearer token
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        
        assert me_response.status_code == 200, f"Auth/me with Bearer failed: {me_response.text}"
        
        user_data = me_response.json()
        assert "user_id" in user_data
        assert "email" in user_data
        
        print("✅ Auth/me works with Bearer token")


class TestLogout:
    """Test the /api/auth/logout endpoint"""
    
    def test_logout_clears_session(self):
        """Test that logout clears the session"""
        # First login
        login_response = requests.post(f"{BASE_URL}/api/auth/demo-login")
        assert login_response.status_code == 200
        
        session_token = login_response.cookies.get("session_token")
        
        # Verify session works
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            cookies={"session_token": session_token}
        )
        assert me_response.status_code == 200
        
        # Logout
        logout_response = requests.post(
            f"{BASE_URL}/api/auth/logout",
            cookies={"session_token": session_token}
        )
        assert logout_response.status_code == 200
        
        data = logout_response.json()
        assert data["message"] == "Logged out successfully"
        
        # Verify session is invalidated
        me_response_after = requests.get(
            f"{BASE_URL}/api/auth/me",
            cookies={"session_token": session_token}
        )
        assert me_response_after.status_code == 401, "Session should be invalidated after logout"
        
        print("✅ Logout correctly clears session")


class TestTestUser:
    """Test the /api/auth/test-user endpoint for automated testing"""
    
    def test_create_test_user(self):
        """Test creating a unique test user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/test-user",
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200, f"Test user creation failed: {response.text}"
        
        data = response.json()
        assert "user_id" in data
        assert "email" in data
        assert "session_token" in data
        assert data["user_id"].startswith("test_")
        assert "@globalvibez.com" in data["email"]
        
        # Verify session works
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            cookies={"session_token": data["session_token"]}
        )
        assert me_response.status_code == 200
        
        print(f"✅ Test user created: {data['email']}")


class TestEmergentAuthIntegration:
    """Test the Emergent Auth API integration"""
    
    def test_emergent_auth_api_reachable(self):
        """Test that Emergent Auth API is reachable"""
        response = requests.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": "test_connectivity"},
            timeout=10
        )
        
        # Should return 404 (user not found) not connection error
        assert response.status_code in [404, 401], f"Unexpected status: {response.status_code}"
        
        print("✅ Emergent Auth API is reachable")
    
    def test_session_endpoint_calls_emergent_auth(self):
        """Test that /api/auth/session correctly calls Emergent Auth API"""
        # This test verifies the integration by checking the error response
        # A valid session_id would come from completing Google OAuth
        
        response = requests.post(
            f"{BASE_URL}/api/auth/session",
            json={"session_id": "test_integration_check"},
            headers={"Content-Type": "application/json"}
        )
        
        # Should return 401 because Emergent Auth will reject invalid session
        assert response.status_code == 401
        
        data = response.json()
        assert data["detail"] == "Invalid session ID"
        
        print("✅ Session endpoint correctly integrates with Emergent Auth")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

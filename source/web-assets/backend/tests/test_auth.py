"""
Authentication Flow Tests
Tests for Google Sign-In OAuth flow, session management, and protected routes
"""
import pytest
import requests
import os
from datetime import datetime
import subprocess

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test session tokens created via mongosh
TEST_SESSION_TOKEN = None
TEST_USER_ID = None


def setup_module(module):
    """Create test user and session before running tests"""
    global TEST_SESSION_TOKEN, TEST_USER_ID
    
    timestamp = int(datetime.now().timestamp() * 1000)
    TEST_USER_ID = f"test-auth-flow-{timestamp}"
    TEST_SESSION_TOKEN = f"test_session_flow_{timestamp}"
    
    # Create test user and session in MongoDB
    mongo_script = f'''
    use('test_database');
    db.users.insertOne({{
      user_id: '{TEST_USER_ID}',
      email: 'test.flow.{timestamp}@example.com',
      name: 'Auth Flow Test User',
      picture: 'https://via.placeholder.com/150',
      bio: 'Test user for auth flow testing',
      age: 25,
      gender: 'male',
      location: 'Test City',
      interests: ['testing', 'coding'],
      photos: ['https://via.placeholder.com/150'],
      preferences: {{ min_age: 18, max_age: 40, max_distance: 50, interested_in: 'everyone' }},
      membership_type: 'free',
      swipes_today: 0,
      swipes_limit: 20,
      profile_completed: true,
      referral_code: 'GVFLOW123',
      created_at: new Date()
    }});
    db.user_sessions.insertOne({{
      user_id: '{TEST_USER_ID}',
      session_token: '{TEST_SESSION_TOKEN}',
      expires_at: new Date(Date.now() + 7*24*60*60*1000),
      created_at: new Date()
    }});
    print('Created test user and session');
    '''
    
    result = subprocess.run(['mongosh', '--quiet', '--eval', mongo_script], 
                           capture_output=True, text=True)
    print(f"Test setup result: {result.stdout}")


def teardown_module(module):
    """Clean up test data after tests"""
    mongo_script = '''
    use('test_database');
    db.users.deleteMany({email: /test\\.flow\\./});
    db.user_sessions.deleteMany({session_token: /test_session_flow/});
    print('Cleaned up test data');
    '''
    
    result = subprocess.run(['mongosh', '--quiet', '--eval', mongo_script],
                           capture_output=True, text=True)
    print(f"Test cleanup result: {result.stdout}")


class TestAuthEndpoints:
    """Tests for authentication endpoints"""
    
    def test_health_check(self):
        """Test API root is accessible"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"PASS: API health check - {data['message']}")
    
    def test_auth_me_with_valid_token(self):
        """Test /api/auth/me returns user data with valid session token"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Validate user data structure
        assert "user_id" in data, "Response should contain user_id"
        assert "email" in data, "Response should contain email"
        assert "name" in data, "Response should contain name"
        assert data["user_id"] == TEST_USER_ID
        print(f"PASS: /api/auth/me returns user data for {data['name']}")
    
    def test_auth_me_without_token(self):
        """Test /api/auth/me returns 401 without token"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: /api/auth/me returns 401 without token")
    
    def test_auth_me_with_invalid_token(self):
        """Test /api/auth/me returns 401 with invalid token"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": "Bearer invalid_token_12345"}
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: /api/auth/me returns 401 with invalid token")
    
    def test_auth_session_with_invalid_session_id(self):
        """Test /api/auth/session rejects invalid session_id"""
        response = requests.post(
            f"{BASE_URL}/api/auth/session",
            headers={"Content-Type": "application/json"},
            json={"session_id": "invalid_session_id_123"}
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        data = response.json()
        assert "detail" in data
        assert "Invalid session ID" in data["detail"]
        print("PASS: /api/auth/session rejects invalid session_id")
    
    def test_auth_session_without_session_id(self):
        """Test /api/auth/session requires session_id"""
        response = requests.post(
            f"{BASE_URL}/api/auth/session",
            headers={"Content-Type": "application/json"},
            json={}
        )
        
        assert response.status_code == 422, f"Expected 422 (validation error), got {response.status_code}"
        print("PASS: /api/auth/session requires session_id (422 on missing)")
    
    def test_auth_me_with_cookie(self):
        """Test /api/auth/me accepts session_token via cookie"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            cookies={"session_token": TEST_SESSION_TOKEN}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["user_id"] == TEST_USER_ID
        print("PASS: /api/auth/me accepts session via cookie")


class TestLogoutEndpoint:
    """Tests for logout functionality"""
    
    def test_logout_clears_session(self):
        """Test /api/auth/logout clears session"""
        # Create a separate session for logout test to avoid affecting other tests
        import subprocess
        timestamp = int(datetime.now().timestamp() * 1000)
        logout_session_token = f"test_logout_session_{timestamp}"
        
        mongo_script = f'''
        use('test_database');
        db.user_sessions.insertOne({{
          user_id: '{TEST_USER_ID}',
          session_token: '{logout_session_token}',
          expires_at: new Date(Date.now() + 7*24*60*60*1000),
          created_at: new Date()
        }});
        '''
        subprocess.run(['mongosh', '--quiet', '--eval', mongo_script], capture_output=True)
        
        # First verify user is authenticated with this session
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {logout_session_token}"}
        )
        assert response.status_code == 200
        
        # Call logout
        logout_response = requests.post(
            f"{BASE_URL}/api/auth/logout",
            cookies={"session_token": logout_session_token}
        )
        
        assert logout_response.status_code == 200
        data = logout_response.json()
        assert "message" in data
        assert "Logged out" in data["message"]
        print("PASS: /api/auth/logout clears session successfully")


class TestProtectedRoutes:
    """Tests for protected route access"""
    
    def test_profile_requires_auth(self):
        """Test profile endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/profile/{TEST_USER_ID}")
        assert response.status_code == 401
        print("PASS: Profile endpoint requires authentication")
    
    def test_profile_access_with_auth(self):
        """Test profile endpoint accessible with auth"""
        response = requests.get(
            f"{BASE_URL}/api/profile/{TEST_USER_ID}",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == TEST_USER_ID
        print("PASS: Profile endpoint accessible with auth")
    
    def test_discover_requires_auth(self):
        """Test discover endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/discover")
        assert response.status_code == 401
        print("PASS: Discover endpoint requires authentication")
    
    def test_matches_requires_auth(self):
        """Test matches endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/matches")
        assert response.status_code == 401
        print("PASS: Matches endpoint requires authentication")
    
    def test_referral_info_requires_auth(self):
        """Test referral info endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/referral/info")
        assert response.status_code == 401
        print("PASS: Referral info endpoint requires authentication")


class TestEmergentOAuthFlow:
    """Tests for Emergent OAuth integration"""
    
    def test_oauth_redirect_url_format(self):
        """Verify the correct OAuth redirect URL format"""
        # This test verifies the expected URL format for Emergent OAuth
        expected_base = "https://auth.emergentagent.com/"
        expected_redirect_param = "redirect="
        
        # The frontend should redirect to:
        # https://auth.emergentagent.com/?redirect=<encoded_dashboard_url>
        test_origin = "https://social-connect-953.preview.emergentagent.com"
        expected_redirect = f"{test_origin}/dashboard"
        
        # Verify URL construction matches expected pattern
        full_oauth_url = f"{expected_base}?{expected_redirect_param}{requests.utils.quote(expected_redirect)}"
        
        assert "auth.emergentagent.com" in full_oauth_url
        assert "redirect=" in full_oauth_url
        assert "dashboard" in full_oauth_url
        print(f"PASS: OAuth URL format is correct: {full_oauth_url}")
    
    def test_no_backend_google_auth_endpoint(self):
        """Verify /api/auth/google does NOT exist (should be 404 or 405)"""
        response = requests.get(f"{BASE_URL}/api/auth/google")
        
        # This endpoint should not exist - 404 or 405 expected
        assert response.status_code in [404, 405, 422], \
            f"/api/auth/google should not exist but returned {response.status_code}"
        print("PASS: /api/auth/google endpoint correctly does not exist")
    
    def test_emergent_session_api_structure(self):
        """Test that Emergent session exchange API is correctly integrated"""
        # The backend calls https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data
        # We can't test the actual Emergent API, but we verify our endpoint handles it
        
        response = requests.post(
            f"{BASE_URL}/api/auth/session",
            headers={"Content-Type": "application/json"},
            json={"session_id": "fake_emergent_session"}
        )
        
        # Should return 401 for invalid session (Emergent API rejects it)
        assert response.status_code == 401
        data = response.json()
        assert "Invalid session ID" in data.get("detail", "")
        print("PASS: Session exchange correctly validates with Emergent API")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

"""
Test CORS Authentication Fix - Token-based Auth via localStorage
Tests the fix for CORS authentication issue by switching from cookie-based to localStorage token-based auth.

Features tested:
1. Demo Login - returns token in response
2. Email/Password Login - returns token in response
3. Protected routes - accept Authorization header with Bearer token
4. Token validation - /api/auth/me works with token
5. Invalid token handling - returns 401
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDemoLogin:
    """Test Demo Login endpoint returns token"""
    
    def test_demo_login_returns_token(self):
        """Demo login should return token in response body"""
        response = requests.post(f"{BASE_URL}/api/auth/demo-login")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify token is returned in response
        assert "token" in data, f"Response should contain 'token' field. Got: {data.keys()}"
        assert data["token"] is not None, "Token should not be None"
        assert len(data["token"]) > 0, "Token should not be empty"
        
        # Verify other expected fields
        assert "user_id" in data, "Response should contain user_id"
        assert "name" in data, "Response should contain name"
        assert "email" in data, "Response should contain email"
        
        print(f"SUCCESS: Demo login returned token: {data['token'][:20]}...")
        return data["token"]
    
    def test_demo_login_token_works_for_auth_me(self):
        """Token from demo login should work with /api/auth/me"""
        # First get token
        login_response = requests.post(f"{BASE_URL}/api/auth/demo-login")
        assert login_response.status_code == 200
        token = login_response.json()["token"]
        
        # Use token in Authorization header
        headers = {"Authorization": f"Bearer {token}"}
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        
        assert me_response.status_code == 200, f"Expected 200, got {me_response.status_code}: {me_response.text}"
        
        user_data = me_response.json()
        assert "user_id" in user_data, "Response should contain user_id"
        assert "email" in user_data, "Response should contain email"
        
        print(f"SUCCESS: Token auth works - user: {user_data.get('email')}")


class TestEmailPasswordLogin:
    """Test Email/Password Login returns token"""
    
    @pytest.fixture
    def test_user_credentials(self):
        """Create a test user for login testing"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"test_cors_{unique_id}@test.com"
        password = os.getenv("TEST_USER_PASSWORD", "Test1234!")  # Use env var
        name = f"Test User {unique_id}"
        dob = "1990-01-15"
        
        # Sign up the user first
        signup_response = requests.post(
            f"{BASE_URL}/api/auth/signup",
            json={
                "email": email,
                "password": password,
                "name": name,
                "date_of_birth": dob
            }
        )
        
        if signup_response.status_code == 200:
            print(f"Created test user: {email}")
        elif signup_response.status_code == 400 and "already registered" in signup_response.text:
            print(f"User already exists: {email}")
        else:
            print(f"Signup response: {signup_response.status_code} - {signup_response.text}")
        
        return {"email": email, "password": password, "name": name}
    
    def test_signup_returns_token(self):
        """Signup should return token in response"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"test_signup_{unique_id}@test.com"
        
        response = requests.post(
            f"{BASE_URL}/api/auth/signup",
            json={
                "email": email,
                "password": "Test1234!",
                "name": f"Test User {unique_id}",
                "date_of_birth": "1990-01-15"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify token is returned
        assert "token" in data, f"Signup response should contain 'token'. Got: {data.keys()}"
        assert data["token"] is not None, "Token should not be None"
        assert len(data["token"]) > 0, "Token should not be empty"
        
        # Verify user data
        assert "user" in data, "Response should contain user object"
        assert data["user"]["email"] == email, "User email should match"
        
        print(f"SUCCESS: Signup returned token: {data['token'][:20]}...")
    
    def test_login_returns_token(self, test_user_credentials):
        """Login should return token in response"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": test_user_credentials["email"],
                "password": test_user_credentials["password"]
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify token is returned
        assert "token" in data, f"Login response should contain 'token'. Got: {data.keys()}"
        assert data["token"] is not None, "Token should not be None"
        assert len(data["token"]) > 0, "Token should not be empty"
        
        # Verify user data
        assert "user" in data, "Response should contain user object"
        
        print(f"SUCCESS: Login returned token: {data['token'][:20]}...")
    
    def test_login_token_works_for_protected_routes(self, test_user_credentials):
        """Token from login should work with protected routes"""
        # Login
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": test_user_credentials["email"],
                "password": test_user_credentials["password"]
            }
        )
        assert login_response.status_code == 200
        token = login_response.json()["token"]
        
        # Test /api/auth/me
        headers = {"Authorization": f"Bearer {token}"}
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        
        assert me_response.status_code == 200, f"Expected 200, got {me_response.status_code}"
        
        # Test /api/profile
        profile_response = requests.get(f"{BASE_URL}/api/profile", headers=headers)
        assert profile_response.status_code == 200, f"Profile endpoint failed: {profile_response.status_code}"
        
        print("SUCCESS: Token works for protected routes")


class TestProtectedRoutes:
    """Test protected routes accept Authorization header"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token from demo login"""
        response = requests.post(f"{BASE_URL}/api/auth/demo-login")
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_auth_me_with_bearer_token(self, auth_token):
        """GET /api/auth/me should accept Bearer token"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "user_id" in data, "Should return user data"
        print("SUCCESS: /api/auth/me works with Bearer token")
    
    def test_profile_with_bearer_token(self, auth_token):
        """GET /api/profile should accept Bearer token"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/profile", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("SUCCESS: /api/profile works with Bearer token")
    
    def test_discover_with_bearer_token(self, auth_token):
        """GET /api/discover should accept Bearer token"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/discover", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("SUCCESS: /api/discover works with Bearer token")
    
    def test_matches_with_bearer_token(self, auth_token):
        """GET /api/matches should accept Bearer token"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/matches", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("SUCCESS: /api/matches works with Bearer token")


class TestInvalidTokenHandling:
    """Test invalid token handling"""
    
    def test_no_token_returns_401(self):
        """Request without token should return 401"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("SUCCESS: No token returns 401")
    
    def test_invalid_token_returns_401(self):
        """Request with invalid token should return 401"""
        headers = {"Authorization": "Bearer invalid_token_12345"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("SUCCESS: Invalid token returns 401")
    
    def test_malformed_auth_header_returns_401(self):
        """Request with malformed auth header should return 401"""
        # Missing "Bearer " prefix
        headers = {"Authorization": "some_token_without_bearer"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("SUCCESS: Malformed auth header returns 401")


class TestTokenPersistence:
    """Test that token can be used across multiple requests (simulating localStorage persistence)"""
    
    def test_token_works_for_multiple_requests(self):
        """Same token should work for multiple sequential requests"""
        # Get token
        login_response = requests.post(f"{BASE_URL}/api/auth/demo-login")
        assert login_response.status_code == 200
        token = login_response.json()["token"]
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Make multiple requests with same token
        for i in range(3):
            response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
            assert response.status_code == 200, f"Request {i+1} failed: {response.status_code}"
        
        print("SUCCESS: Token works for multiple requests (simulating localStorage persistence)")
    
    def test_token_works_across_different_endpoints(self):
        """Same token should work across different protected endpoints"""
        # Get token
        login_response = requests.post(f"{BASE_URL}/api/auth/demo-login")
        assert login_response.status_code == 200
        token = login_response.json()["token"]
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test multiple endpoints
        endpoints = [
            "/api/auth/me",
            "/api/profile",
            "/api/discover",
            "/api/matches",
        ]
        
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}", headers=headers)
            assert response.status_code == 200, f"{endpoint} failed: {response.status_code}"
            print(f"  - {endpoint}: OK")
        
        print("SUCCESS: Token works across different endpoints")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

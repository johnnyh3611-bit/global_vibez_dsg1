"""
Test Firebase Push Notifications and Google Auth Integration
P1 Verification Tests for Global Vibez DSG
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestFirebaseNotifications:
    """Firebase Push Notifications Integration Tests"""
    
    def test_notification_status_endpoint(self):
        """Test /api/notifications/status - Check Firebase Admin SDK initialization"""
        response = requests.get(f"{BASE_URL}/api/notifications/status")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        assert "registered_tokens" in data
        assert data["firebase_configured"]
        assert data["admin_sdk_configured"]
        print(f"✅ Firebase Admin SDK initialized: {data['admin_sdk_configured']}")
        print(f"✅ Registered tokens: {data['registered_tokens']}")
    
    def test_fcm_token_registration(self):
        """Test /api/notifications/register - FCM token registration"""
        test_token = f"test_fcm_token_{os.urandom(8).hex()}"
        test_user_id = f"test_user_{os.urandom(4).hex()}"
        
        response = requests.post(
            f"{BASE_URL}/api/notifications/register",
            params={"user_id": test_user_id},
            json={"fcm_token": test_token}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert data["message"] == "FCM token registered successfully"
        assert data["user_id"] == test_user_id
        print(f"✅ FCM token registered for user: {test_user_id}")
    
    def test_fcm_token_registration_anonymous(self):
        """Test FCM token registration without user_id (anonymous)"""
        test_token = f"test_fcm_token_anon_{os.urandom(8).hex()}"
        
        response = requests.post(
            f"{BASE_URL}/api/notifications/register",
            json={"fcm_token": test_token}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert data["user_id"] == "anonymous"
        print("✅ Anonymous FCM token registration works")
    
    def test_send_notification_no_tokens(self):
        """Test /api/notifications/send - Send to user with no tokens"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/send",
            json={
                "user_id": "nonexistent_user_12345",
                "title": "Test Notification",
                "body": "This is a test"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert not data["success"]
        assert "No active FCM tokens found" in data["message"]
        print("✅ Send notification handles missing tokens gracefully")
    
    def test_send_notification_with_token(self):
        """Test sending notification to user with registered token"""
        # First register a token
        test_user_id = f"test_notif_user_{os.urandom(4).hex()}"
        test_token = f"test_fcm_token_{os.urandom(8).hex()}"
        
        reg_response = requests.post(
            f"{BASE_URL}/api/notifications/register",
            params={"user_id": test_user_id},
            json={"fcm_token": test_token}
        )
        assert reg_response.status_code == 200
        
        # Now send notification
        send_response = requests.post(
            f"{BASE_URL}/api/notifications/send",
            json={
                "user_id": test_user_id,
                "title": "Test Notification",
                "body": "This is a test notification",
                "data": {"type": "test"}
            }
        )
        
        assert send_response.status_code == 200
        data = send_response.json()
        assert data["success"]
        assert data["total_tokens"] == 1
        # Token will fail because it's fake, but endpoint works
        print(f"✅ Send notification endpoint works (failed: {data['failed']} - expected for fake token)")
    
    def test_notification_broadcast(self):
        """Test /api/notifications/test - Broadcast test notification"""
        response = requests.post(f"{BASE_URL}/api/notifications/test")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "total_tokens" in data
        print(f"✅ Broadcast endpoint works (sent to {data['successful']}/{data['total_tokens']} devices)")


class TestGoogleAuth:
    """Google Auth (Emergent-managed OAuth) Integration Tests"""
    
    def test_auth_session_invalid(self):
        """Test /api/auth/session - Invalid session ID returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/session",
            json={"session_id": "invalid_session_12345"}
        )
        
        assert response.status_code == 401
        data = response.json()
        assert data["detail"] == "Invalid session ID"
        print("✅ Invalid session ID correctly rejected")
    
    def test_demo_login(self):
        """Test /api/auth/demo-login - Demo login creates session"""
        response = requests.post(f"{BASE_URL}/api/auth/demo-login")
        
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert data["email"] == "demo@globalvibez.com"
        assert data["name"] == "Demo User"
        assert data["profile_completed"]
        assert "session_token" in response.cookies or "set-cookie" in response.headers
        print(f"✅ Demo login successful: {data['user_id']}")
        return response.cookies
    
    def test_auth_me_with_session(self):
        """Test /api/auth/me - Get current user with valid session"""
        # First login
        login_response = requests.post(f"{BASE_URL}/api/auth/demo-login")
        assert login_response.status_code == 200
        cookies = login_response.cookies
        
        # Then get current user
        me_response = requests.get(f"{BASE_URL}/api/auth/me", cookies=cookies)
        
        assert me_response.status_code == 200
        data = me_response.json()
        assert "user_id" in data
        assert "email" in data
        print(f"✅ Auth me returns user: {data['email']}")
    
    def test_auth_me_without_session(self):
        """Test /api/auth/me - Returns 401 without session"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        
        assert response.status_code == 401
        data = response.json()
        assert data["detail"] == "Not authenticated"
        print("✅ Auth me correctly rejects unauthenticated requests")
    
    def test_logout(self):
        """Test /api/auth/logout - Logout clears session"""
        # First login
        login_response = requests.post(f"{BASE_URL}/api/auth/demo-login")
        cookies = login_response.cookies
        
        # Logout
        logout_response = requests.post(f"{BASE_URL}/api/auth/logout", cookies=cookies)
        
        assert logout_response.status_code == 200
        data = logout_response.json()
        assert data["message"] == "Logged out successfully"
        print("✅ Logout successful")
    
    def test_test_user_creation(self):
        """Test /api/auth/test-user - Creates unique test user"""
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "email" in data
        assert "session_token" in data
        assert data["profile_completed"]
        assert data["user_id"].startswith("test_")
        print(f"✅ Test user created: {data['user_id']}")


class TestFirebaseServiceAccount:
    """Firebase Service Account Configuration Tests"""
    
    def test_service_account_file_exists(self):
        """Verify firebase-service-account.json exists"""
        service_account_path = "/home/johnnie/master-project/firebase-service-account.json"
        assert os.path.exists(service_account_path), "Firebase service account file missing"
        print("✅ Firebase service account file exists")
    
    def test_service_account_valid_json(self):
        """Verify service account file is valid JSON"""
        import json
        service_account_path = "/home/johnnie/master-project/firebase-service-account.json"
        
        with open(service_account_path, 'r') as f:
            data = json.load(f)
        
        # Check required fields
        required_fields = ["type", "project_id", "private_key", "client_email"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        assert data["type"] == "service_account"
        assert data["project_id"] == "global-vibez-dsg"
        print(f"✅ Service account valid for project: {data['project_id']}")


class TestFrontendFirebaseConfig:
    """Frontend Firebase Configuration Tests"""
    
    def test_frontend_env_variables(self):
        """Verify all Firebase env variables are set in frontend/.env"""
        env_path = "/app/frontend/.env"
        
        with open(env_path, 'r') as f:
            env_content = f.read()
        
        required_vars = [
            "REACT_APP_FIREBASE_API_KEY",
            "REACT_APP_FIREBASE_AUTH_DOMAIN",
            "REACT_APP_FIREBASE_PROJECT_ID",
            "REACT_APP_FIREBASE_STORAGE_BUCKET",
            "REACT_APP_FIREBASE_MESSAGING_SENDER_ID",
            "REACT_APP_FIREBASE_APP_ID",
            "REACT_APP_FIREBASE_MEASUREMENT_ID",
            "REACT_APP_FIREBASE_VAPID_KEY"
        ]
        
        for var in required_vars:
            assert var in env_content, f"Missing env variable: {var}"
            # Check it has a value (not empty)
            line = [l for l in env_content.split('\n') if l.startswith(var)]
            assert len(line) > 0 and '=' in line[0] and len(line[0].split('=')[1]) > 0, f"Empty value for: {var}"
        
        print(f"✅ All {len(required_vars)} Firebase env variables present")
    
    def test_service_worker_accessible(self):
        """Verify firebase-messaging-sw.js is accessible"""
        response = requests.get(f"{BASE_URL}/firebase-messaging-sw.js")
        
        assert response.status_code == 200
        assert "firebase" in response.text.lower()
        assert "messaging" in response.text.lower()
        print("✅ Firebase service worker accessible")


class TestEmergentAuthEndpoint:
    """Test Emergent Auth Integration"""
    
    def test_emergent_auth_endpoint_reachable(self):
        """Verify Emergent auth endpoint is reachable"""
        # This tests that the endpoint exists and responds
        # We can't test actual OAuth flow without browser
        response = requests.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": "test_invalid_session"}
        )
        
        # Should return 401 or 400 for invalid session, not 500 or connection error
        assert response.status_code in [400, 401, 403, 404]
        print(f"✅ Emergent auth endpoint reachable (status: {response.status_code})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

"""
Trust & Safety Features Backend Tests
Tests for: ID Verification, User Reporting & Blocking, Driver Ratings & Reviews
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSetup:
    """Setup test users and sessions"""
    
    @pytest.fixture(scope="class")
    def test_user_1(self):
        """Create first test user"""
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        assert response.status_code == 200, f"Failed to create test user 1: {response.text}"
        data = response.json()
        return {
            "user_id": data["user_id"],
            "session_token": data["session_token"],
            "email": data["email"]
        }
    
    @pytest.fixture(scope="class")
    def test_user_2(self):
        """Create second test user"""
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        assert response.status_code == 200, f"Failed to create test user 2: {response.text}"
        data = response.json()
        return {
            "user_id": data["user_id"],
            "session_token": data["session_token"],
            "email": data["email"]
        }
    
    @pytest.fixture(scope="class")
    def auth_headers_1(self, test_user_1):
        """Auth headers for user 1"""
        return {
            "Authorization": f"Bearer {test_user_1['session_token']}",
            "Content-Type": "application/json"
        }
    
    @pytest.fixture(scope="class")
    def auth_headers_2(self, test_user_2):
        """Auth headers for user 2"""
        return {
            "Authorization": f"Bearer {test_user_2['session_token']}",
            "Content-Type": "application/json"
        }


class TestReportsEndpoints(TestSetup):
    """Test User Reporting & Blocking endpoints"""
    
    # ==================== REPORT USER ====================
    
    def test_report_user_success(self, auth_headers_1, test_user_2):
        """Test reporting a user successfully"""
        response = requests.post(
            f"{BASE_URL}/api/reports/user",
            headers=auth_headers_1,
            json={
                "reported_user_id": test_user_2["user_id"],
                "reason": "harassment",
                "description": "Test report for harassment"
            }
        )
        assert response.status_code == 200, f"Report user failed: {response.text}"
        data = response.json()
        assert data["success"]
        assert "report" in data
        assert data["report"]["reason"] == "harassment"
        assert data["report"]["status"] == "pending"
    
    def test_report_user_without_auth(self, test_user_2):
        """Test reporting without authentication"""
        response = requests.post(
            f"{BASE_URL}/api/reports/user",
            json={
                "reported_user_id": test_user_2["user_id"],
                "reason": "spam"
            }
        )
        assert response.status_code == 401
    
    def test_report_content_success(self, auth_headers_1, test_user_2):
        """Test reporting content successfully"""
        response = requests.post(
            f"{BASE_URL}/api/reports/content",
            headers=auth_headers_1,
            json={
                "content_type": "photo",
                "content_id": f"photo_{uuid.uuid4().hex[:8]}",
                "reported_user_id": test_user_2["user_id"],
                "reason": "inappropriate_content",
                "description": "Test content report"
            }
        )
        assert response.status_code == 200, f"Report content failed: {response.text}"
        data = response.json()
        assert data["success"]
        assert data["report"]["content_type"] == "photo"
    
    # ==================== BLOCK USER ====================
    
    def test_block_user_success(self, auth_headers_1, test_user_2):
        """Test blocking a user successfully"""
        response = requests.post(
            f"{BASE_URL}/api/reports/block/{test_user_2['user_id']}",
            headers=auth_headers_1
        )
        assert response.status_code == 200, f"Block user failed: {response.text}"
        data = response.json()
        assert data["success"]
    
    def test_block_user_duplicate(self, auth_headers_1, test_user_2):
        """Test blocking same user twice returns success (idempotent)"""
        response = requests.post(
            f"{BASE_URL}/api/reports/block/{test_user_2['user_id']}",
            headers=auth_headers_1
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "already blocked" in data["message"].lower()
    
    def test_get_blocked_users(self, auth_headers_1):
        """Test getting list of blocked users"""
        response = requests.get(
            f"{BASE_URL}/api/reports/blocked",
            headers=auth_headers_1
        )
        assert response.status_code == 200, f"Get blocked users failed: {response.text}"
        data = response.json()
        assert "blocked_users" in data
        assert "count" in data
        assert isinstance(data["blocked_users"], list)
    
    def test_check_if_blocked(self, auth_headers_1, test_user_2):
        """Test checking if a user is blocked"""
        response = requests.get(
            f"{BASE_URL}/api/reports/is-blocked/{test_user_2['user_id']}",
            headers=auth_headers_1
        )
        assert response.status_code == 200, f"Check blocked failed: {response.text}"
        data = response.json()
        assert "blocked_by_me" in data
        assert "blocked_me" in data
        assert "can_contact" in data
        assert data["blocked_by_me"]  # We blocked them earlier
    
    def test_unblock_user_success(self, auth_headers_1, test_user_2):
        """Test unblocking a user successfully"""
        response = requests.post(
            f"{BASE_URL}/api/reports/unblock/{test_user_2['user_id']}",
            headers=auth_headers_1
        )
        assert response.status_code == 200, f"Unblock user failed: {response.text}"
        data = response.json()
        assert data["success"]
    
    def test_unblock_user_not_blocked(self, auth_headers_1, test_user_2):
        """Test unblocking a user that's not blocked"""
        response = requests.post(
            f"{BASE_URL}/api/reports/unblock/{test_user_2['user_id']}",
            headers=auth_headers_1
        )
        assert response.status_code == 404  # User not blocked
    
    # ==================== MY REPORTS ====================
    
    def test_get_my_reports(self, auth_headers_1):
        """Test getting user's submitted reports"""
        response = requests.get(
            f"{BASE_URL}/api/reports/my-reports",
            headers=auth_headers_1
        )
        assert response.status_code == 200, f"Get my reports failed: {response.text}"
        data = response.json()
        assert "user_reports" in data
        assert "content_reports" in data
        assert "total" in data


class TestVerificationEndpoints(TestSetup):
    """Test ID Verification endpoints"""
    
    def test_verification_upload_success(self, auth_headers_1):
        """Test submitting verification documents"""
        response = requests.post(
            f"{BASE_URL}/api/verification/upload",
            headers=auth_headers_1,
            json={
                "document_type": "drivers_license",
                "document_url": "https://example.com/test_id.jpg",
                "selfie_url": "https://example.com/test_selfie.jpg"
            }
        )
        # May return 400 if already has pending/approved verification
        assert response.status_code in [200, 400], f"Verification upload failed: {response.text}"
        if response.status_code == 200:
            data = response.json()
            assert "verification_id" in data
            assert data["status"] == "pending"
    
    def test_verification_status(self, auth_headers_1):
        """Test getting verification status"""
        response = requests.get(
            f"{BASE_URL}/api/verification/status",
            headers=auth_headers_1
        )
        assert response.status_code == 200, f"Get verification status failed: {response.text}"
        data = response.json()
        assert "status" in data
        assert data["status"] in ["unverified", "pending", "approved", "denied"]
    
    def test_verification_admin_pending(self, auth_headers_1):
        """Test getting pending verifications (admin endpoint)"""
        response = requests.get(
            f"{BASE_URL}/api/verification/admin/pending",
            headers=auth_headers_1
        )
        assert response.status_code == 200, f"Get pending verifications failed: {response.text}"
        data = response.json()
        assert "pending_count" in data
        assert "verifications" in data
    
    def test_verification_admin_stats(self, auth_headers_1):
        """Test getting verification statistics (admin endpoint)"""
        response = requests.get(
            f"{BASE_URL}/api/verification/admin/stats",
            headers=auth_headers_1
        )
        assert response.status_code == 200, f"Get verification stats failed: {response.text}"
        data = response.json()
        assert "total_users" in data
        assert "verified_users" in data
        assert "pending_verifications" in data
        assert "verification_rate" in data
    
    def test_verification_without_auth(self):
        """Test verification endpoints without authentication"""
        response = requests.get(f"{BASE_URL}/api/verification/status")
        assert response.status_code == 401


class TestRatingsEndpoints(TestSetup):
    """Test Driver Ratings & Reviews endpoints"""
    
    def test_get_driver_ratings_no_ratings(self, test_user_1):
        """Test getting ratings for a driver with no ratings"""
        response = requests.get(
            f"{BASE_URL}/api/ratings/driver/{test_user_1['user_id']}"
        )
        assert response.status_code == 200, f"Get driver ratings failed: {response.text}"
        data = response.json()
        assert data["driver_id"] == test_user_1["user_id"]
        assert data["average_rating"] == 0
        assert data["total_ratings"] == 0
        assert data["rating_breakdown"] == {5: 0, 4: 0, 3: 0, 2: 0, 1: 0} or data["rating_breakdown"] == {"5": 0, "4": 0, "3": 0, "2": 0, "1": 0}
    
    def test_rate_ride_no_ride(self, auth_headers_1, test_user_2):
        """Test rating a ride that doesn't exist"""
        response = requests.post(
            f"{BASE_URL}/api/ratings/ride",
            headers=auth_headers_1,
            json={
                "ride_id": f"ride_{uuid.uuid4().hex[:12]}",
                "driver_id": test_user_2["user_id"],
                "rating": 5,
                "review_text": "Great ride!",
                "review_tags": ["safe_driving", "friendly"]
            }
        )
        # Should fail because ride doesn't exist
        assert response.status_code == 404, f"Expected 404 for non-existent ride: {response.text}"
    
    def test_rate_ride_invalid_rating(self, auth_headers_1, test_user_2):
        """Test rating with invalid rating value"""
        response = requests.post(
            f"{BASE_URL}/api/ratings/ride",
            headers=auth_headers_1,
            json={
                "ride_id": f"ride_{uuid.uuid4().hex[:12]}",
                "driver_id": test_user_2["user_id"],
                "rating": 10,  # Invalid - should be 1-5
                "review_text": "Test"
            }
        )
        assert response.status_code == 400, f"Expected 400 for invalid rating: {response.text}"
    
    def test_get_my_ratings_not_driver(self, auth_headers_1):
        """Test getting my ratings when not a driver"""
        response = requests.get(
            f"{BASE_URL}/api/ratings/my-ratings",
            headers=auth_headers_1
        )
        # Should fail because user is not registered as a driver
        assert response.status_code == 403, f"Expected 403 for non-driver: {response.text}"
    
    def test_ratings_without_auth(self):
        """Test rating endpoints without authentication"""
        response = requests.post(
            f"{BASE_URL}/api/ratings/ride",
            json={
                "ride_id": "test_ride",
                "driver_id": "test_driver",
                "rating": 5
            }
        )
        assert response.status_code == 401


class TestAdminEndpoints(TestSetup):
    """Test Admin Dashboard endpoints"""
    
    def test_admin_dashboard(self, auth_headers_1):
        """Test admin dashboard stats endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/dashboard",
            headers=auth_headers_1
        )
        assert response.status_code == 200, f"Admin dashboard failed: {response.text}"
        data = response.json()
        # Check expected structure
        assert "users" in data
        assert "messages" in data
        assert "matches" in data
        assert "rides" in data
        assert "alerts" in data
    
    def test_admin_dashboard_without_auth(self):
        """Test admin dashboard without authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/dashboard")
        assert response.status_code == 401


class TestEndpointAuthentication:
    """Test that all endpoints properly require authentication"""
    
    def test_reports_user_requires_auth(self):
        response = requests.post(f"{BASE_URL}/api/reports/user", json={"reported_user_id": "test", "reason": "spam"})
        assert response.status_code == 401
    
    def test_reports_content_requires_auth(self):
        response = requests.post(f"{BASE_URL}/api/reports/content", json={"content_type": "photo", "content_id": "test", "reported_user_id": "test", "reason": "spam"})
        assert response.status_code == 401
    
    def test_reports_block_requires_auth(self):
        response = requests.post(f"{BASE_URL}/api/reports/block/test_user")
        assert response.status_code == 401
    
    def test_reports_unblock_requires_auth(self):
        response = requests.post(f"{BASE_URL}/api/reports/unblock/test_user")
        assert response.status_code == 401
    
    def test_reports_blocked_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/reports/blocked")
        assert response.status_code == 401
    
    def test_reports_is_blocked_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/reports/is-blocked/test_user")
        assert response.status_code == 401
    
    def test_reports_my_reports_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/reports/my-reports")
        assert response.status_code == 401
    
    def test_verification_upload_requires_auth(self):
        response = requests.post(f"{BASE_URL}/api/verification/upload", json={"document_type": "passport", "document_url": "test", "selfie_url": "test"})
        assert response.status_code == 401
    
    def test_verification_status_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/verification/status")
        assert response.status_code == 401
    
    def test_ratings_ride_requires_auth(self):
        response = requests.post(f"{BASE_URL}/api/ratings/ride", json={"ride_id": "test", "driver_id": "test", "rating": 5})
        assert response.status_code == 401
    
    def test_ratings_my_ratings_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/ratings/my-ratings")
        assert response.status_code == 401


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

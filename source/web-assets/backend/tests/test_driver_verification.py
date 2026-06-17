"""
Test suite for Driver License Verification APIs (Vibes Rides feature)
Tests: driver license upload, selfie upload, verification submission, status check, admin review
Prerequisite: User must be age verified (18+) before driver verification
"""

import pytest
import requests
import os
from io import BytesIO
from PIL import Image

# Base URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials - AGE VERIFIED user (can apply for driver verification)
AGE_VERIFIED_SESSION_TOKEN = os.environ.get('TEST_SESSION_TOKEN', 'test_session_fixture')
AGE_VERIFIED_USER_ID = os.environ.get('TEST_USER_ID', 'test_user_fixture')

# Test credentials - NON AGE VERIFIED user (should be blocked from driver verification)
NON_VERIFIED_SESSION_TOKEN = os.environ.get('TEST_SESSION_TOKEN_NOAGE', 'test_session_noage_fixture')
NON_VERIFIED_USER_ID = os.environ.get('TEST_USER_ID_NOAGE', 'test_user_noage_fixture')


@pytest.fixture
def age_verified_client():
    """Requests session for age-verified user"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {AGE_VERIFIED_SESSION_TOKEN}"
    })
    return session


@pytest.fixture
def non_verified_client():
    """Requests session for non-age-verified user"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {NON_VERIFIED_SESSION_TOKEN}"
    })
    return session


@pytest.fixture
def create_test_image():
    """Create a simple test image for uploads"""
    def _create_image(filename="test_license.jpg"):
        img = Image.new('RGB', (200, 125), color='blue')  # Driver license ratio
        img_bytes = BytesIO()
        img.save(img_bytes, format='JPEG')
        img_bytes.seek(0)
        return img_bytes, filename
    return _create_image


class TestDriverLicenseHealthCheck:
    """Basic health checks for driver verification endpoints"""
    
    def test_api_root(self, age_verified_client):
        """Test API is accessible"""
        response = age_verified_client.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print("API Health Check: PASS")
    
    def test_age_verified_user_auth(self, age_verified_client):
        """Test that age-verified session token works"""
        response = age_verified_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Auth failed: {response.text}"
        data = response.json()
        assert data["user_id"] == AGE_VERIFIED_USER_ID
        # Note: /api/auth/me doesn't return age_verified field (known issue)
        # Verify via driver-verification/status instead
        status_resp = age_verified_client.get(f"{BASE_URL}/api/driver-verification/status")
        status_data = status_resp.json()
        assert status_data.get("age_verified"), "User should be age verified (checked via status endpoint)"
        print(f"Age Verified User Auth: PASS - {data['name']}")
    
    def test_non_verified_user_auth(self, non_verified_client):
        """Test that non-verified session token works"""
        response = non_verified_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Auth failed: {response.text}"
        data = response.json()
        assert data["user_id"] == NON_VERIFIED_USER_ID
        # Note: age_verified might be False or missing
        print(f"Non-Verified User Auth: PASS - {data['name']}")


class TestDriverLicenseUpload:
    """Test POST /api/uploads/driver-license endpoint"""
    
    def test_upload_driver_license_success(self, age_verified_client, create_test_image):
        """Test successful driver license photo upload"""
        img_bytes, filename = create_test_image("test_driver_license.jpg")
        
        files = {
            'file': (filename, img_bytes, 'image/jpeg')
        }
        
        response = age_verified_client.post(
            f"{BASE_URL}/api/uploads/driver-license",
            files=files
        )
        
        assert response.status_code == 200, f"Driver license upload failed: {response.text}"
        data = response.json()
        assert "file_url" in data
        assert "message" in data
        assert data["file_url"].startswith("/api/uploads/driver_licenses/")
        print(f"Driver License Upload: PASS - {data['file_url']}")
    
    def test_upload_driver_license_no_file(self, age_verified_client):
        """Test driver license upload without file returns error"""
        response = age_verified_client.post(f"{BASE_URL}/api/uploads/driver-license")
        assert response.status_code == 422  # Validation error
        print("Driver License Upload (no file): PASS - 422 returned as expected")
    
    def test_upload_driver_license_unauthenticated(self):
        """Test driver license upload without auth returns 401"""
        response = requests.post(f"{BASE_URL}/api/uploads/driver-license")
        assert response.status_code in [401, 422]
        print(f"Driver License Upload (no auth): PASS - {response.status_code} returned")


class TestDriverSelfieUpload:
    """Test POST /api/uploads/driver-selfie endpoint"""
    
    def test_upload_driver_selfie_success(self, age_verified_client, create_test_image):
        """Test successful driver selfie upload"""
        img_bytes, filename = create_test_image("test_driver_selfie.jpg")
        
        files = {
            'file': (filename, img_bytes, 'image/jpeg')
        }
        
        response = age_verified_client.post(
            f"{BASE_URL}/api/uploads/driver-selfie",
            files=files
        )
        
        assert response.status_code == 200, f"Driver selfie upload failed: {response.text}"
        data = response.json()
        assert "file_url" in data
        assert "message" in data
        assert data["file_url"].startswith("/api/uploads/driver_selfies/")
        print(f"Driver Selfie Upload: PASS - {data['file_url']}")


class TestDriverVerificationPrerequisite:
    """Test age verification prerequisite for driver verification"""
    
    def test_non_verified_user_blocked(self, non_verified_client, create_test_image):
        """Test that non-age-verified user cannot submit driver verification"""
        # Upload driver license
        img1, _ = create_test_image("license.jpg")
        license_resp = non_verified_client.post(
            f"{BASE_URL}/api/uploads/driver-license",
            files={'file': ('license.jpg', img1, 'image/jpeg')}
        )
        assert license_resp.status_code == 200
        license_url = license_resp.json()["file_url"]
        
        # Upload selfie
        img2, _ = create_test_image("selfie.jpg")
        selfie_resp = non_verified_client.post(
            f"{BASE_URL}/api/uploads/driver-selfie",
            files={'file': ('selfie.jpg', img2, 'image/jpeg')}
        )
        assert selfie_resp.status_code == 200
        selfie_url = selfie_resp.json()["file_url"]
        
        # Try to submit driver verification - should be blocked
        response = non_verified_client.post(
            f"{BASE_URL}/api/driver-verification/upload",
            json={
                "license_url": license_url,
                "selfie_url": selfie_url
            }
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        data = response.json()
        assert "age verification" in data.get("detail", "").lower()
        print("Age Verification Prerequisite Check: PASS - Non-verified user blocked with 403")


class TestDriverVerificationSubmission:
    """Test POST /api/driver-verification/upload endpoint"""
    
    def test_submit_driver_verification_success(self, age_verified_client, create_test_image):
        """Test submitting driver verification as age-verified user"""
        # Upload driver license
        img1, _ = create_test_image("license.jpg")
        license_resp = age_verified_client.post(
            f"{BASE_URL}/api/uploads/driver-license",
            files={'file': ('license.jpg', img1, 'image/jpeg')}
        )
        assert license_resp.status_code == 200
        license_url = license_resp.json()["file_url"]
        
        # Upload selfie
        img2, _ = create_test_image("selfie.jpg")
        selfie_resp = age_verified_client.post(
            f"{BASE_URL}/api/uploads/driver-selfie",
            files={'file': ('selfie.jpg', img2, 'image/jpeg')}
        )
        assert selfie_resp.status_code == 200
        selfie_url = selfie_resp.json()["file_url"]
        
        # Submit driver verification
        response = age_verified_client.post(
            f"{BASE_URL}/api/driver-verification/upload",
            json={
                "license_url": license_url,
                "selfie_url": selfie_url
            }
        )
        
        # May be 200 (success) or 400 (already has pending/approved)
        if response.status_code == 200:
            data = response.json()
            assert "verification_id" in data
            assert data["status"] == "pending"
            assert "message" in data
            print(f"Driver Verification Submission: PASS - {data['verification_id']}")
        elif response.status_code == 400:
            data = response.json()
            assert "already" in data.get("detail", "").lower()
            print("Driver Verification Submission: PASS - Already has pending/approved verification")
        else:
            pytest.fail(f"Unexpected status: {response.status_code} - {response.text}")


class TestDriverVerificationDuplicatePrevention:
    """Test that duplicate submissions are prevented"""
    
    def test_duplicate_submission_blocked(self, age_verified_client, create_test_image):
        """Test that user with pending verification cannot submit again"""
        # First check current status
        status_resp = age_verified_client.get(f"{BASE_URL}/api/driver-verification/status")
        status_data = status_resp.json()
        
        if status_data["status"] not in ["pending", "approved"]:
            # Need to create a verification first
            img1, _ = create_test_image("license2.jpg")
            license_resp = age_verified_client.post(
                f"{BASE_URL}/api/uploads/driver-license",
                files={'file': ('license2.jpg', img1, 'image/jpeg')}
            )
            license_url = license_resp.json()["file_url"]
            
            img2, _ = create_test_image("selfie2.jpg")
            selfie_resp = age_verified_client.post(
                f"{BASE_URL}/api/uploads/driver-selfie",
                files={'file': ('selfie2.jpg', img2, 'image/jpeg')}
            )
            selfie_url = selfie_resp.json()["file_url"]
            
            # Submit first verification
            first_submit = age_verified_client.post(
                f"{BASE_URL}/api/driver-verification/upload",
                json={"license_url": license_url, "selfie_url": selfie_url}
            )
            assert first_submit.status_code == 200
        
        # Now try to submit again - should be blocked
        img3, _ = create_test_image("license3.jpg")
        license_resp2 = age_verified_client.post(
            f"{BASE_URL}/api/uploads/driver-license",
            files={'file': ('license3.jpg', img3, 'image/jpeg')}
        )
        license_url2 = license_resp2.json()["file_url"]
        
        img4, _ = create_test_image("selfie3.jpg")
        selfie_resp2 = age_verified_client.post(
            f"{BASE_URL}/api/uploads/driver-selfie",
            files={'file': ('selfie3.jpg', img4, 'image/jpeg')}
        )
        selfie_url2 = selfie_resp2.json()["file_url"]
        
        duplicate_submit = age_verified_client.post(
            f"{BASE_URL}/api/driver-verification/upload",
            json={"license_url": license_url2, "selfie_url": selfie_url2}
        )
        
        assert duplicate_submit.status_code == 400, f"Expected 400, got {duplicate_submit.status_code}"
        data = duplicate_submit.json()
        assert "already" in data.get("detail", "").lower()
        print("Duplicate Submission Prevention: PASS - Second submission blocked")


class TestDriverVerificationStatus:
    """Test GET /api/driver-verification/status endpoint"""
    
    def test_get_status_age_verified_user(self, age_verified_client):
        """Test getting driver verification status"""
        response = age_verified_client.get(f"{BASE_URL}/api/driver-verification/status")
        
        assert response.status_code == 200, f"Status check failed: {response.text}"
        data = response.json()
        
        # Status should be one of: unverified, pending, approved, denied
        assert "status" in data
        assert data["status"] in ["unverified", "pending", "approved", "denied"]
        assert "message" in data
        assert "age_verified" in data
        assert data["age_verified"]
        print(f"Driver Verification Status: PASS - Status: {data['status']}")
    
    def test_status_unauthenticated(self):
        """Test status check without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/driver-verification/status")
        assert response.status_code == 401
        print("Driver Verification Status (no auth): PASS - 401 returned")


class TestAdminDriverVerificationEndpoints:
    """Test admin endpoints for driver verification"""
    
    def test_get_pending_driver_verifications(self, age_verified_client):
        """Test GET /api/driver-verification/admin/pending"""
        response = age_verified_client.get(f"{BASE_URL}/api/driver-verification/admin/pending")
        
        assert response.status_code == 200, f"Admin pending failed: {response.text}"
        data = response.json()
        
        assert "pending_count" in data
        assert "verifications" in data
        assert isinstance(data["verifications"], list)
        
        # If there are pending verifications, check structure
        if data["pending_count"] > 0:
            verification = data["verifications"][0]
            assert "verification_id" in verification
            assert "user_id" in verification
            assert "license_url" in verification
            assert "selfie_url" in verification
            assert "status" in verification
            assert verification["status"] == "pending"
        print(f"Admin Pending Verifications: PASS - {data['pending_count']} pending")
    
    def test_get_driver_verification_stats(self, age_verified_client):
        """Test GET /api/driver-verification/admin/stats"""
        response = age_verified_client.get(f"{BASE_URL}/api/driver-verification/admin/stats")
        
        assert response.status_code == 200, f"Admin stats failed: {response.text}"
        data = response.json()
        
        # Check expected fields
        assert "total_users" in data
        assert "age_verified_users" in data
        assert "driver_verified_users" in data
        assert "pending_verifications" in data
        assert "approved_verifications" in data
        assert "denied_verifications" in data
        assert "driver_verification_rate" in data
        print(f"Admin Stats: PASS - {data['driver_verified_users']} verified drivers")
    
    def test_review_nonexistent_driver_verification(self, age_verified_client):
        """Test reviewing a nonexistent driver verification returns 404"""
        review_payload = {
            "verification_id": "nonexistent_dlv_12345",
            "status": "approved",
            "license_number_last4": "1234",
            "license_expiry_date": "2028-06-15",
            "license_state": "CA"
        }
        
        response = age_verified_client.post(
            f"{BASE_URL}/api/driver-verification/admin/review",
            json=review_payload
        )
        
        assert response.status_code == 404
        data = response.json()
        assert "not found" in data.get("detail", "").lower()
        print("Admin Review (nonexistent): PASS - 404 returned")


class TestDriverVerificationAdminReview:
    """Test admin review flow for driver verification"""
    
    def test_admin_approve_driver_verification(self, age_verified_client):
        """Test admin approval with license details"""
        # Get pending verifications
        pending_resp = age_verified_client.get(f"{BASE_URL}/api/driver-verification/admin/pending")
        pending_data = pending_resp.json()
        
        if pending_data["pending_count"] == 0:
            pytest.skip("No pending driver verifications to test approval")
        
        verification = pending_data["verifications"][0]
        verification_id = verification["verification_id"]
        
        # Approve the verification
        review_payload = {
            "verification_id": verification_id,
            "status": "approved",
            "license_number_last4": "4567",
            "license_expiry_date": "2029-12-31",
            "license_state": "NY",
            "verification_notes": "Test approval from pytest"
        }
        
        response = age_verified_client.post(
            f"{BASE_URL}/api/driver-verification/admin/review",
            json=review_payload
        )
        
        if response.status_code == 200:
            data = response.json()
            assert "message" in data
            assert "approved" in data["message"].lower()
            print(f"Admin Approval: PASS - {verification_id} approved")
        elif response.status_code == 400:
            # Already reviewed
            assert "already" in response.json().get("detail", "").lower()
            print("Admin Approval: PASS - Verification already reviewed")
        else:
            pytest.fail(f"Unexpected status: {response.status_code} - {response.text}")


class TestDriverVerificationStaticFileServing:
    """Test that uploaded driver files are accessible"""
    
    def test_upload_and_access_driver_license(self, age_verified_client, create_test_image):
        """Test that uploaded driver license can be accessed via static files"""
        img_bytes, filename = create_test_image("test_access_license.jpg")
        
        # Upload driver license
        upload_resp = age_verified_client.post(
            f"{BASE_URL}/api/uploads/driver-license",
            files={'file': (filename, img_bytes, 'image/jpeg')}
        )
        
        assert upload_resp.status_code == 200
        file_url = upload_resp.json()["file_url"]
        
        # Try to access the file
        access_resp = requests.get(f"{BASE_URL}{file_url}")
        assert access_resp.status_code == 200, f"Could not access uploaded file: {file_url}"
        assert access_resp.headers.get('content-type', '').startswith('image/')
        print(f"Static File Access: PASS - {file_url} accessible")


class TestDriverVerificationEndToEndFlow:
    """Complete end-to-end driver verification flow test"""
    
    def test_full_driver_verification_flow(self, age_verified_client, create_test_image):
        """Test complete flow: upload license + selfie -> submit -> status check"""
        # Step 1: Check initial status
        initial_status = age_verified_client.get(f"{BASE_URL}/api/driver-verification/status")
        assert initial_status.status_code == 200
        initial_data = initial_status.json()
        print(f"Initial driver verification status: {initial_data['status']}")
        
        # Verify age_verified is included in status response
        assert "age_verified" in initial_data
        
        # If already approved, just verify status
        if initial_data["status"] == "approved":
            assert "verified" in initial_data.get("message", "").lower() or initial_data["status"] == "approved"
            print("End-to-End Flow: PASS - Already approved")
            return
        
        # Step 2: Upload driver license
        license_img, _ = create_test_image("e2e_license.jpg")
        license_resp = age_verified_client.post(
            f"{BASE_URL}/api/uploads/driver-license",
            files={'file': ('e2e_license.jpg', license_img, 'image/jpeg')}
        )
        assert license_resp.status_code == 200
        license_url = license_resp.json()["file_url"]
        print(f"Driver license uploaded: {license_url}")
        
        # Step 3: Upload selfie
        selfie_img, _ = create_test_image("e2e_selfie.jpg")
        selfie_resp = age_verified_client.post(
            f"{BASE_URL}/api/uploads/driver-selfie",
            files={'file': ('e2e_selfie.jpg', selfie_img, 'image/jpeg')}
        )
        assert selfie_resp.status_code == 200
        selfie_url = selfie_resp.json()["file_url"]
        print(f"Selfie uploaded: {selfie_url}")
        
        # Step 4: Submit driver verification (may fail if already pending)
        submit_resp = age_verified_client.post(
            f"{BASE_URL}/api/driver-verification/upload",
            json={
                "license_url": license_url,
                "selfie_url": selfie_url
            }
        )
        
        if submit_resp.status_code == 200:
            submit_data = submit_resp.json()
            assert submit_data["status"] == "pending"
            print(f"Driver verification submitted: {submit_data['verification_id']}")
        else:
            print(f"Submission returned {submit_resp.status_code}: {submit_resp.text}")
        
        # Step 5: Check final status
        final_status = age_verified_client.get(f"{BASE_URL}/api/driver-verification/status")
        assert final_status.status_code == 200
        final_data = final_status.json()
        print(f"Final driver verification status: {final_data['status']}")
        
        # Status should be pending, approved, or denied (not unverified after submission)
        assert final_data["status"] in ["pending", "approved", "denied"]
        print("End-to-End Flow: PASS")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

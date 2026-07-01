"""
Test suite for Age Verification APIs (Phase 2)
Tests: document upload, selfie upload, verification submission, status check, admin review
"""

import pytest
import requests
import os
from io import BytesIO
from PIL import Image

# Base URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials (load from env or use fixtures)
TEST_SESSION_TOKEN = os.environ.get('TEST_SESSION_TOKEN', 'test_session_fixture')
TEST_USER_ID = os.environ.get('TEST_USER_ID', 'test_user_fixture')


@pytest.fixture
def api_client():
    """Shared requests session with auth"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {TEST_SESSION_TOKEN}"
    })
    return session


@pytest.fixture
def create_test_image():
    """Create a simple test image for uploads"""
    def _create_image(filename="test_doc.jpg"):
        # Create a simple 100x100 red image
        img = Image.new('RGB', (100, 100), color='red')
        img_bytes = BytesIO()
        img.save(img_bytes, format='JPEG')
        img_bytes.seek(0)
        return img_bytes, filename
    return _create_image


class TestHealthCheck:
    """Basic health check to ensure API is accessible"""
    
    def test_api_root(self, api_client):
        """Test API root endpoint"""
        response = api_client.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data


class TestAuthVerification:
    """Verify authentication works with test session"""
    
    def test_auth_me(self, api_client):
        """Test that session token works"""
        response = api_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Auth failed: {response.text}"
        data = response.json()
        assert data["user_id"] == TEST_USER_ID


class TestDocumentUpload:
    """Test POST /api/uploads/verification/document endpoint"""
    
    def test_upload_document_success(self, api_client, create_test_image):
        """Test successful document upload"""
        img_bytes, filename = create_test_image("test_id_doc.jpg")
        
        files = {
            'file': (filename, img_bytes, 'image/jpeg')
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/uploads/verification/document",
            files=files
        )
        
        assert response.status_code == 200, f"Document upload failed: {response.text}"
        data = response.json()
        assert "file_url" in data
        assert "message" in data
        assert "document" in data["message"].lower() or "uploaded" in data["message"].lower()
        assert data["file_url"].startswith("/api/uploads/verification_documents/")
    
    def test_upload_document_no_file(self, api_client):
        """Test document upload without file returns error"""
        response = api_client.post(f"{BASE_URL}/api/uploads/verification/document")
        assert response.status_code == 422  # Validation error
    
    def test_upload_document_unauthenticated(self):
        """Test document upload without auth returns 401"""
        response = requests.post(f"{BASE_URL}/api/uploads/verification/document")
        assert response.status_code in [401, 422]  # Either auth error or validation error


class TestSelfieUpload:
    """Test POST /api/uploads/verification/selfie endpoint"""
    
    def test_upload_selfie_success(self, api_client, create_test_image):
        """Test successful selfie upload"""
        img_bytes, filename = create_test_image("test_selfie.jpg")
        
        files = {
            'file': (filename, img_bytes, 'image/jpeg')
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/uploads/verification/selfie",
            files=files
        )
        
        assert response.status_code == 200, f"Selfie upload failed: {response.text}"
        data = response.json()
        assert "file_url" in data
        assert "message" in data
        assert "selfie" in data["message"].lower() or "uploaded" in data["message"].lower()
        assert data["file_url"].startswith("/api/uploads/verification_selfies/")


class TestVerificationSubmission:
    """Test POST /api/verification/upload endpoint"""
    
    def test_submit_verification_success(self, api_client, create_test_image):
        """Test full verification submission flow: upload docs + submit request"""
        # First, clear any existing verification for this user
        # (by checking status first)
        
        # Upload document
        doc_img, doc_name = create_test_image("id_doc.jpg")
        doc_response = api_client.post(
            f"{BASE_URL}/api/uploads/verification/document",
            files={'file': (doc_name, doc_img, 'image/jpeg')}
        )
        assert doc_response.status_code == 200
        doc_url = doc_response.json()["file_url"]
        
        # Upload selfie
        selfie_img, selfie_name = create_test_image("selfie.jpg")
        selfie_response = api_client.post(
            f"{BASE_URL}/api/uploads/verification/selfie",
            files={'file': (selfie_name, selfie_img, 'image/jpeg')}
        )
        assert selfie_response.status_code == 200
        selfie_url = selfie_response.json()["file_url"]
        
        # Submit verification request
        verification_payload = {
            "document_type": "drivers_license",
            "document_url": doc_url,
            "selfie_url": selfie_url
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/verification/upload",
            json=verification_payload
        )
        
        # May be 200 (success) or 400 (already has pending/approved)
        if response.status_code == 200:
            data = response.json()
            assert "verification_id" in data
            assert data["status"] == "pending"
            assert "message" in data
        elif response.status_code == 400:
            # User already has a pending or approved verification
            data = response.json()
            assert "already" in data.get("detail", "").lower()
        else:
            pytest.fail(f"Unexpected status code: {response.status_code} - {response.text}")
    
    def test_submit_verification_invalid_document_type(self, api_client):
        """Test verification submission with invalid document type"""
        verification_payload = {
            "document_type": "invalid_type",
            "document_url": "/api/uploads/test.jpg",
            "selfie_url": "/api/uploads/selfie.jpg"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/verification/upload",
            json=verification_payload
        )
        
        assert response.status_code == 422  # Validation error


class TestVerificationStatus:
    """Test GET /api/verification/status endpoint"""
    
    def test_get_status(self, api_client):
        """Test getting verification status"""
        response = api_client.get(f"{BASE_URL}/api/verification/status")
        
        assert response.status_code == 200, f"Status check failed: {response.text}"
        data = response.json()
        
        # Status should be one of: unverified, pending, approved, denied
        assert "status" in data
        assert data["status"] in ["unverified", "pending", "approved", "denied"]
        assert "message" in data
    
    def test_status_unauthenticated(self):
        """Test status check without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/verification/status")
        assert response.status_code == 401


class TestAdminPendingVerifications:
    """Test GET /api/verification/admin/pending endpoint"""
    
    def test_get_pending_verifications(self, api_client):
        """Test getting pending verifications list"""
        response = api_client.get(f"{BASE_URL}/api/verification/admin/pending")
        
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
            assert "document_type" in verification
            assert "status" in verification


class TestAdminVerificationStats:
    """Test GET /api/verification/admin/stats endpoint"""
    
    def test_get_stats(self, api_client):
        """Test getting verification statistics"""
        response = api_client.get(f"{BASE_URL}/api/verification/admin/stats")
        
        assert response.status_code == 200, f"Admin stats failed: {response.text}"
        data = response.json()
        
        # Check expected fields in stats
        assert "total_users" in data
        assert "verified_users" in data
        assert "pending_verifications" in data
        assert "approved_verifications" in data
        assert "denied_verifications" in data
        assert "verification_rate" in data


class TestAdminReview:
    """Test POST /api/verification/admin/review endpoint"""
    
    def test_review_nonexistent_verification(self, api_client):
        """Test reviewing a nonexistent verification returns 404"""
        review_payload = {
            "verification_id": "nonexistent_id_12345",
            "status": "approved",
            "extracted_dob": "1995-01-15"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/verification/admin/review",
            json=review_payload
        )
        
        assert response.status_code == 404
        data = response.json()
        assert "not found" in data.get("detail", "").lower()
    
    def test_review_verification_approve(self, api_client, create_test_image):
        """Test approving a verification (full flow test)"""
        # First check if there's already a pending verification for this user
        status_response = api_client.get(f"{BASE_URL}/api/verification/status")
        status_data = status_response.json()
        
        verification_id = None
        
        if status_data["status"] == "pending":
            # Use existing pending verification
            verification_id = status_data.get("verification_id")
        elif status_data["status"] in ["unverified", "denied"]:
            # Create new verification
            doc_img, _ = create_test_image("doc.jpg")
            doc_resp = api_client.post(
                f"{BASE_URL}/api/uploads/verification/document",
                files={'file': ('doc.jpg', doc_img, 'image/jpeg')}
            )
            doc_url = doc_resp.json()["file_url"]
            
            selfie_img, _ = create_test_image("selfie.jpg")
            selfie_resp = api_client.post(
                f"{BASE_URL}/api/uploads/verification/selfie",
                files={'file': ('selfie.jpg', selfie_img, 'image/jpeg')}
            )
            selfie_url = selfie_resp.json()["file_url"]
            
            submit_resp = api_client.post(
                f"{BASE_URL}/api/verification/upload",
                json={
                    "document_type": "passport",
                    "document_url": doc_url,
                    "selfie_url": selfie_url
                }
            )
            
            if submit_resp.status_code == 200:
                verification_id = submit_resp.json()["verification_id"]
        
        # Skip if user already approved or no verification
        if not verification_id:
            pytest.skip("Could not get or create a pending verification for this test")
        
        # Now approve the verification
        review_payload = {
            "verification_id": verification_id,
            "status": "approved",
            "extracted_dob": "1998-06-15",
            "verification_notes": "Test approval from pytest"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/verification/admin/review",
            json=review_payload
        )
        
        if response.status_code == 200:
            data = response.json()
            assert "message" in data
            assert data["verification_id"] == verification_id
            
            # Verify status changed
            status_check = api_client.get(f"{BASE_URL}/api/verification/status")
            assert status_check.status_code == 200
            assert status_check.json()["status"] == "approved"
        elif response.status_code == 400:
            # Already reviewed
            assert "already" in response.json().get("detail", "").lower()
        else:
            pytest.fail(f"Unexpected status: {response.status_code} - {response.text}")


class TestStaticFileServing:
    """Test that uploaded files are accessible via static serving"""
    
    def test_upload_and_access_document(self, api_client, create_test_image):
        """Test that uploaded document can be accessed via static files"""
        img_bytes, filename = create_test_image("test_access_doc.jpg")
        
        # Upload document
        upload_resp = api_client.post(
            f"{BASE_URL}/api/uploads/verification/document",
            files={'file': (filename, img_bytes, 'image/jpeg')}
        )
        
        assert upload_resp.status_code == 200
        file_url = upload_resp.json()["file_url"]
        
        # Try to access the file
        access_resp = requests.get(f"{BASE_URL}{file_url}")
        assert access_resp.status_code == 200, f"Could not access uploaded file: {file_url}"
        assert access_resp.headers.get('content-type', '').startswith('image/')


class TestEndToEndVerificationFlow:
    """Complete end-to-end verification flow test"""
    
    def test_full_verification_flow(self, api_client, create_test_image):
        """Test complete flow: upload -> submit -> status check"""
        # Step 1: Check initial status
        initial_status = api_client.get(f"{BASE_URL}/api/verification/status")
        assert initial_status.status_code == 200
        
        initial_data = initial_status.json()
        print(f"Initial status: {initial_data['status']}")
        
        # If already approved, test is still valid - just verify status endpoint works
        if initial_data["status"] == "approved":
            assert "verified" in initial_data.get("message", "").lower() or "verified" in initial_data["status"]
            return
        
        # Step 2: Upload document
        doc_img, _ = create_test_image("e2e_doc.jpg")
        doc_resp = api_client.post(
            f"{BASE_URL}/api/uploads/verification/document",
            files={'file': ('e2e_doc.jpg', doc_img, 'image/jpeg')}
        )
        assert doc_resp.status_code == 200
        doc_url = doc_resp.json()["file_url"]
        print(f"Document uploaded: {doc_url}")
        
        # Step 3: Upload selfie
        selfie_img, _ = create_test_image("e2e_selfie.jpg")
        selfie_resp = api_client.post(
            f"{BASE_URL}/api/uploads/verification/selfie",
            files={'file': ('e2e_selfie.jpg', selfie_img, 'image/jpeg')}
        )
        assert selfie_resp.status_code == 200
        selfie_url = selfie_resp.json()["file_url"]
        print(f"Selfie uploaded: {selfie_url}")
        
        # Step 4: Submit verification (may fail if already pending)
        submit_resp = api_client.post(
            f"{BASE_URL}/api/verification/upload",
            json={
                "document_type": "national_id",
                "document_url": doc_url,
                "selfie_url": selfie_url
            }
        )
        
        if submit_resp.status_code == 200:
            submit_data = submit_resp.json()
            assert submit_data["status"] == "pending"
            print(f"Verification submitted: {submit_data['verification_id']}")
        else:
            print(f"Verification submission returned {submit_resp.status_code}: {submit_resp.text}")
        
        # Step 5: Check final status
        final_status = api_client.get(f"{BASE_URL}/api/verification/status")
        assert final_status.status_code == 200
        final_data = final_status.json()
        print(f"Final status: {final_data['status']}")
        
        # Status should be pending, approved, or denied (not unverified after submission)
        assert final_data["status"] in ["pending", "approved", "denied"]


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

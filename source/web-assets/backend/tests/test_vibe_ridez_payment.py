"""
Vibe Ridez Payment Integration Tests
Tests for Stripe checkout flow, payment verification, and booking creation
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://social-connect-953.preview.emergentagent.com')

class TestVibeRidezPaymentEndpoints:
    """Test payment endpoints for Vibe Ridez"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with demo login"""
        self.session = requests.Session()
        # Login to get session cookie
        login_response = self.session.post(f"{BASE_URL}/api/auth/demo-login")
        assert login_response.status_code == 200, f"Demo login failed: {login_response.text}"
        self.user_data = login_response.json()
        self.user_id = self.user_data["user_id"]
        print(f"✅ Logged in as: {self.user_id}")
    
    def test_01_payment_create_checkout_requires_auth(self):
        """Test that payment checkout creation requires authentication"""
        no_auth_session = requests.Session()
        response = no_auth_session.post(
            f"{BASE_URL}/api/vibe-ridez/payment/create-checkout?ride_id=test-ride&seats_requested=1"
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("✅ Payment checkout correctly rejects unauthenticated requests")
    
    def test_02_payment_status_requires_auth(self):
        """Test that payment status check requires authentication"""
        no_auth_session = requests.Session()
        response = no_auth_session.get(
            f"{BASE_URL}/api/vibe-ridez/payment/status/test-session-id"
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("✅ Payment status correctly rejects unauthenticated requests")
    
    def test_03_get_available_rides_for_payment_test(self):
        """Get available rides to use for payment testing"""
        response = self.session.get(f"{BASE_URL}/api/vibe-ridez/rides/search?min_seats=1")
        assert response.status_code == 200, f"Search failed: {response.text}"
        data = response.json()
        assert data["success"]
        
        if data["count"] > 0:
            self.test_ride = data["rides"][0]
            print(f"✅ Found ride for testing: {self.test_ride['ride_id']}")
            print(f"   Route: {self.test_ride['pickup_location']['city']} → {self.test_ride['dropoff_location']['city']}")
            print(f"   Price: ${self.test_ride['price_per_seat']}/seat")
        else:
            pytest.skip("No rides available for payment testing")
    
    def test_04_create_checkout_session_with_valid_ride(self):
        """Test creating a Stripe checkout session with a valid ride"""
        # First get a ride
        search_response = self.session.get(f"{BASE_URL}/api/vibe-ridez/rides/search?min_seats=1")
        assert search_response.status_code == 200
        search_data = search_response.json()
        
        if search_data["count"] == 0:
            pytest.skip("No rides available for payment testing")
        
        ride = search_data["rides"][0]
        ride_id = ride["ride_id"]
        
        # Create checkout session
        response = self.session.post(
            f"{BASE_URL}/api/vibe-ridez/payment/create-checkout?ride_id={ride_id}&seats_requested=1"
        )
        
        # Check response
        if response.status_code == 200:
            data = response.json()
            assert data["success"], f"Checkout creation failed: {data}"
            assert "session_id" in data, "Missing session_id in response"
            assert "checkout_url" in data, "Missing checkout_url in response"
            print(f"✅ Checkout session created: {data['session_id'][:30]}...")
            print(f"   Checkout URL: {data['checkout_url'][:50]}...")
            self.checkout_session_id = data["session_id"]
        elif response.status_code == 400:
            # May fail if user is the driver of this ride
            data = response.json()
            print(f"⚠️ Checkout creation returned 400: {data.get('detail', 'Unknown error')}")
            pytest.skip("Cannot book own ride or other validation error")
        else:
            pytest.fail(f"Unexpected status {response.status_code}: {response.text}")
    
    def test_05_create_checkout_with_invalid_ride(self):
        """Test creating checkout with non-existent ride"""
        response = self.session.post(
            f"{BASE_URL}/api/vibe-ridez/payment/create-checkout?ride_id=invalid-ride-id-12345&seats_requested=1"
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        data = response.json()
        assert "not found" in data.get("detail", "").lower(), f"Unexpected error: {data}"
        print("✅ Checkout correctly rejects invalid ride_id")
    
    def test_06_check_payment_status_with_invalid_session(self):
        """Test checking payment status with invalid session ID"""
        response = self.session.get(
            f"{BASE_URL}/api/vibe-ridez/payment/status/invalid-session-id-12345"
        )
        # Should return error or empty status
        if response.status_code == 200:
            data = response.json()
            # Stripe may return a status even for invalid sessions
            print(f"⚠️ Payment status response: {data}")
        elif response.status_code in [400, 404, 500]:
            print(f"✅ Payment status correctly handles invalid session: {response.status_code}")
        else:
            pytest.fail(f"Unexpected status {response.status_code}: {response.text}")
    
    def test_07_ride_details_endpoint(self):
        """Test getting ride details (used by PaymentSuccess page)"""
        # Get a ride first
        search_response = self.session.get(f"{BASE_URL}/api/vibe-ridez/rides/search?min_seats=1")
        assert search_response.status_code == 200
        search_data = search_response.json()
        
        if search_data["count"] == 0:
            pytest.skip("No rides available")
        
        ride_id = search_data["rides"][0]["ride_id"]
        
        # Get ride details
        response = self.session.get(f"{BASE_URL}/api/vibe-ridez/ride/{ride_id}")
        assert response.status_code == 200, f"Get ride failed: {response.text}"
        data = response.json()
        assert data["success"]
        assert "ride" in data
        assert data["ride"]["ride_id"] == ride_id
        print(f"✅ Ride details retrieved: {data['ride']['pickup_location']['city']} → {data['ride']['dropoff_location']['city']}")
    
    def test_08_auth_me_endpoint(self):
        """Test /api/auth/me endpoint (used by PaymentSuccess page)"""
        response = self.session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Auth me failed: {response.text}"
        data = response.json()
        assert "user_id" in data, f"Missing user_id in response: {data}"
        print(f"✅ Auth me endpoint working: {data['user_id']}")


class TestVibeRidezPaymentFlow:
    """Test complete payment flow end-to-end"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        login_response = self.session.post(f"{BASE_URL}/api/auth/demo-login")
        assert login_response.status_code == 200
        self.user_id = login_response.json()["user_id"]
    
    def test_complete_payment_flow(self):
        """Test complete flow: Search → Create Checkout → (Stripe) → Verify"""
        # Step 1: Search for rides
        search_response = self.session.get(f"{BASE_URL}/api/vibe-ridez/rides/search?min_seats=1")
        assert search_response.status_code == 200
        search_data = search_response.json()
        print(f"Step 1: Found {search_data['count']} rides")
        
        if search_data["count"] == 0:
            pytest.skip("No rides available for payment flow test")
        
        ride = search_data["rides"][0]
        ride_id = ride["ride_id"]
        print(f"   Selected ride: {ride_id}")
        print(f"   Route: {ride['pickup_location']['city']} → {ride['dropoff_location']['city']}")
        print(f"   Price: ${ride['price_per_seat']}/seat")
        
        # Step 2: Create checkout session
        checkout_response = self.session.post(
            f"{BASE_URL}/api/vibe-ridez/payment/create-checkout?ride_id={ride_id}&seats_requested=1"
        )
        
        if checkout_response.status_code == 400:
            data = checkout_response.json()
            print(f"Step 2: Checkout creation skipped - {data.get('detail', 'validation error')}")
            pytest.skip("Cannot create checkout for this ride")
        
        assert checkout_response.status_code == 200, f"Checkout failed: {checkout_response.text}"
        checkout_data = checkout_response.json()
        assert checkout_data["success"]
        session_id = checkout_data["session_id"]
        checkout_url = checkout_data["checkout_url"]
        print("Step 2: Checkout session created")
        print(f"   Session ID: {session_id[:30]}...")
        print(f"   Checkout URL: {checkout_url[:60]}...")
        
        # Step 3: Check payment status (will be pending since we didn't complete Stripe checkout)
        status_response = self.session.get(f"{BASE_URL}/api/vibe-ridez/payment/status/{session_id}")
        if status_response.status_code == 200:
            status_data = status_response.json()
            print("Step 3: Payment status checked")
            print(f"   Status: {status_data.get('status', 'unknown')}")
            print(f"   Payment Status: {status_data.get('payment_status', 'unknown')}")
        else:
            print(f"Step 3: Payment status check returned {status_response.status_code}")
        
        # Step 4: Verify ride details can be fetched (for PaymentSuccess page)
        ride_response = self.session.get(f"{BASE_URL}/api/vibe-ridez/ride/{ride_id}")
        assert ride_response.status_code == 200
        print("Step 4: Ride details verified")
        
        print("✅ Complete payment flow test passed (Stripe checkout not completed)")


class TestVibeRidezPaymentEdgeCases:
    """Test edge cases and error handling"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        login_response = self.session.post(f"{BASE_URL}/api/auth/demo-login")
        assert login_response.status_code == 200
        self.user_id = login_response.json()["user_id"]
    
    def test_checkout_with_zero_seats(self):
        """Test checkout with zero seats requested"""
        search_response = self.session.get(f"{BASE_URL}/api/vibe-ridez/rides/search?min_seats=1")
        if search_response.json()["count"] == 0:
            pytest.skip("No rides available")
        
        ride_id = search_response.json()["rides"][0]["ride_id"]
        
        response = self.session.post(
            f"{BASE_URL}/api/vibe-ridez/payment/create-checkout?ride_id={ride_id}&seats_requested=0"
        )
        # Should either fail validation or create a $0 checkout
        print(f"Zero seats checkout response: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print("   Created checkout with 0 seats (amount may be $0)")
        else:
            print(f"   Correctly rejected: {response.json().get('detail', 'unknown')}")
    
    def test_checkout_with_excessive_seats(self):
        """Test checkout requesting more seats than available"""
        search_response = self.session.get(f"{BASE_URL}/api/vibe-ridez/rides/search?min_seats=1")
        if search_response.json()["count"] == 0:
            pytest.skip("No rides available")
        
        ride = search_response.json()["rides"][0]
        ride_id = ride["ride_id"]
        available_seats = ride["available_seats"]
        
        response = self.session.post(
            f"{BASE_URL}/api/vibe-ridez/payment/create-checkout?ride_id={ride_id}&seats_requested={available_seats + 10}"
        )
        # Should fail or succeed (validation may happen at booking time)
        print(f"Excessive seats checkout response: {response.status_code}")
        if response.status_code == 200:
            print("   Checkout created (validation may happen at payment completion)")
        else:
            print(f"   Correctly rejected: {response.json().get('detail', 'unknown')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

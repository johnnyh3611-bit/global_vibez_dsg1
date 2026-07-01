"""
Vibe Ridez Authentication Tests
Tests for session-cookie-based authentication on all Vibe Ridez routes
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://social-connect-953.preview.emergentagent.com')

class TestVibeRidezAuthentication:
    """Test authentication flow for Vibe Ridez routes"""
    
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
    
    def test_01_demo_login_sets_session_cookie(self):
        """Test that demo login sets session_token cookie"""
        # Check cookies
        cookies = self.session.cookies.get_dict()
        assert "session_token" in cookies, "session_token cookie not set"
        assert cookies["session_token"].startswith("demo_session_"), "Invalid session token format"
        print(f"✅ Session cookie set: {cookies['session_token'][:30]}...")
    
    def test_02_driver_register_requires_auth(self):
        """Test that driver registration requires authentication"""
        # Try without session
        no_auth_session = requests.Session()
        response = no_auth_session.post(
            f"{BASE_URL}/api/vibe-ridez/driver/register",
            json={
                "phone_number": "555-000-0000",
                "license_number": "TEST123",
                "vehicle": {
                    "make": "Test",
                    "model": "Car",
                    "year": 2020,
                    "color": "Red",
                    "plate_number": "TEST123",
                    "seats": 4
                }
            }
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Driver registration correctly rejects unauthenticated requests")
    
    def test_03_driver_register_with_auth(self):
        """Test driver registration with valid session"""
        response = self.session.post(
            f"{BASE_URL}/api/vibe-ridez/driver/register",
            json={
                "phone_number": "555-TEST-001",
                "license_number": "TESTLIC001",
                "vehicle": {
                    "make": "Honda",
                    "model": "Civic",
                    "year": 2023,
                    "color": "Silver",
                    "plate_number": "TEST001",
                    "seats": 4
                },
                "bio": "Test driver for automated testing"
            }
        )
        # May return 400 if already registered, which is fine
        if response.status_code == 400:
            data = response.json()
            assert "Already registered" in data.get("detail", ""), f"Unexpected error: {data}"
            print("✅ Driver already registered (expected)")
        else:
            assert response.status_code == 200, f"Registration failed: {response.text}"
            data = response.json()
            assert data["success"]
            assert "driver_id" in data
            print(f"✅ Driver registered: {data['driver_id']}")
    
    def test_04_get_driver_profile_requires_auth(self):
        """Test that getting driver profile requires authentication"""
        no_auth_session = requests.Session()
        response = no_auth_session.get(f"{BASE_URL}/api/vibe-ridez/driver/{self.user_id}")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Get driver profile correctly rejects unauthenticated requests")
    
    def test_05_get_driver_profile_with_auth(self):
        """Test getting driver profile with valid session"""
        response = self.session.get(f"{BASE_URL}/api/vibe-ridez/driver/{self.user_id}")
        # May return 404 if not registered as driver
        if response.status_code == 404:
            print("✅ Driver not found (user not registered as driver)")
        else:
            assert response.status_code == 200, f"Get profile failed: {response.text}"
            data = response.json()
            assert data["success"]
            assert "driver" in data
            print(f"✅ Driver profile retrieved: {data['driver']['username']}")
    
    def test_06_ride_search_public(self):
        """Test that ride search is public (no auth required)"""
        no_auth_session = requests.Session()
        response = no_auth_session.get(f"{BASE_URL}/api/vibe-ridez/rides/search?min_seats=1")
        assert response.status_code == 200, f"Search failed: {response.text}"
        data = response.json()
        assert data["success"]
        assert "rides" in data
        print(f"✅ Ride search public: found {data['count']} rides")
    
    def test_07_ride_book_requires_auth(self):
        """Test that booking a ride requires authentication"""
        no_auth_session = requests.Session()
        response = no_auth_session.post(
            f"{BASE_URL}/api/vibe-ridez/ride/book",
            json={
                "ride_id": "test-ride-id",
                "seats_requested": 1
            }
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Ride booking correctly rejects unauthenticated requests")
    
    def test_08_ride_create_requires_auth(self):
        """Test that creating a ride requires authentication"""
        no_auth_session = requests.Session()
        response = no_auth_session.post(
            f"{BASE_URL}/api/vibe-ridez/ride/create",
            json={
                "pickup_location": {
                    "address": "Test Address",
                    "latitude": 40.0,
                    "longitude": -74.0,
                    "city": "Test City",
                    "state": "TS"
                },
                "dropoff_location": {
                    "address": "Test Destination",
                    "latitude": 41.0,
                    "longitude": -73.0,
                    "city": "Dest City",
                    "state": "DS"
                },
                "departure_time": "2026-04-15T10:00:00Z",
                "available_seats": 2,
                "price_per_seat": 20.0
            }
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Ride creation correctly rejects unauthenticated requests")
    
    def test_09_credentials_include_works(self):
        """Test that credentials: 'include' pattern works with session cookies"""
        # This simulates what the frontend does with credentials: 'include'
        # The session object automatically sends cookies
        response = self.session.get(f"{BASE_URL}/api/vibe-ridez/driver/{self.user_id}")
        # Should not get 401 - either 200 (found) or 404 (not found)
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        print("✅ Session cookie authentication working correctly")


class TestVibeRidezEndToEndFlow:
    """Test complete Vibe Ridez flow with authentication"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        login_response = self.session.post(f"{BASE_URL}/api/auth/demo-login")
        assert login_response.status_code == 200
        self.user_id = login_response.json()["user_id"]
    
    def test_full_flow_driver_registration_to_ride_search(self):
        """Test complete flow: login -> driver check -> ride search"""
        # Step 1: Check if user is a driver
        driver_response = self.session.get(f"{BASE_URL}/api/vibe-ridez/driver/{self.user_id}")
        
        if driver_response.status_code == 404:
            print("User is not a driver - would redirect to registration")
        else:
            assert driver_response.status_code == 200
            driver_data = driver_response.json()
            assert driver_data["success"]
            print(f"User is a driver: {driver_data['driver']['username']}")
            
            # Step 2: Get driver's rides
            driver_id = driver_data["driver"]["driver_id"]
            rides_response = self.session.get(f"{BASE_URL}/api/vibe-ridez/rides/driver/{driver_id}")
            assert rides_response.status_code == 200
            rides_data = rides_response.json()
            print(f"Driver has {len(rides_data.get('rides', []))} rides")
        
        # Step 3: Search for available rides (public)
        search_response = self.session.get(f"{BASE_URL}/api/vibe-ridez/rides/search?min_seats=1")
        assert search_response.status_code == 200
        search_data = search_response.json()
        print(f"Found {search_data['count']} available rides")
        
        print("✅ Full flow completed successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

"""
Mapbox Integration Tests for Vibe Ridez Live Tracking Feature
Tests: Directions API, Route Calculation, ETA, Safety Endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMapboxDirectionsAPI:
    """Test Mapbox Directions API integration via POST /api/rides/safety/directions"""
    
    def test_directions_sf_to_san_jose(self):
        """Test route from San Francisco to San Jose"""
        response = requests.post(f"{BASE_URL}/api/rides/safety/directions", json={
            "pickup_latitude": 37.7749,
            "pickup_longitude": -122.4194,
            "dropoff_latitude": 37.3382,
            "dropoff_longitude": -121.8863
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"]
        assert "route" in data
        
        route = data["route"]
        assert "geometry" in route
        assert "distance" in route
        assert "duration" in route
        assert "distance_km" in route
        assert "duration_minutes" in route
        
        # SF to SJ should be ~70-90 km
        assert 50 < route["distance_km"] < 100, f"Distance {route['distance_km']} km seems incorrect"
        # Duration should be ~45-75 minutes
        assert 30 < route["duration_minutes"] < 90, f"Duration {route['duration_minutes']} min seems incorrect"
        
        # Geometry should be GeoJSON LineString
        assert route["geometry"]["type"] == "LineString"
        assert len(route["geometry"]["coordinates"]) > 10, "Route should have multiple coordinates"
        
        print(f"✅ SF to San Jose: {route['distance_km']} km, {route['duration_minutes']} min")
    
    def test_directions_la_to_san_diego(self):
        """Test route from Los Angeles to San Diego"""
        response = requests.post(f"{BASE_URL}/api/rides/safety/directions", json={
            "pickup_latitude": 34.0522,
            "pickup_longitude": -118.2437,
            "dropoff_latitude": 32.7157,
            "dropoff_longitude": -117.1611
        })
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        
        route = data["route"]
        # LA to SD should be ~180-220 km
        assert 150 < route["distance_km"] < 250, f"Distance {route['distance_km']} km seems incorrect"
        
        print(f"✅ LA to San Diego: {route['distance_km']} km, {route['duration_minutes']} min")
    
    def test_directions_nyc_to_boston(self):
        """Test route from New York City to Boston"""
        response = requests.post(f"{BASE_URL}/api/rides/safety/directions", json={
            "pickup_latitude": 40.7128,
            "pickup_longitude": -74.0060,
            "dropoff_latitude": 42.3601,
            "dropoff_longitude": -71.0589
        })
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        
        route = data["route"]
        # NYC to Boston should be ~340-400 km
        assert 300 < route["distance_km"] < 450, f"Distance {route['distance_km']} km seems incorrect"
        
        print(f"✅ NYC to Boston: {route['distance_km']} km, {route['duration_minutes']} min")
    
    def test_directions_short_route(self):
        """Test short route within same city"""
        response = requests.post(f"{BASE_URL}/api/rides/safety/directions", json={
            "pickup_latitude": 37.7749,
            "pickup_longitude": -122.4194,
            "dropoff_latitude": 37.7849,
            "dropoff_longitude": -122.4094
        })
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        
        route = data["route"]
        # Short route should be < 5 km
        assert route["distance_km"] < 10, f"Short route distance {route['distance_km']} km seems too long"
        
        print(f"✅ Short route: {route['distance_km']} km, {route['duration_minutes']} min")
    
    def test_directions_missing_fields(self):
        """Test error handling for missing required fields"""
        response = requests.post(f"{BASE_URL}/api/rides/safety/directions", json={
            "pickup_latitude": 37.7749,
            "pickup_longitude": -122.4194
            # Missing dropoff coordinates
        })
        
        assert response.status_code == 422, f"Expected 422 for missing fields, got {response.status_code}"
        print("✅ Missing fields returns 422 validation error")
    
    def test_directions_invalid_coordinates(self):
        """Test error handling for invalid coordinates"""
        response = requests.post(f"{BASE_URL}/api/rides/safety/directions", json={
            "pickup_latitude": 999.0,  # Invalid latitude
            "pickup_longitude": -122.4194,
            "dropoff_latitude": 37.3382,
            "dropoff_longitude": -121.8863
        })
        
        # Should return error (either 400, 404, or 500 depending on Mapbox response)
        assert response.status_code in [400, 404, 500], f"Expected error status, got {response.status_code}"
        print(f"✅ Invalid coordinates returns error status {response.status_code}")


class TestRideSafetyEndpoints:
    """Test other safety endpoints used by SafeRideTracking page"""
    
    def test_generate_verification_code(self):
        """Test verification code generation"""
        # Use the test ride we created
        response = requests.post(f"{BASE_URL}/api/rides/safety/generate-code/ride_mapbox_test_1774743656690")
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        assert "code" in data
        assert len(data["code"]) == 4, "Verification code should be 4 digits"
        
        print(f"✅ Generated verification code: {data['code']}")
    
    def test_get_emergency_contacts(self):
        """Test fetching emergency contacts"""
        response = requests.get(f"{BASE_URL}/api/rides/safety/emergency-contacts/test_mapbox_user_1774743656690")
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        assert "contacts" in data
        assert isinstance(data["contacts"], list)
        
        print(f"✅ Emergency contacts endpoint working, found {len(data['contacts'])} contacts")
    
    def test_add_emergency_contact(self):
        """Test adding emergency contact"""
        response = requests.post(f"{BASE_URL}/api/rides/safety/emergency-contact", json={
            "user_id": "test_mapbox_user_1774743656690",
            "contact_name": "Test Emergency Contact",
            "contact_phone": "+1234567890",
            "contact_email": "emergency@test.com",
            "relationship": "friend"
        })
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        assert "contact_id" in data
        
        print(f"✅ Added emergency contact: {data['contact_id']}")
    
    def test_generate_tracking_link(self):
        """Test shareable tracking link generation"""
        response = requests.get(f"{BASE_URL}/api/rides/safety/tracking/share-link/ride_mapbox_test_1774743656690")
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        assert "tracking_url" in data
        assert "globalvibez.com/track/" in data["tracking_url"]
        
        print(f"✅ Generated tracking link: {data['tracking_url'][:50]}...")
    
    def test_safety_preferences_update(self):
        """Test updating safety preferences"""
        response = requests.post(f"{BASE_URL}/api/rides/safety/preferences", json={
            "user_id": "test_mapbox_user_1774743656690",
            "prefer_same_gender": True,
            "require_female_driver": False,
            "share_live_location": True,
            "enable_route_monitoring": True,
            "enable_auto_checkins": True
        })
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        
        print("✅ Safety preferences updated")
    
    def test_get_safety_preferences(self):
        """Test fetching safety preferences"""
        response = requests.get(f"{BASE_URL}/api/rides/safety/preferences/test_mapbox_user_1774743656690")
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        assert "preferences" in data
        
        print(f"✅ Safety preferences fetched: {data['preferences']}")
    
    def test_sos_alert(self):
        """Test SOS alert trigger"""
        response = requests.post(f"{BASE_URL}/api/rides/safety/sos", json={
            "ride_id": "ride_mapbox_test_1774743656690",
            "user_id": "test_mapbox_user_1774743656690",
            "location": {
                "latitude": 37.7749,
                "longitude": -122.4194,
                "address": "San Francisco, CA"
            },
            "alert_type": "panic"
        })
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        assert "sos_id" in data
        assert "contacts_notified" in data
        
        print(f"✅ SOS alert triggered: {data['sos_id']}, {data['contacts_notified']} contacts notified")
    
    def test_safety_stats(self):
        """Test safety statistics endpoint"""
        response = requests.get(f"{BASE_URL}/api/rides/safety/stats/test_mapbox_user_1774743656690")
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"]
        assert "stats" in data
        
        stats = data["stats"]
        assert "total_rides" in stats
        assert "verified_rides" in stats
        assert "safety_score" in stats
        
        print(f"✅ Safety stats: {stats}")


class TestMapboxTokenConfiguration:
    """Test that Mapbox tokens are properly configured"""
    
    def test_backend_mapbox_token_configured(self):
        """Verify backend can access Mapbox API (token is valid)"""
        # If directions work, token is valid
        response = requests.post(f"{BASE_URL}/api/rides/safety/directions", json={
            "pickup_latitude": 37.7749,
            "pickup_longitude": -122.4194,
            "dropoff_latitude": 37.7849,
            "dropoff_longitude": -122.4094
        })
        
        assert response.status_code == 200, f"Mapbox API call failed: {response.text}"
        
        data = response.json()
        assert data["success"], "Mapbox token may be invalid or not configured"
        
        print("✅ Backend Mapbox token is valid and working")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

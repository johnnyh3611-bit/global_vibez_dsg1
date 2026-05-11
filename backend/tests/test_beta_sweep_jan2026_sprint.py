"""
Jan 2026 Beta-Readiness Sweep — sprint endpoint validation.

Covers the 4 backend-facing locks added in this sprint:
  1. /api/vibe-venues/config -> refund_policies array (3 presets)
  2. /api/vibe-venues/venues/list accepts gallery_photos + refund_policy
  3. /api/ridez/nearby-drivers public endpoint (default + filters)
  4. Service worker /gv-sw.js is served (200) and contains CACHE_VERSION
"""
import os
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")


# ---------- 1. Vibe Venues config: refund_policies ----------
def test_vibe_venues_config_refund_policies_present():
    r = requests.get(f"{BASE}/api/vibe-venues/config", timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "refund_policies" in data
    policies = data["refund_policies"]
    assert isinstance(policies, list)
    ids = {p["id"] for p in policies}
    assert ids == {"flexible", "moderate", "strict"}, f"got ids={ids}"
    for p in policies:
        assert "label" in p and p["label"]
        assert "summary" in p and p["summary"]


# ---------- 2. Vibe Venues list: gallery_photos + refund_policy ----------
def test_vibe_venues_list_accepts_gallery_and_refund_policy():
    payload = {
        "host_user_id": "TEST_sprint_host",
        "name": "TEST Sprint Venue",
        "description": "sprint regression",
        "address": "123 Sprint Way",
        "city": "SF",
        "zip_code": "94110",
        "capacity": 8,
        "base_hourly_rate_usd": 120.0,
        "amenities": ["wifi", "kitchen"],
        "gallery_photos": [
            "https://example.com/g1.jpg",
            "https://example.com/g2.jpg",
        ],
        "refund_policy": "strict",
    }
    r = requests.post(f"{BASE}/api/vibe-venues/venues/list", json=payload, timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("success") is True
    venue = body.get("venue") or {}
    assert venue.get("gallery_photos") == payload["gallery_photos"]
    assert venue.get("refund_policy") == "strict"
    assert "venue_id" in venue and venue["venue_id"].startswith("vv_")


# ---------- 3. Ridez nearby-drivers public endpoint ----------
def test_nearby_drivers_default_shape():
    r = requests.get(
        f"{BASE}/api/ridez/nearby-drivers",
        params={"lat": 37.7749, "lon": -122.4194, "radius_km": 8},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    for key in ("count", "nearest_km", "estimated_eta_minutes", "radius_km", "drivers"):
        assert key in data, f"missing key {key}"
    assert isinstance(data["drivers"], list)
    assert data["radius_km"] == 8.0
    assert data["count"] == len(data["drivers"])


def test_nearby_drivers_ride_type_filter_real_ok():
    r = requests.get(
        f"{BASE}/api/ridez/nearby-drivers",
        params={"lat": 37.7749, "lon": -122.4194, "ride_type": "real", "limit": 3},
        timeout=15,
    )
    assert r.status_code == 200, r.text


def test_nearby_drivers_invalid_ride_type_400():
    r = requests.get(
        f"{BASE}/api/ridez/nearby-drivers",
        params={"lat": 37.7749, "lon": -122.4194, "ride_type": "bogus"},
        timeout=15,
    )
    assert r.status_code == 400, r.text


def test_nearby_drivers_coord_anonymization_3dp():
    """When drivers ARE present, lat/lon must be rounded to 3 decimal places.
    With zero seeded drivers the list is empty — assertion is a no-op, but we
    still exercise the endpoint."""
    r = requests.get(
        f"{BASE}/api/ridez/nearby-drivers",
        params={"lat": 37.7749, "lon": -122.4194, "radius_km": 50},
        timeout=15,
    )
    assert r.status_code == 200
    for d in r.json().get("drivers", []):
        lat = d.get("lat")
        lon = d.get("lon")
        if lat is not None:
            assert round(lat, 3) == lat, f"lat {lat} not rounded to 3dp"
        if lon is not None:
            assert round(lon, 3) == lon, f"lon {lon} not rounded to 3dp"


# ---------- 4. Offline service worker ----------
def test_offline_service_worker_served():
    r = requests.get(f"{BASE}/gv-sw.js", timeout=15)
    assert r.status_code == 200, r.text
    body = r.text
    assert "CACHE_VERSION" in body
    assert "gv-v1-" in body

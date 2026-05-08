"""Public-URL smoke test for /api/card-royale/*.

Verifies endpoints are reachable via REACT_APP_BACKEND_URL (through ingress),
and that basic business rules hold. Uses x-user-id header auth fallback.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def test_templates_has_four_seeded(session):
    r = session.get(f"{API}/card-royale/templates", timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    ids = {t["template_id"] for t in data["templates"]}
    for expected in ("daily_royale", "spades_hour", "weekend_bracket", "mini_tour_rapid"):
        assert expected in ids, f"missing template {expected}; got {ids}"


def test_active_endpoint_shape(session):
    r = session.get(f"{API}/card-royale/active", timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert "tournaments" in body and "count" in body
    for t in body["tournaments"]:
        assert t["status"] in ("OPEN", "RUNNING")


def test_upcoming_endpoint_shape(session):
    r = session.get(f"{API}/card-royale/upcoming", timeout=15)
    assert r.status_code == 200
    assert "tournaments" in r.json()


def test_enter_requires_auth(session):
    # No cookie, no x-user-id => 401
    r = session.post(
        f"{API}/card-royale/enter",
        json={"tournament_id": "nonexistent_tid", "use_free_entry": True},
        timeout=15,
    )
    assert r.status_code == 401


def test_admin_finalize_requires_admin(session):
    r = session.post(
        f"{API}/card-royale/admin/finalize",
        json={"tournament_id": "nonexistent_tid"},
        timeout=15,
    )
    assert r.status_code == 403


def test_details_404_for_missing(session):
    r = session.get(f"{API}/card-royale/details/does_not_exist_xyz", timeout=15)
    assert r.status_code == 404


def test_my_entries_requires_auth(session):
    r = session.get(f"{API}/card-royale/my-entries", timeout=15)
    assert r.status_code == 401


def test_my_entries_with_header_auth(session):
    uid = f"smoke_user_{uuid.uuid4().hex[:8]}"
    r = session.get(
        f"{API}/card-royale/my-entries",
        headers={"x-user-id": uid},
        timeout=15,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["user_id"] == uid
    assert body["count"] == 0

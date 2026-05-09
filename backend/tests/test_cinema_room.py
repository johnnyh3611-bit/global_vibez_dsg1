"""
Tests for The Cinema Room — public sync-watch viewer.

Covers REST (catalog + room CRUD + food-order audit). Distinct from
`/dsg/memory-bank` which is the founder's user-content marketplace.
"""
import pytest
from fastapi.testclient import TestClient

from server import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_cinema_room_catalog_lists_curated_titles(client):
    """The Cinema Room ships with a curated free-content catalog
    (YouTube + Archive.org public domain). All titles must be
    legally-clear (License: Public Domain or YouTube ad-supported)."""
    r = client.get("/api/cinema-room/catalog")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["count"] >= 4
    seen_sources = set()
    for item in body["items"]:
        for k in ["id", "title", "year", "duration_min", "source", "url",
                  "thumbnail", "genre", "rating", "license"]:
            assert k in item, f"catalog item missing {k}: {item}"
        assert item["source"] in {"youtube", "archive_org"}
        assert "Public Domain" in item["license"] or item["source"] == "youtube"
        seen_sources.add(item["source"])
    # Mix of YouTube + Archive.org for redundancy.
    assert "youtube" in seen_sources
    assert "archive_org" in seen_sources


def test_cinema_room_catalog_individual_lookup(client):
    """Individual content lookup powers the room snapshot."""
    listing = client.get("/api/cinema-room/catalog").json()
    cid = listing["items"][0]["id"]
    r = client.get(f"/api/cinema-room/catalog/{cid}")
    assert r.status_code == 200
    assert r.json()["id"] == cid

    r404 = client.get("/api/cinema-room/catalog/does-not-exist")
    assert r404.status_code == 404


def test_cinema_room_create_and_list(client):
    """Public rooms appear in the lobby list; private rooms do NOT."""
    listing = client.get("/api/cinema-room/catalog").json()
    cid = listing["items"][0]["id"]

    public = client.post("/api/cinema-room/rooms", json={
        "name": "Friday Night Flix",
        "host_id": "u_test_public",
        "content_id": cid,
        "is_private": False,
    })
    assert public.status_code == 200, public.text
    pub_room = public.json()
    assert pub_room["room_id"].startswith("cr_")
    assert pub_room["content_id"] == cid

    private = client.post("/api/cinema-room/rooms", json={
        "name": "Date Night",
        "host_id": "u_test_private",
        "content_id": None,
        "is_private": True,
    })
    assert private.status_code == 200
    priv_room = private.json()

    rooms = client.get("/api/cinema-room/rooms").json()
    ids = {r["room_id"] for r in rooms["rows"]}
    assert pub_room["room_id"] in ids, "Public room must appear in lobby list"
    assert priv_room["room_id"] not in ids, "Private rooms must NOT be in lobby list"


def test_cinema_room_create_rejects_invalid_content_id(client):
    r = client.post("/api/cinema-room/rooms", json={
        "name": "Broken Room",
        "host_id": "u_test_invalid",
        "content_id": "not-a-real-id",
    })
    assert r.status_code == 400
    assert r.json()["detail"] == "invalid_content_id"


def test_cinema_room_food_order_audit(client):
    """Food-order CTA logs intent + returns deep-link to /hungryvibes.
    Doesn't actually place the order — that's HungryVIBEZ's job."""
    listing = client.get("/api/cinema-room/catalog").json()
    cid = listing["items"][0]["id"]
    room = client.post("/api/cinema-room/rooms", json={
        "name": "Snack Room",
        "host_id": "u_food_host",
        "content_id": cid,
    }).json()

    rid = room["room_id"]
    r = client.post(f"/api/cinema-room/rooms/{rid}/food-order", json={
        "room_id": rid,
        "user_id": "u_food_orderer",
        "item_hint": "Popcorn",
    })
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["deep_link"] == "/hungryvibes"

    # room_id mismatch — must reject.
    bad = client.post(f"/api/cinema-room/rooms/{rid}/food-order", json={
        "room_id": "cr_OTHER",
        "user_id": "u_food_orderer",
    })
    assert bad.status_code == 400


def test_cinema_room_404_for_unknown_room(client):
    r = client.get("/api/cinema-room/rooms/cr_does-not-exist")
    assert r.status_code == 404

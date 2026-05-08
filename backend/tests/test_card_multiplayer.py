"""
Integration tests for the Card Multiplayer router — 4-seat Euchre + Pinochle
rooms backed by the existing engines. Hits the live supervisor backend.
"""
import os
import sys
from pathlib import Path

import httpx
import pytest
from dotenv import dotenv_values
from pymongo import MongoClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

_ENV = dotenv_values(Path(__file__).resolve().parents[1] / ".env")
MONGO_URL = _ENV.get("MONGO_URL") or os.environ["MONGO_URL"]
DB_NAME = _ENV.get("DB_NAME") or os.getenv("DB_NAME", "test_database")

BASE = os.getenv("BACKEND_TEST_URL", "http://localhost:8001")
API = f"{BASE}/api"


@pytest.fixture()
def client():
    with httpx.Client(base_url=API, timeout=10.0) as c:
        yield c


@pytest.fixture()
def db():
    return MongoClient(MONGO_URL)[DB_NAME]


@pytest.fixture()
def euchre_room(client, db):
    r = client.post("/card-multiplayer/create-room", json={
        "game_type": "euchre",
        "host_user_id": "cmp_u1",
        "host_user_name": "Alice",
    })
    assert r.status_code == 200, r.text
    rid = r.json()["room"]["room_id"]
    yield rid
    db.card_mp_rooms.delete_one({"room_id": rid})


@pytest.fixture()
def pinochle_room(client, db):
    r = client.post("/card-multiplayer/create-room", json={
        "game_type": "pinochle",
        "host_user_id": "cmp_u2",
        "host_user_name": "Bob",
    })
    assert r.status_code == 200, r.text
    rid = r.json()["room"]["room_id"]
    yield rid
    db.card_mp_rooms.delete_one({"room_id": rid})


def test_create_euchre_room_defaults(client, euchre_room):
    r = client.get(f"/card-multiplayer/room/{euchre_room}")
    assert r.status_code == 200
    room = r.json()["room"]
    assert room["game_type"] == "euchre"
    assert room["status"] == "WAITING"
    # host is seated at "south", is_host True
    south = room["seats"]["south"]
    assert south and south["user_id"] == "cmp_u1" and south["is_host"] is True


def test_join_room_fills_next_open_seat(client, euchre_room):
    r = client.post(f"/card-multiplayer/room/{euchre_room}/join", json={"user_id": "cmp_u2", "user_name": "Bob"})
    assert r.status_code == 200
    assert r.json()["seat"] in {"west", "north", "east"}


def test_cannot_start_with_empty_seats(client, euchre_room):
    r = client.post(f"/card-multiplayer/room/{euchre_room}/start")
    assert r.status_code == 400


def test_fill_bots_and_start_euchre(client, euchre_room):
    r = client.post(f"/card-multiplayer/room/{euchre_room}/fill-bots")
    assert r.status_code == 200
    r = client.post(f"/card-multiplayer/room/{euchre_room}/start")
    assert r.status_code == 200, r.text
    body = r.json()["room"]
    assert body["status"] == "PLAYING"
    eng = body["engine"]
    assert eng["phase"] in {"bidding", "ordered_dealer_discard", "playing"}


def test_fill_bots_and_start_pinochle(client, pinochle_room):
    client.post(f"/card-multiplayer/room/{pinochle_room}/fill-bots")
    r = client.post(f"/card-multiplayer/room/{pinochle_room}/start")
    assert r.status_code == 200, r.text
    body = r.json()["room"]
    assert body["status"] == "PLAYING"
    eng = body["engine"]
    assert eng["phase"] in {"bidding", "meld_reveal", "playing"}


def test_rooms_listing_filters_by_game_type(client, euchre_room, pinochle_room):
    only_euchre = client.get("/card-multiplayer/rooms?game_type=euchre").json()["rooms"]
    only_pin = client.get("/card-multiplayer/rooms?game_type=pinochle").json()["rooms"]
    ids_e = {r["room_id"] for r in only_euchre}
    ids_p = {r["room_id"] for r in only_pin}
    assert euchre_room in ids_e
    assert pinochle_room in ids_p
    assert euchre_room not in ids_p
    assert pinochle_room not in ids_e


def test_unauthorized_user_cannot_play_card(client, euchre_room):
    client.post(f"/card-multiplayer/room/{euchre_room}/fill-bots")
    client.post(f"/card-multiplayer/room/{euchre_room}/start")
    # Random stranger tries to play
    r = client.post(f"/card-multiplayer/room/{euchre_room}/play-card", json={
        "user_id": "stranger_0",
        "card": {"suit": "S", "rank": "A"},
    })
    assert r.status_code == 403

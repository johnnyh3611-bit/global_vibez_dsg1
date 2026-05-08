"""Tests for vanishing messages HTTP endpoints + timer + DB wipe."""
import os
from datetime import datetime, timezone, timedelta

import pytest
from pymongo import MongoClient

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "global_vibez_dsg")

from routes import vanishing_messages as vm_module  # noqa: E402

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
_CLIENT = MongoClient(MONGO_URL)

SENDER = "vm_test_sender_1"
RECIPIENT = "vm_test_recipient_1"
STRANGER = "vm_test_stranger_1"
ROOM = "vm_test_room_1"


@pytest.fixture(scope="module")
def client(shared_client):
    return shared_client


def _db():
    return _CLIENT[DB_NAME]


def _seed_session(user_id: str) -> str:
    token = f"vm-test-session-{user_id}"
    _db().user_sessions.update_one(
        {"session_token": token},
        {"$set": {
            "session_token": token,
            "user_id": user_id,
            "expires_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        }},
        upsert=True,
    )
    _db().users.update_one(
        {"user_id": user_id},
        {"$setOnInsert": {"user_id": user_id, "email": f"{user_id}@vm.test", "name": user_id}},
        upsert=True,
    )
    return token


@pytest.fixture(autouse=True)
def _cleanup():
    db = _db()
    db.vanishing_messages.delete_many({"room_id": ROOM})
    db.user_sessions.delete_many({"user_id": {"$in": [SENDER, RECIPIENT, STRANGER]}})
    db.users.delete_many({"user_id": {"$in": [SENDER, RECIPIENT, STRANGER]}})
    yield
    db.vanishing_messages.delete_many({"room_id": ROOM})
    db.user_sessions.delete_many({"user_id": {"$in": [SENDER, RECIPIENT, STRANGER]}})
    db.users.delete_many({"user_id": {"$in": [SENDER, RECIPIENT, STRANGER]}})
    for t in list(vm_module._timers.values()):
        t.cancel()
    vm_module._timers.clear()


def _post(client, path: str, user_id: str, json: dict):
    token = _seed_session(user_id)
    return client.post(path, json=json, headers={"Cookie": f"session_token={token}"})


def _get(client, path: str, user_id: str):
    token = _seed_session(user_id)
    return client.get(path, headers={"Cookie": f"session_token={token}"})


def test_send_and_open_flow(client):
    r = _post(client, "/api/vanishing/send", SENDER,
              {"room_id": ROOM, "to_user_id": RECIPIENT, "text": "hello friend", "ttl_seconds": 10})
    assert r.status_code == 200, r.text
    msg_id = r.json()["msg_id"]
    assert r.json()["ttl_seconds"] == 10

    r = _get(client, f"/api/vanishing/thread?room_id={ROOM}&with_user={SENDER}", RECIPIENT)
    assert r.status_code == 200
    msgs = r.json()["messages"]
    assert len(msgs) == 1
    assert msgs[0]["text"] is None
    assert msgs[0]["status"] == "unopened"

    r = _post(client, "/api/vanishing/open", RECIPIENT, {"msg_id": msg_id})
    assert r.status_code == 200
    assert r.json()["ok"] is True
    assert r.json()["text"] == "hello friend"

    doc = _db().vanishing_messages.find_one({"msg_id": msg_id}, {"_id": 0})
    assert doc is not None
    assert doc["status"] == "opened"
    assert doc["opened_at"] is not None


def test_vanish_wipes_from_db(client):
    """The low-level behavior: once an opened message is deleted from
    `vanishing_messages`, it's gone. /open on a missing id returns a tombstone.
    The in-process asyncio timer is exercised by a separate short-TTL integration
    smoke; here we assert the DB-wipe semantics directly so tests stay fast."""
    r = _post(client, "/api/vanishing/send", SENDER,
              {"room_id": ROOM, "to_user_id": RECIPIENT, "text": "short", "ttl_seconds": 10})
    msg_id = r.json()["msg_id"]
    _post(client, "/api/vanishing/open", RECIPIENT, {"msg_id": msg_id})

    # Simulate the vanish: delete the doc directly via the sync client
    _db().vanishing_messages.delete_one({"msg_id": msg_id})

    # Opening again → tombstone
    r = _post(client, "/api/vanishing/open", RECIPIENT, {"msg_id": msg_id})
    assert r.status_code == 200
    assert r.json() == {"ok": False, "vanished": True, "msg_id": msg_id}


def test_non_participant_cannot_open(client):
    r = _post(client, "/api/vanishing/send", SENDER,
              {"room_id": ROOM, "to_user_id": RECIPIENT, "text": "secret", "ttl_seconds": 10})
    msg_id = r.json()["msg_id"]
    r = _post(client, "/api/vanishing/open", STRANGER, {"msg_id": msg_id})
    assert r.status_code == 403


def test_ttl_is_clamped(client):
    r = _post(client, "/api/vanishing/send", SENDER,
              {"room_id": ROOM, "to_user_id": RECIPIENT, "text": "x", "ttl_seconds": 1})
    assert r.json()["ttl_seconds"] == 10

    r = _post(client, "/api/vanishing/send", SENDER,
              {"room_id": ROOM, "to_user_id": RECIPIENT, "text": "y", "ttl_seconds": 999999})
    assert r.json()["ttl_seconds"] == 3600


def test_open_vanished_returns_tombstone(client):
    r = _post(client, "/api/vanishing/open", RECIPIENT, {"msg_id": "not-a-real-id"})
    assert r.status_code == 200
    assert r.json() == {"ok": False, "vanished": True, "msg_id": "not-a-real-id"}


def test_unopened_text_redacted_from_sender_thread_too(client):
    _post(client, "/api/vanishing/send", SENDER,
          {"room_id": ROOM, "to_user_id": RECIPIENT, "text": "private", "ttl_seconds": 10})
    r = _get(client, f"/api/vanishing/thread?room_id={ROOM}&with_user={RECIPIENT}", SENDER)
    assert r.json()["messages"][0]["text"] is None

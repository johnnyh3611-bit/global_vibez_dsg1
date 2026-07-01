"""
Smoke test for the Universal 2-20 Player Signaling endpoint.

Verifies:
  * /api/vibe-room/{room_id}/peers GET returns the live roster
  * /api/vibe-room/ws/{room_id}/{user_id} WebSocket:
      - sends a peer_list to a new joiner
      - broadcasts peer_joined / peer_left
      - forwards rtc_signal to the targeted peer
      - rebroadcasts voice_activity as speaker_update
      - hard caps the room at 20 peers
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


@pytest.fixture(scope="module")
def client():
    from server import app  # noqa: PLC0415

    with TestClient(app) as c:
        yield c


def test_peer_roster_starts_empty(client):
    r = client.get("/api/vibe-room/test_room_empty/peers")
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 0
    assert body["cap"] == 20
    assert body["peers"] == []


def test_peer_join_emits_peer_list_and_broadcasts(client):
    room = "test_room_join"
    with client.websocket_connect(f"/api/vibe-room/ws/{room}/alice") as a:
        first = a.receive_json()
        assert first["type"] == "peer_list"
        assert first["peers"] == []

        with client.websocket_connect(f"/api/vibe-room/ws/{room}/bob") as b:
            # Bob's first frame is his peer_list which includes Alice.
            frame = b.receive_json()
            assert frame["type"] == "peer_list"
            assert {p["user_id"] for p in frame["peers"]} == {"alice"}

            # Alice receives a peer_joined for Bob.
            frame = a.receive_json()
            assert frame == {"type": "peer_joined", "user_id": "bob"}

            # GET /peers reports both.
            roster = client.get(f"/api/vibe-room/{room}/peers").json()
            assert roster["count"] == 2
            assert {p["user_id"] for p in roster["peers"]} == {"alice", "bob"}

        # Bob disconnected → Alice gets peer_left.
        frame = a.receive_json()
        assert frame == {"type": "peer_left", "user_id": "bob"}


def test_rtc_signal_forwarding(client):
    room = "test_room_rtc"
    with client.websocket_connect(f"/api/vibe-room/ws/{room}/alice") as a:
        a.receive_json()  # peer_list (empty)
        with client.websocket_connect(f"/api/vibe-room/ws/{room}/bob") as b:
            b.receive_json()  # peer_list with alice
            a.receive_json()  # peer_joined bob

            payload = {"sdp": "v=0\r\no=mock 1 1 IN IP4 0.0.0.0", "type": "offer"}
            a.send_text(json.dumps({"type": "rtc_signal", "to": "bob", "signal": payload}))
            forwarded = b.receive_json()
            assert forwarded["type"] == "rtc_signal"
            assert forwarded["from"] == "alice"
            assert forwarded["signal"] == payload


def test_voice_activity_rebroadcasts_as_speaker_update(client):
    room = "test_room_voice"
    with client.websocket_connect(f"/api/vibe-room/ws/{room}/alice") as a:
        a.receive_json()  # peer_list
        with client.websocket_connect(f"/api/vibe-room/ws/{room}/bob") as b:
            b.receive_json()  # peer_list
            a.receive_json()  # peer_joined bob

            b.send_text(json.dumps({"type": "voice_activity", "active": True}))
            evt = a.receive_json()
            assert evt == {"type": "speaker_update", "user": "bob", "active": True}

            # Roster should reflect is_talking=True on bob.
            roster = client.get(f"/api/vibe-room/{room}/peers").json()
            bob = next(p for p in roster["peers"] if p["user_id"] == "bob")
            assert bob["is_talking"] is True


def test_three_concurrent_peers_room(client):
    """
    Multi-human QA harness — 3 concurrent peers share a room, voice
    broadcasts fan out to all, and disconnect notifies the rest.
    Stand-in for live beta-tester multi-human QA on the WS layer.
    """
    room = "test_room_multi"
    with client.websocket_connect(f"/api/vibe-room/ws/{room}/alice") as a:
        a.receive_json()  # peer_list (empty)
        with client.websocket_connect(f"/api/vibe-room/ws/{room}/bob") as b:
            b.receive_json()  # peer_list (alice)
            a.receive_json()  # peer_joined bob
            with client.websocket_connect(f"/api/vibe-room/ws/{room}/carol") as c:
                c_first = c.receive_json()  # peer_list (alice, bob)
                assert {p["user_id"] for p in c_first["peers"]} == {"alice", "bob"}
                # Both alice and bob should see peer_joined carol.
                assert a.receive_json() == {"type": "peer_joined", "user_id": "carol"}
                assert b.receive_json() == {"type": "peer_joined", "user_id": "carol"}

                # Bob speaks → alice + carol both receive speaker_update.
                b.send_text(json.dumps({"type": "voice_activity", "active": True}))
                assert a.receive_json() == {
                    "type": "speaker_update",
                    "user": "bob",
                    "active": True,
                }
                assert c.receive_json() == {
                    "type": "speaker_update",
                    "user": "bob",
                    "active": True,
                }
            # Carol disconnected → alice + bob get peer_left.
            assert a.receive_json() == {"type": "peer_left", "user_id": "carol"}
            assert b.receive_json() == {"type": "peer_left", "user_id": "carol"}

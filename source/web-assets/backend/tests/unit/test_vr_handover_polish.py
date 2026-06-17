"""
Unit tests for VR↔Physical Handover Stack — Task B polish.

Covers:
  - Bond milestone tracker fires when a VR date ends
  - `GET /api/bonds/list/{user_id}` returns progress data
  - `GET /api/bonds/unlock-rules` exposes the rule table
  - `/api/ws/ride-status/{ride_id}` streams valid status frames (TestClient)

NOTE: We use a single session-scoped TestClient so motor's async loop stays
valid across all tests (motor binds to whatever loop is alive at first call).
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

# Ensure env is set before importing server
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "global_vibez_dsg")



MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]


@pytest.fixture(scope="module")
def client(shared_client):
    return shared_client


def _mongo_sync_cleanup(user_a: str, user_b: str) -> None:
    from pymongo import MongoClient
    with MongoClient(MONGO_URL) as mc:
        db = mc[DB_NAME]
        bond_id = "-".join(sorted([user_a, user_b]))
        db.bonds.delete_many({"bond_id": bond_id})
        db.teleport_vfx.delete_many({"user_id": {"$in": [user_a, user_b]}})


# ─── Bond milestone endpoints ───────────────────────────────────────────

def test_unlock_rules_endpoint(client: TestClient) -> None:
    res = client.get("/api/bonds/unlock-rules")
    assert res.status_code == 200, res.text
    body = res.json()
    assert "rules" in body
    assert "date_count" in body["rules"]
    first = body["rules"]["date_count"][0]
    assert first["threshold"] == 3
    assert first["cosmetic_id"] == "twin_flame_vfx"


def test_list_empty_bonds(client: TestClient) -> None:
    res = client.get("/api/bonds/list/nonexistent_user_xyz_zzz")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["user_id"] == "nonexistent_user_xyz_zzz"
    assert body["bond_count"] == 0
    assert body["bonds"] == []


def test_milestone_increments_and_unlocks(client: TestClient) -> None:
    ua, ub = "testuser_bond_alpha", "testuser_bond_beta"
    _mongo_sync_cleanup(ua, ub)
    try:
        for i in range(2):
            r = client.post(
                "/api/bonds/milestone",
                json={"user_a": ua, "user_b": ub, "stat": "date_count", "increment": 1},
            )
            assert r.status_code == 200, f"attempt {i}: {r.text}"
            assert r.json()["unlocked_now"] == []

        r = client.post(
            "/api/bonds/milestone",
            json={"user_a": ua, "user_b": ub, "stat": "date_count", "increment": 1},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["new_value"] == 3
        assert "twin_flame_vfx" in body["unlocked_now"]

        r2 = client.get(f"/api/bonds/list/{ua}")
        assert r2.status_code == 200, r2.text
        listing = r2.json()
        assert listing["bond_count"] == 1
        bond = listing["bonds"][0]
        assert bond["partner_id"] == ub
        assert "milestone_progress" in bond
        dp = bond["milestone_progress"]["date_count"]
        assert dp["current"] == 3
        assert dp["next_threshold"] == 10
        assert dp["next_cosmetic_id"] == "nebula_floor_skin"
    finally:
        _mongo_sync_cleanup(ua, ub)


# ─── VR date end → milestone auto-fire ──────────────────────────────────

def test_end_vr_date_fires_bond_and_teleport_unlocks(client: TestClient) -> None:
    ua, ub = "testuser_date_hook_a", "testuser_date_hook_b"
    _mongo_sync_cleanup(ua, ub)

    from routes import vr_dating
    room_id = "test_room_hook_1"
    vr_dating.active_vr_rooms[room_id] = {
        "room_id": room_id,
        "user1_id": ua,
        "user2_id": ub,
        "environment": "restaurant",
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "users": {},
    }
    vr_dating.active_connections[room_id] = []

    try:
        res = client.post(f"/api/api/vr_date/end/{room_id}")
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["success"] is True
        assert isinstance(body.get("bond_unlocks"), list)
        assert isinstance(body.get("teleport_unlocks"), dict)

        r2 = client.get(f"/api/bonds/{ua}/{ub}")
        assert r2.status_code == 200
        bond = r2.json()
        assert bond["exists"] is True
        assert bond["shared_stats"].get("date_count") == 1
    finally:
        vr_dating.active_vr_rooms.pop(room_id, None)
        vr_dating.active_connections.pop(room_id, None)
        _mongo_sync_cleanup(ua, ub)


# ─── WebSocket: /api/ws/ride-status/{ride_id} ────────────────────────────

def test_ride_status_ws_streams_valid_frame(client: TestClient) -> None:
    ride_id = "test_ride_ws_abc_123"
    with client.websocket_connect(f"/api/ws/ride-status/{ride_id}") as ws:
        raw = ws.receive_text()
        frame = json.loads(raw)
        assert frame["ride_id"] == ride_id
        assert "status" in frame
        assert "eta" in frame
        assert "vehicle" in frame

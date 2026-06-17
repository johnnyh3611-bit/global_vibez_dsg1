"""
VR Dating Routes - Backend API for Virtual Reality Dating
Handles VR room creation, management, and real-time position syncing
"""
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import json
import logging
from uuid import uuid4

from config import db
from routes.bonds import _bond_id, _check_unlocks
from routes.teleport_cosmetics import TELEPORT_UNLOCK_RULES, _get_or_init_user_vfx

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory storage for active VR rooms (use Redis in production)
active_vr_rooms: Dict[str, dict] = {}
active_connections: Dict[str, List[WebSocket]] = {}


class VRInvite(BaseModel):
    match_id: str
    inviter_id: str


class VRAccept(BaseModel):
    invite_id: str
    user_id: str


class VRRoom(BaseModel):
    room_id: str
    user1_id: str
    user2_id: str
    environment: str = "restaurant"
    status: str = "active"
    created_at: str
    

@router.post("/api/vr_date/invite")
async def send_vr_invite(invite: VRInvite) -> Dict[str, Any]:
    """Send VR date invitation to matched user"""
    try:
        invite_id = str(uuid4())
        
        # Store invite (in production, save to MongoDB)
        # For now, just return the invite_id
        
        return {
            "success": True,
            "invite_id": invite_id,
            "message": "VR date invitation sent"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/vr_date/accept")
async def accept_vr_invite(accept: VRAccept) -> Dict[str, Any]:
    """Accept VR date invitation and create room"""
    try:
        room_id = str(uuid4())
        
        # Create VR room
        room_data = {
            "room_id": room_id,
            "user1_id": accept.user_id,
            "user2_id": "other_user",  # Get from invite
            "environment": "restaurant",
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "users": {}
        }
        
        active_vr_rooms[room_id] = room_data
        active_connections[room_id] = []
        
        return {
            "success": True,
            "room_id": room_id,
            "message": "VR room created"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/vr_date/room/{room_id}")
async def get_vr_room(room_id: str) -> Dict[str, Any]:
    """Get VR room details"""
    try:
        # For demo, return mock data if room doesn't exist
        if room_id not in active_vr_rooms:
            return {
                "room_id": room_id,
                "user1_id": "user1",
                "user2_id": "user2",
                "environment": "restaurant",
                "status": "active",
                "users": {},
                "positions": {}
            }
        
        return active_vr_rooms[room_id]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.websocket("/ws/vr_date/{room_id}")
async def vr_date_websocket(websocket: WebSocket, room_id: str) -> Dict[str, Any]:
    """
    WebSocket endpoint for real-time position syncing in VR dates
    Handles position updates, environment changes, and user presence
    """
    await websocket.accept()
    
    # Initialize room if doesn't exist
    if room_id not in active_connections:
        active_connections[room_id] = []
    
    active_connections[room_id].append(websocket)
    
    try:
        # Send initial connection confirmation
        await websocket.send_json({
            "type": "connected",
            "room_id": room_id,
            "users_count": len(active_connections[room_id])
        })
        
        while True:
            # Receive data from client
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Broadcast to all other users in the room
            for connection in active_connections[room_id]:
                if connection != websocket:
                    try:
                        await connection.send_text(data)
                    except Exception:
                        # Remove dead connections
                        active_connections[room_id].remove(connection)
            
            # Handle specific message types
            if message.get("type") == "position_update":
                # Update user position in room state
                if room_id in active_vr_rooms:
                    user_id = message.get("user_id")
                    if "users" not in active_vr_rooms[room_id]:
                        active_vr_rooms[room_id]["users"] = {}
                    active_vr_rooms[room_id]["users"][user_id] = {
                        "position": message.get("position"),
                        "last_update": datetime.now(timezone.utc).isoformat()
                    }
            
            elif message.get("type") == "environment_change":
                # Update room environment
                if room_id in active_vr_rooms:
                    active_vr_rooms[room_id]["environment"] = message.get("environment")
            
            elif message.get("type") == "user_left":
                # Handle user leaving
                break
                
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        # Clean up on disconnect
        if websocket in active_connections.get(room_id, []):
            active_connections[room_id].remove(websocket)
        
        # Notify other users
        for connection in active_connections.get(room_id, []):
            try:
                await connection.send_json({
                    "type": "user_disconnected",
                    "users_count": len(active_connections[room_id])
                })
            except Exception:
                pass
        
        # Clean up empty rooms
        if room_id in active_connections and len(active_connections[room_id]) == 0:
            del active_connections[room_id]
            if room_id in active_vr_rooms:
                active_vr_rooms[room_id]["status"] = "ended"


@router.post("/api/vr_date/end/{room_id}")
async def end_vr_date(room_id: str) -> Dict[str, Any]:
    """End VR date session AND fire bond/teleport milestone unlocks."""
    try:
        user_a: Optional[str] = None
        user_b: Optional[str] = None

        if room_id in active_vr_rooms:
            active_vr_rooms[room_id]["status"] = "ended"
            active_vr_rooms[room_id]["ended_at"] = datetime.now(timezone.utc).isoformat()
            user_a = active_vr_rooms[room_id].get("user1_id")
            user_b = active_vr_rooms[room_id].get("user2_id")

        # Close all connections
        if room_id in active_connections:
            for connection in active_connections[room_id]:
                try:
                    await connection.close()
                except Exception:
                    pass
            del active_connections[room_id]

        # ── Milestone tracker: only fire once per completed VR date ──
        bond_unlocks: List[str] = []
        teleport_unlocks: Dict[str, List[str]] = {}

        if user_a and user_b and user_b != "other_user":
            try:
                # 1) Shared bond — increment date_count
                bond_key = _bond_id(user_a, user_b)
                now_iso = datetime.now(timezone.utc).isoformat()
                bond = await db.bonds.find_one_and_update(
                    {"bond_id": bond_key},
                    {
                        "$inc": {"shared_stats.date_count": 1},
                        "$setOnInsert": {
                            "user_a": sorted([user_a, user_b])[0],
                            "user_b": sorted([user_a, user_b])[1],
                            "created_at": now_iso,
                            "unlocked_shared_cosmetics": [],
                        },
                        "$set": {"updated_at": now_iso},
                    },
                    upsert=True,
                    return_document=True,
                    projection={"_id": 0},
                )
                new_count = int(bond.get("shared_stats", {}).get("date_count", 0))
                already = list(bond.get("unlocked_shared_cosmetics", []))
                bond_unlocks = _check_unlocks("date_count", new_count, already)
                if bond_unlocks:
                    await db.bonds.update_one(
                        {"bond_id": bond_key},
                        {"$addToSet": {"unlocked_shared_cosmetics": {"$each": bond_unlocks}}},
                    )

                # 2) Per-user teleport VFX — vr_dates_completed +1
                for uid in (user_a, user_b):
                    vfx_doc = await _get_or_init_user_vfx(uid)
                    new_value = int(vfx_doc.get("stats", {}).get("vr_dates_completed", 0)) + 1
                    already_fx = list(vfx_doc.get("unlocked_effects", []))
                    fresh_fx = [
                        cid
                        for threshold, cid in TELEPORT_UNLOCK_RULES["vr_dates_completed"]
                        if new_value >= threshold and cid not in already_fx
                    ]
                    update: dict = {"$set": {"stats.vr_dates_completed": new_value, "updated_at": now_iso}}
                    if fresh_fx:
                        update["$addToSet"] = {"unlocked_effects": {"$each": fresh_fx}}
                    await db.teleport_vfx.update_one({"user_id": uid}, update)
                    if fresh_fx:
                        teleport_unlocks[uid] = fresh_fx
            except Exception as milestone_err:
                # Milestone bookkeeping should never break the end-date call
                logger.exception("VR date milestone tracking failed: %s", milestone_err)

        return {
            "success": True,
            "message": "VR date ended",
            "room_id": room_id,
            "bond_unlocks": bond_unlocks,
            "teleport_unlocks": teleport_unlocks,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Request
from typing import Dict, Set, Any
from pydantic import BaseModel
from utils.database import get_database, get_current_user
from datetime import datetime, timezone
import json
import uuid

router = APIRouter(prefix="/speed-dating", tags=["speed_dating"])

# Store active WebSocket connections per room
active_connections: Dict[str, Set[WebSocket]] = {}

# ==================== MODELS ====================

class CreateSpeedDatingSession(BaseModel):
    duration_minutes: int = 5

class JoinSpeedDatingRoom(BaseModel):
    room_id: str
    user_id: str

# ==================== ENDPOINTS ====================

@router.post("/create-session")
async def create_speed_dating_session(session: CreateSpeedDatingSession, request: Request) -> Dict[str, Any]:
    """Create a new speed dating session"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Find a matched user for speed dating
    match = await db.matches.find_one({
        "$or": [
            {"user1_id": current_user.user_id, "status": "active"},
            {"user2_id": current_user.user_id, "status": "active"}
        ]
    }, {"_id": 0})
    
    if not match:
        raise HTTPException(status_code=404, detail="No active matches found. Match with someone first!")
    
    # Get partner ID
    partner_id = match["user2_id"] if match["user1_id"] == current_user.user_id else match["user1_id"]
    
    # Create speed dating session
    room_id = f"speed-dating-{uuid.uuid4().hex[:12]}"
    
    speed_dating_session = {
        "room_id": room_id,
        "user1_id": current_user.user_id,
        "user2_id": partner_id,
        "duration_minutes": session.duration_minutes,
        "status": "waiting",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "started_at": None,
        "ended_at": None,
        "user1_rating": None,
        "user2_rating": None,
        "user1_interested": None,
        "user2_interested": None
    }
    
    await db.speed_dating_sessions.insert_one(speed_dating_session)
    
    return {
        "room_id": room_id,
        "partner_id": partner_id,
        "duration_minutes": session.duration_minutes,
        "message": "Speed dating session created!"
    }


@router.get("/room/{room_id}")
async def get_room_info(room_id: str, request: Request) -> Dict[str, Any]:
    """Get speed dating room information"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    session = await db.speed_dating_sessions.find_one(
        {"room_id": room_id},
        {"_id": 0}
    )
    
    if not session:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Check if user is part of this session
    if current_user.user_id not in [session["user1_id"], session["user2_id"]]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get partner info
    partner_id = session["user2_id"] if session["user1_id"] == current_user.user_id else session["user1_id"]
    partner = await db.users.find_one(
        {"user_id": partner_id},
        {"_id": 0, "user_id": 1, "name": 1, "picture": 1}
    )
    
    return {
        "room_id": room_id,
        "partner": partner,
        "duration_minutes": session["duration_minutes"],
        "status": session["status"]
    }


@router.post("/room/{room_id}/feedback")
async def submit_feedback(room_id: str, rating: int, interested: bool, request: Request) -> Dict[str, Any]:
    """Submit post-session feedback"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    session = await db.speed_dating_sessions.find_one(
        {"room_id": room_id},
        {"_id": 0}
    )
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Update feedback
    if session["user1_id"] == current_user.user_id:
        await db.speed_dating_sessions.update_one(
            {"room_id": room_id},
            {"$set": {
                "user1_rating": rating,
                "user1_interested": interested
            }}
        )
    elif session["user2_id"] == current_user.user_id:
        await db.speed_dating_sessions.update_one(
            {"room_id": room_id},
            {"$set": {
                "user2_rating": rating,
                "user2_interested": interested
            }}
        )
    
    # Check if both submitted feedback and both interested
    updated_session = await db.speed_dating_sessions.find_one(
        {"room_id": room_id},
        {"_id": 0}
    )
    
    mutual_interest = (
        updated_session.get("user1_interested") and 
        updated_session.get("user2_interested")
    )
    
    return {
        "message": "Feedback submitted",
        "mutual_interest": mutual_interest
    }


# ==================== WEBSOCKET SIGNALING ====================

@router.websocket("/ws/{room_id}/{user_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, user_id: str) -> Dict[str, Any]:
    """WebSocket endpoint for WebRTC signaling"""
    await websocket.accept()
    
    # Add to active connections
    if room_id not in active_connections:
        active_connections[room_id] = set()
    
    active_connections[room_id].add(websocket)
    
    print(f"User {user_id} connected to room {room_id}")
    
    try:
        # Notify others in the room
        await broadcast_to_room(room_id, {
            "type": "user-joined",
            "user_id": user_id
        }, exclude=websocket)
        
        # Handle incoming messages (WebRTC signaling)
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            print(f"Received message: {message.get('type')} from {user_id}")
            
            # Broadcast to other users in the room
            await broadcast_to_room(room_id, {
                **message,
                "from_user": user_id
            }, exclude=websocket)
            
    except WebSocketDisconnect:
        print(f"User {user_id} disconnected from room {room_id}")
        active_connections[room_id].remove(websocket)
        
        # Notify others
        await broadcast_to_room(room_id, {
            "type": "user-left",
            "user_id": user_id
        })
        
        # Clean up empty rooms
        if len(active_connections[room_id]) == 0:
            del active_connections[room_id]


async def broadcast_to_room(room_id: str, message: dict, exclude: WebSocket = None) -> Dict[str, Any]:
    """Broadcast message to all connections in a room"""
    if room_id not in active_connections:
        return
    
    message_str = json.dumps(message)
    
    for connection in active_connections[room_id]:
        if connection != exclude:
            try:
                await connection.send_text(message_str)
            except Exception:
                # Connection closed, remove it
                active_connections[room_id].discard(connection)


@router.get("/active-rooms")
async def get_active_rooms() -> Dict[str, Any]:
    """Get list of active video rooms (for debugging)"""
    return {
        "active_rooms": list(active_connections.keys()),
        "total_connections": sum(len(conns) for conns in active_connections.values())
    }

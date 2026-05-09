"""
WebRTC Live Streaming System
Handles signaling, stream management, and viewer tracking
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from datetime import datetime, timezone
import json
import uuid
import os
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/live-streaming", tags=["live_streaming"])

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'global_vibez_dsg')
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Active connections for WebRTC signaling
active_connections: Dict[str, Dict[str, WebSocket]] = {}  # {stream_id: {user_id: websocket}}

# Pydantic Models
class StreamCreate(BaseModel):
    user_id: str
    title: str
    description: Optional[str] = None
    category: str = "gaming"  # gaming, dating, casual
    tags: List[str] = []

class ChatMessage(BaseModel):
    stream_id: str
    user_id: str
    username: str
    message: str

# ========== STREAM MANAGEMENT ==========

@router.post("/stream/start")
async def start_stream(stream: StreamCreate) -> Dict[str, Any]:
    """Start a new live stream"""
    try:
        # Check if user is already streaming
        existing = await db.active_streams.find_one({
            "user_id": stream.user_id,
            "status": "live"
        })
        
        if existing:
            raise HTTPException(status_code=400, detail="Already streaming")
        
        # Create stream
        stream_id = f"stream_{uuid.uuid4().hex[:12]}"
        
        stream_doc = {
            "id": stream_id,
            "user_id": stream.user_id,
            "title": stream.title,
            "description": stream.description,
            "category": stream.category,
            "tags": stream.tags,
            "viewer_count": 0,
            "viewers": [],
            "status": "live",
            "started_at": datetime.now(timezone.utc).isoformat(),
            "ended_at": None,
            "total_duration_seconds": 0,
            "peak_viewers": 0,
            "total_messages": 0,
            "likes": 0
        }
        
        await db.active_streams.insert_one(stream_doc)
        
        # Create MY VIBEZ post for the stream
        post_doc = {
            "id": f"vibe_{stream_id}",
            "user_id": stream.user_id,
            "type": "video",
            "video_url": f"live://{stream_id}",
            "caption": f"🔴 LIVE: {stream.title}",
            "duration": 0,
            "is_live": True,
            "tags": stream.tags + ["live"],
            "likes": 0,
            "comments": 0,
            "views": 0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.my_vibez.insert_one(post_doc)
        
        # Initialize WebSocket room
        active_connections[stream_id] = {}
        
        return {
            "success": True,
            "stream_id": stream_id,
            "message": "Stream started successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/stream/end/{stream_id}")
async def end_stream(stream_id: str, user_id: str) -> Dict[str, Any]:
    """End a live stream"""
    try:
        stream = await db.active_streams.find_one({"id": stream_id})
        
        if not stream:
            raise HTTPException(status_code=404, detail="Stream not found")
        
        if stream["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        # Calculate duration
        started_at = datetime.fromisoformat(stream["started_at"])
        ended_at = datetime.now(timezone.utc)
        duration_seconds = (ended_at - started_at).total_seconds()
        
        # Update stream
        await db.active_streams.update_one(
            {"id": stream_id},
            {"$set": {
                "status": "ended",
                "ended_at": ended_at.isoformat(),
                "total_duration_seconds": duration_seconds
            }}
        )
        
        # Update MY VIBEZ post
        await db.my_vibez.update_one(
            {"id": f"vibe_{stream_id}"},
            {"$set": {
                "is_live": False,
                "duration": duration_seconds
            }}
        )
        
        # Close all WebSocket connections
        if stream_id in active_connections:
            for ws in active_connections[stream_id].values():
                try:
                    await ws.close()
                except Exception:
                    pass
            del active_connections[stream_id]
        
        return {
            "success": True,
            "message": "Stream ended",
            "duration_seconds": duration_seconds
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/streams/active")
async def get_active_streams(category: Optional[str] = None, skip: int = 0, limit: int = 20) -> Dict[str, Any]:
    """Get all active live streams"""
    try:
        query = {"status": "live"}
        if category:
            query["category"] = category
        
        streams = await db.active_streams.find(query, {"_id": 0}) \
            .sort("viewer_count", -1) \
            .skip(skip) \
            .limit(limit) \
            .to_list(limit)
        
        # Enrich with streamer info
        for stream in streams:
            user = await db.users.find_one({"user_id": stream["user_id"]}, {"_id": 0})
            if user:
                stream["streamer_name"] = user.get("name", "Unknown")
                stream["streamer_avatar"] = user.get("avatar")
        
        return {
            "success": True,
            "streams": streams,
            "count": len(streams)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stream/{stream_id}")
async def get_stream_info(stream_id: str) -> Dict[str, Any]:
    """Get stream details"""
    try:
        stream = await db.active_streams.find_one({"id": stream_id}, {"_id": 0})
        
        if not stream:
            raise HTTPException(status_code=404, detail="Stream not found")
        
        # Get streamer info
        user = await db.users.find_one({"user_id": stream["user_id"]}, {"_id": 0})
        if user:
            stream["streamer_name"] = user.get("name", "Unknown")
            stream["streamer_avatar"] = user.get("avatar")
        
        return {
            "success": True,
            "stream": stream
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ========== WEBRTC SIGNALING ==========

@router.websocket("/ws/{stream_id}/{user_id}")
async def websocket_signaling(websocket: WebSocket, stream_id: str, user_id: str) -> Dict[str, Any]:
    """WebRTC signaling via WebSocket"""
    await websocket.accept()
    
    # Initialize room if needed
    if stream_id not in active_connections:
        active_connections[stream_id] = {}
    
    active_connections[stream_id][user_id] = websocket
    
    # Update viewer count
    viewer_count = len(active_connections[stream_id])
    await db.active_streams.update_one(
        {"id": stream_id},
        {
            "$set": {"viewer_count": viewer_count},
            "$max": {"peak_viewers": viewer_count},
            "$addToSet": {"viewers": user_id}
        }
    )
    
    # Notify all peers of new viewer
    await broadcast_to_stream(stream_id, {
        "type": "viewer-joined",
        "user_id": user_id,
        "viewer_count": viewer_count
    }, exclude=user_id)
    
    try:
        while True:
            # Receive signaling message (offer, answer, ice-candidate)
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Relay to specific peer or broadcast
            if "target" in message:
                # Send to specific peer
                target_id = message["target"]
                if target_id in active_connections[stream_id]:
                    await active_connections[stream_id][target_id].send_text(
                        json.dumps({**message, "from": user_id})
                    )
            else:
                # Broadcast to all peers except sender
                await broadcast_to_stream(stream_id, {**message, "from": user_id}, exclude=user_id)
    
    except WebSocketDisconnect:
        # Remove from active connections
        if stream_id in active_connections and user_id in active_connections[stream_id]:
            del active_connections[stream_id][user_id]
        
        # Update viewer count
        viewer_count = len(active_connections[stream_id]) if stream_id in active_connections else 0
        await db.active_streams.update_one(
            {"id": stream_id},
            {"$set": {"viewer_count": viewer_count}}
        )
        
        # Notify remaining viewers
        await broadcast_to_stream(stream_id, {
            "type": "viewer-left",
            "user_id": user_id,
            "viewer_count": viewer_count
        })

async def broadcast_to_stream(stream_id: str, message: dict, exclude: str = None) -> Dict[str, Any]:
    """Broadcast message to all connections in a stream"""
    if stream_id not in active_connections:
        return
    
    for uid, ws in active_connections[stream_id].items():
        if uid != exclude:
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                pass

# ========== STREAM CHAT ==========

@router.post("/chat/send")
async def send_chat_message(message: ChatMessage) -> Dict[str, Any]:
    """Send a chat message to stream"""
    try:
        # Save message
        msg_doc = {
            "id": f"msg_{uuid.uuid4().hex[:12]}",
            "stream_id": message.stream_id,
            "user_id": message.user_id,
            "username": message.username,
            "message": message.message,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        await db.stream_chat.insert_one(msg_doc)
        
        # Update stream message count
        await db.active_streams.update_one(
            {"id": message.stream_id},
            {"$inc": {"total_messages": 1}}
        )

        # Roadmap PDF §3 — Seated Ownership UI unlock. Stamp the
        # broadcast with the sender's chair perks so every viewer sees
        # the chair-holder's name in their unique color.
        try:
            from services.chair_perks_service import get_chair_perks_for_user  # noqa: PLC0415
            chair_perks = await get_chair_perks_for_user(db, message.user_id)
        except Exception:
            chair_perks = None

        # Broadcast to all viewers via WebSocket
        await broadcast_to_stream(message.stream_id, {
            "type": "chat-message",
            "user_id": message.user_id,
            "username": message.username,
            "message": message.message,
            "timestamp": msg_doc["timestamp"],
            "chair_perks": chair_perks,
        })
        
        return {"success": True, "message_id": msg_doc["id"]}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/chat/{stream_id}")
async def get_stream_chat(stream_id: str, limit: int = 50) -> Dict[str, Any]:
    """Get recent chat messages for a stream"""
    try:
        messages = await db.stream_chat.find(
            {"stream_id": stream_id},
            {"_id": 0}
        ).sort("timestamp", -1).limit(limit).to_list(limit)
        
        messages.reverse()  # Oldest first
        
        return {
            "success": True,
            "messages": messages
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

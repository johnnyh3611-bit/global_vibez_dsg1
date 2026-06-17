"""
1-on-1 Video Call System with WebRTC
Handles call initiation, signaling, and call management
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel
from typing import Dict, Any
from datetime import datetime, timezone
import json
import uuid
from utils.database import get_database

router = APIRouter(prefix="/video-call", tags=["video_call"])

# Active video call connections
active_calls: Dict[str, Dict] = {}  # {call_id: {caller_id, callee_id, status, websockets}}
user_websockets: Dict[str, WebSocket] = {}  # {user_id: websocket}

# Pydantic Models
class CallInitiate(BaseModel):
    caller_id: str
    callee_id: str
    call_type: str = "video"  # video, audio, screen

class CallAction(BaseModel):
    call_id: str
    user_id: str

class CallEnd(BaseModel):
    call_id: str
    user_id: str
    duration_seconds: int

# ========== CALL MANAGEMENT ==========

@router.post("/initiate")
async def initiate_call(call: CallInitiate) -> Dict[str, Any]:
    """Initiate a video call to another user"""
    try:
        db = get_database()
        
        # Check if users exist
        caller = await db.users.find_one({"user_id": call.caller_id}, {"_id": 0})
        callee = await db.users.find_one({"user_id": call.callee_id}, {"_id": 0})
        
        if not caller or not callee:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check if callee is in another call
        for call_id, call_data in active_calls.items():
            if (call_data["callee_id"] == call.callee_id or call_data["caller_id"] == call.callee_id) and call_data["status"] in ["ringing", "active"]:
                raise HTTPException(status_code=409, detail="User is busy")
        
        # Create call
        call_id = f"call_{uuid.uuid4().hex[:12]}"
        
        call_doc = {
            "id": call_id,
            "caller_id": call.caller_id,
            "caller_name": caller.get("name", "User"),
            "callee_id": call.callee_id,
            "callee_name": callee.get("name", "User"),
            "call_type": call.call_type,
            "status": "ringing",  # ringing, active, ended, rejected, missed
            "started_at": datetime.now(timezone.utc).isoformat(),
            "answered_at": None,
            "ended_at": None,
            "duration_seconds": 0
        }
        
        # Store in active calls
        active_calls[call_id] = {
            "caller_id": call.caller_id,
            "callee_id": call.callee_id,
            "status": "ringing",
            "call_type": call.call_type,
            "created_at": datetime.now(timezone.utc)
        }
        
        # Save to database
        await db.video_calls.insert_one(call_doc)
        
        # Send notification to callee via WebSocket (if connected)
        if call.callee_id in user_websockets:
            await send_call_notification(call.callee_id, call_doc)
        
        return {
            "success": True,
            "call_id": call_id,
            "message": "Call initiated"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/accept")
async def accept_call(action: CallAction) -> Dict[str, Any]:
    """Accept an incoming call"""
    try:
        db = get_database()
        
        # Check if call exists
        call = await db.video_calls.find_one({"id": action.call_id}, {"_id": 0})
        
        if not call:
            raise HTTPException(status_code=404, detail="Call not found")
        
        if call["status"] != "ringing":
            raise HTTPException(status_code=400, detail="Call is not ringing")
        
        if call["callee_id"] != action.user_id:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        # Update call status
        await db.video_calls.update_one(
            {"id": action.call_id},
            {
                "$set": {
                    "status": "active",
                    "answered_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        # Update active calls
        if action.call_id in active_calls:
            active_calls[action.call_id]["status"] = "active"
        
        # Notify caller that call was accepted
        if call["caller_id"] in user_websockets:
            await send_call_accepted(call["caller_id"], action.call_id)
        
        return {
            "success": True,
            "message": "Call accepted",
            "call_id": action.call_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reject")
async def reject_call(action: CallAction) -> Dict[str, Any]:
    """Reject an incoming call"""
    try:
        db = get_database()
        
        call = await db.video_calls.find_one({"id": action.call_id}, {"_id": 0})
        
        if not call:
            raise HTTPException(status_code=404, detail="Call not found")
        
        if call["callee_id"] != action.user_id:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        # Update call status
        await db.video_calls.update_one(
            {"id": action.call_id},
            {
                "$set": {
                    "status": "rejected",
                    "ended_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        # Remove from active calls
        if action.call_id in active_calls:
            del active_calls[action.call_id]
        
        # Notify caller that call was rejected
        if call["caller_id"] in user_websockets:
            await send_call_rejected(call["caller_id"], action.call_id)
        
        return {
            "success": True,
            "message": "Call rejected"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/end")
async def end_call(action: CallEnd) -> Dict[str, Any]:
    """End an active call"""
    try:
        db = get_database()
        
        call = await db.video_calls.find_one({"id": action.call_id}, {"_id": 0})
        
        if not call:
            raise HTTPException(status_code=404, detail="Call not found")
        
        if call["caller_id"] != action.user_id and call["callee_id"] != action.user_id:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        # Update call status
        await db.video_calls.update_one(
            {"id": action.call_id},
            {
                "$set": {
                    "status": "ended",
                    "ended_at": datetime.now(timezone.utc).isoformat(),
                    "duration_seconds": action.duration_seconds
                }
            }
        )
        
        # Remove from active calls
        if action.call_id in active_calls:
            del active_calls[action.call_id]
        
        # Notify other party that call ended
        other_user = call["callee_id"] if action.user_id == call["caller_id"] else call["caller_id"]
        if other_user in user_websockets:
            await send_call_ended(other_user, action.call_id)
        
        # Award XP for completed call
        if call["status"] == "active" and action.duration_seconds > 60:
            xp_reward = min(action.duration_seconds // 60, 50)  # 1 XP per minute, max 50
            await db.users.update_one(
                {"user_id": action.user_id},
                {"$inc": {"xp": xp_reward}}
            )
        
        return {
            "success": True,
            "message": "Call ended"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history/{user_id}")
async def get_call_history(user_id: str, limit: int = 20) -> Dict[str, Any]:
    """Get call history for a user"""
    try:
        db = get_database()
        
        calls = await db.video_calls.find(
            {
                "$or": [
                    {"caller_id": user_id},
                    {"callee_id": user_id}
                ]
            },
            {"_id": 0}
        ).sort("started_at", -1).limit(limit).to_list(limit)
        
        return {
            "success": True,
            "calls": calls,
            "count": len(calls)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/active")
async def get_active_calls() -> Dict[str, Any]:
    """Get all active calls (admin/debugging)"""
    return {
        "success": True,
        "active_calls": list(active_calls.keys()),
        "count": len(active_calls)
    }

# ========== WEBSOCKET SIGNALING ==========

@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str) -> Dict[str, Any]:
    """WebSocket endpoint for WebRTC signaling"""
    await websocket.accept()
    user_websockets[user_id] = websocket
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            event_type = message.get("type")
            call_id = message.get("call_id")
            
            if not call_id or call_id not in active_calls:
                continue
            
            call_data = active_calls[call_id]
            
            # Forward signaling messages to the other peer
            if event_type == "offer":
                # Caller sending offer to callee
                target_user = call_data["callee_id"]
                if target_user in user_websockets:
                    await user_websockets[target_user].send_text(json.dumps({
                        "type": "offer",
                        "call_id": call_id,
                        "offer": message.get("offer")
                    }))
            
            elif event_type == "answer":
                # Callee sending answer to caller
                target_user = call_data["caller_id"]
                if target_user in user_websockets:
                    await user_websockets[target_user].send_text(json.dumps({
                        "type": "answer",
                        "call_id": call_id,
                        "answer": message.get("answer")
                    }))
            
            elif event_type == "ice-candidate":
                # Forward ICE candidates to the other peer
                target_user = call_data["callee_id"] if user_id == call_data["caller_id"] else call_data["caller_id"]
                if target_user in user_websockets:
                    await user_websockets[target_user].send_text(json.dumps({
                        "type": "ice-candidate",
                        "call_id": call_id,
                        "candidate": message.get("candidate")
                    }))
            
    except WebSocketDisconnect:
        # Clean up on disconnect
        if user_id in user_websockets:
            del user_websockets[user_id]

# ========== HELPER FUNCTIONS ==========

async def send_call_notification(user_id: str, call_data: Dict) -> Dict[str, Any]:
    """Send incoming call notification to user"""
    if user_id in user_websockets:
        await user_websockets[user_id].send_text(json.dumps({
            "type": "incoming_call",
            "call_id": call_data["id"],
            "caller_id": call_data["caller_id"],
            "caller_name": call_data["caller_name"],
            "call_type": call_data["call_type"]
        }))

async def send_call_accepted(user_id: str, call_id: str) -> Dict[str, Any]:
    """Notify caller that call was accepted"""
    if user_id in user_websockets:
        await user_websockets[user_id].send_text(json.dumps({
            "type": "call_accepted",
            "call_id": call_id
        }))

async def send_call_rejected(user_id: str, call_id: str) -> Dict[str, Any]:
    """Notify caller that call was rejected"""
    if user_id in user_websockets:
        await user_websockets[user_id].send_text(json.dumps({
            "type": "call_rejected",
            "call_id": call_id
        }))

async def send_call_ended(user_id: str, call_id: str) -> Dict[str, Any]:
    """Notify user that call ended"""
    if user_id in user_websockets:
        await user_websockets[user_id].send_text(json.dumps({
            "type": "call_ended",
            "call_id": call_id
        }))

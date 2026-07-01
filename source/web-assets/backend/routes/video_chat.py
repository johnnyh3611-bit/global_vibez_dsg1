"""
WebRTC Video Chat Signaling Server
Handles peer-to-peer video connections for gaming and dating features
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel
from typing import Dict, Optional, List, Any
from datetime import datetime, timezone
import secrets

router = APIRouter()

# Active WebSocket connections per room
video_rooms: Dict[str, Dict[str, WebSocket]] = {}

# Room metadata
class VideoRoom(BaseModel):
    room_id: str
    game_type: Optional[str] = None  # 'spades', 'poker', 'dating', etc.
    created_at: str
    participants: List[str] = []

class SignalingMessage(BaseModel):
    type: str  # 'offer', 'answer', 'ice-candidate'
    room_id: str
    from_user: str
    to_user: str
    data: dict

# Store room metadata
active_rooms: Dict[str, VideoRoom] = {}

def create_room(room_id: str, game_type: Optional[str] = None):
    """Create a new video chat room"""
    if room_id not in video_rooms:
        video_rooms[room_id] = {}
        active_rooms[room_id] = VideoRoom(
            room_id=room_id,
            game_type=game_type,
            created_at=datetime.now(timezone.utc).isoformat(),
            participants=[]
        )

async def broadcast_to_room(room_id: str, message: dict, exclude_user: Optional[str] = None) -> Dict[str, Any]:
    """Send message to all users in room except excluded user"""
    if room_id not in video_rooms:
        return
    
    dead_connections = []
    for user_id, websocket in video_rooms[room_id].items():
        if user_id == exclude_user:
            continue
        
        try:
            await websocket.send_json(message)
        except Exception:
            dead_connections.append(user_id)
    
    # Clean up dead connections
    for user_id in dead_connections:
        if user_id in video_rooms[room_id]:
            del video_rooms[room_id][user_id]
            if user_id in active_rooms[room_id].participants:
                active_rooms[room_id].participants.remove(user_id)

# ========== HTTP ENDPOINTS ==========

@router.get("/video-chat/rooms")
async def get_active_rooms() -> Dict[str, Any]:
    """Get list of active video chat rooms"""
    rooms = []
    for room_id, room_data in active_rooms.items():
        rooms.append({
            'room_id': room_id,
            'game_type': room_data.game_type,
            'participant_count': len(room_data.participants),
            'participants': room_data.participants,
            'created_at': room_data.created_at
        })
    
    return {'success': True, 'rooms': rooms}

@router.post("/video-chat/create-room")
async def create_video_room(game_type: Optional[str] = None) -> Dict[str, Any]:
    """Create a new video chat room"""
    room_id = f"room_{secrets.token_urlsafe(8)}"
    create_room(room_id, game_type)
    
    return {
        'success': True,
        'room_id': room_id,
        'signaling_url': f'/api/ws/video-chat/{room_id}'
    }

@router.get("/video-chat/room/{room_id}")
async def get_room_info(room_id: str) -> Dict[str, Any]:
    """Get information about a specific room"""
    if room_id not in active_rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room = active_rooms[room_id]
    return {
        'success': True,
        'room': {
            'room_id': room.room_id,
            'game_type': room.game_type,
            'participant_count': len(room.participants),
            'participants': room.participants,
            'created_at': room.created_at
        }
    }

# ========== WEBSOCKET SIGNALING ==========

@router.websocket("/ws/video-chat/{room_id}")
async def video_chat_signaling(websocket: WebSocket, room_id: str) -> Dict[str, Any]:
    """
    WebRTC Signaling WebSocket
    
    Message Types:
    - join: User joins the room
    - offer: WebRTC offer (SDP)
    - answer: WebRTC answer (SDP)
    - ice-candidate: ICE candidate for connection
    - leave: User leaves the room
    """
    await websocket.accept()
    
    user_id = None
    username = "Anonymous"
    
    try:
        # Wait for join message
        join_msg = await websocket.receive_json()
        
        if join_msg.get('type') != 'join':
            await websocket.close(code=1003, reason="Expected 'join' message")
            return
        
        user_id = join_msg.get('user_id')
        username = join_msg.get('username', 'Anonymous')
        
        # Create room if it doesn't exist
        if room_id not in video_rooms:
            create_room(room_id, join_msg.get('game_type'))
        
        # Add user to room
        video_rooms[room_id][user_id] = websocket
        if user_id not in active_rooms[room_id].participants:
            active_rooms[room_id].participants.append(user_id)
        
        # Notify user of successful join
        await websocket.send_json({
            'type': 'joined',
            'room_id': room_id,
            'user_id': user_id,
            'participants': active_rooms[room_id].participants
        })
        
        # Notify other users in room
        await broadcast_to_room(room_id, {
            'type': 'user-joined',
            'user_id': user_id,
            'username': username,
            'participant_count': len(active_rooms[room_id].participants)
        }, exclude_user=user_id)
        
        # Listen for signaling messages
        while True:
            message = await websocket.receive_json()
            msg_type = message.get('type')
            
            if msg_type == 'offer':
                # Forward WebRTC offer to target user
                to_user = message.get('to_user')
                if to_user and to_user in video_rooms[room_id]:
                    await video_rooms[room_id][to_user].send_json({
                        'type': 'offer',
                        'from_user': user_id,
                        'offer': message.get('offer')
                    })
            
            elif msg_type == 'answer':
                # Forward WebRTC answer to target user
                to_user = message.get('to_user')
                if to_user and to_user in video_rooms[room_id]:
                    await video_rooms[room_id][to_user].send_json({
                        'type': 'answer',
                        'from_user': user_id,
                        'answer': message.get('answer')
                    })
            
            elif msg_type == 'ice-candidate':
                # Forward ICE candidate to target user
                to_user = message.get('to_user')
                if to_user and to_user in video_rooms[room_id]:
                    await video_rooms[room_id][to_user].send_json({
                        'type': 'ice-candidate',
                        'from_user': user_id,
                        'candidate': message.get('candidate')
                    })
            
            elif msg_type == 'ping':
                await websocket.send_json({'type': 'pong'})
    
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        # Clean up user from room
        if user_id and room_id in video_rooms and user_id in video_rooms[room_id]:
            del video_rooms[room_id][user_id]
            
            if room_id in active_rooms and user_id in active_rooms[room_id].participants:
                active_rooms[room_id].participants.remove(user_id)
            
            # Notify others that user left
            await broadcast_to_room(room_id, {
                'type': 'user-left',
                'user_id': user_id,
                'username': username,
                'participant_count': len(active_rooms[room_id].participants) if room_id in active_rooms else 0
            })
            
            # Delete room if empty
            if room_id in video_rooms and len(video_rooms[room_id]) == 0:
                del video_rooms[room_id]
                if room_id in active_rooms:
                    del active_rooms[room_id]

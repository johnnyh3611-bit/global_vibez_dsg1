"""
VR Dating Room WebSocket Server
Real-time sync for position, gestures, and avatar customization
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, Set, Any
import json
from datetime import datetime, timezone

router = APIRouter()

# Active VR dating rooms
# Structure: {room_id: {websocket_connections}}
vr_dating_rooms: Dict[str, Set[WebSocket]] = {}

# User info per room
# Structure: {room_id: {user_id: {websocket, position, color, last_seen}}}
room_users: Dict[str, Dict[str, dict]] = {}

@router.websocket("/ws/vr-dating/{room_id}")
async def vr_dating_websocket(websocket: WebSocket, room_id: str) -> Dict[str, Any]:
    """
    WebSocket endpoint for VR Dating Room real-time sync.
    
    Handles:
    - Position updates (30 FPS avatar movement)
    - Gesture broadcasting (wave, heart, thumbs up)
    - Avatar color sync
    - Environment changes
    - Voice chat signaling (offer/answer/ICE)
    """
    await websocket.accept()
    
    # Initialize room if doesn't exist
    if room_id not in vr_dating_rooms:
        vr_dating_rooms[room_id] = set()
        room_users[room_id] = {}
    
    # Add connection to room
    vr_dating_rooms[room_id].add(websocket)
    
    user_id = None
    
    try:
        print(f"✅ User connected to VR Dating Room: {room_id}")
        
        while True:
            # Receive message from client
            data_str = await websocket.receive_text()
            data = json.loads(data_str)
            
            message_type = data.get('type')
            
            # Handle initialization
            if message_type == 'init':
                user_id = data.get('userId')
                room_users[room_id][user_id] = {
                    'websocket': websocket,
                    'position': data.get('position', [0, 0, 0]),
                    'color': data.get('avatarColor', '#ff69b4'),
                    'last_seen': datetime.now(timezone.utc).isoformat()
                }
                
                # Send current room state to new user
                room_state = {
                    'type': 'room_state',
                    'users': {
                        uid: {
                            'position': user_data['position'],
                            'color': user_data['color']
                        }
                        for uid, user_data in room_users[room_id].items()
                        if uid != user_id
                    }
                }
                await websocket.send_text(json.dumps(room_state))
                
                print(f"👤 User {user_id} initialized in room {room_id}")
            
            # Update last seen timestamp
            if user_id and user_id in room_users.get(room_id, {}):
                room_users[room_id][user_id]['last_seen'] = datetime.now(timezone.utc).isoformat()
            
            # Handle position updates
            if message_type == 'position_update':
                if user_id and user_id in room_users.get(room_id, {}):
                    room_users[room_id][user_id]['position'] = data.get('position')
            
            # Handle avatar color changes
            if message_type == 'avatar_color':
                if user_id and user_id in room_users.get(room_id, {}):
                    room_users[room_id][user_id]['color'] = data.get('color')
            
            # Broadcast to all other users in the room
            for connection in vr_dating_rooms[room_id]:
                if connection != websocket:
                    try:
                        await connection.send_text(data_str)
                    except Exception as e:
                        print(f"Error broadcasting to connection: {e}")
    
    except WebSocketDisconnect:
        print(f"❌ User disconnected from VR Dating Room: {room_id}")
    
    except Exception as e:
        print(f"WebSocket error in room {room_id}: {e}")
    
    finally:
        # Cleanup on disconnect
        vr_dating_rooms[room_id].discard(websocket)
        
        # Remove user from room users
        if user_id and room_id in room_users and user_id in room_users[room_id]:
            del room_users[room_id][user_id]
        
        # Remove empty rooms
        if len(vr_dating_rooms[room_id]) == 0:
            del vr_dating_rooms[room_id]
            if room_id in room_users:
                del room_users[room_id]
            print(f"🗑️ Removed empty VR Dating Room: {room_id}")
        
        # Notify other users that someone left
        if room_id in vr_dating_rooms:
            disconnect_msg = json.dumps({
                'type': 'user_disconnected',
                'userId': user_id,
                'timestamp': datetime.now(timezone.utc).isoformat()
            })
            for connection in vr_dating_rooms[room_id]:
                try:
                    await connection.send_text(disconnect_msg)
                except Exception as e:
                    print(f"Error sending disconnect message: {e}")

# REST endpoint to get active VR dating rooms
@router.get("/vr-dating/rooms/active")
async def get_active_vr_rooms() -> Dict[str, Any]:
    """Get list of active VR dating rooms"""
    active_rooms = []
    
    for room_id, users in room_users.items():
        active_rooms.append({
            'room_id': room_id,
            'user_count': len(users),
            'users': [
                {
                    'user_id': uid,
                    'position': user_data['position'],
                    'color': user_data['color'],
                    'last_seen': user_data['last_seen']
                }
                for uid, user_data in users.items()
            ]
        })
    
    return {
        'success': True,
        'active_rooms': active_rooms,
        'total_rooms': len(active_rooms),
        'total_users': sum(len(users) for users in room_users.values())
    }

# REST endpoint to kick user from room (admin only)
@router.post("/vr-dating/rooms/{room_id}/kick/{user_id}")
async def kick_user_from_room(room_id: str, user_id: str) -> Dict[str, Any]:
    """Kick a user from VR dating room (admin function)"""
    if room_id not in room_users or user_id not in room_users[room_id]:
        return {'success': False, 'message': 'User not found in room'}
    
    user_ws = room_users[room_id][user_id]['websocket']
    
    # Send kick message
    kick_msg = json.dumps({
        'type': 'kicked',
        'reason': 'Removed by administrator',
        'timestamp': datetime.now(timezone.utc).isoformat()
    })
    
    try:
        await user_ws.send_text(kick_msg)
        await user_ws.close()
    except Exception as e:
        print(f"Error kicking user: {e}")
    
    # Remove from room
    del room_users[room_id][user_id]
    vr_dating_rooms[room_id].discard(user_ws)
    
    return {
        'success': True,
        'message': f'User {user_id} kicked from room {room_id}'
    }

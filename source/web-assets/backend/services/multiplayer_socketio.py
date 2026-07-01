"""
Multiplayer WebSocket Server
Real-time game rooms, matchmaking, and video chat signaling
"""

import socketio
from typing import Any, Dict, List, Optional
import secrets
secure_random = secrets.SystemRandom()
import uuid
from datetime import datetime, timezone
from collections import defaultdict

# Socket.IO server with async support
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=True,
    engineio_logger=False
)

# Game rooms storage
game_rooms: Dict[str, Dict[str, Any]] = {}
# Matchmaking queue by game type
matchmaking_queue: Dict[str, List[str]] = defaultdict(list)
# User sessions
user_sessions: Dict[str, Dict[str, Any]] = {}


# ==================== SOCKET.IO EVENTS ====================

@sio.event
async def connect(sid: str, environ: Dict[str, Any]) -> None:
    """Client connected"""
    print(f"🟢 Client connected: {sid}")
    user_sessions[sid] = {
        "sid": sid,
        "user_id": None,
        "room_id": None,
        "connected_at": datetime.now(timezone.utc).isoformat()
    }


@sio.event
async def disconnect(sid: str) -> None:
    """Client disconnected"""
    print(f"🔴 Client disconnected: {sid}")
    
    # Remove from room if in one
    user = user_sessions.get(sid)
    if user and user.get("room_id"):
        await leave_game_room(sid, user["room_id"])
    
    # Remove from matchmaking queue
    for game_type in matchmaking_queue:
        if sid in matchmaking_queue[game_type]:
            matchmaking_queue[game_type].remove(sid)
    
    # Clean up session
    if sid in user_sessions:
        del user_sessions[sid]


@sio.event
async def authenticate(sid: str, data: Dict[str, Any]) -> None:
    """Authenticate user with session"""
    user_id = data.get("user_id")
    user_name = data.get("user_name", "Player")
    
    if user_id:
        user_sessions[sid]["user_id"] = user_id
        user_sessions[sid]["user_name"] = user_name
        await sio.emit('authenticated', {"success": True, "sid": sid}, room=sid)
        print(f"✅ User authenticated: {user_name} ({sid})")


@sio.event
async def find_match(sid: str, data: Dict[str, Any]) -> None:
    """Join matchmaking queue"""
    game_type = data.get("game_type", "uno")
    difficulty = data.get("difficulty", "medium")
    
    user = user_sessions.get(sid)
    if not user:
        return
    
    user["game_type"] = game_type
    user["difficulty"] = difficulty
    
    # Add to queue
    queue_key = f"{game_type}_{difficulty}"
    if sid not in matchmaking_queue[queue_key]:
        matchmaking_queue[queue_key].append(sid)
    
    print(f"🔍 {user.get('user_name')} searching for {game_type} match... Queue: {len(matchmaking_queue[queue_key])}")
    
    # Notify user
    await sio.emit('matchmaking_started', {
        "game_type": game_type,
        "queue_position": len(matchmaking_queue[queue_key])
    }, room=sid)
    
    # Try to match immediately
    await try_match_players(queue_key, game_type, difficulty)


@sio.event
async def cancel_matchmaking(sid: str, data: Dict[str, Any]) -> None:
    """Cancel matchmaking"""
    user = user_sessions.get(sid)
    if user and user.get("game_type"):
        queue_key = f"{user['game_type']}_{user.get('difficulty', 'medium')}"
        if sid in matchmaking_queue[queue_key]:
            matchmaking_queue[queue_key].remove(sid)
            await sio.emit('matchmaking_cancelled', {}, room=sid)


@sio.event
async def game_move(sid: str, data: Dict[str, Any]) -> None:
    """Player made a move"""
    user = user_sessions.get(sid)
    if not user or not user.get("room_id"):
        return
    
    room_id = user["room_id"]
    room = game_rooms.get(room_id)
    
    if not room:
        return
    
    # Broadcast move to all players in room
    await sio.emit('opponent_move', {
        "player_sid": sid,
        "player_name": user.get("user_name", "Player"),
        "move": data.get("move"),
        "game_state": data.get("game_state")
    }, room=room_id, skip_sid=sid)


@sio.event
async def chat_message(sid: str, data: Dict[str, Any]) -> None:
    """Send chat message to room"""
    user = user_sessions.get(sid)
    if not user or not user.get("room_id"):
        return
    
    room_id = user["room_id"]
    message = data.get("message", "")
    
    if message:
        await sio.emit('chat_message', {
            "player_sid": sid,
            "player_name": user.get("user_name", "Player"),
            "message": message,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }, room=room_id)


@sio.event
async def webrtc_offer(sid: str, data: Dict[str, Any]) -> None:
    """WebRTC offer for video chat"""
    user = user_sessions.get(sid)
    if not user or not user.get("room_id"):
        return
    
    # Forward offer to other player
    target_sid = data.get("target_sid")
    if target_sid:
        await sio.emit('webrtc_offer', {
            "from_sid": sid,
            "offer": data.get("offer")
        }, room=target_sid)


@sio.event
async def webrtc_answer(sid: str, data: Dict[str, Any]) -> None:
    """WebRTC answer for video chat"""
    user = user_sessions.get(sid)
    if not user:
        return
    
    # Forward answer to other player
    target_sid = data.get("target_sid")
    if target_sid:
        await sio.emit('webrtc_answer', {
            "from_sid": sid,
            "answer": data.get("answer")
        }, room=target_sid)


@sio.event
async def webrtc_ice_candidate(sid: str, data: Dict[str, Any]) -> None:
    """WebRTC ICE candidate exchange"""
    user = user_sessions.get(sid)
    if not user:
        return
    
    # Forward ICE candidate to other player
    target_sid = data.get("target_sid")
    if target_sid:
        await sio.emit('webrtc_ice_candidate', {
            "from_sid": sid,
            "candidate": data.get("candidate")
        }, room=target_sid)


# ==================== HELPER FUNCTIONS ====================

async def try_match_players(queue_key: str, game_type: str, difficulty: str) -> None:
    """Try to match players from queue"""
    queue = matchmaking_queue[queue_key]
    
    # Determine required players based on game type
    required_players = 2  # Default
    if game_type in ["hearts"]:
        required_players = 4
    elif game_type in ["uno", "crazy_eights", "go_fish"]:
        required_players = 2  # Can be 2-4, start with 2
    
    # Check if we have enough players
    if len(queue) >= required_players:
        # Take first N players
        matched_players = queue[:required_players]
        
        # Remove them from queue
        for player_sid in matched_players:
            queue.remove(player_sid)
        
        # Create game room
        await create_game_room(matched_players, game_type, difficulty)


async def create_game_room(player_sids: List[str], game_type: str, difficulty: str) -> Optional[str]:
    """Create a new game room"""
    room_id = f"room_{uuid.uuid4().hex[:12]}"
    
    # Initialize game room
    game_rooms[room_id] = {
        "room_id": room_id,
        "game_type": game_type,
        "difficulty": difficulty,
        "players": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "active",
        "game_state": {}
    }
    
    # Add players to room
    players_info = []
    for i, sid in enumerate(player_sids):
        user = user_sessions.get(sid)
        if user:
            user["room_id"] = room_id
            await sio.enter_room(sid, room_id)
            
            player_info = {
                "sid": sid,
                "user_id": user.get("user_id"),
                "user_name": user.get("user_name", f"Player {i+1}"),
                "player_number": i + 1
            }
            game_rooms[room_id]["players"].append(player_info)
            players_info.append(player_info)
    
    # Notify all players
    await sio.emit('match_found', {
        "room_id": room_id,
        "game_type": game_type,
        "difficulty": difficulty,
        "players": players_info
    }, room=room_id)
    
    print(f"🎮 Game room created: {room_id} for {game_type} with {len(player_sids)} players")


async def leave_game_room(sid: str, room_id: str) -> None:
    """Player leaves game room"""
    room = game_rooms.get(room_id)
    if not room:
        return
    
    # Remove player from room
    room["players"] = [p for p in room["players"] if p["sid"] != sid]
    
    await sio.leave_room(sid, room_id)
    
    # Notify other players
    user = user_sessions.get(sid)
    await sio.emit('player_left', {
        "player_sid": sid,
        "player_name": user.get("user_name", "Player") if user else "Player"
    }, room=room_id)
    
    # If room is empty, delete it
    if len(room["players"]) == 0:
        del game_rooms[room_id]
        print(f"🗑️ Game room deleted: {room_id}")


# ==================== ASGI APP WRAPPER ====================

socket_app = socketio.ASGIApp(
    sio,
    other_asgi_app=None,
    socketio_path='socket.io'
)


def get_multiplayer_stats() -> Dict[str, Any]:
    """Get current multiplayer statistics"""
    return {
        "active_rooms": len(game_rooms),
        "connected_players": len(user_sessions),
        "matchmaking_queues": {k: len(v) for k, v in matchmaking_queue.items()}
    }

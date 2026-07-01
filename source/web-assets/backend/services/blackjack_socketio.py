"""
Real-Time Blackjack WebSocket Events
Enables live multiplayer and spectating for Blackjack games
"""
from __future__ import annotations

import asyncio
from typing import Any, Dict, Set

from services.multiplayer import sio

# Active Blackjack game rooms
blackjack_rooms: Dict[str, Dict[str, Any]] = {}  # room_id -> game state
blackjack_players: Dict[str, str] = {}  # session_id -> room_id
blackjack_spectators: Dict[str, Set[str]] = {}  # room_id -> set of spectator session_ids

@sio.event
async def join_blackjack_room(sid: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Join a Blackjack game room as player or spectator
    data: {
        "room_id": str,
        "session_id": str,
        "user_id": str,
        "username": str,
        "mode": "player" or "spectator"
    }
    """
    try:
        room_id = data.get('room_id')
        session_id = data.get('session_id')
        username = data.get('username', 'Player')
        mode = data.get('mode', 'player')
        
        # Create room if doesn't exist
        if room_id not in blackjack_rooms:
            blackjack_rooms[room_id] = {
                'players': {},
                'game_state': None,
                'created_at': asyncio.get_event_loop().time()
            }
            blackjack_spectators[room_id] = set()
        
        # Join as player or spectator
        if mode == 'player':
            blackjack_rooms[room_id]['players'][session_id] = {
                'username': username,
                'sid': sid,
                'connected': True
            }
            blackjack_players[session_id] = room_id
        else:
            blackjack_spectators[room_id].add(sid)
        
        # Join Socket.IO room
        await sio.enter_room(sid, room_id)
        
        # Notify others
        await sio.emit('player_joined', {
            'username': username,
            'mode': mode,
            'player_count': len(blackjack_rooms[room_id]['players']),
            'spectator_count': len(blackjack_spectators[room_id])
        }, room=room_id, skip_sid=sid)
        
        # Send current game state to new joiner
        current_state = blackjack_rooms[room_id].get('game_state')
        if current_state:
            await sio.emit('game_state_sync', current_state, to=sid)
        
        return {'status': 'joined', 'room_id': room_id}
        
    except Exception as e:
        print(f"Error joining Blackjack room: {e}")
        return {'status': 'error', 'message': str(e)}

@sio.event
async def leave_blackjack_room(sid: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Leave a Blackjack game room"""
    try:
        session_id = data.get('session_id')
        room_id = blackjack_players.get(session_id)
        
        if not room_id:
            # Check if spectator
            for rid, spectators in blackjack_spectators.items():
                if sid in spectators:
                    room_id = rid
                    spectators.remove(sid)
                    break
        
        if room_id and room_id in blackjack_rooms:
            # Remove player
            if session_id in blackjack_rooms[room_id]['players']:
                username = blackjack_rooms[room_id]['players'][session_id]['username']
                del blackjack_rooms[room_id]['players'][session_id]
                del blackjack_players[session_id]
                
                # Notify others
                await sio.emit('player_left', {
                    'username': username,
                    'player_count': len(blackjack_rooms[room_id]['players'])
                }, room=room_id)
            
            # Leave Socket.IO room
            await sio.leave_room(sid, room_id)
            
            # Clean up empty rooms
            if not blackjack_rooms[room_id]['players'] and not blackjack_spectators[room_id]:
                del blackjack_rooms[room_id]
                del blackjack_spectators[room_id]
        
        return {'status': 'left'}
        
    except Exception as e:
        print(f"Error leaving Blackjack room: {e}")
        return {'status': 'error', 'message': str(e)}

@sio.event
async def blackjack_action(sid: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Broadcast a Blackjack action to all players/spectators
    data: {
        "room_id": str,
        "session_id": str,
        "action": str (hit, stand, double, split),
        "hand_index": int,
        "game_state": dict
    }
    """
    try:
        room_id = data.get('room_id')
        action = data.get('action')
        game_state = data.get('game_state')
        
        if room_id in blackjack_rooms:
            # Update stored game state
            blackjack_rooms[room_id]['game_state'] = game_state
            
            # Broadcast to all in room
            await sio.emit('blackjack_action_update', {
                'action': action,
                'game_state': game_state,
                'timestamp': asyncio.get_event_loop().time()
            }, room=room_id)
        
        return {'status': 'broadcast'}
        
    except Exception as e:
        print(f"Error broadcasting Blackjack action: {e}")
        return {'status': 'error', 'message': str(e)}

@sio.event
async def blackjack_game_update(sid: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Broadcast game state update (deal, result, etc.)
    data: {
        "room_id": str,
        "event_type": str (deal, result, new_round),
        "game_state": dict
    }
    """
    try:
        room_id = data.get('room_id')
        event_type = data.get('event_type')
        game_state = data.get('game_state')
        
        if room_id in blackjack_rooms:
            blackjack_rooms[room_id]['game_state'] = game_state
            
            # Broadcast update
            await sio.emit('blackjack_game_update', {
                'event_type': event_type,
                'game_state': game_state,
                'timestamp': asyncio.get_event_loop().time()
            }, room=room_id)
        
        return {'status': 'updated'}
        
    except Exception as e:
        print(f"Error updating Blackjack game: {e}")
        return {'status': 'error', 'message': str(e)}

@sio.event
async def get_blackjack_rooms(sid: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Get list of active Blackjack rooms"""
    try:
        rooms_list = []
        for room_id, room_data in blackjack_rooms.items():
            rooms_list.append({
                'room_id': room_id,
                'player_count': len(room_data['players']),
                'spectator_count': len(blackjack_spectators.get(room_id, set())),
                'has_game': room_data['game_state'] is not None
            })
        
        return {'status': 'success', 'rooms': rooms_list}
        
    except Exception as e:
        print(f"Error getting Blackjack rooms: {e}")
        return {'status': 'error', 'message': str(e)}

# Socket.IO connection events
@sio.event
async def connect(sid: str, environ: Dict[str, Any]) -> None:
    """Handle new Socket.IO connection"""
    print(f"🔌 Socket.IO client connected: {sid}")

@sio.event
async def disconnect(sid: str) -> None:
    """Handle Socket.IO disconnection"""
    print(f"🔌 Socket.IO client disconnected: {sid}")
    
    # Clean up Blackjack rooms
    for session_id, room_id in list(blackjack_players.items()):
        if room_id in blackjack_rooms:
            player_data = blackjack_rooms[room_id]['players'].get(session_id)
            if player_data and player_data['sid'] == sid:
                await leave_blackjack_room(sid, {'session_id': session_id})

print("✅ Blackjack WebSocket events loaded")

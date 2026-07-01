"""
Social Socket.IO Events
Real-time events for social interactions (matches, vibes, presence)
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict

from websocket_server import sio

logger = logging.getLogger(__name__)

# Active users and their presence
active_users: Dict[str, Dict[str, Any]] = {}  # {user_id: {sid: str, status: str, last_seen: str}}
user_to_sid: Dict[str, str] = {}  # {sid: user_id}

# ==================== PRESENCE ====================

@sio.event
async def social_connect(sid: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """User connects to social features"""
    try:
        user_id = data.get('user_id')
        username = data.get('username', 'User')
        
        if not user_id:
            return {'success': False, 'error': 'user_id required'}
        
        # Track user
        active_users[user_id] = {
            'sid': sid,
            'username': username,
            'status': 'online',
            'last_seen': datetime.now(timezone.utc).isoformat()
        }
        user_to_sid[sid] = user_id
        
        # Join user's personal room for direct notifications
        await sio.enter_room(sid, f"user_{user_id}")
        
        logger.info(f"👤 {username} connected to social features")
        
        # Broadcast presence to all connected users
        await sio.emit('user_online', {
            'user_id': user_id,
            'username': username,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }, skip_sid=sid)
        
        return {
            'success': True,
            'online_users': len(active_users)
        }
        
    except Exception as e:
        logger.error(f"Error in social_connect: {str(e)}")
        return {'success': False, 'error': str(e)}


@sio.event
async def social_disconnect(sid, data):
    """User disconnects from social features"""
    try:
        if sid not in user_to_sid:
            return {'success': False}
        
        user_id = user_to_sid[sid]
        
        # Update status
        if user_id in active_users:
            active_users[user_id]['status'] = 'offline'
            active_users[user_id]['last_seen'] = datetime.now(timezone.utc).isoformat()
            
            # Remove after 5 minutes of inactivity (optional)
            # For now, keep for presence history
        
        # Remove sid mapping
        del user_to_sid[sid]
        
        # Leave room
        await sio.leave_room(sid, f"user_{user_id}")
        
        # Broadcast offline status
        await sio.emit('user_offline', {
            'user_id': user_id,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
        
        logger.info(f"👤 User {user_id} disconnected from social")
        
        return {'success': True}
        
    except Exception as e:
        logger.error(f"Error in social_disconnect: {str(e)}")
        return {'success': False, 'error': str(e)}


# ==================== REAL-TIME MATCH NOTIFICATIONS ====================

@sio.event
async def notify_match(sid: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Notify users when they match"""
    try:
        user1_id = data.get('user1_id')
        user2_id = data.get('user2_id')
        match_data = data.get('match_data', {})
        
        # Send notification to both users
        await sio.emit('new_match', {
            'match_id': match_data.get('match_id'),
            'matched_user_id': user2_id,
            'compatibility': match_data.get('compatibility'),
            'timestamp': datetime.now(timezone.utc).isoformat()
        }, room=f"user_{user1_id}")
        
        await sio.emit('new_match', {
            'match_id': match_data.get('match_id'),
            'matched_user_id': user1_id,
            'compatibility': match_data.get('compatibility'),
            'timestamp': datetime.now(timezone.utc).isoformat()
        }, room=f"user_{user2_id}")
        
        logger.info(f"💕 Match notification sent: {user1_id} ↔ {user2_id}")
        
        return {'success': True}
        
    except Exception as e:
        logger.error(f"Error in notify_match: {str(e)}")
        return {'success': False, 'error': str(e)}


@sio.event
async def notify_vibe_received(sid: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Notify user when they receive a vibe"""
    try:
        to_user_id = data.get('to_user_id')
        from_user_id = data.get('from_user_id')
        vibe_type = data.get('vibe_type', 'drink')
        message = data.get('message')
        
        # Send notification to recipient
        await sio.emit('vibe_received', {
            'from_user_id': from_user_id,
            'vibe_type': vibe_type,
            'message': message,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }, room=f"user_{to_user_id}")
        
        logger.info(f"✨ Vibe notification sent: {from_user_id} → {to_user_id}")
        
        return {'success': True}
        
    except Exception as e:
        logger.error(f"Error in notify_vibe_received: {str(e)}")
        return {'success': False, 'error': str(e)}


@sio.event
async def notify_swipe(sid: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Notify user when someone swipes right on them (optional feature)"""
    try:
        to_user_id = data.get('to_user_id')
        # Note: data also carries `from_user_id` but we intentionally
        # don't surface who liked them (no spoiler) — only the fact
        # that *someone* did.

        # Send subtle notification (no spoiler)
        await sio.emit('someone_liked_you', {
            'timestamp': datetime.now(timezone.utc).isoformat()
        }, room=f"user_{to_user_id}")
        
        logger.info(f"💝 Like notification sent to {to_user_id}")
        
        return {'success': True}
        
    except Exception as e:
        logger.error(f"Error in notify_swipe: {str(e)}")
        return {'success': False, 'error': str(e)}


# ==================== NEARBY PLAYERS (IN-GAME SOCIAL) ====================

@sio.event
async def join_game_room(sid: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """User joins a game room for in-game social features"""
    try:
        user_id = data.get('user_id')
        game_id = data.get('game_id')  # e.g., 'blackjack', 'poker'
        table_id = data.get('table_id')  # e.g., 'table_vip_1'
        
        if not game_id:
            return {'success': False, 'error': 'game_id required'}
        
        # Join game/table room
        room_name = f"game_{game_id}_{table_id}" if table_id else f"game_{game_id}"
        await sio.enter_room(sid, room_name)
        
        # Notify others in the room
        await sio.emit('player_joined_game', {
            'user_id': user_id,
            'game_id': game_id,
            'table_id': table_id,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }, room=room_name, skip_sid=sid)
        
        logger.info(f"🎮 User {user_id} joined game room {room_name}")
        
        return {'success': True, 'room': room_name}
        
    except Exception as e:
        logger.error(f"Error in join_game_room: {str(e)}")
        return {'success': False, 'error': str(e)}


@sio.event
async def leave_game_room(sid, data):
    """User leaves a game room"""
    try:
        user_id = data.get('user_id')
        game_id = data.get('game_id')
        table_id = data.get('table_id')
        
        room_name = f"game_{game_id}_{table_id}" if table_id else f"game_{game_id}"
        await sio.leave_room(sid, room_name)
        
        # Notify others
        await sio.emit('player_left_game', {
            'user_id': user_id,
            'game_id': game_id,
            'table_id': table_id,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }, room=room_name)
        
        logger.info(f"🎮 User {user_id} left game room {room_name}")
        
        return {'success': True}
        
    except Exception as e:
        logger.error(f"Error in leave_game_room: {str(e)}")
        return {'success': False, 'error': str(e)}


# ==================== CLEANUP ====================

@sio.event
async def disconnect(sid: str) -> None:
    """Handle general disconnect"""
    try:
        # Clean up social presence
        if sid in user_to_sid:
            await social_disconnect(sid, {})
            
    except Exception as e:
        logger.error(f"Error in disconnect handler: {str(e)}")


logger.info("✅ Social Socket.IO events loaded")

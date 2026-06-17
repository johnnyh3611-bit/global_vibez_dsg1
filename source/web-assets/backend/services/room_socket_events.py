"""
Universal Room Socket.IO Events
Works for ALL multiplayer card games (Bid Whist, Spades, Hearts, etc.)
Includes direct invite system (no manual room codes)
"""
from services.room_manager import (
    create_room,
    send_invite,
    accept_invite,
    reject_invite,
    get_pending_invites,
    join_room,
    join_as_spectator,
    set_player_ready,
    kick_player,
    leave_room,
    start_game,
    update_room_settings,
    get_room,
    get_public_rooms,
    add_chat_message,
    cleanup_disconnected_player,
    GameType
)


def register_room_events(sio):
    """Register all universal room Socket.IO events"""
    
    @sio.event
    async def create_game_room(sid, data):
        """Create a new game room"""
        try:
            player_name = data.get('player_name', 'Player')
            user_id = data.get('user_id')
            game_type = data.get('game_type', GameType.BID_WHIST)
            is_public = data.get('is_public', True)
            wager = data.get('wager', 0)
            winning_score = data.get('winning_score', 7)
            max_players = data.get('max_players', 4)
            custom_rules = data.get('custom_rules', {})
            
            if not user_id:
                await sio.emit('room_error', {
                    'message': 'User ID required'
                }, room=sid)
                return
            
            # Create room
            room = create_room(
                host_session_id=sid,
                host_user_id=user_id,
                host_name=player_name,
                game_type=game_type,
                max_players=max_players,
                is_public=is_public,
                wager=wager,
                winning_score=winning_score,
                custom_rules=custom_rules
            )
            
            # Join Socket.IO room
            await sio.enter_room(sid, room['room_code'])
            
            # Emit success
            await sio.emit('room_created', {
                'room_code': room['room_code'],
                'room': _sanitize_room_for_client(room, sid)
            }, room=sid)
            
            print(f"🎮 Room created: {room['room_code']} by {player_name} ({game_type})")
            
        except Exception as e:
            print(f"Error creating room: {e}")
            await sio.emit('room_error', {
                'message': f'Failed to create room: {str(e)}'
            }, room=sid)
    
    
    @sio.event
    async def send_game_invite(sid, data):
        """Send invite to a specific player"""
        try:
            room_code = data.get('room_code')
            invited_user_id = data.get('invited_user_id')
            invited_user_name = data.get('invited_user_name')
            
            if not room_code or not invited_user_id:
                await sio.emit('room_error', {
                    'message': 'Room code and user ID required'
                }, room=sid)
                return
            
            # Send invite
            result = send_invite(room_code, sid, invited_user_id, invited_user_name)
            
            if result and 'error' in result:
                await sio.emit('room_error', {
                    'message': result['error']
                }, room=sid)
                return
            
            # Emit to sender
            await sio.emit('invite_sent', {
                'invite': result
            }, room=sid)
            
            # Find invited player's session and notify them
            # (In production, you'd query active sessions from Redis/database)
            await sio.emit('game_invite_received', {
                'invite': result
            }, room=invited_user_id)  # Emit to user's room/session
            
            print(f"📧 Invite sent: {invited_user_id} to room {room_code}")
            
        except Exception as e:
            print(f"Error sending invite: {e}")
            await sio.emit('room_error', {
                'message': f'Failed to send invite: {str(e)}'
            }, room=sid)
    
    
    @sio.event
    async def accept_game_invite(sid, data):
        """Accept a game invite"""
        try:
            invite_id = data.get('invite_id')
            user_id = data.get('user_id')
            player_name = data.get('player_name', 'Player')
            
            if not invite_id or not user_id:
                await sio.emit('room_error', {
                    'message': 'Invite ID and user ID required'
                }, room=sid)
                return
            
            # Accept invite
            result = accept_invite(invite_id, sid, user_id, player_name)
            
            if result and 'error' in result:
                await sio.emit('room_error', {
                    'message': result['error']
                }, room=sid)
                return
            
            room_code = result['room_code']
            
            # Join Socket.IO room
            await sio.enter_room(sid, room_code)
            
            # Broadcast player joined
            await sio.emit('player_joined', {
                'player_name': player_name,
                'room': _sanitize_room_for_client(result, sid)
            }, room=room_code)
            
            print(f"✅ {player_name} accepted invite and joined room: {room_code}")
            
        except Exception as e:
            print(f"Error accepting invite: {e}")
            await sio.emit('room_error', {
                'message': f'Failed to accept invite: {str(e)}'
            }, room=sid)
    
    
    @sio.event
    async def reject_game_invite(sid, data):
        """Reject a game invite"""
        try:
            invite_id = data.get('invite_id')
            user_id = data.get('user_id')
            
            if not invite_id or not user_id:
                return
            
            # Reject invite
            reject_invite(invite_id, user_id)
            
            await sio.emit('invite_rejected', {
                'invite_id': invite_id
            }, room=sid)
            
        except Exception as e:
            print(f"Error rejecting invite: {e}")
    
    
    @sio.event
    async def get_my_invites(sid, data):
        """Get pending invites for current user"""
        try:
            user_id = data.get('user_id')
            
            if not user_id:
                return
            
            invites = get_pending_invites(user_id)
            
            await sio.emit('pending_invites', {
                'invites': invites
            }, room=sid)
            
        except Exception as e:
            print(f"Error getting invites: {e}")
    
    
    @sio.event
    async def join_game_room(sid, data):
        """Join an existing game room"""
        try:
            room_code = data.get('room_code')
            player_name = data.get('player_name', 'Player')
            
            if not room_code:
                await sio.emit('room_error', {
                    'message': 'Room code required'
                }, room=sid)
                return
            
            # Join room
            result = join_room(room_code, sid, player_name)
            
            if result and 'error' in result:
                await sio.emit('room_error', {
                    'message': result['error']
                }, room=sid)
                return
            
            # Join Socket.IO room
            await sio.enter_room(sid, room_code)
            
            # Broadcast player joined to all players in room
            await sio.emit('player_joined', {
                'player_name': player_name,
                'room': _sanitize_room_for_client(result, sid)
            }, room=room_code)
            
            print(f"🎮 {player_name} joined room: {room_code}")
            
        except Exception as e:
            print(f"Error joining room: {e}")
            await sio.emit('room_error', {
                'message': f'Failed to join room: {str(e)}'
            }, room=sid)
    
    
    @sio.event
    async def join_as_spectator_event(sid, data):
        """Join a room as spectator"""
        try:
            room_code = data.get('room_code')
            spectator_name = data.get('spectator_name', 'Spectator')
            
            result = join_as_spectator(room_code, sid, spectator_name)
            
            if result and 'error' in result:
                await sio.emit('room_error', {
                    'message': result['error']
                }, room=sid)
                return
            
            await sio.enter_room(sid, room_code)
            
            await sio.emit('spectator_joined', {
                'spectator_name': spectator_name,
                'room': _sanitize_room_for_client(result, sid)
            }, room=room_code)
            
        except Exception as e:
            await sio.emit('room_error', {
                'message': f'Failed to join as spectator: {str(e)}'
            }, room=sid)
    
    
    @sio.event
    async def player_ready(sid, data):
        """Mark player as ready"""
        try:
            room_code = data.get('room_code')
            is_ready = data.get('is_ready', True)
            
            result = set_player_ready(room_code, sid, is_ready)
            
            if not result:
                await sio.emit('room_error', {
                    'message': 'Failed to set ready status'
                }, room=sid)
                return
            
            # Broadcast ready status
            await sio.emit('player_ready_changed', {
                'session_id': sid,
                'is_ready': is_ready,
                'room': _sanitize_room_for_client(result, sid)
            }, room=room_code)
            
        except Exception as e:
            await sio.emit('room_error', {
                'message': f'Failed to set ready: {str(e)}'
            }, room=sid)
    
    
    @sio.event
    async def kick_player_event(sid, data):
        """Kick a player (host only)"""
        try:
            room_code = data.get('room_code')
            player_session_id = data.get('player_session_id')
            
            result = kick_player(room_code, sid, player_session_id)
            
            if result and 'error' in result:
                await sio.emit('room_error', {
                    'message': result['error']
                }, room=sid)
                return
            
            # Notify kicked player
            await sio.emit('kicked_from_room', {
                'message': 'You were kicked from the room'
            }, room=player_session_id)
            
            # Broadcast to room
            await sio.emit('player_kicked', {
                'session_id': player_session_id,
                'room': _sanitize_room_for_client(result, sid)
            }, room=room_code)
            
            # Remove from Socket.IO room
            await sio.leave_room(player_session_id, room_code)
            
        except Exception as e:
            await sio.emit('room_error', {
                'message': f'Failed to kick player: {str(e)}'
            }, room=sid)
    
    
    @sio.event
    async def leave_game_room(sid, data):
        """Leave a room"""
        try:
            room_code = data.get('room_code')
            
            result = leave_room(room_code, sid)
            
            # Notify room if it still exists
            if result:
                await sio.emit('player_left', {
                    'session_id': sid,
                    'room': _sanitize_room_for_client(result, sid)
                }, room=room_code)
            
            # Leave Socket.IO room
            await sio.leave_room(sid, room_code)
            
        except Exception as e:
            print(f"Error leaving room: {e}")
    
    
    @sio.event
    async def start_game_event(sid, data):
        """Start the game (host only)"""
        try:
            room_code = data.get('room_code')
            
            result = start_game(room_code, sid)
            
            if result and 'error' in result:
                await sio.emit('room_error', {
                    'message': result['error']
                }, room=sid)
                return
            
            # Broadcast game start
            await sio.emit('game_started', {
                'room': _sanitize_room_for_client(result, sid),
                'game_type': result['game_type']
            }, room=room_code)
            
            print(f"🎮 Game started in room: {room_code}")
            
        except Exception as e:
            await sio.emit('room_error', {
                'message': f'Failed to start game: {str(e)}'
            }, room=sid)
    
    
    @sio.event
    async def update_room_settings_event(sid, data):
        """Update room settings (host only)"""
        try:
            room_code = data.get('room_code')
            settings = data.get('settings', {})
            
            result = update_room_settings(room_code, sid, settings)
            
            if result and 'error' in result:
                await sio.emit('room_error', {
                    'message': result['error']
                }, room=sid)
                return
            
            # Broadcast settings update
            await sio.emit('room_settings_updated', {
                'settings': result['settings'],
                'room': _sanitize_room_for_client(result, sid)
            }, room=room_code)
            
        except Exception as e:
            await sio.emit('room_error', {
                'message': f'Failed to update settings: {str(e)}'
            }, room=sid)
    
    
    @sio.event
    async def get_public_rooms_event(sid, data):
        """Get list of public rooms"""
        try:
            game_type = data.get('game_type', None)
            
            rooms = get_public_rooms(game_type)
            
            await sio.emit('public_rooms_list', {
                'rooms': rooms
            }, room=sid)
            
        except Exception as e:
            await sio.emit('room_error', {
                'message': f'Failed to get rooms: {str(e)}'
            }, room=sid)
    
    
    @sio.event
    async def send_chat_message(sid, data):
        """Send chat message in room"""
        try:
            room_code = data.get('room_code')
            message = data.get('message', '')
            
            if not message.strip():
                return
            
            chat_msg = add_chat_message(room_code, sid, message)
            
            if chat_msg:
                await sio.emit('chat_message_received', chat_msg, room=room_code)
            
        except Exception as e:
            print(f"Error sending chat: {e}")
    
    
    @sio.event
    async def disconnect(sid):
        """Handle player disconnect"""
        try:
            room_code = cleanup_disconnected_player(sid)
            
            if room_code:
                room = get_room(room_code)
                if room:
                    await sio.emit('player_disconnected', {
                        'session_id': sid,
                        'room': _sanitize_room_for_client(room, sid)
                    }, room=room_code)
            
        except Exception as e:
            print(f"Error handling disconnect: {e}")


def _sanitize_room_for_client(room: dict, requesting_sid: str) -> dict:
    """Remove sensitive data and prepare room for client"""
    if not room:
        return None
    
    return {
        'room_code': room['room_code'],
        'game_type': room['game_type'],
        'state': room['state'],
        'is_public': room['is_public'],
        'max_players': room['max_players'],
        'settings': room['settings'],
        'host_id': room['host_id'],
        'players': room['players'],
        'spectators': room['spectators'],
        'player_order': room['player_order'],
        'created_at': room['created_at']
    }


print("✅ Universal Room Socket.IO events loaded")

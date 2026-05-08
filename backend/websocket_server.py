"""
WebSocket Server for Real-Time Multiplayer Games
Handles game rooms, player connections, and real-time state synchronization
"""

import socketio
from typing import Dict
import logging
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os

logger = logging.getLogger(__name__)

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL")
client = AsyncIOMotorClient(MONGO_URL)
db = client[os.environ.get("DB_NAME")]  # No fallback - let it fail if not set

# Socket.IO server with CORS
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=True,
    engineio_logger=True
)

# Room management
active_rooms: Dict[str, Dict] = {}  # room_code -> {players, game_state, etc}
player_to_room: Dict[str, str] = {}  # sid -> room_code

# ==================== CONNECTION HANDLERS ====================

@sio.event
async def connect(sid, environ):
    """Client connected"""
    logger.info(f"🔌 Client connected: {sid}")
    await sio.emit('connection_established', {'sid': sid}, to=sid)

@sio.event
async def disconnect(sid):
    """Client disconnected - clean up room if needed"""
    logger.info(f"🔌 Client disconnected: {sid}")
    
    # Remove from room if in one
    if sid in player_to_room:
        room_code = player_to_room[sid]
        await handle_player_leave(sid, room_code)

# ==================== ROOM MANAGEMENT ====================

@sio.event
async def create_room(sid, data):
    """
    Create a new game room
    data: {game_type, max_players, is_private, user_id, username}
    """
    try:
        game_type = data.get('game_type')
        max_players = data.get('max_players', 2)
        is_private = data.get('is_private', False)
        user_id = data.get('user_id')
        username = data.get('username', 'Player')
        
        # Generate room code
        import secrets
        room_code = f"{game_type[:3].upper()}_{secrets.token_hex(3).upper()}"
        
        # Create room
        room = {
            'room_code': room_code,
            'game_type': game_type,
            'host_sid': sid,
            'host_user_id': user_id,
            'max_players': max_players,
            'is_private': is_private,
            'players': [{
                'sid': sid,
                'user_id': user_id,
                'username': username,
                'ready': False,
                'connected': True
            }],
            'game_state': {
                'status': 'waiting',  # waiting, playing, finished
                'current_turn': 0,
                'started_at': None
            },
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        
        # Store in memory and DB
        active_rooms[room_code] = room
        player_to_room[sid] = room_code
        
        # Save to MongoDB
        await db.multiplayer_rooms.insert_one({
            **room,
            'players': [{'user_id': p['user_id'], 'username': p['username']} for p in room['players']]
        })
        
        # Join socket.io room
        await sio.enter_room(sid, room_code)
        
        logger.info(f"🎮 Room created: {room_code} by {username}")
        
        await sio.emit('room_created', {
            'room_code': room_code,
            'room': room
        }, to=sid)
        
        return {'success': True, 'room_code': room_code, 'room': room}
        
    except Exception as e:
        logger.error(f"❌ Error creating room: {e}")
        await sio.emit('error', {'message': str(e)}, to=sid)
        return {'success': False, 'error': str(e)}

@sio.event
async def join_room(sid, data):
    """
    Join an existing room
    data: {room_code, user_id, username}
    """
    try:
        room_code = data.get('room_code')
        user_id = data.get('user_id')
        username = data.get('username', 'Player')
        
        # Check if room exists
        if room_code not in active_rooms:
            # Try to load from DB
            room_doc = await db.multiplayer_rooms.find_one({'room_code': room_code}, {'_id': 0})
            if not room_doc:
                raise Exception(f"Room {room_code} not found")
            
            # Restore to active rooms
            active_rooms[room_code] = room_doc
        
        room = active_rooms[room_code]
        
        # Check if room is full
        if len(room['players']) >= room['max_players']:
            raise Exception("Room is full")
        
        # Check if game already started
        if room['game_state']['status'] == 'playing':
            raise Exception("Game already in progress")
        
        # Add player
        player = {
            'sid': sid,
            'user_id': user_id,
            'username': username,
            'ready': False,
            'connected': True
        }
        
        room['players'].append(player)
        player_to_room[sid] = room_code
        
        # Join socket.io room
        await sio.enter_room(sid, room_code)
        
        # Update DB
        await db.multiplayer_rooms.update_one(
            {'room_code': room_code},
            {'$push': {'players': {'user_id': user_id, 'username': username}}}
        )
        
        logger.info(f"🎮 {username} joined room: {room_code}")
        
        # Notify all players
        await sio.emit('player_joined', {
            'player': {'user_id': user_id, 'username': username},
            'room': room
        }, room=room_code)
        
        # Send room info to new player
        await sio.emit('room_joined', {
            'room_code': room_code,
            'room': room
        }, to=sid)
        
        return {'success': True, 'room': room}
        
    except Exception as e:
        logger.error(f"❌ Error joining room: {e}")
        await sio.emit('error', {'message': str(e)}, to=sid)
        return {'success': False, 'error': str(e)}

@sio.event
async def leave_room(sid, data):
    """Leave current room"""
    try:
        if sid not in player_to_room:
            return {'success': False, 'error': 'Not in a room'}
        
        room_code = player_to_room[sid]
        await handle_player_leave(sid, room_code)
        
        await sio.emit('left_room', {'room_code': room_code}, to=sid)
        return {'success': True}
        
    except Exception as e:
        logger.error(f"❌ Error leaving room: {e}")
        return {'success': False, 'error': str(e)}

async def handle_player_leave(sid, room_code):
    """Handle player leaving room"""
    if room_code not in active_rooms:
        return
    
    room = active_rooms[room_code]
    
    # Find and remove player
    player = next((p for p in room['players'] if p['sid'] == sid), None)
    if player:
        room['players'] = [p for p in room['players'] if p['sid'] != sid]
        
        # Leave socket.io room
        await sio.leave_room(sid, room_code)
        del player_to_room[sid]
        
        logger.info(f"👋 {player['username']} left room: {room_code}")
        
        # Notify remaining players
        await sio.emit('player_left', {
            'player': {'user_id': player['user_id'], 'username': player['username']},
            'room': room
        }, room=room_code)
        
        # If no players left or host left, delete room
        if len(room['players']) == 0 or sid == room['host_sid']:
            logger.info(f"🗑️ Deleting room: {room_code}")
            del active_rooms[room_code]
            await db.multiplayer_rooms.delete_one({'room_code': room_code})
            await sio.emit('room_closed', {'room_code': room_code}, room=room_code)

# ==================== GAME ACTIONS ====================

@sio.event
async def player_ready(sid, data):
    """Mark player as ready"""
    try:
        if sid not in player_to_room:
            return {'success': False, 'error': 'Not in a room'}
        
        room_code = player_to_room[sid]
        room = active_rooms[room_code]
        
        # Update player ready status
        for player in room['players']:
            if player['sid'] == sid:
                player['ready'] = True
                break
        
        # Notify all players
        await sio.emit('player_ready', {
            'sid': sid,
            'room': room
        }, room=room_code)
        
        # Check if all players ready
        all_ready = all(p['ready'] for p in room['players'])
        min_players = 2
        
        if all_ready and len(room['players']) >= min_players:
            await start_game(room_code)
        
        return {'success': True}
        
    except Exception as e:
        logger.error(f"❌ Error marking ready: {e}")
        return {'success': False, 'error': str(e)}

async def start_game(room_code):
    """Start the game"""
    room = active_rooms[room_code]
    
    room['game_state']['status'] = 'playing'
    room['game_state']['started_at'] = datetime.now(timezone.utc).isoformat()
    room['game_state']['current_turn'] = 0
    
    logger.info(f"🎮 Game started in room: {room_code}")
    
    # Notify all players
    await sio.emit('game_started', {
        'room_code': room_code,
        'game_state': room['game_state']
    }, room=room_code)

@sio.event
async def make_move(sid, data):
    """
    Player makes a move
    data: {move_type, move_data}
    """
    try:
        if sid not in player_to_room:
            return {'success': False, 'error': 'Not in a room'}
        
        room_code = player_to_room[sid]
        room = active_rooms[room_code]
        
        if room['game_state']['status'] != 'playing':
            return {'success': False, 'error': 'Game not started'}
        
        # Find player index
        player_index = next((i for i, p in enumerate(room['players']) if p['sid'] == sid), None)
        
        # Broadcast move to all players
        await sio.emit('move_made', {
            'player_index': player_index,
            'move_type': data.get('move_type'),
            'move_data': data.get('move_data'),
            'timestamp': datetime.now(timezone.utc).isoformat()
        }, room=room_code)
        
        return {'success': True}
        
    except Exception as e:
        logger.error(f"❌ Error making move: {e}")
        return {'success': False, 'error': str(e)}

@sio.event
async def send_chat_message(sid, data):
    """Send chat message in room"""
    try:
        if sid not in player_to_room:
            return {'success': False}
        
        room_code = player_to_room[sid]
        room = active_rooms[room_code]
        
        # Find player
        player = next((p for p in room['players'] if p['sid'] == sid), None)
        
        if player:
            await sio.emit('chat_message', {
                'username': player['username'],
                'message': data.get('message'),
                'timestamp': datetime.now(timezone.utc).isoformat()
            }, room=room_code)
        
        return {'success': True}
        
    except Exception as e:
        logger.error(f"❌ Error sending chat: {e}")
        return {'success': False}

# ==================== ROOM LISTING ====================

@sio.event
async def get_public_rooms(sid, data):
    """Get list of public rooms"""
    try:
        game_type = data.get('game_type')
        
        # Filter public rooms
        public_rooms = [
            {
                'room_code': code,
                'game_type': room['game_type'],
                'players_count': len(room['players']),
                'max_players': room['max_players'],
                'status': room['game_state']['status']
            }
            for code, room in active_rooms.items()
            if not room['is_private'] 
            and room['game_state']['status'] == 'waiting'
            and (not game_type or room['game_type'] == game_type)
        ]
        
        await sio.emit('public_rooms_list', {'rooms': public_rooms}, to=sid)
        return {'success': True, 'rooms': public_rooms}
        
    except Exception as e:
        logger.error(f"❌ Error getting rooms: {e}")
        return {'success': False, 'error': str(e)}

# ==================== BID WHIST SPECIFIC EVENTS ====================

@sio.on("join_bid_whist")
async def handle_join_bid_whist(sid, data):
    """
    Player joins a Bid Whist game table
    data: {game_id, username}
    """
    try:
        game_id = data.get("game_id")
        username = data.get("username", "Player")
        
        await sio.enter_room(sid, game_id)
        
        logger.info(f"🎴 {username} sat at Bid Whist table: {game_id}")
        
        # Broadcast to the room that a player has sat down
        await sio.emit("player_sat_at_table", {
            "player": username,
            "game_id": game_id
        }, room=game_id)
        
        return {'success': True}
        
    except Exception as e:
        logger.error(f"❌ Error joining Bid Whist: {e}")
        return {'success': False, 'error': str(e)}

@sio.on("card_played_sync")
async def handle_card_played_sync(sid, data):
    """
    Synchronize card plays across all players in real-time
    data: {game_id, player_position, card, game_state}
    """
    try:
        game_id = data.get("game_id")
        
        # Broadcast the updated table state to all players
        await sio.emit("update_table_state", {
            "player_position": data.get("player_position"),
            "card": data.get("card"),
            "game_state": data.get("game_state"),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }, room=game_id)
        
        return {'success': True}
        
    except Exception as e:
        logger.error(f"❌ Error syncing card play: {e}")
        return {'success': False, 'error': str(e)}

@sio.on("bid_placed_sync")
async def handle_bid_placed_sync(sid, data):
    """
    Synchronize bidding across all players
    data: {game_id, player_position, bid_amount, bid_type}
    """
    try:
        game_id = data.get("game_id")
        
        await sio.emit("update_bidding_state", {
            "player_position": data.get("player_position"),
            "bid_amount": data.get("bid_amount"),
            "bid_type": data.get("bid_type"),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }, room=game_id)
        
        return {'success': True}
        
    except Exception as e:
        logger.error(f"❌ Error syncing bid: {e}")
        return {'success': False, 'error': str(e)}

# Export the socket.io app
socket_app = socketio.ASGIApp(sio)

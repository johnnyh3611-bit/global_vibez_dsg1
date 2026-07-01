import secrets
"""
Real-Time Multiplayer Infrastructure
WebSocket-based multiplayer system for game rooms, matchmaking, and live sync
"""
import socketio
from typing import Dict, List, Optional, Set
import uuid
secure_random = secrets.SystemRandom()
import string
from datetime import datetime

# Socket.IO Server (AsyncIO mode)
# Configured to support both WebSocket AND HTTP Long Polling
# Long polling works without WebSocket ingress support!
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=True,
    engineio_logger=False,
    # Allow both transports - Socket.IO will auto-fallback to polling if WebSocket fails
    # This makes multiplayer work even without WebSocket ingress configuration!
    allow_upgrades=True,
    ping_timeout=20,
    ping_interval=25,
    max_http_buffer_size=1000000
)

# In-memory storage for rooms and players
# In production, use Redis for scalability
rooms: Dict[str, Dict] = {}  # room_code -> room data
player_sessions: Dict[str, str] = {}  # session_id -> room_code
online_players: Set[str] = set()  # Set of session IDs
matchmaking_queue: Dict[str, List[Dict]] = {}  # game_type -> list of waiting players
pending_matches: Dict[str, Dict] = {}  # session_id -> match proposal

def generate_room_code() -> str:
    """Generate a unique 6-character room code"""
    return ''.join(''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6)))

def get_room_code_for_session(session_id: str) -> Optional[str]:
    """Get room code for a player session"""
    return player_sessions.get(session_id)

def create_room(game_type: str, host_session_id: str, host_user_id: str, host_name: str, is_private: bool = True) -> Dict:
    """Create a new multiplayer room"""
    room_code = generate_room_code()
    
    # Ensure unique room code
    while room_code in rooms:
        room_code = generate_room_code()
    
    room = {
        'room_code': room_code,
        'game_type': game_type,
        'status': 'waiting',  # waiting, playing, completed
        'is_private': is_private,
        'created_at': datetime.utcnow().isoformat(),
        'host': {
            'session_id': host_session_id,
            'user_id': host_user_id,
            'name': host_name,
            'ready': False
        },
        'guest': None,
        'game_state': None,
        'current_turn': None,
        'chat_messages': [],
        'spectators': []
    }
    
    rooms[room_code] = room
    player_sessions[host_session_id] = room_code
    
    return room

def join_room(room_code: str, guest_session_id: str, guest_user_id: str, guest_name: str) -> Optional[Dict]:
    """Join an existing room"""
    room = rooms.get(room_code)
    
    if not room:
        return None
    
    if room['status'] != 'waiting':
        return None
    
    if room['guest']:
        return None  # Room full
    
    # Add guest to room
    room['guest'] = {
        'session_id': guest_session_id,
        'user_id': guest_user_id,
        'name': guest_name,
        'ready': False
    }
    
    player_sessions[guest_session_id] = room_code
    
    return room

def leave_room(session_id: str) -> Optional[str]:
    """Remove player from room"""
    room_code = player_sessions.get(session_id)
    
    if not room_code:
        return None
    
    room = rooms.get(room_code)
    if not room:
        return None
    
    # Remove player
    if room['host']['session_id'] == session_id:
        # Host left - close room
        if room['guest']:
            del player_sessions[room['guest']['session_id']]
        del player_sessions[session_id]
        del rooms[room_code]
    elif room['guest'] and room['guest']['session_id'] == session_id:
        # Guest left
        room['guest'] = None
        room['status'] = 'waiting'
        del player_sessions[session_id]
    
    return room_code

def start_game(room_code: str) -> bool:
    """Start the game if both players are ready"""
    room = rooms.get(room_code)
    
    if not room or not room['guest']:
        return False
    
    if room['host']['ready'] and room['guest']['ready']:
        room['status'] = 'playing'
        # Randomly choose who goes first
        room['current_turn'] = secure_random.choice(['host', 'guest'])
        return True
    
    return False

def update_game_state(room_code: str, game_state: Dict) -> bool:
    """Update game state and switch turns"""
    room = rooms.get(room_code)
    
    if not room:
        return False
    
    room['game_state'] = game_state
    
    # Switch turn
    if room['current_turn'] == 'host':
        room['current_turn'] = 'guest'
    else:
        room['current_turn'] = 'host'
    
    return True

def add_chat_message(room_code: str, sender_session_id: str, message: str) -> bool:
    """Add chat message to room"""
    room = rooms.get(room_code)
    
    if not room:
        return False
    
    # Add message to room's chat history
    chat_msg = {
        'sender_session_id': sender_session_id,
        'message': message,
        'timestamp': datetime.utcnow().isoformat()
    }
    room['chat_messages'].append(chat_msg)
    return True


def join_matchmaking(game_type: str, session_id: str, user_id: str, user_name: str) -> Optional[Dict]:
    """Add player to matchmaking queue"""
    if game_type not in matchmaking_queue:
        matchmaking_queue[game_type] = []
    
    player_data = {
        'session_id': session_id,
        'user_id': user_id,
        'name': user_name,
        'joined_at': datetime.utcnow().isoformat()
    }
    
    matchmaking_queue[game_type].append(player_data)
    return player_data

def leave_matchmaking(session_id: str) -> bool:
    """Remove player from all matchmaking queues"""
    for game_type in matchmaking_queue:
        matchmaking_queue[game_type] = [
            p for p in matchmaking_queue[game_type] 
            if p['session_id'] != session_id
        ]
    return True

def find_match(game_type: str, session_id: str) -> Optional[Dict]:
    """Find a match for a player in queue"""
    queue = matchmaking_queue.get(game_type, [])
    
    # Find first player that's not the requesting player
    for player in queue:
        if player['session_id'] != session_id:
            return player
    
    return None

def create_match_proposal(proposer_session: str, opponent_session: str, game_type: str) -> str:
    """Create a match proposal and return match ID"""
    match_id = str(uuid.uuid4())[:8]
    
    # Get player details from queue
    proposer = None
    opponent = None
    
    for player in matchmaking_queue.get(game_type, []):
        if player['session_id'] == proposer_session:
            proposer = player
        if player['session_id'] == opponent_session:
            opponent = player
    
    if not proposer or not opponent:
        return None
    
    proposal = {
        'match_id': match_id,
        'game_type': game_type,
        'proposer': proposer,
        'opponent': opponent,
        'status': 'pending',  # pending, accepted, rejected
        'created_at': datetime.utcnow().isoformat()
    }
    
    pending_matches[opponent_session] = proposal
    
    return match_id

def accept_match(session_id: str) -> Optional[Dict]:
    """Accept a match proposal and create room"""
    proposal = pending_matches.get(session_id)
    
    if not proposal or proposal['status'] != 'pending':
        return None
    
    proposal['status'] = 'accepted'
    
    # Create room for the match
    room_code = generate_room_code()
    
    proposer = proposal['proposer']
    opponent = proposal['opponent']
    
    room = {
        'room_code': room_code,
        'game_type': proposal['game_type'],
        'status': 'playing',  # Start immediately
        'is_private': True,
        'created_at': datetime.utcnow().isoformat(),
        'host': {
            'session_id': proposer['session_id'],
            'user_id': proposer['user_id'],
            'name': proposer['name'],
            'ready': True
        },
        'guest': {
            'session_id': opponent['session_id'],
            'user_id': opponent['user_id'],
            'name': opponent['name'],
            'ready': True
        },
        'game_state': None,
        'current_turn': secure_random.choice(['host', 'guest']),
        'chat_messages': [],
        'spectators': []
    }
    
    rooms[room_code] = room
    player_sessions[proposer['session_id']] = room_code
    player_sessions[opponent['session_id']] = room_code
    
    # Remove from matchmaking queue
    game_type = proposal['game_type']
    if game_type in matchmaking_queue:
        matchmaking_queue[game_type] = [
            p for p in matchmaking_queue[game_type]
            if p['session_id'] not in [proposer['session_id'], opponent['session_id']]
        ]
    
    # Clear proposal
    del pending_matches[session_id]
    
    return room

def reject_match(session_id: str) -> bool:
    """Reject a match proposal"""
    proposal = pending_matches.get(session_id)
    
    if not proposal or proposal['status'] != 'pending':
        return False
    
    proposal['status'] = 'rejected'
    del pending_matches[session_id]
    
    return True

def get_public_rooms(game_type: Optional[str] = None) -> List[Dict]:
    """Get list of public rooms waiting for players"""
    public_rooms = []
    
    for room_code, room in rooms.items():
        if room['status'] == 'waiting' and not room['is_private'] and not room['guest']:
            if game_type is None or room['game_type'] == game_type:
                public_rooms.append({
                    'room_code': room_code,
                    'game_type': room['game_type'],
                    'host_name': room['host']['name'],
                    'created_at': room['created_at']
                })
    
    return public_rooms

# ==================== SOCKET.IO EVENT HANDLERS ====================

@sio.event
async def connect(sid, environ):
    """Handle client connection"""
    online_players.add(sid)
    print(f"✅ Client connected: {sid} (Total online: {len(online_players)})")
    await sio.emit('online_count', {'count': len(online_players)}, room=sid)

@sio.event
async def ping_test(sid, data):
    """Simple ping-pong for latency testing - no room required"""
    try:
        # Echo back the data with server timestamp
        await sio.emit('pong_test', {
            'msg_id': data.get('msg_id'),
            'client_send_time': data.get('send_time'),
            'server_time': datetime.utcnow().timestamp() * 1000,
            'payload': data.get('payload', '')
        }, room=sid)
    except Exception as e:
        print(f"Ping test error: {e}")

@sio.event
async def broadcast_test(sid, data):
    """Broadcast message to all clients in a room - for latency testing"""
    try:
        room_code = get_room_code_for_session(sid)
        if not room_code:
            return
        
        # Broadcast to all in room (including sender)
        await sio.emit('broadcast_received', {
            'msg_id': data.get('msg_id'),
            'sender_sid': sid,
            'send_time': data.get('send_time'),
            'server_time': datetime.utcnow().timestamp() * 1000,
            'payload': data.get('payload', ''),
            'sequence': data.get('sequence', -1)
        }, room=room_code)
    except Exception as e:
        print(f"Broadcast test error: {e}")

@sio.event
async def disconnect(sid):
    """Handle client disconnection"""
    online_players.discard(sid)
    print(f"❌ Client disconnected: {sid} (Total online: {len(online_players)})")
    
    # Remove from room if in one
    room_code = leave_room(sid)
    if room_code:
        # Notify other player
        await sio.emit('player_left', {'room_code': room_code}, room=room_code)

@sio.event
async def create_room_event(sid, data):
    """Create a new game room"""
    try:
        game_type = data.get('game_type')
        user_id = data.get('user_id')
        user_name = data.get('user_name', 'Anonymous')
        is_private = data.get('is_private', True)
        
        room = create_room(game_type, sid, user_id, user_name, is_private)
        
        # Join Socket.IO room
        await sio.enter_room(sid, room['room_code'])
        
        await sio.emit('room_created', {
            'success': True,
            'room': room
        }, room=sid)
        
        print(f"🎮 Room created: {room['room_code']} by {user_name}")
        
    except Exception as e:
        await sio.emit('error', {'message': str(e)}, room=sid)

@sio.event
async def join_room_event(sid, data):
    """Join an existing room"""
    try:
        room_code = data.get('room_code')
        user_id = data.get('user_id')
        user_name = data.get('user_name', 'Anonymous')
        
        room = join_room(room_code, sid, user_id, user_name)
        
        if not room:
            await sio.emit('join_failed', {
                'message': 'Room not found or full'
            }, room=sid)
            return
        
        # Join Socket.IO room
        await sio.enter_room(sid, room_code)
        
        # Notify both players
        await sio.emit('player_joined', {
            'room': room,
            'guest_name': user_name
        }, room=room_code)
        
        print(f"🎮 {user_name} joined room {room_code}")
        
    except Exception as e:
        await sio.emit('error', {'message': str(e)}, room=sid)

@sio.event
async def leave_room_event(sid, data):
    """Leave current room"""
    try:
        room_code = leave_room(sid)
        
        if room_code:
            await sio.leave_room(sid, room_code)
            await sio.emit('player_left', {'room_code': room_code}, room=room_code)
        
        await sio.emit('left_room', {'success': True}, room=sid)
        
    except Exception as e:
        await sio.emit('error', {'message': str(e)}, room=sid)

@sio.event


@sio.event
async def join_matchmaking_event(sid, data):
    """Join matchmaking queue"""
    try:
        game_type = data.get('game_type')
        user_id = data.get('user_id')
        user_name = data.get('user_name', 'Anonymous')
        
        join_matchmaking(game_type, sid, user_id, user_name)
        
        await sio.emit('matchmaking_joined', {
            'success': True,
            'game_type': game_type,
            'queue_position': len(matchmaking_queue.get(game_type, []))
        }, room=sid)
        
        print(f"🔍 {user_name} joined {game_type} matchmaking")
        
        # Try to find a match
        opponent = find_match(game_type, sid)
        
        if opponent:
            # Create match proposal
            match_id = create_match_proposal(sid, opponent['session_id'], game_type)
            
            if match_id:
                # Send proposal to opponent
                await sio.emit('match_found', {
                    'match_id': match_id,
                    'opponent_name': user_name,
                    'game_type': game_type
                }, room=opponent['session_id'])
                
                # Notify proposer that match is pending
                await sio.emit('match_pending', {
                    'match_id': match_id,
                    'opponent_name': opponent['name']
                }, room=sid)
                
                print(f"🎮 Match proposed: {user_name} vs {opponent['name']}")
        
    except Exception as e:
        await sio.emit('error', {'message': str(e)}, room=sid)

@sio.event
async def leave_matchmaking_event(sid, data):
    """Leave matchmaking queue"""
    try:
        leave_matchmaking(sid)
        await sio.emit('matchmaking_left', {'success': True}, room=sid)
        print(f"❌ Player left matchmaking: {sid}")
        
    except Exception as e:
        await sio.emit('error', {'message': str(e)}, room=sid)

@sio.event
async def accept_match_event(sid, data):
    """Accept match proposal"""
    try:
        room = accept_match(sid)
        
        if not room:
            await sio.emit('match_accept_failed', {
                'message': 'Match no longer available'
            }, room=sid)
            return
        
        # Join both players to Socket.IO room
        await sio.enter_room(room['host']['session_id'], room['room_code'])
        await sio.enter_room(room['guest']['session_id'], room['room_code'])
        
        # Notify both players
        await sio.emit('match_accepted', {
            'room': room
        }, room=room['room_code'])
        
        print(f"✅ Match accepted! Room: {room['room_code']}")
        
    except Exception as e:
        await sio.emit('error', {'message': str(e)}, room=sid)

@sio.event
async def reject_match_event(sid, data):
    """Reject match proposal"""
    try:
        proposal = pending_matches.get(sid)
        
        if proposal:
            proposer_session = proposal['proposer']['session_id']
            
            # Reject the match
            if reject_match(sid):
                # Notify proposer
                await sio.emit('match_rejected', {
                    'message': 'Opponent declined the match'
                }, room=proposer_session)
                
                await sio.emit('match_reject_confirmed', {
                    'success': True
                }, room=sid)
                
                print(f"❌ Match rejected by {sid}")
        
    except Exception as e:
        await sio.emit('error', {'message': str(e)}, room=sid)

async def player_ready(sid, data):
    """Mark player as ready"""
    try:
        room_code = get_room_code_for_session(sid)
        
        if not room_code:
            return
        
        room = rooms.get(room_code)
        if not room:
            return
        
        # Mark player as ready
        if room['host']['session_id'] == sid:
            room['host']['ready'] = True
        elif room['guest'] and room['guest']['session_id'] == sid:
            room['guest']['ready'] = True
        
        # Notify room
        await sio.emit('player_ready_update', {
            'host_ready': room['host']['ready'],
            'guest_ready': room['guest']['ready'] if room['guest'] else False
        }, room=room_code)
        
        # Check if game can start
        if start_game(room_code):
            await sio.emit('game_started', {
                'room': room,
                'starting_player': room['current_turn']
            }, room=room_code)
            print(f"🎮 Game started in room {room_code}")
        
    except Exception as e:
        await sio.emit('error', {'message': str(e)}, room=sid)

@sio.event
async def make_move(sid, data):
    """Handle game move"""
    try:
        room_code = get_room_code_for_session(sid)
        
        if not room_code:
            return
        
        room = rooms.get(room_code)
        if not room or room['status'] != 'playing':
            return
        
        # Verify it's player's turn
        current_player = 'host' if room['host']['session_id'] == sid else 'guest'
        if room['current_turn'] != current_player:
            await sio.emit('error', {'message': 'Not your turn'}, room=sid)
            return
        
        # Update game state (game-specific logic handled by client)
        move_data = data.get('move')
        game_state = data.get('game_state')
        
        if update_game_state(room_code, game_state):
            # Broadcast move to room
            await sio.emit('move_made', {
                'move': move_data,
                'game_state': game_state,
                'current_turn': room['current_turn']
            }, room=room_code)
        
    except Exception as e:
        await sio.emit('error', {'message': str(e)}, room=sid)

@sio.event
async def game_over(sid, data):
    """Handle game completion"""
    try:
        room_code = get_room_code_for_session(sid)
        
        if not room_code:
            return
        
        room = rooms.get(room_code)
        if not room:
            return
        
        room['status'] = 'completed'
        winner = data.get('winner')
        
        await sio.emit('game_completed', {
            'winner': winner,
            'final_state': room['game_state']
        }, room=room_code)
        
        print(f"🏆 Game completed in room {room_code}, winner: {winner}")
        
    except Exception as e:
        await sio.emit('error', {'message': str(e)}, room=sid)

@sio.event
async def send_chat(sid, data):
    """Send chat message"""
    try:
        room_code = get_room_code_for_session(sid)
        
        if not room_code:
            return
        
        message = data.get('message', '').strip()
        
        if not message:
            return
        
        if add_chat_message(room_code, sid, message):
            await sio.emit('chat_message', {
                'sender': data.get('sender_name', 'Unknown'),
                'message': message,
                'timestamp': datetime.utcnow().isoformat()
            }, room=room_code)
        
    except Exception as e:
        await sio.emit('error', {'message': str(e)}, room=sid)

@sio.event
async def get_public_rooms_event(sid, data):
    """Get list of public rooms"""
    try:
        game_type = data.get('game_type')
        public_rooms_list = get_public_rooms(game_type)
        
        await sio.emit('public_rooms', {
            'rooms': public_rooms_list
        }, room=sid)
        
    except Exception as e:
        await sio.emit('error', {'message': str(e)}, room=sid)

def get_multiplayer_stats():
    """Get current multiplayer statistics"""
    return {
        "active_rooms": len(rooms),
        "connected_players": len(online_players),
        "matchmaking_queues": {k: len(v) for k, v in matchmaking_queue.items()}
    }

# ==========================================
# POKER MULTIPLAYER EVENT HANDLERS
# ==========================================

from services.poker_multiplayer import (
    poker_tables,
    create_poker_table,
    join_poker_table,
    start_poker_hand,
    player_poker_action,
    get_table_state_for_player,
    remove_player_from_table
)

# ==========================================
# BLACKJACK MULTIPLAYER EVENT HANDLERS
# ==========================================

from services.blackjack_multiplayer import (
    blackjack_tables,
    create_blackjack_table,
    join_blackjack_table,
    start_betting_round,
    place_bet,
    player_blackjack_action,
    get_table_state_for_player as get_blackjack_state,
    remove_player_from_table as remove_blackjack_player
)

# ==========================================
# UNO MULTIPLAYER EVENT HANDLERS
# ==========================================

from services.uno_multiplayer import (
    uno_tables,
    create_uno_table,
    join_uno_table,
    start_uno_round,
    play_uno_card,
    draw_uno_card,
    call_uno,
    fill_with_bots as fill_uno_with_bots,
    get_table_state_for_player as get_uno_state,
    remove_player_from_table as remove_uno_player
)

@sio.event
async def create_poker_room(sid, data):
    """Create a new poker table"""
    try:
        player_name = data.get('player_name', 'Player')
        buy_in = data.get('buy_in', 1000)
        small_blind = data.get('small_blind', 10)
        
        # Generate room code
        room_code = generate_room_code()
        
        # Create poker table
        table = create_poker_table(room_code, sid, player_name, buy_in, small_blind)
        
        # Join Socket.IO room
        await sio.enter_room(sid, room_code)
        player_sessions[sid] = room_code
        
        # Send table state to creator
        table_state = get_table_state_for_player(table, sid)
        await sio.emit('poker_table_created', {
            'success': True,
            'room_code': room_code,
            'table': table_state
        }, room=sid)
        
        print(f"🃏 Poker table created: {room_code} by {player_name}")
        
    except Exception as e:
        print(f"Error creating poker table: {e}")
        await sio.emit('error', {'message': f'Failed to create poker table: {str(e)}'}, room=sid)

@sio.event
async def join_poker_room(sid, data):
    """Join an existing poker table"""
    try:
        room_code = data.get('room_code')
        player_name = data.get('player_name', 'Player')
        
        if not room_code:
            await sio.emit('error', {'message': 'Room code required'}, room=sid)
            return
        
        # Join poker table
        result = join_poker_table(room_code, sid, player_name)
        
        if result is None:
            await sio.emit('error', {'message': 'Table not found'}, room=sid)
            return
        
        if 'error' in result:
            await sio.emit('error', {'message': result['error']}, room=sid)
            return
        
        # Join Socket.IO room
        await sio.enter_room(sid, room_code)
        player_sessions[sid] = room_code
        
        # Broadcast updated table state to all players
        await broadcast_poker_state(room_code)
        
        print(f"🃏 {player_name} joined poker table: {room_code}")
        
    except Exception as e:
        print(f"Error joining poker table: {e}")
        await sio.emit('error', {'message': f'Failed to join table: {str(e)}'}, room=sid)

@sio.event
async def start_poker(sid, data):
    """Start a poker hand"""
    try:
        room_code = get_room_code_for_session(sid)
        if not room_code:
            await sio.emit('error', {'message': 'Not in a poker room'}, room=sid)
            return
        
        # Start hand
        result = start_poker_hand(room_code)
        
        if result is None:
            await sio.emit('error', {'message': 'Table not found'}, room=sid)
            return
        
        if 'error' in result:
            await sio.emit('error', {'message': result['error']}, room=sid)
            return
        
        # Broadcast table state to all players
        await broadcast_poker_state(room_code)
        
        print(f"🃏 Poker hand started in room: {room_code}")
        
    except Exception as e:
        print(f"Error starting poker hand: {e}")
        await sio.emit('error', {'message': f'Failed to start hand: {str(e)}'}, room=sid)

@sio.event
async def poker_action(sid, data):
    """Process a player's poker action"""
    try:
        room_code = get_room_code_for_session(sid)
        if not room_code:
            await sio.emit('error', {'message': 'Not in a poker room'}, room=sid)
            return
        
        action = data.get('action')
        amount = data.get('amount', 0)
        
        if not action:
            await sio.emit('error', {'message': 'Action required'}, room=sid)
            return
        
        # Process action
        result = player_poker_action(room_code, sid, action, amount)
        
        if result is None:
            await sio.emit('error', {'message': 'Table not found'}, room=sid)
            return
        
        if 'error' in result:
            await sio.emit('error', {'message': result['error']}, room=sid)
            return
        
        # Broadcast updated state
        await broadcast_poker_state(room_code)
        
        # Emit action notification to all players
        table = poker_tables.get(room_code)
        if table:
            player = table['players'].get(sid)
            if player:
                await sio.emit('poker_action_made', {
                    'player_name': player['name'],
                    'action': action,
                    'amount': amount
                }, room=room_code)
        
    except Exception as e:
        print(f"Error processing poker action: {e}")
        await sio.emit('error', {'message': f'Failed to process action: {str(e)}'}, room=sid)

@sio.event
async def leave_poker_table(sid, data):
    """Leave poker table"""
    try:
        room_code = get_room_code_for_session(sid)
        if not room_code:
            return
        
        # Remove from table
        result = remove_player_from_table(room_code, sid)
        
        # Leave Socket.IO room
        await sio.leave_room(sid, room_code)
        if sid in player_sessions:
            del player_sessions[sid]
        
        # Broadcast updated state if table still exists
        if result is not None:
            await broadcast_poker_state(room_code)
        
        print(f"🃏 Player left poker table: {room_code}")
        
    except Exception as e:
        print(f"Error leaving poker table: {e}")

async def broadcast_poker_state(room_code: str):
    """Broadcast poker table state to all players in room"""
    if room_code not in poker_tables:
        return
    
    table = poker_tables[room_code]
    
    # Send customized state to each player (hide opponent hole cards)
    for session_id in table['player_order']:
        if table['players'][session_id]['is_active']:
            player_state = get_table_state_for_player(table, session_id)
            await sio.emit('poker_state_update', {
                'table': player_state
            }, room=session_id)

# ==========================================
# BLACKJACK SOCKET.IO EVENTS
# ==========================================

@sio.event
async def create_blackjack_room(sid, data):
    """Create a new blackjack table"""
    try:
        player_name = data.get('player_name', 'Player')
        user_id = data.get('user_id', None)  # Get user_id from frontend
        min_bet = max(int(data.get('min_bet', 50) or 50), 50)  # 50-coin platform floor
        max_bet = data.get('max_bet', 500)
        
        room_code = generate_room_code()
        table = create_blackjack_table(room_code, sid, player_name, min_bet, max_bet, user_id)
        
        await sio.enter_room(sid, room_code)
        player_sessions[sid] = room_code
        
        table_state = get_blackjack_state(table, sid)
        await sio.emit('blackjack_table_created', {
            'success': True,
            'room_code': room_code,
            'table': table_state
        }, room=sid)
        
        print(f"🎰 Blackjack table created: {room_code} by {player_name} (user_id: {user_id})")
        
    except Exception as e:
        print(f"Error creating blackjack table: {e}")
        await sio.emit('error', {'message': f'Failed to create blackjack table: {str(e)}'}, room=sid)

@sio.event
async def join_blackjack_room(sid, data):
    """Join an existing blackjack table"""
    try:
        room_code = data.get('room_code')
        player_name = data.get('player_name', 'Player')
        user_id = data.get('user_id', None)  # Get user_id from frontend
        
        if not room_code:
            await sio.emit('error', {'message': 'Room code required'}, room=sid)
            return
        
        result = join_blackjack_table(room_code, sid, player_name, user_id)
        
        if result is None:
            await sio.emit('error', {'message': 'Table not found'}, room=sid)
            return
        
        if 'error' in result:
            await sio.emit('error', {'message': result['error']}, room=sid)
            return
        
        await sio.enter_room(sid, room_code)
        player_sessions[sid] = room_code
        
        await broadcast_blackjack_state(room_code)
        
        print(f"🎰 {player_name} joined blackjack table: {room_code} (user_id: {user_id})")
        
    except Exception as e:
        print(f"Error joining blackjack table: {e}")
        await sio.emit('error', {'message': f'Failed to join table: {str(e)}'}, room=sid)

@sio.event
async def start_blackjack_round(sid, data):
    """Start betting phase for blackjack round"""
    try:
        room_code = get_room_code_for_session(sid)
        if not room_code:
            await sio.emit('error', {'message': 'Not in a blackjack room'}, room=sid)
            return
        
        result = start_betting_round(room_code)
        
        if result is None:
            await sio.emit('error', {'message': 'Table not found'}, room=sid)
            return
        
        if 'error' in result:
            await sio.emit('error', {'message': result['error']}, room=sid)
            return
        
        await broadcast_blackjack_state(room_code)
        
        print(f"🎰 Blackjack round started in room: {room_code}")
        
    except Exception as e:
        print(f"Error starting blackjack round: {e}")
        await sio.emit('error', {'message': f'Failed to start round: {str(e)}'}, room=sid)

@sio.event
async def blackjack_bet(sid, data):
    """Player places bet"""
    try:
        room_code = get_room_code_for_session(sid)
        if not room_code:
            await sio.emit('error', {'message': 'Not in a blackjack room'}, room=sid)
            return
        
        amount = data.get('amount', 0)
        
        result = place_bet(room_code, sid, amount)
        
        if result is None:
            await sio.emit('error', {'message': 'Table not found'}, room=sid)
            return
        
        if 'error' in result:
            await sio.emit('error', {'message': result['error']}, room=sid)
            return
        
        await broadcast_blackjack_state(room_code)
        
    except Exception as e:
        print(f"Error placing blackjack bet: {e}")
        await sio.emit('error', {'message': f'Failed to place bet: {str(e)}'}, room=sid)

@sio.event
async def blackjack_action(sid, data):
    """Player takes action (hit, stand, double)"""
    try:
        room_code = get_room_code_for_session(sid)
        if not room_code:
            await sio.emit('error', {'message': 'Not in a blackjack room'}, room=sid)
            return
        
        action = data.get('action')
        
        if not action:
            await sio.emit('error', {'message': 'Action required'}, room=sid)
            return
        
        result = await player_blackjack_action(room_code, sid, action)
        
        if result is None:
            await sio.emit('error', {'message': 'Table not found'}, room=sid)
            return
        
        if 'error' in result:
            await sio.emit('error', {'message': result['error']}, room=sid)
            return
        
        await broadcast_blackjack_state(room_code)
        
        table = blackjack_tables.get(room_code)
        if table:
            player = table['players'].get(sid)
            if player:
                await sio.emit('blackjack_action_made', {
                    'player_name': player['name'],
                    'action': action
                }, room=room_code)
        
    except Exception as e:
        print(f"Error processing blackjack action: {e}")
        await sio.emit('error', {'message': f'Failed to process action: {str(e)}'}, room=sid)

@sio.event
async def leave_blackjack_table(sid, data):
    """Leave blackjack table"""
    try:
        room_code = get_room_code_for_session(sid)
        if not room_code:
            return
        
        result = remove_blackjack_player(room_code, sid)
        
        await sio.leave_room(sid, room_code)
        if sid in player_sessions:
            del player_sessions[sid]
        
        if result is not None:
            await broadcast_blackjack_state(room_code)
        
        print(f"🎰 Player left blackjack table: {room_code}")
        
    except Exception as e:
        print(f"Error leaving blackjack table: {e}")

# ==========================================
# UNO SOCKET.IO EVENTS  
# ==========================================

@sio.event
async def create_uno_room(sid, data):
    """Create a new UNO table"""
    try:
        player_name = data.get('player_name', 'Player')
        
        room_code = generate_room_code()
        table = create_uno_table(room_code, sid, player_name)
        
        await sio.enter_room(sid, room_code)
        player_sessions[sid] = room_code
        
        table_state = get_uno_state(table, sid)
        await sio.emit('uno_table_created', {
            'success': True,
            'room_code': room_code,
            'table': table_state
        }, room=sid)
        
        print(f"🎨 UNO table created: {room_code} by {player_name}")
        
    except Exception as e:
        print(f"Error creating UNO table: {e}")
        await sio.emit('error', {'message': f'Failed to create UNO table: {str(e)}'}, room=sid)

@sio.event
async def join_uno_room(sid, data):
    """Join an existing UNO table"""
    try:
        room_code = data.get('room_code')
        player_name = data.get('player_name', 'Player')
        
        if not room_code:
            await sio.emit('error', {'message': 'Room code required'}, room=sid)
            return
        
        result = join_uno_table(room_code, sid, player_name)
        
        if result is None:
            await sio.emit('error', {'message': 'Table not found'}, room=sid)
            return
        
        if 'error' in result:
            await sio.emit('error', {'message': result['error']}, room=sid)
            return
        
        await sio.enter_room(sid, room_code)
        player_sessions[sid] = room_code
        
        await broadcast_uno_state(room_code)
        
        print(f"🎨 {player_name} joined UNO table: {room_code}")
        
    except Exception as e:
        print(f"Error joining UNO table: {e}")
        await sio.emit('error', {'message': f'Failed to join table: {str(e)}'}, room=sid)

@sio.event
async def start_uno_game(sid, data):
    """Start UNO round"""
    try:
        room_code = get_room_code_for_session(sid)
        if not room_code:
            await sio.emit('error', {'message': 'Not in a UNO room'}, room=sid)
            return
        
        result = start_uno_round(room_code)
        
        if result is None:
            await sio.emit('error', {'message': 'Table not found'}, room=sid)
            return
        
        if 'error' in result:
            await sio.emit('error', {'message': result['error']}, room=sid)
            return
        
        await broadcast_uno_state(room_code)
        
        print(f"🎨 UNO round started in room: {room_code}")
        
    except Exception as e:
        print(f"Error starting UNO round: {e}")
        await sio.emit('error', {'message': f'Failed to start round: {str(e)}'}, room=sid)

@sio.event
async def uno_fill_with_bots(sid, data):
    """Fill the user's UNO table with AI bots so a single human can play
    immediately without waiting for opponents. After bots are added, the round
    is auto-started so the user lands directly in real gameplay.
    """
    try:
        room_code = get_room_code_for_session(sid)
        if not room_code:
            await sio.emit('error', {'message': 'Not in a UNO room'}, room=sid)
            return

        result = fill_uno_with_bots(room_code)
        if result is None:
            await sio.emit('error', {'message': 'Table not found'}, room=sid)
            return
        if 'error' in result:
            await sio.emit('error', {'message': result['error']}, room=sid)
            return

        # Auto-start the round once bots are seated.
        round_result = start_uno_round(room_code)
        if isinstance(round_result, dict) and 'error' in round_result:
            await sio.emit('error', {'message': round_result['error']}, room=sid)
            return

        await broadcast_uno_state(room_code)
        print(f"🤖 UNO bots filled + round auto-started in room: {room_code}")

    except Exception as e:
        print(f"Error filling UNO with bots: {e}")
        await sio.emit('error', {'message': f'Failed to add bots: {str(e)}'}, room=sid)

@sio.event
async def uno_play_card(sid, data):
    """Play a card"""
    try:
        room_code = get_room_code_for_session(sid)
        if not room_code:
            await sio.emit('error', {'message': 'Not in a UNO room'}, room=sid)
            return
        
        card_index = data.get('card_index')
        chosen_color = data.get('chosen_color')
        
        if card_index is None:
            await sio.emit('error', {'message': 'Card index required'}, room=sid)
            return
        
        result = play_uno_card(room_code, sid, card_index, chosen_color)
        
        if result is None:
            await sio.emit('error', {'message': 'Table not found'}, room=sid)
            return
        
        if 'error' in result:
            await sio.emit('error', {'message': result['error']}, room=sid)
            return
        
        await broadcast_uno_state(room_code)
        
    except Exception as e:
        print(f"Error playing UNO card: {e}")
        await sio.emit('error', {'message': f'Failed to play card: {str(e)}'}, room=sid)

@sio.event
async def uno_draw_card(sid, data):
    """Draw a card from deck"""
    try:
        room_code = get_room_code_for_session(sid)
        if not room_code:
            await sio.emit('error', {'message': 'Not in a UNO room'}, room=sid)
            return
        
        result = draw_uno_card(room_code, sid)
        
        if result is None:
            await sio.emit('error', {'message': 'Table not found'}, room=sid)
            return
        
        if 'error' in result:
            await sio.emit('error', {'message': result['error']}, room=sid)
            return
        
        # Check if player can play drawn card
        if 'drawn_card' in result and result.get('can_play'):
            table = uno_tables[room_code]
            player_state = get_uno_state(table, sid)
            await sio.emit('card_drawn', {
                'can_play': True,
                'table': player_state
            }, room=sid)
        else:
            await broadcast_uno_state(room_code)
        
    except Exception as e:
        print(f"Error drawing UNO card: {e}")
        await sio.emit('error', {'message': f'Failed to draw card: {str(e)}'}, room=sid)

@sio.event
async def uno_call_uno(sid, data):
    """Call UNO"""
    try:
        room_code = get_room_code_for_session(sid)
        if not room_code:
            await sio.emit('error', {'message': 'Not in a UNO room'}, room=sid)
            return
        
        result = call_uno(room_code, sid)
        
        if result is None:
            await sio.emit('error', {'message': 'Table not found'}, room=sid)
            return
        
        if 'error' in result:
            await sio.emit('error', {'message': result['error']}, room=sid)
            return
        
        await broadcast_uno_state(room_code)
        
        # Broadcast UNO call to all players
        table = uno_tables[room_code]
        player = table['players'][sid]
        await sio.emit('uno_called', {
            'player_name': player['name']
        }, room=room_code)
        
    except Exception as e:
        print(f"Error calling UNO: {e}")
        await sio.emit('error', {'message': f'Failed to call UNO: {str(e)}'}, room=sid)

@sio.event
async def leave_uno_table(sid, data):
    """Leave UNO table"""
    try:
        room_code = get_room_code_for_session(sid)
        if not room_code:
            return
        
        result = remove_uno_player(room_code, sid)
        
        await sio.leave_room(sid, room_code)
        if sid in player_sessions:
            del player_sessions[sid]
        
        if result is not None:
            await broadcast_uno_state(room_code)
        
        print(f"🎨 Player left UNO table: {room_code}")
        
    except Exception as e:
        print(f"Error leaving UNO table: {e}")

async def broadcast_uno_state(room_code: str):
    """Broadcast UNO table state to all players"""
    if room_code not in uno_tables:
        return
    
    table = uno_tables[room_code]
    
    for session_id in table['player_order']:
        if table['players'][session_id]['is_active']:
            player_state = get_uno_state(table, session_id)
            await sio.emit('uno_state_update', {
                'table': player_state
            }, room=session_id)


async def broadcast_blackjack_state(room_code: str):
    """Broadcast blackjack table state to all players"""
    if room_code not in blackjack_tables:
        return
    
    table = blackjack_tables[room_code]
    
    for session_id in table['player_order']:
        if table['players'][session_id]['is_active']:
            player_state = get_blackjack_state(table, session_id)
            await sio.emit('blackjack_state_update', {
                'table': player_state
            }, room=session_id)

# ==========================================
# GENERIC IN-GAME CHAT (text + emoji reactions)
# ==========================================
# Used by every multiplayer card-game room (BidWhist Premium AAA, UNO Premium,
# Multiplayer Poker, Multiplayer Blackjack, etc.). Frontend component:
# /app/frontend/src/components/bidwhist/GameChat.tsx
#
# Wire is intentionally minimal — relay only. No DB persistence (game chat is
# ephemeral per-room; main social chat handles durable history).

@sio.event
async def game_chat(sid, data):
    """Broadcast a chat message to every player in the same room."""
    try:
        room_code = get_room_code_for_session(sid)
        if not room_code:
            return
        # Re-emit to the room. Frontend ignores its own echo via msg.id check.
        await sio.emit('game_chat', {'message': data.get('message', {})}, room=room_code, skip_sid=sid)
    except Exception as e:
        print(f"Error broadcasting game_chat: {e}")

@sio.event
async def game_chat_reaction(sid, data):
    """Broadcast an emoji reaction toggle to every player in the same room."""
    try:
        room_code = get_room_code_for_session(sid)
        if not room_code:
            return
        await sio.emit('game_chat_reaction', {
            'message_id': data.get('message_id'),
            'emoji': data.get('emoji'),
            'user': data.get('user'),
            'action': data.get('action', 'add'),
        }, room=room_code, skip_sid=sid)
    except Exception as e:
        print(f"Error broadcasting game_chat_reaction: {e}")

# Export Socket.IO app for mounting in main server
socketio_app = socketio.ASGIApp(sio, socketio_path='/api/socket.io')

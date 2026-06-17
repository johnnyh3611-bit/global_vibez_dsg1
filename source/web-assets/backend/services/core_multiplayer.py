import secrets
"""
Core Multiplayer Services
Room management, matchmaking, and common multiplayer utilities
"""
secure_random = secrets.SystemRandom()
import string
from typing import Dict, List, Optional, Set
from datetime import datetime

# In-memory storage (in production, use Redis)
rooms: Dict[str, Dict] = {}
player_sessions: Dict[str, str] = {}
online_players: Set[str] = set()
matchmaking_queue: Dict[str, List[Dict]] = {}
pending_matches: Dict[str, Dict] = {}


def generate_room_code() -> str:
    """Generate a unique 6-character room code"""
    return ''.join(''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6)))


def get_room_code_for_session(session_id: str) -> Optional[str]:
    """Get room code for a player session"""
    return player_sessions.get(session_id)


def create_room(game_type: str, host_session_id: str, host_user_id: str, host_name: str, is_private: bool = True) -> Dict:
    """Create a new multiplayer room"""
    room_code = generate_room_code()
    
    while room_code in rooms:
        room_code = generate_room_code()
    
    room = {
        'room_code': room_code,
        'game_type': game_type,
        'status': 'waiting',
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
    
    if not room or room['status'] != 'waiting' or room['guest']:
        return None
    
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
    if room:
        # Mark as disconnected or remove guest
        if room['host']['session_id'] == session_id:
            # Host left - could mark as abandoned or close room
            room['status'] = 'abandoned'
        elif room['guest'] and room['guest']['session_id'] == session_id:
            room['guest'] = None
            room['status'] = 'waiting'
    
    del player_sessions[session_id]
    return room_code


def start_game(room_code: str) -> bool:
    """Start the game in a room"""
    room = rooms.get(room_code)
    if not room or room['status'] != 'waiting':
        return False
    
    room['status'] = 'playing'
    return True


def update_game_state(room_code: str, game_state: Dict) -> bool:
    """Update game state"""
    room = rooms.get(room_code)
    if not room:
        return False
    
    room['game_state'] = game_state
    return True


def add_chat_message(room_code: str, sender_session_id: str, message: str) -> bool:
    """Add chat message to room"""
    room = rooms.get(room_code)
    if not room:
        return False
    
    sender_name = 'Unknown'
    if room['host']['session_id'] == sender_session_id:
        sender_name = room['host']['name']
    elif room['guest'] and room['guest']['session_id'] == sender_session_id:
        sender_name = room['guest']['name']
    
    room['chat_messages'].append({
        'sender_id': sender_session_id,
        'sender_name': sender_name,
        'message': message,
        'timestamp': datetime.utcnow().isoformat()
    })
    return True


def get_public_rooms(game_type: Optional[str] = None) -> List[Dict]:
    """Get list of public rooms"""
    public_rooms = []
    for room_code, room in rooms.items():
        if (not room['is_private'] and 
            room['status'] == 'waiting' and 
            (game_type is None or room['game_type'] == game_type)):
            public_rooms.append({
                'room_code': room_code,
                'game_type': room['game_type'],
                'players': 1 + (1 if room['guest'] else 0),
                'max_players': 2,
                'host_name': room['host']['name'],
                'created_at': room['created_at']
            })
    return public_rooms


# Matchmaking functions
def join_matchmaking(game_type: str, session_id: str, user_id: str, user_name: str) -> Optional[Dict]:
    """Join matchmaking queue"""
    if game_type not in matchmaking_queue:
        matchmaking_queue[game_type] = []
    
    player = {
        'session_id': session_id,
        'user_id': user_id,
        'name': user_name,
        'joined_at': datetime.utcnow().isoformat()
    }
    matchmaking_queue[game_type].append(player)
    return player


def leave_matchmaking(session_id: str) -> bool:
    """Leave matchmaking queue"""
    for game_type in matchmaking_queue:
        matchmaking_queue[game_type] = [
            p for p in matchmaking_queue[game_type] 
            if p['session_id'] != session_id
        ]
    return True


def find_match(game_type: str, session_id: str) -> Optional[Dict]:
    """Find a match for player"""
    queue = matchmaking_queue.get(game_type, [])
    if len(queue) < 2:
        return None
    
    # Simple FIFO matching
    player1 = queue[0]
    player2 = queue[1]
    
    if player1['session_id'] == session_id or player2['session_id'] == session_id:
        matchmaking_queue[game_type] = queue[2:]
        return {'player1': player1, 'player2': player2}
    
    return None


def get_multiplayer_stats() -> Dict:
    """Get multiplayer statistics"""
    return {
        'total_rooms': len(rooms),
        'active_rooms': len([r for r in rooms.values() if r['status'] == 'playing']),
        'waiting_rooms': len([r for r in rooms.values() if r['status'] == 'waiting']),
        'online_players': len(online_players),
        'matchmaking_queue_sizes': {
            game_type: len(queue) 
            for game_type, queue in matchmaking_queue.items()
        }
    }

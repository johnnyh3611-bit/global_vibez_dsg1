"""
Universal Room Manager for Multiplayer Card Games
Handles room creation, joining, player management, and game state
Works for: Bid Whist, Spades, Hearts, Poker, UNO, etc.

NEW: Direct Invite System (no manual room codes)
- Host creates room and invites specific players
- Players receive invite notifications with Accept/Reject
"""
import secrets
import string
from typing import Dict, List, Optional
from datetime import datetime, timezone
from enum import Enum

# In-memory storage (will be replaced with Redis for production scalability)
game_rooms: Dict[str, Dict] = {}
player_sessions: Dict[str, str] = {}  # session_id -> room_code mapping
pending_invites: Dict[str, List[Dict]] = {}  # user_id -> list of pending invites


class RoomState(str, Enum):
    WAITING = "waiting"
    READY = "ready"
    PLAYING = "playing"
    PAUSED = "paused"
    COMPLETED = "completed"


class GameType(str, Enum):
    BID_WHIST = "bid_whist"
    SPADES = "spades"
    HEARTS = "hearts"
    POKER = "poker"
    UNO = "uno"
    BLACKJACK = "blackjack"


def generate_room_code(length: int = 8) -> str:
    """Generate a unique internal room code (hidden from users)"""
    while True:
        code = ''.join(secrets.choice(string.ascii_lowercase + string.digits) for _ in range(length))
        if code not in game_rooms:
            return code


def create_room(
    host_session_id: str,
    host_user_id: str,
    host_name: str,
    game_type: GameType,
    max_players: int = 4,
    is_public: bool = True,
    wager: int = 0,
    winning_score: int = 7,
    custom_rules: Dict = None
) -> Dict:
    """Create a new game room"""
    room_code = generate_room_code()
    
    room = {
        'room_code': room_code,  # Internal only (hidden from UI)
        'game_type': game_type,
        'host_id': host_session_id,
        'host_user_id': host_user_id,
        'state': RoomState.WAITING,
        'is_public': is_public,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'max_players': max_players,
        'max_spectators': 4,
        
        # Settings
        'settings': {
            'wager': wager,
            'winning_score': winning_score,
            'custom_rules': custom_rules or {}
        },
        
        # Players: session_id -> player_data
        'players': {},
        'player_order': [],  # Ordered list of session_ids for turn tracking
        
        # Invites
        'pending_invites': [],  # List of user_ids who were invited but haven't joined
        'invited_users': [],  # All user_ids who received invites (for tracking)
        
        # Spectators
        'spectators': [],
        
        # Game state (game-specific data)
        'game_data': None,
        
        # Chat
        'chat_messages': []
    }
    
    # Add host as first player
    _add_player_to_room(room, host_session_id, host_user_id, host_name, is_host=True)
    
    game_rooms[room_code] = room
    player_sessions[host_session_id] = room_code
    
    return room


def send_invite(room_code: str, host_session_id: str, invited_user_id: str, invited_user_name: str = None) -> Optional[Dict]:
    """Send invite to a specific player"""
    if room_code not in game_rooms:
        return {'error': 'Room not found'}
    
    room = game_rooms[room_code]
    
    # Verify requester is host
    if room['host_id'] != host_session_id:
        return {'error': 'Only host can send invites'}
    
    # Check if room is full
    if len(room['players']) >= room['max_players']:
        return {'error': 'Room is full'}
    
    # Check if already invited or in room
    if invited_user_id in room['invited_users']:
        return {'error': 'Player already invited'}
    
    # Check if player already in room
    for player in room['players'].values():
        if player.get('user_id') == invited_user_id:
            return {'error': 'Player already in room'}
    
    # Create invite
    invite = {
        'invite_id': f"invite_{secrets.token_hex(8)}",
        'room_code': room_code,
        'game_type': room['game_type'],
        'host_name': room['players'][host_session_id]['name'],
        'host_user_id': room['host_user_id'],
        'invited_user_id': invited_user_id,
        'invited_user_name': invited_user_name,
        'wager': room['settings']['wager'],
        'winning_score': room['settings']['winning_score'],
        'created_at': datetime.now(timezone.utc).isoformat(),
        'expires_at': (datetime.now(timezone.utc).timestamp() + 300) * 1000  # 5 minutes
    }
    
    # Store invite
    room['pending_invites'].append(invited_user_id)
    room['invited_users'].append(invited_user_id)
    
    # Add to user's pending invites
    if invited_user_id not in pending_invites:
        pending_invites[invited_user_id] = []
    pending_invites[invited_user_id].append(invite)
    
    return invite


def accept_invite(invite_id: str, session_id: str, user_id: str, player_name: str) -> Optional[Dict]:
    """Accept a room invite"""
    # Find invite
    invite = None
    if user_id in pending_invites:
        for inv in pending_invites[user_id]:
            if inv['invite_id'] == invite_id:
                invite = inv
                break
    
    if not invite:
        return {'error': 'Invite not found or expired'}
    
    room_code = invite['room_code']
    
    if room_code not in game_rooms:
        return {'error': 'Room no longer exists'}
    
    room = game_rooms[room_code]
    
    # Check if room is full
    if len(room['players']) >= room['max_players']:
        return {'error': 'Room is now full'}
    
    # Check if game already started
    if room['state'] not in [RoomState.WAITING, RoomState.READY]:
        return {'error': 'Game already in progress'}
    
    # Add player to room
    _add_player_to_room(room, session_id, user_id, player_name)
    player_sessions[session_id] = room_code
    
    # Remove from pending invites
    room['pending_invites'].remove(user_id)
    pending_invites[user_id] = [inv for inv in pending_invites[user_id] if inv['invite_id'] != invite_id]
    
    return room


def reject_invite(invite_id: str, user_id: str) -> bool:
    """Reject a room invite"""
    if user_id not in pending_invites:
        return False
    
    # Find and remove invite
    invite = None
    for inv in pending_invites[user_id]:
        if inv['invite_id'] == invite_id:
            invite = inv
            break
    
    if not invite:
        return False
    
    room_code = invite['room_code']
    
    # Remove from pending invites
    pending_invites[user_id] = [inv for inv in pending_invites[user_id] if inv['invite_id'] != invite_id]
    
    # Remove from room's pending list
    if room_code in game_rooms:
        room = game_rooms[room_code]
        if user_id in room['pending_invites']:
            room['pending_invites'].remove(user_id)
    
    return True


def get_pending_invites(user_id: str) -> List[Dict]:
    """Get all pending invites for a user"""
    if user_id not in pending_invites:
        return []
    
    # Filter out expired invites
    now = datetime.now(timezone.utc).timestamp() * 1000
    valid_invites = []
    
    for invite in pending_invites[user_id]:
        if invite['expires_at'] > now:
            valid_invites.append(invite)
    
    # Update storage
    pending_invites[user_id] = valid_invites
    
    return valid_invites


def _add_player_to_room(room: Dict, session_id: str, user_id: str, player_name: str, is_host: bool = False) -> bool:
    """Internal: Add a player to a room"""
    # Assign position (north, east, south, west for 4-player games)
    position_map = {
        0: 'north',
        1: 'east',
        2: 'south',
        3: 'west'
    }
    
    position = position_map.get(len(room['players']), None)
    
    # Assign team (alternating for 4-player partnership games)
    # Team 1: North & South, Team 2: East & West
    team = 'team1' if position in ['north', 'south'] else 'team2'
    
    room['players'][session_id] = {
        'session_id': session_id,
        'user_id': user_id,
        'name': player_name,
        'position': position,
        'team': team,
        'is_ready': is_host,  # Host is auto-ready
        'is_host': is_host,
        'is_active': True,
        'joined_at': datetime.now(timezone.utc).isoformat()
    }
    
    room['player_order'].append(session_id)
    return True


def join_room(room_code: str, session_id: str, user_id: str, player_name: str) -> Optional[Dict]:
    """Join an existing room (internal use - prefer invite system)"""
    if room_code not in game_rooms:
        return {'error': 'Room not found'}
    
    room = game_rooms[room_code]
    
    # Check if room is full
    if len(room['players']) >= room['max_players']:
        return {'error': 'Room is full'}
    
    # Check if game already started
    if room['state'] not in [RoomState.WAITING, RoomState.READY]:
        return {'error': 'Game already in progress'}
    
    # Check if player already in room
    if session_id in room['players']:
        return room
    
    # Add player
    _add_player_to_room(room, session_id, user_id, player_name)
    player_sessions[session_id] = room_code
    
    return room


def join_as_spectator(room_code: str, session_id: str, spectator_name: str) -> Optional[Dict]:
    """Join a room as a spectator"""
    if room_code not in game_rooms:
        return {'error': 'Room not found'}
    
    room = game_rooms[room_code]
    
    # Check if spectator slots full
    if len(room['spectators']) >= room['max_spectators']:
        return {'error': 'Spectator slots full'}
    
    # Add spectator
    room['spectators'].append({
        'session_id': session_id,
        'name': spectator_name,
        'joined_at': datetime.now(timezone.utc).isoformat()
    })
    
    player_sessions[session_id] = room_code
    
    return room


def set_player_ready(room_code: str, session_id: str, is_ready: bool = True) -> Optional[Dict]:
    """Mark a player as ready"""
    if room_code not in game_rooms:
        return None
    
    room = game_rooms[room_code]
    
    if session_id not in room['players']:
        return None
    
    room['players'][session_id]['is_ready'] = is_ready
    
    # Check if all players are ready
    if all(p['is_ready'] for p in room['players'].values()) and len(room['players']) == room['max_players']:
        room['state'] = RoomState.READY
    
    return room


def kick_player(room_code: str, host_session_id: str, player_session_id: str) -> Optional[Dict]:
    """Kick a player from the room (host only)"""
    if room_code not in game_rooms:
        return None
    
    room = game_rooms[room_code]
    
    # Verify requester is host
    if room['host_id'] != host_session_id:
        return {'error': 'Only host can kick players'}
    
    # Can't kick host
    if player_session_id == host_session_id:
        return {'error': 'Host cannot kick themselves'}
    
    # Remove player
    if player_session_id in room['players']:
        del room['players'][player_session_id]
        room['player_order'].remove(player_session_id)
        del player_sessions[player_session_id]
        
        # Reset ready state
        room['state'] = RoomState.WAITING
    
    return room


def leave_room(room_code: str, session_id: str) -> Optional[Dict]:
    """Leave a room"""
    if room_code not in game_rooms:
        return None
    
    room = game_rooms[room_code]
    
    # Remove player
    if session_id in room['players']:
        was_host = room['players'][session_id].get('is_host', False)
        
        del room['players'][session_id]
        room['player_order'].remove(session_id)
        del player_sessions[session_id]
        
        # If host left, assign new host
        if was_host and len(room['players']) > 0:
            new_host_id = room['player_order'][0]
            room['host_id'] = new_host_id
            room['players'][new_host_id]['is_host'] = True
        
        # Delete room if empty
        if len(room['players']) == 0:
            del game_rooms[room_code]
            return None
    
    # Remove spectator
    room['spectators'] = [s for s in room['spectators'] if s['session_id'] != session_id]
    
    if session_id in player_sessions:
        del player_sessions[session_id]
    
    return room


def start_game(room_code: str, host_session_id: str) -> Optional[Dict]:
    """Start the game (host only, all players must be ready)"""
    if room_code not in game_rooms:
        return None
    
    room = game_rooms[room_code]
    
    # Verify requester is host
    if room['host_id'] != host_session_id:
        return {'error': 'Only host can start the game'}
    
    # Verify all players ready
    if not all(p['is_ready'] for p in room['players'].values()):
        return {'error': 'Not all players are ready'}
    
    # Verify enough players
    if len(room['players']) < room['max_players']:
        return {'error': f'Need {room["max_players"]} players to start'}
    
    room['state'] = RoomState.PLAYING
    room['started_at'] = datetime.now(timezone.utc).isoformat()
    
    return room


def update_room_settings(room_code: str, host_session_id: str, settings: Dict) -> Optional[Dict]:
    """Update room settings (host only, before game starts)"""
    if room_code not in game_rooms:
        return None
    
    room = game_rooms[room_code]
    
    # Verify requester is host
    if room['host_id'] != host_session_id:
        return {'error': 'Only host can change settings'}
    
    # Can't change settings after game starts
    if room['state'] not in [RoomState.WAITING, RoomState.READY]:
        return {'error': 'Cannot change settings after game starts'}
    
    room['settings'].update(settings)
    
    return room


def get_room(room_code: str) -> Optional[Dict]:
    """Get room data"""
    return game_rooms.get(room_code)


def get_room_for_session(session_id: str) -> Optional[Dict]:
    """Get room for a specific session"""
    room_code = player_sessions.get(session_id)
    if room_code:
        return game_rooms.get(room_code)
    return None


def get_public_rooms(game_type: Optional[GameType] = None, skip_full: bool = True) -> List[Dict]:
    """Get list of public rooms (for matchmaking)"""
    rooms = []
    
    for room in game_rooms.values():
        # Filter by public visibility
        if not room['is_public']:
            continue
        
        # Filter by game type
        if game_type and room['game_type'] != game_type:
            continue
        
        # Skip full rooms
        if skip_full and len(room['players']) >= room['max_players']:
            continue
        
        # Skip games in progress
        if room['state'] not in [RoomState.WAITING, RoomState.READY]:
            continue
        
        # Return sanitized room data
        rooms.append({
            'room_code': room['room_code'],
            'game_type': room['game_type'],
            'player_count': len(room['players']),
            'max_players': room['max_players'],
            'host_name': room['players'][room['host_id']]['name'],
            'wager': room['settings']['wager'],
            'winning_score': room['settings']['winning_score'],
            'created_at': room['created_at']
        })
    
    return rooms


def add_chat_message(room_code: str, session_id: str, message: str) -> Optional[Dict]:
    """Add a chat message to the room"""
    if room_code not in game_rooms:
        return None
    
    room = game_rooms[room_code]
    
    # Get sender name
    sender_name = "Unknown"
    if session_id in room['players']:
        sender_name = room['players'][session_id]['name']
    else:
        for spectator in room['spectators']:
            if spectator['session_id'] == session_id:
                sender_name = f"{spectator['name']} (Spectator)"
                break
    
    chat_message = {
        'session_id': session_id,
        'sender_name': sender_name,
        'message': message,
        'timestamp': datetime.now(timezone.utc).isoformat()
    }
    
    room['chat_messages'].append(chat_message)
    
    # Keep only last 50 messages
    if len(room['chat_messages']) > 50:
        room['chat_messages'] = room['chat_messages'][-50:]
    
    return chat_message


def cleanup_disconnected_player(session_id: str) -> Optional[str]:
    """Remove player from room when they disconnect"""
    room_code = player_sessions.get(session_id)
    if room_code:
        leave_room(room_code, session_id)
    return room_code

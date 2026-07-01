"""
Matchmaking Queue System
Auto-matches players for multiplayer games (Bid Whist, Spades, Hearts, Poker)
Features: Quick match, skill-based (ELO), team formation
"""
from typing import Dict, List, Optional
from datetime import datetime, timezone
from enum import Enum
from services.room_manager import create_room, GameType

# In-memory matchmaking queues (Redis recommended for production)
matchmaking_queues: Dict[str, List[Dict]] = {
    GameType.BID_WHIST: [],
    GameType.SPADES: [],
    GameType.HEARTS: [],
    GameType.POKER: []
}

# Player session to queue mapping
player_queue_status: Dict[str, Dict] = {}  # session_id -> queue_info


class MatchmakingMode(str, Enum):
    QUICK_MATCH = "quick_match"  # Find any 3 players fast
    RANKED = "ranked"  # Skill-based ELO matching
    TEAM_FORMATION = "team_formation"  # Find partner first, then opponents


def join_matchmaking_queue(
    session_id: str,
    user_id: str,
    player_name: str,
    game_type: GameType,
    mode: MatchmakingMode = MatchmakingMode.QUICK_MATCH,
    elo_rating: int = 1000,
    wager: int = 0
) -> Dict:
    """Add player to matchmaking queue"""
    
    # Check if already in queue
    if session_id in player_queue_status:
        return {'error': 'Already in matchmaking queue'}
    
    # Create queue entry
    queue_entry = {
        'session_id': session_id,
        'user_id': user_id,
        'player_name': player_name,
        'elo_rating': elo_rating,
        'wager': wager,
        'mode': mode,
        'joined_at': datetime.now(timezone.utc).isoformat(),
        'joined_timestamp': datetime.now(timezone.utc).timestamp()
    }
    
    # Add to queue
    if game_type not in matchmaking_queues:
        matchmaking_queues[game_type] = []
    
    matchmaking_queues[game_type].append(queue_entry)
    player_queue_status[session_id] = {
        'game_type': game_type,
        'mode': mode,
        'position': len(matchmaking_queues[game_type])
    }
    
    # Try to match immediately
    match = try_create_match(game_type)
    
    if match:
        return {
            'status': 'matched',
            'room_code': match['room_code'],
            'players': match['players']
        }
    
    return {
        'status': 'queued',
        'position': len(matchmaking_queues[game_type]),
        'estimated_wait': estimate_wait_time(game_type)
    }


def try_create_match(game_type: GameType, required_players: int = 4) -> Optional[Dict]:
    """Attempt to create a match from queue"""
    
    if game_type not in matchmaking_queues:
        return None
    
    queue = matchmaking_queues[game_type]
    
    if len(queue) < required_players:
        return None
    
    # Quick match: Take first 4 players
    matched_players = queue[:required_players]
    
    # Remove matched players from queue
    for player in matched_players:
        queue.remove(player)
        if player['session_id'] in player_queue_status:
            del player_queue_status[player['session_id']]
    
    # Create room with first player as host
    host = matched_players[0]
    
    room = create_room(
        host_session_id=host['session_id'],
        host_user_id=host['user_id'],
        host_name=host['player_name'],
        game_type=game_type,
        max_players=required_players,
        is_public=False,  # Matchmade rooms are private
        wager=host['wager']
    )
    
    return {
        'room_code': room['room_code'],
        'room': room,
        'players': matched_players
    }


def try_create_ranked_match(game_type: GameType, required_players: int = 4) -> Optional[Dict]:
    """Create skill-based match using ELO ratings"""
    
    if game_type not in matchmaking_queues:
        return None
    
    queue = matchmaking_queues[game_type]
    
    # Filter for ranked mode players
    ranked_players = [p for p in queue if p['mode'] == MatchmakingMode.RANKED]
    
    if len(ranked_players) < required_players:
        return None
    
    # Sort by ELO rating
    ranked_players.sort(key=lambda p: p['elo_rating'])
    
    # Find best match (players with similar ELO)
    best_match = None
    min_elo_spread = float('inf')
    
    # Try different combinations
    for i in range(len(ranked_players) - required_players + 1):
        group = ranked_players[i:i+required_players]
        elo_spread = max(p['elo_rating'] for p in group) - min(p['elo_rating'] for p in group)
        
        if elo_spread < min_elo_spread:
            min_elo_spread = elo_spread
            best_match = group
        
        # Accept if spread is reasonable (within 200 ELO)
        if elo_spread <= 200:
            best_match = group
            break
    
    if not best_match:
        return None
    
    # Remove matched players from queue
    for player in best_match:
        queue.remove(player)
        if player['session_id'] in player_queue_status:
            del player_queue_status[player['session_id']]
    
    # Create room
    host = best_match[0]
    
    room = create_room(
        host_session_id=host['session_id'],
        host_user_id=host['user_id'],
        host_name=host['player_name'],
        game_type=game_type,
        max_players=required_players,
        is_public=False,
        wager=host['wager']
    )
    
    return {
        'room_code': room['room_code'],
        'room': room,
        'players': best_match,
        'elo_spread': min_elo_spread
    }


def leave_matchmaking_queue(session_id: str) -> bool:
    """Remove player from matchmaking queue"""
    
    if session_id not in player_queue_status:
        return False
    
    queue_info = player_queue_status[session_id]
    game_type = queue_info['game_type']
    
    # Remove from queue
    if game_type in matchmaking_queues:
        matchmaking_queues[game_type] = [
            p for p in matchmaking_queues[game_type] 
            if p['session_id'] != session_id
        ]
    
    # Remove from status
    del player_queue_status[session_id]
    
    return True


def get_queue_status(session_id: str) -> Optional[Dict]:
    """Get player's current queue status"""
    
    if session_id not in player_queue_status:
        return None
    
    queue_info = player_queue_status[session_id]
    game_type = queue_info['game_type']
    
    # Find position in queue
    queue = matchmaking_queues.get(game_type, [])
    position = None
    
    for i, player in enumerate(queue):
        if player['session_id'] == session_id:
            position = i + 1
            break
    
    return {
        'game_type': game_type,
        'mode': queue_info['mode'],
        'position': position,
        'queue_size': len(queue),
        'estimated_wait': estimate_wait_time(game_type)
    }


def get_all_queues_status() -> Dict:
    """Get status of all matchmaking queues"""
    
    status = {}
    
    for game_type, queue in matchmaking_queues.items():
        status[game_type] = {
            'players_waiting': len(queue),
            'modes': {
                'quick_match': len([p for p in queue if p['mode'] == MatchmakingMode.QUICK_MATCH]),
                'ranked': len([p for p in queue if p['mode'] == MatchmakingMode.RANKED]),
                'team_formation': len([p for p in queue if p['mode'] == MatchmakingMode.TEAM_FORMATION])
            }
        }
    
    return status


def estimate_wait_time(game_type: GameType) -> int:
    """Estimate wait time in seconds based on queue size and historical data"""
    
    queue = matchmaking_queues.get(game_type, [])
    queue_size = len(queue)
    
    if queue_size >= 4:
        return 5  # Match imminent
    elif queue_size == 3:
        return 30  # Need 1 more player
    elif queue_size == 2:
        return 60  # Need 2 more players
    else:
        return 120  # Need 3+ players
    
    # TODO: Use historical match times for more accurate estimates


def cleanup_stale_queue_entries(max_age_seconds: int = 300):
    """Remove players who've been in queue too long (5 minutes default)"""
    
    now = datetime.now(timezone.utc).timestamp()
    
    for game_type, queue in matchmaking_queues.items():
        stale_players = []
        
        for player in queue:
            age = now - player['joined_timestamp']
            if age > max_age_seconds:
                stale_players.append(player)
        
        # Remove stale entries
        for player in stale_players:
            queue.remove(player)
            if player['session_id'] in player_queue_status:
                del player_queue_status[player['session_id']]


def force_match_if_possible(game_type: GameType) -> Optional[Dict]:
    """Force create a match even with mixed modes (fallback for long waits)"""
    
    queue = matchmaking_queues.get(game_type, [])
    
    if len(queue) >= 4:
        # Take any 4 players regardless of mode
        return try_create_match(game_type)
    
    return None

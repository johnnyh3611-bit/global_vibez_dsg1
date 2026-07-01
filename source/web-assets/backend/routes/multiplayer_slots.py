"""
Multiplayer Celestial Slots
Real-time multiplayer slots with shared jackpots and team bonuses
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from uuid import uuid4
import secrets

secure_random = secrets.SystemRandom()

router = APIRouter()

# Active WebSocket connections per room
active_rooms: Dict[str, Dict[str, WebSocket]] = {}

# Shared jackpot pools per room
jackpot_pools: Dict[str, int] = {}

# Pydantic Models
class JoinRoomRequest(BaseModel):
    user_id: str
    username: str
    room_id: str

class MultiplayerSpinRequest(BaseModel):
    user_id: str
    username: str
    room_id: str
    bet_amount: int
    team_id: Optional[str] = None  # For team bonuses

class RoomInfo(BaseModel):
    room_id: str
    name: str
    players_count: int
    jackpot_amount: int
    min_bet: int
    max_bet: int
    is_full: bool

# Celestial Slots Symbols (same as single-player)
SYMBOLS = {
    'MIDNIGHT_WILD': {'emoji': '💎', 'payout_multiplier': 0, 'is_wild': True, 'rarity': 0.05},
    'CELESTIAL_CROWN': {'emoji': '👑', 'payout_multiplier': 500, 'is_wild': False, 'rarity': 0.02},
    'HEART_VIBE': {'emoji': '💝', 'payout_multiplier': 100, 'is_wild': False, 'rarity': 0.08},
    'DICE_PAIR': {'emoji': '🎲', 'payout_multiplier': 50, 'is_wild': False, 'rarity': 0.15},
    'LIVE_STREAM': {'emoji': '📺', 'payout_multiplier': 25, 'is_wild': False, 'rarity': 0.20},
    'CHERRY': {'emoji': '🍒', 'payout_multiplier': 10, 'is_wild': False, 'rarity': 0.25},
    'STAR': {'emoji': '⭐', 'payout_multiplier': 15, 'is_wild': False, 'rarity': 0.25}
}

# Default rooms
DEFAULT_ROOMS = [
    {'room_id': 'cosmic_lounge', 'name': 'Cosmic Lounge', 'min_bet': 50, 'max_bet': 500, 'max_players': 10},
    {'room_id': 'high_rollers', 'name': 'High Rollers VIP', 'min_bet': 500, 'max_bet': 5000, 'max_players': 6},
    {'room_id': 'dating_bonus_room', 'name': 'Dating Bonus Special', 'min_bet': 50, 'max_bet': 500, 'max_players': 8}
]

def initialize_room(room_id: str):
    """Initialize room if not exists"""
    if room_id not in active_rooms:
        active_rooms[room_id] = {}
    if room_id not in jackpot_pools:
        jackpot_pools[room_id] = 5000  # Starting jackpot

def generate_weighted_symbol():
    """Generate a symbol based on weighted rarity"""
    rand = secure_random.random()
    cumulative = 0
    
    for symbol_key, symbol_data in SYMBOLS.items():
        cumulative += symbol_data['rarity']
        if rand <= cumulative:
            return symbol_key
    
    return 'CHERRY'

def calculate_payline_win(symbols: List[str], bet_amount: int):
    """Calculate payout for a single payline"""
    symbol_counts = {}
    wild_count = 0
    
    for symbol in symbols:
        if SYMBOLS[symbol]['is_wild']:
            wild_count += 1
        else:
            symbol_counts[symbol] = symbol_counts.get(symbol, 0) + 1
    
    if not symbol_counts:
        return 0, None
    
    max_symbol = max(symbol_counts, key=symbol_counts.get)
    max_count = symbol_counts[max_symbol] + wild_count
    
    if max_count >= 3:
        multiplier = SYMBOLS[max_symbol]['payout_multiplier']
        
        if max_count == 4:
            multiplier *= 2
        elif max_count == 5:
            multiplier *= 5
        
        return bet_amount * multiplier, max_symbol
    
    return 0, None

def calculate_team_bonus(room_id: str, team_id: Optional[str]) -> float:
    """Calculate team multiplier based on active team members in room"""
    if not team_id:
        return 1.0
    
    # Count team members in room
    team_members_count = 0
    if room_id in active_rooms:
        # In a real implementation, you'd track team_id per connection
        # For now, simplified: more players = higher bonus
        team_members_count = len(active_rooms[room_id])
    
    # Team bonus: 1.1x for 2 players, 1.2x for 3+, 1.3x for 5+
    if team_members_count >= 5:
        return 1.3
    elif team_members_count >= 3:
        return 1.2
    elif team_members_count >= 2:
        return 1.1
    
    return 1.0

async def broadcast_to_room(room_id: str, message: dict) -> Dict[str, Any]:
    """Broadcast message to all players in room"""
    if room_id not in active_rooms:
        return
    
    dead_connections = []
    for user_id, websocket in active_rooms[room_id].items():
        try:
            await websocket.send_json(message)
        except Exception:
            dead_connections.append(user_id)
    
    # Clean up dead connections
    for user_id in dead_connections:
        if user_id in active_rooms[room_id]:
            del active_rooms[room_id][user_id]

# ========== HTTP ENDPOINTS ==========

@router.get("/multiplayer-slots/rooms")
async def get_available_rooms() -> Dict[str, Any]:
    """Get list of available multiplayer slots rooms"""
    rooms = []
    
    for room_config in DEFAULT_ROOMS:
        room_id = room_config['room_id']
        initialize_room(room_id)
        
        players_count = len(active_rooms.get(room_id, {}))
        is_full = players_count >= room_config['max_players']
        
        rooms.append({
            'room_id': room_id,
            'name': room_config['name'],
            'players_count': players_count,
            'max_players': room_config['max_players'],
            'jackpot_amount': jackpot_pools.get(room_id, 5000),
            'min_bet': room_config['min_bet'],
            'max_bet': room_config['max_bet'],
            'is_full': is_full
        })
    
    return {'success': True, 'rooms': rooms}

@router.post("/multiplayer-slots/spin")
async def multiplayer_spin(request: MultiplayerSpinRequest) -> Dict[str, Any]:
    """
    Execute a spin in multiplayer mode
    
    Features:
    - Contributes to shared jackpot pool (10% of bet)
    - Team bonus multiplier
    - Broadcasts spin result to all room players
    - Progressive jackpot win detection
    """
    try:
        room_id = request.room_id
        initialize_room(room_id)
        
        # Validate bet amount
        room_config = next((r for r in DEFAULT_ROOMS if r['room_id'] == room_id), None)
        if not room_config:
            raise HTTPException(status_code=404, detail="Room not found")
        
        if request.bet_amount < room_config['min_bet'] or request.bet_amount > room_config['max_bet']:
            raise HTTPException(
                status_code=400, 
                detail=f"Bet must be between ₵{room_config['min_bet']} and ₵{room_config['max_bet']}"
            )
        
        # Contribute 10% of bet to shared jackpot
        jackpot_contribution = int(request.bet_amount * 0.1)
        jackpot_pools[room_id] = jackpot_pools.get(room_id, 5000) + jackpot_contribution
        
        # Generate 5 symbols
        symbols = [generate_weighted_symbol() for _ in range(5)]
        
        # Calculate base payout
        base_payout, winning_symbol = calculate_payline_win(symbols, request.bet_amount)
        
        # Calculate team bonus
        team_multiplier = calculate_team_bonus(room_id, request.team_id)
        
        # Apply team multiplier
        final_payout = int(base_payout * team_multiplier)
        
        # Check for jackpot (5 Celestial Crowns wins progressive jackpot)
        crown_count = symbols.count('CELESTIAL_CROWN')
        is_jackpot = crown_count >= 5
        jackpot_win = 0
        
        if is_jackpot:
            jackpot_win = jackpot_pools[room_id]
            final_payout += jackpot_win
            jackpot_pools[room_id] = 5000  # Reset jackpot
        
        # Create spin result
        spin_result = {
            'spin_id': str(uuid4()),
            'user_id': request.user_id,
            'username': request.username,
            'room_id': room_id,
            'symbols': symbols,
            'base_payout': base_payout,
            'team_multiplier': team_multiplier,
            'final_payout': final_payout,
            'is_jackpot': is_jackpot,
            'jackpot_win': jackpot_win,
            'jackpot_pool_after': jackpot_pools[room_id],
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
        # Broadcast spin to all room players
        await broadcast_to_room(room_id, {
            'type': 'player_spin',
            'data': spin_result
        })
        
        # If jackpot won, broadcast celebration
        if is_jackpot:
            await broadcast_to_room(room_id, {
                'type': 'jackpot_won',
                'data': {
                    'winner': request.username,
                    'amount': jackpot_win
                }
            })
        
        return {'success': True, 'result': spin_result}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ========== WEBSOCKET ENDPOINT ==========

@router.websocket("/ws/multiplayer-slots/{room_id}")
async def multiplayer_slots_websocket(websocket: WebSocket, room_id: str) -> Dict[str, Any]:
    """
    WebSocket for real-time multiplayer slots
    
    Events:
    - join: Player joins room
    - spin: Player spins (broadcasts to all)
    - jackpot_update: Jackpot pool updated
    - player_left: Player leaves room
    """
    await websocket.accept()
    
    user_id = None
    
    try:
        # Wait for join message
        join_msg = await websocket.receive_json()
        
        if join_msg.get('type') != 'join':
            await websocket.close(code=1003, reason="Expected 'join' message")
            return
        
        user_id = join_msg.get('user_id')
        username = join_msg.get('username', 'Anonymous')
        
        # Initialize room
        initialize_room(room_id)
        
        # Add player to room
        active_rooms[room_id][user_id] = websocket
        
        # Notify player of join success
        await websocket.send_json({
            'type': 'joined',
            'data': {
                'room_id': room_id,
                'players_count': len(active_rooms[room_id]),
                'jackpot_amount': jackpot_pools[room_id]
            }
        })
        
        # Broadcast new player joined
        await broadcast_to_room(room_id, {
            'type': 'player_joined',
            'data': {
                'user_id': user_id,
                'username': username,
                'players_count': len(active_rooms[room_id])
            }
        })
        
        # Listen for messages
        while True:
            message = await websocket.receive_json()
            
            if message.get('type') == 'ping':
                await websocket.send_json({'type': 'pong'})
            
            elif message.get('type') == 'get_jackpot':
                await websocket.send_json({
                    'type': 'jackpot_update',
                    'data': {'jackpot_amount': jackpot_pools[room_id]}
                })
    
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        # Remove player from room
        if user_id and room_id in active_rooms and user_id in active_rooms[room_id]:
            del active_rooms[room_id][user_id]
            
            # Broadcast player left
            await broadcast_to_room(room_id, {
                'type': 'player_left',
                'data': {
                    'user_id': user_id,
                    'players_count': len(active_rooms[room_id])
                }
            })

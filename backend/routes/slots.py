from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
from datetime import datetime, timezone
from uuid import uuid4
import secrets
from services.game_economy_constants import PLATFORM_MIN_BET, format_coins
secure_random = secrets.SystemRandom()

router = APIRouter()

# Pydantic Models
class SpinRequest(BaseModel):
    user_id: str
    bet_amount: int
    auto_spin: bool = False

class SpinResult(BaseModel):
    spin_id: str
    symbols: List[str]
    paylines: List[dict]
    base_payout: int
    dating_multiplier: float
    final_payout: int
    is_jackpot: bool
    nearby_matches: List[dict]
    timestamp: str

# Celestial Slots Symbols (based on vision doc)
SYMBOLS = {
    'MIDNIGHT_WILD': {
        'name': 'Midnight Wild',
        'emoji': '💎',
        'payout_multiplier': 0,  # Wild substitutes
        'is_wild': True,
        'rarity': 0.05  # 5% chance
    },
    'CELESTIAL_CROWN': {
        'name': 'Celestial Crown',
        'emoji': '👑',
        'payout_multiplier': 500,
        'is_wild': False,
        'rarity': 0.02  # 2% chance (jackpot)
    },
    'HEART_VIBE': {
        'name': 'Heart Vibe',
        'emoji': '💝',
        'payout_multiplier': 100,
        'is_wild': False,
        'rarity': 0.08,  # 8% chance
        'triggers_dating_bonus': True
    },
    'DICE_PAIR': {
        'name': 'Dice Pair',
        'emoji': '🎲',
        'payout_multiplier': 50,
        'is_wild': False,
        'rarity': 0.15  # 15% chance
    },
    'LIVE_STREAM': {
        'name': 'Live Stream',
        'emoji': '📺',
        'payout_multiplier': 25,
        'is_wild': False,
        'rarity': 0.20,  # 20% chance
        'triggers_free_spins': True
    },
    'CHERRY': {
        'name': 'Cherry',
        'emoji': '🍒',
        'payout_multiplier': 10,
        'is_wild': False,
        'rarity': 0.25  # 25% chance (common)
    },
    'STAR': {
        'name': 'Star',
        'emoji': '⭐',
        'payout_multiplier': 15,
        'is_wild': False,
        'rarity': 0.25  # 25% chance (common)
    }
}

# Mock nearby players for dating bonus (replace with actual social logic)
def get_nearby_vibe_matches(user_id: str):
    """Get nearby players with compatibility scores"""
    # In production, this would query MongoDB for players in same room
    # and return their compatibility scores from the dating algorithm
    return [
        {'user_id': 'match1', 'username': 'Alex', 'compatibility_score': 85},
        {'user_id': 'match2', 'username': 'Jordan', 'compatibility_score': 72}
    ]

def generate_weighted_symbol():
    """Generate a symbol based on weighted rarity"""
    rand = secure_random.random()
    cumulative = 0
    
    for symbol_key, symbol_data in SYMBOLS.items():
        cumulative += symbol_data['rarity']
        if rand <= cumulative:
            return symbol_key
    
    # Fallback to most common
    return 'CHERRY'

def calculate_payline_win(symbols: List[str], bet_amount: int):
    """Calculate payout for a single payline"""
    # Count symbol occurrences (treating wilds as any symbol)
    symbol_counts = {}
    wild_count = 0
    
    for symbol in symbols:
        if SYMBOLS[symbol]['is_wild']:
            wild_count += 1
        else:
            symbol_counts[symbol] = symbol_counts.get(symbol, 0) + 1
    
    # Find the most common non-wild symbol
    if not symbol_counts:
        return 0, None
    
    max_symbol = max(symbol_counts, key=symbol_counts.get)
    max_count = symbol_counts[max_symbol] + wild_count
    
    # Require at least 3 matching symbols
    if max_count >= 3:
        multiplier = SYMBOLS[max_symbol]['payout_multiplier']
        
        # Bonus for 4 or 5 matches
        if max_count == 4:
            multiplier *= 2
        elif max_count == 5:
            multiplier *= 5
        
        return bet_amount * multiplier, max_symbol
    
    return 0, None

def calculate_dating_multiplier(user_id: str, symbols: List[str]):
    """Calculate dating proximity bonus"""
    nearby_matches = get_nearby_vibe_matches(user_id)
    
    if not nearby_matches:
        return 1.0, []
    
    # Check if Heart Vibe symbol landed (triggers dating bonus)
    has_heart_vibe = 'HEART_VIBE' in symbols
    
    if has_heart_vibe:
        # Get highest compatibility score
        max_compatibility = max([m['compatibility_score'] for m in nearby_matches])
        # Apply 1.1x - 1.5x multiplier based on compatibility
        multiplier = 1 + (max_compatibility / 200)  # 85 score = 1.425x
        return multiplier, nearby_matches
    
    # Even without Heart Vibe, small bonus if matches nearby
    if len(nearby_matches) > 0:
        return 1.05, nearby_matches  # 5% bonus for social presence
    
    return 1.0, []

@router.post("/slots/spin")
async def spin_slots(request: SpinRequest) -> Dict[str, Any]:
    """
    Spin the Celestial Slots
    
    Returns spin result with:
    - Generated symbols
    - Base payout
    - Dating proximity multiplier
    - Final payout
    """
    try:
        # Validate bet amount — 50-coin platform floor + 1000-coin per-spin ceiling.
        if request.bet_amount < PLATFORM_MIN_BET or request.bet_amount > 1000:
            raise HTTPException(
                status_code=400,
                detail=f"Bet must be between {format_coins(PLATFORM_MIN_BET)} and {format_coins(1000)}",
            )
        
        # Generate 5 symbols for the slot machine
        symbols = [generate_weighted_symbol() for _ in range(5)]
        
        # Calculate base payout
        base_payout, winning_symbol = calculate_payline_win(symbols, request.bet_amount)
        
        # Calculate dating proximity bonus
        dating_multiplier, nearby_matches = calculate_dating_multiplier(request.user_id, symbols)
        
        # Apply dating multiplier
        final_payout = int(base_payout * dating_multiplier)
        
        # Check for jackpot (3+ Celestial Crowns)
        crown_count = symbols.count('CELESTIAL_CROWN')
        is_jackpot = crown_count >= 3
        
        # Build payline info
        paylines = []
        if base_payout > 0:
            paylines.append({
                'line': 1,
                'symbols': symbols,
                'winning_symbol': winning_symbol,
                'payout': base_payout,
                'multiplier': dating_multiplier
            })
        
        with open("/tmp/slots_err.log", "a") as _f:
            _f.write(f"BEFORE_RESULT base={base_payout} mult={dating_multiplier} final={final_payout} jp={is_jackpot} matches={len(nearby_matches)}\n")
        result = SpinResult(
            spin_id=str(uuid4()),
            symbols=symbols,
            paylines=paylines,
            base_payout=base_payout,
            dating_multiplier=dating_multiplier,
            final_payout=final_payout,
            is_jackpot=is_jackpot,
            nearby_matches=[
                {'username': m['username'], 'compatibility': m['compatibility_score']}
                for m in nearby_matches
            ],
            timestamp=datetime.now(timezone.utc).isoformat()
        )
        return result.model_dump()
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/slots/paytable")
async def get_paytable() -> Dict[str, Any]:
    """Get the slots paytable information"""
    return {
        'symbols': {
            key: {
                'name': val['name'],
                'emoji': val['emoji'],
                'payout_3x': val['payout_multiplier'],
                'payout_4x': val['payout_multiplier'] * 2,
                'payout_5x': val['payout_multiplier'] * 5,
                'is_wild': val.get('is_wild', False),
                'special': val.get('triggers_dating_bonus', False) or val.get('triggers_free_spins', False)
            }
            for key, val in SYMBOLS.items()
        },
        'dating_bonus': {
            'description': 'Land Heart Vibe with compatible players nearby',
            'multiplier_range': '1.1x - 1.5x',
            'social_presence_bonus': '1.05x'
        }
    }


@router.get("/slots/stats/{user_id}")
async def get_user_stats(user_id: str) -> Dict[str, Any]:
    """Get user's slots statistics"""
    # In production, query from MongoDB
    return {
        'total_spins': 0,
        'total_wagered': 0,
        'total_won': 0,
        'biggest_win': 0,
        'jackpots': 0,
        'dating_bonuses_triggered': 0
    }

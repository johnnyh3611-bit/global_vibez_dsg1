"""
Spectator Betting & Advanced Features
Handles live odds, spectator bets, and skill-based matchmaking
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
import random
from datetime import datetime

router = APIRouter()

# Spectator bets storage
SPECTATOR_BETS = {}
SPECTATOR_POTS = {}

class SpectatorBetRequest(BaseModel):
    table_id: str
    spectator_id: str
    amount: float
    prediction: str  # e.g., "player_1_wins", "next_card_red", "total_turns_under_10"

class SkillMatchRequest(BaseModel):
    player_id: str
    game_type: str
    preferred_skill_range: Optional[int] = 100  # ELO range tolerance

# ============================================================================
# SPECTATOR BETTING
# ============================================================================

@router.post("/spectator/bet")
async def place_spectator_bet(request: SpectatorBetRequest) -> Dict[str, Any]:
    """
    Allow spectators to bet on game outcomes
    """
    if request.table_id not in SPECTATOR_POTS:
        SPECTATOR_POTS[request.table_id] = {
            "total_pot": 0.0,
            "bets": []
        }
    
    # Calculate live odds based on game state
    odds = calculate_live_odds(request.table_id, request.prediction)
    
    bet = {
        "bet_id": f"bet_{len(SPECTATOR_BETS)}",
        "spectator_id": request.spectator_id,
        "amount": request.amount,
        "prediction": request.prediction,
        "odds": odds,
        "potential_payout": request.amount * odds,
        "timestamp": datetime.now().isoformat()
    }
    
    SPECTATOR_BETS[bet["bet_id"]] = bet
    SPECTATOR_POTS[request.table_id]["total_pot"] += request.amount
    SPECTATOR_POTS[request.table_id]["bets"].append(bet)
    
    return {
        "status": "BET_LOCKED",
        "bet_id": bet["bet_id"],
        "odds": odds,
        "potential_payout": bet["potential_payout"],
        "message": f"Bet placed! Potential win: {bet['potential_payout']} GV Coins"
    }

@router.get("/spectator/pot/{table_id}")
async def get_spectator_pot(table_id: str) -> Dict[str, Any]:
    """Get current spectator pot for a table"""
    pot = SPECTATOR_POTS.get(table_id, {"total_pot": 0.0, "bets": []})
    
    return {
        "table_id": table_id,
        "total_pot": pot["total_pot"],
        "bet_count": len(pot["bets"]),
        "top_bets": sorted(pot["bets"], key=lambda x: x["amount"], reverse=True)[:5]
    }

@router.post("/spectator/payout/{table_id}")
async def distribute_spectator_winnings(table_id: str, winning_prediction: str) -> Dict[str, Any]:
    """
    Distribute winnings to spectators who bet correctly
    """
    if table_id not in SPECTATOR_POTS:
        raise HTTPException(status_code=404, detail="No bets for this table")
    
    pot = SPECTATOR_POTS[table_id]
    winners = [bet for bet in pot["bets"] if bet["prediction"] == winning_prediction]
    
    payouts = []
    for winner in winners:
        payout = {
            "spectator_id": winner["spectator_id"],
            "payout": winner["potential_payout"],
            "original_bet": winner["amount"]
        }
        payouts.append(payout)
    
    # Clear the pot
    SPECTATOR_POTS[table_id] = {"total_pot": 0.0, "bets": []}
    
    return {
        "status": "PAYOUTS_DISTRIBUTED",
        "winners_count": len(winners),
        "total_distributed": sum(p["payout"] for p in payouts),
        "payouts": payouts
    }

# ============================================================================
# LIVE ODDS CALCULATION
# ============================================================================

def calculate_live_odds(table_id: str, prediction: str) -> float:
    """
    Calculate odds based on current game state
    For demo: returns random odds between 1.5x and 10x
    In production: analyze table state (cards remaining, player positions, etc.)
    """
    # Simple odds based on prediction type
    if "wins" in prediction:
        return round(random.uniform(1.5, 5.0), 2)
    elif "next_card" in prediction:
        return round(random.uniform(2.0, 8.0), 2)
    elif "total" in prediction:
        return round(random.uniform(3.0, 10.0), 2)
    
    return 2.0  # Default 2x odds

# ============================================================================
# SKILL-BASED MATCHMAKING
# ============================================================================

PLAYER_ELO = {}  # player_id -> ELO rating
MATCHMAKING_QUEUE = []

@router.post("/matchmaking/find")
async def find_skill_match(request: SkillMatchRequest) -> Dict[str, Any]:
    """
    Find opponents with similar skill level (ELO)
    """
    player_elo = PLAYER_ELO.get(request.player_id, 1200)  # Default ELO: 1200
    
    # Find players in queue with similar ELO
    matches = [
        player for player in MATCHMAKING_QUEUE
        if abs(player["elo"] - player_elo) <= request.preferred_skill_range
        and player["game_type"] == request.game_type
        and player["player_id"] != request.player_id
    ]
    
    if matches:
        # Found a match!
        opponent = matches[0]
        MATCHMAKING_QUEUE.remove(opponent)
        
        return {
            "status": "MATCH_FOUND",
            "opponent_id": opponent["player_id"],
            "opponent_elo": opponent["elo"],
            "elo_difference": abs(player_elo - opponent["elo"]),
            "recommended_table": f"skill_match_{request.player_id}_{opponent['player_id']}"
        }
    else:
        # Add to queue
        MATCHMAKING_QUEUE.append({
            "player_id": request.player_id,
            "elo": player_elo,
            "game_type": request.game_type,
            "joined_at": datetime.now().isoformat()
        })
        
        return {
            "status": "QUEUED",
            "position": len(MATCHMAKING_QUEUE),
            "your_elo": player_elo,
            "message": "Searching for opponents with similar skill..."
        }

@router.get("/matchmaking/elo/{player_id}")
async def get_player_elo(player_id: str) -> Dict[str, Any]:
    """Get player's ELO rating"""
    elo = PLAYER_ELO.get(player_id, 1200)
    
    # Calculate tier
    if elo >= 2000:
        tier = "Master"
    elif elo >= 1600:
        tier = "Diamond"
    elif elo >= 1200:
        tier = "Platinum"
    else:
        tier = "Bronze"
    
    return {
        "player_id": player_id,
        "elo": elo,
        "tier": tier
    }

@router.post("/matchmaking/update-elo")
async def update_elo(player_id: str, won: bool, opponent_elo: int) -> Dict[str, Any]:
    """
    Update ELO after a match (K-factor = 32)
    """
    current_elo = PLAYER_ELO.get(player_id, 1200)
    
    # Expected score
    expected = 1 / (1 + 10 ** ((opponent_elo - current_elo) / 400))
    
    # Actual score
    actual = 1.0 if won else 0.0
    
    # New ELO
    k_factor = 32
    new_elo = round(current_elo + k_factor * (actual - expected))
    
    PLAYER_ELO[player_id] = new_elo
    change = new_elo - current_elo
    
    return {
        "old_elo": current_elo,
        "new_elo": new_elo,
        "change": change,
        "message": f"ELO {'increased' if change > 0 else 'decreased'} by {abs(change)}"
    }

# ============================================================================
# RANDOM JACKPOT TRIGGER
# ============================================================================

@router.get("/jackpot/check/{table_id}")
async def check_random_jackpot(table_id: str, total_activity: int = 0) -> Dict[str, Any]:
    """
    Check if random community jackpot triggers
    Higher activity = higher chance
    """
    threshold = max(100, 1000 - total_activity)
    roll = random.randint(1, 1000)
    
    if roll >= threshold:
        jackpot_amount = random.randint(5000, 50000)
        
        return {
            "triggered": True,
            "jackpot_amount": jackpot_amount,
            "message": f"🎰 COMMUNITY JACKPOT! {jackpot_amount} GV Coins!"
        }
    
    return {
        "triggered": False,
        "next_check_in": 10  # seconds
    }

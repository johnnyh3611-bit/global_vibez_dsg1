"""
Community Slots & Random Jackpots
Shared jackpot system with social pot contributions
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import List, Dict, Any
import secrets
from datetime import datetime

router = APIRouter()

# Slot aisles (groups of slot machines)
SLOT_AISLES = {}
COMMUNITY_POTS = {}
ACTIVE_PLAYERS = {}

class SlotSpinRequest(BaseModel):
    player_id: str
    aisle_id: str
    bet_amount: float

class SlotResult(BaseModel):
    reels: List[str]
    payout: float
    social_pot_contribution: float
    jackpot_triggered: bool

# Slot symbols and their values
SLOT_SYMBOLS = {
    "7": {"value": 100, "weight": 1},
    "BAR": {"value": 50, "weight": 2},
    "CHERRY": {"value": 20, "weight": 5},
    "LEMON": {"value": 10, "weight": 10},
    "ORANGE": {"value": 10, "weight": 10},
    "PLUM": {"value": 15, "weight": 8},
    "BELL": {"value": 25, "weight": 6},
    "STAR": {"value": 30, "weight": 4}
}

# ============================================================================
# SLOT MACHINE LOGIC
# ============================================================================

@router.post("/slots/machine/spin")
async def spin_slot_machine(request: SlotSpinRequest) -> Dict[str, Any]:
    """
    Spin a slot machine in a specific aisle
    2% of bet goes to community pot
    """
    # Initialize aisle pot if needed
    if request.aisle_id not in COMMUNITY_POTS:
        COMMUNITY_POTS[request.aisle_id] = {
            "total": 0.0,
            "contributors": []
        }
    
    # Generate reel outcome (5 reels)
    reels = generate_reel_outcome()
    
    # Calculate payout
    payout = calculate_slot_payout(reels, request.bet_amount)
    
    # Contribute to social pot (2% of bet)
    social_contribution = request.bet_amount * 0.02
    COMMUNITY_POTS[request.aisle_id]["total"] += social_contribution
    
    if request.player_id not in COMMUNITY_POTS[request.aisle_id]["contributors"]:
        COMMUNITY_POTS[request.aisle_id]["contributors"].append(request.player_id)
    
    # Check for random community jackpot
    total_activity = len(COMMUNITY_POTS[request.aisle_id]["contributors"])
    jackpot_triggered = check_random_jackpot(total_activity)
    
    result = {
        "reels": reels,
        "payout": payout,
        "social_pot_contribution": social_contribution,
        "current_social_pot": COMMUNITY_POTS[request.aisle_id]["total"],
        "jackpot_triggered": jackpot_triggered,
        "net_result": payout - request.bet_amount
    }
    
    if jackpot_triggered:
        # Distribute community pot to all active players in aisle
        jackpot_share = distribute_community_jackpot(request.aisle_id)
        result["jackpot_share"] = jackpot_share
        result["jackpot_message"] = f"🎰 COMMUNITY JACKPOT! You won {jackpot_share} GV Coins!"
    
    return result

@router.get("/slots/aisle/{aisle_id}/pot")
async def get_community_pot(aisle_id: str) -> Dict[str, Any]:
    """Get current community pot for an aisle"""
    pot = COMMUNITY_POTS.get(aisle_id, {"total": 0.0, "contributors": []})
    
    return {
        "aisle_id": aisle_id,
        "total_pot": pot["total"],
        "contributor_count": len(pot["contributors"]),
        "pot_level": get_pot_level(pot["total"])
    }

@router.post("/slots/aisle/{aisle_id}/join")
async def join_slot_aisle(aisle_id: str, player_id: str) -> Dict[str, Any]:
    """Join a slot aisle to participate in community jackpots"""
    if aisle_id not in SLOT_AISLES:
        SLOT_AISLES[aisle_id] = {
            "players": [],
            "created_at": datetime.now().isoformat()
        }
    
    if player_id not in SLOT_AISLES[aisle_id]["players"]:
        SLOT_AISLES[aisle_id]["players"].append(player_id)
    
    return {
        "success": True,
        "aisle_id": aisle_id,
        "active_players": len(SLOT_AISLES[aisle_id]["players"]),
        "current_pot": COMMUNITY_POTS.get(aisle_id, {"total": 0.0})["total"]
    }

# ============================================================================
# JACKPOT MECHANICS
# ============================================================================

def check_random_jackpot(total_activity: int) -> bool:
    """
    Random jackpot trigger
    Higher activity = higher chance
    """
    threshold = max(100, 1000 - (total_activity * 10))
    roll = secrets.randbelow(1, 1000)
    
    return roll >= threshold

def distribute_community_jackpot(aisle_id: str) -> float:
    """
    Distribute community pot to all contributors
    """
    if aisle_id not in COMMUNITY_POTS:
        return 0.0
    
    pot = COMMUNITY_POTS[aisle_id]
    total = pot["total"]
    contributors = pot["contributors"]
    
    if not contributors:
        return 0.0
    
    # Split evenly among all contributors
    share_per_player = total / len(contributors)
    
    # Reset pot
    COMMUNITY_POTS[aisle_id] = {
        "total": 0.0,
        "contributors": []
    }
    
    return round(share_per_player, 2)

def generate_reel_outcome() -> List[str]:
    """Generate weighted random outcome for 5 reels"""
    symbols = list(SLOT_SYMBOLS.keys())
    weights = [SLOT_SYMBOLS[s]["weight"] for s in symbols]
    
    return secrets.choice(symbols, weights=weights, k=5)

def calculate_slot_payout(reels: List[str], bet: float) -> float:
    """
    Calculate payout based on reel combination
    5 of a kind = symbol value * bet * 10
    4 of a kind = symbol value * bet * 5
    3 of a kind = symbol value * bet * 2
    """
    from collections import Counter
    counts = Counter(reels)
    
    max_count = max(counts.values())
    most_common_symbol = counts.most_common(1)[0][0]
    
    symbol_value = SLOT_SYMBOLS[most_common_symbol]["value"]
    
    if max_count == 5:
        # JACKPOT!
        return symbol_value * bet * 10
    elif max_count == 4:
        return symbol_value * bet * 5
    elif max_count == 3:
        return symbol_value * bet * 2
    else:
        return 0.0

def get_pot_level(amount: float) -> str:
    """Get pot level description"""
    if amount >= 10000:
        return "MEGA POT"
    elif amount >= 5000:
        return "BIG POT"
    elif amount >= 1000:
        return "GROWING POT"
    else:
        return "STARTER POT"

# ============================================================================
# WEBSOCKET FOR REAL-TIME POT UPDATES
# ============================================================================

active_connections: Dict[str, List[WebSocket]] = {}

@router.websocket("/ws/slots/{aisle_id}")
async def slots_websocket(websocket: WebSocket, aisle_id: str) -> Dict[str, Any]:
    """
    WebSocket for real-time pot updates in slot aisle
    """
    await websocket.accept()
    
    if aisle_id not in active_connections:
        active_connections[aisle_id] = []
    
    active_connections[aisle_id].append(websocket)
    
    try:
        while True:
            # Wait for messages
            data = await websocket.receive_json()
            
            if data.get("event") == "JACKPOT_TRIGGERED":
                # Broadcast to all players in aisle
                pot_data = COMMUNITY_POTS.get(aisle_id, {"total": 0.0})
                jackpot_share = distribute_community_jackpot(aisle_id)
                
                for connection in active_connections[aisle_id]:
                    await connection.send_json({
                        "event": "COMMUNITY_JACKPOT",
                        "total_pot": pot_data["total"],
                        "your_share": jackpot_share,
                        "message": f"🎰 Community Jackpot! You won {jackpot_share} GV Coins!"
                    })
    
    except WebSocketDisconnect:
        active_connections[aisle_id].remove(websocket)

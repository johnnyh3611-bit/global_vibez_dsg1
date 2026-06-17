"""
Vibe 6-5-4 Dice - Underground Club Dice Game
Craps-style game with MetaHuman dealer, side bets, and Dealer Envy system

OFFICIAL GAME RULES (Vibe 654):
================================
1. QUALIFICATION: Must roll 6, then 5, then 4 (in strict sequential order)
2. ROLLS: Each player gets 3 rolls maximum to qualify
3. DICE: Start with 5 dice; remove 6, 5, 4 as they're rolled
4. POINTS: After qualifying (6-5-4), sum of REMAINING dice = player's score
5. TOURNAMENT MODE:
   - 20 players start
   - Highest score(s) advance
   - If tie: tied players add to pot and continue
   - If no qualifications: everyone re-ups, pot grows
   - Winner takes pot minus 12.5% house rake
6. BUST: If player doesn't qualify in 3 rolls, score = 0

DEALER ENVY: 2-5% of side bet wins go to the MetaHuman dealer
"""
import secrets
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any
from fastapi import APIRouter
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient
import os

router = APIRouter()

# MongoDB connection
MONGO_URL = os.getenv('MONGO_URL')
client = AsyncIOMotorClient(MONGO_URL)
db = client[os.getenv('DB_NAME', 'globalvibez')]

# Pydantic models
class SideBet(BaseModel):
    type: str  # TRIPLE_6, ONE_AND_DONE, STRAIGHT_1, etc.
    amount: float

class PlaceBetRequest(BaseModel):
    user_id: str
    main_bet: float = 5.0
    side_bets: List[SideBet] = []
    dealer_personality: str = "nova"  # nova, ace, ruby, jade

class DiceRollResult(BaseModel):
    roll_id: str
    rolls_history: List[List[int]]
    qualified: bool
    point: int
    status: str  # QUALIFIED, BUST
    side_bet_results: List[Dict]
    dealer_envy_total: float

class Vibe654Engine:
    """Core game engine for 6-5-4 Dice"""
    
    def __init__(self, entry_fee=5.0, rake_percent=0.125):  # 12.5% official house rake
        self.entry_fee = entry_fee
        self.rake_percent = rake_percent
        self.max_rolls = 3
        
    def roll_dice(self, num_dice=5) -> List[int]:
        """Provably fair dice roll using secrets module"""
        return [secrets.choice([1, 2, 3, 4, 5, 6]) for _ in range(num_dice)]
    
    def play_round(self, player_id: str) -> Dict:
        """Execute a complete game round - Official Vibe 654 Rules"""
        has_6 = False
        has_5 = False
        has_4 = False
        rolls_results = []
        point = 0
        
        for r in range(self.max_rolls):
            # Roll only the dice not yet locked
            dice_to_roll = 5 - sum([has_6, has_5, has_4])
            current_roll = self.roll_dice(dice_to_roll)
            rolls_results.append(current_roll.copy())
            
            # OFFICIAL RULE: Sequential 6 -> 5 -> 4 qualification
            # Remove each qualifier from the roll as it's found
            if not has_6 and 6 in current_roll:
                has_6 = True
                current_roll.remove(6)
                
            if has_6 and not has_5 and 5 in current_roll:
                has_5 = True
                current_roll.remove(5)
                
            if has_5 and not has_4 and 4 in current_roll:
                has_4 = True
                current_roll.remove(4)
            
            # If qualified (6-5-4 locked), remaining dice = points
            if has_6 and has_5 and has_4:
                point_dice = current_roll  # The dice LEFT OVER after removing 6, 5, 4
                point = sum(point_dice)
                return {
                    "status": "QUALIFIED",
                    "rolls": rolls_results,
                    "point": point,
                    "point_dice": point_dice,
                    "message": f"Vibe Check Passed! Point is {point}"
                }
        
        return {
            "status": "BUST",
            "rolls": rolls_results,
            "point": 0,
            "message": "Better luck next session!"
        }
    
    def check_side_bets(self, first_roll: List[int], side_bets: List[Dict]) -> tuple:
        """Process all side bets and calculate Dealer Envy"""
        results = []
        dealer_envy_pool = 0.0
        
        for bet in side_bets:
            win_amount = 0
            envy_bonus = 0
            bet_type = bet["type"]
            bet_amount = bet["amount"]
            
            # Check for Straight Sets (5 of a kind)
            is_straight_set = len(set(first_roll)) == 1
            if is_straight_set:
                rolled_num = first_roll[0]
                if bet_type == f"STRAIGHT_{rolled_num}":
                    win_amount = bet_amount * 500  # 500:1 payout
                    envy_bonus = win_amount * 0.05  # 5% Dealer Envy
                elif bet_type == "ANY_STRAIGHT":
                    win_amount = bet_amount * 100  # 100:1 payout
                    envy_bonus = win_amount * 0.02
            
            # Triple 6s (3 or more 6s)
            elif bet_type == "TRIPLE_6" and first_roll.count(6) >= 3:
                win_amount = bet_amount * 30
                envy_bonus = win_amount * 0.05
            
            # One-and-Done (6, 5, 4 in first roll)
            elif bet_type == "ONE_AND_DONE" and all(x in first_roll for x in [6, 5, 4]):
                win_amount = bet_amount * 10
                envy_bonus = win_amount * 0.02
            
            # Small Straight (4 in sequence)
            elif bet_type == "SMALL_STRAIGHT":
                unique_sorted = sorted(list(set(first_roll)))
                is_small = any(unique_sorted[i:i+4] == list(range(unique_sorted[i], unique_sorted[i]+4)) 
                              for i in range(len(unique_sorted)-3))
                if is_small:
                    win_amount = bet_amount * 30
                    envy_bonus = win_amount * 0.02
            
            # Large Straight (1-2-3-4-5 or 2-3-4-5-6)
            elif bet_type == "LARGE_STRAIGHT":
                unique_sorted = sorted(list(set(first_roll)))
                if unique_sorted in [[1,2,3,4,5], [2,3,4,5,6]]:
                    win_amount = bet_amount * 100
                    envy_bonus = win_amount * 0.05
            
            if win_amount > 0:
                net_payout = win_amount - envy_bonus
                results.append({
                    "bet_type": bet_type,
                    "payout": net_payout,
                    "envy_tip": envy_bonus,
                    "original_bet": bet_amount
                })
                dealer_envy_pool += envy_bonus
        
        return results, dealer_envy_pool

# Initialize engine
engine = Vibe654Engine()

# API Endpoints
@router.post("/play")
async def play_dice_round(request: PlaceBetRequest) -> Dict[str, Any]:
    """
    Play a round of 6-5-4 Dice
    Returns: Game result with side bet outcomes and dealer envy
    """
    roll_id = str(uuid.uuid4())
    
    # Execute main game
    game_result = engine.play_round(request.user_id)
    
    # Process side bets on first roll
    first_roll = game_result["rolls"][0] if game_result["rolls"] else []
    side_bet_results, dealer_envy = engine.check_side_bets(
        first_roll,
        [sb.dict() for sb in request.side_bets]
    )
    
    # Calculate 1:1 payout (bet $10, win $10 profit, get $20 back total)
    total_pot = request.main_bet
    if game_result["status"] == "QUALIFIED":
        # Winner gets their bet back + equal winnings (1:1 payout)
        winner_payout = request.main_bet * 2  # Return bet + winnings
    else:
        # Bust = lose the bet
        winner_payout = 0
    
    house_rake = 0  # No house rake on 1:1 payouts
    
    # Save to database
    session_doc = {
        "_id": roll_id,
        "user_id": request.user_id,
        "game_type": "654_DICE",
        "main_bet": request.main_bet,
        "side_bets": [sb.dict() for sb in request.side_bets],
        "rolls_history": game_result["rolls"],
        "qualified": game_result["status"] == "QUALIFIED",
        "point": game_result.get("point", 0),
        "side_bet_results": side_bet_results,
        "dealer_envy_total": dealer_envy,
        "dealer_personality": request.dealer_personality,
        "house_rake": house_rake,
        "total_pot": total_pot,
        "timestamp": datetime.now(timezone.utc),
        "status": "COMPLETED"
    }
    
    await db.dice_sessions.insert_one(session_doc)
    
    # Update dealer stats
    await db.dealer_stats.update_one(
        {"personality_id": request.dealer_personality.upper()},
        {
            "$inc": {
                "total_envy_collected": dealer_envy,
                "total_hands_dealt": 1
            }
        },
        upsert=True
    )
    
    # Calculate side bet total payout
    side_bet_payout = sum([sb["payout"] for sb in side_bet_results])
    
    # Prepare response with updated structure
    response_data = {
        "success": True,
        "roll_id": roll_id,
        "game_result": {
            "status": game_result["status"],
            "qualified": game_result["status"] == "QUALIFIED",
            "point": game_result.get("point", 0),
            "point_score": game_result.get("point", 0),
            "point_dice": game_result.get("point_dice", []),
            "locked_numbers": [6, 5, 4] if game_result["status"] == "QUALIFIED" else [],
            "has_6": any(6 in roll for roll in game_result["rolls"]),
            "has_5": any(5 in roll for roll in game_result["rolls"]),
            "has_4": any(4 in roll for roll in game_result["rolls"]),
            "message": game_result["message"]
        },
        "all_rolls": game_result["rolls"],
        "side_bet_results": side_bet_results,
        "side_bet_payout": side_bet_payout,
        "dealer_envy_total": dealer_envy,
        "pot_info": {
            "total_pot": total_pot,
            "house_rake": house_rake,
            "winner_payout": winner_payout
        },
        "nova_reaction": {
            "message": game_result["message"],
            "mood": "celebrating" if game_result["status"] == "QUALIFIED" else "sympathetic"
        },
        "physics_params": {
            "throw_force": secrets.randbelow(150) + 450.0,
            "spin_axis": [secrets.randbelow(200) / 100 - 1 for _ in range(3)],
            "release_angle": secrets.randbelow(30) - 15.0
        }
    }
    
    return response_data

@router.get("/leaderboard/dealer-envy")
async def get_dealer_rankings() -> Dict[str, Any]:
    """Get dealer performance leaderboard"""
    dealers = await db.dealer_stats.find(
        {},
        {"_id": 0}
    ).sort("total_envy_collected", -1).to_list(10)
    
    return {
        "success": True,
        "rankings": dealers
    }

@router.get("/history/{user_id}")
async def get_player_history(user_id: str, limit: int = 10) -> Dict[str, Any]:
    """Get player's recent game history"""
    history = await db.dice_sessions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    return {
        "success": True,
        "history": history
    }

@router.get("/stats/side-bets")
async def get_side_bet_stats() -> Dict[str, Any]:
    """Get global side bet statistics"""
    pipeline = [
        {"$unwind": "$side_bet_results"},
        {"$group": {
            "_id": "$side_bet_results.bet_type",
            "total_payouts": {"$sum": "$side_bet_results.payout"},
            "hit_count": {"$sum": 1}
        }}
    ]
    
    stats = await db.dice_sessions.aggregate(pipeline).to_list(100)
    
    return {
        "success": True,
        "side_bet_stats": stats
    }

"""
VIBEZ 654 - THE PRESCRIPTION RULES (Option A)
==============================================

THE MASTER RULES:
1. Roll 5 dice at once
2. Check for 6, 5, AND 4 (you have 3 total rolls to qualify)
3. Once qualified: Point = sum of the OTHER 2 dice
4. Decision: STAND (keep score) or RE-ROLL (the 2 point dice only)
5. Maximum 3 shakes per turn

SCORING:
- Best: 12 (two 6s) - "Midnight"
- Worst: 2 (two 1s) - "Snake Eyes"
- Range: 2-12 points

STRATEGY:
- First roll qualified + high score (10-12) → STAND
- First roll qualified + low score (2-4) → RE-ROLL
- Risk: Re-roll locks in new score (can't go back)

WIN/LOSS:
- Fail to qualify in 3 rolls → 0 points → BUST
- All qualified players compete for highest point score
- Winner(s) split the pot (minus rake & dealer envy)

GROUP TABLE GAME:
- 20-30 players per table
- All bets go into a central POT
- House takes 10% rake
- Dealer Envy system (tips on big wins)
- Side bets available (TRIPLE_6, ONE_AND_DONE, STRAIGHT_1-6, LARGE_STRAIGHT)
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import secrets
import uuid
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os

router = APIRouter()

# MongoDB
MONGO_URL = os.getenv('MONGO_URL')
client = AsyncIOMotorClient(MONGO_URL)
db = client[os.getenv('DB_NAME', 'globalvibez')]

# Models
class SideBet(BaseModel):
    type: str  # TRIPLE_6, ONE_AND_DONE, STRAIGHT_1, STRAIGHT_6, LARGE_STRAIGHT, POINT_PREDICTION
    amount: float
    has_insurance: bool = False
    predicted_point: Optional[int] = None  # For POINT_PREDICTION bets

class PlayRequest(BaseModel):
    user_id: str
    table_id: str = "vibez654_table_1"
    main_bet: float = 10.0
    side_bets: List[SideBet] = []
    dealer_personality: str = "nova"
    
class TableConfig(BaseModel):
    table_id: str
    max_players: int = 30
    min_bet: float = 50.0  # platform-wide 50-coin floor
    max_bet: float = 500.0
    rake_percent: float = 0.10  # 10% house rake
    dealer_envy_percent: float = 0.05  # 5% on big wins

class Vibez654Engine:
    """The Prescription Engine for Vibez 654 - Group Table Pot Game"""
    
    def roll_dice(self, num_dice: int = 5) -> List[int]:
        """Provably fair dice roll"""
        return [secrets.randbelow(6) + 1 for _ in range(num_dice)]
    
    def check_qualification(self, dice: List[int], has_6: bool = False, has_5: bool = False, has_4: bool = False) -> dict:
        """
        OFFICIAL RULES: Sequential 6 → 5 → 4 qualification
        Must get 6 first, then 5, then 4 (in strict order across rolls)
        """
        current_roll = dice.copy()
        locked_numbers = []
        
        # Check for 6 first (if we don't have it yet)
        if not has_6 and 6 in current_roll:
            has_6 = True
            current_roll.remove(6)
            locked_numbers.append(6)
        
        # Check for 5 only if we have 6
        if has_6 and not has_5 and 5 in current_roll:
            has_5 = True
            current_roll.remove(5)
            locked_numbers.append(5)
        
        # Check for 4 only if we have both 6 and 5
        if has_5 and not has_4 and 4 in current_roll:
            has_4 = True
            current_roll.remove(4)
            locked_numbers.append(4)
        
        # Fully qualified if we have all three
        is_qualified = has_6 and has_5 and has_4
        
        if is_qualified:
            # Points = sum of remaining dice after removing 6, 5, 4
            point_score = sum(current_roll)
            
            return {
                "qualified": True,
                "point_dice": current_roll,
                "point_score": point_score,
                "locked_numbers": [6, 5, 4],
                "has_6": True,
                "has_5": True,
                "has_4": True,
                "next_needed": None
            }
        else:
            # Return current progress
            all_locked = []
            if has_6:
                all_locked.append(6)
            if has_5:
                all_locked.append(5)
            if has_4:
                all_locked.append(4)
            
            # Determine what we need next
            next_needed = 6 if not has_6 else (5 if not has_5 else 4)
            
            return {
                "qualified": False,
                "point_dice": [],
                "point_score": 0,
                "locked_numbers": all_locked,
                "has_6": has_6,
                "has_5": has_5,
                "has_4": has_4,
                "next_needed": next_needed
            }
    
    def check_side_bets(self, first_roll: List[int], side_bets: List[SideBet], final_point: Optional[int] = None, qualification_roll_number: Optional[int] = None) -> tuple:
        """
        Process side bets and calculate Dealer Envy + Insurance payouts
        - Regular side bets checked on first roll only
        - Point Prediction checked after game completes (if qualified)
        - Qualification timing bets checked after game completes (if qualified)
        """
        results = []
        dealer_envy_pool = 0.0
        
        for bet in side_bets:
            win_amount = 0
            envy_bonus = 0
            insurance_payout = 0
            bet_type = bet.type
            bet_amount = bet.amount
            
            # Skip POINT_PREDICTION and QUALIFY_ROLL bets on first roll - checked at the end
            if bet_type == "POINT_PREDICTION" and final_point is None:
                continue
            if bet_type.startswith("QUALIFY_ROLL_") and qualification_roll_number is None:
                continue
            
            # POINT_PREDICTION (checked after game completes)
            if bet_type == "POINT_PREDICTION" and final_point is not None:
                if bet.predicted_point == final_point:
                    win_amount = bet_amount * 3  # 3:1
                    # Insurance pays 1:1 on win
                    if bet.has_insurance:
                        insurance_payout = bet_amount * 1  # 1:1
            
            # QUALIFICATION TIMING BETS (checked after game completes if qualified)
            elif bet_type == "QUALIFY_ROLL_1" and qualification_roll_number == 1:
                win_amount = bet_amount * 3  # 3:1
                if bet.has_insurance:
                    insurance_payout = bet_amount * 1  # 1:1
            elif bet_type == "QUALIFY_ROLL_2" and qualification_roll_number == 2:
                win_amount = bet_amount * 2  # 2:1
                if bet.has_insurance:
                    insurance_payout = bet_amount * 1  # 1:1
            elif bet_type == "QUALIFY_ROLL_3" and qualification_roll_number == 3:
                win_amount = bet_amount * 1  # 1:1
                if bet.has_insurance:
                    insurance_payout = bet_amount * 1  # 1:1
            
            # TRIPLE_6 (3 or more 6s)
            elif bet_type == "TRIPLE_6" and first_roll.count(6) >= 3:
                win_amount = bet_amount * 30  # 30:1
                envy_bonus = win_amount * 0.05
                if bet.has_insurance:
                    insurance_payout = bet_amount * 1  # 1:1
            
            # ONE_AND_DONE (6-5-4 on first roll = instant qualification)
            elif bet_type == "ONE_AND_DONE":
                if 6 in first_roll and 5 in first_roll and 4 in first_roll:
                    win_amount = bet_amount * 50  # 50:1
                    envy_bonus = win_amount * 0.05
                    if bet.has_insurance:
                        insurance_payout = bet_amount * 1  # 1:1
            
            # STRAIGHT_1 through STRAIGHT_6 (all 5 dice same number)
            elif bet_type.startswith("STRAIGHT_"):
                target_num = int(bet_type.split("_")[1])
                if first_roll.count(target_num) == 5:
                    win_amount = bet_amount * 500  # 500:1
                    envy_bonus = win_amount * 0.10  # Big dealer envy on straights
                    if bet.has_insurance:
                        insurance_payout = bet_amount * 1  # 1:1
            
            # LARGE_STRAIGHT (1-2-3-4-5 or 2-3-4-5-6)
            elif bet_type == "LARGE_STRAIGHT":
                sorted_roll = sorted(first_roll)
                if sorted_roll == [1, 2, 3, 4, 5] or sorted_roll == [2, 3, 4, 5, 6]:
                    win_amount = bet_amount * 100  # 100:1
                    envy_bonus = win_amount * 0.05
                    if bet.has_insurance:
                        insurance_payout = bet_amount * 1  # 1:1
            
            dealer_envy_pool += envy_bonus
            
            # Only add to results if bet was evaluated (win or loss)
            if bet_type not in ["POINT_PREDICTION"] or final_point is not None:
                # Skip qualification timing bets if not yet evaluated
                if bet_type.startswith("QUALIFY_ROLL_") and qualification_roll_number is None:
                    continue
                    
                results.append({
                    "bet_type": bet_type,
                    "original_bet": bet_amount,
                    "won": win_amount > 0,
                    "payout": win_amount,
                    "insurance_payout": insurance_payout,
                    "envy_tip": envy_bonus,
                    "has_insurance": bet.has_insurance
                })
        
        return results, dealer_envy_pool
    
    def get_nova_response(self, qualified: bool, point_score: int, rolls_left: int, phase: str) -> dict:
        """
        Nova's contextual dialogue based on game state
        Phase: 'qualification', 'decision', 'stand', 'reroll', 'bust', 'win', 'loss'
        """
        responses = {
            "qualification_low": f"You've qualified, but a {point_score} is a dangerous seat to sit in. Want to shake again?",
            "qualification_mid": f"You've qualified with {point_score} points. {rolls_left} shakes left—want to push?",
            "qualification_high": f"Standing on {point_score}. Bold. Let's see if the house can match that.",
            "snake_eyes": "Snake eyes (2). That's rough. You've got 2 more shakes to turn it around.",
            "midnight": "Standing on a midnight (12). Bold. Let's see if the house can match that.",
            "stand": f"Smart play. {point_score} is the mark to beat.",
            "reroll_better": f"Much better. Sitting on {point_score}. Stand or take your last shot?",
            "reroll_worse": f"Ouch. Down to {point_score}. Want to risk another?",
            "bust": "Better luck next session. The 6-5-4 didn't show in time.",
            "win": f"Clean sweep. {point_score} beats the house.",
            "loss": "The house edge is a beast, but the night is young."
        }
        
        mood = "professional"
        
        if phase == "qualification":
            if point_score == 2:
                message = responses["snake_eyes"]
                mood = "sympathetic"
            elif point_score == 12:
                message = responses["midnight"]
                mood = "celebrating"
            elif point_score <= 4:
                message = responses["qualification_low"]
                mood = "sympathetic"
            elif point_score >= 10:
                message = responses["qualification_high"]
                mood = "celebrating"
            else:
                message = responses["qualification_mid"]
                mood = "professional"
        elif phase == "stand":
            message = responses["stand"]
            mood = "professional"
        elif phase == "bust":
            message = responses["bust"]
            mood = "sympathetic"
        elif phase == "win":
            message = responses["win"]
            mood = "celebrating"
        elif phase == "loss":
            message = responses["loss"]
            mood = "sympathetic"
        else:
            message = responses.get(phase, "Let's roll.")
            
        return {"message": message, "mood": mood}

engine = Vibez654Engine()

# ============================================================================
# TABLE MANAGEMENT ENDPOINTS
# ============================================================================

@router.post("/create-table")
async def create_table(config: TableConfig) -> Dict[str, Any]:
    """Create a new Vibez 654 table"""
    table_doc = {
        "table_id": config.table_id,
        "max_players": config.max_players,
        "min_bet": config.min_bet,
        "max_bet": config.max_bet,
        "rake_percent": config.rake_percent,
        "dealer_envy_percent": config.dealer_envy_percent,
        "created_at": datetime.now(timezone.utc),
        "status": "OPEN",  # OPEN, IN_PROGRESS, CLOSED
        "current_round": None,
        "total_pot": 0.0
    }
    
    await db.vibez654_tables.update_one(
        {"table_id": config.table_id},
        {"$set": table_doc},
        upsert=True
    )
    
    return {
        "success": True,
        "table_id": config.table_id,
        "message": "Table created successfully"
    }

@router.get("/tables/active")
async def get_active_tables() -> Dict[str, Any]:
    """Get all active Vibez 654 tables"""
    tables = await db.vibez654_tables.find(
        {"status": "OPEN"},
        {"_id": 0}
    ).to_list(100)
    
    return {
        "success": True,
        "tables": tables
    }

@router.post("/join-table")
async def join_table(user_id: str, table_id: str) -> Dict[str, Any]:
    """Join a Vibez 654 table"""
    table = await db.vibez654_tables.find_one({"table_id": table_id})
    
    if not table:
        raise HTTPException(404, "Table not found")
    
    # Check if user already at table
    current_round = table.get("current_round")
    if current_round:
        round_doc = await db.vibez654_rounds.find_one({"round_id": current_round})
        if round_doc and user_id in [p["user_id"] for p in round_doc.get("players", [])]:
            return {"success": True, "message": "Already at table", "table_id": table_id}
    
    return {
        "success": True,
        "message": f"Joined table {table_id}",
        "table_id": table_id,
        "min_bet": table["min_bet"],
        "max_bet": table["max_bet"]
    }

# ============================================================================
# GAME PLAY ENDPOINTS
# ============================================================================

@router.post("/play")
async def play_vibez_654(request: PlayRequest) -> Dict[str, Any]:
    """
    OFFICIAL VIBEZ 654 - Sequential 6→5→4 across up to 3 rolls
    Each roll removes locked dice, returns current state
    """
    roll_id = str(uuid.uuid4())
    
    # Get or create table
    table = await db.vibez654_tables.find_one({"table_id": request.table_id})
    if not table:
        # Auto-create default table
        default_config = TableConfig(
            table_id=request.table_id,
            max_players=30,
            min_bet=50.0,
            max_bet=500.0
        )
        await create_table(default_config)
        table = await db.vibez654_tables.find_one({"table_id": request.table_id})
    
    # Validate bet
    if request.main_bet < table["min_bet"] or request.main_bet > table["max_bet"]:
        raise HTTPException(400, f"Bet must be between ${table['min_bet']} and ${table['max_bet']}")

    # ------------------------------------------------------------------
    # Wallet handling — accept either the legacy ``users.credits_balance``
    # (demo accounts) or a modern ``wallets.balance`` row. Pick whichever
    # one actually has funds — earlier logic locked onto wallets.balance
    # even when it was 0 (e.g. demo user got credit on users.credits_balance
    # but had a stray 0-balance wallets row), causing the standalone Vibe
    # 654 room to reject every bet with "Insufficient balance" (2026-02-04).
    # ------------------------------------------------------------------
    user_row = await db.users.find_one(
        {"user_id": request.user_id},
        {"_id": 0, "token_balance": 1, "credits_balance": 1},
    ) or {}
    wallet_row = await db.wallets.find_one({"user_id": request.user_id}, {"_id": 0})

    candidates: list[tuple[str, float]] = []
    if wallet_row:
        candidates.append(("wallets.balance", float(wallet_row.get("balance", 0) or 0)))
    if "token_balance" in user_row:
        candidates.append(("users.token_balance", float(user_row.get("token_balance", 0) or 0)))
    if "credits_balance" in user_row:
        candidates.append(("users.credits_balance", float(user_row.get("credits_balance", 0) or 0)))

    if not candidates:
        raise HTTPException(404, "Wallet not found")

    # Pick the wallet with the highest balance so a stray 0-balance row
    # never blocks a player who actually has funds elsewhere.
    candidates.sort(key=lambda x: x[1], reverse=True)
    wallet_field, current_balance = candidates[0]

    # Calculate total bet including insurance
    total_side_bets = sum(bet.amount for bet in request.side_bets)
    total_insurance = sum(bet.amount for bet in request.side_bets if bet.has_insurance)
    total_bet = request.main_bet + total_side_bets + total_insurance

    if current_balance < total_bet:
        raise HTTPException(400, "Insufficient balance")

    # Deduct bet + insurance from whichever wallet the user actually has.
    async def _wallet_inc(delta: float) -> None:
        if wallet_field == "wallets.balance":
            await db.wallets.update_one({"user_id": request.user_id}, {"$inc": {"balance": delta}})
        elif wallet_field == "users.token_balance":
            await db.users.update_one({"user_id": request.user_id}, {"$inc": {"credits_balance": delta}})
        else:
            await db.users.update_one({"user_id": request.user_id}, {"$inc": {"credits_balance": delta}})

    await _wallet_inc(-total_bet)
    
    # Initialize game state for this turn
    has_6 = False
    has_5 = False
    has_4 = False
    roll_number = 1
    max_rolls = 3
    all_rolls = []
    
    # Execute up to 3 rolls
    qualification_roll = None  # Track which roll qualified
    while roll_number <= max_rolls:
        # Calculate how many dice to roll (5 minus locked qualifiers)
        dice_to_roll = 5 - sum([has_6, has_5, has_4])
        
        # Roll the dice
        current_roll = engine.roll_dice(dice_to_roll)
        all_rolls.append(current_roll)
        
        # Check qualification with current progress
        result = engine.check_qualification(current_roll, has_6, has_5, has_4)
        
        # Update progress
        has_6 = result["has_6"]
        has_5 = result["has_5"]
        has_4 = result["has_4"]
        
        # If qualified, track which roll it was
        if result["qualified"] and qualification_roll is None:
            qualification_roll = roll_number
            break
        
        roll_number += 1
    
    # Process side bets on first roll (regular bets)
    side_bet_results_first_roll, dealer_envy_total = engine.check_side_bets(
        all_rolls[0] if all_rolls else [], 
        request.side_bets,
        final_point=None,  # Don't check point prediction yet
        qualification_roll_number=None  # Don't check qualification timing yet
    )
    
    # If qualified, check Point Prediction AND Qualification Timing side bets
    if result["qualified"]:
        point_prediction_results, _ = engine.check_side_bets(
            all_rolls[0] if all_rolls else [],
            request.side_bets,
            final_point=result["point_score"],
            qualification_roll_number=qualification_roll
        )
        # Merge point prediction and qualification timing results with first roll results
        for pp_result in point_prediction_results:
            if pp_result["bet_type"] in ["POINT_PREDICTION", "QUALIFY_ROLL_1", "QUALIFY_ROLL_2", "QUALIFY_ROLL_3"]:
                side_bet_results_first_roll.append(pp_result)
    
    side_bet_results = side_bet_results_first_roll
    
    # Get Nova's response
    nova_response = engine.get_nova_response(
        result["qualified"],
        result["point_score"],
        max(0, max_rolls - roll_number),
        "FINAL"
    )
    
    # Calculate pot contribution and payout
    table_pot = request.main_bet
    house_rake = 0  # No house rake on 1:1 payouts
    
    # Calculate side bet + insurance payouts
    side_bet_payout = sum(r["payout"] + r.get("insurance_payout", 0) for r in side_bet_results)
    
    # If qualified, player wins 1:1 (bet $10, win $10 profit, get $20 back total)
    if result["qualified"]:
        winner_payout = table_pot * 2  # Return bet + equal winnings (1:1 payout)
        await _wallet_inc(winner_payout + side_bet_payout)
        total_won = winner_payout + side_bet_payout
    else:
        total_won = side_bet_payout
        if side_bet_payout > 0:
            await _wallet_inc(side_bet_payout)
    
    # Save game to database
    game_doc = {
        "roll_id": roll_id,
        "user_id": request.user_id,
        "table_id": request.table_id,
        "main_bet": request.main_bet,
        "side_bets": [{"type": sb.type, "amount": sb.amount} for sb in request.side_bets],
        "all_rolls": all_rolls,
        "total_rolls": roll_number,
        "qualified": result["qualified"],
        "point_score": result["point_score"],
        "point_dice": result["point_dice"],
        "locked_numbers": result["locked_numbers"],
        "side_bet_results": side_bet_results,
        "dealer_envy_total": dealer_envy_total,
        "house_rake": house_rake,
        "total_pot": table_pot,
        "payout": total_won,
        "dealer_personality": request.dealer_personality,
        "timestamp": datetime.now(timezone.utc),
        "status": "COMPLETED"
    }
    
    await db.vibez654_games.insert_one(game_doc)
    
    # Update dealer stats
    await db.dealer_stats.update_one(
        {"personality_id": request.dealer_personality.upper()},
        {
            "$inc": {
                "total_envy_collected": dealer_envy_total,
                "total_hands_dealt": 1
            }
        },
        upsert=True
    )
    
    return {
        "success": True,
        "roll_id": roll_id,
        "dice_roll": all_rolls[-1],  # Last roll
        "all_rolls": all_rolls,
        "total_rolls": roll_number,
        "rolls_left": max(0, max_rolls - roll_number),
        "game_result": {
            "qualified": result["qualified"],
            "point_score": result["point_score"],
            "point_dice": result["point_dice"],
            "locked_numbers": result["locked_numbers"],
            "has_6": result["has_6"],
            "has_5": result["has_5"],
            "has_4": result["has_4"],
            "next_needed": result.get("next_needed")
        },
        "side_bet_results": side_bet_results,
        "side_bet_payout": side_bet_payout,
        "dealer_envy_total": dealer_envy_total,
        "pot_info": {
            "total_pot": table_pot,
            "house_rake": house_rake,
            "winner_payout": total_won
        },
        "nova_reaction": nova_response
    }
    if result["qualified"]:
        nova = engine.get_nova_response(
            True, 
            result["point_score"], 
            2,  # Rolls remaining
            "qualification"
        )
    else:
        nova = {
            "message": f"No qualification yet. Looking for {', '.join(map(str, [n for n in [6,5,4] if n not in result['locked_numbers']]))}.",
            "mood": "professional"
        }
    
    # Save to database
    session_doc = {
        "roll_id": roll_id,
        "user_id": request.user_id,
        "table_id": request.table_id,
        "main_bet": request.main_bet,
        "side_bets": [bet.dict() for bet in request.side_bets],
        "dice_roll": all_rolls[0] if all_rolls else [],
        "qualified": result["qualified"],
        "point_dice": result["point_dice"],
        "point_score": result["point_score"],
        "locked_numbers": result["locked_numbers"],
        "dealer_personality": request.dealer_personality,
        "nova_message": nova["message"],
        "nova_mood": nova["mood"],
        "side_bet_results": side_bet_results,
        "dealer_envy_total": dealer_envy_total,
        "timestamp": datetime.now(timezone.utc),
        "status": "QUALIFIED" if result["qualified"] else "IN_PROGRESS",
        "rolls_used": 1,
        "final_score": None
    }
    
    await db.dice_sessions.insert_one(session_doc)
    
    # Pay out side bet winnings immediately
    side_bet_payout = sum(bet["payout"] for bet in side_bet_results)
    if side_bet_payout > 0:
        await _wallet_inc(side_bet_payout)
    
    return {
        "success": True,
        "roll_id": roll_id,
        "dice_roll": all_rolls[0] if all_rolls else [],
        "game_result": {
            "qualified": result["qualified"],
            "point_dice": result["point_dice"],
            "point_score": result["point_score"],
            "locked_numbers": result["locked_numbers"],
            "status": "QUALIFIED" if result["qualified"] else "IN_PROGRESS"
        },
        "side_bet_results": side_bet_results,
        "side_bet_payout": side_bet_payout,
        "dealer_envy_total": dealer_envy_total,
        "nova_reaction": nova,
        "can_stand": result["qualified"],
        "can_reroll": result["qualified"],
        "rolls_left": 2
    }

@router.post("/reroll-point-dice")
async def reroll_point_dice(roll_id: str, user_id: str) -> Dict[str, Any]:
    """
    Re-roll ONLY the 2 point dice (not the 6-5-4)
    This is for when player is qualified but wants a better score
    """
    # Get original session
    session = await db.dice_sessions.find_one({"roll_id": roll_id, "user_id": user_id}, {"_id": 0})
    
    if not session:
        raise HTTPException(404, "Session not found")
    
    if not session.get("qualified"):
        raise HTTPException(400, "Must be qualified to re-roll point dice")
    
    if session.get("rolls_used", 1) >= 3:
        raise HTTPException(400, "No rolls remaining")
    
    # Roll ONLY 2 new dice (the point dice)
    new_point_dice = engine.roll_dice(2)
    new_point_score = sum(new_point_dice)
    
    old_score = session["point_score"]
    rolls_used = session.get("rolls_used", 1) + 1
    
    # Get Nova's reaction
    if new_point_score > old_score:
        nova = engine.get_nova_response(True, new_point_score, 3 - rolls_used, "reroll_better")
    elif new_point_score < old_score:
        nova = engine.get_nova_response(True, new_point_score, 3 - rolls_used, "reroll_worse")
    else:
        nova = {"message": f"Same score: {new_point_score}.", "mood": "professional"}
    
    # Update session
    await db.dice_sessions.update_one(
        {"roll_id": roll_id},
        {
            "$set": {
                "point_dice": new_point_dice,
                "point_score": new_point_score,
                "rolls_used": rolls_used,
                "rerolled": True,
                "nova_message": nova["message"],
                "nova_mood": nova["mood"]
            }
        }
    )
    
    return {
        "success": True,
        "old_score": old_score,
        "new_point_dice": new_point_dice,
        "new_point_score": new_point_score,
        "rolls_left": 3 - rolls_used,
        "nova_reaction": nova
    }

@router.post("/stand")
async def stand_with_score(roll_id: str, user_id: str) -> Dict[str, Any]:
    """
    Player decides to STAND with current score
    Triggers pot comparison against other players at table
    """
    session = await db.dice_sessions.find_one({"roll_id": roll_id, "user_id": user_id}, {"_id": 0})
    
    if not session:
        raise HTTPException(404, "Session not found")
    
    if not session.get("qualified"):
        raise HTTPException(400, "Must be qualified to stand")
    
    point_score = session["point_score"]
    main_bet = session["main_bet"]
    
    # Get Nova's stand response
    nova = engine.get_nova_response(True, point_score, 0, "stand")
    
    # Mark as final
    await db.dice_sessions.update_one(
        {"roll_id": roll_id},
        {
            "$set": {
                "final_score": point_score,
                "player_action": "STAND",
                "nova_message": nova["message"],
                "status": "COMPLETE"
            }
        }
    )
    
    # For now, return 2x payout for qualified players (pot logic to be implemented in multiplayer phase)
    # In full multiplayer: compare against all other players at table and distribute pot
    payout = main_bet * 2.0

    # Mirror the /play wallet fallback — credit to whichever wallet the
    # user actually has the most balance on (avoids splitting a player's
    # bankroll across a stray 0-balance wallets row + the populated
    # users.credits_balance field).
    wallet_row = await db.wallets.find_one({"user_id": user_id}, {"_id": 0})
    user_row = await db.users.find_one(
        {"user_id": user_id},
        {"_id": 0, "token_balance": 1, "credits_balance": 1},
    ) or {}
    candidates: list[tuple[str, float]] = []
    if wallet_row:
        candidates.append(("wallets", float(wallet_row.get("balance", 0) or 0)))
    if "token_balance" in user_row:
        candidates.append(("token_balance", float(user_row.get("token_balance", 0) or 0)))
    if "credits_balance" in user_row:
        candidates.append(("credits_balance", float(user_row.get("credits_balance", 0) or 0)))
    candidates.sort(key=lambda x: x[1], reverse=True)
    if candidates:
        target = candidates[0][0]
        if target == "wallets":
            await db.wallets.update_one({"user_id": user_id}, {"$inc": {"balance": payout}})
        elif target == "token_balance":
            await db.users.update_one({"user_id": user_id}, {"$inc": {"credits_balance": payout}})
        else:
            await db.users.update_one({"user_id": user_id}, {"$inc": {"credits_balance": payout}})
    
    return {
        "success": True,
        "final_score": point_score,
        "payout": payout,
        "nova_reaction": nova,
        "message": f"Standing on {point_score}. Payout: ${payout}"
    }

@router.get("/history/{user_id}")
async def get_player_history(user_id: str, limit: int = 10) -> Dict[str, Any]:
    """Get player's recent games"""
    sessions = await db.dice_sessions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    return {
        "success": True,
        "history": sessions
    }

from fastapi import APIRouter, HTTPException, Request
from typing import Optional, Dict, Any
from pydantic import BaseModel
from utils.database import get_database, get_current_user
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/coins", tags=["coins"])


# ==================== MODELS ====================

class CoinTransaction(BaseModel):
    transaction_id: str
    user_id: str
    amount: int  # Positive = earned, Negative = spent
    transaction_type: str  # earn_game_win, earn_daily_bonus, earn_achievement, spend_bet, earn_bet_win, etc.
    description: str
    metadata: Optional[dict] = None
    created_at: str

class CoinBalance(BaseModel):
    user_id: str
    coins: int
    lifetime_earned: int
    lifetime_spent: int


# ==================== CONSTANTS ====================

COINS_PER_DOLLAR = 1000  # 1,000 coins = $1 (updated 2026-05-18)
STARTING_BALANCE = 2000  # $2.00 value at 1000 ₵/$ (existing balances preserved)
DAILY_LOGIN_BONUS = 100  # $0.05 value
PRACTICE_GAME_WIN = 0  # REMOVED - no coins for practice
MULTIPLAYER_GAME_WIN = 100  # $0.05 value
ACHIEVEMENT_BONUS = 500  # $0.25 value
TOURNAMENT_WIN_BASE = 500  # $0.25 value
MIN_CASHOUT_COINS = 50000  # $25 minimum cashout


# ==================== HELPER FUNCTIONS ====================

async def get_user_balance(user_id: str) -> int:
    """Get user's current coin balance"""
    db = get_database()
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    if not user:
        return 0
    
    # Initialize coins field if not exists
    if "coins" not in user:
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"coins": STARTING_BALANCE}}
        )
        return STARTING_BALANCE
    
    return user.get("coins", 0)


async def add_coins(user_id: str, amount: int, transaction_type: str, description: str, metadata: dict = None) -> Dict[str, Any]:
    """Add coins to user's balance and record transaction"""
    db = get_database()
    
    # Ensure user has starting balance initialized first
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "coins": 1})
    if user and "coins" not in user:
        # Initialize with starting balance before adding
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"coins": STARTING_BALANCE}}
        )
    
    # Update user balance
    await db.users.update_one(
        {"user_id": user_id},
        {
            "$inc": {"coins": amount},
            "$set": {"last_coin_update": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    # Record transaction
    transaction = {
        "transaction_id": str(uuid.uuid4()),
        "user_id": user_id,
        "amount": amount,
        "transaction_type": transaction_type,
        "description": description,
        "metadata": metadata or {},
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Insert and get a copy without _id for return
    transaction_copy = transaction.copy()
    await db.coin_transactions.insert_one(transaction)
    
    # Update lifetime stats
    if amount > 0:
        await db.users.update_one(
            {"user_id": user_id},
            {"$inc": {"lifetime_coins_earned": amount}}
        )
    else:
        await db.users.update_one(
            {"user_id": user_id},
            {"$inc": {"lifetime_coins_spent": abs(amount)}}
        )
    
    return transaction_copy


async def deduct_coins(user_id: str, amount: int, transaction_type: str, description: str, metadata: dict = None) -> Dict[str, Any]:
    """Deduct coins from user's balance (with validation)"""
    current_balance = await get_user_balance(user_id)
    
    if current_balance < amount:
        raise HTTPException(status_code=400, detail="Insufficient coins")
    
    return await add_coins(user_id, -amount, transaction_type, description, metadata)


# ==================== ENDPOINTS ====================

@router.get("/balance")
async def get_balance(request: Request) -> Dict[str, Any]:
    """Get user's current coin balance"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    balance = await get_user_balance(current_user.user_id)
    
    db = get_database()
    user = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    
    return {
        "user_id": current_user.user_id,
        "coins": balance,
        "lifetime_earned": user.get("lifetime_coins_earned", 0),
        "lifetime_spent": user.get("lifetime_coins_spent", 0)
    }


@router.get("/transactions")
async def get_transactions(request: Request, limit: int = 50, skip: int = 0) -> Dict[str, Any]:
    """Get user's coin transaction history"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    transactions = await db.coin_transactions.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "transactions": transactions,
        "total": len(transactions)
    }


@router.post("/daily-bonus")
async def claim_daily_bonus(request: Request) -> Dict[str, Any]:
    """Claim daily login bonus"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    user = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    
    # Check if already claimed today
    last_claim = user.get("last_daily_bonus_claim")
    if last_claim:
        last_claim_date = datetime.fromisoformat(last_claim).date()
        today = datetime.now(timezone.utc).date()
        
        if last_claim_date >= today:
            raise HTTPException(status_code=400, detail="Daily bonus already claimed today")
    
    # Award bonus
    transaction = await add_coins(
        current_user.user_id,
        DAILY_LOGIN_BONUS,
        "earn_daily_bonus",
        f"Daily login bonus (+{DAILY_LOGIN_BONUS} coins)",
        {"bonus_type": "daily_login"}
    )
    
    # Update last claim timestamp
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$set": {"last_daily_bonus_claim": datetime.now(timezone.utc).isoformat()}}
    )
    
    new_balance = await get_user_balance(current_user.user_id)
    
    return {
        "message": f"Daily bonus claimed! +{DAILY_LOGIN_BONUS} coins 🎁",
        "coins_earned": DAILY_LOGIN_BONUS,
        "new_balance": new_balance,
        "transaction": transaction
    }


@router.post("/award-game-win")
async def award_game_win(request: Request, game_type: str, game_id: str) -> Dict[str, Any]:
    """Award coins for winning a game (called by game endpoints)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Determine coin reward based on game type
    if game_type == "practice":
        coins = PRACTICE_GAME_WIN
        desc = f"Practice game win (+{coins} coins)"
    elif game_type == "multiplayer":
        coins = MULTIPLAYER_GAME_WIN
        desc = f"Multiplayer game win (+{coins} coins)"
    elif game_type == "tournament":
        coins = TOURNAMENT_WIN_BASE
        desc = f"Tournament win (+{coins} coins)"
    else:
        coins = 50
        desc = f"Game win (+{coins} coins)"
    
    transaction = await add_coins(
        current_user.user_id,
        coins,
        "earn_game_win",
        desc,
        {"game_type": game_type, "game_id": game_id}
    )
    
    new_balance = await get_user_balance(current_user.user_id)
    
    return {
        "message": f"You won {coins} coins! 🏆",
        "coins_earned": coins,
        "new_balance": new_balance,
        "transaction": transaction
    }


@router.post("/award-achievement")
async def award_achievement(request: Request, achievement_id: str, achievement_name: str) -> Dict[str, Any]:
    """Award coins for unlocking an achievement"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Check if achievement already claimed
    db = get_database()
    user = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    claimed_achievements = user.get("claimed_achievements", [])
    
    if achievement_id in claimed_achievements:
        raise HTTPException(status_code=400, detail="Achievement already claimed")
    
    # Award bonus
    transaction = await add_coins(
        current_user.user_id,
        ACHIEVEMENT_BONUS,
        "earn_achievement",
        f"Achievement unlocked: {achievement_name} (+{ACHIEVEMENT_BONUS} coins)",
        {"achievement_id": achievement_id}
    )
    
    # Mark achievement as claimed
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$addToSet": {"claimed_achievements": achievement_id}}
    )
    
    new_balance = await get_user_balance(current_user.user_id)
    
    return {
        "message": f"Achievement unlocked! +{ACHIEVEMENT_BONUS} coins 🎉",
        "coins_earned": ACHIEVEMENT_BONUS,
        "new_balance": new_balance,
        "transaction": transaction
    }


@router.get("/leaderboard")
async def get_coin_leaderboard(limit: int = 50) -> Dict[str, Any]:
    """Get top coin earners"""
    db = get_database()
    
    # Get users sorted by lifetime earned coins
    users = await db.users.find(
        {"lifetime_coins_earned": {"$exists": True}},
        {"_id": 0, "user_id": 1, "name": 1, "picture": 1, "lifetime_coins_earned": 1, "coins": 1}
    ).sort("lifetime_coins_earned", -1).limit(limit).to_list(limit)
    
    return {
        "leaderboard": users,
        "total": len(users)
    }

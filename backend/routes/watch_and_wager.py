from fastapi import APIRouter, HTTPException, Request, Query
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from utils.database import get_database, get_current_user
from datetime import datetime, timezone
from routes.coins import get_user_balance, add_coins, deduct_coins
import uuid

router = APIRouter(prefix="/watch-and-wager", tags=["watch_and_wager"])


# ==================== MODELS ====================

class PlaceBetRequest(BaseModel):
    game_id: str
    game_type: str  # multiplayer, tournament, dating
    prediction: str  # player_id or outcome
    amount: int  # coins to bet

class Bet(BaseModel):
    bet_id: str
    user_id: str
    username: str
    game_id: str
    game_type: str
    prediction: str
    amount: int
    odds: float
    potential_payout: float
    status: str  # pending, won, lost, cancelled
    created_at: str
    settled_at: Optional[str] = None

class BettingPool(BaseModel):
    game_id: str
    game_type: str
    total_pool: int
    house_edge_percent: int
    prize_pool: int  # after house cut
    predictions: Dict[str, int]  # prediction -> total amount bet
    current_odds: Dict[str, float]  # prediction -> payout multiplier
    bet_count: int
    status: str  # open, locked, settled
    created_at: str


# ==================== CONSTANTS ====================

HOUSE_EDGE = 5  # 5% house edge
MIN_BET = 50  # 50-coin floor (founder rule, May 2026)
MAX_BET = 100  # $0.10 value at the 1,000 ₵/$ rate
# 2026-05-18: import from the single source of truth so this file
# never drifts again. Was previously hardcoded `2000` — fixed alongside
# the global rate change to $1 = 1,000 ₵.
from services.coin_wallet import COINS_PER_USD as COINS_PER_DOLLAR  # noqa: E402, PLC0415


# ==================== HELPER FUNCTIONS ====================

def calculate_community_odds(pool_distribution: Dict[str, int], total_pool: int, house_edge_percent: int) -> Dict[str, float]:
    """
    Calculate odds based on community betting distribution (parimutuel system)
    
    Example:
    - Player A has 700 coins bet (70%)
    - Player B has 300 coins bet (30%)
    - Total pool: 1000 coins
    - House takes 5%: 50 coins
    - Prize pool: 950 coins
    
    If Player A wins: 950 / 700 = 1.36x payout
    If Player B wins: 950 / 300 = 3.17x payout
    """
    if total_pool == 0:
        # No bets yet - return equal odds
        return {outcome: 2.0 for outcome in pool_distribution.keys()}
    
    prize_pool = total_pool * (100 - house_edge_percent) / 100
    odds = {}
    
    for outcome, amount_bet in pool_distribution.items():
        if amount_bet > 0:
            # Payout multiplier = prize_pool / amount_bet_on_outcome
            odds[outcome] = round(prize_pool / amount_bet, 2)
        else:
            # No bets on this outcome yet - very high odds
            odds[outcome] = 10.0  # Max odds
    
    return odds


async def get_or_create_betting_pool(game_id: str, game_type: str, possible_outcomes: List[str]) -> dict:
    """Get existing betting pool or create new one"""
    db = get_database()
    
    pool = await db.betting_pools.find_one({"game_id": game_id}, {"_id": 0})
    
    if not pool:
        # Create new pool
        pool = {
            "game_id": game_id,
            "game_type": game_type,
            "total_pool": 0,
            "house_edge_percent": HOUSE_EDGE,
            "prize_pool": 0,
            "predictions": {outcome: 0 for outcome in possible_outcomes},
            "current_odds": {outcome: 2.0 for outcome in possible_outcomes},  # Start with equal odds
            "bet_count": 0,
            "status": "open",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        # Make a copy before insert to avoid _id being added to our return value
        pool_copy = pool.copy()
        await db.betting_pools.insert_one(pool)
        return pool_copy
    
    return pool


async def update_pool_odds(game_id: str) -> Dict[str, Any]:
    """Recalculate and update odds after new bet placed"""
    db = get_database()
    
    pool = await db.betting_pools.find_one({"game_id": game_id}, {"_id": 0})
    if not pool:
        return
    
    # Calculate new odds
    new_odds = calculate_community_odds(
        pool["predictions"],
        pool["total_pool"],
        pool["house_edge_percent"]
    )
    
    # Calculate prize pool after house cut
    prize_pool = int(pool["total_pool"] * (100 - HOUSE_EDGE) / 100)
    
    # Update pool
    await db.betting_pools.update_one(
        {"game_id": game_id},
        {
            "$set": {
                "current_odds": new_odds,
                "prize_pool": prize_pool,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )


# ==================== ENDPOINTS ====================

@router.post("/place-bet")
async def place_bet(bet_request: PlaceBetRequest, request: Request) -> Dict[str, Any]:
    """Place a bet on a game outcome"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Validate bet amount
    if bet_request.amount < MIN_BET:
        raise HTTPException(status_code=400, detail=f"Minimum bet is {MIN_BET} coins")
    if bet_request.amount > MAX_BET:
        raise HTTPException(status_code=400, detail=f"Maximum bet is {MAX_BET} coins")
    
    # Check user balance
    balance = await get_user_balance(current_user.user_id)
    if balance < bet_request.amount:
        raise HTTPException(status_code=400, detail="Insufficient coins")
    
    db = get_database()
    
    # Get betting pool
    pool = await db.betting_pools.find_one({"game_id": bet_request.game_id}, {"_id": 0})
    if not pool:
        raise HTTPException(status_code=404, detail="Betting pool not found. Game may not have started yet.")
    
    if pool["status"] != "open":
        raise HTTPException(status_code=400, detail="Betting is closed for this game")
    
    # Check if user already bet on this game
    existing_bet = await db.bets.find_one({
        "user_id": current_user.user_id,
        "game_id": bet_request.game_id,
        "status": "pending"
    })
    if existing_bet:
        raise HTTPException(status_code=400, detail="You already have a bet on this game")
    
    # Get current odds for this prediction
    current_odds = pool["current_odds"].get(bet_request.prediction, 2.0)
    potential_payout = round(bet_request.amount * current_odds, 2)
    
    # Deduct coins from user
    await deduct_coins(
        current_user.user_id,
        bet_request.amount,
        "spend_bet",
        f"Bet {bet_request.amount} coins on {bet_request.game_type} game",
        {"game_id": bet_request.game_id, "prediction": bet_request.prediction}
    )
    
    # Create bet
    bet = {
        "bet_id": str(uuid.uuid4()),
        "user_id": current_user.user_id,
        "username": current_user.name,
        "game_id": bet_request.game_id,
        "game_type": bet_request.game_type,
        "prediction": bet_request.prediction,
        "amount": bet_request.amount,
        "odds": current_odds,
        "potential_payout": potential_payout,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "settled_at": None
    }
    # Make a copy before insert to avoid _id being added to our return value
    bet_copy = bet.copy()
    await db.bets.insert_one(bet)
    
    # Update betting pool
    await db.betting_pools.update_one(
        {"game_id": bet_request.game_id},
        {
            "$inc": {
                "total_pool": bet_request.amount,
                f"predictions.{bet_request.prediction}": bet_request.amount,
                "bet_count": 1
            }
        }
    )
    
    # Recalculate odds
    await update_pool_odds(bet_request.game_id)
    
    # Get updated pool for response
    updated_pool = await db.betting_pools.find_one({"game_id": bet_request.game_id}, {"_id": 0})
    
    return {
        "message": f"Bet placed! {bet_request.amount} coins on {bet_request.prediction} 🎰",
        "bet": bet_copy,
        "new_balance": await get_user_balance(current_user.user_id),
        "updated_odds": updated_pool["current_odds"]
    }


@router.get("/pool/{game_id}")
async def get_betting_pool(game_id: str) -> Dict[str, Any]:
    """Get current betting pool and odds for a game"""
    db = get_database()
    
    pool = await db.betting_pools.find_one({"game_id": game_id}, {"_id": 0})
    if not pool:
        raise HTTPException(status_code=404, detail="Betting pool not found")
    
    # Get all bets for this game
    bets = await db.bets.find({"game_id": game_id}, {"_id": 0}).to_list(1000)
    
    return {
        "pool": pool,
        "total_bets": len(bets),
        "recent_bets": bets[:10]  # Last 10 bets
    }


@router.post("/create-pool")
async def create_betting_pool(
    request: Request,
    game_id: str = Query(...),
    game_type: str = Query(...),
    possible_outcomes: List[str] = Query(...)
):
    """Create a new betting pool for a game (called by game endpoints)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    pool = await get_or_create_betting_pool(game_id, game_type, possible_outcomes)
    
    return {
        "message": "Betting pool created! 🎰",
        "pool": pool
    }


@router.post("/settle-bets/{game_id}")
async def settle_bets(game_id: str, winning_outcome: str, request: Request) -> Dict[str, Any]:
    """Settle all bets for a completed game (called by game endpoints)"""
    # This should be called by the game endpoint when game finishes
    # For now, allow any authenticated user (in production, restrict to game server)
    
    db = get_database()
    
    # Get betting pool
    pool = await db.betting_pools.find_one({"game_id": game_id}, {"_id": 0})
    if not pool:
        raise HTTPException(status_code=404, detail="Betting pool not found")
    
    if pool["status"] == "settled":
        raise HTTPException(status_code=400, detail="Bets already settled for this game")
    
    # Mark pool as settled
    await db.betting_pools.update_one(
        {"game_id": game_id},
        {"$set": {"status": "settled", "winning_outcome": winning_outcome}}
    )
    
    # Get all pending bets
    bets = await db.bets.find({"game_id": game_id, "status": "pending"}, {"_id": 0}).to_list(1000)
    
    winners = []
    losers = []
    
    for bet in bets:
        if bet["prediction"] == winning_outcome:
            # Winner - calculate payout
            payout = int(bet["potential_payout"])
            
            # Award payout
            await add_coins(
                bet["user_id"],
                payout,
                "earn_bet_win",
                f"Won bet on {game_id} (+{payout} coins)",
                {"game_id": game_id, "bet_id": bet["bet_id"], "original_bet": bet["amount"]}
            )
            
            # Update bet status
            await db.bets.update_one(
                {"bet_id": bet["bet_id"]},
                {
                    "$set": {
                        "status": "won",
                        "payout": payout,
                        "settled_at": datetime.now(timezone.utc).isoformat()
                    }
                }
            )
            
            winners.append({
                "user_id": bet["user_id"],
                "username": bet["username"],
                "bet_amount": bet["amount"],
                "payout": payout,
                "profit": payout - bet["amount"]
            })
        else:
            # Loser
            await db.bets.update_one(
                {"bet_id": bet["bet_id"]},
                {
                    "$set": {
                        "status": "lost",
                        "payout": 0,
                        "settled_at": datetime.now(timezone.utc).isoformat()
                    }
                }
            )
            
            losers.append({
                "user_id": bet["user_id"],
                "username": bet["username"],
                "bet_amount": bet["amount"]
            })
    
    # Calculate house profit
    total_house_profit = int(pool["total_pool"] * HOUSE_EDGE / 100)
    
    return {
        "message": f"Bets settled! {len(winners)} winners, {len(losers)} losers",
        "game_id": game_id,
        "winning_outcome": winning_outcome,
        "total_pool": pool["total_pool"],
        "prize_pool": pool["prize_pool"],
        "house_profit": total_house_profit,
        "winners": winners,
        "losers": losers
    }


@router.get("/my-bets")
async def get_my_bets(request: Request, status: Optional[str] = None, limit: int = 50) -> Dict[str, Any]:
    """Get user's betting history"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    query = {"user_id": current_user.user_id}
    if status:
        query["status"] = status
    
    bets = await db.bets.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Calculate stats
    total_bet = sum(bet["amount"] for bet in bets)
    total_won = sum(bet.get("payout", 0) for bet in bets if bet["status"] == "won")
    total_profit = total_won - total_bet
    
    wins = len([b for b in bets if b["status"] == "won"])
    losses = len([b for b in bets if b["status"] == "lost"])
    pending = len([b for b in bets if b["status"] == "pending"])
    
    return {
        "bets": bets,
        "stats": {
            "total_bets": len(bets),
            "wins": wins,
            "losses": losses,
            "pending": pending,
            "total_bet": total_bet,
            "total_won": total_won,
            "profit": total_profit,
            "win_rate": round(wins / (wins + losses) * 100, 1) if (wins + losses) > 0 else 0
        }
    }


@router.get("/active-pools")
async def get_active_pools(game_type: Optional[str] = None, limit: int = 20) -> Dict[str, Any]:
    """Get currently active betting pools"""
    db = get_database()
    
    query = {"status": "open"}
    if game_type:
        query["game_type"] = game_type
    
    pools = await db.betting_pools.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {
        "pools": pools,
        "total": len(pools)
    }

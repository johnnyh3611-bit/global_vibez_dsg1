from fastapi import APIRouter, HTTPException, Request
from typing import Optional, Dict, Any
from pydantic import BaseModel
from utils.database import get_database, get_current_user
from utils.baccarat_game import BaccaratGame
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/baccarat", tags=["baccarat"])


# ==================== MODELS ====================

class BaccaratBet(BaseModel):
    bet_type: str  # 'player', 'banker', 'tie'
    bet_amount: int
    game_mode: str = 'standard'  # 'standard', 'speed', 'vip'


class BaccaratGameResponse(BaseModel):
    game_id: str
    player_hand: list
    banker_hand: list
    player_score: int
    banker_score: int
    winner: Optional[str] = None
    phase: str
    bet_type: str
    bet_amount: int
    payout: int = 0


# ==================== ENDPOINTS ====================

@router.post("/play", response_model=BaccaratGameResponse)
async def play_baccarat(bet_data: BaccaratBet, request: Request) -> Dict[str, Any]:
    """
    Play a Baccarat hand
    - Validates bet
    - Deals cards following casino rules
    - Applies third-card drawing rules
    - Determines winner and payout
    """
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Validate bet type
    if bet_data.bet_type not in ['player', 'banker', 'tie']:
        raise HTTPException(status_code=400, detail="Invalid bet type. Must be 'player', 'banker', or 'tie'")
    
    # Validate bet amount
    if bet_data.bet_amount <= 0:
        raise HTTPException(status_code=400, detail="Bet amount must be positive")
    
    # Check user balance
    user = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    if not user or user.get('credits_balance', 0) < bet_data.bet_amount:
        raise HTTPException(status_code=400, detail="Insufficient credits")
    
    # Deduct bet from balance
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$inc": {"credits_balance": -bet_data.bet_amount}}
    )
    
    # Create game instance
    game = BaccaratGame()
    
    # Deal initial cards
    game.deal_initial_cards()
    
    # Apply third-card rules and determine winner
    result = game.apply_third_card_rules()
    
    # Calculate payout
    payout = game.calculate_payout(bet_data.bet_type, bet_data.bet_amount)
    
    # Update user balance with payout
    if payout > 0:
        await db.users.update_one(
            {"user_id": current_user.user_id},
            {"$inc": {"credits_balance": payout}}
        )
    
    # Calculate profit/loss
    profit = payout - bet_data.bet_amount
    
    # Create game record
    game_id = f"baccarat_{uuid.uuid4().hex[:12]}"
    game_doc = {
        "game_id": game_id,
        "game_type": "baccarat",
        "user_id": current_user.user_id,
        "bet_type": bet_data.bet_type,
        "bet_amount": bet_data.bet_amount,
        "player_hand": result['player_hand'],
        "banker_hand": result['banker_hand'],
        "player_score": result['player_score'],
        "banker_score": result['banker_score'],
        "winner": result['winner'],
        "payout": payout,
        "profit": profit,
        "actions": result['actions'],
        "game_mode": bet_data.game_mode,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "completed"
    }
    
    await db.baccarat_games.insert_one(game_doc)
    
    # Record transaction
    await db.credit_transactions.insert_one({
        "user_id": current_user.user_id,
        "amount": profit,
        "type": "baccarat_game",
        "game_id": game_id,
        "description": f"Baccarat - {bet_data.bet_type.capitalize()} {'Win' if profit > 0 else 'Loss'}: {abs(profit)} credits",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return BaccaratGameResponse(
        game_id=game_id,
        player_hand=result['player_hand'],
        banker_hand=result['banker_hand'],
        player_score=result['player_score'],
        banker_score=result['banker_score'],
        winner=result['winner'],
        phase='finished',
        bet_type=bet_data.bet_type,
        bet_amount=bet_data.bet_amount,
        payout=payout
    )


@router.get("/history")
async def get_baccarat_history(request: Request, limit: int = 20) -> Dict[str, Any]:
    """Get user's Baccarat game history"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    games = await db.baccarat_games.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {
        "games": games,
        "total": len(games)
    }


@router.get("/stats")
async def get_baccarat_stats(request: Request) -> Dict[str, Any]:
    """Get user's Baccarat statistics"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Get all user games
    games = await db.baccarat_games.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).to_list(1000)
    
    if not games:
        return {
            "total_games": 0,
            "total_wagered": 0,
            "total_won": 0,
            "total_profit": 0,
            "win_rate": 0,
            "favorite_bet": None,
            "biggest_win": 0,
            "biggest_loss": 0
        }
    
    total_wagered = sum(g['bet_amount'] for g in games)
    total_profit = sum(g.get('profit', 0) for g in games)
    wins = [g for g in games if g.get('profit', 0) > 0]
    
    # Favorite bet type
    bet_counts = {}
    for game in games:
        bet_type = game['bet_type']
        bet_counts[bet_type] = bet_counts.get(bet_type, 0) + 1
    favorite_bet = max(bet_counts, key=bet_counts.get) if bet_counts else None
    
    # Biggest win/loss
    profits = [g.get('profit', 0) for g in games]
    biggest_win = max(profits) if profits else 0
    biggest_loss = min(profits) if profits else 0
    
    return {
        "total_games": len(games),
        "total_wagered": total_wagered,
        "total_won": len(wins),
        "total_profit": total_profit,
        "win_rate": round((len(wins) / len(games)) * 100, 2),
        "favorite_bet": favorite_bet,
        "biggest_win": biggest_win,
        "biggest_loss": biggest_loss,
        "bet_distribution": bet_counts
    }


@router.get("/game/{game_id}")
async def get_baccarat_game(game_id: str, request: Request) -> Dict[str, Any]:
    """Get specific Baccarat game details"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    game = await db.baccarat_games.find_one(
        {"game_id": game_id, "user_id": current_user.user_id},
        {"_id": 0}
    )
    
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    return game


@router.get("/leaderboard")
async def get_baccarat_leaderboard(limit: int = 10) -> Dict[str, Any]:
    """Get top Baccarat players by profit"""
    db = get_database()
    
    # Aggregate user profits
    pipeline = [
        {"$group": {
            "_id": "$user_id",
            "total_profit": {"$sum": "$profit"},
            "games_played": {"$sum": 1},
            "total_wagered": {"$sum": "$bet_amount"}
        }},
        {"$sort": {"total_profit": -1}},
        {"$limit": limit}
    ]
    
    results = await db.baccarat_games.aggregate(pipeline).to_list(limit)
    
    # Get user details
    leaderboard = []
    for entry in results:
        user = await db.users.find_one(
            {"user_id": entry["_id"]},
            {"_id": 0, "user_id": 1, "username": 1}
        )
        
        if user:
            leaderboard.append({
                "user_id": entry["_id"],
                "username": user.get("username", "Anonymous"),
                "total_profit": entry["total_profit"],
                "games_played": entry["games_played"],
                "total_wagered": entry["total_wagered"]
            })
    
    return {"leaderboard": leaderboard}

"""
Universal Forfeit/Penalty System for Multiplayer Games

When a player quits/disconnects mid-game:
- They forfeit their entry fee
- They pay an additional 15% penalty to the house
- Applies to ALL multiplayer games
"""

from utils.database import get_database
from datetime import datetime, timezone


async def apply_forfeit_penalty(
    user_id: str,
    game_id: str,
    game_type: str,
    entry_fee: float,
    reason: str = "quit_mid_game"
) -> dict:
    """
    Apply forfeit penalty when player quits mid-game
    
    Args:
        user_id: ID of player who quit
        game_id: ID of the game
        game_type: Type of game (bid_whist, poker, etc.)
        entry_fee: Entry fee paid to join the game
        reason: Reason for forfeit (quit_mid_game, disconnected, timeout)
    
    Returns:
        dict with penalty details
    """
    db = get_database()
    
    # Calculate penalty (15% of entry fee)
    penalty_amount = entry_fee * 0.15
    total_deduction = entry_fee + penalty_amount
    
    # Deduct from user wallet
    wallet_result = await db.wallets.update_one(
        {"user_id": user_id},
        {"$inc": {"balance": -total_deduction}}
    )
    
    if wallet_result.modified_count == 0:
        # Wallet not found or insufficient balance
        return {
            "success": False,
            "error": "Wallet update failed"
        }
    
    # Record forfeit transaction
    forfeit_record = {
        "user_id": user_id,
        "game_id": game_id,
        "game_type": game_type,
        "entry_fee": entry_fee,
        "penalty_amount": penalty_amount,
        "total_forfeited": total_deduction,
        "reason": reason,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.game_forfeits.insert_one(forfeit_record)
    
    # Add penalty to house revenue
    await db.platform_revenue.insert_one({
        "source": "forfeit_penalty",
        "game_type": game_type,
        "game_id": game_id,
        "user_id": user_id,
        "amount": penalty_amount,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    # Create wallet transaction record
    await db.wallet_transactions.insert_one({
        "user_id": user_id,
        "type": "forfeit",
        "amount": -total_deduction,
        "description": f"Game forfeit: {game_type} (Entry: ${entry_fee:.2f} + Penalty: ${penalty_amount:.2f})",
        "game_id": game_id,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "entry_fee_forfeited": entry_fee,
        "penalty": penalty_amount,
        "total_deducted": total_deduction,
        "message": f"Forfeited ${entry_fee:.2f} + ${penalty_amount:.2f} penalty = ${total_deduction:.2f} total"
    }


async def handle_player_quit(
    user_id: str,
    game_id: str,
    game_type: str
) -> dict:
    """
    Handle when a player quits a multiplayer game
    
    Determines entry fee and applies forfeit if game is in progress
    """
    db = get_database()
    
    # Find game based on type
    game_collection = f"{game_type}_games"
    game = await db[game_collection].find_one({"game_id": game_id}, {"_id": 0})
    
    if not game:
        return {"success": False, "error": "Game not found"}
    
    # Check if game is in progress (not finished/waiting)
    if game.get("status") not in ["active", "in_progress", "playing"]:
        # Game not started or already finished - no penalty
        return {
            "success": True,
            "penalty_applied": False,
            "message": "No penalty - game not in progress"
        }
    
    # Get entry fee/wager
    entry_fee = game.get("wager", 0) or game.get("entry_fee", 0) or game.get("buy_in", 0)
    
    if entry_fee == 0:
        # Free game - no forfeit
        return {
            "success": True,
            "penalty_applied": False,
            "message": "No penalty - free game"
        }
    
    # Apply forfeit penalty
    result = await apply_forfeit_penalty(
        user_id=user_id,
        game_id=game_id,
        game_type=game_type,
        entry_fee=entry_fee,
        reason="quit_mid_game"
    )
    
    # Mark player as forfeited in game
    await db[game_collection].update_one(
        {"game_id": game_id},
        {
            "$set": {
                f"forfeits.{user_id}": {
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "amount": result.get("total_deducted", 0)
                }
            }
        }
    )
    
    return result


async def get_user_forfeit_history(user_id: str, limit: int = 10) -> list:
    """Get user's forfeit history"""
    db = get_database()
    
    forfeits = await db.game_forfeits.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    return forfeits

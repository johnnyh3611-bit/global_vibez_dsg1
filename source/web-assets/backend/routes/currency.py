"""
Bet Verification & Currency Security System
Handles Global Vibez Coin locking, verification, and payouts
"""
from fastapi import APIRouter, HTTPException
from typing import Optional, Dict, Any
import uuid
from datetime import datetime

router = APIRouter()

# Mock database - replace with actual MongoDB queries
MOCK_USER_BALANCES = {
    "user_7721": 5000.0,
    "demo_user": 10000.0
}

# Active locked funds
LOCKED_FUNDS = {}

# ============================================================================
# BET VERIFICATION
# ============================================================================

@router.post("/verify-bet")
async def verify_bet(
    player_id: str,
    amount: float,
    table_id: str,
    game_type: str,
    transaction_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Verify and lock funds for a bet
    Called by UE5 server before allowing player to bet
    """
    
    # 1. Check user balance
    user_balance = MOCK_USER_BALANCES.get(player_id, 0.0)
    
    if user_balance < amount:
        raise HTTPException(
            status_code=400, 
            detail=f"Insufficient Global Vibez Coins. Balance: {user_balance}, Required: {amount}"
        )
    
    # 2. Generate lock ID
    lock_id = str(uuid.uuid4())
    if not transaction_id:
        transaction_id = f"gv_{uuid.uuid4().hex[:8]}"
    
    # 3. Lock the funds
    LOCKED_FUNDS[lock_id] = {
        "player_id": player_id,
        "amount": amount,
        "table_id": table_id,
        "game_type": game_type,
        "locked_at": datetime.now().isoformat(),
        "transaction_id": transaction_id
    }
    
    # 4. Deduct from available balance (temporarily)
    MOCK_USER_BALANCES[player_id] -= amount
    
    return {
        "status": "APPROVED",
        "lock_id": lock_id,
        "transaction_id": transaction_id,
        "new_pending_balance": MOCK_USER_BALANCES[player_id],
        "message": "Bet secured. Good luck!"
    }

@router.post("/release-bet/{lock_id}")
async def release_bet(lock_id: str, winner_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Release locked funds after hand completion
    If winner_id is provided, transfer funds to winner
    Otherwise, return funds to original player
    """
    if lock_id not in LOCKED_FUNDS:
        raise HTTPException(status_code=404, detail="Lock ID not found")
    
    lock_data = LOCKED_FUNDS[lock_id]
    original_player = lock_data['player_id']
    amount = lock_data['amount']
    
    if winner_id:
        # Transfer to winner
        if winner_id not in MOCK_USER_BALANCES:
            MOCK_USER_BALANCES[winner_id] = 0.0
        MOCK_USER_BALANCES[winner_id] += amount
        
        result = {
            "status": "WON",
            "winner_id": winner_id,
            "amount_won": amount,
            "new_balance": MOCK_USER_BALANCES[winner_id]
        }
    else:
        # Return to original player
        MOCK_USER_BALANCES[original_player] += amount
        
        result = {
            "status": "RETURNED",
            "player_id": original_player,
            "amount_returned": amount,
            "new_balance": MOCK_USER_BALANCES[original_player]
        }
    
    # Clear lock
    del LOCKED_FUNDS[lock_id]
    
    return result

@router.get("/balance/{player_id}")
async def get_balance(player_id: str) -> Dict[str, Any]:
    """Get player's Global Vibez Coin balance"""
    balance = MOCK_USER_BALANCES.get(player_id, 0.0)
    
    # Calculate locked amount
    locked_amount = sum(
        lock['amount'] 
        for lock in LOCKED_FUNDS.values() 
        if lock['player_id'] == player_id
    )
    
    return {
        "player_id": player_id,
        "available_balance": balance,
        "locked_balance": locked_amount,
        "total_balance": balance + locked_amount
    }

@router.post("/balance/{player_id}/add")
async def add_balance(player_id: str, amount: float) -> Dict[str, Any]:
    """Add funds to player balance (admin/purchase endpoint)"""
    if player_id not in MOCK_USER_BALANCES:
        MOCK_USER_BALANCES[player_id] = 0.0
    
    MOCK_USER_BALANCES[player_id] += amount
    
    return {
        "success": True,
        "new_balance": MOCK_USER_BALANCES[player_id]
    }

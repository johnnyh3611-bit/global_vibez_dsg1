"""
Just for the Night - Premium Room System
Token-gated rooms with blur-to-reveal mechanics and customizable AI dealers
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from utils.database import get_database, get_current_user
from models import User
import uuid

router = APIRouter(prefix="/just-for-the-night", tags=["Just for the Night Rooms"])

# ==================== MODELS ====================

class DealerType(str):
    FOUNDER_AI = "founder_ai"
    PERSONAL_AVATAR = "personal_avatar"
    GHOST_DEALER = "ghost_dealer"

class ChallengeGame(str):
    POKER = "poker"
    BLACKJACK = "blackjack"
    ROULETTE = "roulette"

class RoomSettings(BaseModel):
    dealer_type: str = DealerType.FOUNDER_AI
    challenge_game: str = ChallengeGame.BLACKJACK
    entry_tokens: int = 100
    challenge_difficulty: str = "medium"  # easy, medium, hard
    room_theme: str = "neon_nights"
    enable_watermark: bool = True

class CreateRoomRequest(BaseModel):
    title: str
    description: Optional[str] = ""
    preview_image_url: Optional[str] = None
    stream_url: str  # Video URL (pre-recorded or live stream)
    settings: RoomSettings

class UpdateRoomSettingsRequest(BaseModel):
    room_id: str
    settings: RoomSettings

class JoinRoomRequest(BaseModel):
    room_id: str
    visitor_id: str

class RoomResponse(BaseModel):
    room_id: str
    owner_id: str
    owner_name: str
    title: str
    description: str
    preview_image_url: Optional[str]
    entry_tokens: int
    dealer_type: str
    challenge_game: str
    is_active: bool
    total_visits: int
    created_at: str

# ==================== TOKEN WALLET HELPERS ====================
#
# JFTN uses the canonical platform wallet field `credits_balance`
# (same field used by vibe_wallet, subscriptions, ambassador commission,
# Stripe top-ups, etc.). This means 1 ₵ ↔ 1 JFTN token — no separate
# ledger to top up. Users see one wallet across the whole app.

WALLET_FIELD = "credits_balance"


async def get_user_balance(db, user_id: str) -> int:
    """Get user's vibe-credit balance (1 ₵ = 1 JFTN entry token)."""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        return 0
    return int(user.get(WALLET_FIELD, 0) or 0)

async def deduct_tokens(db, user_id: str, amount: int) -> bool:
    """Deduct tokens from user's balance. Atomic: only succeeds if the
    user has enough credits, preventing the classic check-then-deduct
    race where two simultaneous buy-ins could overdraw the wallet."""
    result = await db.users.update_one(
        {"user_id": user_id, WALLET_FIELD: {"$gte": amount}},
        {"$inc": {WALLET_FIELD: -amount}},
    )
    return result.modified_count > 0

async def add_tokens(db, user_id: str, amount: int) -> Dict[str, Any]:
    """Add tokens to user's balance"""
    await db.users.update_one(
        {"user_id": user_id},
        {"$inc": {WALLET_FIELD: amount}},
        upsert=True
    )

async def add_to_treasury(db, amount: int) -> Dict[str, Any]:
    """Add platform revenue to treasury"""
    await db.platform_treasury.insert_one({
        "amount": amount,
        "source": "just_for_the_night",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

# ==================== ROOM MANAGEMENT ====================

@router.post("/rooms/create")
async def create_room(
    request: CreateRoomRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Create a new 'Just for the Night' room.
    Creator sets entry price, dealer type, and challenge game.
    """
    db = get_database()
    
    room_id = f"room_{uuid.uuid4().hex[:12]}"
    
    room_data = {
        "room_id": room_id,
        "owner_id": current_user.user_id,
        "owner_name": current_user.name,
        "title": request.title,
        "description": request.description,
        "preview_image_url": request.preview_image_url,
        "stream_url": request.stream_url,
        "settings": request.settings.model_dump(),
        "is_active": True,
        "total_visits": 0,
        "total_revenue": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.jftn_rooms.insert_one(room_data)
    
    return {
        "success": True,
        "room_id": room_id,
        "message": "Room created successfully!",
        "share_url": f"/just-for-the-night/room/{room_id}"
    }

@router.get("/rooms/discover")
async def discover_rooms(
    limit: int = 20,
    dealer_type: Optional[str] = None,
    min_tokens: Optional[int] = None,
    max_tokens: Optional[int] = None
) -> Dict[str, Any]:
    """
    Browse active 'Just for the Night' rooms.
    Users can filter by dealer type and token price.
    """
    db = get_database()
    
    query = {"is_active": True}
    
    if dealer_type:
        query["settings.dealer_type"] = dealer_type
    
    if min_tokens is not None:
        query["settings.entry_tokens"] = {"$gte": min_tokens}
    
    if max_tokens is not None:
        if "settings.entry_tokens" in query:
            query["settings.entry_tokens"]["$lte"] = max_tokens
        else:
            query["settings.entry_tokens"] = {"$lte": max_tokens}
    
    rooms = await db.jftn_rooms.find(query, {"_id": 0, "stream_url": 0}).sort(
        "created_at", -1
    ).limit(limit).to_list(limit)
    
    return {
        "success": True,
        "rooms": rooms,
        "total": len(rooms)
    }

@router.get("/rooms/{room_id}")
async def get_room_details(room_id: str) -> Dict[str, Any]:
    """Get room details (preview only, no stream URL until payment)"""
    db = get_database()
    
    room = await db.jftn_rooms.find_one(
        {"room_id": room_id},
        {"_id": 0, "stream_url": 0}  # Hide stream URL until paid
    )
    
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    return {
        "success": True,
        "room": room
    }

@router.post("/rooms/join-transaction")
async def process_room_entry(
    request: JoinRoomRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Process token payment and grant access to room.
    
    Flow:
    1. Deduct tokens from visitor
    2. Calculate 70/30 split (Creator/Platform)
    3. Distribute funds
    4. Grant room access
    5. Return challenge game configuration
    """
    db = get_database()
    
    # Get room details
    room = await db.jftn_rooms.find_one({"room_id": request.room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if not room.get("is_active"):
        raise HTTPException(status_code=400, detail="Room is not active")
    
    token_amount = room["settings"]["entry_tokens"]
    
    # 1. Deduct tokens from visitor
    success = await deduct_tokens(db, current_user.user_id, token_amount)
    if not success:
        visitor_balance = await get_user_balance(db, current_user.user_id)
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance. You have {visitor_balance} tokens, need {token_amount}"
        )
    
    # 2. Calculate Revenue Split (70% to Creator, 30% to Global Vibez)
    creator_payout = int(token_amount * 0.70)
    platform_cut = token_amount - creator_payout
    
    # 3. Distribute funds
    await add_tokens(db, room["owner_id"], creator_payout)
    await add_to_treasury(db, platform_cut)
    
    # Update room stats
    await db.jftn_rooms.update_one(
        {"room_id": request.room_id},
        {
            "$inc": {"total_visits": 1, "total_revenue": token_amount}
        }
    )
    
    # 4. Record transaction
    transaction_id = f"txn_{uuid.uuid4().hex[:12]}"
    transaction = {
        "transaction_id": transaction_id,
        "room_id": request.room_id,
        "visitor_id": current_user.user_id,
        "owner_id": room["owner_id"],
        "amount": token_amount,
        "creator_payout": creator_payout,
        "platform_cut": platform_cut,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "challenge_completed": False
    }
    await db.jftn_transactions.insert_one(transaction)

    # Profit-share accrual — +1 stake for the visitor.
    try:
        from routes.profit_share import accrue_stake
        await accrue_stake(
            current_user.user_id, "jftn_room_visited",
            meta={"room_id": request.room_id, "owner_id": room["owner_id"]},
        )
        # Creator stake bonus — +30 stakes per ₵ that landed in the
        # creator's wallet, treating ₵→USD at 100:1 (matches deposit flow).
        creator_revenue_usd = int(round(creator_payout / 100.0))
        if creator_revenue_usd > 0 and room.get("owner_id"):
            await accrue_stake(
                room["owner_id"], "creator_revenue",
                amount=creator_revenue_usd,
                meta={"room_id": request.room_id, "txn_id": transaction_id},
            )
    except Exception:
        pass

    # 5. Return challenge configuration
    return {
        "status": "paid",
        "transaction_id": transaction_id,
        "next_step": "start_game_challenge",
        "challenge": {
            "game": room["settings"]["challenge_game"],
            "difficulty": room["settings"]["challenge_difficulty"],
            "dealer_type": room["settings"]["dealer_type"]
        },
        "room": {
            "stream_url": room["stream_url"],  # NOW reveal stream URL
            "watermark_id": current_user.user_id if room["settings"]["enable_watermark"] else None
        }
    }

@router.post("/rooms/challenge-completed")
async def mark_challenge_completed(
    transaction_id: str,
    won: bool,
    current_user: User = Depends(get_current_user)
):
    """
    Mark challenge as completed.
    If user wins, unlock full stream access.
    If Founder AI dealer is active, give bonus tokens on win.
    """
    db = get_database()
    
    # Get transaction
    transaction = await db.jftn_transactions.find_one(
        {"transaction_id": transaction_id},
        {"_id": 0}
    )
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    if transaction["visitor_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    # Mark as completed
    await db.jftn_transactions.update_one(
        {"transaction_id": transaction_id},
        {
            "$set": {
                "challenge_completed": True,
                "challenge_won": won,
                "completed_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Get room to check dealer type
    room = await db.jftn_rooms.find_one(
        {"room_id": transaction["room_id"]},
        {"_id": 0}
    )
    
    bonus_tokens = 0
    
    # VIP Ability: Founder AI Dealer gives bonus tokens on win
    if won and room["settings"]["dealer_type"] == DealerType.FOUNDER_AI:
        bonus_tokens = 50  # Founder AI bonus
        await add_tokens(db, current_user.user_id, bonus_tokens)
    
    return {
        "success": True,
        "challenge_won": won,
        "stream_unlocked": won,
        "bonus_tokens": bonus_tokens,
        "message": "🎉 Victory! The Founder rewards your skill." if bonus_tokens > 0 else (
            "🏆 Challenge won! Stream unlocked." if won else "😔 Challenge failed. Try again?"
        )
    }

# ==================== ROOM SETTINGS ====================

@router.patch("/rooms/{room_id}/settings")
async def update_room_settings(
    room_id: str,
    settings: RoomSettings,
    current_user: User = Depends(get_current_user)
):
    """Update room settings (dealer type, challenge game, etc.)"""
    db = get_database()
    
    # Verify ownership
    room = await db.jftn_rooms.find_one({"room_id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if room["owner_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="You don't own this room")
    
    await db.jftn_rooms.update_one(
        {"room_id": room_id},
        {
            "$set": {
                "settings": settings.model_dump(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {
        "success": True,
        "message": "Room settings updated successfully"
    }

@router.patch("/rooms/{room_id}/toggle")
async def toggle_room_active(
    room_id: str,
    is_active: bool,
    current_user: User = Depends(get_current_user)
):
    """Activate or deactivate a room"""
    db = get_database()
    
    room = await db.jftn_rooms.find_one({"room_id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if room["owner_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="You don't own this room")
    
    await db.jftn_rooms.update_one(
        {"room_id": room_id},
        {"$set": {"is_active": is_active}}
    )
    
    return {
        "success": True,
        "is_active": is_active
    }

# ==================== REVENUE DASHBOARD ====================

@router.get("/revenue/dashboard")
async def get_creator_revenue_dashboard(
    current_user: User = Depends(get_current_user)
):
    """
    Get creator's revenue dashboard.
    Shows total earnings, per-room breakdown, recent transactions.
    """
    db = get_database()
    
    # Get all creator's rooms
    rooms = await db.jftn_rooms.find(
        {"owner_id": current_user.user_id},
        {"_id": 0}
    ).to_list(100)
    
    # Calculate total earnings
    total_earnings = sum(room.get("total_revenue", 0) * 0.70 for room in rooms)
    total_visits = sum(room.get("total_visits", 0) for room in rooms)
    
    # Get recent transactions
    recent_transactions = await db.jftn_transactions.find(
        {"owner_id": current_user.user_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(20).to_list(20)
    
    # Per-room breakdown
    room_breakdown = [
        {
            "room_id": room["room_id"],
            "title": room["title"],
            "total_visits": room.get("total_visits", 0),
            "total_revenue": room.get("total_revenue", 0),
            "creator_earnings": int(room.get("total_revenue", 0) * 0.70),
            "entry_tokens": room["settings"]["entry_tokens"]
        }
        for room in rooms
    ]
    
    return {
        "success": True,
        "dashboard": {
            "total_earnings": int(total_earnings),
            "total_visits": total_visits,
            "active_rooms": sum(1 for r in rooms if r.get("is_active")),
            "total_rooms": len(rooms),
            "room_breakdown": room_breakdown,
            "recent_transactions": recent_transactions
        }
    }

@router.get("/revenue/analytics")
async def get_revenue_analytics(
    current_user: User = Depends(get_current_user),
    days: int = 30
):
    """Get revenue analytics over time"""
    db = get_database()
    
    # This would use aggregation pipeline for time-series data
    # For now, return basic stats
    
    transactions = await db.jftn_transactions.find(
        {"owner_id": current_user.user_id},
        {"_id": 0}
    ).to_list(1000)
    
    total_revenue = sum(t.get("creator_payout", 0) for t in transactions)
    avg_transaction = total_revenue / len(transactions) if transactions else 0
    
    return {
        "success": True,
        "analytics": {
            "period_days": days,
            "total_transactions": len(transactions),
            "total_revenue": total_revenue,
            "average_transaction": int(avg_transaction),
            "revenue_split": {
                "creator": total_revenue,
                "platform": sum(t.get("platform_cut", 0) for t in transactions)
            }
        }
    }

# ==================== MY ROOMS ====================

@router.get("/my-rooms")
async def get_my_rooms(current_user: User = Depends(get_current_user)):
    """Get all rooms owned by current user"""
    db = get_database()
    
    rooms = await db.jftn_rooms.find(
        {"owner_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {
        "success": True,
        "rooms": rooms,
        "total": len(rooms)
    }

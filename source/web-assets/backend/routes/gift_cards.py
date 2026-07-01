from fastapi import APIRouter, HTTPException, Request
from typing import Optional, Dict, Any
from pydantic import BaseModel
from utils.database import get_database, get_current_user
from datetime import datetime, timezone, timedelta
import uuid
import secrets
import string

router = APIRouter(prefix="/gift-cards", tags=["gift_cards"])


# ==================== MODELS ====================

class CreateGiftCard(BaseModel):
    credit_amount: float
    recipient_email: Optional[str] = None
    recipient_user_id: Optional[str] = None
    message: Optional[str] = None
    expires_days: int = 365  # Expires in 1 year by default

class RedeemGiftCard(BaseModel):
    code: str


# ==================== HELPERS ====================

def generate_gift_code():
    """Generate unique gift card code using cryptographically secure random"""
    return ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(12))


# ==================== ENDPOINTS ====================

@router.post("/create")
async def create_gift_card(gift_data: CreateGiftCard, request: Request) -> Dict[str, Any]:
    """Create a gift card"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Check sender has enough credits
    sender = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    if sender.get("credit_balance", 0) < gift_data.credit_amount:
        raise HTTPException(status_code=400, detail="Insufficient credits")
    
    # If recipient_user_id provided, verify user exists
    if gift_data.recipient_user_id:
        recipient = await db.users.find_one({"user_id": gift_data.recipient_user_id}, {"_id": 0})
        if not recipient:
            raise HTTPException(status_code=404, detail="Recipient not found")
    
    # Generate unique code
    code = generate_gift_code()
    while await db.gift_cards.find_one({"code": code}, {"_id": 0}):
        code = generate_gift_code()
    
    # Deduct credits from sender
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$inc": {"credit_balance": -gift_data.credit_amount}}
    )
    
    # Create gift card
    gift_card = {
        "gift_card_id": f"gift_{uuid.uuid4().hex[:12]}",
        "code": code,
        "created_by": current_user.user_id,
        "recipient_email": gift_data.recipient_email,
        "recipient_user_id": gift_data.recipient_user_id,
        "credit_amount": gift_data.credit_amount,
        "message": gift_data.message,
        "status": "active",
        "redeemed_by": None,
        "redeemed_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=gift_data.expires_days)).isoformat()
    }
    
    await db.gift_cards.insert_one(gift_card)
    
    # Create transaction
    transaction = {
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "user_id": current_user.user_id,
        "type": "gift_sent",
        "amount": -gift_data.credit_amount,
        "description": f"Created gift card: {code}",
        "reference_id": gift_card["gift_card_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.transactions.insert_one(transaction)
    
    return {
        "message": "Gift card created successfully",
        "gift_card": gift_card,
        "code": code
    }


@router.post("/redeem")
async def redeem_gift_card(redeem_data: RedeemGiftCard, request: Request) -> Dict[str, Any]:
    """Redeem a gift card"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Find gift card
    gift_card = await db.gift_cards.find_one({"code": redeem_data.code}, {"_id": 0})
    
    if not gift_card:
        raise HTTPException(status_code=404, detail="Gift card not found")
    
    if gift_card["status"] != "active":
        raise HTTPException(status_code=400, detail="Gift card already redeemed")
    
    # Check expiration
    if datetime.fromisoformat(gift_card["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Gift card expired")
    
    # Check if user-specific gift card
    if gift_card.get("recipient_user_id") and gift_card["recipient_user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="This gift card is for another user")
    
    # Add credits to user
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$inc": {"credit_balance": gift_card["credit_amount"]}}
    )
    
    # Mark gift card as redeemed
    await db.gift_cards.update_one(
        {"code": redeem_data.code},
        {"$set": {
            "status": "redeemed",
            "redeemed_by": current_user.user_id,
            "redeemed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Create transaction
    transaction = {
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "user_id": current_user.user_id,
        "type": "gift_received",
        "amount": gift_card["credit_amount"],
        "description": f"Redeemed gift card: {redeem_data.code}",
        "reference_id": gift_card["gift_card_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.transactions.insert_one(transaction)
    
    # Get updated balance
    user = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    
    return {
        "message": "Gift card redeemed successfully",
        "credits_added": gift_card["credit_amount"],
        "new_balance": user.get("credit_balance", 0),
        "sender_message": gift_card.get("message")
    }


@router.get("/sent")
async def get_sent_gift_cards(request: Request) -> Dict[str, Any]:
    """Get gift cards created by user"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    gift_cards = await db.gift_cards.find(
        {"created_by": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"gift_cards": gift_cards}


@router.get("/received")
async def get_received_gift_cards(request: Request) -> Dict[str, Any]:
    """Get gift cards redeemed by user"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    gift_cards = await db.gift_cards.find(
        {"redeemed_by": current_user.user_id},
        {"_id": 0}
    ).sort("redeemed_at", -1).to_list(100)
    
    return {"gift_cards": gift_cards}


@router.get("/{gift_card_id}")
async def get_gift_card(gift_card_id: str, request: Request) -> Dict[str, Any]:
    """Get gift card details"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    gift_card = await db.gift_cards.find_one({"gift_card_id": gift_card_id}, {"_id": 0})
    
    if not gift_card:
        raise HTTPException(status_code=404, detail="Gift card not found")
    
    # Only creator or recipient can view
    if gift_card["created_by"] != current_user.user_id and gift_card.get("redeemed_by") != current_user.user_id:
        if gift_card.get("recipient_user_id") != current_user.user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    return {"gift_card": gift_card}

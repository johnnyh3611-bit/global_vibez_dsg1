"""
Monetization & Creator Tools System
Virtual currency, tipping, gifts, premium subscriptions, and creator revenue
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Optional, Any
from datetime import datetime, timezone, timedelta
import uuid
from utils.database import get_database

router = APIRouter(prefix="/monetization", tags=["monetization"])

# Configuration
PLATFORM_FEE = 0.30  # 30% platform fee on tips/gifts
MIN_WITHDRAWAL = 50.00  # Minimum $50 USD for withdrawal

# Pydantic Models
class PurchaseCoins(BaseModel):
    user_id: str
    package: str  # "100", "500", "1000", "5000", "10000"
    payment_method: str = "card"

class SendTip(BaseModel):
    from_user_id: str
    to_user_id: str
    amount: int  # in coins
    message: Optional[str] = None
    content_id: Optional[str] = None  # MY VIBEZ post, stream, etc.

class SendGift(BaseModel):
    from_user_id: str
    to_user_id: str
    gift_id: str
    message: Optional[str] = None
    content_id: Optional[str] = None

class SubscribePremium(BaseModel):
    user_id: str
    tier: str  # "pro", "elite"

class WithdrawRequest(BaseModel):
    creator_id: str
    amount: float  # USD
    payment_method: str
    payment_details: Dict

# Gift Catalog
GIFT_CATALOG = {
    "rose": {"name": "Rose", "cost": 10, "emoji": "🌹", "animation": "fade"},
    "heart": {"name": "Heart", "cost": 25, "emoji": "❤️", "animation": "pulse"},
    "fire": {"name": "Fire", "cost": 50, "emoji": "🔥", "animation": "flame"},
    "diamond": {"name": "Diamond", "cost": 100, "emoji": "💎", "animation": "sparkle"},
    "crown": {"name": "Crown", "cost": 500, "emoji": "👑", "animation": "royal"},
    "trophy": {"name": "Trophy", "cost": 1000, "emoji": "🏆", "animation": "victory"}
}

# Subscription Tiers
SUBSCRIPTION_TIERS = {
    "pro": {
        "name": "Pro",
        "cost": 1000,  # coins/month
        "benefits": [
            "Custom profile badge",
            "Profile themes",
            "Ad-free experience",
            "Priority support",
            "2x daily coins bonus"
        ]
    },
    "elite": {
        "name": "Elite",
        "cost": 5000,  # coins/month
        "benefits": [
            "All Pro benefits",
            "Elite badge",
            "Exclusive profile frames",
            "Custom username color",
            "Priority matchmaking",
            "5x daily coins bonus",
            "Early access to features"
        ]
    }
}

# ========== VIRTUAL CURRENCY ==========

@router.post("/purchase-coins")
async def purchase_coins(request: PurchaseCoins) -> Dict[str, Any]:
    """Purchase coin packages"""
    try:
        db = get_database()
        
        # Coin packages with bonus
        packages = {
            "100": {"coins": 100, "price": 0.99, "bonus": 0},
            "500": {"coins": 500, "price": 4.99, "bonus": 50},
            "1000": {"coins": 1000, "price": 9.99, "bonus": 150},
            "5000": {"coins": 5000, "price": 49.99, "bonus": 1000},
            "10000": {"coins": 10000, "price": 99.99, "bonus": 2500}
        }
        
        if request.package not in packages:
            raise HTTPException(status_code=400, detail="Invalid package")
        
        package_data = packages[request.package]
        total_coins = package_data["coins"] + package_data["bonus"]
        
        # Update user balance
        await db.users.update_one(
            {"user_id": request.user_id},
            {
                "$inc": {"coins": total_coins},
                "$set": {"last_purchase": datetime.now(timezone.utc).isoformat()}
            }
        )
        
        # Record transaction
        transaction = {
            "id": f"txn_{uuid.uuid4().hex[:12]}",
            "user_id": request.user_id,
            "type": "purchase",
            "amount": total_coins,
            "price_usd": package_data["price"],
            "payment_method": request.payment_method,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        await db.transactions.insert_one(transaction)
        
        return {
            "success": True,
            "coins_added": total_coins,
            "bonus": package_data["bonus"],
            "transaction_id": transaction["id"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/balance/{user_id}")
async def get_balance(user_id: str) -> Dict[str, Any]:
    """Get user's coin and gem balance"""
    try:
        db = get_database()
        
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return {
            "success": True,
            "coins": user.get("coins", 0),
            "gems": user.get("gems", 0),
            "lifetime_spent": user.get("lifetime_spent", 0),
            "lifetime_earned": user.get("lifetime_earned", 0)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ========== TIPPING SYSTEM ==========

@router.post("/send-tip")
async def send_tip(request: SendTip) -> Dict[str, Any]:
    """Send tip to another user"""
    try:
        db = get_database()
        
        if request.amount < 10:
            raise HTTPException(status_code=400, detail="Minimum tip == 10 coins")
        
        if request.amount > 10000:
            raise HTTPException(status_code=400, detail="Maximum tip == 10,000 coins")
        
        # Check sender balance
        sender = await db.users.find_one({"user_id": request.from_user_id}, {"_id": 0})
        if not sender or sender.get("coins", 0) < request.amount:
            raise HTTPException(status_code=400, detail="Insufficient coins")
        
        # Check recipient exists
        recipient = await db.users.find_one({"user_id": request.to_user_id}, {"_id": 0})
        if not recipient:
            raise HTTPException(status_code=404, detail="Recipient not found")
        
        # Calculate platform fee and creator earnings
        platform_cut = int(request.amount * PLATFORM_FEE)
        creator_earnings = request.amount - platform_cut
        
        # Update balances
        await db.users.update_one(
            {"user_id": request.from_user_id},
            {
                "$inc": {
                    "coins": -request.amount,
                    "lifetime_spent": request.amount
                }
            }
        )
        
        await db.users.update_one(
            {"user_id": request.to_user_id},
            {
                "$inc": {
                    "coins": creator_earnings,
                    "lifetime_earned": creator_earnings
                }
            }
        )
        
        # Record transaction
        tip_record = {
            "id": f"tip_{uuid.uuid4().hex[:12]}",
            "from_user_id": request.from_user_id,
            "from_user_name": sender.get("name", "Anonymous"),
            "to_user_id": request.to_user_id,
            "to_user_name": recipient.get("name", "User"),
            "amount": request.amount,
            "creator_received": creator_earnings,
            "platform_fee": platform_cut,
            "message": request.message,
            "content_id": request.content_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        await db.transactions.insert_one(tip_record)
        
        # Create notification
        notification = {
            "id": f"notif_{uuid.uuid4().hex[:12]}",
            "user_id": request.to_user_id,
            "type": "tip_received",
            "title": "💰 You received a tip!",
            "message": f"{sender.get('name')} tipped you {creator_earnings} coins" + (f": {request.message}" if request.message else ""),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "read": False
        }
        
        await db.notifications.insert_one(notification)
        
        return {
            "success": True,
            "tip_id": tip_record["id"],
            "amount_sent": request.amount,
            "creator_received": creator_earnings,
            "platform_fee": platform_cut
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ========== VIRTUAL GIFTS ==========

@router.get("/gifts/catalog")
async def get_gift_catalog() -> Dict[str, Any]:
    """Get available virtual gifts"""
    return {
        "success": True,
        "gifts": GIFT_CATALOG
    }

@router.post("/gifts/send")
async def send_gift(request: SendGift) -> Dict[str, Any]:
    """Send virtual gift to user"""
    try:
        db = get_database()
        
        if request.gift_id not in GIFT_CATALOG:
            raise HTTPException(status_code=400, detail="Invalid gift")
        
        gift = GIFT_CATALOG[request.gift_id]
        
        # Check sender balance
        sender = await db.users.find_one({"user_id": request.from_user_id}, {"_id": 0})
        if not sender or sender.get("coins", 0) < gift["cost"]:
            raise HTTPException(status_code=400, detail="Insufficient coins")
        
        # Check recipient
        recipient = await db.users.find_one({"user_id": request.to_user_id}, {"_id": 0})
        if not recipient:
            raise HTTPException(status_code=404, detail="Recipient not found")
        
        # Calculate earnings
        platform_cut = int(gift["cost"] * PLATFORM_FEE)
        creator_earnings = gift["cost"] - platform_cut
        
        # Update balances
        await db.users.update_one(
            {"user_id": request.from_user_id},
            {"$inc": {"coins": -gift["cost"], "lifetime_spent": gift["cost"]}}
        )
        
        await db.users.update_one(
            {"user_id": request.to_user_id},
            {"$inc": {"coins": creator_earnings, "lifetime_earned": creator_earnings}}
        )
        
        # Record gift
        gift_record = {
            "id": f"gift_{uuid.uuid4().hex[:12]}",
            "from_user_id": request.from_user_id,
            "from_user_name": sender.get("name", "Anonymous"),
            "to_user_id": request.to_user_id,
            "to_user_name": recipient.get("name", "User"),
            "gift_id": request.gift_id,
            "gift_name": gift["name"],
            "gift_emoji": gift["emoji"],
            "cost": gift["cost"],
            "creator_received": creator_earnings,
            "message": request.message,
            "content_id": request.content_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        await db.gifts.insert_one(gift_record)
        
        # Notification
        notification = {
            "id": f"notif_{uuid.uuid4().hex[:12]}",
            "user_id": request.to_user_id,
            "type": "gift_received",
            "title": f"{gift['emoji']} Gift received!",
            "message": f"{sender.get('name')} sent you a {gift['name']}!",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "read": False
        }
        
        await db.notifications.insert_one(notification)
        
        return {
            "success": True,
            "gift_id": gift_record["id"],
            "gift": gift,
            "creator_received": creator_earnings
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ========== PREMIUM SUBSCRIPTIONS ==========

@router.post("/subscribe")
async def subscribe_premium(request: SubscribePremium) -> Dict[str, Any]:
    """Subscribe to premium tier"""
    try:
        db = get_database()
        
        if request.tier not in SUBSCRIPTION_TIERS:
            raise HTTPException(status_code=400, detail="Invalid tier")
        
        tier = SUBSCRIPTION_TIERS[request.tier]
        
        # Check balance
        user = await db.users.find_one({"user_id": request.user_id}, {"_id": 0})
        if not user or user.get("coins", 0) < tier["cost"]:
            raise HTTPException(status_code=400, detail="Insufficient coins")
        
        # Deduct coins
        await db.users.update_one(
            {"user_id": request.user_id},
            {
                "$inc": {"coins": -tier["cost"]},
                "$set": {
                    "subscription_tier": request.tier,
                    "subscription_expires": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
                }
            }
        )
        
        # Record subscription
        subscription = {
            "id": f"sub_{uuid.uuid4().hex[:12]}",
            "user_id": request.user_id,
            "tier": request.tier,
            "cost": tier["cost"],
            "start_date": datetime.now(timezone.utc).isoformat(),
            "end_date": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
            "auto_renew": True
        }
        
        await db.subscriptions.insert_one(subscription)
        
        return {
            "success": True,
            "subscription_id": subscription["id"],
            "tier": request.tier,
            "expires": subscription["end_date"],
            "benefits": tier["benefits"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/subscription/{user_id}")
async def get_subscription_status(user_id: str) -> Dict[str, Any]:
    """Get user's subscription status"""
    try:
        db = get_database()
        
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        tier = user.get("subscription_tier", "basic")
        expires = user.get("subscription_expires")
        
        is_active = False
        if expires:
            is_active = datetime.fromisoformat(expires) > datetime.now(timezone.utc)
        
        return {
            "success": True,
            "tier": tier if is_active else "basic",
            "is_active": is_active,
            "expires": expires,
            "benefits": SUBSCRIPTION_TIERS.get(tier, {}).get("benefits", [])
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ========== CREATOR TOOLS ==========

@router.get("/creator/earnings/{creator_id}")
async def get_creator_earnings(creator_id: str, period: str = "all") -> Dict[str, Any]:
    """Get creator's earnings breakdown"""
    try:
        db = get_database()
        
        # Get all transactions where user received money
        tips = await db.transactions.find(
            {"to_user_id": creator_id, "id": {"$regex": "^tip_"}},
            {"_id": 0}
        ).to_list(1000)
        
        gifts = await db.gifts.find(
            {"to_user_id": creator_id},
            {"_id": 0}
        ).to_list(1000)
        
        total_tips = sum(t.get("creator_received", 0) for t in tips)
        total_gifts = sum(g.get("creator_received", 0) for g in gifts)
        total_earnings = total_tips + total_gifts
        
        # Top supporters
        supporters = {}
        for t in tips:
            sender = t.get("from_user_id")
            supporters[sender] = supporters.get(sender, 0) + t.get("amount", 0)
        
        top_supporters = sorted(supporters.items(), key=lambda x: x[1], reverse=True)[:10]
        
        return {
            "success": True,
            "total_earnings": total_earnings,
            "from_tips": total_tips,
            "from_gifts": total_gifts,
            "tip_count": len(tips),
            "gift_count": len(gifts),
            "top_supporters": [
                {"user_id": s[0], "total_sent": s[1]} 
                for s in top_supporters
            ]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/creator/withdraw")
async def request_withdrawal(request: WithdrawRequest) -> Dict[str, Any]:
    """Request withdrawal of earnings"""
    try:
        db = get_database()
        
        if request.amount < MIN_WITHDRAWAL:
            raise HTTPException(status_code=400, detail=f"Minimum withdrawal is ${MIN_WITHDRAWAL}")
        
        # Check available balance (coins to USD conversion: 100 coins = $1)
        user = await db.users.find_one({"user_id": request.creator_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        available_coins = user.get("coins", 0)
        required_coins = int(request.amount * 100)  # $1 = 100 coins
        
        if available_coins < required_coins:
            raise HTTPException(status_code=400, detail="Insufficient balance")
        
        # Create withdrawal request
        withdrawal = {
            "id": f"wd_{uuid.uuid4().hex[:12]}",
            "creator_id": request.creator_id,
            "amount_usd": request.amount,
            "amount_coins": required_coins,
            "payment_method": request.payment_method,
            "payment_details": request.payment_details,
            "status": "pending",  # pending, approved, completed, rejected
            "requested_at": datetime.now(timezone.utc).isoformat(),
            "processed_at": None
        }
        
        await db.withdrawals.insert_one(withdrawal)
        
        # Deduct coins (held until processed)
        await db.users.update_one(
            {"user_id": request.creator_id},
            {"$inc": {"coins": -required_coins}}
        )
        
        return {
            "success": True,
            "withdrawal_id": withdrawal["id"],
            "amount_usd": request.amount,
            "status": "pending",
            "message": "Withdrawal request submitted. Processing takes 3-5 business days."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/creator/stats/{creator_id}")
async def get_creator_stats(creator_id: str) -> Dict[str, Any]:
    """Get comprehensive creator statistics"""
    try:
        db = get_database()
        
        user = await db.users.find_one({"user_id": creator_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get content stats
        posts_count = await db.my_vibez.count_documents({"user_id": creator_id})
        total_likes = await db.my_vibez.aggregate([
            {"$match": {"user_id": creator_id}},
            {"$group": {"_id": None, "total": {"$sum": "$likes"}}}
        ]).to_list(1)
        
        # Get earnings
        tips_count = await db.transactions.count_documents(
            {"to_user_id": creator_id, "id": {"$regex": "^tip_"}}
        )
        gifts_count = await db.gifts.count_documents({"to_user_id": creator_id})
        
        return {
            "success": True,
            "creator_id": creator_id,
            "stats": {
                "total_posts": posts_count,
                "total_likes": total_likes[0]["total"] if total_likes else 0,
                "tips_received": tips_count,
                "gifts_received": gifts_count,
                "lifetime_earned": user.get("lifetime_earned", 0),
                "current_balance": user.get("coins", 0)
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

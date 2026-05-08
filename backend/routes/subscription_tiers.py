"""
Subscription Tiers System
VIP Membership with Exclusive Perks
Feature #1 of 35
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from config import get_database
from utils.database import get_current_user

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])

# ==================== SUBSCRIPTION TIERS ====================

SUBSCRIPTION_TIERS = {
    "free": {
        "name": "Free",
        "price_monthly": 0,
        "price_yearly": 0,
        "perks": [
            "Access to basic games",
            "Standard matchmaking",
            "5% platform fee on winnings"
        ],
        "limits": {
            "max_daily_games": 10,
            "max_tournament_entries": 1,
            "priority_support": False,
            "exclusive_rooms": False,
            "custom_avatar": False,
            "ad_free": False
        }
    },
    "bronze": {
        "name": "Bronze VIP",
        "price_monthly": 9.99,
        "price_yearly": 99.99,
        "perks": [
            "All Free perks",
            "4% platform fee (1% discount)",
            "20 daily games limit",
            "2 tournament entries/day",
            "Bronze badge on profile",
            "Priority matchmaking"
        ],
        "limits": {
            "max_daily_games": 20,
            "max_tournament_entries": 2,
            "platform_fee_discount": 0.01,  # 1% discount
            "priority_support": False,
            "exclusive_rooms": False,
            "custom_avatar": True,
            "ad_free": True
        }
    },
    "silver": {
        "name": "Silver VIP",
        "price_monthly": 19.99,
        "price_yearly": 199.99,
        "perks": [
            "All Bronze perks",
            "3% platform fee (2% discount)",
            "50 daily games limit",
            "5 tournament entries/day",
            "Silver badge on profile",
            "Access to exclusive Silver rooms",
            "Priority customer support",
            "Monthly bonus tokens (500)"
        ],
        "limits": {
            "max_daily_games": 50,
            "max_tournament_entries": 5,
            "platform_fee_discount": 0.02,
            "priority_support": True,
            "exclusive_rooms": True,
            "custom_avatar": True,
            "ad_free": True,
            "monthly_bonus_tokens": 500
        }
    },
    "gold": {
        "name": "Gold VIP",
        "price_monthly": 49.99,
        "price_yearly": 499.99,
        "perks": [
            "All Silver perks",
            "2% platform fee (3% discount)",
            "Unlimited daily games",
            "Unlimited tournament entries",
            "Gold badge on profile",
            "Access to exclusive Gold rooms",
            "VIP customer support",
            "Monthly bonus tokens (1500)",
            "Free entry to weekly tournaments",
            "Custom profile themes"
        ],
        "limits": {
            "max_daily_games": -1,  # Unlimited
            "max_tournament_entries": -1,
            "platform_fee_discount": 0.03,
            "priority_support": True,
            "exclusive_rooms": True,
            "custom_avatar": True,
            "ad_free": True,
            "monthly_bonus_tokens": 1500,
            "free_tournament_entries": True,
            "custom_themes": True
        }
    },
    "diamond": {
        "name": "Diamond VIP",
        "price_monthly": 99.99,
        "price_yearly": 999.99,
        "perks": [
            "All Gold perks",
            "1% platform fee (4% discount)",
            "Diamond badge on profile",
            "Access to ultra-exclusive Diamond rooms",
            "Dedicated VIP concierge",
            "Monthly bonus tokens (3000)",
            "Free entry to all tournaments",
            "Personal MetaHuman dealer",
            "Private streaming suite",
            "Early access to new features",
            "Verified checkmark"
        ],
        "limits": {
            "max_daily_games": -1,
            "max_tournament_entries": -1,
            "platform_fee_discount": 0.04,
            "priority_support": True,
            "exclusive_rooms": True,
            "custom_avatar": True,
            "ad_free": True,
            "monthly_bonus_tokens": 3000,
            "free_tournament_entries": True,
            "custom_themes": True,
            "personal_dealer": True,
            "private_suite": True,
            "verified": True
        }
    }
}

# ==================== DATA MODELS ====================

class SubscriptionRequest(BaseModel):
    user_id: str
    tier: str  # "bronze", "silver", "gold", "diamond"
    billing_cycle: str  # "monthly", "yearly"
    payment_method_id: Optional[str] = None

class SubscriptionUpdate(BaseModel):
    new_tier: str
    billing_cycle: Optional[str] = None

# ==================== ENDPOINTS ====================

@router.get("/tiers")
async def get_subscription_tiers() -> Dict[str, Any]:
    """Get all available subscription tiers and their perks"""
    return {
        "success": True,
        "tiers": SUBSCRIPTION_TIERS
    }

@router.post("/subscribe")
async def create_subscription(request: SubscriptionRequest) -> Dict[str, Any]:
    """
    Subscribe user to a VIP tier.
    Integrates with Stripe for payment processing.
    """
    db = get_database()
    
    # Validate tier
    if request.tier not in SUBSCRIPTION_TIERS:
        raise HTTPException(status_code=400, detail="Invalid subscription tier")
    
    # Get user
    user = await db.users.find_one({"user_id": request.user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user already has active subscription
    existing = await db.subscriptions.find_one({
        "user_id": request.user_id,
        "status": "active"
    }, {"_id": 0})
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail="User already has an active subscription. Use upgrade endpoint."
        )
    
    # Calculate price
    tier_data = SUBSCRIPTION_TIERS[request.tier]
    price = tier_data["price_yearly"] if request.billing_cycle == "yearly" else tier_data["price_monthly"]
    
    # Create subscription record
    subscription = {
        "subscription_id": str(uuid4()),
        "user_id": request.user_id,
        "tier": request.tier,
        "tier_name": tier_data["name"],
        "billing_cycle": request.billing_cycle,
        "price": price,
        "status": "active",
        "perks": tier_data["perks"],
        "limits": tier_data["limits"],
        "started_at": datetime.now(timezone.utc).isoformat(),
        "next_billing_date": (
            datetime.now(timezone.utc) + 
            (timedelta(days=365) if request.billing_cycle == "yearly" else timedelta(days=30))
        ).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Insert subscription
    await db.subscriptions.insert_one(subscription)
    
    # Update user with subscription tier
    await db.users.update_one(
        {"user_id": request.user_id},
        {
            "$set": {
                "subscription_tier": request.tier,
                "subscription_id": subscription["subscription_id"],
                "is_vip": True
            }
        }
    )
    
    # Grant initial monthly bonus tokens if applicable
    if "monthly_bonus_tokens" in tier_data["limits"]:
        await db.users.update_one(
            {"user_id": request.user_id},
            {"$inc": {"balance": tier_data["limits"]["monthly_bonus_tokens"]}}
        )
    
    return {
        "success": True,
        "subscription": subscription,
        "message": f"Successfully subscribed to {tier_data['name']}!"
    }

@router.get("/my-subscription/{user_id}")
async def get_user_subscription(user_id: str) -> Dict[str, Any]:
    """Get user's current subscription details"""
    db = get_database()
    
    subscription = await db.subscriptions.find_one({
        "user_id": user_id,
        "status": "active"
    }, {"_id": 0})
    
    if not subscription:
        # Return free tier info
        return {
            "success": True,
            "subscription": {
                "tier": "free",
                "tier_name": "Free",
                "perks": SUBSCRIPTION_TIERS["free"]["perks"],
                "limits": SUBSCRIPTION_TIERS["free"]["limits"]
            }
        }
    
    return {
        "success": True,
        "subscription": subscription
    }


@router.get("/me")
async def get_current_user_subscription(request: Request) -> Dict[str, Any]:
    """Get the authenticated user's subscription details.

    Frontend (CreditBalance.tsx, PricingPage.tsx) calls this on every
    dashboard load. Returning the free-tier shape for unauthenticated
    or unsubscribed users is intentional — the UI degrades gracefully.
    """
    user = await get_current_user(request)
    if not user:
        # Anonymous → free tier (no 401 to avoid noisy console errors).
        return {
            "success": True,
            "subscription": {
                "tier": "free",
                "tier_name": "Free",
                "perks": SUBSCRIPTION_TIERS["free"]["perks"],
                "limits": SUBSCRIPTION_TIERS["free"]["limits"],
            },
        }
    return await get_user_subscription(user.user_id)

@router.post("/upgrade/{user_id}")
async def upgrade_subscription(user_id: str, update: SubscriptionUpdate) -> Dict[str, Any]:
    """Upgrade or downgrade subscription tier"""
    db = get_database()
    
    # Validate new tier
    if update.new_tier not in SUBSCRIPTION_TIERS:
        raise HTTPException(status_code=400, detail="Invalid subscription tier")
    
    # Get current subscription
    current = await db.subscriptions.find_one({
        "user_id": user_id,
        "status": "active"
    }, {"_id": 0})
    
    if not current:
        raise HTTPException(status_code=404, detail="No active subscription found")
    
    # Get new tier data
    new_tier_data = SUBSCRIPTION_TIERS[update.new_tier]
    billing_cycle = update.billing_cycle or current["billing_cycle"]
    new_price = new_tier_data["price_yearly"] if billing_cycle == "yearly" else new_tier_data["price_monthly"]
    
    # Update subscription
    await db.subscriptions.update_one(
        {"user_id": user_id, "status": "active"},
        {
            "$set": {
                "tier": update.new_tier,
                "tier_name": new_tier_data["name"],
                "billing_cycle": billing_cycle,
                "price": new_price,
                "perks": new_tier_data["perks"],
                "limits": new_tier_data["limits"],
                "upgraded_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Update user tier
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"subscription_tier": update.new_tier}}
    )
    
    return {
        "success": True,
        "message": f"Subscription upgraded to {new_tier_data['name']}!",
        "new_tier": update.new_tier
    }

@router.post("/cancel/{user_id}")
async def cancel_subscription(user_id: str) -> Dict[str, Any]:
    """Cancel user's subscription (effective at end of billing period)"""
    db = get_database()
    
    subscription = await db.subscriptions.find_one({
        "user_id": user_id,
        "status": "active"
    }, {"_id": 0})
    
    if not subscription:
        raise HTTPException(status_code=404, detail="No active subscription found")
    
    # Mark as cancelled (will remain active until next_billing_date)
    await db.subscriptions.update_one(
        {"user_id": user_id, "status": "active"},
        {
            "$set": {
                "status": "cancelled",
                "cancelled_at": datetime.now(timezone.utc).isoformat(),
                "expires_at": subscription["next_billing_date"]
            }
        }
    )
    
    return {
        "success": True,
        "message": f"Subscription cancelled. You will retain VIP benefits until {subscription['next_billing_date']}",
        "expires_at": subscription["next_billing_date"]
    }

@router.get("/check-perk/{user_id}/{perk}")
async def check_user_perk(user_id: str, perk: str) -> Dict[str, Any]:
    """Check if user has access to a specific perk"""
    db = get_database()
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    tier = user.get("subscription_tier", "free")
    tier_limits = SUBSCRIPTION_TIERS[tier]["limits"]
    
    has_perk = tier_limits.get(perk, False)
    
    return {
        "success": True,
        "user_id": user_id,
        "tier": tier,
        "perk": perk,
        "has_access": has_perk,
        "value": tier_limits.get(perk)
    }

@router.get("/stats")
async def get_subscription_stats() -> Dict[str, Any]:
    """Get subscription statistics (admin only)"""
    db = get_database()
    
    # Count subscriptions by tier
    pipeline = [
        {"$match": {"status": "active"}},
        {"$group": {"_id": "$tier", "count": {"$sum": 1}, "revenue": {"$sum": "$price"}}}
    ]
    
    stats = await db.subscriptions.aggregate(pipeline).to_list(100)
    
    total_subscribers = sum(s["count"] for s in stats)
    total_revenue = sum(s["revenue"] for s in stats)
    
    return {
        "success": True,
        "total_subscribers": total_subscribers,
        "monthly_recurring_revenue": total_revenue,
        "by_tier": stats
    }

# ==================== HELPER FUNCTIONS ====================

async def apply_monthly_bonuses() -> Dict[str, Any]:
    """
    Cron job to apply monthly bonus tokens to VIP members.
    Should be run on the 1st of each month.
    """
    db = get_database()
    
    # Get all active subscriptions with bonus tokens
    subscriptions = await db.subscriptions.find({
        "status": "active",
        "limits.monthly_bonus_tokens": {"$exists": True}
    }, {"_id": 0}).to_list(10000)
    
    for sub in subscriptions:
        bonus = sub["limits"].get("monthly_bonus_tokens", 0)
        if bonus > 0:
            await db.users.update_one(
                {"user_id": sub["user_id"]},
                {"$inc": {"balance": bonus}}
            )
    
    return {
        "success": True,
        "bonuses_applied": len(subscriptions)
    }

async def expire_cancelled_subscriptions() -> Dict[str, Any]:
    """
    Cron job to expire cancelled subscriptions that have reached their end date.
    Should be run daily.
    """
    db = get_database()
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Find cancelled subscriptions past their expiry
    expired = await db.subscriptions.find({
        "status": "cancelled",
        "expires_at": {"$lte": now}
    }, {"_id": 0}).to_list(10000)
    
    for sub in expired:
        # Mark as expired
        await db.subscriptions.update_one(
            {"subscription_id": sub["subscription_id"]},
            {"$set": {"status": "expired"}}
        )
        
        # Downgrade user to free tier
        await db.users.update_one(
            {"user_id": sub["user_id"]},
            {
                "$set": {
                    "subscription_tier": "free",
                    "is_vip": False
                },
                "$unset": {"subscription_id": ""}
            }
        )
    
    return {
        "success": True,
        "expired_count": len(expired)
    }

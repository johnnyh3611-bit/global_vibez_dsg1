"""
Elite Subscription System
$15-25/month subscription with premium features:
- Ghost Mode (invisible browsing)
- 4K Streaming (feature flag)
- Priority Matchmaking
- AI Date Coach access
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Dict, Any
from datetime import datetime, timezone, timedelta
from source.web-assets.backend.services.payment_hub import StripeCheckout, CheckoutSessionRequest
from utils.database import get_database, get_current_user
import os
import uuid

router = APIRouter(prefix="/elite", tags=["elite_subscription"])

STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')

# Elite Subscription Tiers
ELITE_TIERS = {
    "elite_monthly": {
        "name": "Elite Monthly",
        "price_usd": 24.99,
        "billing_period": "monthly",
        "features": [
            "ghost_mode",
            "4k_streaming",
            "priority_matchmaking",
            "ai_date_coach",
            "unlimited_swipes",
            "see_who_liked",
            "profile_boost_daily",
            "custom_profile_themes"
        ]
    },
    "elite_annual": {
        "name": "Elite Annual",
        "price_usd": 249.99,  # ~$21/month (16% savings)
        "billing_period": "annual",
        "features": [
            "ghost_mode",
            "4k_streaming",
            "priority_matchmaking",
            "ai_date_coach",
            "unlimited_swipes",
            "see_who_liked",
            "profile_boost_daily",
            "custom_profile_themes",
            "exclusive_tournaments",
            "bonus_monthly_coins"
        ]
    }
}

# Feature descriptions
FEATURE_DESCRIPTIONS = {
    "ghost_mode": {
        "name": "👻 Ghost Mode",
        "description": "Browse profiles invisibly - only users you like can see you viewed them"
    },
    "4k_streaming": {
        "name": "🎥 4K Streaming",
        "description": "Stream & watch gameplay in stunning 4K quality (when feature launches)"
    },
    "priority_matchmaking": {
        "name": "⚡ Priority Matchmaking",
        "description": "Jump to the front of multiplayer lobbies & get matched faster"
    },
    "ai_date_coach": {
        "name": "🤖 AI Date Coach",
        "description": "Get real-time conversation suggestions powered by GPT-5.1"
    },
    "unlimited_swipes": {
        "name": "∞ Unlimited Swipes",
        "description": "No daily swipe limits - match with as many people as you want"
    },
    "see_who_liked": {
        "name": "💙 See Who Liked You",
        "description": "View everyone who liked your profile before swiping"
    },
    "profile_boost_daily": {
        "name": "🚀 Daily Profile Boost",
        "description": "Automatically boost your profile to top of discovery feed once per day"
    },
    "custom_profile_themes": {
        "name": "🎨 Custom Themes",
        "description": "Unlock exclusive cyberpunk & neon profile themes"
    },
    "exclusive_tournaments": {
        "name": "🏆 Exclusive Tournaments",
        "description": "Access Elite-only tournaments with bigger prize pools"
    },
    "bonus_monthly_coins": {
        "name": "💰 Monthly Coin Bonus",
        "description": "Receive 500 bonus coins every month"
    }
}

# ==================== MODELS ====================

class SubscribeTier(BaseModel):
    tier_id: str  # "elite_monthly" or "elite_annual"


class CheckFeatureAccess(BaseModel):
    feature_name: str


# ==================== HELPER FUNCTIONS ====================

async def check_elite_status(user_id: str, db) -> dict:
    """Check if user has active Elite subscription"""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    if not user:
        return {"is_elite": False, "reason": "user_not_found"}
    
    if not user.get("elite_subscription_active"):
        return {
            "is_elite": False,
            "tier": None,
            "features": [],
            "expires_at": None
        }
    
    # Check expiration
    expires_at = user.get("elite_subscription_expires")
    if expires_at:
        if isinstance(expires_at, str):
            expires_dt = datetime.fromisoformat(expires_at)
        else:
            expires_dt = expires_at
        
        # Ensure timezone-aware comparison
        if expires_dt.tzinfo is None:
            expires_dt = expires_dt.replace(tzinfo=timezone.utc)
        
        if datetime.now(timezone.utc) > expires_dt:
            # Expired - deactivate
            await db.users.update_one(
                {"user_id": user_id},
                {
                    "$set": {
                        "elite_subscription_active": False,
                        "elite_features": [],
                        "updated_at": datetime.now(timezone.utc)
                    }
                }
            )
            return {
                "is_elite": False,
                "tier": None,
                "features": [],
                "expired": True,
                "expired_at": expires_at
            }
    
    return {
        "is_elite": True,
        "tier": user.get("elite_subscription_tier"),
        "features": user.get("elite_features", []),
        "expires_at": expires_at
    }


async def grant_elite_access(user_id: str, tier_id: str, db) -> dict:
    """Grant Elite subscription access to user"""
    tier = ELITE_TIERS.get(tier_id)
    if not tier:
        return {"success": False, "error": "Invalid tier"}
    
    now = datetime.now(timezone.utc)
    
    if tier["billing_period"] == "monthly":
        expires_at = now + timedelta(days=30)
    else:  # annual
        expires_at = now + timedelta(days=365)
    
    # Grant features
    await db.users.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "elite_subscription_active": True,
                "elite_subscription_tier": tier_id,
                "elite_subscription_expires": expires_at,
                "elite_features": tier["features"],
                "subscription_tier": "elite",  # Override base subscription
                "swipes_limit": -1,  # Unlimited swipes
                "updated_at": now
            }
        }
    )
    
    # If annual, grant bonus coins
    if tier_id == "elite_annual":
        await db.users.update_one(
            {"user_id": user_id},
            {"$inc": {"coins": 500}}
        )
    
    return {
        "success": True,
        "tier": tier_id,
        "features": tier["features"],
        "expires_at": expires_at.isoformat()
    }


# ==================== ENDPOINTS ====================

@router.get("/status")
async def get_elite_subscription_status(request: Request) -> Dict[str, Any]:
    """Get user's Elite subscription status"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    status = await check_elite_status(current_user.user_id, db)
    
    return status


@router.get("/tiers")
async def get_elite_tiers() -> Dict[str, Any]:
    """Get available Elite subscription tiers"""
    tiers_info = []
    
    for tier_id, tier_data in ELITE_TIERS.items():
        features_detailed = [
            FEATURE_DESCRIPTIONS.get(f, {"name": f, "description": ""})
            for f in tier_data["features"]
        ]
        
        tiers_info.append({
            "tier_id": tier_id,
            "name": tier_data["name"],
            "price_usd": tier_data["price_usd"],
            "billing_period": tier_data["billing_period"],
            "features": features_detailed,
            "savings": "16% off monthly price" if tier_id == "elite_annual" else None
        })
    
    return {"tiers": tiers_info}


@router.post("/subscribe")
async def subscribe_to_elite(subscribe_data: SubscribeTier, request: Request) -> Dict[str, Any]:
    """Subscribe to Elite tier (creates Stripe checkout)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    if subscribe_data.tier_id not in ELITE_TIERS:
        raise HTTPException(status_code=400, detail="Invalid tier")
    
    db = get_database()
    
    # Check if already subscribed
    status = await check_elite_status(current_user.user_id, db)
    if status["is_elite"]:
        raise HTTPException(status_code=400, detail="Already have active Elite subscription")
    
    tier = ELITE_TIERS[subscribe_data.tier_id]
    
    try:
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY)
        frontend_url = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:3000")
        
        # emergentintegrations uses simple amount/currency format (amount in dollars)
        session_request = CheckoutSessionRequest(
            amount=tier["price_usd"],  # Amount in dollars
            currency="usd",
            success_url=f"{frontend_url}/elite/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{frontend_url}/elite",
            metadata={
                "user_id": current_user.user_id,
                "type": "elite_subscription",
                "tier_id": subscribe_data.tier_id,
                "amount": str(tier["price_usd"])
            }
        )
        
        session = await stripe_checkout.create_checkout_session(session_request)
        
        return {
            "success": True,
            "checkout_url": session.url,
            "session_id": session.session_id,
            "tier": tier["name"],
            "price": tier["price_usd"]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create checkout: {str(e)}")


@router.post("/verify-subscription")
async def verify_elite_subscription(session_id: str, request: Request) -> Dict[str, Any]:
    """Verify Stripe payment and activate Elite subscription"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    try:
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY)
        status = await stripe_checkout.get_checkout_status(session_id)
        
        if status.status != "complete":
            raise HTTPException(status_code=400, detail="Payment not completed")
        
        if status.metadata.get("user_id") != current_user.user_id:
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        tier_id = status.metadata.get("tier_id")
        
        # Grant Elite access
        result = await grant_elite_access(current_user.user_id, tier_id, db)
        
        if result["success"]:
            # Record transaction
            transaction = {
                "transaction_id": f"elite_{uuid.uuid4().hex[:12]}",
                "user_id": current_user.user_id,
                "type": "elite_subscription",
                "tier_id": tier_id,
                "stripe_session_id": session_id,
                "amount": ELITE_TIERS[tier_id]["price_usd"],
                "status": "completed",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.elite_subscriptions.insert_one(transaction)
            
            return {
                "success": True,
                "message": "Welcome to Elite! All premium features unlocked.",
                "tier": tier_id,
                "features": result["features"],
                "expires_at": result["expires_at"]
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to grant Elite access")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to verify subscription: {str(e)}")


@router.get("/feature/{feature_name}")
async def check_feature_access(feature_name: str, request: Request) -> Dict[str, Any]:
    """Check if user has access to a specific Elite feature"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    status = await check_elite_status(current_user.user_id, db)
    
    has_access = status["is_elite"] and feature_name in status.get("features", [])
    
    return {
        "feature": feature_name,
        "has_access": has_access,
        "is_elite": status["is_elite"],
        "tier": status.get("tier")
    }


@router.post("/cancel")
async def cancel_elite_subscription(request: Request) -> Dict[str, Any]:
    """Cancel Elite subscription (won't renew)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    status = await check_elite_status(current_user.user_id, db)
    
    if not status["is_elite"]:
        raise HTTPException(status_code=400, detail="No active Elite subscription")
    
    # Mark for non-renewal (keep active until expiration)
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {
            "$set": {
                "elite_auto_renew": False,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {
        "success": True,
        "message": "Subscription will not renew. You'll keep Elite features until expiration.",
        "expires_at": status.get("expires_at")
    }


# Export helper for middleware
__all__ = ['check_elite_status', 'ELITE_TIERS']

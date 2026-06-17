from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Dict, Any
from utils.database import get_database, get_current_user
from datetime import datetime, timezone
import os
import stripe

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])

# Initialize Stripe
stripe.api_key = os.environ.get('STRIPE_API_KEY')

# ==================== MODELS ====================

class CreditPurchase(BaseModel):
    package: str  # starter, popular, best_value, mega

class SubscriptionPurchase(BaseModel):
    tier: str  # plus, premium
    billing_period: str  # monthly, annual

# ==================== CREDIT PACKAGES ====================

CREDIT_PACKAGES = {
    "starter": {"credits": 100, "price": 2.99, "price_cents": 299},
    "popular": {"credits": 250, "price": 4.99, "price_cents": 499},
    "best_value": {"credits": 600, "price": 9.99, "price_cents": 999},
    "mega": {"credits": 1500, "price": 19.99, "price_cents": 1999}
}

SUBSCRIPTION_TIERS = {
    "plus": {
        "monthly": {"price": 12.99, "price_cents": 1299, "credits": 200},
        "annual": {"price": 124.00, "price_cents": 12400, "credits": 200}
    },
    "premium": {
        "monthly": {"price": 24.99, "price_cents": 2499, "credits": 500},
        "annual": {"price": 239.00, "price_cents": 23900, "credits": 500}
    }
}

# ==================== HELPER FUNCTIONS ====================

async def add_credits(db, user_id: str, amount: int, reason: str) -> Dict[str, Any]:
    """Add credits to user's balance and create transaction"""
    # Update user balance
    await db.users.update_one(
        {"user_id": user_id},
        {
            "$inc": {"credits_balance": amount},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    # Create transaction record
    transaction = {
        "transaction_id": f"tx_{datetime.now(timezone.utc).timestamp()}",
        "user_id": user_id,
        "type": "credit",
        "amount": amount,
        "reason": reason,
        "balance_after": await get_user_credits(db, user_id),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.credit_transactions.insert_one(transaction)
    
    return True  # Successfully added credits

async def deduct_credits(db, user_id: str, amount: int, reason: str) -> Dict[str, Any]:
    """Deduct credits from user's balance"""
    # Check balance first
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "credits_balance": 1})
    if not user or user.get("credits_balance", 0) < amount:
        return False
    
    # Deduct credits
    await db.users.update_one(
        {"user_id": user_id},
        {
            "$inc": {"credits_balance": -amount},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    # Create transaction record
    transaction = {
        "transaction_id": f"tx_{datetime.now(timezone.utc).timestamp()}",
        "user_id": user_id,
        "type": "debit",
        "amount": -amount,
        "reason": reason,
        "balance_after": await get_user_credits(db, user_id),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.credit_transactions.insert_one(transaction)
    
    return True

async def get_user_credits(db, user_id: str) -> int:
    """Get user's current credit balance"""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "credits_balance": 1})
    return user.get("credits_balance", 0) if user else 0

def get_tier_features(tier: str) -> dict:
    """Get features for a subscription tier"""
    features = {
        "free": {
            "daily_swipes": 20,
            "friend_matching": False,
            "compatibility_quiz": False,
            "profile_videos": False,
            "3d_games": False,
            "group_planner_limit": 0,
            "tournament_discount": 0,
            "see_who_liked": False,
            "rewinds": 0,
            "profile_boosts": 0,
            "monthly_credits": 50
        },
        "plus": {
            "daily_swipes": -1,  # unlimited
            "friend_matching": True,
            "compatibility_quiz": True,
            "profile_videos": True,
            "3d_games": True,
            "group_planner_limit": 2,  # per week
            "tournament_discount": 0.20,  # 20% off
            "see_who_liked": False,
            "rewinds": 5,  # per week
            "profile_boosts": 2,  # per week
            "monthly_credits": 200
        },
        "premium": {
            "daily_swipes": -1,  # unlimited
            "friend_matching": True,
            "compatibility_quiz": True,
            "profile_videos": True,
            "3d_games": True,
            "group_planner_limit": -1,  # unlimited
            "tournament_discount": 0.50,  # 50% off
            "see_who_liked": True,
            "rewinds": -1,  # unlimited
            "profile_boosts": -1,  # unlimited
            "monthly_credits": 500,
            "ride_credits": 15  # $15 monthly
        }
    }
    return features.get(tier, features["free"])

# ==================== ENDPOINTS ====================

@router.get("/me")
async def get_my_subscription(request: Request) -> Dict[str, Any]:
    """Get current user's subscription details"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    user = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    
    tier = user.get("subscription_tier", "free")
    features = get_tier_features(tier)
    
    return {
        "tier": tier,
        "credits_balance": user.get("credits_balance", 50),
        "subscription_end_date": user.get("subscription_end_date"),
        "features": features,
        "is_active": tier != "free"
    }

@router.post("/purchase-credits")
async def purchase_credits(purchase: CreditPurchase, request: Request) -> Dict[str, Any]:
    """Purchase credit package (creates Stripe checkout session)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    if purchase.package not in CREDIT_PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid credit package")
    
    package = CREDIT_PACKAGES[purchase.package]
    
    try:
        # Create Stripe checkout session
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {
                        'name': f'{package["credits"]} Credits',
                        'description': 'Global Vibes Credits Package'
                    },
                    'unit_amount': package['price_cents'],
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f'{os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:3000")}/payment/success?session_id={{CHECKOUT_SESSION_ID}}&type=credits&package={purchase.package}',
            cancel_url=f'{os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:3000")}/payment/cancel',
            client_reference_id=current_user.user_id,
            metadata={
                'type': 'credits',
                'package': purchase.package,
                'credits': package['credits'],
                'user_id': current_user.user_id
            }
        )
        
        return {
            "checkout_url": checkout_session.url,
            "session_id": checkout_session.id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/subscribe")
async def subscribe(subscription: SubscriptionPurchase, request: Request) -> Dict[str, Any]:
    """Subscribe to Plus or Premium tier"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    if subscription.tier not in ["plus", "premium"]:
        raise HTTPException(status_code=400, detail="Invalid tier")
    
    if subscription.billing_period not in ["monthly", "annual"]:
        raise HTTPException(status_code=400, detail="Invalid billing period")
    
    tier_info = SUBSCRIPTION_TIERS[subscription.tier][subscription.billing_period]
    
    try:
        # Create Stripe checkout session for subscription
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {
                        'name': f'Global Vibes {subscription.tier.capitalize()}',
                        'description': f'{subscription.billing_period.capitalize()} subscription'
                    },
                    'unit_amount': tier_info['price_cents'],
                    'recurring': {
                        'interval': 'month' if subscription.billing_period == 'monthly' else 'year'
                    } if subscription.billing_period == 'monthly' else None
                },
                'quantity': 1,
            }],
            mode='subscription' if subscription.billing_period == 'monthly' else 'payment',
            success_url=f'{os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:3000")}/payment/success?session_id={{CHECKOUT_SESSION_ID}}&type=subscription&tier={subscription.tier}&period={subscription.billing_period}',
            cancel_url=f'{os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:3000")}/payment/cancel',
            client_reference_id=current_user.user_id,
            metadata={
                'type': 'subscription',
                'tier': subscription.tier,
                'billing_period': subscription.billing_period,
                'user_id': current_user.user_id
            }
        )
        
        return {
            "checkout_url": checkout_session.url,
            "session_id": checkout_session.id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/credits/balance")
async def get_credit_balance(request: Request) -> Dict[str, Any]:
    """Get user's current credit balance"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    balance = await get_user_credits(db, current_user.user_id)
    
    return {"balance": balance}

@router.get("/credits/transactions")
async def get_credit_transactions(request: Request, limit: int = 20) -> Dict[str, Any]:
    """Get user's credit transaction history"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    transactions = await db.credit_transactions.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return transactions

# Export helper functions for use in other routes
__all__ = ['add_credits', 'deduct_credits', 'get_user_credits', 'get_tier_features']

"""
Battle Pass System
Quarterly $20 seasonal progression with rewards
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
from utils.database import get_database, get_current_user
import os
import uuid

router = APIRouter(prefix="/battle-pass", tags=["battle_pass"])

STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')
BATTLE_PASS_PRICE = 20.00  # $20 USD per season

# Current active season
CURRENT_SEASON = "2026-Q2"
CURRENT_SEASON_NAME = "Neon Dreams"

# XP earning rates
XP_RATES = {
    "game_win": 50,
    "game_loss": 25,
    "tournament_win": 200,
    "tournament_participation": 100,
    "daily_login": 20,
    "match_made": 10,
    "date_completed": 75
}

# Leveling curve (XP needed for each level)
def xp_for_level(level: int) -> int:
    """Calculate XP needed to reach next level"""
    return int(100 + (level * 50))  # Increasing difficulty

# ==================== MODELS ====================

class AwardXP(BaseModel):
    xp_amount: int
    reason: str


class ClaimReward(BaseModel):
    reward_id: str


# ==================== HELPER FUNCTIONS ====================

async def get_current_season_config(db) -> dict:
    """Get current active Battle Pass season"""
    season = await db.battle_pass_seasons.find_one(
        {"season_id": CURRENT_SEASON, "active": True},
        {"_id": 0}
    )
    
    if not season:
        # Create default season if doesn't exist
        season = await create_default_season(db)
    
    return season


async def create_default_season(db) -> dict:
    """Create default Battle Pass season"""
    now = datetime.now(timezone.utc)
    season_end = now + timedelta(days=90)  # 3 months
    
    # Generate rewards for 100 levels
    free_rewards = []
    premium_rewards = []
    
    for level in range(1, 101):
        # Free rewards (every 5 levels)
        if level % 5 == 0:
            free_rewards.append({
                "reward_id": f"free_lvl{level}",
                "level": level,
                "tier": "free",
                "type": "coins",
                "name": f"{level * 10} Coins",
                "description": f"Free reward for reaching level {level}",
                "value": level * 10,
                "claimed": False
            })
        
        # Premium rewards (every level)
        if level % 10 == 0:
            premium_rewards.append({
                "reward_id": f"premium_cosmetic_lvl{level}",
                "level": level,
                "tier": "premium",
                "type": "cosmetic",
                "name": f"Epic {['Frame', 'Badge', 'Emote'][level % 3]}",
                "description": f"Exclusive cosmetic for level {level}",
                "value": f"cosmetic_{uuid.uuid4().hex[:8]}",
                "image_url": "/assets/cosmetics/placeholder.png",
                "claimed": False
            })
        else:
            premium_rewards.append({
                "reward_id": f"premium_lvl{level}",
                "level": level,
                "tier": "premium",
                "type": "coins",
                "name": f"{level * 20} Coins",
                "description": f"Premium reward for level {level}",
                "value": level * 20,
                "claimed": False
            })
    
    season_config = {
        "season_id": CURRENT_SEASON,
        "name": CURRENT_SEASON_NAME,
        "start_date": now.isoformat(),
        "end_date": season_end.isoformat(),
        "price_usd": BATTLE_PASS_PRICE,
        "max_level": 100,
        "free_rewards": free_rewards,
        "premium_rewards": premium_rewards,
        "active": True,
        "created_at": now.isoformat()
    }
    
    await db.battle_pass_seasons.insert_one(season_config)
    return season_config


async def get_user_progress(user_id: str, db) -> dict:
    """Get user's Battle Pass progress for current season"""
    progress = await db.battle_pass_progress.find_one(
        {"user_id": user_id, "season_id": CURRENT_SEASON},
        {"_id": 0}
    )
    
    if not progress:
        # Create new progress entry
        progress = {
            "user_id": user_id,
            "season_id": CURRENT_SEASON,
            "tier": "free",
            "current_xp": 0,
            "current_level": 1,
            "claimed_rewards": [],
            "purchased_at": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.battle_pass_progress.insert_one(progress)
    
    return progress


async def award_xp(user_id: str, xp_amount: int, reason: str, db) -> dict:
    """Award XP and handle level-ups"""
    progress = await get_user_progress(user_id, db)
    
    new_xp = progress["current_xp"] + xp_amount
    current_level = progress["current_level"]
    
    # Calculate level-ups
    while current_level < 100:
        xp_needed = xp_for_level(current_level)
        if new_xp >= xp_needed:
            new_xp -= xp_needed
            current_level += 1
        else:
            break
    
    # Update progress
    await db.battle_pass_progress.update_one(
        {"user_id": user_id, "season_id": CURRENT_SEASON},
        {
            "$set": {
                "current_xp": new_xp,
                "current_level": current_level,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Also update user model
    await db.users.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "battle_pass_xp": new_xp,
                "battle_pass_level": current_level,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    leveled_up = current_level > progress["current_level"]
    
    return {
        "xp_awarded": xp_amount,
        "reason": reason,
        "new_total_xp": new_xp,
        "current_level": current_level,
        "previous_level": progress["current_level"],
        "leveled_up": leveled_up,
        "xp_to_next_level": xp_for_level(current_level)
    }


# ==================== ENDPOINTS ====================

@router.get("/current-season")
async def get_current_season() -> Dict[str, Any]:
    """Get current Battle Pass season info"""
    db = get_database()
    season = await get_current_season_config(db)
    
    return {
        "season_id": season["season_id"],
        "name": season["name"],
        "start_date": season["start_date"],
        "end_date": season["end_date"],
        "price_usd": season["price_usd"],
        "max_level": season["max_level"],
        "active": season["active"]
    }


@router.get("/my-progress")
async def get_my_battle_pass_progress(request: Request) -> Dict[str, Any]:
    """Get current user's Battle Pass progress"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    progress = await get_user_progress(current_user.user_id, db)
    season = await get_current_season_config(db)
    
    # Calculate which rewards are available to claim
    available_rewards = []
    
    # Free rewards
    for reward in season["free_rewards"]:
        if reward["level"] <= progress["current_level"] and reward["reward_id"] not in progress["claimed_rewards"]:
            available_rewards.append(reward)
    
    # Premium rewards (if user has premium tier)
    if progress["tier"] == "premium":
        for reward in season["premium_rewards"]:
            if reward["level"] <= progress["current_level"] and reward["reward_id"] not in progress["claimed_rewards"]:
                available_rewards.append(reward)
    
    return {
        "season_id": progress["season_id"],
        "tier": progress["tier"],
        "current_xp": progress["current_xp"],
        "current_level": progress["current_level"],
        "xp_to_next_level": xp_for_level(progress["current_level"]),
        "claimed_rewards": progress["claimed_rewards"],
        "available_rewards": available_rewards,
        "has_premium": progress["tier"] == "premium",
        "purchased_at": progress.get("purchased_at")
    }


@router.get("/rewards")
async def get_battle_pass_rewards(tier: Optional[str] = None) -> Dict[str, Any]:
    """Get all Battle Pass rewards for current season"""
    db = get_database()
    season = await get_current_season_config(db)
    
    if tier == "free":
        return {"rewards": season["free_rewards"]}
    elif tier == "premium":
        return {"rewards": season["premium_rewards"]}
    else:
        return {
            "free_rewards": season["free_rewards"],
            "premium_rewards": season["premium_rewards"]
        }


@router.post("/purchase")
async def purchase_battle_pass(request: Request) -> Dict[str, Any]:
    """Purchase premium Battle Pass for current season"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    progress = await get_user_progress(current_user.user_id, db)
    
    # Check if already purchased
    if progress["tier"] == "premium":
        raise HTTPException(status_code=400, detail="Battle Pass already purchased for this season")
    
    try:
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY)
        frontend_url = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:3000")
        
        # emergentintegrations uses simple amount/currency format (amount in dollars)
        session_request = CheckoutSessionRequest(
            amount=BATTLE_PASS_PRICE,  # $20.00 in dollars
            currency="usd",
            success_url=f"{frontend_url}/battle-pass/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{frontend_url}/battle-pass",
            metadata={
                "user_id": current_user.user_id,
                "type": "battle_pass",
                "season_id": CURRENT_SEASON,
                "amount": str(BATTLE_PASS_PRICE)
            }
        )
        
        session = await stripe_checkout.create_checkout_session(session_request)
        
        return {
            "success": True,
            "checkout_url": session.url,
            "session_id": session.session_id,
            "amount": BATTLE_PASS_PRICE,
            "season": CURRENT_SEASON_NAME
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create checkout: {str(e)}")


@router.post("/verify-purchase")
async def verify_battle_pass_purchase(session_id: str, request: Request) -> Dict[str, Any]:
    """Verify Stripe payment and upgrade to premium tier"""
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
        
        # Upgrade to premium tier
        now = datetime.now(timezone.utc)
        await db.battle_pass_progress.update_one(
            {"user_id": current_user.user_id, "season_id": CURRENT_SEASON},
            {
                "$set": {
                    "tier": "premium",
                    "purchased_at": now.isoformat(),
                    "updated_at": now.isoformat()
                }
            }
        )
        
        # Update user model
        await db.users.update_one(
            {"user_id": current_user.user_id},
            {
                "$set": {
                    "battle_pass_season": CURRENT_SEASON,
                    "battle_pass_tier": "premium",
                    "battle_pass_purchased_at": now,
                    "updated_at": now
                }
            }
        )
        
        return {
            "success": True,
            "message": "Battle Pass upgraded to Premium!",
            "tier": "premium",
            "season": CURRENT_SEASON
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to verify purchase: {str(e)}")


@router.post("/award-xp")
async def award_xp_endpoint(xp_data: AwardXP, request: Request) -> Dict[str, Any]:
    """Award XP to user (called by game endpoints)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    result = await award_xp(current_user.user_id, xp_data.xp_amount, xp_data.reason, db)
    
    return result


@router.post("/claim-reward")
async def claim_battle_pass_reward(reward_data: ClaimReward, request: Request) -> Dict[str, Any]:
    """Claim a Battle Pass reward"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    progress = await get_user_progress(current_user.user_id, db)
    season = await get_current_season_config(db)
    
    # Find reward
    reward = None
    for r in season["free_rewards"] + season["premium_rewards"]:
        if r["reward_id"] == reward_data.reward_id:
            reward = r
            break
    
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    
    # Check if already claimed
    if reward["reward_id"] in progress["claimed_rewards"]:
        raise HTTPException(status_code=400, detail="Reward already claimed")
    
    # Check level requirement
    if progress["current_level"] < reward["level"]:
        raise HTTPException(status_code=400, detail=f"Level {reward['level']} required")
    
    # Check tier requirement
    if reward["tier"] == "premium" and progress["tier"] != "premium":
        raise HTTPException(status_code=403, detail="Premium Battle Pass required")
    
    # Grant reward
    if reward["type"] == "coins":
        await db.users.update_one(
            {"user_id": current_user.user_id},
            {"$inc": {"coins": reward["value"]}}
        )
    elif reward["type"] == "cosmetic":
        await db.users.update_one(
            {"user_id": current_user.user_id},
            {"$push": {"owned_cosmetics": reward["value"]}}
        )
    
    # Mark as claimed
    await db.battle_pass_progress.update_one(
        {"user_id": current_user.user_id, "season_id": CURRENT_SEASON},
        {
            "$push": {"claimed_rewards": reward["reward_id"]},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return {
        "success": True,
        "reward": reward,
        "message": f"Claimed: {reward['name']}"
    }


# Export helper function for game endpoints to use
__all__ = ['award_xp', 'XP_RATES']

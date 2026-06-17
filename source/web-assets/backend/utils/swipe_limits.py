"""
Swipe limit enforcement for free users
Handles daily swipe resets and tier-based limits
"""
from datetime import datetime, timezone, timedelta
from typing import Dict

async def check_and_reset_swipes(db, user_doc: Dict) -> Dict:
    """
    Check if swipes should be reset (new day) and return updated user doc
    """
    tier = user_doc.get("subscription_tier", user_doc.get("membership_type", "free"))
    
    # Plus and Premium users have unlimited swipes
    if tier in ["plus", "premium"]:
        return {
            "can_swipe": True,
            "swipes_remaining": -1,  # Unlimited
            "tier": tier
        }
    
    # Free users: 20 swipes per day
    swipes_today = user_doc.get("swipes_today", 0)
    last_reset = user_doc.get("last_swipe_reset")
    
    # Parse last reset date
    if last_reset:
        if isinstance(last_reset, str):
            last_reset_dt = datetime.fromisoformat(last_reset)
        else:
            last_reset_dt = last_reset
        
        # Ensure timezone aware
        if last_reset_dt.tzinfo is None:
            last_reset_dt = last_reset_dt.replace(tzinfo=timezone.utc)
    else:
        last_reset_dt = datetime.now(timezone.utc) - timedelta(days=1)  # Force reset
    
    # Check if we need to reset (new day in UTC)
    now = datetime.now(timezone.utc)
    last_reset_date = last_reset_dt.date()
    today_date = now.date()
    
    if last_reset_date < today_date:
        # Reset swipes for new day
        await db.users.update_one(
            {"user_id": user_doc["user_id"]},
            {
                "$set": {
                    "swipes_today": 0,
                    "last_swipe_reset": now.isoformat()
                }
            }
        )
        swipes_today = 0
    
    # Check if user has swipes remaining
    swipes_limit = 20  # Free tier limit
    swipes_remaining = swipes_limit - swipes_today
    can_swipe = swipes_remaining > 0
    
    return {
        "can_swipe": can_swipe,
        "swipes_remaining": swipes_remaining,
        "swipes_limit": swipes_limit,
        "tier": tier
    }

async def increment_swipe_count(db, user_id: str):
    """Increment user's swipe count for today"""
    await db.users.update_one(
        {"user_id": user_id},
        {"$inc": {"swipes_today": 1}}
    )

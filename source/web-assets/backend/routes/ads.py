"""
Rewarded Video Ads System
Watch 30-second ad → Earn 50 Vibe Credits
1 ad per hour limit to prevent abuse
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from utils.database import get_database, get_current_user
import uuid

router = APIRouter(prefix="/ads", tags=["ads"])

# Ad configuration
CREDITS_PER_AD = 50
COOLDOWN_HOURS = 1
AD_DURATION_SECONDS = 30

# ==================== MODELS ====================

class AdImpression(BaseModel):
    impression_id: str
    user_id: str
    started_at: str
    completed: bool = False
    completed_at: Optional[str] = None
    credits_awarded: int = 0
    ad_provider: str = "google_admob"  # or "ironsource", "adcolony"


class StartAd(BaseModel):
    ad_provider: Optional[str] = "google_admob"


# ==================== HELPER FUNCTIONS ====================

async def check_ad_eligibility(user_id: str, db) -> dict:
    """Check if user can watch an ad (cooldown check)"""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    if not user:
        return {"eligible": False, "reason": "user_not_found"}
    
    last_watched = user.get("last_ad_watched")
    
    if not last_watched:
        return {
            "eligible": True,
            "cooldown_remaining": 0,
            "can_watch": True
        }
    
    # Convert to datetime if string
    if isinstance(last_watched, str):
        last_watched = datetime.fromisoformat(last_watched)
    
    now = datetime.now(timezone.utc)
    time_since_last = now - last_watched
    cooldown_seconds = COOLDOWN_HOURS * 3600
    
    if time_since_last.total_seconds() >= cooldown_seconds:
        return {
            "eligible": True,
            "cooldown_remaining": 0,
            "can_watch": True
        }
    else:
        remaining = cooldown_seconds - time_since_last.total_seconds()
        return {
            "eligible": False,
            "reason": "cooldown_active",
            "cooldown_remaining": int(remaining),
            "can_watch": False,
            "next_available_in": f"{int(remaining / 60)} minutes"
        }


# ==================== ENDPOINTS ====================

@router.get("/available")
async def check_ad_availability(request: Request) -> Dict[str, Any]:
    """Check if user can watch a rewarded ad"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    eligibility = await check_ad_eligibility(current_user.user_id, db)
    
    return {
        **eligibility,
        "credits_per_ad": CREDITS_PER_AD,
        "ad_duration": AD_DURATION_SECONDS,
        "cooldown_hours": COOLDOWN_HOURS
    }


@router.post("/start")
async def start_ad(ad_data: StartAd, request: Request) -> Dict[str, Any]:
    """Start watching a rewarded ad"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Check eligibility
    eligibility = await check_ad_eligibility(current_user.user_id, db)
    
    if not eligibility["eligible"]:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot watch ad: {eligibility.get('reason', 'unknown')}"
        )
    
    # Create ad impression record
    impression_id = f"ad_{uuid.uuid4().hex[:12]}"
    impression = {
        "impression_id": impression_id,
        "user_id": current_user.user_id,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "completed": False,
        "credits_awarded": 0,
        "ad_provider": ad_data.ad_provider or "google_admob"
    }
    
    await db.ad_impressions.insert_one(impression)
    
    return {
        "success": True,
        "impression_id": impression_id,
        "message": "Ad started. Complete viewing to earn credits.",
        "credits_on_completion": CREDITS_PER_AD
    }


@router.post("/complete")
async def complete_ad(impression_id: str, request: Request) -> Dict[str, Any]:
    """Mark ad as completed and award credits"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_database()

    impression = await _load_impression_for_completion(
        db, impression_id, current_user.user_id,
    )
    now = datetime.now(timezone.utc)
    _validate_ad_duration(impression["started_at"], now)

    await _award_ad_credits(db, current_user.user_id, now)
    await _mark_impression_completed(db, impression_id, now)

    user = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    return {
        "success": True,
        "credits_earned": CREDITS_PER_AD,
        "new_balance": user.get("vibe_credits", 0),
        "total_ads_watched": user.get("total_ads_watched", 0),
        "message": f"✅ Earned {CREDITS_PER_AD} Vibe Credits!",
        "next_ad_available_in": COOLDOWN_HOURS * 3600,
    }


async def _load_impression_for_completion(
    db, impression_id: str, user_id: str,
) -> dict:
    """Fetch + validate the impression belongs to the user and is not yet
    marked completed. Raises HTTPException on any failure."""
    impression = await db.ad_impressions.find_one(
        {"impression_id": impression_id}, {"_id": 0},
    )
    if not impression:
        raise HTTPException(status_code=404, detail="Ad impression not found")
    if impression["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    if impression["completed"]:
        raise HTTPException(status_code=400, detail="Ad already completed")
    return impression


def _validate_ad_duration(started_at_iso: str, now: datetime) -> None:
    """Enforce the 30-second-min / 2-minute-max watch window."""
    started_at = datetime.fromisoformat(started_at_iso)
    elapsed = (now - started_at).total_seconds()
    if elapsed < AD_DURATION_SECONDS:
        raise HTTPException(
            status_code=400,
            detail=f"Ad must be watched for at least {AD_DURATION_SECONDS} seconds",
        )
    if elapsed > 120:
        raise HTTPException(status_code=400, detail="Ad session expired")


async def _award_ad_credits(db, user_id: str, now: datetime) -> None:
    """Increment user counters and stamp last_ad_watched."""
    await db.users.update_one(
        {"user_id": user_id},
        {
            "$inc": {
                "vibe_credits": CREDITS_PER_AD,
                "total_ads_watched": 1,
                "total_ad_credits_earned": CREDITS_PER_AD,
            },
            "$set": {"last_ad_watched": now, "updated_at": now},
        },
    )


async def _mark_impression_completed(
    db, impression_id: str, now: datetime,
) -> None:
    """Flip the impression row to completed."""
    await db.ad_impressions.update_one(
        {"impression_id": impression_id},
        {
            "$set": {
                "completed": True,
                "completed_at": now.isoformat(),
                "credits_awarded": CREDITS_PER_AD,
            }
        },
    )


@router.get("/stats")
async def get_ad_stats(request: Request) -> Dict[str, Any]:
    """Get user's ad watching statistics"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    user = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    
    # Get all impressions
    impressions = await db.ad_impressions.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).to_list(1000)
    
    completed_ads = [imp for imp in impressions if imp.get("completed")]
    
    return {
        "total_ads_watched": user.get("total_ads_watched", 0),
        "total_credits_earned": user.get("total_ad_credits_earned", 0),
        "last_ad_watched": user.get("last_ad_watched"),
        "total_impressions": len(impressions),
        "completed_impressions": len(completed_ads),
        "completion_rate": (len(completed_ads) / len(impressions) * 100) if impressions else 0
    }

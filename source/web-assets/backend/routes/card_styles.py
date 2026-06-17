from fastapi import APIRouter, HTTPException, Request
from typing import List, Dict, Any
from pydantic import BaseModel
from utils.database import get_database, get_current_user
from datetime import datetime, timezone

router = APIRouter(prefix="/card-styles", tags=["card_styles"])


# ==================== MODELS ====================

class CardStyle(BaseModel):
    style_id: str
    name: str
    description: str
    unlock_requirement: int  # Vibe Score required
    preview_gradient: str
    border_color: str
    glow_effect: str
    is_premium: bool


class SelectStyleRequest(BaseModel):
    style_id: str


# ==================== CARD STYLES CATALOG ====================

CARD_STYLES = {
    "classic": {
        "style_id": "classic",
        "name": "Classic",
        "description": "The original Global Vibez style",
        "unlock_requirement": 0,  # Default - everyone has it
        "preview_gradient": "from-slate-800 to-slate-900",
        "border_color": "border-white/20",
        "glow_effect": "none",
        "is_premium": False,
        "emoji": "🎴"
    },
    "neon": {
        "style_id": "neon",
        "name": "Neon Pulse",
        "description": "Electric cyberpunk vibes with glowing edges",
        "unlock_requirement": 500,
        "preview_gradient": "from-cyan-600 via-purple-600 to-pink-600",
        "border_color": "border-cyan-400/60",
        "glow_effect": "shadow-[0_0_20px_rgba(6,182,212,0.6)]",
        "is_premium": True,
        "emoji": "💠"
    },
    "gold": {
        "style_id": "gold",
        "name": "Golden Royale",
        "description": "Luxurious metallic gold finish for VIPs",
        "unlock_requirement": 1500,
        "preview_gradient": "from-yellow-600 via-amber-500 to-yellow-700",
        "border_color": "border-yellow-400/70",
        "glow_effect": "shadow-[0_0_30px_rgba(251,191,36,0.7)]",
        "is_premium": True,
        "emoji": "🏆"
    },
    "holographic": {
        "style_id": "holographic",
        "name": "Holographic Elite",
        "description": "Prismatic rainbow shimmer - ultra rare!",
        "unlock_requirement": 3000,
        "preview_gradient": "from-pink-500 via-purple-500 via-blue-500 to-cyan-500",
        "border_color": "border-fuchsia-400/80",
        "glow_effect": "shadow-[0_0_40px_rgba(232,121,249,0.8)] animate-pulse",
        "is_premium": True,
        "emoji": "💎"
    }
}


# ==================== HELPER FUNCTIONS ====================

async def check_unlocked_styles(vibe_score: int) -> List[str]:
    """Return list of style IDs user has unlocked based on Vibe Score"""
    unlocked = []
    for style_id, style_data in CARD_STYLES.items():
        if vibe_score >= style_data["unlock_requirement"]:
            unlocked.append(style_id)
    return unlocked


async def get_user_vibe_score(user_id: str, db) -> int:
    """Get user's current Vibe Score"""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return user.get("vibe_score", 0) if user else 0


# ==================== ENDPOINTS ====================

@router.get("/available")
async def get_available_styles(request: Request) -> Dict[str, Any]:
    """Get all card styles with unlock status for current user"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Get user's Vibe Score
    vibe_score = await get_user_vibe_score(current_user.user_id, db)
    
    # Get unlocked styles
    unlocked_styles = await check_unlocked_styles(vibe_score)
    
    # Get user's selected style
    user = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    selected_style = user.get("card_style", "classic") if user else "classic"
    
    # Build response
    styles = []
    for style_id, style_data in CARD_STYLES.items():
        styles.append({
            **style_data,
            "is_unlocked": style_id in unlocked_styles,
            "is_selected": style_id == selected_style,
            "unlock_progress": min(100, (vibe_score / style_data["unlock_requirement"] * 100)) if style_data["unlock_requirement"] > 0 else 100
        })
    
    # Sort by unlock requirement
    styles.sort(key=lambda x: x["unlock_requirement"])
    
    return {
        "styles": styles,
        "current_vibe_score": vibe_score,
        "selected_style": selected_style
    }


@router.post("/select")
async def select_card_style(style_request: SelectStyleRequest, request: Request) -> Dict[str, Any]:
    """Select a card style (must be unlocked)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Validate style exists
    if style_request.style_id not in CARD_STYLES:
        raise HTTPException(status_code=400, detail="Invalid style ID")
    
    # Get user's Vibe Score
    vibe_score = await get_user_vibe_score(current_user.user_id, db)
    
    # Check if style is unlocked
    unlocked_styles = await check_unlocked_styles(vibe_score)
    
    if style_request.style_id not in unlocked_styles:
        required_score = CARD_STYLES[style_request.style_id]["unlock_requirement"]
        raise HTTPException(
            status_code=403,
            detail=f"Style locked. Requires {required_score} Vibe Score (you have {vibe_score})"
        )
    
    # Update user's selected style
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$set": {
            "card_style": style_request.style_id,
            "card_style_updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "message": f"Card style changed to {CARD_STYLES[style_request.style_id]['name']}!",
        "selected_style": style_request.style_id,
        "style_data": CARD_STYLES[style_request.style_id]
    }


@router.get("/unlock-check")
async def check_new_unlocks(request: Request) -> Dict[str, Any]:
    """Check if user has unlocked any new styles (call after Vibe Score increase)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Get user data
    user = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    vibe_score = user.get("vibe_score", 0)
    previously_unlocked = user.get("unlocked_styles", ["classic"])
    
    # Get currently unlocked styles
    currently_unlocked = await check_unlocked_styles(vibe_score)
    
    # Find newly unlocked styles
    newly_unlocked = [style for style in currently_unlocked if style not in previously_unlocked]
    
    # Update user's unlocked styles list
    if newly_unlocked:
        await db.users.update_one(
            {"user_id": current_user.user_id},
            {"$set": {
                "unlocked_styles": currently_unlocked,
                "last_unlock_check": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    return {
        "newly_unlocked": [
            {
                "style_id": style_id,
                **CARD_STYLES[style_id]
            }
            for style_id in newly_unlocked
        ],
        "total_unlocked": len(currently_unlocked),
        "total_styles": len(CARD_STYLES),
        "vibe_score": vibe_score
    }


@router.get("/preview/{style_id}")
async def get_style_preview(style_id: str) -> Dict[str, Any]:
    """Get detailed preview data for a specific style"""
    if style_id not in CARD_STYLES:
        raise HTTPException(status_code=404, detail="Style not found")
    
    return {
        "style": CARD_STYLES[style_id],
        "example_cards": [
            {"suit": "hearts", "rank": "A", "color": "red"},
            {"suit": "spades", "rank": "K", "color": "black"},
            {"suit": "diamonds", "rank": "Q", "color": "red"},
            {"suit": "clubs", "rank": "J", "color": "black"}
        ]
    }


@router.get("/stats")
async def get_style_stats(request: Request) -> Dict[str, Any]:
    """Get user's card style statistics"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    user = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    vibe_score = user.get("vibe_score", 0)
    unlocked_count = len(await check_unlocked_styles(vibe_score))
    
    # Calculate next unlock
    next_unlock = None
    for style_id, style_data in sorted(CARD_STYLES.items(), key=lambda x: x[1]["unlock_requirement"]):
        if vibe_score < style_data["unlock_requirement"]:
            next_unlock = {
                "style_id": style_id,
                **style_data,
                "points_needed": style_data["unlock_requirement"] - vibe_score
            }
            break
    
    return {
        "unlocked_count": unlocked_count,
        "total_styles": len(CARD_STYLES),
        "completion_percentage": (unlocked_count / len(CARD_STYLES)) * 100,
        "current_style": user.get("card_style", "classic"),
        "next_unlock": next_unlock,
        "vibe_score": vibe_score
    }

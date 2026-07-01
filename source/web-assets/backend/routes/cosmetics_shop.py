"""
Digital Twin Boutique - Cosmetics Shop
Avatar customization: Profile frames, badges, card backs, emotes, skins
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from utils.database import get_database, get_current_user
import uuid

router = APIRouter(prefix="/cosmetics", tags=["cosmetics"])

# ==================== MODELS ====================

class PurchaseCosmetic(BaseModel):
    cosmetic_id: str


class EquipCosmetic(BaseModel):
    cosmetic_id: str
    slot: str  # "profile_frame", "badge", "card_back", "emote"


# ==================== DEFAULT COSMETICS CATALOG ====================

DEFAULT_COSMETICS = [
    # Profile Frames
    {
        "cosmetic_id": "frame_neon_cyber",
        "name": "Neon Cyber Frame",
        "type": "profile_frame",
        "rarity": "epic",
        "description": "Pulsing neon cyberpunk border for your profile",
        "price_coins": 500,
        "battle_pass_season": None,
        "image_url": "/assets/cosmetics/frames/neon_cyber.png",
        "available": True
    },
    {
        "cosmetic_id": "frame_golden_elite",
        "name": "Golden Elite Frame",
        "type": "profile_frame",
        "rarity": "legendary",
        "description": "Luxurious golden frame reserved for Elite members",
        "price_coins": 1000,
        "battle_pass_season": None,
        "image_url": "/assets/cosmetics/frames/golden_elite.png",
        "available": True
    },
    {
        "cosmetic_id": "frame_holographic",
        "name": "Holographic Frame",
        "type": "profile_frame",
        "rarity": "mythic",
        "description": "Shimmering holographic border with rainbow effects",
        "price_coins": 2000,
        "battle_pass_season": None,
        "image_url": "/assets/cosmetics/frames/holographic.png",
        "available": True
    },
    
    # Badges
    {
        "cosmetic_id": "badge_elite_2026",
        "name": "Elite 2026",
        "type": "badge",
        "rarity": "legendary",
        "description": "Exclusive badge for 2026 Elite subscribers",
        "price_coins": None,
        "battle_pass_season": None,
        "image_url": "/assets/cosmetics/badges/elite_2026.png",
        "available": True,
        "requires_elite": True
    },
    {
        "cosmetic_id": "badge_tournament_champ",
        "name": "Tournament Champion",
        "type": "badge",
        "rarity": "epic",
        "description": "Awarded for winning 10+ tournaments",
        "price_coins": None,
        "battle_pass_season": None,
        "image_url": "/assets/cosmetics/badges/tournament_champ.png",
        "available": True,
        "achievement_required": "win_10_tournaments"
    },
    {
        "cosmetic_id": "badge_vibe_master",
        "name": "Vibe Master",
        "type": "badge",
        "rarity": "rare",
        "description": "For users with 1000+ Vibe Score",
        "price_coins": 300,
        "battle_pass_season": None,
        "image_url": "/assets/cosmetics/badges/vibe_master.png",
        "available": True
    },
    
    # Card Backs (for casino games)
    {
        "cosmetic_id": "cardback_neon_aura",
        "name": "Neon Aura Cards",
        "type": "card_back",
        "rarity": "epic",
        "description": "Glowing neon trail effect on all your cards",
        "price_coins": 750,
        "battle_pass_season": None,
        "image_url": "/assets/cosmetics/cardbacks/neon_aura.png",
        "available": True
    },
    {
        "cosmetic_id": "cardback_holographic_luxury",
        "name": "Holographic Luxury",
        "type": "card_back",
        "rarity": "legendary",
        "description": "Premium holographic card design",
        "price_coins": 1500,
        "battle_pass_season": None,
        "image_url": "/assets/cosmetics/cardbacks/holographic.png",
        "available": True
    },
    
    # Emotes
    {
        "cosmetic_id": "emote_gg",
        "name": "GG",
        "type": "emote",
        "rarity": "common",
        "description": "Classic 'Good Game' emote",
        "price_coins": 100,
        "battle_pass_season": None,
        "image_url": "/assets/cosmetics/emotes/gg.png",
        "available": True
    },
    {
        "cosmetic_id": "emote_fire",
        "name": "🔥 Fire",
        "type": "emote",
        "rarity": "rare",
        "description": "Show them you're on fire!",
        "price_coins": 200,
        "battle_pass_season": None,
        "image_url": "/assets/cosmetics/emotes/fire.png",
        "available": True
    },
    {
        "cosmetic_id": "emote_heart_eyes",
        "name": "😍 Heart Eyes",
        "type": "emote",
        "rarity": "rare",
        "description": "For when you're impressed",
        "price_coins": 200,
        "battle_pass_season": None,
        "image_url": "/assets/cosmetics/emotes/heart_eyes.png",
        "available": True
    },
    
    # Battle Pass Exclusive (Season 2026-Q2)
    {
        "cosmetic_id": "frame_neon_dreams",
        "name": "Neon Dreams Frame",
        "type": "profile_frame",
        "rarity": "mythic",
        "description": "Exclusive frame from Neon Dreams season",
        "price_coins": None,
        "battle_pass_season": "2026-Q2",
        "battle_pass_level": 50,
        "battle_pass_tier": "premium",
        "image_url": "/assets/cosmetics/frames/neon_dreams.png",
        "available": True
    },
    {
        "cosmetic_id": "badge_bp_s1",
        "name": "Season 1 Champion",
        "type": "badge",
        "rarity": "legendary",
        "description": "Reached level 100 in Season 1 Battle Pass",
        "price_coins": None,
        "battle_pass_season": "2026-Q2",
        "battle_pass_level": 100,
        "battle_pass_tier": "premium",
        "image_url": "/assets/cosmetics/badges/bp_season_1.png",
        "available": True
    }
]

# ==================== HELPER FUNCTIONS ====================

async def initialize_cosmetics_catalog(db) -> Dict[str, Any]:
    """Initialize cosmetics catalog if not exists"""
    count = await db.cosmetics_catalog.count_documents({})
    
    if count == 0:
        # Insert default cosmetics
        for cosmetic in DEFAULT_COSMETICS:
            cosmetic["created_at"] = datetime.now(timezone.utc).isoformat()
            await db.cosmetics_catalog.insert_one(cosmetic.copy())


async def check_cosmetic_eligibility(cosmetic, user, db) -> dict:
    """Check if user is eligible to purchase/unlock a cosmetic"""
    # Check if Battle Pass exclusive
    if cosmetic.get("battle_pass_season"):
        # Check user's Battle Pass progress
        bp_progress = await db.battle_pass_progress.find_one({
            "user_id": user["user_id"],
            "season_id": cosmetic["battle_pass_season"]
        }, {"_id": 0})
        
        if not bp_progress:
            return {"eligible": False, "reason": "Battle Pass not owned"}
        
        if bp_progress["tier"] != cosmetic.get("battle_pass_tier", "free"):
            return {"eligible": False, "reason": f"{cosmetic['battle_pass_tier'].capitalize()} Battle Pass required"}
        
        if bp_progress["current_level"] < cosmetic.get("battle_pass_level", 0):
            return {"eligible": False, "reason": f"Level {cosmetic['battle_pass_level']} required"}
        
        return {"eligible": True, "method": "battle_pass"}
    
    # Check if Elite exclusive
    if cosmetic.get("requires_elite"):
        if not user.get("elite_subscription_active"):
            return {"eligible": False, "reason": "Elite subscription required"}
        return {"eligible": True, "method": "elite"}
    
    # Check if achievement required
    if cosmetic.get("achievement_required"):
        # TODO: Implement achievement checking
        return {"eligible": False, "reason": "Achievement not unlocked"}
    
    # Check if purchasable with coins
    if cosmetic.get("price_coins"):
        if user.get("coins", 0) < cosmetic["price_coins"]:
            return {"eligible": False, "reason": "Insufficient coins"}
        return {"eligible": True, "method": "coins"}
    
    return {"eligible": False, "reason": "Not available for purchase"}


# ==================== ENDPOINTS ====================

@router.get("/catalog")
async def get_cosmetics_catalog(
    type: Optional[str] = None,
    rarity: Optional[str] = None,
    available_only: bool = True
) -> Dict[str, Any]:
    """Get cosmetics catalog with optional filters"""
    db = get_database()
    
    # Initialize catalog if empty
    await initialize_cosmetics_catalog(db)
    
    # Build filter
    filter_query = {}
    if type:
        filter_query["type"] = type
    if rarity:
        filter_query["rarity"] = rarity
    if available_only:
        filter_query["available"] = True
    
    cosmetics = await db.cosmetics_catalog.find(filter_query, {"_id": 0}).to_list(1000)
    
    return {"cosmetics": cosmetics}


@router.get("/my-collection")
async def get_my_cosmetics(request: Request) -> Dict[str, Any]:
    """Get user's owned cosmetics"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    user = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    
    owned_ids = user.get("owned_cosmetics", [])
    equipped = user.get("equipped_cosmetics", {})
    
    # Get full cosmetic data
    owned_cosmetics = []
    if owned_ids:
        owned_cosmetics = await db.cosmetics_catalog.find(
            {"cosmetic_id": {"$in": owned_ids}},
            {"_id": 0}
        ).to_list(1000)
    
    return {
        "owned_cosmetics": owned_cosmetics,
        "equipped_cosmetics": equipped,
        "total_owned": len(owned_ids)
    }


@router.post("/purchase")
async def purchase_cosmetic(purchase_data: PurchaseCosmetic, request: Request) -> Dict[str, Any]:
    """Purchase a cosmetic with coins"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    user = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    
    # Get cosmetic
    cosmetic = await db.cosmetics_catalog.find_one(
        {"cosmetic_id": purchase_data.cosmetic_id},
        {"_id": 0}
    )
    
    if not cosmetic:
        raise HTTPException(status_code=404, detail="Cosmetic not found")
    
    # Check if already owned
    if purchase_data.cosmetic_id in user.get("owned_cosmetics", []):
        raise HTTPException(status_code=400, detail="Already owned")
    
    # Check eligibility
    eligibility = await check_cosmetic_eligibility(cosmetic, user, db)
    
    if not eligibility["eligible"]:
        raise HTTPException(status_code=403, detail=eligibility["reason"])
    
    # Process purchase
    if eligibility["method"] == "coins":
        price = cosmetic["price_coins"]
        
        # Deduct coins
        await db.users.update_one(
            {"user_id": current_user.user_id},
            {
                "$inc": {"coins": -price},
                "$push": {"owned_cosmetics": purchase_data.cosmetic_id},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            }
        )
        
        # Record purchase
        purchase_record = {
            "purchase_id": f"cos_{uuid.uuid4().hex[:12]}",
            "user_id": current_user.user_id,
            "cosmetic_id": purchase_data.cosmetic_id,
            "price_paid": price,
            "method": "coins",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.cosmetic_purchases.insert_one(purchase_record)
        
        return {
            "success": True,
            "message": f"Purchased {cosmetic['name']}",
            "cosmetic": cosmetic,
            "coins_spent": price,
            "remaining_coins": user.get("coins", 0) - price
        }
    
    elif eligibility["method"] == "battle_pass":
        # Grant cosmetic (already unlocked via BP)
        await db.users.update_one(
            {"user_id": current_user.user_id},
            {
                "$push": {"owned_cosmetics": purchase_data.cosmetic_id},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            }
        )
        
        return {
            "success": True,
            "message": f"Unlocked {cosmetic['name']} via Battle Pass",
            "cosmetic": cosmetic,
            "method": "battle_pass"
        }
    
    elif eligibility["method"] == "elite":
        # Grant Elite exclusive
        await db.users.update_one(
            {"user_id": current_user.user_id},
            {
                "$push": {"owned_cosmetics": purchase_data.cosmetic_id},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            }
        )
        
        return {
            "success": True,
            "message": f"Unlocked {cosmetic['name']} as Elite member",
            "cosmetic": cosmetic,
            "method": "elite"
        }
    
    else:
        raise HTTPException(status_code=400, detail="Purchase method not supported")


@router.post("/equip")
async def equip_cosmetic(equip_data: EquipCosmetic, request: Request) -> Dict[str, Any]:
    """Equip a cosmetic to a slot"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    user = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    
    # Check if owned
    if equip_data.cosmetic_id not in user.get("owned_cosmetics", []):
        raise HTTPException(status_code=403, detail="Cosmetic not owned")
    
    # Get cosmetic to verify slot type
    cosmetic = await db.cosmetics_catalog.find_one(
        {"cosmetic_id": equip_data.cosmetic_id},
        {"_id": 0}
    )
    
    if not cosmetic:
        raise HTTPException(status_code=404, detail="Cosmetic not found")
    
    if cosmetic["type"] != equip_data.slot:
        raise HTTPException(status_code=400, detail=f"Cosmetic type mismatch. Expected {equip_data.slot}, got {cosmetic['type']}")
    
    # Equip cosmetic
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {
            "$set": {
                f"equipped_cosmetics.{equip_data.slot}": equip_data.cosmetic_id,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {
        "success": True,
        "message": f"Equipped {cosmetic['name']}",
        "slot": equip_data.slot,
        "cosmetic_id": equip_data.cosmetic_id
    }


@router.post("/unequip/{slot}")
async def unequip_cosmetic(slot: str, request: Request) -> Dict[str, Any]:
    """Unequip cosmetic from a slot"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {
            "$unset": {f"equipped_cosmetics.{slot}": ""},
            "$set": {"updated_at": datetime.now(timezone.utc)}
        }
    )
    
    return {
        "success": True,
        "message": f"Unequipped {slot}",
        "slot": slot
    }


@router.get("/featured")
async def get_featured_cosmetics() -> Dict[str, Any]:
    """Get featured cosmetics (new or limited edition)"""
    db = get_database()
    
    # Get mythic and legendary items
    featured = await db.cosmetics_catalog.find(
        {
            "rarity": {"$in": ["legendary", "mythic"]},
            "available": True
        },
        {"_id": 0}
    ).limit(6).to_list(6)
    
    return {"featured_cosmetics": featured}

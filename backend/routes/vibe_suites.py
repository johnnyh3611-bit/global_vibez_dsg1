"""
Private Vibe Suites - Exclusive Token-Gated Gaming Rooms
Premium multi-player rooms with NFT/token access control
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from utils.database import get_database, get_current_user
import uuid

router = APIRouter(prefix="/vibe-suites", tags=["Private Vibe Suites"])


# ==================== MODELS ====================

class SuiteAccessLevel(str):
    PUBLIC = "public"  # Anyone can join
    TOKEN_GATED = "token_gated"  # Requires X tokens to enter
    NFT_GATED = "nft_gated"  # Requires specific NFT
    INVITE_ONLY = "invite_only"  # Owner approval required
    WHITELIST = "whitelist"  # Pre-approved addresses only


class SuiteTheme(str):
    NEON_PALACE = "neon_palace"
    GOLD_RUSH = "gold_rush"
    CYBER_LOUNGE = "cyber_lounge"
    ETHEREAL_GARDEN = "ethereal_garden"
    MIDNIGHT_CLUB = "midnight_club"


class CreateSuiteRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    access_level: str = SuiteAccessLevel.TOKEN_GATED
    entry_requirement: int = 500  # Tokens required or NFT ID
    theme: str = SuiteTheme.CYBER_LOUNGE
    max_players: int = 8
    available_games: List[str] = ["blackjack", "baccarat", "poker"]
    enable_voice_chat: bool = True
    enable_video_chat: bool = False
    is_permanent: bool = False  # False = expires after 24h


class JoinSuiteRequest(BaseModel):
    suite_id: str


class InvitePlayerRequest(BaseModel):
    suite_id: str
    player_id: str


# ==================== HELPER FUNCTIONS ====================

async def check_token_balance(db, user_id: str, required_amount: int) -> bool:
    """Check if user has sufficient tokens"""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        return False
    return user.get("token_balance", 0) >= required_amount


async def check_nft_ownership(db, user_id: str, nft_id: str) -> bool:
    """Check if user owns specific NFT (placeholder for real NFT check)"""
    # In production, integrate with blockchain/NFT API
    user_nfts = await db.user_nfts.find_one(
        {"user_id": user_id, "nft_ids": nft_id},
        {"_id": 0}
    )
    return user_nfts is not None


async def is_whitelisted(db, suite_id: str, user_id: str) -> bool:
    """Check if user is whitelisted for suite"""
    suite = await db.vibe_suites.find_one(
        {"suite_id": suite_id, "whitelist": {"$in": [user_id]}},
        {"_id": 0}
    )
    return suite is not None


# ==================== ENDPOINTS ====================

@router.get("/me/balance")
async def my_vibe_suite_balance(http_request: Request) -> Dict[str, Any]:
    """
    Returns the caller's ₵ Vibez Coin balance used for `token_gated` suites.

    The frontend uses this to render an inline "Need ₵X more to enter"
    hint on each gated suite card *before* the user clicks Join.
    """
    current_user = await get_current_user(http_request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_database()
    user = await db.users.find_one(
        {"user_id": current_user.user_id},
        {"_id": 0, "token_balance": 1},
    )
    return {
        "user_id": current_user.user_id,
        "token_balance": int((user or {}).get("token_balance", 0)),
    }


@router.post("/create")
async def create_vibe_suite(request: CreateSuiteRequest, http_request: Request) -> Dict[str, Any]:
    """
    Create a new Private Vibe Suite
    - Set access control (public, token-gated, NFT-gated, invite-only, whitelist)
    - Choose theme and games
    - Configure player limits and chat options
    """
    current_user = await get_current_user(http_request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Check if user has premium status (optional)
    user = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    suite_id = f"suite_{uuid.uuid4().hex[:12]}"
    
    suite_data = {
        "suite_id": suite_id,
        "name": request.name,
        "description": request.description,
        "owner_id": current_user.user_id,
        "owner_name": user.get("username", "Anonymous"),
        "access_level": request.access_level,
        "entry_requirement": request.entry_requirement,
        "theme": request.theme,
        "max_players": request.max_players,
        "current_players": [],
        "available_games": request.available_games,
        "active_game": None,
        "enable_voice_chat": request.enable_voice_chat,
        "enable_video_chat": request.enable_video_chat,
        "is_permanent": request.is_permanent,
        "whitelist": [],
        "invited_players": [],
        "status": "active",  # active, closed, archived
        "total_sessions": 0,
        "total_revenue": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": None if request.is_permanent else 
                      (datetime.now(timezone.utc).timestamp() + 86400)  # 24 hours
    }
    
    await db.vibe_suites.insert_one(suite_data)
    
    return {
        "success": True,
        "suite_id": suite_id,
        "message": f"Vibe Suite '{request.name}' created successfully!",
        "share_url": f"/vibe-suites/{suite_id}",
        "access_code": suite_id[-6:].upper()  # Last 6 chars as easy share code
    }


@router.get("/discover")
async def discover_suites(
    access_level: Optional[str] = None,
    theme: Optional[str] = None,
    has_space: bool = True,
    limit: int = 20
) -> Dict[str, Any]:
    """
    Browse available Vibe Suites
    - Filter by access level and theme
    - Only show suites with available space (optional)
    """
    db = get_database()
    
    query = {"status": "active"}
    
    if access_level:
        query["access_level"] = access_level
    
    if theme:
        query["theme"] = theme
    
    suites = await db.vibe_suites.find(query, {"_id": 0}).sort(
        "created_at", -1
    ).limit(limit).to_list(limit)
    
    # Filter by available space if requested
    if has_space:
        suites = [s for s in suites if len(s.get("current_players", [])) < s["max_players"]]
    
    return {
        "success": True,
        "suites": suites,
        "total": len(suites)
    }


@router.get("/{suite_id}")
async def get_suite_details(suite_id: str) -> Dict[str, Any]:
    """Get Vibe Suite details"""
    db = get_database()
    
    suite = await db.vibe_suites.find_one({"suite_id": suite_id}, {"_id": 0})
    
    if not suite:
        raise HTTPException(status_code=404, detail="Suite not found")
    
    return {
        "success": True,
        "suite": suite
    }


@router.post("/join")
async def join_vibe_suite(request: JoinSuiteRequest, http_request: Request) -> Dict[str, Any]:
    """
    Join a Vibe Suite
    - Check access requirements (tokens, NFT, whitelist, invite)
    - Add player to suite
    - Return suite access token
    """
    current_user = await get_current_user(http_request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Get suite
    suite = await db.vibe_suites.find_one({"suite_id": request.suite_id}, {"_id": 0})
    if not suite:
        raise HTTPException(status_code=404, detail="Suite not found")
    
    if suite["status"] != "active":
        raise HTTPException(status_code=400, detail="Suite is not active")
    
    # Check if suite is full
    if len(suite.get("current_players", [])) >= suite["max_players"]:
        raise HTTPException(status_code=400, detail="Suite is full")
    
    # Check if already in suite
    if current_user.user_id in [p["user_id"] for p in suite.get("current_players", [])]:
        return {
            "success": True,
            "message": "You are already in this suite",
            "suite": suite
        }
    
    # Access Control Checks
    access_level = suite["access_level"]
    
    if access_level == SuiteAccessLevel.TOKEN_GATED:
        required_tokens = suite["entry_requirement"]
        has_tokens = await check_token_balance(db, current_user.user_id, required_tokens)
        
        if not has_tokens:
            raise HTTPException(
                status_code=403,
                detail=f"Insufficient tokens. Requires {required_tokens} tokens to enter."
            )
    
    elif access_level == SuiteAccessLevel.NFT_GATED:
        required_nft = str(suite["entry_requirement"])
        has_nft = await check_nft_ownership(db, current_user.user_id, required_nft)
        
        if not has_nft:
            raise HTTPException(
                status_code=403,
                detail=f"You don't own the required NFT (ID: {required_nft})"
            )
    
    elif access_level == SuiteAccessLevel.WHITELIST:
        is_allowed = await is_whitelisted(db, request.suite_id, current_user.user_id)
        
        if not is_allowed:
            raise HTTPException(
                status_code=403,
                detail="You are not whitelisted for this suite"
            )
    
    elif access_level == SuiteAccessLevel.INVITE_ONLY:
        is_invited = current_user.user_id in suite.get("invited_players", [])
        
        if not is_invited and current_user.user_id != suite["owner_id"]:
            raise HTTPException(
                status_code=403,
                detail="This is an invite-only suite"
            )
    
    # Add player to suite
    user = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    
    player_data = {
        "user_id": current_user.user_id,
        "username": user.get("username", "Player"),
        "joined_at": datetime.now(timezone.utc).isoformat(),
        "is_ready": False
    }
    
    await db.vibe_suites.update_one(
        {"suite_id": request.suite_id},
        {
            "$push": {"current_players": player_data},
            "$inc": {"total_sessions": 1}
        }
    )
    
    # Record access log
    await db.suite_access_logs.insert_one({
        "suite_id": request.suite_id,
        "user_id": current_user.user_id,
        "action": "joined",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "message": f"Welcome to {suite['name']}!",
        "suite": {
            **suite,
            "current_players": suite.get("current_players", []) + [player_data]
        },
        "access_token": f"suite_access_{uuid.uuid4().hex[:16]}"
    }


@router.post("/leave")
async def leave_vibe_suite(suite_id: str, http_request: Request) -> Dict[str, Any]:
    """Leave a Vibe Suite"""
    current_user = await get_current_user(http_request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Remove player from suite
    result = await db.vibe_suites.update_one(
        {"suite_id": suite_id},
        {"$pull": {"current_players": {"user_id": current_user.user_id}}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="You are not in this suite")
    
    # Log action
    await db.suite_access_logs.insert_one({
        "suite_id": suite_id,
        "user_id": current_user.user_id,
        "action": "left",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "message": "Left suite successfully"
    }


@router.post("/invite")
async def invite_player(request: InvitePlayerRequest, http_request: Request) -> Dict[str, Any]:
    """Invite a player to join suite (owner only)"""
    current_user = await get_current_user(http_request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Check if user is suite owner
    suite = await db.vibe_suites.find_one({"suite_id": request.suite_id}, {"_id": 0})
    if not suite:
        raise HTTPException(status_code=404, detail="Suite not found")
    
    if suite["owner_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Only suite owner can invite players")
    
    # Add to invited list
    await db.vibe_suites.update_one(
        {"suite_id": request.suite_id},
        {"$addToSet": {"invited_players": request.player_id}}
    )
    
    return {
        "success": True,
        "message": f"Player {request.player_id} invited successfully"
    }


@router.get("/my-suites")
async def get_my_suites(http_request: Request) -> Dict[str, Any]:
    """Get suites owned by current user"""
    current_user = await get_current_user(http_request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    suites = await db.vibe_suites.find(
        {"owner_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {
        "success": True,
        "suites": suites,
        "total": len(suites)
    }


@router.delete("/{suite_id}")
async def close_suite(suite_id: str, http_request: Request) -> Dict[str, Any]:
    """Close/archive a suite (owner only)"""
    current_user = await get_current_user(http_request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Check ownership
    suite = await db.vibe_suites.find_one({"suite_id": suite_id}, {"_id": 0})
    if not suite:
        raise HTTPException(status_code=404, detail="Suite not found")
    
    if suite["owner_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Only suite owner can close the suite")
    
    # Update status
    await db.vibe_suites.update_one(
        {"suite_id": suite_id},
        {"$set": {"status": "closed"}}
    )
    
    return {
        "success": True,
        "message": "Suite closed successfully"
    }

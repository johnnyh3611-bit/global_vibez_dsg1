from fastapi import APIRouter, HTTPException, Request
from typing import Optional, Dict, Any
from pydantic import BaseModel
from utils.database import get_database, get_current_user
from datetime import datetime, timezone, timedelta
import uuid

router = APIRouter(prefix="/table-for-two", tags=["table_for_two"])


# ==================== MODELS ====================

class GameInvite(BaseModel):
    match_id: str  # The dating match ID
    game_type: str  # 'uno', 'connect4', 'tictactoe', 'checkers'
    message: Optional[str] = None  # Optional personal message


class InviteResponse(BaseModel):
    invite_id: str
    action: str  # 'accept' or 'decline'


# ==================== QUICK ICEBREAKER GAMES ====================

ICEBREAKER_GAMES = {
    "uno": {
        "name": "UNO",
        "emoji": "🎴",
        "duration": "5-10 mins",
        "description": "Fast-paced card game - perfect icebreaker!",
        "practice_route": "/practice/uno"
    },
    "connect4": {
        "name": "Connect 4",
        "emoji": "🔴",
        "duration": "3-5 mins",
        "description": "Classic strategy game",
        "practice_route": "/practice/connect4"
    },
    "tictactoe": {
        "name": "Tic-Tac-Toe",
        "emoji": "⭕",
        "duration": "1-2 mins",
        "description": "Quick and fun",
        "practice_route": "/practice/tictactoe"
    },
    "checkers": {
        "name": "Checkers",
        "emoji": "⚫",
        "duration": "5-10 mins",
        "description": "Strategic board game",
        "practice_route": "/practice/checkers"
    }
}


# ==================== ENDPOINTS ====================

@router.get("/games")
async def get_icebreaker_games() -> Dict[str, Any]:
    """Get list of available icebreaker games"""
    return {
        "games": ICEBREAKER_GAMES,
        "message": "Quick games perfect for breaking the ice!"
    }


@router.post("/invite")
async def send_game_invite(invite: GameInvite, request: Request) -> Dict[str, Any]:
    """Send a game invite to a dating match"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Verify match exists
    match = await db.matches.find_one({
        "match_id": invite.match_id,
        "both_ids": {"$in": [current_user.user_id]}
    }, {"_id": 0})
    
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    # Get the other user ID
    other_user_id = [uid for uid in match["both_ids"] if uid != current_user.user_id][0]
    
    # Verify game type
    if invite.game_type not in ICEBREAKER_GAMES:
        raise HTTPException(status_code=400, detail=f"Invalid game type. Choose from: {', '.join(ICEBREAKER_GAMES.keys())}")
    
    # Check if there's already a pending invite for this match
    existing_invite = await db.table_for_two_invites.find_one({
        "match_id": invite.match_id,
        "status": "pending"
    }, {"_id": 0})
    
    if existing_invite:
        raise HTTPException(status_code=400, detail="There's already a pending game invite for this match")
    
    # Create invite
    game_invite = {
        "invite_id": f"t4t_{uuid.uuid4().hex[:12]}",
        "match_id": invite.match_id,
        "from_user_id": current_user.user_id,
        "to_user_id": other_user_id,
        "game_type": invite.game_type,
        "game_info": ICEBREAKER_GAMES[invite.game_type],
        "message": invite.message,
        "status": "pending",  # pending, accepted, declined, expired
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
    }
    
    await db.table_for_two_invites.insert_one(game_invite)
    
    # Create notification for the other user
    notification = {
        "notification_id": str(uuid.uuid4()),
        "user_id": other_user_id,
        "type": "game_invite",
        "title": f"🎮 Game Invite from {current_user.name}",
        "message": f"{current_user.name} wants to play {ICEBREAKER_GAMES[invite.game_type]['name']} with you!",
        "data": {
            "invite_id": game_invite["invite_id"],
            "game_type": invite.game_type,
            "from_user": {
                "user_id": current_user.user_id,
                "username": current_user.name,
                "avatar": current_user.picture
            }
        },
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.notifications.insert_one(notification)
    
    return {
        "invite_id": game_invite["invite_id"],
        "message": f"Game invite sent! Waiting for {ICEBREAKER_GAMES[invite.game_type]['name']} acceptance..."
    }


@router.get("/invites/received")
async def get_received_invites(request: Request) -> Dict[str, Any]:
    """Get game invites received by current user"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Get pending invites
    invites = await db.table_for_two_invites.find({
        "to_user_id": current_user.user_id,
        "status": "pending"
    }, {"_id": 0}).to_list(100)
    
    # Remove expired invites
    now = datetime.now(timezone.utc)
    valid_invites = []
    
    for invite in invites:
        expires_at = datetime.fromisoformat(invite["expires_at"].replace('Z', '+00:00'))
        if now < expires_at:
            valid_invites.append(invite)
        else:
            # Mark as expired
            await db.table_for_two_invites.update_one(
                {"invite_id": invite["invite_id"]},
                {"$set": {"status": "expired"}}
            )
    
    return {"invites": valid_invites}


@router.get("/invites/sent")
async def get_sent_invites(request: Request) -> Dict[str, Any]:
    """Get game invites sent by current user"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    invites = await db.table_for_two_invites.find({
        "from_user_id": current_user.user_id,
        "status": "pending"
    }, {"_id": 0}).to_list(100)
    
    return {"invites": invites}


@router.post("/invites/{invite_id}/respond")
async def respond_to_invite(invite_id: str, response: InviteResponse, request: Request) -> Dict[str, Any]:
    """Accept or decline a game invite"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Get invite
    invite = await db.table_for_two_invites.find_one({
        "invite_id": invite_id
    }, {"_id": 0})
    
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    
    # Verify current user is the recipient
    if invite["to_user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="This invite is not for you")
    
    # Check if invite is still pending
    if invite["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Invite is already {invite['status']}")
    
    # Check if expired
    now = datetime.now(timezone.utc)
    expires_at = datetime.fromisoformat(invite["expires_at"].replace('Z', '+00:00'))
    if now >= expires_at:
        await db.table_for_two_invites.update_one(
            {"invite_id": invite_id},
            {"$set": {"status": "expired"}}
        )
        raise HTTPException(status_code=400, detail="This invite has expired")
    
    # Update invite status
    new_status = "accepted" if response.action == "accept" else "declined"
    await db.table_for_two_invites.update_one(
        {"invite_id": invite_id},
        {"$set": {
            "status": new_status,
            "responded_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if response.action == "accept":
        # Create a dating-mode game session
        game_session = {
            "game_id": f"dating_{invite['game_type']}_{uuid.uuid4().hex[:8]}",
            "game_type": invite["game_type"],
            "mode": "dating",  # Special dating mode tag
            "invite_id": invite_id,
            "match_id": invite["match_id"],
            "player_1_id": invite["from_user_id"],
            "player_2_id": invite["to_user_id"],
            "status": "waiting_for_players",  # waiting_for_players, in_progress, completed
            "created_at": datetime.now(timezone.utc).isoformat(),
            "practice_route": invite["game_info"]["practice_route"]
        }
        
        await db.dating_game_sessions.insert_one(game_session)
        
        # Notify the inviter
        notification = {
            "notification_id": str(uuid.uuid4()),
            "user_id": invite["from_user_id"],
            "type": "game_accepted",
            "title": "🎉 Game Accepted!",
            "message": f"{current_user.name} accepted your {invite['game_info']['name']} invite!",
            "data": {
                "game_id": game_session["game_id"],
                "game_type": invite["game_type"],
                "practice_route": invite["game_info"]["practice_route"]
            },
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.notifications.insert_one(notification)
        
        return {
            "message": "Invite accepted! Redirecting to game...",
            "game_id": game_session["game_id"],
            "practice_route": invite["game_info"]["practice_route"]
        }
    
    else:
        # Notify the inviter of decline
        notification = {
            "notification_id": str(uuid.uuid4()),
            "user_id": invite["from_user_id"],
            "type": "game_declined",
            "title": "Game Declined",
            "message": f"{current_user.name} declined your game invite",
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.notifications.insert_one(notification)
        
        return {"message": "Invite declined"}


@router.delete("/invites/{invite_id}")
async def cancel_invite(invite_id: str, request: Request) -> Dict[str, Any]:
    """Cancel a sent invite"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Verify this is the sender's invite
    invite = await db.table_for_two_invites.find_one({
        "invite_id": invite_id,
        "from_user_id": current_user.user_id
    }, {"_id": 0})
    
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    
    if invite["status"] != "pending":
        raise HTTPException(status_code=400, detail="Can only cancel pending invites")
    
    # Mark as cancelled
    await db.table_for_two_invites.update_one(
        {"invite_id": invite_id},
        {"$set": {"status": "cancelled"}}
    )
    
    return {"message": "Invite cancelled"}


@router.get("/stats")
async def get_table_for_two_stats(request: Request) -> Dict[str, Any]:
    """Get user's Table for Two statistics"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Get all invites
    sent_invites = await db.table_for_two_invites.count_documents({
        "from_user_id": current_user.user_id
    })
    
    accepted_invites = await db.table_for_two_invites.count_documents({
        "from_user_id": current_user.user_id,
        "status": "accepted"
    })
    
    games_played = await db.dating_game_sessions.count_documents({
        "$or": [
            {"player_1_id": current_user.user_id},
            {"player_2_id": current_user.user_id}
        ],
        "mode": "dating"
    })
    
    return {
        "invites_sent": sent_invites,
        "invites_accepted": accepted_invites,
        "acceptance_rate": (accepted_invites / sent_invites * 100) if sent_invites > 0 else 0,
        "dating_games_played": games_played
    }

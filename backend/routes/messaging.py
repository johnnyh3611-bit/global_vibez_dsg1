"""
Real-Time Messaging System with Socket.IO
Supports: Direct messages, typing indicators, read receipts, online status, voice messages, images, GIFs, reactions
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
from utils.database import get_database, get_current_user

router = APIRouter(prefix="/messaging", tags=["messaging"])

# ==================== MODELS ====================

class SendMessageRequest(BaseModel):
    receiver_id: str
    content: str
    message_type: str = "text"  # text, image, voice, gif

class MarkAsReadRequest(BaseModel):
    message_ids: List[str]

class TypingIndicatorRequest(BaseModel):
    receiver_id: str
    is_typing: bool

# ==================== SEND MESSAGE ====================

@router.post("/send")
async def send_message(message_data: SendMessageRequest, request: Request) -> Dict[str, Any]:
    """Send a message to a matched user"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Check if users are matched
    match = await db.matches.find_one({
        "both_ids": {"$all": [current_user.user_id, message_data.receiver_id]}
    }, {"_id": 0})
    
    if not match:
        raise HTTPException(status_code=403, detail="You can only message matched users")
    
    # Create message
    message = {
        "message_id": f"msg_{uuid.uuid4().hex[:16]}",
        "match_id": match["match_id"],
        "sender_id": current_user.user_id,
        "receiver_id": message_data.receiver_id,
        "content": message_data.content,
        "message_type": message_data.message_type,
        "read": False,
        "delivered": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.messages.insert_one(message)
    
    # Remove MongoDB's _id before returning (not JSON serializable)
    message.pop("_id", None)
    
    return {
        "success": True,
        "message": message
    }


# ==================== GET CONVERSATIONS ====================

@router.get("/conversations")
async def get_conversations(request: Request) -> Dict[str, Any]:
    """Get all conversations (matches with messages)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Get all matches
    matches = await db.matches.find(
        {"both_ids": current_user.user_id},
        {"_id": 0}
    ).to_list(1000)
    
    if not matches:
        return {"conversations": []}
    
    conversations = []
    
    for match in matches:
        # Get other user - handle both old (user_id_1, user_id_2) and new (both_ids) structures
        if "both_ids" in match and isinstance(match["both_ids"], list):
            # New structure: both_ids is an array
            other_user_id = next((uid for uid in match["both_ids"] if uid != current_user.user_id), None)
        elif "user_id_1" in match and "user_id_2" in match:
            # Old structure: separate user_id_1 and user_id_2 fields
            other_user_id = match["user_id_1"] if match.get("user_id_2") == current_user.user_id else match["user_id_2"]
        else:
            # Unknown structure, skip this match
            continue
        
        if not other_user_id:
            continue
        
        other_user = await db.users.find_one(
            {"user_id": other_user_id},
            {"_id": 0, "user_id": 1, "name": 1, "photos": 1, "location": 1}
        )
        
        if not other_user:
            continue
        
        # Get last message
        last_message = await db.messages.find_one(
            {"match_id": match["match_id"]},
            {"_id": 0},
            sort=[("created_at", -1)]
        )
        
        # Count unread messages
        unread_count = await db.messages.count_documents({
            "match_id": match["match_id"],
            "receiver_id": current_user.user_id,
            "read": False
        })
        
        conversations.append({
            "match_id": match["match_id"],
            "other_user": other_user,
            "last_message": last_message.get("content", "") if last_message else "",
            "last_message_time": last_message.get("created_at", match.get("created_at", "")) if last_message else match.get("created_at", ""),
            "unread_count": unread_count,
            "last_message_sender": last_message.get("sender_id", "") if last_message else ""
        })
    
    # Sort by last message time
    conversations.sort(key=lambda x: x["last_message_time"], reverse=True)
    
    return {"conversations": conversations}


# ==================== GET CONVERSATION HISTORY ====================

@router.get("/conversation/{other_user_id}")
async def get_conversation(other_user_id: str, request: Request, limit: int = 100) -> Dict[str, Any]:
    """Get conversation history with another user"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Check if users are matched
    match = await db.matches.find_one({
        "both_ids": {"$all": [current_user.user_id, other_user_id]}
    }, {"_id": 0})
    
    if not match:
        # Return empty conversation if not matched (allow viewing empty state)
        return {"messages": [], "match_id": None}
    
    # Get messages
    messages = await db.messages.find(
        {"match_id": match["match_id"]},
        {"_id": 0}
    ).sort("created_at", 1).to_list(limit)
    
    # Mark messages as read
    await db.messages.update_many(
        {
            "match_id": match["match_id"],
            "receiver_id": current_user.user_id,
            "read": False
        },
        {"$set": {"read": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {
        "messages": messages,
        "match_id": match["match_id"]
    }


# ==================== MARK AS READ ====================

@router.post("/mark-read")
async def mark_as_read(data: MarkAsReadRequest, request: Request) -> Dict[str, Any]:
    """Mark messages as read"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    result = await db.messages.update_many(
        {
            "message_id": {"$in": data.message_ids},
            "receiver_id": current_user.user_id
        },
        {"$set": {"read": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {
        "success": True,
        "updated_count": result.modified_count
    }


# ==================== DELETE MESSAGE ====================

@router.delete("/message/{message_id}")
async def delete_message(message_id: str, request: Request) -> Dict[str, Any]:
    """Delete a message (only sender can delete)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    message = await db.messages.find_one(
        {"message_id": message_id, "sender_id": current_user.user_id},
        {"_id": 0}
    )
    
    if not message:
        raise HTTPException(status_code=404, detail="Message not found or unauthorized")
    
    await db.messages.delete_one({"message_id": message_id})
    
    return {"success": True, "message": "Message deleted"}


# ==================== ONLINE STATUS ====================

@router.post("/status/online")
async def set_online_status(request: Request) -> Dict[str, Any]:
    """Set user online status"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {
            "$set": {
                "online": True,
                "last_seen": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {"success": True, "status": "online"}


@router.post("/status/offline")
async def set_offline_status(request: Request) -> Dict[str, Any]:
    """Set user offline status"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {
            "$set": {
                "online": False,
                "last_seen": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {"success": True, "status": "offline"}


@router.get("/status/{user_id}")
async def get_user_status(user_id: str, request: Request) -> Dict[str, Any]:
    """Get user's online status"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    user = await db.users.find_one(
        {"user_id": user_id},
        {"_id": 0, "online": 1, "last_seen": 1}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "user_id": user_id,
        "online": user.get("online", False),
        "last_seen": user.get("last_seen", "")
    }


# ==================== UNREAD COUNT ====================

@router.get("/unread-count")
async def get_unread_count(request: Request) -> Dict[str, Any]:
    """Get total unread message count"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    count = await db.messages.count_documents({
        "receiver_id": current_user.user_id,
        "read": False
    })
    
    return {"unread_count": count}


# ==================== VOICE MESSAGES ====================

@router.post("/send-voice")
async def send_voice_message(
    receiver_id: str,
    audio_data: str,  # Base64 encoded audio
    duration: float,
    request: Request
) -> Dict[str, Any]:
    """Send a voice message"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Check if users are matched
    match = await db.matches.find_one({
        "both_ids": {"$all": [current_user.user_id, receiver_id]}
    }, {"_id": 0})
    
    if not match:
        raise HTTPException(status_code=403, detail="You can only message matched users")
    
    # Create voice message
    message = {
        "message_id": f"msg_{uuid.uuid4().hex[:16]}",
        "match_id": match["match_id"],
        "sender_id": current_user.user_id,
        "receiver_id": receiver_id,
        "content": audio_data,  # Base64 audio
        "message_type": "voice",
        "duration": duration,
        "read": False,
        "delivered": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.messages.insert_one(message)
    message.pop("_id", None)
    
    return {
        "success": True,
        "message": message
    }


# ==================== IMAGE MESSAGES ====================

@router.post("/send-image")
async def send_image_message(
    receiver_id: str,
    image_data: str,  # Base64 encoded image
    request: Request
) -> Dict[str, Any]:
    """Send an image message"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Check if users are matched
    match = await db.matches.find_one({
        "both_ids": {"$all": [current_user.user_id, receiver_id]}
    }, {"_id": 0})
    
    if not match:
        raise HTTPException(status_code=403, detail="You can only message matched users")
    
    # Create image message
    message = {
        "message_id": f"msg_{uuid.uuid4().hex[:16]}",
        "match_id": match["match_id"],
        "sender_id": current_user.user_id,
        "receiver_id": receiver_id,
        "content": image_data,  # Base64 image
        "message_type": "image",
        "read": False,
        "delivered": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.messages.insert_one(message)
    message.pop("_id", None)
    
    return {
        "success": True,
        "message": message
    }


# ==================== GIF MESSAGES ====================

@router.post("/send-gif")
async def send_gif_message(
    receiver_id: str,
    gif_url: str,
    request: Request
) -> Dict[str, Any]:
    """Send a GIF message"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Check if users are matched
    match = await db.matches.find_one({
        "both_ids": {"$all": [current_user.user_id, receiver_id]}
    }, {"_id": 0})
    
    if not match:
        raise HTTPException(status_code=403, detail="You can only message matched users")
    
    # Create GIF message
    message = {
        "message_id": f"msg_{uuid.uuid4().hex[:16]}",
        "match_id": match["match_id"],
        "sender_id": current_user.user_id,
        "receiver_id": receiver_id,
        "content": gif_url,  # Giphy URL
        "message_type": "gif",
        "read": False,
        "delivered": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.messages.insert_one(message)
    message.pop("_id", None)
    
    return {
        "success": True,
        "message": message
    }


# ==================== EMOJI REACTIONS ====================

class AddReactionRequest(BaseModel):
    message_id: str
    emoji: str

@router.post("/add-reaction")
async def add_reaction(data: AddReactionRequest, request: Request) -> Dict[str, Any]:
    """Add emoji reaction to a message"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Get message
    message = await db.messages.find_one(
        {"message_id": data.message_id},
        {"_id": 0}
    )
    
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Initialize reactions if not exists
    if "reactions" not in message:
        message["reactions"] = {}
    
    # Add or update reaction
    if data.emoji not in message["reactions"]:
        message["reactions"][data.emoji] = []
    
    if current_user.user_id not in message["reactions"][data.emoji]:
        message["reactions"][data.emoji].append(current_user.user_id)
    
    # Update message
    await db.messages.update_one(
        {"message_id": data.message_id},
        {"$set": {"reactions": message["reactions"]}}
    )
    
    return {
        "success": True,
        "reactions": message["reactions"]
    }


@router.delete("/remove-reaction/{message_id}/{emoji}")
async def remove_reaction(message_id: str, emoji: str, request: Request) -> Dict[str, Any]:
    """Remove emoji reaction from a message"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Remove user from reaction list
    result = await db.messages.update_one(
        {"message_id": message_id},
        {"$pull": {f"reactions.{emoji}": current_user.user_id}}
    )
    
    if result.modified_count > 0:
        # Get updated reactions
        message = await db.messages.find_one(
            {"message_id": message_id},
            {"_id": 0, "reactions": 1}
        )
        
        return {
            "success": True,
            "reactions": message.get("reactions", {})
        }
    
    return {"success": False, "error": "Reaction not found"}


# ==================== MESSAGE SEARCH ====================

@router.get("/search")
async def search_messages(
    query: str,
    other_user_id: Optional[str] = None,
    limit: int = 50,
    request: Request = None
) -> Dict[str, Any]:
    """Search messages by content"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Build search query
    search_query = {
        "$or": [
            {"sender_id": current_user.user_id},
            {"receiver_id": current_user.user_id}
        ],
        "content": {"$regex": query, "$options": "i"},
        "message_type": "text"  # Only search text messages
    }
    
    # Filter by specific conversation if provided
    if other_user_id:
        match = await db.matches.find_one({
            "both_ids": {"$all": [current_user.user_id, other_user_id]}
        }, {"_id": 0, "match_id": 1})
        
        if match:
            search_query["match_id"] = match["match_id"]
    
    # Search messages
    messages = await db.messages.find(
        search_query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    return {
        "success": True,
        "results": messages,
        "count": len(messages)
    }



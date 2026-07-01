"""
Friend System API Routes
Handles friend requests, friend lists, and social connections
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import os
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/api/friends", tags=["friends"])

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'global_vibez_dsg')
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Pydantic Models
class FriendRequest(BaseModel):
    from_user_id: str
    to_user_id: str
    message: Optional[str] = None

class FriendRequestResponse(BaseModel):
    request_id: str
    action: str  # 'accept' or 'reject'

class Friend(BaseModel):
    user_id: str
    friend_id: str
    friend_name: str
    friend_avatar: Optional[str] = None
    status: str  # 'online', 'offline', 'in_game'
    added_at: str

# Helper function to get user info
async def get_user_info(user_id: str) -> Dict[str, Any]:
    """Get user information from database"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    return user

@router.post("/request/send")
async def send_friend_request(request: FriendRequest) -> Dict[str, Any]:
    """Send a friend request to another user"""
    try:
        # Check if users exist
        from_user = await get_user_info(request.from_user_id)
        to_user = await get_user_info(request.to_user_id)
        
        if not from_user or not to_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check if already friends
        existing_friendship = await db.friendships.find_one({
            "$or": [
                {"user_id": request.from_user_id, "friend_id": request.to_user_id},
                {"user_id": request.to_user_id, "friend_id": request.from_user_id}
            ]
        }, {"_id": 0})
        
        if existing_friendship:
            raise HTTPException(status_code=400, detail="Already friends")
        
        # Check if request already exists
        existing_request = await db.friend_requests.find_one({
            "from_user_id": request.from_user_id,
            "to_user_id": request.to_user_id,
            "status": "pending"
        }, {"_id": 0})
        
        if existing_request:
            raise HTTPException(status_code=400, detail="Friend request already sent")
        
        # Create friend request
        friend_request = {
            "id": f"freq_{datetime.now(timezone.utc).timestamp()}",
            "from_user_id": request.from_user_id,
            "from_user_name": from_user.get("name", "Unknown"),
            "from_user_avatar": from_user.get("avatar", None),
            "to_user_id": request.to_user_id,
            "message": request.message,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.friend_requests.insert_one(friend_request)
        
        return {
            "success": True,
            "message": "Friend request sent",
            "request_id": friend_request["id"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/requests/pending/{user_id}")
async def get_pending_requests(user_id: str) -> Dict[str, Any]:
    """Get all pending friend requests for a user"""
    try:
        requests = await db.friend_requests.find({
            "to_user_id": user_id,
            "status": "pending"
        }, {"_id": 0}).to_list(100)
        
        return {
            "success": True,
            "requests": requests,
            "count": len(requests)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/request/respond")
async def respond_to_friend_request(response: FriendRequestResponse) -> Dict[str, Any]:
    """Accept or reject a friend request"""
    try:
        # Get the friend request
        friend_request = await db.friend_requests.find_one({
            "id": response.request_id
        }, {"_id": 0})
        
        if not friend_request:
            raise HTTPException(status_code=404, detail="Friend request not found")
        
        if friend_request["status"] != "pending":
            raise HTTPException(status_code=400, detail="Friend request already processed")
        
        # Update request status
        await db.friend_requests.update_one(
            {"id": response.request_id},
            {"$set": {
                "status": response.action,
                "responded_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # If accepted, create friendship
        if response.action == "accept":
            from_user = await get_user_info(friend_request["from_user_id"])
            to_user = await get_user_info(friend_request["to_user_id"])
            
            # Create bidirectional friendship
            friendships = [
                {
                    "id": f"friend_{friend_request['from_user_id']}_{friend_request['to_user_id']}",
                    "user_id": friend_request["from_user_id"],
                    "friend_id": friend_request["to_user_id"],
                    "friend_name": to_user.get("name", "Unknown"),
                    "friend_avatar": to_user.get("avatar", None),
                    "created_at": datetime.now(timezone.utc).isoformat()
                },
                {
                    "id": f"friend_{friend_request['to_user_id']}_{friend_request['from_user_id']}",
                    "user_id": friend_request["to_user_id"],
                    "friend_id": friend_request["from_user_id"],
                    "friend_name": from_user.get("name", "Unknown"),
                    "friend_avatar": from_user.get("avatar", None),
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
            ]
            
            await db.friendships.insert_many(friendships)
        
        return {
            "success": True,
            "message": f"Friend request {response.action}ed",
            "action": response.action
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/list/{user_id}")
async def get_friends_list(user_id: str) -> Dict[str, Any]:
    """Get user's friends list with online status"""
    try:
        # Get all friendships
        friendships = await db.friendships.find({
            "user_id": user_id
        }, {"_id": 0}).to_list(1000)
        
        # Get online status for each friend
        friends_with_status = []
        for friendship in friendships:
            friend_id = friendship["friend_id"]
            
            # Check if friend is in active game
            active_game = await db.http_games.find_one({
                "$or": [
                    {"player1_id": friend_id},
                    {"player2_id": friend_id}
                ],
                "status": "active"
            }, {"_id": 0})
            
            # Check last activity
            user = await get_user_info(friend_id)
            last_active = user.get("last_active") if user else None
            
            status = "offline"
            if active_game:
                status = "in_game"
                game_type = active_game.get("game_type", "unknown")
                friendship["current_game"] = game_type
            elif last_active:
                # Consider online if active in last 5 minutes
                try:
                    last_active_time = datetime.fromisoformat(last_active)
                    now = datetime.now(timezone.utc)
                    if (now - last_active_time).total_seconds() < 300:
                        status = "online"
                except (ValueError, TypeError):
                    pass
            
            friendship["status"] = status
            friends_with_status.append(friendship)
        
        return {
            "success": True,
            "friends": friends_with_status,
            "count": len(friends_with_status)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/remove/{user_id}/{friend_id}")
async def remove_friend(user_id: str, friend_id: str) -> Dict[str, Any]:
    """Remove a friend"""
    try:
        # Delete bidirectional friendship
        result = await db.friendships.delete_many({
            "$or": [
                {"user_id": user_id, "friend_id": friend_id},
                {"user_id": friend_id, "friend_id": user_id}
            ]
        })
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Friendship not found")
        
        return {
            "success": True,
            "message": "Friend removed"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/search")
async def search_users(query: str, exclude_user_id: str) -> Dict[str, Any]:
    """Search for users to add as friends"""
    try:
        # Search by name or email (case insensitive)
        users = await db.users.find({
            "id": {"$ne": exclude_user_id},
            "$or": [
                {"name": {"$regex": query, "$options": "i"}},
                {"email": {"$regex": query, "$options": "i"}}
            ]
        }, {
            "_id": 0,
            "id": 1,
            "name": 1,
            "email": 1,
            "avatar": 1
        }).to_list(50)
        
        # Check if already friends
        for user in users:
            friendship = await db.friendships.find_one({
                "user_id": exclude_user_id,
                "friend_id": user["id"]
            }, {"_id": 0})
            
            user["is_friend"] = friendship is not None
            
            # Check if pending request exists
            pending_request = await db.friend_requests.find_one({
                "from_user_id": exclude_user_id,
                "to_user_id": user["id"],
                "status": "pending"
            }, {"_id": 0})
            
            user["request_pending"] = pending_request is not None
        
        return {
            "success": True,
            "users": users,
            "count": len(users)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

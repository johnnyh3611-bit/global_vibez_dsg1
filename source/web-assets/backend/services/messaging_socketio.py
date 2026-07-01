"""
Real-Time Messaging Socket.IO Events
Handles instant message delivery, typing indicators, online status
"""
import socketio
from typing import Dict, Set
from datetime import datetime, timezone
from utils.database import get_database

# Import the main Socket.IO server from multiplayer.py
from services.multiplayer import sio

# Active messaging connections
# user_id -> set of session_ids (user can have multiple tabs/devices)
online_users: Dict[str, Set[str]] = {}
# session_id -> user_id mapping
session_to_user: Dict[str, str] = {}
# Typing status: match_id -> {user_id: timestamp}
typing_status: Dict[str, Dict[str, datetime]] = {}


class MessagingNamespace(socketio.AsyncNamespace):
    """Messaging namespace handler for real-time chat features"""
    
    async def on_connect(self, sid: str, environ: dict, auth: dict = None) -> None:
        """Handle messaging connection"""
        print(f"[Messaging] Client connected: {sid}")
        
        # Get user_id from auth
        user_id = auth.get('user_id') if auth else None
        if user_id:
            session_to_user[sid] = user_id
            if user_id not in online_users:
                online_users[user_id] = set()
            online_users[user_id].add(sid)
            
            # Update user online status in database
            db = get_database()
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {
                    "online": True,
                    "last_seen": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # Notify all matches that this user is online
            await self.broadcast_online_status(user_id, True)
            
            print(f"[Messaging] User {user_id} connected (session: {sid})")
        
        return True

    async def on_disconnect(self, sid: str) -> None:
        """Handle messaging disconnection"""
        print(f"[Messaging] Client disconnected: {sid}")
        
        user_id = session_to_user.get(sid)
        if user_id:
            # Remove session from user's active sessions
            if user_id in online_users:
                online_users[user_id].discard(sid)
                
                # If no more active sessions, mark user offline
                if not online_users[user_id]:
                    del online_users[user_id]
                    
                    db = get_database()
                    await db.users.update_one(
                        {"user_id": user_id},
                        {"$set": {
                            "online": False,
                            "last_seen": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                    
                    # Notify all matches that this user is offline
                    await self.broadcast_online_status(user_id, False)
            
            del session_to_user[sid]
            print(f"[Messaging] User {user_id} disconnected")

    async def on_send_message(self, sid: str, data: dict) -> None:
        """Handle real-time message send"""
        user_id = session_to_user.get(sid)
        if not user_id:
            return {"success": False, "error": "Not authenticated"}
        
        receiver_id = data.get('receiver_id')
        content = data.get('content')
        message_type = data.get('message_type', 'text')
        
        if not receiver_id or not content:
            return {"success": False, "error": "Missing required fields"}
        
        db = get_database()
        
        # Check if users are matched
        match = await db.matches.find_one({
            "both_ids": {"$all": [user_id, receiver_id]}
        }, {"_id": 0})
        
        if not match:
            return {"success": False, "error": "You can only message matched users"}
        
        # Create message
        message = {
            "message_id": f"msg_{datetime.now().timestamp()}_{sid[:8]}",
            "match_id": match["match_id"],
            "sender_id": user_id,
            "receiver_id": receiver_id,
            "content": content,
            "message_type": message_type,
            "read": False,
            "delivered": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Save to database
        await db.messages.insert_one(message)
        message.pop("_id", None)
        
        # Emit to receiver if online
        if receiver_id in online_users:
            for receiver_sid in online_users[receiver_id]:
                await self.emit('new_message', message, room=receiver_sid)
            message['delivered'] = True
            
            # Update delivery status
            await db.messages.update_one(
                {"message_id": message["message_id"]},
                {"$set": {"delivered": True}}
            )
        
        # Also emit back to sender for confirmation
        await self.emit('message_sent', message, room=sid)
        
        return {"success": True, "message": message}

    async def on_mark_message_read(self, sid: str, data: dict) -> None:
        """Mark message as read"""
        user_id = session_to_user.get(sid)
        if not user_id:
            return {"success": False, "error": "Not authenticated"}
        
        message_id = data.get('message_id')
        if not message_id:
            return {"success": False, "error": "Missing message_id"}
        
        db = get_database()
        
        # Update message
        result = await db.messages.update_one(
            {"message_id": message_id, "receiver_id": user_id},
            {"$set": {"read": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        if result.modified_count > 0:
            # Get message to find sender
            message = await db.messages.find_one({"message_id": message_id}, {"_id": 0})
            if message:
                sender_id = message['sender_id']
                
                # Notify sender that message was read
                if sender_id in online_users:
                    for sender_sid in online_users[sender_id]:
                        await self.emit('message_read', {
                            "message_id": message_id,
                            "read_by": user_id,
                            "read_at": datetime.now(timezone.utc).isoformat()
                        }, room=sender_sid)
            
            return {"success": True}
        
        return {"success": False, "error": "Message not found"}

    async def on_typing_start(self, sid: str, data: dict) -> None:
        """User started typing"""
        user_id = session_to_user.get(sid)
        if not user_id:
            return
        
        receiver_id = data.get('receiver_id')
        if not receiver_id:
            return
        
        db = get_database()
        
        # Get match_id
        match = await db.matches.find_one({
            "both_ids": {"$all": [user_id, receiver_id]}
        }, {"_id": 0, "match_id": 1})
        
        if not match:
            return
        
        match_id = match['match_id']
        
        # Update typing status
        if match_id not in typing_status:
            typing_status[match_id] = {}
        typing_status[match_id][user_id] = datetime.now(timezone.utc)
        
        # Notify receiver if online
        if receiver_id in online_users:
            for receiver_sid in online_users[receiver_id]:
                await self.emit('user_typing', {
                    "user_id": user_id,
                    "is_typing": True
                }, room=receiver_sid)

    async def on_typing_stop(self, sid: str, data: dict) -> None:
        """User stopped typing"""
        user_id = session_to_user.get(sid)
        if not user_id:
            return
        
        receiver_id = data.get('receiver_id')
        if not receiver_id:
            return
        
        db = get_database()
        
        # Get match_id
        match = await db.matches.find_one({
            "both_ids": {"$all": [user_id, receiver_id]}
        }, {"_id": 0, "match_id": 1})
        
        if not match:
            return
        
        match_id = match['match_id']
        
        # Clear typing status
        if match_id in typing_status and user_id in typing_status[match_id]:
            del typing_status[match_id][user_id]
        
        # Notify receiver if online
        if receiver_id in online_users:
            for receiver_sid in online_users[receiver_id]:
                await self.emit('user_typing', {
                    "user_id": user_id,
                    "is_typing": False
                }, room=receiver_sid)

    async def broadcast_online_status(self, user_id: str, is_online: bool) -> None:
        """Broadcast user's online status to all their matches"""
        db = get_database()
        
        # Get all matches for this user
        matches = await db.matches.find(
            {"both_ids": user_id},
            {"_id": 0, "user_id_1": 1, "user_id_2": 1}
        ).to_list(1000)
        
        for match in matches:
            other_user_id = match["user_id_1"] if match["user_id_2"] == user_id else match["user_id_2"]
            
            # If other user is online, notify them
            if other_user_id in online_users:
                for other_sid in online_users[other_user_id]:
                    await self.emit('user_status_changed', {
                        "user_id": user_id,
                        "online": is_online,
                        "last_seen": datetime.now(timezone.utc).isoformat()
                    }, room=other_sid)


# Register the namespace
sio.register_namespace(MessagingNamespace('/messaging'))


# Helper functions for external use
def get_online_users() -> list:
    """Get list of currently online user IDs"""
    return list(online_users.keys())


def is_user_online(user_id: str) -> bool:
    """Check if user is currently online"""
    return user_id in online_users

from motor.motor_asyncio import AsyncIOMotorClient
from fastapi import Request
from typing import Optional
from models import User

# Global database client and db instances
client: Optional[AsyncIOMotorClient] = None
db = None


def get_database():
    """Get database instance"""
    global db
    if db is None:
        raise Exception("Database not initialized")
    return db


def initialize_database(mongo_url: str, db_name: str):
    """Initialize database connection"""
    global client, db
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    return db


def close_database():
    """Close database connection"""
    global client
    if client:
        client.close()


def generate_referral_code(user_id: str) -> str:
    """Generate a unique referral code for a user"""
    return f"GV{user_id[:8].upper()}"


async def get_current_user(request: Request) -> Optional[User]:
    """Extract user from session token (cookie or Authorization header)"""
    session_token = None
    
    # Try cookie first
    session_token = request.cookies.get("session_token")
    
    # Fallback to Authorization header
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.replace("Bearer ", "")
    
    if not session_token:
        return None
    
    # Look up session
    db = get_database()
    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session_doc:
        return None
    
    # Get user
    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]},
        {"_id": 0}
    )
    
    if not user_doc:
        return None
    
    return User(**user_doc)

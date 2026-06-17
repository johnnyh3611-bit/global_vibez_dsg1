from fastapi import APIRouter, HTTPException, Request
from typing import List, Dict, Optional, Any
from pydantic import BaseModel
from utils.database import get_database, get_current_user
from datetime import datetime, timezone, timedelta
import uuid
import httpx
import os

router = APIRouter(prefix="/speed-dating", tags=["speed_dating"])

# Daily.co API configuration
DAILY_API_KEY = os.environ.get('DAILY_API_KEY', '')
DAILY_API_URL = "https://api.daily.co/v1"


# ==================== MODELS ====================

class SpeedDatingEvent(BaseModel):
    event_id: str
    title: str
    description: str
    scheduled_time: datetime
    duration_minutes: int  # Total event duration
    session_duration_minutes: int  # Each 1-on-1 session duration
    max_participants: int
    participants: List[str] = []
    status: str = "upcoming"  # upcoming, active, completed, cancelled
    created_by: str
    created_at: datetime


class SpeedDatingSession(BaseModel):
    session_id: str
    event_id: str
    participant1_id: str
    participant2_id: str
    room_url: Optional[str] = None
    room_name: Optional[str] = None
    start_time: datetime
    end_time: datetime
    status: str = "scheduled"  # scheduled, active, completed
    matched: Optional[bool] = None  # Both liked each other after session


class EventCreate(BaseModel):
    title: str
    description: str
    scheduled_time: datetime
    duration_minutes: int = 60
    session_duration_minutes: int = 5
    max_participants: int = 10


class JoinEvent(BaseModel):
    event_id: str


class SessionFeedback(BaseModel):
    session_id: str
    liked: bool  # Did you like this person?


# ==================== DAILY.CO ROOM MANAGEMENT ====================

async def create_daily_room(room_name: str, duration_minutes: int = 10) -> Dict:
    """Create a Daily.co video room"""
    if not DAILY_API_KEY:
        # Return mock data if no API key (for development)
        return {
            "url": f"https://yourdomain.daily.co/{room_name}",
            "name": room_name,
            "privacy": "private"
        }
    
    headers = {
        "Authorization": f"Bearer {DAILY_API_KEY}",
        "Content-Type": "application/json"
    }
    
    exp_time = int((datetime.now(timezone.utc) + timedelta(minutes=duration_minutes)).timestamp())
    
    data = {
        "name": room_name,
        "privacy": "private",
        "properties": {
            "exp": exp_time,
            "enable_chat": True,
            "enable_screenshare": False,
            "start_video_off": False,
            "start_audio_off": False,
            "max_participants": 2
        }
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{DAILY_API_URL}/rooms",
                headers=headers,
                json=data,
                timeout=10.0
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(status_code=500, detail="Failed to create video room")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Daily.co API error: {str(e)}")


async def delete_daily_room(room_name: str) -> Dict[str, Any]:
    """Delete a Daily.co room"""
    if not DAILY_API_KEY:
        return  # Skip if no API key
    
    headers = {
        "Authorization": f"Bearer {DAILY_API_KEY}"
    }
    
    try:
        async with httpx.AsyncClient() as client:
            await client.delete(
                f"{DAILY_API_URL}/rooms/{room_name}",
                headers=headers,
                timeout=10.0
            )
    except Exception:
        pass  # Ignore deletion errors


# ==================== ENDPOINTS ====================

@router.post("/events/create")
async def create_event(event_data: EventCreate, request: Request) -> Dict[str, Any]:
    """Create a new speed dating event"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Check if user is premium (optional requirement)
    # if current_user.membership_type != "premium":
    #     raise HTTPException(status_code=403, detail="Premium membership required to create events")
    
    db = get_database()
    
    event = {
        "event_id": f"event_{uuid.uuid4().hex[:12]}",
        "title": event_data.title,
        "description": event_data.description,
        "scheduled_time": event_data.scheduled_time.isoformat(),
        "duration_minutes": event_data.duration_minutes,
        "session_duration_minutes": event_data.session_duration_minutes,
        "max_participants": event_data.max_participants,
        "participants": [],
        "status": "upcoming",
        "created_by": current_user.user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.speed_dating_events.insert_one(event)
    
    return {"event_id": event["event_id"], "message": "Event created successfully"}


@router.get("/events/list")
async def list_events(request: Request, status: str = "upcoming") -> Dict[str, Any]:
    """List all speed dating events"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    query = {"status": status} if status else {}
    events = await db.speed_dating_events.find(query, {"_id": 0}).sort("scheduled_time", 1).to_list(100)
    
    return {"events": events}


@router.post("/events/join")
async def join_event(join_data: JoinEvent, request: Request) -> Dict[str, Any]:
    """Join a speed dating event"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    event = await db.speed_dating_events.find_one({"event_id": join_data.event_id}, {"_id": 0})
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if event["status"] != "upcoming":
        raise HTTPException(status_code=400, detail="Event is not open for registration")
    
    if current_user.user_id in event["participants"]:
        raise HTTPException(status_code=400, detail="Already joined this event")
    
    if len(event["participants"]) >= event["max_participants"]:
        raise HTTPException(status_code=400, detail="Event is full")
    
    await db.speed_dating_events.update_one(
        {"event_id": join_data.event_id},
        {"$push": {"participants": current_user.user_id}}
    )
    
    return {"message": "Successfully joined the event"}


@router.post("/events/{event_id}/start")
async def start_event(event_id: str, request: Request) -> Dict[str, Any]:
    """Start a speed dating event (admin/creator only)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    event = await db.speed_dating_events.find_one({"event_id": event_id}, {"_id": 0})
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if event["created_by"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Only event creator can start the event")
    
    if event["status"] != "upcoming":
        raise HTTPException(status_code=400, detail="Event cannot be started")
    
    # Create session pairings
    participants = event["participants"]
    if len(participants) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 participants")
    
    # Round-robin pairing algorithm
    sessions = []
    session_duration = event["session_duration_minutes"]
    start_time = datetime.now(timezone.utc)
    
    # Simple pairing: person 0 with 1, 2, 3... then person 1 with 2, 3... etc.
    for i in range(len(participants)):
        for j in range(i + 1, len(participants)):
            session_start = start_time + timedelta(minutes=len(sessions) * session_duration)
            session_end = session_start + timedelta(minutes=session_duration)
            
            room_name = f"speed_{event_id}_{i}_{j}_{uuid.uuid4().hex[:6]}"
            
            session = {
                "session_id": f"session_{uuid.uuid4().hex[:12]}",
                "event_id": event_id,
                "participant1_id": participants[i],
                "participant2_id": participants[j],
                "room_name": room_name,
                "room_url": None,  # Will be created when session starts
                "start_time": session_start.isoformat(),
                "end_time": session_end.isoformat(),
                "status": "scheduled",
                "matched": None,
            }
            
            sessions.append(session)
    
    # Save all sessions
    if sessions:
        await db.speed_dating_sessions.insert_many(sessions)
    
    # Update event status
    await db.speed_dating_events.update_one(
        {"event_id": event_id},
        {"$set": {"status": "active"}}
    )
    
    return {"message": f"Event started with {len(sessions)} sessions", "sessions_count": len(sessions)}


@router.get("/sessions/my-current")
async def get_current_session(request: Request) -> Dict[str, Any]:
    """Get user's current active session"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    now = datetime.now(timezone.utc)
    
    # Find current active session
    session = await db.speed_dating_sessions.find_one(
        {
            "$or": [
                {"participant1_id": current_user.user_id},
                {"participant2_id": current_user.user_id}
            ],
            "status": {"$in": ["scheduled", "active"]},
            "start_time": {"$lte": now.isoformat()},
            "end_time": {"$gte": now.isoformat()}
        },
        {"_id": 0}
    )
    
    if not session:
        return {"session": None, "message": "No active session"}
    
    # Create room if doesn't exist
    if not session.get("room_url"):
        room_data = await create_daily_room(session["room_name"], session_duration_minutes=10)
        session["room_url"] = room_data["url"]
        
        await db.speed_dating_sessions.update_one(
            {"session_id": session["session_id"]},
            {"$set": {"room_url": room_data["url"], "status": "active"}}
        )
    
    # Get other participant's info
    other_user_id = session["participant2_id"] if session["participant1_id"] == current_user.user_id else session["participant1_id"]
    other_user = await db.users.find_one({"user_id": other_user_id}, {"_id": 0, "name": 1, "picture": 1, "age": 1, "bio": 1})
    
    return {
        "session": session,
        "other_user": other_user,
        "time_remaining": (datetime.fromisoformat(session["end_time"]) - now).seconds
    }


@router.post("/sessions/feedback")
async def submit_feedback(feedback: SessionFeedback, request: Request) -> Dict[str, Any]:
    """Submit feedback after a session (like/pass)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    session = await db.speed_dating_sessions.find_one({"session_id": feedback.session_id}, {"_id": 0})
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Determine which participant gave feedback
    feedback_field = None
    if session["participant1_id"] == current_user.user_id:
        feedback_field = "participant1_liked"
        other_user_id = session["participant2_id"]
    elif session["participant2_id"] == current_user.user_id:
        feedback_field = "participant2_liked"
        other_user_id = session["participant1_id"]
    else:
        raise HTTPException(status_code=403, detail="Not a participant of this session")
    
    # Update feedback
    await db.speed_dating_sessions.update_one(
        {"session_id": feedback.session_id},
        {"$set": {feedback_field: feedback.liked, "status": "completed"}}
    )
    
    # Check if both liked each other
    updated_session = await db.speed_dating_sessions.find_one({"session_id": feedback.session_id}, {"_id": 0})
    
    if updated_session.get("participant1_liked") and updated_session.get("participant2_liked"):
        # It's a match! Create a match record
        existing_match = await db.matches.find_one({
            "both_ids": {"$all": [current_user.user_id, other_user_id]}
        })
        
        if not existing_match:
            match = {
                "match_id": f"match_{uuid.uuid4().hex[:12]}",
                "user_id_1": session["participant1_id"],
                "user_id_2": session["participant2_id"],
                "both_ids": [session["participant1_id"], session["participant2_id"]],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "source": "speed_dating"
            }
            await db.matches.insert_one(match)
            
            await db.speed_dating_sessions.update_one(
                {"session_id": feedback.session_id},
                {"$set": {"matched": True}}
            )
            
            return {"message": "It's a match! 🎉", "matched": True}
    
    return {"message": "Feedback submitted", "matched": False}


@router.get("/sessions/upcoming")
async def get_upcoming_sessions(request: Request) -> Dict[str, Any]:
    """Get user's upcoming speed dating sessions"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    sessions = await db.speed_dating_sessions.find(
        {
            "$or": [
                {"participant1_id": current_user.user_id},
                {"participant2_id": current_user.user_id}
            ],
            "status": "scheduled"
        },
        {"_id": 0}
    ).sort("start_time", 1).to_list(50)
    
    return {"sessions": sessions}

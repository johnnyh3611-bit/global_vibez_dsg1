from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from uuid import uuid4
import secrets
secure_random = secrets.SystemRandom()

router = APIRouter()

# Pydantic Models
class LiveStream(BaseModel):
    id: str
    title: str
    host: str
    host_avatar: str
    viewers: int
    thumbnail: str
    category: str
    is_live: bool
    duration: str
    tags: List[str]
    stream_url: Optional[str] = None

class JoinStreamRequest(BaseModel):
    user_id: str
    stream_id: str

class CreateStreamRequest(BaseModel):
    user_id: str
    title: str
    category: str
    tags: List[str] = []

# Mock Database
mock_streams = {
    "stream1": {
        "id": "stream1",
        "title": "High Stakes Poker Championship",
        "host": "ProGamer",
        "host_id": "user_pro1",
        "host_avatar": "🎮",
        "viewers": 12847,
        "thumbnail": "🃏",
        "category": "gaming",
        "is_live": True,
        "duration": "2:34:12",
        "tags": ["Poker", "High Stakes", "Championship"],
        "stream_url": "rtmp://stream.globalvibez.com/live/stream1",
        "started_at": datetime.now(timezone.utc).isoformat()
    },
    "stream2": {
        "id": "stream2",
        "title": "Neon Nights DJ Set - Deep House Vibes",
        "host": "DJ Vibez",
        "host_id": "user_dj1",
        "host_avatar": "🎧",
        "viewers": 8432,
        "thumbnail": "🎵",
        "category": "music",
        "is_live": True,
        "duration": "1:15:43",
        "tags": ["EDM", "Deep House", "Live DJ"],
        "stream_url": "rtmp://stream.globalvibez.com/live/stream2",
        "started_at": datetime.now(timezone.utc).isoformat()
    },
    "stream3": {
        "id": "stream3",
        "title": "Underground Craps Table - Come Roll!",
        "host": "LuckyDice",
        "host_id": "user_dice1",
        "host_avatar": "🎲",
        "viewers": 5621,
        "thumbnail": "🎲",
        "category": "gaming",
        "is_live": True,
        "duration": "0:42:18",
        "tags": ["Craps", "Live Game", "Interactive"],
        "stream_url": "rtmp://stream.globalvibez.com/live/stream3",
        "started_at": datetime.now(timezone.utc).isoformat()
    }
}

mock_stream_viewers = {}  # Track who's watching what

# API Endpoints

@router.get("/streaming/live-feeds")
async def get_live_feeds(category: Optional[str] = None, limit: int = 20) -> Dict[str, Any]:
    """Get all live streams, optionally filtered by category"""
    try:
        streams = list(mock_streams.values())
        
        # Filter by category if specified
        if category and category != "all":
            streams = [s for s in streams if s["category"] == category]
        
        # Sort by viewer count
        streams.sort(key=lambda x: x["viewers"], reverse=True)
        
        return {
            "streams": streams[:limit],
            "total": len(streams),
            "categories": {
                "all": len(mock_streams),
                "gaming": len([s for s in mock_streams.values() if s["category"] == "gaming"]),
                "music": len([s for s in mock_streams.values() if s["category"] == "music"]),
                "social": len([s for s in mock_streams.values() if s["category"] == "social"])
            }
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/streaming/stream/{stream_id}")
async def get_stream(stream_id: str) -> Dict[str, Any]:
    """Get details of a specific stream"""
    try:
        stream = mock_streams.get(stream_id)
        
        if not stream:
            raise HTTPException(status_code=404, detail="Stream not found")
        
        return stream
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/streaming/join-stream")
async def join_stream(request: JoinStreamRequest) -> Dict[str, Any]:
    """User joins a live stream"""
    try:
        stream = mock_streams.get(request.stream_id)
        
        if not stream:
            raise HTTPException(status_code=404, detail="Stream not found")
        
        if not stream["is_live"]:
            raise HTTPException(status_code=400, detail="Stream is not live")
        
        # Add user to viewers
        if request.stream_id not in mock_stream_viewers:
            mock_stream_viewers[request.stream_id] = set()
        
        mock_stream_viewers[request.stream_id].add(request.user_id)
        
        # Increment viewer count
        stream["viewers"] = len(mock_stream_viewers[request.stream_id])
        
        return {
            "status": "joined",
            "stream": stream,
            "message": f"Joined {stream['title']}"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/streaming/leave-stream")
async def leave_stream(request: JoinStreamRequest) -> Dict[str, Any]:
    """User leaves a live stream"""
    try:
        stream = mock_streams.get(request.stream_id)
        
        if not stream:
            raise HTTPException(status_code=404, detail="Stream not found")
        
        # Remove user from viewers
        if request.stream_id in mock_stream_viewers:
            mock_stream_viewers[request.stream_id].discard(request.user_id)
            stream["viewers"] = len(mock_stream_viewers[request.stream_id])
        
        return {
            "status": "left",
            "message": "Left stream"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/streaming/create-stream")
async def create_stream(request: CreateStreamRequest) -> Dict[str, Any]:
    """Create a new live stream"""
    try:
        stream_id = str(uuid4())
        
        stream_data = {
            "id": stream_id,
            "title": request.title,
            "host_id": request.user_id,
            "host": f"User_{request.user_id[:8]}",  # Mock host name
            "host_avatar": secure_random.choice(["🎮", "🎧", "🎲", "🎰", "🎵", "✨"]),
            "viewers": 0,
            "thumbnail": secure_random.choice(["🃏", "🎲", "🎰", "🎵", "🎮"]),
            "category": request.category,
            "is_live": True,
            "duration": "0:00:00",
            "tags": request.tags,
            "stream_url": f"rtmp://stream.globalvibez.com/live/{stream_id}",
            "started_at": datetime.now(timezone.utc).isoformat()
        }
        
        mock_streams[stream_id] = stream_data
        
        return {
            "status": "created",
            "stream": stream_data,
            "message": "Stream created successfully"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/streaming/end-stream/{stream_id}")
async def end_stream(stream_id: str, user_id: str) -> Dict[str, Any]:
    """End a live stream"""
    try:
        stream = mock_streams.get(stream_id)
        
        if not stream:
            raise HTTPException(status_code=404, detail="Stream not found")
        
        # Verify user is the host
        if stream["host_id"] != user_id:
            raise HTTPException(status_code=403, detail="Only the host can end the stream")
        
        # Mark stream as ended
        stream["is_live"] = False
        stream["ended_at"] = datetime.now(timezone.utc).isoformat()
        
        # Clear viewers
        if stream_id in mock_stream_viewers:
            del mock_stream_viewers[stream_id]
        
        return {
            "status": "ended",
            "message": "Stream ended successfully"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/streaming/trending")
async def get_trending_streams(limit: int = 10) -> Dict[str, Any]:
    """Get trending streams by viewer count"""
    try:
        streams = list(mock_streams.values())
        
        # Filter only live streams
        live_streams = [s for s in streams if s["is_live"]]
        
        # Sort by viewers
        live_streams.sort(key=lambda x: x["viewers"], reverse=True)
        
        return {
            "streams": live_streams[:limit],
            "total": len(live_streams)
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Pillar — "Peak Vibe" ad-hold + Experience Gifts
# ============================================================================
from collections import deque
from typing import Deque
import time as _time
from utils.database import get_database

# Per-stream chat velocity rolling window (timestamps of last 5 min of chat events).
_CHAT_VELOCITY: Dict[str, Deque[float]] = {}

# Catalog of purchasable experience gifts. Prices in ₵ (Vibez Coins).
GIFTS_CATALOG: Dict[str, Dict[str, Any]] = {
    "solar_flare": {
        "label": "Solar Flare",
        "price": 5000,
        "multiplier": 1.10,  # +10% mining for everyone in room
        "duration_sec": 300,
        "anim_asset": "glass_flare",
    },
    "nova_burst": {
        "label": "Nova Burst",
        "price": 15000,
        "multiplier": 1.25,
        "duration_sec": 600,
        "anim_asset": "nova_burst",
    },
    "whist_crown": {
        "label": "Whist Crown",
        "price": 50000,
        "multiplier": 1.50,
        "duration_sec": 900,
        "anim_asset": "whist_crown",
    },
}


class ChatEventPayload(BaseModel):
    stream_id: str


class GiftPayload(BaseModel):
    stream_id: str
    user_id: str
    gift_code: str  # key from GIFTS_CATALOG


def _bump_chat_velocity(stream_id: str) -> int:
    """Record a chat event; return msgs-per-minute over trailing 60s window."""
    now = _time.time()
    dq = _CHAT_VELOCITY.setdefault(stream_id, deque())
    dq.append(now)
    cutoff = now - 60.0
    while dq and dq[0] < cutoff:
        dq.popleft()
    return len(dq)


@router.post("/streaming/chat-event")
async def record_chat_event(payload: ChatEventPayload) -> Dict[str, Any]:
    """
    Called by the chat WS for every message sent in a room linked to a stream.
    If velocity > 50 msg/min, we set an ad-hold window so ads don't interrupt
    the peak moment.
    """
    msgs_per_min = _bump_chat_velocity(payload.stream_id)
    if msgs_per_min > 50:
        db = get_database()
        await db.streams.update_one(
            {"stream_id": payload.stream_id},
            {"$set": {
                "ad_hold_until": (datetime.now(timezone.utc).timestamp() + 300),
                "peak_vibe_detected_at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True,
        )
    return {"stream_id": payload.stream_id, "msgs_per_min": msgs_per_min, "peak_vibe": msgs_per_min > 50}


@router.get("/streaming/ad-status/{stream_id}")
async def ad_status(stream_id: str) -> Dict[str, Any]:
    db = get_database()
    doc = await db.streams.find_one({"stream_id": stream_id}, {"_id": 0}) or {}
    hold_until = doc.get("ad_hold_until", 0)
    now = datetime.now(timezone.utc).timestamp()
    return {
        "stream_id": stream_id,
        "ad_hold_active": hold_until > now,
        "ad_hold_until": hold_until,
        "seconds_remaining": max(0, int(hold_until - now)) if hold_until > now else 0,
    }


@router.get("/streaming/gifts/catalog")
async def gifts_catalog() -> Dict[str, Any]:
    return {"gifts": GIFTS_CATALOG}


@router.post("/streaming/gift")
async def send_gift(payload: GiftPayload) -> Dict[str, Any]:
    """
    Sender pays ₵, room receives a time-limited mining multiplier, and every
    client subscribed to the room's socket gets a 3D animation trigger.
    """
    gift = GIFTS_CATALOG.get(payload.gift_code)
    if not gift:
        raise HTTPException(status_code=400, detail="Unknown gift")

    db = get_database()

    # 1. Charge sender
    user = await db.users.find_one({"user_id": payload.user_id}, {"balance_coins": 1, "_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if (user.get("balance_coins") or 0) < gift["price"]:
        raise HTTPException(status_code=402, detail=f"Need ₵{gift['price']:,} to send {gift['label']}")
    await db.users.update_one(
        {"user_id": payload.user_id},
        {"$inc": {"balance_coins": -gift["price"]}},
    )

    # 2. Apply room multiplier (stored on the stream doc for mining_engine to pick up)
    expires_at = datetime.now(timezone.utc).timestamp() + gift["duration_sec"]
    await db.streams.update_one(
        {"stream_id": payload.stream_id},
        {"$set": {
            "active_multiplier": gift["multiplier"],
            "multiplier_expires_at": expires_at,
            "multiplier_source": payload.gift_code,
        }},
        upsert=True,
    )

    # 3. Log ledger event
    await db.stream_gift_log.insert_one({
        "stream_id": payload.stream_id,
        "sender_id": payload.user_id,
        "gift_code": payload.gift_code,
        "price_paid": gift["price"],
        "multiplier": gift["multiplier"],
        "duration_sec": gift["duration_sec"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    # 4. The animation broadcast is handled by the streaming socket layer
    # (clients subscribe to /ws/stream/{id}). For now we return the intent;
    # frontend listens for stream-state updates and fires the animation.
    return {
        "ok": True,
        "stream_id": payload.stream_id,
        "gift": gift["label"],
        "anim_asset": gift["anim_asset"],
        "multiplier": gift["multiplier"],
        "expires_in_sec": gift["duration_sec"],
    }


@router.get("/streaming/active-multiplier/{stream_id}")
async def active_multiplier(stream_id: str) -> Dict[str, Any]:
    """Used by mining_engine to apply room-wide gift multipliers."""
    db = get_database()
    doc = await db.streams.find_one({"stream_id": stream_id}, {"_id": 0}) or {}
    now = datetime.now(timezone.utc).timestamp()
    expires = doc.get("multiplier_expires_at", 0)
    if expires > now:
        return {"multiplier": doc.get("active_multiplier", 1.0), "source": doc.get("multiplier_source")}
    return {"multiplier": 1.0, "source": None}

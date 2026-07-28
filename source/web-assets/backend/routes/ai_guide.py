"""
AI Guide — contextual room hints for the floating AI Navigator.

POST /api/ai/guide-hint
  Body: { room: str, path?: str }
  Returns: { hint: str, room: str, source: "catalog" | "default" }

Static catalog first (fast, offline-safe). Optional Gemini enrichment
is intentionally NOT required — guidance must work without LLM budget.
"""
from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/ai", tags=["AI Guidance"])

# Room-key → hint. Keys are normalized category ids resolved from path.
HINTS: Dict[str, str] = {
    "gaming": (
        "You're in a gaming room. Pick a table or stake, buy in with ₵ Vibez Coins, "
        "and jump into a single-viewport session. Use Quick Access (⋯) for voice, "
        "comms, and room tools."
    ),
    "streaming": (
        "Welcome to live streaming. Tap any active broadcast to watch, drop reactions, "
        "or open the creator's profile. Co-Watch lets you pull friends into the same stream."
    ),
    "dating": (
        "Explore connections here. Browse profiles, start an icebreaker chat, or join a "
        "Just-for-the-Night lounge. Voice Mirror translates if you need it."
    ),
    "rides": (
        "Vibe Ridez is your in-app lift. Request a ride, track your driver live, and chat "
        "in Ride Chat. Keep your wallet funded for fare."
    ),
    "food": (
        "HungryVibes / Vibez Spots — order without leaving your game. Use the food menu "
        "from Quick Access so you never pause the table."
    ),
    "hub": (
        "This is your hub. Tap any tile to teleport into games, dating, rides, food, or "
        "streaming. Your wallet pill shows ₵ balance; mining streak grows with daily logins."
    ),
    "sports": (
        "Vibe Sports Book — pick a stake, lock odds, and wait for the crowd Vibe Check "
        "before payouts. Bet of the Day pins the hottest vaulted bet."
    ),
    "underground": (
        "The Underground is high-limit. Confirm the floor, then pick a private table. "
        "Royal / Sovereign tiers may skip the minimum."
    ),
    "default": (
        "Take your time exploring! Jump between rooms with the main navigation or "
        "Quick Access (⋯). Tap the room info cube (i) anytime for a deeper walkthrough."
    ),
}

# Longest-prefix wins — keep ordered by specificity when matching.
PATH_RULES: tuple[tuple[str, str], ...] = (
    ("/underground", "underground"),
    ("/sports-lounge", "sports"),
    ("/dashboard", "hub"),
    ("/dashboard-volumetric", "hub"),
    ("/hungryvibes", "food"),
    ("/hungry-vibes", "food"),
    ("/restaurants", "food"),
    ("/vibe-ridez", "rides"),
    ("/vibe-drive", "rides"),
    ("/dating", "dating"),
    ("/matches", "dating"),
    ("/just-for-the-night", "dating"),
    ("/jftn", "dating"),
    ("/streaming", "streaming"),
    ("/streamer", "streaming"),
    ("/dsg-tv", "streaming"),
    ("/vibe-tv", "streaming"),
    ("/cinema", "streaming"),
    ("/cinema-room", "streaming"),
    ("/games", "gaming"),
    ("/practice", "gaming"),
    ("/spades", "gaming"),
    ("/bid-whist", "gaming"),
    ("/casino", "gaming"),
    ("/chess", "gaming"),
    ("/vibez-654", "gaming"),
    ("/three-card", "gaming"),
)


def resolve_room_key(room: str, path: Optional[str] = None) -> str:
    raw = (room or "").strip().lower()
    if raw in HINTS:
        return raw

    candidate = (path or room or "").strip().lower()
    if not candidate:
        return "default"

    # Allow bare category aliases from the client.
    aliases = {
        "game": "gaming",
        "games": "gaming",
        "casino": "gaming",
        "stream": "streaming",
        "live": "streaming",
        "date": "dating",
        "social": "dating",
        "ride": "rides",
        "ridez": "rides",
        "food": "food",
        "hungry": "food",
        "home": "hub",
        "lobby": "hub",
    }
    if raw in aliases:
        return aliases[raw]

    path_only = candidate.split("?", 1)[0]
    if not path_only.startswith("/"):
        path_only = f"/{path_only}"

    rules = sorted(PATH_RULES, key=lambda r: len(r[0]), reverse=True)
    for prefix, key in rules:
        if path_only == prefix or path_only.startswith(prefix + "/"):
            return key
    return "default"


class RoomContext(BaseModel):
    room: str = Field(..., description="Category id or path segment")
    path: Optional[str] = Field(None, description="Optional full pathname for finer matching")


@router.post("/guide-hint")
async def get_guide_hint(context: RoomContext) -> Dict[str, Any]:
    key = resolve_room_key(context.room, context.path)
    hint = HINTS.get(key, HINTS["default"])
    return {
        "hint": hint,
        "room": key,
        "source": "catalog" if key in HINTS else "default",
    }

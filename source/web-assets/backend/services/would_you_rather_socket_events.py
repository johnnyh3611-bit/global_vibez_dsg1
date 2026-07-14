"""
Would You Rather — Socket.IO room init.

Clients emit `wyr_init_room` (solo or with room_code) and immediately receive
`wyr_room_ready` with the first question — no wait for a separate HTTP round-trip
before the room UI can render.
"""
from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from data.new_games_data import WOULD_YOU_RATHER_QUESTIONS

# room_code -> room state
_wyr_rooms: Dict[str, Dict[str, Any]] = {}
# sid -> room_code
_wyr_sid_room: Dict[str, str] = {}


def _pick_question(exclude: Optional[set] = None) -> Dict[str, Any]:
    exclude = exclude or set()
    pool = [q for q in WOULD_YOU_RATHER_QUESTIONS if q["id"] not in exclude]
    if not pool:
        pool = list(WOULD_YOU_RATHER_QUESTIONS)
    return secrets.choice(pool)


def register_would_you_rather_events(sio) -> None:
    """Register WYR socket handlers on the shared AsyncServer."""

    @sio.on("wyr_init_room")
    async def wyr_init_room(sid, data):
        """
        Create or join a WYR room and emit `wyr_room_ready` immediately.

        Payload: { user_id?, username?, room_code? }
        """
        data = data or {}
        user_id = data.get("user_id") or f"anon_{sid[:8]}"
        username = data.get("username") or "Player"
        room_code = (data.get("room_code") or "").strip().upper() or None

        if room_code and room_code in _wyr_rooms:
            room = _wyr_rooms[room_code]
            room["players"][sid] = {
                "user_id": user_id,
                "username": username,
                "joined_at": datetime.now(timezone.utc).isoformat(),
            }
        else:
            room_code = room_code or f"WYR-{uuid.uuid4().hex[:6].upper()}"
            question = _pick_question()
            room = {
                "room_code": room_code,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "host_sid": sid,
                "players": {
                    sid: {
                        "user_id": user_id,
                        "username": username,
                        "joined_at": datetime.now(timezone.utc).isoformat(),
                    }
                },
                "current_question": question,
                "asked_ids": [question["id"]],
                "votes": {},  # sid -> 'a'|'b'
            }
            _wyr_rooms[room_code] = room

        _wyr_sid_room[sid] = room_code
        await sio.enter_room(sid, f"wyr:{room_code}")

        payload = {
            "room_code": room_code,
            "question": room["current_question"],
            "players": [
                {"user_id": p["user_id"], "username": p["username"]}
                for p in room["players"].values()
            ],
            "game_type": "would_you_rather",
        }
        # Immediate room init for the joining client
        await sio.emit("wyr_room_ready", payload, to=sid)
        # Notify others in the room
        await sio.emit(
            "wyr_player_joined",
            {
                "room_code": room_code,
                "player": {"user_id": user_id, "username": username},
                "players": payload["players"],
            },
            room=f"wyr:{room_code}",
            skip_sid=sid,
        )
        return {"success": True, **payload}

    @sio.on("wyr_next_question")
    async def wyr_next_question(sid, data):
        """Advance room to a new question; broadcast `wyr_room_ready`."""
        room_code = _wyr_sid_room.get(sid)
        if not room_code or room_code not in _wyr_rooms:
            await sio.emit(
                "wyr_error",
                {"message": "Not in a WYR room — call wyr_init_room first"},
                to=sid,
            )
            return {"success": False}
        room = _wyr_rooms[room_code]
        question = _pick_question(set(room.get("asked_ids") or []))
        room["current_question"] = question
        room["asked_ids"] = (room.get("asked_ids") or []) + [question["id"]]
        room["votes"] = {}
        payload = {
            "room_code": room_code,
            "question": question,
            "players": [
                {"user_id": p["user_id"], "username": p["username"]}
                for p in room["players"].values()
            ],
            "game_type": "would_you_rather",
        }
        await sio.emit("wyr_room_ready", payload, room=f"wyr:{room_code}")
        return {"success": True, **payload}

    @sio.on("wyr_cast_vote")
    async def wyr_cast_vote(sid, data):
        """Record a live vote in the room (choice: a|b)."""
        data = data or {}
        choice = (data.get("choice") or "").lower()
        if choice not in ("a", "b"):
            await sio.emit("wyr_error", {"message": "choice must be a or b"}, to=sid)
            return {"success": False}
        room_code = _wyr_sid_room.get(sid)
        if not room_code or room_code not in _wyr_rooms:
            await sio.emit("wyr_error", {"message": "Not in a WYR room"}, to=sid)
            return {"success": False}
        room = _wyr_rooms[room_code]
        room["votes"][sid] = choice
        tallies = {"a": 0, "b": 0}
        for c in room["votes"].values():
            tallies[c] = tallies.get(c, 0) + 1
        await sio.emit(
            "wyr_vote_update",
            {
                "room_code": room_code,
                "question_id": room["current_question"]["id"],
                "tallies": tallies,
                "votes_cast": len(room["votes"]),
                "players": len(room["players"]),
            },
            room=f"wyr:{room_code}",
        )
        return {"success": True, "tallies": tallies}

    @sio.on("wyr_leave_room")
    async def wyr_leave_room(sid, data=None):
        room_code = _wyr_sid_room.pop(sid, None)
        if not room_code or room_code not in _wyr_rooms:
            return {"success": True}
        room = _wyr_rooms[room_code]
        room["players"].pop(sid, None)
        room["votes"].pop(sid, None)
        await sio.leave_room(sid, f"wyr:{room_code}")
        if not room["players"]:
            _wyr_rooms.pop(room_code, None)
        else:
            await sio.emit(
                "wyr_player_left",
                {"room_code": room_code, "sid": sid},
                room=f"wyr:{room_code}",
            )
        return {"success": True}

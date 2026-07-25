"""Socket.IO presence + sync for Date Night shared sessions."""
from __future__ import annotations

import logging
from typing import Any, Dict

logger = logging.getLogger(__name__)


def register_date_night_events(sio) -> None:
    @sio.event
    async def date_night_join(sid: str, data: Dict[str, Any]):
        session_id = (data or {}).get("session_id")
        user_id = (data or {}).get("user_id")
        if not session_id:
            await sio.emit("date_night_error", {"message": "session_id required"}, room=sid)
            return
        room = f"date_night:{session_id}"
        await sio.enter_room(sid, room)
        await sio.save_session(sid, {"date_night_room": room, "user_id": user_id})
        await sio.emit(
            "date_night_presence",
            {"session_id": session_id, "user_id": user_id, "event": "joined"},
            room=room,
        )

    @sio.event
    async def date_night_leave(sid: str, data: Dict[str, Any]):
        session_id = (data or {}).get("session_id")
        if not session_id:
            return
        room = f"date_night:{session_id}"
        await sio.leave_room(sid, room)
        await sio.emit(
            "date_night_presence",
            {
                "session_id": session_id,
                "user_id": (data or {}).get("user_id"),
                "event": "left",
            },
            room=room,
        )

    @sio.event
    async def date_night_ping(sid: str, data: Dict[str, Any]):
        session_id = (data or {}).get("session_id")
        if not session_id:
            return
        await sio.emit(
            "date_night_pong",
            {"session_id": session_id, "ts": (data or {}).get("ts")},
            room=sid,
        )

    logger.info("Date Night Socket.IO events registered")

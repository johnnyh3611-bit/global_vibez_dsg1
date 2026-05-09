"""
Sound-Check Gauntlet — real-time leaderboard websocket.
─────────────────────────────────────────────────────────────────────
Music Arena Blueprint §1: every Vibe / No-Vibe vote bumps a track's
hype score on the server. The frontend Sound-Check Gauntlet shows a
live ranking of the top tracks. Polling every second is wasteful, so
we hook into the existing Socket.IO server (`services.multiplayer.sio`)
and:

  1. Clients join the `sound_check_leaderboard` room on mount.
  2. Every time the totem_pole `/sound-check/vote` endpoint persists
     a vote, we call `broadcast_leaderboard()` from this module which
     reads the top-10 tracks and `sio.emit('sound_check_leaderboard',
     {...}, room=...)`.
  3. The Sound-Check Gauntlet page subscribes to the event and updates
     its leaderboard widget without polling.

Idempotent: importing the module wires the `join`/`leave` handlers
once. Calling `broadcast_leaderboard()` is safe from any worker.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

LEADERBOARD_ROOM = "sound_check_leaderboard"


def _register_handlers() -> None:
    """Wire the join/leave handlers ONCE. Re-imports are idempotent."""
    try:
        from services.multiplayer import sio  # noqa: PLC0415
    except Exception as e:
        logger.warning(f"sound-check leaderboard: socket.io unavailable ({e})")
        return

    if getattr(_register_handlers, "_done", False):
        return

    @sio.on("sound_check_join")
    async def _on_join(sid: str, data: Dict[str, Any] = None):  # noqa: ARG001
        await sio.enter_room(sid, LEADERBOARD_ROOM)
        # Push the current snapshot immediately so the UI doesn't
        # show an empty board until the next vote.
        snap = await _read_top(limit=10)
        await sio.emit(
            "sound_check_leaderboard",
            {"top": snap, "kind": "snapshot"},
            room=sid,
        )

    @sio.on("sound_check_leave")
    async def _on_leave(sid: str, data: Dict[str, Any] = None):  # noqa: ARG001
        await sio.leave_room(sid, LEADERBOARD_ROOM)

    _register_handlers._done = True  # type: ignore[attr-defined]
    logger.info("sound-check leaderboard handlers registered")


async def _read_top(limit: int = 10) -> List[Dict[str, Any]]:
    """Return the current top-N tracks by `hype_score`."""
    from utils.database import get_database  # noqa: PLC0415
    db = get_database()
    cur = (
        db.sound_check_tracks
        .find({}, {"_id": 0, "track_id": 1, "hype_score": 1, "vote_count": 1})
        .sort("hype_score", -1)
        .limit(max(1, min(limit, 50)))
    )
    return [doc async for doc in cur]


async def broadcast_leaderboard(triggering_track_id: str | None = None) -> None:
    """Push the current top-10 to everyone subscribed to the leaderboard
    room. Called from `routes/totem_pole.py::sound_check_vote` after
    persisting a vote.

    The optional `triggering_track_id` lets the frontend animate the
    specific row that just changed (instead of re-shuffling the whole
    board).
    """
    try:
        from services.multiplayer import sio  # noqa: PLC0415
        top = await _read_top(limit=10)
        await sio.emit(
            "sound_check_leaderboard",
            {"top": top, "kind": "delta", "triggered_by": triggering_track_id},
            room=LEADERBOARD_ROOM,
        )
    except Exception as e:
        logger.debug(f"sound-check leaderboard broadcast skipped: {e}")


# Module import wires the handlers automatically.
_register_handlers()

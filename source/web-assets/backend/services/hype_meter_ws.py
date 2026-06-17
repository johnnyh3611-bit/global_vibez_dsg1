"""
Streamer Hype Meter — real-time WebSocket broadcaster.
─────────────────────────────────────────────────────────────────────
Same pattern as `services/sound_check_leaderboard.py`. The Streamer
Overlay used to poll `/api/streamer-actions/hype-meter/{id}` every
3 seconds. We hook the existing `services.multiplayer.sio` server
and broadcast meter updates from the tip endpoint instead, so the
overlay reacts in <100ms instead of 3s.
"""
from __future__ import annotations

import logging
from typing import Any, Dict

logger = logging.getLogger(__name__)

# Each streamer gets their own room (`hype:streamer_id`) so an overlay
# only receives ticks for the channel it cares about.
ROOM_PREFIX = "hype:"


def _register_handlers() -> None:
    try:
        from services.multiplayer import sio  # noqa: PLC0415
    except Exception as e:
        logger.warning(f"hype-meter ws: socket.io unavailable ({e})")
        return

    if getattr(_register_handlers, "_done", False):
        return

    @sio.on("hype_meter_join")
    async def _on_join(sid: str, data: Dict[str, Any] | None = None):
        streamer_id = (data or {}).get("streamer_id", "demo")
        room = f"{ROOM_PREFIX}{streamer_id}"
        await sio.enter_room(sid, room)
        # Push the current snapshot immediately
        snap = await _read_meter(streamer_id)
        await sio.emit("hype_meter", snap, room=sid)

    @sio.on("hype_meter_leave")
    async def _on_leave(sid: str, data: Dict[str, Any] | None = None):
        streamer_id = (data or {}).get("streamer_id", "demo")
        await sio.leave_room(sid, f"{ROOM_PREFIX}{streamer_id}")

    _register_handlers._done = True  # type: ignore[attr-defined]
    logger.info("hype-meter ws handlers registered")


async def _read_meter(streamer_id: str) -> Dict[str, Any]:
    from utils.database import get_database  # noqa: PLC0415
    db = get_database()
    rec = await db.streamer_hype_meter.find_one(
        {"streamer_id": streamer_id}, {"_id": 0},
    )
    cumulative = (rec or {}).get("cumulative_cents", 0)
    PEAK = 1000
    return {
        "streamer_id":      streamer_id,
        "cumulative_cents": cumulative,
        "peak_threshold":   PEAK,
        "fill_pct":         min(1.0, cumulative / float(PEAK)),
        "peak_reached":     cumulative >= PEAK,
    }


async def broadcast_hype(streamer_id: str, last_action_kind: str | None = None) -> None:
    """Called from `routes/streamer_actions.py::post_tip` after the
    tip persists. Best-effort — never bubbles exceptions up."""
    try:
        from services.multiplayer import sio  # noqa: PLC0415
        snap = await _read_meter(streamer_id)
        snap["last_action_kind"] = last_action_kind
        await sio.emit("hype_meter", snap,
                       room=f"{ROOM_PREFIX}{streamer_id}")
    except Exception as e:
        logger.debug(f"hype-meter broadcast skipped: {e}")


_register_handlers()

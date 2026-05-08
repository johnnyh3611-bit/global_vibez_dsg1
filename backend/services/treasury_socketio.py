"""
Treasury Socket.IO room — clients subscribe to live solvency updates.

The actual broadcast is fired every 60s by lifespan._start_solvency_broadcaster.
Here we only declare the join/leave handlers so clients can subscribe.

NOTE: handlers MUST register on the SAME ``sio`` instance that is mounted
under ``/api/socket.io`` (services.multiplayer.sio). The legacy
``websocket_server.sio`` is mounted under ``/socket.io`` only and never
reached by the K8s ingress, so handlers there would silently never fire.
"""
from __future__ import annotations

from typing import Any, Dict

from services.multiplayer import sio


@sio.event
async def join_treasury_room(sid: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Client opts in to live ``solvency_update`` broadcasts."""
    await sio.enter_room(sid, "treasury")
    return {"status": "joined", "room": "treasury"}


@sio.event
async def leave_treasury_room(sid: str, data: Dict[str, Any]) -> Dict[str, Any]:
    await sio.leave_room(sid, "treasury")
    return {"status": "left", "room": "treasury"}


print("✅ Treasury Socket.IO events loaded")

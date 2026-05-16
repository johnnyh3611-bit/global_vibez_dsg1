"""
Free TV Networks Cinema Room — synchronized FAST/AVOD viewing.

Implements the "Core Cinema Room Interaction Blueprint" PDF the founder
shared on 2026-05-16: a multi-network watch-party surface for the four
free streaming networks (Pluto TV, Tubi TV, Plex TV, YouTube) with
frame-accurate WebSocket sync, QR-code ambassador attribution, and a
hybrid embed strategy (iframe-where-allowed → external-launch fallback).

Distinct from `routes.cinema_room` (curated public-domain titles) and
`dsg/MemoryBankCinemaRoom` (founder Memory Bank). This route is the
"Free Networks Floor" — paid no content licensing because each network
keeps its own ad layer rendered.

Endpoints under `/api/cinema-network-room`:
  GET  /networks                       — 4-network catalog + channel grid
  GET  /networks/{network_id}          — single network detail
  GET  /rooms                          — open public watch-party rooms
  POST /rooms                          — create a watch-party
  GET  /rooms/{room_id}                — room state + attribution log
  POST /rooms/{room_id}/track-ref      — log a `?ref=` ambassador hit
  WS   /ws/{room_id}                   — frame-accurate playback sync

WebSocket payload (matches PDF schema verbatim):
  {
    "room_id": "DSG_CINEMA_ALPHA_01",
    "timestamp_utc": 1778889600,
    "action": "NETWORK_SOURCE_MUTATION",
    "payload": {
      "active_network": "PLUTO_TV",
      "channel_id": "pluto-action-movies-05",
      "playback_state": "SYNCHRONIZED_RUNNING",
      "current_time_marker": 1402.85
    },
    "originating_agent_uuid": "AMBASSADOR_HOST_9981"
  }
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cinema-network-room", tags=["cinema-network-room"])


def _db():
    return AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


# ────────────────────────────────────────────── Network catalog ──
# Each network's `embed_mode` drives the frontend's hybrid strategy:
#   "iframe"   — render in a sandboxed iframe on our page (YouTube ok)
#   "external" — open in a new tab (Tubi/Plex CSPs block framing)
#   "hybrid"   — try iframe; auto-fallback to external-launch if blocked
#
# `attribution_param` is the network's own ref/attribution query param so
# we can stitch our ambassador `?ref=` into their share URLs.
NETWORKS: List[Dict[str, Any]] = [
    {
        "network_id": "PLUTO_TV",
        "label": "Pluto TV",
        "kind": "FAST",  # Free Ad-Supported Streaming TV
        "description": "Live channels with EPG, 24/7 grid.",
        "logo_url": "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=200",
        "brand_color": "#FFE000",
        "embed_mode": "hybrid",
        "embed_base": "https://pluto.tv/en/live-tv/",
        "external_base": "https://pluto.tv/en/live-tv",
        "epg_supported": True,
        "channels": [
            {"channel_id": "pluto-action-movies-05", "name": "Pluto Action", "genre": "Movies", "live": True},
            {"channel_id": "pluto-classic-tv-12", "name": "Classic TV", "genre": "Classic", "live": True},
            {"channel_id": "pluto-crime-32", "name": "Crime 24/7", "genre": "Crime", "live": True},
            {"channel_id": "pluto-comedy-49", "name": "Comedy Central Pluto", "genre": "Comedy", "live": True},
            {"channel_id": "pluto-news-21", "name": "Pluto News", "genre": "News", "live": True},
            {"channel_id": "pluto-anime-67", "name": "Anime All Day", "genre": "Anime", "live": True},
        ],
    },
    {
        "network_id": "TUBI_TV",
        "label": "Tubi",
        "kind": "AVOD",
        "description": "Ad-supported on-demand movies + series.",
        "logo_url": "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=200",
        "brand_color": "#FA382F",
        "embed_mode": "external",
        "embed_base": "https://tubitv.com/",
        "external_base": "https://tubitv.com",
        "epg_supported": False,
        "channels": [
            {"channel_id": "tubi-cat-action", "name": "Action", "genre": "Movies", "live": False},
            {"channel_id": "tubi-cat-horror", "name": "Horror", "genre": "Movies", "live": False},
            {"channel_id": "tubi-cat-comedy", "name": "Comedy", "genre": "Movies", "live": False},
            {"channel_id": "tubi-cat-anime", "name": "Anime", "genre": "Series", "live": False},
            {"channel_id": "tubi-cat-kids", "name": "Kids", "genre": "Family", "live": False},
        ],
    },
    {
        "network_id": "PLEX_TV",
        "label": "Plex",
        "kind": "FAST+AVOD",
        "description": "Live curated networks + movies, ad-supported.",
        "logo_url": "https://images.unsplash.com/photo-1500468756762-a401b6f17b46?w=200",
        "brand_color": "#E5A00D",
        "embed_mode": "external",
        "embed_base": "https://watch.plex.tv/",
        "external_base": "https://watch.plex.tv",
        "epg_supported": True,
        "channels": [
            {"channel_id": "plex-live-action", "name": "Plex Live Action", "genre": "Movies", "live": True},
            {"channel_id": "plex-true-crime", "name": "True Crime", "genre": "Crime", "live": True},
            {"channel_id": "plex-classic-cinema", "name": "Classic Cinema", "genre": "Classic", "live": True},
            {"channel_id": "plex-news", "name": "Plex News", "genre": "News", "live": True},
        ],
    },
    {
        "network_id": "YOUTUBE",
        "label": "YouTube",
        "kind": "UGC",
        "description": "Embedded YouTube — iframe API v3, fully sync-able.",
        "logo_url": "https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=200",
        "brand_color": "#FF0000",
        "embed_mode": "iframe",
        "embed_base": "https://www.youtube.com/embed/",
        "external_base": "https://www.youtube.com/watch?v=",
        "epg_supported": False,
        "channels": [
            {"channel_id": "dQw4w9WgXcQ", "name": "Never Gonna Give You Up", "genre": "Music", "live": False},
            {"channel_id": "jfKfPfyJRdk", "name": "lofi hip hop radio", "genre": "Music", "live": True},
            {"channel_id": "5qap5aO4i9A", "name": "lofi girl — beats to study", "genre": "Music", "live": True},
            {"channel_id": "21X5lGlDOfg", "name": "NASA Live Stream", "genre": "Science", "live": True},
        ],
    },
]

# Fast index for O(1) network lookups.
_NETWORK_BY_ID = {n["network_id"]: n for n in NETWORKS}


def _network_or_404(network_id: str) -> Dict[str, Any]:
    nid = (network_id or "").upper()
    n = _NETWORK_BY_ID.get(nid)
    if not n:
        raise HTTPException(404, f"Unknown network '{network_id}'")
    return n


# ────────────────────────────────────────────── Models ──
class CreateRoomBody(BaseModel):
    host_user_id: str
    name: str = Field(min_length=2, max_length=120)
    active_network: Optional[str] = None   # default: PLUTO_TV
    channel_id: Optional[str] = None
    is_private: bool = False
    ambassador_ref: Optional[str] = None   # carries through `?ref=`


class TrackRefBody(BaseModel):
    ambassador_ref: str = Field(min_length=2, max_length=64)
    viewer_user_id: Optional[str] = None


# ────────────────────────────────────────────── REST endpoints ──
@router.get("/networks")
async def list_networks() -> Dict[str, Any]:
    """Public network grid + channel list, used to render the room shell."""
    return {"count": len(NETWORKS), "networks": NETWORKS}


@router.get("/networks/{network_id}")
async def get_network(network_id: str) -> Dict[str, Any]:
    """Single network detail — frontend uses this to refresh channel
    grids if the founder updates the catalog without redeploying UI."""
    return _network_or_404(network_id)


@router.get("/rooms")
async def list_rooms() -> Dict[str, Any]:
    """Public list of joinable rooms. Private rooms hidden."""
    rows: List[Dict[str, Any]] = []
    async for doc in (
        _db().cinema_network_rooms.find({"is_private": False}, {"_id": 0})
        .sort("created_at", -1).limit(50)
    ):
        rows.append(doc)
    return {"count": len(rows), "rows": rows}


@router.post("/rooms")
async def create_room(body: CreateRoomBody) -> Dict[str, Any]:
    """Spin up a watch-party room. `active_network` defaults to PLUTO_TV,
    `channel_id` defaults to that network's first channel — so the
    creator can land in a synced state with zero clicks."""
    network = _network_or_404(body.active_network or "PLUTO_TV")
    channel_id = body.channel_id
    if not channel_id:
        channel_id = network["channels"][0]["channel_id"]
    else:
        valid = {c["channel_id"] for c in network["channels"]}
        if channel_id not in valid:
            raise HTTPException(400, f"channel_id '{channel_id}' not in network {network['network_id']}")

    room = {
        "room_id": f"DSG_CINEMA_{uuid.uuid4().hex[:10].upper()}",
        "host_user_id": body.host_user_id,
        "name": body.name.strip(),
        "active_network": network["network_id"],
        "channel_id": channel_id,
        "is_private": body.is_private,
        "audience_count": 0,
        "created_at": time.time(),
        "created_at_iso": datetime.now(timezone.utc).isoformat(),
        "last_state": {
            "playback_state": "SYNCHRONIZED_RUNNING",
            "current_time_marker": 0.0,
            "ts": time.time(),
        },
        "ambassador_ref": (body.ambassador_ref or "").strip()[:64] or None,
        "ref_hits": 0,
    }
    await _db().cinema_network_rooms.insert_one(room.copy())
    room.pop("_id", None)
    return room


@router.get("/rooms/{room_id}")
async def get_room(room_id: str) -> Dict[str, Any]:
    doc = await _db().cinema_network_rooms.find_one({"room_id": room_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "room_not_found")
    return doc


@router.post("/rooms/{room_id}/track-ref")
async def track_referral_hit(room_id: str, body: TrackRefBody) -> Dict[str, Any]:
    """Log an ambassador `?ref=` hit for attribution. Idempotent per
    (room, viewer) — repeat hits don't double-count. If `viewer_user_id`
    is omitted (anonymous), each request increments (rate-limited by ip
    upstream at the proxy layer)."""
    room = await _db().cinema_network_rooms.find_one({"room_id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(404, "room_not_found")

    log_key = {
        "room_id": room_id,
        "ambassador_ref": body.ambassador_ref.strip()[:64],
        "viewer_user_id": (body.viewer_user_id or "").strip()[:64] or "anon",
    }
    seen = await _db().cinema_network_ref_log.find_one(log_key, {"_id": 0})
    if seen and log_key["viewer_user_id"] != "anon":
        return {"credited": False, "reason": "already_logged"}

    now_iso = datetime.now(timezone.utc).isoformat()
    await _db().cinema_network_ref_log.insert_one({
        **log_key,
        "id": str(uuid.uuid4()),
        "logged_at": now_iso,
    })
    await _db().cinema_network_rooms.update_one(
        {"room_id": room_id}, {"$inc": {"ref_hits": 1}}
    )
    return {"credited": True, "ambassador_ref": log_key["ambassador_ref"]}


# ────────────────────────────────────────────── WebSocket sync ──
class NetworkRoomManager:
    """Tracks active WebSocket connections per network-room. In-memory
    state is fine because Mongo holds the durable `last_state` and any
    late-joiner re-syncs via the `SNAPSHOT_DELIVERY` message on connect."""

    def __init__(self) -> None:
        self.active: Dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket, room_id: str) -> None:
        await ws.accept()
        async with self._lock:
            self.active.setdefault(room_id, set()).add(ws)
        await self._refresh_audience(room_id)

    async def disconnect(self, ws: WebSocket, room_id: str) -> None:
        async with self._lock:
            conns = self.active.get(room_id)
            if conns and ws in conns:
                conns.discard(ws)
            if conns is not None and not conns:
                self.active.pop(room_id, None)
        await self._refresh_audience(room_id)

    async def broadcast(self, message: Dict[str, Any], room_id: str) -> None:
        async with self._lock:
            conns = list(self.active.get(room_id, set()))
        for ws in conns:
            try:
                await ws.send_json(message)
            except Exception:
                # Best-effort — single bad socket cannot stall the room.
                pass

    async def _refresh_audience(self, room_id: str) -> None:
        async with self._lock:
            count = len(self.active.get(room_id, set()))
        await _db().cinema_network_rooms.update_one(
            {"room_id": room_id}, {"$set": {"audience_count": count}}
        )
        await self.broadcast(
            {"action": "AUDIENCE_UPDATE", "payload": {"count": count}},
            room_id,
        )


_MANAGER = NetworkRoomManager()


def _pdf_envelope(
    *, room_id: str, action: str, payload: Dict[str, Any], agent: str
) -> Dict[str, Any]:
    """Wrap a message in the exact schema from the PDF blueprint."""
    return {
        "room_id": room_id,
        "timestamp_utc": int(time.time()),
        "action": action,
        "payload": payload,
        "originating_agent_uuid": agent,
    }


@router.websocket("/ws/{room_id}")
async def cinema_network_ws(ws: WebSocket, room_id: str) -> None:
    """Frame-sync WebSocket. Accepted actions (all PDF-spec verbatim):
      - NETWORK_SOURCE_MUTATION  (host swaps network + channel)
      - PLAYBACK_STATE_CHANGE    (play / pause)
      - SCRUB_TO_MARKER          (seek)
      - CHAT_MESSAGE
      - PING
    """
    room = await _db().cinema_network_rooms.find_one({"room_id": room_id}, {"_id": 0})
    if not room:
        await ws.close(code=4404)
        return

    await _MANAGER.connect(ws, room_id)
    try:
        # Snapshot delivery on connect — clients can catch up without
        # waiting for the next host action.
        await ws.send_json(_pdf_envelope(
            room_id=room_id,
            action="SNAPSHOT_DELIVERY",
            payload={
                "active_network": room.get("active_network"),
                "channel_id": room.get("channel_id"),
                "playback_state": room.get("last_state", {}).get("playback_state", "SYNCHRONIZED_RUNNING"),
                "current_time_marker": room.get("last_state", {}).get("current_time_marker", 0.0),
            },
            agent="SERVER",
        ))

        while True:
            msg = await ws.receive_json()
            action = (msg.get("action") or "").upper()
            payload = msg.get("payload") or {}
            agent = (msg.get("originating_agent_uuid") or "anon")[:64]

            if action == "NETWORK_SOURCE_MUTATION":
                active_network = (payload.get("active_network") or "").upper()
                channel_id = payload.get("channel_id")
                net = _NETWORK_BY_ID.get(active_network)
                if not net or channel_id not in {c["channel_id"] for c in net["channels"]}:
                    continue  # ignore malformed switches
                await _db().cinema_network_rooms.update_one(
                    {"room_id": room_id},
                    {"$set": {
                        "active_network": active_network,
                        "channel_id": channel_id,
                        "last_state": {
                            "playback_state": "SYNCHRONIZED_RUNNING",
                            "current_time_marker": 0.0,
                            "ts": time.time(),
                        },
                    }},
                )
                await _MANAGER.broadcast(
                    _pdf_envelope(
                        room_id=room_id,
                        action="NETWORK_SOURCE_MUTATION",
                        payload={
                            "active_network": active_network,
                            "channel_id": channel_id,
                            "playback_state": "SYNCHRONIZED_RUNNING",
                            "current_time_marker": 0.0,
                        },
                        agent=agent,
                    ),
                    room_id,
                )

            elif action in ("PLAYBACK_STATE_CHANGE", "SCRUB_TO_MARKER"):
                playback_state = payload.get("playback_state") or "SYNCHRONIZED_RUNNING"
                marker = float(payload.get("current_time_marker") or 0.0)
                await _db().cinema_network_rooms.update_one(
                    {"room_id": room_id},
                    {"$set": {"last_state": {
                        "playback_state": playback_state,
                        "current_time_marker": marker,
                        "ts": time.time(),
                    }}},
                )
                await _MANAGER.broadcast(
                    _pdf_envelope(
                        room_id=room_id,
                        action=action,
                        payload={
                            "playback_state": playback_state,
                            "current_time_marker": marker,
                        },
                        agent=agent,
                    ),
                    room_id,
                )

            elif action == "CHAT_MESSAGE":
                text = (payload.get("text") or "").strip()[:300]
                if text:
                    await _MANAGER.broadcast(
                        _pdf_envelope(
                            room_id=room_id,
                            action="CHAT_MESSAGE",
                            payload={"text": text, "user_id": agent},
                            agent=agent,
                        ),
                        room_id,
                    )

            elif action == "PING":
                await ws.send_json(_pdf_envelope(
                    room_id=room_id, action="PONG", payload={}, agent="SERVER"
                ))
            # Unknown actions: silently ignored (forward-compat).

    except WebSocketDisconnect:
        pass
    finally:
        await _MANAGER.disconnect(ws, room_id)

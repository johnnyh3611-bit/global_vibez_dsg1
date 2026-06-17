"""
VR Physical Bridge Routes — FastAPI endpoints for VR→physical handoffs.

Endpoints:
    POST /api/vr/handshake-token       — mint a signed handshake (dev/test)
    POST /api/vr/request-ride          — VR triggers a rideshare dispatch
    POST /api/vr/teleport-exit         — fade-to-black exit; unlock car + play playlist
    POST /api/vr/asap-teleport         — instant variant with priority flag
    WS   /api/ws/ride-status/{ride_id} — streams ETA/vehicle every 5 s
    POST /api/car/victory-handoff      — push win-streak message to Smartcar dash

Rideshare dispatch routes through our first-party **VibeRidez** system (no
Uber/Lyft). The Smartcar + Spotify car-side integrations remain MOCKED
until real provider keys are supplied — see `services/vr_physical_bridge.py`
for the swap-in seams.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from config import db
from services.vr_handshake import create_handshake_token, verify_vr_handshake
from services.vr_physical_bridge import (
    dispatch_ride,
    get_ride_status,
    send_victory_to_dashboard,
    start_car_vibe,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["vr_physical_bridge"])


# ────────────────────────────────────────────────────────────────────────────
#  Models
# ────────────────────────────────────────────────────────────────────────────
class HandshakeRequest(BaseModel):
    user_id: str
    vr_session_id: str


class HandshakeResponse(BaseModel):
    user_id: str
    vr_session_id: str
    handshake_token: str
    expires_in_seconds: int = 600


class RideRequest(BaseModel):
    user_id: str
    target_location: str
    pickup_location: str = "current_user_location"
    vr_session_id: str
    handshake_token: str
    context: Optional[str] = "GlobalVibez_DSG_Meeting"


class TeleportExitRequest(BaseModel):
    user_id: str
    vr_session_id: str
    handshake_token: str
    playlist_uri: Optional[str] = None
    volume: int = Field(default=60, ge=0, le=100)
    priority: bool = False


class VictoryHandoffRequest(BaseModel):
    user_id: str
    vehicle_id: str
    partner_id: Optional[str] = None
    game_type: str = "spades"


# ────────────────────────────────────────────────────────────────────────────
#  Handshake (dev / test endpoint — in prod, tokens come from VR client SDK)
# ────────────────────────────────────────────────────────────────────────────
@router.post("/vr/handshake-token", response_model=HandshakeResponse)
async def issue_handshake_token(req: HandshakeRequest) -> HandshakeResponse:
    token = create_handshake_token(req.user_id, req.vr_session_id)
    return HandshakeResponse(
        user_id=req.user_id,
        vr_session_id=req.vr_session_id,
        handshake_token=token,
    )


# ────────────────────────────────────────────────────────────────────────────
#  VR → Rideshare dispatch
# ────────────────────────────────────────────────────────────────────────────
@router.post("/vr/request-ride")
async def request_physical_ride(req: RideRequest) -> dict:
    """VR triggers a physical rideshare. Requires a valid handshake token."""
    if not verify_vr_handshake(req.user_id, req.vr_session_id, req.handshake_token):
        raise HTTPException(status_code=403, detail="VR Handshake failed.")

    ride = await dispatch_ride(
        user_id=req.user_id,
        pickup=req.pickup_location,
        destination=req.target_location,
        context=req.context,
    )

    ride_id = str(uuid4())
    record = {
        "ride_id": ride_id,
        "user_id": req.user_id,
        "vr_session_id": req.vr_session_id,
        "pickup": req.pickup_location,
        "destination": req.target_location,
        "context": req.context,
        "status": ride.get("status", "dispatched"),
        "eta": ride.get("eta"),
        "vehicle": ride.get("vehicle"),
        "plate": ride.get("plate"),
        "provider": ride.get("provider"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        await db.vr_rides.insert_one(record.copy())
    except Exception as exc:  # noqa: BLE001
        logger.warning("vr_rides insert failed: %s", exc)

    return {
        "status": "Ride Dispatched",
        "ride_id": ride_id,
        "eta": ride.get("eta"),
        "vehicle": ride.get("vehicle"),
        "plate": ride.get("plate"),
    }


# ────────────────────────────────────────────────────────────────────────────
#  VR Teleport Exit (fade-to-black → car unlock + Spotify)
# ────────────────────────────────────────────────────────────────────────────
async def _run_teleport_car_sequence(
    user_id: str,
    playlist_uri: Optional[str],
    volume: int,
) -> None:
    """Background task: unlock, set volume, play Spotify playlist."""
    try:
        result = await start_car_vibe(user_id, playlist_uri=playlist_uri, volume=volume)
        await db.vr_teleport_events.insert_one(
            {
                "user_id": user_id,
                "status": result.get("status"),
                "provider": result.get("provider"),
                "playlist_uri": playlist_uri,
                "volume": volume,
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }
        )
    except Exception as exc:  # noqa: BLE001
        logger.error("teleport car sequence failed for %s: %s", user_id, exc)


@router.post("/vr/teleport-exit")
async def teleport_exit(req: TeleportExitRequest, background_tasks: BackgroundTasks) -> dict:
    """Fade-to-black VR exit: backend unlocks car & starts playlist in background."""
    if not verify_vr_handshake(req.user_id, req.vr_session_id, req.handshake_token):
        raise HTTPException(status_code=403, detail="VR Handshake failed.")

    background_tasks.add_task(_run_teleport_car_sequence, req.user_id, req.playlist_uri, req.volume)
    return {
        "status": "Transition Initiated",
        "message": "Clear for HMD removal.",
        "mode": "asap" if req.priority else "standard",
    }


@router.post("/vr/asap-teleport")
async def asap_teleport(req: TeleportExitRequest, background_tasks: BackgroundTasks) -> dict:
    """Priority variant of teleport-exit — identical backend behavior, tagged for metrics."""
    req.priority = True
    return await teleport_exit(req, background_tasks)


# ────────────────────────────────────────────────────────────────────────────
#  Ride status WebSocket (VR HUD pulls ETA every 5s)
# ────────────────────────────────────────────────────────────────────────────
@router.websocket("/ws/ride-status/{ride_id}")
async def ride_status_stream(websocket: WebSocket, ride_id: str) -> None:
    await websocket.accept()
    try:
        # Send up to ~20 updates (100 s) unless the client disconnects first.
        for _ in range(20):
            status = await get_ride_status(ride_id)
            await websocket.send_json(status)
            if status.get("status") == "arrived":
                break
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        return
    except Exception as exc:  # noqa: BLE001
        logger.warning("ride_status_stream error: %s", exc)
    finally:
        try:
            await websocket.close()
        except Exception:  # noqa: BLE001
            pass


# ────────────────────────────────────────────────────────────────────────────
#  Car Victory Handoff — push win-streak to Smartcar dashboard
# ────────────────────────────────────────────────────────────────────────────
@router.post("/car/victory-handoff")
async def car_victory_handoff(req: VictoryHandoffRequest) -> dict:
    """
    Fetch the user's current win streak from live game sessions, then push a
    celebratory message to their vehicle dashboard (Smartcar, mocked).
    """
    session = None
    try:
        session = await db.game_sessions.find_one({"active_users": req.user_id})
    except Exception as exc:  # noqa: BLE001
        logger.warning("game_sessions lookup failed: %s", exc)

    streak = 0
    if session:
        streak = int(
            session.get(f"{req.game_type}_streak")
            or session.get("spades_streak")
            or session.get("win_streak")
            or 0
        )

    if streak < 3:
        return {"status": "no_streak", "streak": streak, "message": "Need a 3+ streak to broadcast."}

    message = f"GLOBAL VIBEZ: {streak}-GAME WIN STREAK!"
    result = await send_victory_to_dashboard(req.vehicle_id, message)
    try:
        await db.car_victory_events.insert_one(
            {
                "user_id": req.user_id,
                "partner_id": req.partner_id,
                "vehicle_id": req.vehicle_id,
                "game_type": req.game_type,
                "streak": streak,
                "message": message,
                "provider": result.get("provider"),
                "broadcast_at": datetime.now(timezone.utc).isoformat(),
            }
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("car_victory_events insert failed: %s", exc)

    return {"status": "Victory broadcasted to vehicle!", "streak": streak, "message": message}


# ────────────────────────────────────────────────────────────────────────────
#  VibeRidez Hails — driver-facing (list / claim pending VR ride requests)
# ────────────────────────────────────────────────────────────────────────────
class ClaimHailRequest(BaseModel):
    driver_id: str
    driver_username: Optional[str] = None


@router.get("/vibe-ridez/hails")
async def list_pending_hails(limit: int = 25) -> dict:
    """List pending VibeRidez hails awaiting a driver (newest first)."""
    limit = max(1, min(limit, 100))
    try:
        cursor = db.vibe_ridez_hails.find(
            {"status": "pending"},
            {"_id": 0},
            sort=[("created_at", -1)],
            limit=limit,
        )
        hails = await cursor.to_list(length=limit)
    except Exception as exc:  # noqa: BLE001
        logger.warning("list_pending_hails failed: %s", exc)
        hails = []
    return {"count": len(hails), "hails": hails}


@router.post("/vibe-ridez/hails/{hail_id}/claim")
async def claim_hail(hail_id: str, req: ClaimHailRequest) -> dict:
    """A VibeRidez driver claims a pending hail. Returns the updated hail."""
    updated = await db.vibe_ridez_hails.find_one_and_update(
        {"hail_id": hail_id, "status": "pending"},
        {
            "$set": {
                "status": "claimed",
                "claimed_by": req.driver_username or req.driver_id,
                "claimed_by_driver_id": req.driver_id,
                "claimed_at": datetime.now(timezone.utc).isoformat(),
            }
        },
        return_document=True,
        projection={"_id": 0},
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Hail not found or already claimed.")
    return updated

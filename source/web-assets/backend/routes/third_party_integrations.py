"""
Smartcar + Spotify integration scaffold.

STATUS: SCAFFOLD / MOCKED until API keys arrive.

Activates when the corresponding *_CLIENT_ID / *_CLIENT_SECRET env vars are
set. In mock mode, every endpoint returns deterministic fixture data so the
frontend can be fully built out and QA'd without real keys.

Environment:
  SMARTCAR_CLIENT_ID, SMARTCAR_CLIENT_SECRET, SMARTCAR_REDIRECT_URI, SMARTCAR_MODE=test|live
  SPOTIFY_CLIENT_ID,  SPOTIFY_CLIENT_SECRET,  SPOTIFY_REDIRECT_URI
"""
from __future__ import annotations

import os
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from utils.database import get_database


# ==================== SMARTCAR ====================
smartcar_router = APIRouter(prefix="/smartcar", tags=["smartcar"])


def _smartcar_configured() -> bool:
    return bool(
        os.environ.get("SMARTCAR_CLIENT_ID")
        and os.environ.get("SMARTCAR_CLIENT_SECRET")
    )


@smartcar_router.get("/config")
async def smartcar_config() -> Dict[str, Any]:
    return {
        "configured": _smartcar_configured(),
        "mode": os.environ.get("SMARTCAR_MODE", "test"),
        "scopes_supported": [
            "read_vehicle_info", "read_location", "read_odometer",
            "read_vin", "read_fuel", "read_battery", "read_charge",
            "control_security", "control_charge",
        ],
    }


async def _resolve_user_id(request: Request) -> str:
    db = get_database()
    session_token = request.cookies.get("session_token")
    if session_token:
        sess = await db.user_sessions.find_one(
            {"session_token": session_token}, {"user_id": 1, "_id": 0}
        )
        if sess:
            return sess["user_id"]
    uid = request.headers.get("x-user-id") or request.headers.get("X-User-Id")
    if uid:
        return uid
    raise HTTPException(401, "Not authenticated")


@smartcar_router.get("/auth-url")
async def smartcar_auth_url(request: Request) -> Dict[str, Any]:
    """Return the Smartcar OAuth URL, or a MOCK placeholder."""
    user_id = await _resolve_user_id(request)
    if not _smartcar_configured():
        return {
            "mode": "mock",
            "url": f"/smartcar/mock-callback?user_id={user_id}",
            "note": "Provide SMARTCAR_CLIENT_ID + SMARTCAR_CLIENT_SECRET to enable live OAuth",
        }
    from services.smartcar_service import build_auth_url
    return {"mode": os.environ.get("SMARTCAR_MODE", "test"), "url": build_auth_url(state=user_id)}


class SmartcarCallbackRequest(BaseModel):
    code: str
    state: Optional[str] = None


@smartcar_router.post("/exchange-code")
async def smartcar_exchange_code(body: SmartcarCallbackRequest, request: Request) -> Dict[str, Any]:
    """Called by the frontend after Smartcar redirects back with ?code=...

    Identity resolution priority:
      1. session cookie (normal logged-in flow)
      2. OAuth `state` param — we build the auth URL with state=<user_id>, so
         even if cookies didn't ride along with the redirect we can still
         attach the vehicle to the correct account. Guarded by verifying the
         user_id exists in `users` so random strings can't hijack the flow.
    """
    if not _smartcar_configured():
        raise HTTPException(501, "Smartcar not configured")

    try:
        user_id = await _resolve_user_id(request)
    except HTTPException:
        state_uid = (body.state or "").strip()
        if not state_uid:
            raise
        db_ = get_database()
        user = await db_.users.find_one({"user_id": state_uid}, {"user_id": 1, "_id": 0})
        if not user:
            raise HTTPException(401, "Invalid state — user not found")
        user_id = state_uid

    try:
        from services.smartcar_service import exchange_code
        return await exchange_code(get_database(), user_id, body.code)
    except Exception as e:
        raise HTTPException(400, f"Smartcar exchange failed: {e}")


@smartcar_router.get("/vehicles")
async def smartcar_vehicles(request: Request) -> Dict[str, Any]:
    user_id = await _resolve_user_id(request)
    if not _smartcar_configured():
        return {
            "mode": "mock",
            "user_id": user_id,
            "vehicles": [{
                "id": "mock-vehicle-1",
                "make": "Tesla", "model": "Model 3", "year": 2024,
                "vin": "XXMOCK0000000000",
                "battery_percent": 72,
                "location": {"latitude": 34.0194, "longitude": -118.4912},
                "locked": True,
            }],
        }
    from services.smartcar_service import list_vehicles
    vehicles = await list_vehicles(get_database(), user_id)
    return {
        "mode": os.environ.get("SMARTCAR_MODE", "test"),
        "user_id": user_id,
        "vehicles": vehicles,
        "connected": len(vehicles) > 0,
    }


class UnlockRequest(BaseModel):
    vehicle_id: str


@smartcar_router.post("/unlock")
async def smartcar_unlock(body: UnlockRequest, request: Request) -> Dict[str, Any]:
    user_id = await _resolve_user_id(request)
    if not _smartcar_configured():
        return {
            "mode": "mock",
            "vehicle_id": body.vehicle_id,
            "user_id": user_id,
            "status": "unlocked",
            "note": "MOCK mode — no actual Smartcar API call.",
        }
    try:
        from services.smartcar_service import unlock_vehicle
        return await unlock_vehicle(get_database(), user_id, body.vehicle_id)
    except Exception as e:
        raise HTTPException(502, f"Smartcar unlock failed: {e}")


@smartcar_router.post("/lock")
async def smartcar_lock(body: UnlockRequest, request: Request) -> Dict[str, Any]:
    user_id = await _resolve_user_id(request)
    if not _smartcar_configured():
        return {"mode": "mock", "vehicle_id": body.vehicle_id, "status": "locked"}
    try:
        from services.smartcar_service import lock_vehicle
        return await lock_vehicle(get_database(), user_id, body.vehicle_id)
    except Exception as e:
        raise HTTPException(502, f"Smartcar lock failed: {e}")


# ==================== SPOTIFY ====================
spotify_router = APIRouter(prefix="/spotify", tags=["spotify"])


def _spotify_configured() -> bool:
    return bool(
        os.environ.get("SPOTIFY_CLIENT_ID")
        and os.environ.get("SPOTIFY_CLIENT_SECRET")
    )


@spotify_router.get("/config")
async def spotify_config() -> Dict[str, Any]:
    return {
        "configured": _spotify_configured(),
        "scopes_supported": [
            "user-read-playback-state", "user-modify-playback-state",
            "user-read-currently-playing", "playlist-read-private",
            "streaming",
        ],
    }


@spotify_router.get("/auth-url")
async def spotify_auth_url(request: Request) -> Dict[str, Any]:
    user_id = await _resolve_user_id(request)
    if not _spotify_configured():
        return {
            "mode": "mock",
            "url": f"/spotify/mock-callback?user_id={user_id}",
            "note": "Provide SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET to enable live OAuth",
        }
    from services.spotify_service import build_auth_url
    return {"mode": "live", "url": build_auth_url(state=user_id)}


class SpotifyCallbackRequest(BaseModel):
    code: str
    state: Optional[str] = None


@spotify_router.post("/exchange-code")
async def spotify_exchange_code(body: SpotifyCallbackRequest, request: Request) -> Dict[str, Any]:
    user_id = await _resolve_user_id(request)
    if not _spotify_configured():
        raise HTTPException(501, "Spotify not configured")
    try:
        from services.spotify_service import exchange_code
        return await exchange_code(get_database(), user_id, body.code)
    except Exception as e:
        raise HTTPException(400, f"Spotify exchange failed: {e}")


@spotify_router.get("/me")
async def spotify_me(request: Request) -> Dict[str, Any]:
    user_id = await _resolve_user_id(request)
    if not _spotify_configured():
        return {"connected": False, "mode": "mock"}
    from services.spotify_service import get_me
    return await get_me(get_database(), user_id)


@spotify_router.get("/now-playing")
async def spotify_now_playing(request: Request) -> Dict[str, Any]:
    user_id = await _resolve_user_id(request)
    if not _spotify_configured():
        return {
            "mode": "mock",
            "user_id": user_id,
            "is_playing": True,
            "track": {
                "id": "mock-track", "name": "VIBEZ", "artist": "Global Vibez DSG",
                "album": "Sweepstakes Nights",
                "album_art": "https://i.scdn.co/image/mock",
                "progress_ms": 42000, "duration_ms": 210000,
            },
        }
    try:
        from services.spotify_service import now_playing
        return await now_playing(get_database(), user_id)
    except Exception as e:
        raise HTTPException(502, f"Spotify fetch failed: {e}")


class PushTrackRequest(BaseModel):
    track_uri: str


@spotify_router.post("/push-to-car")
async def spotify_push_to_car(body: PushTrackRequest, request: Request) -> Dict[str, Any]:
    """Push a Spotify track to the user's Smartcar-paired vehicle dash."""
    user_id = await _resolve_user_id(request)
    if not _spotify_configured():
        return {
            "mode": "mock",
            "user_id": user_id,
            "track_uri": body.track_uri,
            "status": "queued-to-dash",
            "note": "MOCK mode. Requires SPOTIFY_* and SMARTCAR_* keys.",
        }
    try:
        from services.spotify_service import play_track
        result = await play_track(get_database(), user_id, body.track_uri)
        return {**result, "track_uri": body.track_uri}
    except Exception as e:
        raise HTTPException(502, f"Spotify play failed: {e}")

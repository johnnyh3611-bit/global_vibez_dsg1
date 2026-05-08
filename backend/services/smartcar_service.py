"""
Live Smartcar integration helpers.

Builds an AuthClient lazily from env vars so the module can be imported
safely even before credentials land. Exchanges OAuth codes for access
tokens, lists vehicles, and executes control commands (lock/unlock/charge).

Token storage:
    `user_smartcar_tokens` collection — one doc per user, fields:
        user_id, access_token, refresh_token, expires_at, mode
"""
from __future__ import annotations

import os
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional


def get_auth_client():
    """Returns a Smartcar AuthClient configured from env vars."""
    import smartcar

    client_id = os.environ.get("SMARTCAR_CLIENT_ID")
    client_secret = os.environ.get("SMARTCAR_CLIENT_SECRET")
    redirect_uri = os.environ.get("SMARTCAR_REDIRECT_URI")
    if not (client_id and client_secret and redirect_uri):
        raise RuntimeError(
            "Smartcar not configured — set SMARTCAR_CLIENT_ID, SMARTCAR_CLIENT_SECRET, SMARTCAR_REDIRECT_URI."
        )
    mode = os.environ.get("SMARTCAR_MODE", "test")
    return smartcar.AuthClient(
        client_id=client_id,
        client_secret=client_secret,
        redirect_uri=redirect_uri,
        mode=mode,
    )


def build_auth_url(state: str) -> str:
    """Generate the Smartcar OAuth URL for the given per-user state."""
    client = get_auth_client()
    scope = [
        "read_vehicle_info",
        "read_location",
        "read_odometer",
        "read_vin",
        "read_fuel",
        "read_battery",
        "read_charge",
        "control_security",
        "control_charge",
    ]
    return client.get_auth_url(scope=scope, options={"state": state})


async def exchange_code(db, user_id: str, code: str) -> Dict[str, Any]:
    client = get_auth_client()
    access = client.exchange_code(code)
    # access is a NamedTuple: access_token, token_type, expires_in, refresh_token, refresh_expiration, expiration
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=int(access.expires_in))
    token_doc = {
        "user_id": user_id,
        "access_token": access.access_token,
        "refresh_token": access.refresh_token,
        "expires_at": expires_at.isoformat(),
        "mode": os.environ.get("SMARTCAR_MODE", "test"),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.user_smartcar_tokens.update_one(
        {"user_id": user_id}, {"$set": token_doc}, upsert=True
    )
    return {"ok": True, "expires_at": token_doc["expires_at"]}


async def _get_access_token(db, user_id: str) -> Optional[str]:
    """Get access token, refreshing if needed."""
    doc = await db.user_smartcar_tokens.find_one({"user_id": user_id}, {"_id": 0})
    if not doc:
        return None
    expires_at = datetime.fromisoformat(doc["expires_at"])
    if expires_at <= datetime.now(timezone.utc) + timedelta(minutes=2):
        # Refresh
        client = get_auth_client()
        try:
            new = client.exchange_refresh_token(doc["refresh_token"])
        except Exception:
            return None
        new_expires = datetime.now(timezone.utc) + timedelta(seconds=int(new.expires_in))
        await db.user_smartcar_tokens.update_one(
            {"user_id": user_id},
            {"$set": {
                "access_token": new.access_token,
                "refresh_token": new.refresh_token,
                "expires_at": new_expires.isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        return new.access_token
    return doc["access_token"]


async def list_vehicles(db, user_id: str) -> List[Dict[str, Any]]:
    import smartcar

    token = await _get_access_token(db, user_id)
    if not token:
        return []
    response = smartcar.get_vehicles(token)  # returns NamedTuple {vehicles, paging}
    vehicle_ids = list(response.vehicles)
    out: List[Dict[str, Any]] = []
    for vid in vehicle_ids[:10]:  # cap to 10 for UI sanity
        v = smartcar.Vehicle(vid, token)
        try:
            attrs = v.attributes()  # make, model, year, id
            info = {
                "id": attrs.id,
                "make": attrs.make,
                "model": attrs.model,
                "year": attrs.year,
            }
        except Exception as e:
            info = {"id": vid, "error": str(e)}
        out.append(info)
    return out


async def unlock_vehicle(db, user_id: str, vehicle_id: str) -> Dict[str, Any]:
    import smartcar

    token = await _get_access_token(db, user_id)
    if not token:
        raise RuntimeError("Smartcar not authorized — connect your vehicle first.")
    v = smartcar.Vehicle(vehicle_id, token)
    action = v.unlock()
    return {"status": "unlocked", "message": str(action.message) if hasattr(action, "message") else "ok"}


async def lock_vehicle(db, user_id: str, vehicle_id: str) -> Dict[str, Any]:
    import smartcar

    token = await _get_access_token(db, user_id)
    if not token:
        raise RuntimeError("Smartcar not authorized — connect your vehicle first.")
    v = smartcar.Vehicle(vehicle_id, token)
    action = v.lock()
    return {"status": "locked", "message": str(action.message) if hasattr(action, "message") else "ok"}

"""
Vibe Drive — bonus $DSG for verified driving while streaming approved playlists.

Tamper-proof by design:
  - Odometer comes from Smartcar (read-only, OEM-backed, can't be spoofed)
  - Playback comes from Spotify (server-verified current_playback)
  - A user is "driving" when their odometer is strictly greater than the
    last-seen value we have on file. No GPS, no phone inputs.

Award rule (defaults, overridable via env):
  - 1 $DSG per 10 verified miles
  - Capped at 5 $DSG / calendar day per user
  - Only counts when the currently-playing track's playlist URI is in the
    curated CURATED_PLAYLIST_URIS set (or the "mock" flag allows testing)

State:
  `vibe_drive_sessions` — per-user doc tracking last_odometer, today_awarded,
  last_seen_at, last_awarded_at. Daily caps roll over at UTC midnight.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

MILES_PER_VIBEZ = float(os.environ.get("VIBE_DRIVE_MILES_PER_VIBEZ", "10"))
DAILY_VIBEZ_CAP = float(os.environ.get("VIBE_DRIVE_DAILY_CAP", "5"))

# Curated playlist URIs that count toward Vibe Drive bonuses.
# Today these are placeholders — swap in real Spotify playlist URIs once
# you create the "Global Vibez Drive" playlists.
CURATED_PLAYLIST_URIS = {
    "spotify:playlist:37i9dQZF1DXcBWIGoYBM5M",  # Top 50 Global (placeholder)
    "spotify:playlist:37i9dQZF1DX0XUsuxWHRQd",  # RapCaviar (placeholder)
    "spotify:playlist:37i9dQZF1DWXRqgorJj26U",  # Rock Classics (placeholder)
}

# Meters-to-miles conversion (Smartcar returns km by default via _odometer_miles wrapper)
_KM_TO_MI = 0.621371


async def _get_smartcar_odometer_miles(db, user_id: str) -> Optional[float]:
    """Fetch the latest odometer in miles, or None if not authorized."""
    try:
        import smartcar
        from services.smartcar_service import _get_access_token
    except Exception:
        return None
    token = await _get_access_token(db, user_id)
    if not token:
        return None
    try:
        vehicles = smartcar.get_vehicles(token).vehicles
        if not vehicles:
            return None
        v = smartcar.Vehicle(vehicles[0], token)
        odo = v.odometer()
        # Returns Odometer(distance=float_km, unit_system='metric')
        km = float(getattr(odo, "distance", 0.0) or 0.0)
        return km * _KM_TO_MI
    except Exception:
        return None


async def _get_spotify_playback(db, user_id: str) -> Optional[Dict[str, Any]]:
    """Returns {is_playing, track_uri, playlist_uri} or None if not authorized."""
    try:
        from services.spotify_service import _get_access_token, _client
    except Exception:
        return None
    token = await _get_access_token(db, user_id)
    if not token:
        return None
    try:
        sp = _client(token)
        current = sp.current_playback()
        if not current or not current.get("item"):
            return {"is_playing": False, "track_uri": None, "playlist_uri": None}
        context = current.get("context") or {}
        item = current.get("item") or {}
        album = item.get("album") or {}
        images = album.get("images") or []
        artists = item.get("artists") or []
        return {
            "is_playing": bool(current.get("is_playing")),
            "track_uri": item.get("uri"),
            "track_name": item.get("name"),
            "artist_name": ", ".join([a.get("name", "") for a in artists if a.get("name")]) or None,
            "album_name": album.get("name"),
            "album_art_url": (images[0].get("url") if images else None),
            "progress_ms": current.get("progress_ms"),
            "duration_ms": item.get("duration_ms"),
            "playlist_uri": context.get("uri") if context.get("type") == "playlist" else None,
        }
    except Exception:
        return None


def _today_key(dt: Optional[datetime] = None) -> str:
    d = dt or datetime.now(timezone.utc)
    return d.strftime("%Y-%m-%d")


async def tick(db, user_id: str, *, mock: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Idempotent tick — safe to call on every page load or from a scheduler.

    Returns a verbose payload describing what happened (even when no award is
    made), so the frontend can show a helpful state.

    `mock` bypasses real SDK calls and is used only by pytest.
    """
    now = datetime.now(timezone.utc)
    today = _today_key(now)

    # 1) Fetch state (live or mock)
    if mock is not None:
        odo_mi = mock.get("odometer_miles")
        playback = mock.get("playback")
    else:
        odo_mi = await _get_smartcar_odometer_miles(db, user_id)
        playback = await _get_spotify_playback(db, user_id)

    session = await db.vibe_drive_sessions.find_one({"user_id": user_id}, {"_id": 0})
    last_odo = (session or {}).get("last_odometer_miles")
    today_awarded = 0.0
    if session and session.get("awarded_by_day"):
        today_awarded = float(session["awarded_by_day"].get(today, 0.0))

    state = {
        "car_connected": odo_mi is not None,
        "spotify_connected": playback is not None,
        "odometer_miles": round(odo_mi, 3) if odo_mi is not None else None,
        "last_odometer_miles": last_odo,
        "is_playing": bool(playback and playback.get("is_playing")),
        "playlist_uri": playback.get("playlist_uri") if playback else None,
        "track_name": playback.get("track_name") if playback else None,
        "artist_name": playback.get("artist_name") if playback else None,
        "album_name": playback.get("album_name") if playback else None,
        "album_art_url": playback.get("album_art_url") if playback else None,
        "progress_ms": playback.get("progress_ms") if playback else None,
        "duration_ms": playback.get("duration_ms") if playback else None,
        "approved_playlist": bool(
            playback
            and playback.get("playlist_uri")
            and playback["playlist_uri"] in CURATED_PLAYLIST_URIS
        ),
        "today": today,
        "today_awarded": round(today_awarded, 2),
        "daily_cap": DAILY_VIBEZ_CAP,
        "miles_per_vibez": MILES_PER_VIBEZ,
        "awarded_vibez": 0.0,
        "reason": None,
    }

    # 2) Gate checks
    if odo_mi is None:
        state["reason"] = "smartcar_not_connected"
    elif playback is None:
        state["reason"] = "spotify_not_connected"
    elif not playback.get("is_playing"):
        state["reason"] = "nothing_playing"
    elif not state["approved_playlist"]:
        state["reason"] = "playlist_not_approved"
    elif last_odo is None:
        state["reason"] = "first_ping_establishing_baseline"
    elif today_awarded >= DAILY_VIBEZ_CAP:
        state["reason"] = "daily_cap_reached"
    else:
        # 3) Compute miles delta since last tick
        miles_delta = max(0.0, odo_mi - float(last_odo))
        if miles_delta <= 0.0:
            state["reason"] = "no_new_miles"
        else:
            # 4) Miles → $DSG, clamp to remaining daily cap
            award = miles_delta / MILES_PER_VIBEZ
            remaining = DAILY_VIBEZ_CAP - today_awarded
            award = round(min(award, remaining), 4)
            if award <= 0:
                state["reason"] = "daily_cap_reached"
            else:
                # 5) Credit via mining engine so 72h hold + sweeper logic applies.
                try:
                    await _credit_vibez(db, user_id, award, miles_delta)
                    today_awarded += award
                    state["awarded_vibez"] = award
                    state["today_awarded"] = round(today_awarded, 2)
                    state["reason"] = "awarded"
                except Exception as e:
                    state["reason"] = f"award_failed: {e}"

    # 6) Persist updated session
    update: Dict[str, Any] = {"$set": {
        "user_id": user_id,
        "last_odometer_miles": state["odometer_miles"] if state["odometer_miles"] is not None else last_odo,
        "last_seen_at": now.isoformat(),
        f"awarded_by_day.{today}": round(today_awarded, 4),
    }}
    await db.vibe_drive_sessions.update_one({"user_id": user_id}, update, upsert=True)

    return state


async def _credit_vibez(db, user_id: str, amount: float, miles: float) -> None:
    """Write a dedicated ledger entry + bump pending balance.

    We bypass mining_engine.BASE_REWARDS (which only keys game/chat events)
    and write a purpose-built entry that the sweeper picks up same-day after
    the 72h Vibe Check hold.
    """
    from datetime import timedelta

    now = datetime.now(timezone.utc)
    hold_until = now + timedelta(hours=72)
    entry = {
        "user_id": user_id,
        "event": "vibe_drive",
        "game_type": None,
        "miles_verified": round(miles, 3),
        "miles_per_vibez": MILES_PER_VIBEZ,
        "base": 0.0,
        "tier_multiplier": 1.0,
        "loyalty_multiplier": 1.0,
        "game_multiplier": 1.0,
        "personal_multiplier": 1.0,
        "global_boost": 1.0,
        "context_multiplier": 1.0,
        "mined": float(amount),
        "status": "PENDING_VIBE_CHECK",
        "hold_until": hold_until.isoformat(),
        "created_at": now.isoformat(),
    }
    await db.vibez_mining_ledger.insert_one(entry)
    await db.vibez_mining_balance.update_one(
        {"user_id": user_id},
        {
            "$inc": {"pending_balance": float(amount), "lifetime_mined": float(amount)},
            "$set": {"updated_at": now.isoformat()},
            "$setOnInsert": {
                "user_id": user_id,
                "balance": 0.0,
                "created_at": now.isoformat(),
            },
        },
        upsert=True,
    )


async def recent_sessions(db, user_id: str, limit: int = 20) -> Dict[str, Any]:
    cursor = db.vibez_mining_ledger.find(
        {"user_id": user_id, "event": "vibe_drive"}, {"_id": 0}
    ).sort("created_at", -1).limit(limit)
    rows = await cursor.to_list(length=limit)
    return {"sessions": rows, "count": len(rows)}

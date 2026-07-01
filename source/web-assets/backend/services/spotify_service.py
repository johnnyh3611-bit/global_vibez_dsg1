"""
Live Spotify integration via spotipy.

Stores per-user access/refresh tokens in `user_spotify_tokens`. Exposes
helpers for OAuth, now-playing, and (future) push-to-car Connect routing.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional

SPOTIFY_SCOPE = " ".join([
    "user-read-playback-state",
    "user-modify-playback-state",
    "user-read-currently-playing",
    "playlist-read-private",
    "streaming",
    "user-read-email",
    "user-read-private",
])


def _oauth():
    from spotipy.oauth2 import SpotifyOAuth

    client_id = os.environ.get("SPOTIFY_CLIENT_ID")
    client_secret = os.environ.get("SPOTIFY_CLIENT_SECRET")
    redirect_uri = os.environ.get("SPOTIFY_REDIRECT_URI")
    if not (client_id and client_secret and redirect_uri):
        raise RuntimeError("Spotify not configured")
    return SpotifyOAuth(
        client_id=client_id,
        client_secret=client_secret,
        redirect_uri=redirect_uri,
        scope=SPOTIFY_SCOPE,
        cache_handler=None,  # we handle storage ourselves, per-user
        open_browser=False,
    )


def build_auth_url(state: str) -> str:
    oauth = _oauth()
    return oauth.get_authorize_url(state=state)


async def exchange_code(db, user_id: str, code: str) -> Dict[str, Any]:
    oauth = _oauth()
    token_info = oauth.get_access_token(code, as_dict=True, check_cache=False)
    doc = {
        "user_id": user_id,
        "access_token": token_info["access_token"],
        "refresh_token": token_info.get("refresh_token"),
        "expires_at": (
            datetime.now(timezone.utc) + timedelta(seconds=int(token_info.get("expires_in", 3600)))
        ).isoformat(),
        "scope": token_info.get("scope", SPOTIFY_SCOPE),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.user_spotify_tokens.update_one(
        {"user_id": user_id}, {"$set": doc}, upsert=True
    )
    return {"ok": True, "expires_at": doc["expires_at"]}


async def _get_access_token(db, user_id: str) -> Optional[str]:
    doc = await db.user_spotify_tokens.find_one({"user_id": user_id}, {"_id": 0})
    if not doc:
        return None
    expires_at = datetime.fromisoformat(doc["expires_at"])
    if expires_at <= datetime.now(timezone.utc) + timedelta(minutes=2):
        if not doc.get("refresh_token"):
            return None
        oauth = _oauth()
        try:
            refreshed = oauth.refresh_access_token(doc["refresh_token"])
        except Exception:
            return None
        new_expires = datetime.now(timezone.utc) + timedelta(seconds=int(refreshed.get("expires_in", 3600)))
        await db.user_spotify_tokens.update_one(
            {"user_id": user_id},
            {"$set": {
                "access_token": refreshed["access_token"],
                "refresh_token": refreshed.get("refresh_token", doc["refresh_token"]),
                "expires_at": new_expires.isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        return refreshed["access_token"]
    return doc["access_token"]


def _client(token: str):
    import spotipy
    return spotipy.Spotify(auth=token)


async def get_me(db, user_id: str) -> Dict[str, Any]:
    token = await _get_access_token(db, user_id)
    if not token:
        return {"connected": False}
    sp = _client(token)
    me = sp.me()
    return {
        "connected": True,
        "id": me.get("id"),
        "display_name": me.get("display_name"),
        "product": me.get("product"),
        "email": me.get("email"),
        "avatar_url": (me.get("images") or [{}])[0].get("url") if me.get("images") else None,
    }


async def now_playing(db, user_id: str) -> Dict[str, Any]:
    token = await _get_access_token(db, user_id)
    if not token:
        return {"connected": False}
    sp = _client(token)
    current = sp.current_playback()
    if not current or not current.get("item"):
        return {"connected": True, "is_playing": False, "track": None}
    item = current["item"]
    return {
        "connected": True,
        "is_playing": bool(current.get("is_playing")),
        "track": {
            "id": item.get("id"),
            "name": item.get("name"),
            "artist": ", ".join(a.get("name", "") for a in item.get("artists") or []),
            "album": (item.get("album") or {}).get("name"),
            "album_art": ((item.get("album") or {}).get("images") or [{}])[0].get("url"),
            "uri": item.get("uri"),
            "progress_ms": current.get("progress_ms", 0),
            "duration_ms": item.get("duration_ms", 0),
        },
        "device": (current.get("device") or {}).get("name"),
    }


async def play_track(db, user_id: str, track_uri: str) -> Dict[str, Any]:
    token = await _get_access_token(db, user_id)
    if not token:
        raise RuntimeError("Spotify not authorized")
    sp = _client(token)
    devices = (sp.devices() or {}).get("devices") or []
    if not devices:
        return {"status": "no-active-device", "note": "Open Spotify on a device first, then retry."}
    # Prefer the currently active device; otherwise pick the first available.
    device_id = next((d["id"] for d in devices if d.get("is_active")), devices[0]["id"])
    sp.start_playback(device_id=device_id, uris=[track_uri])
    return {"status": "queued", "device_id": device_id}


async def queue_track(db, user_id: str, track_uri: str) -> Dict[str, Any]:
    """Enqueue (don't replace) a track on the user's active Spotify device.
    Used by tip-to-add to slot a passenger pick into the queue without
    skipping what's currently playing."""
    token = await _get_access_token(db, user_id)
    if not token:
        raise RuntimeError("Spotify not authorized")
    sp = _client(token)
    devices = (sp.devices() or {}).get("devices") or []
    if not devices:
        return {"status": "no-active-device"}
    device_id = next((d["id"] for d in devices if d.get("is_active")), devices[0]["id"])
    sp.add_to_queue(track_uri, device_id=device_id)
    return {"status": "enqueued", "device_id": device_id}


async def next_track(db, user_id: str) -> Dict[str, Any]:
    """Skip-to-next on the driver's active Spotify device.
    Used by tip-to-skip + the existing vote-skip flow."""
    token = await _get_access_token(db, user_id)
    if not token:
        raise RuntimeError("Spotify not authorized")
    sp = _client(token)
    devices = (sp.devices() or {}).get("devices") or []
    if not devices:
        return {"status": "no-active-device"}
    device_id = next((d["id"] for d in devices if d.get("is_active")), devices[0]["id"])
    sp.next_track(device_id=device_id)
    return {"status": "skipped", "device_id": device_id}


async def recently_played(db, user_id: str, limit: int = 5) -> Dict[str, Any]:
    """Last-N played tracks for a user. Powers the Auto-DJ rider seed."""
    token = await _get_access_token(db, user_id)
    if not token:
        return {"connected": False, "tracks": []}
    sp = _client(token)
    try:
        rp = sp.current_user_recently_played(limit=max(1, min(limit, 20))) or {}
    except Exception:
        return {"connected": True, "tracks": []}
    tracks: list = []
    for item in (rp.get("items") or []):
        t = item.get("track") or {}
        tracks.append({
            "id": t.get("id"),
            "uri": t.get("uri"),
            "name": t.get("name"),
            "artist": ", ".join(a.get("name", "") for a in t.get("artists") or []),
            "artist_ids": [a.get("id") for a in t.get("artists") or [] if a.get("id")],
        })
    return {"connected": True, "tracks": tracks}


async def recommendations(
    db,
    user_id: str,
    seed_tracks: Optional[list] = None,
    seed_artists: Optional[list] = None,
    seed_genres: Optional[list] = None,
    limit: int = 20,
) -> Dict[str, Any]:
    """Spotify `sp.recommendations()` powering the Vibe Drive Auto-DJ.
    Spotify caps total seeds at 5 across all 3 categories."""
    token = await _get_access_token(db, user_id)
    if not token:
        return {"connected": False, "tracks": []}
    sp = _client(token)
    seed_tracks = (seed_tracks or [])[:3]
    seed_artists = (seed_artists or [])[:2]
    seed_genres = (seed_genres or [])[: max(0, 5 - len(seed_tracks) - len(seed_artists))]
    try:
        rec = sp.recommendations(
            seed_tracks=seed_tracks or None,
            seed_artists=seed_artists or None,
            seed_genres=seed_genres or None,
            limit=max(1, min(limit, 50)),
        ) or {}
    except Exception:
        return {"connected": True, "tracks": []}
    out = []
    for t in (rec.get("tracks") or []):
        out.append({
            "id": t.get("id"),
            "uri": t.get("uri"),
            "name": t.get("name"),
            "artist": ", ".join(a.get("name", "") for a in t.get("artists") or []),
            "album_art": ((t.get("album") or {}).get("images") or [{}])[0].get("url"),
        })
    return {"connected": True, "tracks": out}

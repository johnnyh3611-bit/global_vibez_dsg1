"""
Live Streamer Push Notifications — fan-out "🔴 [Streamer] is LIVE now"
to every follower the moment Cloudflare flips a stream to `is_live=True`.

This is the high-retention loop for a streaming product: the
notification gets users back into the app within seconds of a creator
going live.

Two surfaces:
  • POST /api/streamer-follow/follow    — user follows a streamer
  • POST /api/streamer-follow/unfollow  — user unfollows
  • GET  /api/streamer-follow/following/{user_id}
  • GET  /api/streamer-follow/followers/{streamer_id}

Plus an internal helper `notify_followers_of_live_stream(streamer_id)`
that the Cloudflare webhook (`routes/cloudflare_stream.py`) calls
the moment a stream first transitions to LIVE. Idempotent — wallet-
style atomic "live_notif_sent_at" flag stops double-buzzing the same
followers if the webhook fires multiple times in quick succession.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/streamer-follow", tags=["streamer-follow"])

_client = AsyncIOMotorClient(os.environ.get("MONGO_URL"))
_db = _client[os.environ.get("DB_NAME", "global_vibez_dsg")]

# Cooldown so a flaky CF webhook can't spam the same followers' phones
# 100 times in 60 seconds. Re-arm 6 hours after the last live ping.
LIVE_NOTIF_COOLDOWN_HOURS = 6


class FollowReq(BaseModel):
    user_id: str
    streamer_id: str


@router.post("/follow")
async def follow(req: FollowReq) -> Dict[str, Any]:
    """Idempotent: a user can call this N times, only one row is kept."""
    if req.user_id == req.streamer_id:
        raise HTTPException(400, detail="Cannot follow yourself")
    await _db.streamer_follows.update_one(
        {"user_id": req.user_id, "streamer_id": req.streamer_id},
        {"$set": {
            "user_id": req.user_id,
            "streamer_id": req.streamer_id,
            "active": True,
            "followed_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"following": True, "streamer_id": req.streamer_id}


@router.post("/unfollow")
async def unfollow(req: FollowReq) -> Dict[str, Any]:
    await _db.streamer_follows.update_one(
        {"user_id": req.user_id, "streamer_id": req.streamer_id},
        {"$set": {"active": False, "unfollowed_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"following": False, "streamer_id": req.streamer_id}


@router.get("/following/{user_id}")
async def list_following(user_id: str) -> Dict[str, Any]:
    cursor = _db.streamer_follows.find(
        {"user_id": user_id, "active": True}, {"_id": 0},
    )
    rows = await cursor.to_list(500)
    return {"user_id": user_id, "count": len(rows), "streamers": [r["streamer_id"] for r in rows]}


@router.get("/followers/{streamer_id}")
async def list_followers(streamer_id: str) -> Dict[str, Any]:
    cursor = _db.streamer_follows.find(
        {"streamer_id": streamer_id, "active": True}, {"_id": 0},
    )
    rows = await cursor.to_list(5000)
    return {
        "streamer_id": streamer_id,
        "follower_count": len(rows),
        "followers": [r["user_id"] for r in rows],
    }


@router.get("/is-following/{user_id}/{streamer_id}")
async def is_following(user_id: str, streamer_id: str) -> Dict[str, Any]:
    doc = await _db.streamer_follows.find_one(
        {"user_id": user_id, "streamer_id": streamer_id, "active": True}, {"_id": 0},
    )
    return {"following": bool(doc)}


async def _streamer_display_name(streamer_id: str) -> str:
    """Pick the prettiest name we have for the live banner."""
    user = await _db.users.find_one(
        {"user_id": streamer_id},
        {"_id": 0, "display_name": 1, "name": 1, "username": 1},
    )
    return (
        (user or {}).get("display_name")
        or (user or {}).get("name")
        or (user or {}).get("username")
        or "A creator"
    )


async def notify_followers_of_live_stream(streamer_id: str) -> Dict[str, Any]:
    """Fan-out 🔴 LIVE push notification to every follower of `streamer_id`.

    Idempotency: writes `last_live_notif_at` on the cf_live_inputs row.
    If that timestamp is within LIVE_NOTIF_COOLDOWN_HOURS, returns a
    no-op. Stops the CF webhook from spamming phones if it retries
    the `connected` event during a brief reconnection burst.
    """
    # Cooldown — re-arm every 6 hours.
    input_doc = await _db.cf_live_inputs.find_one(
        {"streamer_id": streamer_id}, {"_id": 0, "last_live_notif_at": 1},
    )
    if input_doc and input_doc.get("last_live_notif_at"):
        try:
            last = datetime.fromisoformat(input_doc["last_live_notif_at"])
            if datetime.now(timezone.utc) - last < timedelta(hours=LIVE_NOTIF_COOLDOWN_HOURS):
                return {"sent": 0, "reason": "cooldown_active"}
        except ValueError:
            pass

    # Atomic flip — set the cooldown FIRST so concurrent webhook calls
    # short-circuit on the cooldown check above.
    await _db.cf_live_inputs.update_one(
        {"streamer_id": streamer_id},
        {"$set": {"last_live_notif_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )

    # Get all active followers.
    follows_cursor = _db.streamer_follows.find(
        {"streamer_id": streamer_id, "active": True}, {"_id": 0, "user_id": 1},
    )
    follower_rows = await follows_cursor.to_list(50_000)
    follower_ids = [r["user_id"] for r in follower_rows]
    if not follower_ids:
        return {"sent": 0, "reason": "no_followers"}

    # Pull every active FCM token across all followers.
    tokens_cursor = _db.fcm_tokens.find(
        {"user_id": {"$in": follower_ids}, "active": True},
        {"_id": 0, "token": 1, "user_id": 1},
    )
    token_rows = await tokens_cursor.to_list(100_000)
    tokens = [t["token"] for t in token_rows]
    if not tokens:
        return {"sent": 0, "reason": "no_active_devices"}

    display_name = await _streamer_display_name(streamer_id)
    title = f"🔴 {display_name} is LIVE"
    body = "Tap to watch the stream — first 50 viewers get bonus ₵100"
    data = {"type": "stream_live", "streamer_id": streamer_id, "url": f"/streams/watch/{streamer_id}"}

    # Send. We import firebase from the notifications module so the
    # admin SDK is initialized exactly once (the notifications.py
    # module does the init guard).
    try:
        from routes.notifications import FIREBASE_ADMIN_INITIALIZED  # noqa: PLC0415
        if not FIREBASE_ADMIN_INITIALIZED:
            return {"sent": 0, "reason": "firebase_admin_not_initialized"}
        from firebase_admin import messaging  # noqa: PLC0415
    except Exception as e:
        logger.warning("FCM unavailable, skipping live notif: %s", e)
        return {"sent": 0, "reason": "firebase_unavailable", "error": str(e)}

    msg = messaging.MulticastMessage(
        notification=messaging.Notification(title=title, body=body),
        data=data,
        tokens=tokens,
    )
    try:
        resp = messaging.send_each_for_multicast(msg)
    except Exception as e:
        logger.error("send_each_for_multicast failed: %s", e)
        return {"sent": 0, "reason": "fcm_send_error", "error": str(e)}

    # Garbage-collect dead tokens.
    if resp.failure_count > 0:
        dead = [tokens[i] for i, r in enumerate(resp.responses) if not r.success]
        if dead:
            await _db.fcm_tokens.update_many(
                {"token": {"$in": dead}}, {"$set": {"active": False}},
            )

    logger.info(
        "Live notif fan-out streamer=%s followers=%d tokens=%d ok=%d fail=%d",
        streamer_id, len(follower_ids), len(tokens), resp.success_count, resp.failure_count,
    )
    return {
        "sent": resp.success_count,
        "failed": resp.failure_count,
        "follower_count": len(follower_ids),
        "tokens_attempted": len(tokens),
    }


@router.post("/notify-live/{streamer_id}")
async def notify_live_endpoint(streamer_id: str) -> Dict[str, Any]:
    """Ops/admin one-shot trigger to fan-out a live notif. The real
    automated trigger is the Cloudflare webhook."""
    return await notify_followers_of_live_stream(streamer_id)

"""
Vibe Drive routes.

  GET  /api/vibe-drive/status     → tick + return verbose state (safe on every page visit)
  GET  /api/vibe-drive/history    → last N vibe-drive ledger entries
  GET  /api/vibe-drive/playlists  → curated Spotify playlist URIs that count
"""
from fastapi import APIRouter, HTTPException, Request
from typing import Any, Dict

from utils.database import get_database
from services.vibe_drive_service import (
    tick,
    recent_sessions,
    CURATED_PLAYLIST_URIS,
    MILES_PER_VIBEZ,
    DAILY_VIBEZ_CAP,
)

router = APIRouter(prefix="/vibe-drive", tags=["vibe-drive"])


async def _resolve_user_id(request: Request) -> str:
    db = get_database()
    # Cookie path (browser SPA)
    session_token = request.cookies.get("session_token")
    # Authorization: Bearer ... fallback (curl, demo-login flow,
    # server-to-server). Same root-cause fix as
    # utils/auth_dependencies.py (Feb 2026 — auth audit pass).
    if not session_token:
        auth_header = request.headers.get("Authorization") or request.headers.get("authorization") or ""
        if auth_header.lower().startswith("bearer "):
            session_token = auth_header.split(" ", 1)[1].strip() or None
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


@router.get("/playlists")
async def playlists() -> Dict[str, Any]:
    return {
        "playlists": sorted(list(CURATED_PLAYLIST_URIS)),
        "miles_per_vibez": MILES_PER_VIBEZ,
        "daily_cap": DAILY_VIBEZ_CAP,
    }


@router.get("/status")
async def status(request: Request) -> Dict[str, Any]:
    user_id = await _resolve_user_id(request)
    return await tick(get_database(), user_id)


@router.get("/history")
async def history(request: Request, limit: int = 20) -> Dict[str, Any]:
    user_id = await _resolve_user_id(request)
    return await recent_sessions(get_database(), user_id, limit=limit)


# ─────────────────────────────────────────────── Vote-Skip (P2 ladder)
#
# Master Plan v4 + Spotify ladder follow-up (2026-02-06).
#
# Passenger + driver are riding together; either can ask to skip the
# track once per ride. A skip becomes effective when the # of distinct
# voters >= ceil((ride.passenger_count + 1) / 2)  (i.e. simple majority
# including the driver). Per ride a single user can vote-skip at most
# once on a given track URI to prevent spam.
#
# Stored in `vibe_drive_skip_votes` so we have an audit trail. Skip
# *execution* (calling Spotify Connect to skip-next) is kicked from the
# driver's session via the existing `play_track` /
# `next_track` helper — see services/spotify_service.

VoteSkipPayload = Dict[str, Any]


@router.post("/vote-skip")
async def vote_skip(payload: Dict[str, Any], request: Request) -> Dict[str, Any]:
    """Cast a vote to skip the current track in the ride. Idempotent
    per (ride_id, user_id, track_uri)."""
    from datetime import datetime, timezone  # noqa: PLC0415
    user_id = await _resolve_user_id(request)
    ride_id = (payload.get("ride_id") or "").strip()
    track_uri = (payload.get("track_uri") or "").strip()
    if not ride_id or not track_uri:
        raise HTTPException(400, "ride_id and track_uri are required")

    db = get_database()
    # Voter roster — driver + every passenger on the ride row (if it
    # exists in MongoDB). For demo riders without a real `rides` row,
    # fall back to assuming a 2-seat ride (1 driver + 1 passenger).
    ride_row = await db.rides.find_one({"ride_id": ride_id}, {"_id": 0})
    voters = 2
    if ride_row:
        voters = max(2, int(ride_row.get("passenger_count", 1)) + 1)

    threshold = (voters // 2) + 1  # simple majority

    # Upsert one vote per (ride, user, track).
    await db.vibe_drive_skip_votes.update_one(
        {"ride_id": ride_id, "user_id": user_id, "track_uri": track_uri},
        {
            "$set": {
                "ride_id": ride_id,
                "user_id": user_id,
                "track_uri": track_uri,
                "voted_at": datetime.now(timezone.utc).isoformat(),
            }
        },
        upsert=True,
    )

    votes = await db.vibe_drive_skip_votes.count_documents(
        {"ride_id": ride_id, "track_uri": track_uri}
    )

    skipped = votes >= threshold
    if skipped:
        # Mark the track as skipped so further votes are no-ops.
        await db.vibe_drive_skip_history.update_one(
            {"ride_id": ride_id, "track_uri": track_uri},
            {
                "$setOnInsert": {
                    "ride_id": ride_id,
                    "track_uri": track_uri,
                    "skipped_at": datetime.now(timezone.utc).isoformat(),
                    "votes": votes,
                    "voters_required": threshold,
                }
            },
            upsert=True,
        )

    return {
        "success": True,
        "ride_id": ride_id,
        "track_uri": track_uri,
        "votes": votes,
        "threshold": threshold,
        "skipped": skipped,
    }


# ─────────────────────────────────────────────── Auto-DJ (P1 ladder)
#
# Spotify ladder step 2 (2026-02-06): when a ride starts, seed a
# recommendation set from the rider's last-5 played + the driver's
# preferred vibe genres → push as the auto-queue for the cabin.
#
# `POST /api/vibe-drive/auto-dj/seed`  → records the seed mix in Mongo
# `GET  /api/vibe-drive/auto-dj/queue/{ride_id}` → returns the queued tracks


class AutoDjSeedPayload(Dict[str, Any]):
    pass


_FALLBACK_GENRES = ["hip-hop", "r-n-b", "pop", "afrobeat", "edm"]


@router.post("/auto-dj/seed")
async def auto_dj_seed(payload: Dict[str, Any], request: Request) -> Dict[str, Any]:
    """Build an Auto-DJ queue for a ride.

    Inputs:
      ride_id (str)
      driver_user_id (str, optional — defaults to the caller)
      passenger_user_id (str, optional)
      driver_genres (list[str], optional — bypasses driver Spotify seed)
      limit (int, default 20)
    """
    from datetime import datetime, timezone  # noqa: PLC0415
    from services.spotify_service import recently_played, recommendations  # noqa: PLC0415

    caller_user_id = await _resolve_user_id(request)
    db = get_database()

    ride_id = (payload.get("ride_id") or "").strip()
    if not ride_id:
        raise HTTPException(400, "ride_id required")

    driver_user_id = (payload.get("driver_user_id") or caller_user_id).strip()
    passenger_user_id = (payload.get("passenger_user_id") or caller_user_id).strip()
    limit = int(payload.get("limit") or 20)
    driver_genres = payload.get("driver_genres")
    if not isinstance(driver_genres, list) or not driver_genres:
        driver_genres = _FALLBACK_GENRES[:3]
    driver_genres = [str(g).strip().lower() for g in driver_genres[:3] if str(g).strip()]

    rider_played = await recently_played(db, passenger_user_id, limit=5)
    seed_tracks = [t["id"] for t in (rider_played.get("tracks") or []) if t.get("id")][:3]
    seed_artists: list = []
    for t in (rider_played.get("tracks") or [])[:3]:
        for aid in t.get("artist_ids") or []:
            if aid and aid not in seed_artists:
                seed_artists.append(aid)
        if len(seed_artists) >= 2:
            break

    rec = await recommendations(
        db,
        driver_user_id,
        seed_tracks=seed_tracks,
        seed_artists=seed_artists,
        seed_genres=driver_genres,
        limit=limit,
    )

    queue = rec.get("tracks") or []
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.vibe_drive_auto_dj.update_one(
        {"ride_id": ride_id},
        {
            "$set": {
                "ride_id": ride_id,
                "driver_user_id": driver_user_id,
                "passenger_user_id": passenger_user_id,
                "seeded_with": {
                    "tracks": seed_tracks,
                    "artists": seed_artists,
                    "genres": driver_genres,
                },
                "queue": queue,
                "updated_at": now_iso,
            }
        },
        upsert=True,
    )

    return {
        "success": True,
        "ride_id": ride_id,
        "queue_len": len(queue),
        "queue": queue,
        "seed": {
            "rider_recent_count": len(rider_played.get("tracks") or []),
            "seed_track_ids": seed_tracks,
            "seed_artist_ids": seed_artists,
            "driver_genres": driver_genres,
        },
        "spotify_connected": bool(rec.get("connected")),
    }


@router.get("/auto-dj/queue/{ride_id}")
async def auto_dj_queue(ride_id: str, request: Request) -> Dict[str, Any]:
    """Read the current Auto-DJ queue for a ride (idempotent, safe to poll)."""
    await _resolve_user_id(request)
    db = get_database()
    doc = await db.vibe_drive_auto_dj.find_one({"ride_id": ride_id}, {"_id": 0})
    if not doc:
        return {"ride_id": ride_id, "queue": [], "seeded": False}
    return {**doc, "seeded": True}


# ─────────────────────────────────────────────── Tip-to-Skip / Tip-to-Add
#
# Spotify ladder step 3 (2026-02-06): a passenger can pay ₵ to either
# instantly skip the current track (TIP_SKIP_COST) or add a chosen
# track to the queue (TIP_ADD_COST). Sovereign Tax (13.5%) per v9 PDF
# is applied via `services/sovereign_engine.process_transaction` and
# the post-tax payout is split: 70% to the driver (matches RIDE_SPLIT)
# and the rest stays in the treasury vault.

TIP_SKIP_COST = 100   # ₵ Vibez Coins
TIP_ADD_COST = 50     # ₵ Vibez Coins


async def _debit_user_credits(db, user_id: str, amount: int) -> int:
    """Debit ₵ from the user's funded wallet field. Uses value-based
    selection via `utils.wallet_fields.pick_wallet_field_for_debit`, so
    legacy demo accounts (credits_balance) and modern DSG accounts
    (token_balance) both work without duplicated logic.
    Returns the new balance. Raises 402 if insufficient."""
    from utils.wallet_fields import pick_wallet_field_for_debit  # noqa: PLC0415
    u = await db.users.find_one(
        {"user_id": user_id},
        {"_id": 0, "token_balance": 1, "credits_balance": 1},
    ) or {}
    try:
        field, balance = pick_wallet_field_for_debit(u, amount)
    except ValueError as exc:
        max_bal = str(exc).split(":", 1)[1]
        raise HTTPException(402, f"Insufficient ₵ balance ({max_bal} < {amount})")
    await db.users.update_one({"user_id": user_id}, {"$inc": {field: -amount}})
    return balance - amount


async def _credit_user_credits(db, user_id: str, amount: int) -> None:
    """Credit ₵ to the user's preferred wallet field (higher balance,
    tie-breaks to token_balance). Idempotency is caller-controlled."""
    from utils.wallet_fields import pick_wallet_field_for_credit  # noqa: PLC0415
    u = await db.users.find_one(
        {"user_id": user_id},
        {"_id": 0, "token_balance": 1, "credits_balance": 1},
    ) or {}
    field = pick_wallet_field_for_credit(u)
    await db.users.update_one(
        {"user_id": user_id},
        {"$inc": {field: int(amount)}},
        upsert=False,
    )


@router.post("/tip-skip")
async def tip_skip(payload: Dict[str, Any], request: Request) -> Dict[str, Any]:
    """Instant skip — passenger pays TIP_SKIP_COST ₵, sovereign tax
    applied, post-tax 70% to driver, then `next_track()` fires on the
    driver's Spotify session."""
    from datetime import datetime, timezone  # noqa: PLC0415
    from services.sovereign_engine import process_transaction, RIDE_SPLIT  # noqa: PLC0415
    from services.spotify_service import next_track  # noqa: PLC0415

    user_id = await _resolve_user_id(request)
    db = get_database()
    ride_id = (payload.get("ride_id") or "").strip()
    driver_user_id = (payload.get("driver_user_id") or "").strip()
    if not ride_id or not driver_user_id:
        raise HTTPException(400, "ride_id and driver_user_id required")

    new_bal = await _debit_user_credits(db, user_id, TIP_SKIP_COST)
    tx = await process_transaction(
        db,
        user_id=user_id,
        amount=TIP_SKIP_COST,
        tx_type="VIBE_DRIVE_TIP",
        metadata={"ride_id": ride_id, "kind": "tip_skip"},
    )
    driver_credit = int(round(tx["payout"] * RIDE_SPLIT))
    if driver_credit > 0:
        await _credit_user_credits(db, driver_user_id, driver_credit)

    skip_result: Dict[str, Any] = {"status": "no-spotify"}
    try:
        skip_result = await next_track(db, driver_user_id)
    except Exception as exc:  # noqa: BLE001
        skip_result = {"status": "error", "error": str(exc)}

    await db.vibe_drive_tip_events.insert_one({
        "ride_id": ride_id,
        "kind": "tip_skip",
        "from_user_id": user_id,
        "to_driver_id": driver_user_id,
        "cost": TIP_SKIP_COST,
        "tax": tx["tax"],
        "driver_credit": driver_credit,
        "spotify_result": skip_result.get("status"),
        "ts": datetime.now(timezone.utc).isoformat(),
    })
    return {
        "success": True,
        "kind": "tip_skip",
        "cost": TIP_SKIP_COST,
        "tax": tx["tax"],
        "driver_credit": driver_credit,
        "new_balance": new_bal,
        "spotify": skip_result,
    }


@router.post("/tip-add")
async def tip_add(payload: Dict[str, Any], request: Request) -> Dict[str, Any]:
    """Tip-to-Add — passenger pays TIP_ADD_COST ₵, sovereign tax,
    70% post-tax to driver, then enqueue the chosen track on the
    driver's Spotify session (no skip)."""
    from datetime import datetime, timezone  # noqa: PLC0415
    from services.sovereign_engine import process_transaction, RIDE_SPLIT  # noqa: PLC0415
    from services.spotify_service import queue_track  # noqa: PLC0415

    user_id = await _resolve_user_id(request)
    db = get_database()
    ride_id = (payload.get("ride_id") or "").strip()
    driver_user_id = (payload.get("driver_user_id") or "").strip()
    track_uri = (payload.get("track_uri") or "").strip()
    if not ride_id or not driver_user_id or not track_uri:
        raise HTTPException(400, "ride_id, driver_user_id, track_uri required")

    new_bal = await _debit_user_credits(db, user_id, TIP_ADD_COST)
    tx = await process_transaction(
        db,
        user_id=user_id,
        amount=TIP_ADD_COST,
        tx_type="VIBE_DRIVE_TIP",
        metadata={"ride_id": ride_id, "kind": "tip_add", "track_uri": track_uri},
    )
    driver_credit = int(round(tx["payout"] * RIDE_SPLIT))
    if driver_credit > 0:
        await _credit_user_credits(db, driver_user_id, driver_credit)

    queue_result: Dict[str, Any] = {"status": "no-spotify"}
    try:
        queue_result = await queue_track(db, driver_user_id, track_uri)
    except Exception as exc:  # noqa: BLE001
        queue_result = {"status": "error", "error": str(exc)}

    await db.vibe_drive_tip_events.insert_one({
        "ride_id": ride_id,
        "kind": "tip_add",
        "from_user_id": user_id,
        "to_driver_id": driver_user_id,
        "track_uri": track_uri,
        "cost": TIP_ADD_COST,
        "tax": tx["tax"],
        "driver_credit": driver_credit,
        "spotify_result": queue_result.get("status"),
        "ts": datetime.now(timezone.utc).isoformat(),
    })
    return {
        "success": True,
        "kind": "tip_add",
        "cost": TIP_ADD_COST,
        "tax": tx["tax"],
        "driver_credit": driver_credit,
        "new_balance": new_bal,
        "spotify": queue_result,
    }


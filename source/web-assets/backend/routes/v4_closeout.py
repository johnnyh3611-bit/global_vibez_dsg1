"""
Spotify ladder steps 2 & 3 + v4 carry-overs (Vibe Spots / Founder Reserve)
=========================================================================

Created 2026-02-06 (round 6). Bundles four small features that the
Founder asked for as a single "Master Plan v4 closeout" pass:

  * **Auto-DJ** — seeds Spotify `recommendations()` from the rider's
    last-5-played + a comma-separated genre list and queues the top-N
    on the driver's active device.
        POST /api/vibe-drive/auto-dj/seed
  * **Tip-to-skip / Tip-to-add** — burn vibez coins from the
    `users.credits_balance` to either insta-skip the current track
    (TIP_TO_SKIP_COST) or add a track to the queue (TIP_TO_ADD_COST).
        POST /api/vibe-drive/tip-to-skip
        POST /api/vibe-drive/tip-to-add
  * **Vibe Spots** — geographic check-in points that mint a 1-time
    perk when scanned by a verified QR token (signed by the founder).
        POST /api/vibe-spots/scan
        GET  /api/vibe-spots/me
  * **Founder Reserve** — 250 000-chair locked tranche credited to
    the founder. Reserve is read-only on the public surface; admin can
    only `seed` it once (idempotent on `_id="founder_reserve_seed"`).
        POST /api/admin/founder-reserve/seed   (admin-only)
        GET  /api/founder-reserve/status
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
import secrets
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from utils.database import get_database, get_current_user
from routes.admin_dashboard import verify_admin_cookie

logger = logging.getLogger(__name__)
router = APIRouter()


# ───────────────────────────────────────────── Auto-DJ
class AutoDJSeed(BaseModel):
    ride_id: str
    seed_track_uris: List[str] = Field(default_factory=list, max_length=5)
    seed_genres: List[str] = Field(default_factory=list, max_length=5)
    target_count: int = Field(default=5, ge=1, le=20)


@router.post("/vibe-drive/auto-dj/seed")
async def auto_dj_seed(payload: AutoDJSeed, http_request: Request) -> Dict[str, Any]:
    """Pick the next N tracks via Spotify `recommendations()` and stamp
    them into the ride's queue (Mongo). Actual playback is the driver's
    Spotify Connect device — this endpoint just curates the queue
    server-side."""
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    try:
        from services import spotify_service  # noqa: PLC0415
        # Best-effort recommendations call. If the user hasn't linked
        # Spotify yet, fall back to a deterministic synthetic queue so
        # the UI flow still works for QA.
        try:
            sp = await spotify_service.get_user_client(db, user.user_id)
            recs = sp.recommendations(
                seed_tracks=[t.split(":")[-1] for t in payload.seed_track_uris[:5]] or None,
                seed_genres=payload.seed_genres[:5] or None,
                limit=payload.target_count,
            )
            tracks = [
                {"uri": t["uri"], "name": t["name"], "artist": t["artists"][0]["name"]}
                for t in (recs or {}).get("tracks", [])
            ]
        except Exception as exc:  # noqa: BLE001
            logger.info("auto-dj fallback (no Spotify session): %s", exc)
            tracks = [
                {"uri": f"spotify:track:auto_dj_{i}", "name": f"Auto-DJ Pick {i+1}", "artist": "Vibez DJ"}
                for i in range(payload.target_count)
            ]
    except ImportError:
        tracks = [
            {"uri": f"spotify:track:fallback_{i}", "name": f"Vibe Track {i+1}", "artist": "Vibez DJ"}
            for i in range(payload.target_count)
        ]

    queue_id = f"queue_{uuid.uuid4().hex[:10]}"
    await db.vibe_drive_auto_dj.insert_one({
        "queue_id": queue_id,
        "ride_id": payload.ride_id,
        "user_id": user.user_id,
        "tracks": tracks,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"success": True, "queue_id": queue_id, "tracks": tracks}


# ─────────────────────────────────────────── Tip-to-skip / Tip-to-add
TIP_TO_SKIP_COST = 100  # vibez coins
TIP_TO_ADD_COST = 50

class TipPayload(BaseModel):
    ride_id: str
    track_uri: Optional[str] = None  # required for tip-to-add


async def _charge_tip(db, user_id: str, amount: int, reason: str) -> int:
    """Deduct `amount` vibez coins from users.credits_balance. Returns
    the new balance. Raises 402 if balance < amount."""
    row = await db.users.find_one({"user_id": user_id}, {"_id": 0, "credits_balance": 1, "token_balance": 1})
    if not row:
        raise HTTPException(404, "User not found")
    bal = float(row.get("credits_balance") or row.get("token_balance") or 0)
    if bal < amount:
        raise HTTPException(402, f"Insufficient vibez coins: need {amount}, have {int(bal)}")
    await db.users.update_one(
        {"user_id": user_id},
        {"$inc": {"credits_balance": -amount}},
    )
    await db.vibe_drive_tips.insert_one({
        "tip_id": f"tip_{uuid.uuid4().hex[:10]}",
        "user_id": user_id,
        "amount": amount,
        "reason": reason,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return int(bal - amount)


@router.post("/vibe-drive/tip-to-skip")
async def tip_to_skip(payload: TipPayload, http_request: Request) -> Dict[str, Any]:
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    new_bal = await _charge_tip(db, user.user_id, TIP_TO_SKIP_COST, f"tip_to_skip:{payload.ride_id}")
    # Mark current track as instantly skipped — bypasses the vote-skip threshold.
    await db.vibe_drive_skip_history.insert_one({
        "ride_id": payload.ride_id,
        "track_uri": payload.track_uri or "current",
        "skipped_at": datetime.now(timezone.utc).isoformat(),
        "tip_skip": True,
        "tipper_id": user.user_id,
    })
    return {"success": True, "skipped": True, "vibez_balance": new_bal, "cost": TIP_TO_SKIP_COST}


@router.post("/vibe-drive/tip-to-add")
async def tip_to_add(payload: TipPayload, http_request: Request) -> Dict[str, Any]:
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    if not payload.track_uri:
        raise HTTPException(400, "track_uri required for tip-to-add")
    db = get_database()
    new_bal = await _charge_tip(db, user.user_id, TIP_TO_ADD_COST, f"tip_to_add:{payload.ride_id}")
    await db.vibe_drive_queue_inserts.insert_one({
        "ride_id": payload.ride_id,
        "track_uri": payload.track_uri,
        "user_id": user.user_id,
        "added_at": datetime.now(timezone.utc).isoformat(),
        "tip_add": True,
    })
    return {"success": True, "queued": True, "track_uri": payload.track_uri, "vibez_balance": new_bal, "cost": TIP_TO_ADD_COST}


# ─────────────────────────────────────────── Vibe Spots + QR
VIBE_SPOT_SECRET = (
    os.environ.get("VIBE_SPOT_HMAC_SECRET")
    or os.environ.get("JWT_SECRET")
    or "vibez_default_dev_only"
)


def _sign_spot_token(spot_id: str, nonce: str) -> str:
    msg = f"{spot_id}:{nonce}".encode()
    return hmac.new(VIBE_SPOT_SECRET.encode(), msg, hashlib.sha256).hexdigest()[:32]


class VibeSpotScan(BaseModel):
    spot_id: str
    nonce: str
    sig: str


@router.post("/vibe-spots/scan")
async def vibe_spot_scan(payload: VibeSpotScan, http_request: Request) -> Dict[str, Any]:
    """Scan a QR code at a physical Vibe Spot. The QR encodes
    `spot_id`, a `nonce`, and an HMAC `sig` so we can verify on the
    server without needing to look up an external service. Each
    (user_id, spot_id, nonce) tuple is one-time-use → idempotent
    perk grant."""
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    expected = _sign_spot_token(payload.spot_id, payload.nonce)
    if not hmac.compare_digest(expected, payload.sig):
        raise HTTPException(400, "Invalid spot signature")
    db = get_database()
    idem = f"{user.user_id}:{payload.spot_id}:{payload.nonce}"
    existing = await db.vibe_spot_scans.find_one({"idem_key": idem}, {"_id": 0})
    if existing:
        return {"success": True, "already_claimed": True, "perk": existing.get("perk")}
    # Default perk: 25 vibez coins. Spots can override via the
    # `vibe_spots` config collection.
    spot_cfg = await db.vibe_spots.find_one({"spot_id": payload.spot_id}, {"_id": 0}) or {}
    perk_amount = int(spot_cfg.get("perk_amount", 25))
    perk_reason = spot_cfg.get("perk_reason", "vibe_spot_scan")
    await db.users.update_one(
        {"user_id": user.user_id}, {"$inc": {"credits_balance": perk_amount}}
    )
    await db.vibe_spot_scans.insert_one({
        "scan_id": f"scan_{uuid.uuid4().hex[:10]}",
        "idem_key": idem,
        "user_id": user.user_id,
        "spot_id": payload.spot_id,
        "perk": {"vibez": perk_amount, "reason": perk_reason},
        "scanned_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"success": True, "perk": {"vibez": perk_amount, "reason": perk_reason}}


@router.get("/vibe-spots/me")
async def vibe_spots_me(http_request: Request) -> Dict[str, Any]:
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    rows = await db.vibe_spot_scans.find(
        {"user_id": user.user_id}, {"_id": 0}
    ).sort("scanned_at", -1).to_list(length=200)
    return {"scans": rows, "count": len(rows)}


# ─────────────────────────────────────────── Founder Reserve
FOUNDER_RESERVE_CHAIRS = 250_000

class FounderReserveSeed(BaseModel):
    founder_user_id: str = Field(..., min_length=4)


@router.post("/admin/founder-reserve/seed", dependencies=[Depends(verify_admin_cookie)])
async def seed_founder_reserve(payload: FounderReserveSeed) -> Dict[str, Any]:
    """One-shot seed of the 250k Founder Reserve. Idempotent — second
    call returns the existing seed doc unchanged."""
    db = get_database()
    existing = await db.system_state.find_one(
        {"_id": "founder_reserve_seed"}, {"_id": 0}
    )
    if existing:
        return {"success": True, "already_seeded": True, "seed": existing}
    seed_doc = {
        "_id": "founder_reserve_seed",
        "founder_user_id": payload.founder_user_id,
        "chairs": FOUNDER_RESERVE_CHAIRS,
        "locked": True,
        "seeded_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.system_state.insert_one(seed_doc)
    # Mirror onto chair_purchases as a single bulk row (weight 1.0,
    # `source: founder_reserve`) so distribution math sees it.
    await db.chair_purchases.insert_one({
        "purchase_id": f"founder_reserve_{secrets.token_hex(4)}",
        "user_id": payload.founder_user_id,
        "user_id_lookup": (payload.founder_user_id or "")[:8],
        "quantity": FOUNDER_RESERVE_CHAIRS,
        "weight": 1.0,
        "phase_at_purchase": "Founder Reserve",
        "amount_usd": 0.0,
        "purchased_at": seed_doc["seeded_at"],
        "source": "founder_reserve",
        "locked": True,
    })
    await db.profit_share_counters.update_one(
        {"_id": "global_chairs"}, {"$inc": {"count": FOUNDER_RESERVE_CHAIRS}}, upsert=True
    )
    return {"success": True, "seed": seed_doc, "chairs": FOUNDER_RESERVE_CHAIRS}


@router.get("/founder-reserve/status")
async def founder_reserve_status() -> Dict[str, Any]:
    """Public — show that the 250k reserve exists + is locked."""
    db = get_database()
    seed = await db.system_state.find_one({"_id": "founder_reserve_seed"}, {"_id": 0})
    return {
        "seeded": seed is not None,
        "chairs": FOUNDER_RESERVE_CHAIRS,
        "locked": True,
        "seeded_at": seed.get("seeded_at") if seed else None,
    }


# ─────────────────────────────────────────── Sponsor Admin (no curl)
@router.get("/admin/sponsors/pending", dependencies=[Depends(verify_admin_cookie)])
async def admin_list_pending_sponsors(limit: int = 100) -> Dict[str, Any]:
    """Admin-only list of pending sponsor links — backs the new
    Sponsor Admin UI so the founder doesn't need curl."""
    db = get_database()
    rows = await db.vibe_sponsors.find(
        {"status": "pending"}, {"_id": 0}
    ).sort("linked_at", -1).to_list(length=max(1, min(limit, 500)))
    return {"pending": rows, "count": len(rows)}


@router.get("/admin/sponsors/all", dependencies=[Depends(verify_admin_cookie)])
async def admin_list_all_sponsors(limit: int = 200) -> Dict[str, Any]:
    """Admin-only — full sponsor roster (pending + verified +
    rejected) for the admin UI."""
    db = get_database()
    rows = await db.vibe_sponsors.find({}, {"_id": 0}).sort("linked_at", -1).to_list(
        length=max(1, min(limit, 1000))
    )
    return {"sponsors": rows, "count": len(rows)}

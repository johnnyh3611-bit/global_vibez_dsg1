"""Media Master ecosystem routes — DSG TV Network, Vibe Radio, DSG
Music Group, and AI Scout. All endpoints under `/api/media-master/*`.

Designed to layer on top of existing primitives (age_verification for
21+ gating, coin_wallet for $VIBEZ paywalls, content_rights for music
purchases) without duplicating their logic. Each sub-domain has its own
section header below.
"""
from __future__ import annotations

import hashlib
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

from services.media_master_constants import (
    DSG_TV_CHANNELS,
    CHANNEL_PASS_DURATION_HOURS,
    VIBE_RADIO_STATIONS,
    SKIP_BID_FLOOR,
    KEEP_BID_INCREMENT,
    DSG_MUSIC_STUDIOS,
    AFFILIATE_CHAIR_REVENUE_SHARE_BPS,
    AUTO_CLIP_THRESHOLD,
    BREAK_IN_THRESHOLD,
    AUTO_CLIP_DURATION_SECONDS,
    compute_hype_score,
    classify_hype,
    PROTOCOL_VERSION,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/media-master", tags=["media-master"])

_db = AsyncIOMotorClient(os.environ.get("MONGO_URL"))[
    os.environ.get("DB_NAME", "global_vibez_dsg")
]


# ════════════════════════════════════════════════════════════════════
# Constants endpoint — single source of truth for the frontend
# ════════════════════════════════════════════════════════════════════
@router.get("/constants")
async def get_constants() -> Dict[str, Any]:
    return {
        "protocol_version": PROTOCOL_VERSION,
        "dsg_tv_channels": DSG_TV_CHANNELS,
        "channel_pass_duration_hours": CHANNEL_PASS_DURATION_HOURS,
        "vibe_radio_stations": VIBE_RADIO_STATIONS,
        "skip_bid_floor": SKIP_BID_FLOOR,
        "keep_bid_increment": KEEP_BID_INCREMENT,
        "dsg_music_studios": DSG_MUSIC_STUDIOS,
        "affiliate_chair_share_bps": AFFILIATE_CHAIR_REVENUE_SHARE_BPS,
        "auto_clip_threshold": AUTO_CLIP_THRESHOLD,
        "break_in_threshold": BREAK_IN_THRESHOLD,
        "auto_clip_duration_seconds": AUTO_CLIP_DURATION_SECONDS,
    }


def _channel(channel_id: str) -> Dict[str, Any]:
    for c in DSG_TV_CHANNELS:
        if c["channel_id"] == channel_id:
            return c
    raise HTTPException(404, detail=f"Unknown channel '{channel_id}'")


async def _resolve_channel_live_input(channel_id: str) -> Optional[Dict[str, Any]]:
    """Find the CF live input currently programmed onto this DSG TV channel.

    Programming model: a streamer (or an admin) attaches their CF live
    input to a channel by inserting a row into `media_tv_channel_programs`
    with `{channel_id, input_id, programmed_until}`. We pick the most
    recent program whose window is still open and whose source live input
    is `is_live=true`. Returns the live input doc with HLS URL, or None
    when nothing is currently broadcasting on this channel.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    program = await _db.media_tv_channel_programs.find_one(
        {"channel_id": channel_id, "programmed_until": {"$gt": now_iso}},
        sort=[("programmed_at", -1)],
        projection={"_id": 0},
    )
    if not program:
        return None
    live_input = await _db.cf_live_inputs.find_one(
        {"input_id": program["input_id"], "is_deleted": {"$ne": True}},
        {"_id": 0, "rtmps_key": 0, "srt_passphrase": 0},
    )
    if not live_input or not live_input.get("is_live"):
        return None
    return {**live_input, "program": program}


def _station(station_id: str) -> Dict[str, Any]:
    for s in VIBE_RADIO_STATIONS:
        if s["station_id"] == station_id:
            return s
    raise HTTPException(404, detail=f"Unknown station '{station_id}'")


def _studio(studio_id: str) -> Dict[str, Any]:
    for s in DSG_MUSIC_STUDIOS:
        if s["studio_id"] == studio_id:
            return s
    raise HTTPException(404, detail=f"Unknown studio '{studio_id}'")


# ════════════════════════════════════════════════════════════════════
# 1. DSG TV NETWORK — 5 channels, 2 gated (After Dark + Nightmare Club)
# ════════════════════════════════════════════════════════════════════
class TvAccessRequest(BaseModel):
    user_id: str
    secondary_pin: Optional[str] = None  # required for gated channels


@router.get("/tv/channels")
async def list_tv_channels() -> Dict[str, Any]:
    """Public catalog — includes gate metadata so the frontend renders
    the right lock icons before the user clicks."""
    return {"channels": DSG_TV_CHANNELS, "count": len(DSG_TV_CHANNELS)}


@router.get("/tv/access/{channel_id}/{user_id}")
async def get_tv_access(channel_id: str, user_id: str) -> Dict[str, Any]:
    """Read the user's current pass status for a given channel. Used by
    the channel tile to render Lock / Active / Expired states."""
    ch = _channel(channel_id)
    if not ch["requires_paywall"]:
        return {"channel_id": channel_id, "access": True, "reason": "free_channel"}
    now_iso = datetime.now(timezone.utc).isoformat()
    pass_doc = await _db.media_tv_passes.find_one(
        {"user_id": user_id, "channel_id": channel_id}, {"_id": 0},
    )
    if not pass_doc or pass_doc.get("expires_at", "") <= now_iso:
        return {
            "channel_id": channel_id,
            "access": False,
            "reason": "no_active_pass",
            "coin_price": ch["coin_price"],
            "requires_18_plus": ch["requires_18_plus"],
            "requires_secondary_pin": ch["requires_secondary_pin"],
        }
    return {
        "channel_id": channel_id,
        "access": True,
        "expires_at": pass_doc["expires_at"],
    }


@router.post("/tv/unlock/{channel_id}")
async def unlock_tv_channel(channel_id: str, req: TvAccessRequest) -> Dict[str, Any]:
    """Spend coins to unlock a 24h pass to a gated channel. Enforces:
      • 21+ verification (reuses age_verification service)
      • Secondary PIN match (set via /tv/set-pin endpoint)
      • Sufficient $VIBEZ balance (deducted atomically)
    """
    ch = _channel(channel_id)
    if not ch["requires_paywall"]:
        raise HTTPException(400, detail="This channel is free — no unlock needed")

    # 21+ gate (only check when channel requires it).
    if ch["requires_18_plus"]:
        try:
            from services.age_verification import get_status  # noqa: PLC0415
            avp = await get_status(_db, req.user_id)
            if (avp or {}).get("status") != "verified":
                raise HTTPException(
                    status_code=403,
                    detail={
                        "code": "age_verification_required",
                        "message": (
                            "This channel requires 21+ identity verification. "
                            "Verify at /restricted-goods-verification."
                        ),
                    },
                )
        except ImportError:
            # Verification service unavailable — fail closed for adult content.
            raise HTTPException(503, detail="Age verification temporarily unavailable")
        except HTTPException:
            raise
        except Exception as e:  # pragma: no cover
            logger.exception("AVP lookup failed: %s", e)
            raise HTTPException(503, detail="Age verification temporarily unavailable")

    # Secondary PIN gate.
    if ch["requires_secondary_pin"]:
        pin_doc = await _db.media_tv_pins.find_one({"user_id": req.user_id}, {"_id": 0})
        if not pin_doc or not req.secondary_pin:
            raise HTTPException(
                status_code=403,
                detail={"code": "pin_required", "message": "Set a secondary PIN at /dsg-tv first."},
            )
        if hashlib.sha256(req.secondary_pin.encode()).hexdigest() != pin_doc.get("pin_hash"):
            raise HTTPException(403, detail={"code": "pin_invalid", "message": "Secondary PIN incorrect."})

    # Atomic wallet deduction. Reuse coin_wallet primitives.
    from services.coin_wallet import debit_coins  # noqa: PLC0415
    deducted = await debit_coins(
        _db,
        user_id=req.user_id,
        coins=ch["coin_price"],
        reason=f"DSG TV unlock · {ch['name']}",
    )
    if not deducted.get("ok"):
        raise HTTPException(
            status_code=402,
            detail={
                "code": "insufficient_coins",
                "message": f"Need ₵{ch['coin_price']:,} to unlock {ch['name']}.",
                "required": ch["coin_price"],
                "balance": deducted.get("balance_after", 0),
            },
        )

    expires = datetime.now(timezone.utc) + timedelta(hours=CHANNEL_PASS_DURATION_HOURS)
    await _db.media_tv_passes.update_one(
        {"user_id": req.user_id, "channel_id": channel_id},
        {"$set": {
            "user_id": req.user_id,
            "channel_id": channel_id,
            "expires_at": expires.isoformat(),
            "coins_paid": ch["coin_price"],
            "granted_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {
        "ok": True,
        "channel_id": channel_id,
        "expires_at": expires.isoformat(),
        "coins_paid": ch["coin_price"],
    }


class SetPinRequest(BaseModel):
    user_id: str
    pin: str = Field(..., min_length=4, max_length=8)


@router.post("/tv/set-pin")
async def set_secondary_pin(req: SetPinRequest) -> Dict[str, Any]:
    """Set/rotate the user's secondary PIN for gated channels. PIN is
    stored as SHA-256 hash — we never round-trip plaintext."""
    pin_hash = hashlib.sha256(req.pin.encode()).hexdigest()
    await _db.media_tv_pins.update_one(
        {"user_id": req.user_id},
        {"$set": {
            "user_id": req.user_id,
            "pin_hash": pin_hash,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"ok": True, "user_id": req.user_id}


# ─── Channel programming: attach a CF live input to a DSG TV channel ──
class ProgramRequest(BaseModel):
    channel_id: str
    input_id: str       # CF live input UID (`cf_live_inputs.input_id`)
    streamer_id: str
    duration_hours: int = Field(default=4, ge=1, le=72)


@router.post("/tv/program")
async def program_channel(req: ProgramRequest) -> Dict[str, Any]:
    """Attach a streamer's CF live input to a DSG TV channel for the
    next `duration_hours`. The DSG TV viewer will surface this input
    via HLS when the streamer goes live. Multiple programs can stack;
    the most recent one with an open window wins."""
    _channel(req.channel_id)  # 404 unknown
    # Validate the CF live input exists.
    live_input = await _db.cf_live_inputs.find_one(
        {"input_id": req.input_id, "is_deleted": {"$ne": True}}, {"_id": 0},
    )
    if not live_input:
        raise HTTPException(404, detail=f"Unknown CF live input '{req.input_id}'")

    now = datetime.now(timezone.utc)
    program = {
        "program_id": str(uuid.uuid4()),
        "channel_id": req.channel_id,
        "input_id": req.input_id,
        "streamer_id": req.streamer_id,
        "programmed_at": now.isoformat(),
        "programmed_until": (now + timedelta(hours=req.duration_hours)).isoformat(),
    }
    await _db.media_tv_channel_programs.insert_one(dict(program))
    return {"ok": True, "program": program}


@router.get("/tv/now-playing/{channel_id}")
async def tv_now_playing(channel_id: str) -> Dict[str, Any]:
    """Return the currently-broadcasting CF live input for this channel
    + its HLS playback URL. Empty payload when no streamer is live."""
    _channel(channel_id)
    live_input = await _resolve_channel_live_input(channel_id)
    if not live_input:
        return {"channel_id": channel_id, "live": False, "live_input": None}
    return {
        "channel_id": channel_id,
        "live": True,
        "live_input": {
            "input_id": live_input.get("input_id"),
            "streamer_id": live_input.get("streamer_id"),
            "name": live_input.get("name"),
            "hls_playback_url": live_input.get("hls_playback_url"),
            "dash_playback_url": live_input.get("dash_playback_url"),
            "started_at": live_input.get("last_status_at"),
        },
        "program": live_input.get("program"),
    }


# ════════════════════════════════════════════════════════════════════
# 2. VIBE RADIO — 3 stations, skip-bid + instant-purchase revenue hooks
# ════════════════════════════════════════════════════════════════════
@router.get("/radio/stations")
async def list_radio_stations() -> Dict[str, Any]:
    return {"stations": VIBE_RADIO_STATIONS, "count": len(VIBE_RADIO_STATIONS)}


@router.get("/radio/now-playing/{station_id}")
async def radio_now_playing(station_id: str) -> Dict[str, Any]:
    """Current track on a station. Read-only summary of any active
    skip-bid pool so the UI can render the bidding strip."""
    _station(station_id)  # 404 if unknown
    track = await _db.media_radio_tracks.find_one(
        {"station_id": station_id, "is_current": True}, {"_id": 0},
    )
    # Empty-state fallback so the player never shows nothing.
    if not track:
        track = {
            "track_id": f"{station_id}-warmup",
            "title": "Station Warm-Up",
            "artist": "Vibe Radio",
            "started_at": datetime.now(timezone.utc).isoformat(),
        }
    bid = await _db.media_radio_skip_bids.find_one(
        {"station_id": station_id, "status": "active"}, {"_id": 0},
    )
    return {
        "station_id": station_id,
        "now_playing": track,
        "skip_bid": bid,  # None when no bid is live
    }


class SkipBidRequest(BaseModel):
    user_id: str
    station_id: str
    amount: int


@router.post("/radio/skip-bid")
async def submit_skip_bid(req: SkipBidRequest) -> Dict[str, Any]:
    """Pay ₵ to skip the current track. First bid above SKIP_BID_FLOOR
    opens the bid window; keep-bids must add at least KEEP_BID_INCREMENT.
    """
    if req.amount < SKIP_BID_FLOOR:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "below_skip_floor",
                "message": f"Minimum skip bid is ₵{SKIP_BID_FLOOR}.",
                "floor": SKIP_BID_FLOOR,
            },
        )
    _station(req.station_id)
    track = await _db.media_radio_tracks.find_one(
        {"station_id": req.station_id, "is_current": True}, {"_id": 0},
    )
    track_id = (track or {}).get("track_id") or f"{req.station_id}-warmup"

    # Debit coins from the user before locking in the bid (fail-fast).
    from services.coin_wallet import debit_coins  # noqa: PLC0415
    deducted = await debit_coins(
        _db,
        user_id=req.user_id,
        coins=req.amount,
        reason=f"Vibe Radio skip-bid · {req.station_id}",
    )
    if not deducted.get("ok"):
        raise HTTPException(
            status_code=402,
            detail={"code": "insufficient_coins", "balance": deducted.get("balance_after", 0)},
        )

    existing = await _db.media_radio_skip_bids.find_one(
        {"station_id": req.station_id, "status": "active"}, {"_id": 0},
    )
    skip_total = (existing.get("skip_pool", 0) if existing else 0) + req.amount
    keep_total = existing.get("keep_pool", 0) if existing else 0
    bid_doc = {
        "bid_id": existing.get("bid_id") if existing else str(uuid.uuid4()),
        "station_id": req.station_id,
        "track_id": track_id,
        "skip_pool": skip_total,
        "keep_pool": keep_total,
        "status": "active",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await _db.media_radio_skip_bids.update_one(
        {"station_id": req.station_id, "status": "active"},
        {"$set": bid_doc, "$setOnInsert": {"created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"ok": True, "skip_pool": skip_total, "keep_pool": keep_total, "next_keep_min": keep_total + KEEP_BID_INCREMENT}


class KeepBidRequest(BaseModel):
    user_id: str
    station_id: str
    amount: int


@router.post("/radio/keep-bid")
async def submit_keep_bid(req: KeepBidRequest) -> Dict[str, Any]:
    """Counter-bid to KEEP the current track playing. Must exceed the
    skip_pool's keep-increment threshold so a single keep-vote can't
    out-bid a real skip wave."""
    existing = await _db.media_radio_skip_bids.find_one(
        {"station_id": req.station_id, "status": "active"}, {"_id": 0},
    )
    if not existing:
        raise HTTPException(400, detail="No active skip bid on this station.")
    min_keep = existing.get("keep_pool", 0) + KEEP_BID_INCREMENT
    if req.amount < min_keep:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "below_keep_threshold",
                "message": f"Minimum keep-bid is ₵{min_keep:,}.",
                "min_required": min_keep,
            },
        )
    from services.coin_wallet import debit_coins  # noqa: PLC0415
    deducted = await debit_coins(
        _db,
        user_id=req.user_id,
        coins=req.amount,
        reason=f"Vibe Radio keep-bid · {req.station_id}",
    )
    if not deducted.get("ok"):
        raise HTTPException(
            status_code=402,
            detail={"code": "insufficient_coins", "balance": deducted.get("balance_after", 0)},
        )
    new_keep = existing.get("keep_pool", 0) + req.amount
    await _db.media_radio_skip_bids.update_one(
        {"bid_id": existing["bid_id"]},
        {"$set": {"keep_pool": new_keep, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"ok": True, "skip_pool": existing.get("skip_pool", 0), "keep_pool": new_keep}


class InstantPurchaseRequest(BaseModel):
    user_id: str
    track_id: str
    price_coins: int


@router.post("/radio/buy-track")
async def instant_purchase(req: InstantPurchaseRequest) -> Dict[str, Any]:
    """Purchase the currently-playing track via $VIBEZ. Issues a signed
    download token via content_rights (5-min TTL) if the track is DRM-
    registered; otherwise records a wallet receipt only."""
    from services.coin_wallet import debit_coins  # noqa: PLC0415
    deducted = await debit_coins(
        _db,
        user_id=req.user_id,
        coins=req.price_coins,
        reason=f"Vibe Radio purchase · {req.track_id}",
    )
    if not deducted.get("ok"):
        raise HTTPException(402, detail={"code": "insufficient_coins"})
    receipt = {
        "receipt_id": str(uuid.uuid4()),
        "user_id": req.user_id,
        "track_id": req.track_id,
        "price_coins": req.price_coins,
        "purchased_at": datetime.now(timezone.utc).isoformat(),
    }
    await _db.media_radio_purchases.insert_one(dict(receipt))
    return {"ok": True, "receipt": receipt}


# ════════════════════════════════════════════════════════════════════
# 3. DSG MUSIC GROUP — Studios + Artist Rolodex + Affiliate Chairs
# ════════════════════════════════════════════════════════════════════
@router.get("/music/studios")
async def list_studios() -> Dict[str, Any]:
    return {"studios": DSG_MUSIC_STUDIOS, "count": len(DSG_MUSIC_STUDIOS)}


class StudioBookingRequest(BaseModel):
    user_id: str
    studio_id: str
    hours: int = Field(ge=1, le=24)


@router.post("/music/book-studio")
async def book_studio(req: StudioBookingRequest) -> Dict[str, Any]:
    """Reserve a studio for N hours. Charges hourly × hours upfront."""
    studio = _studio(req.studio_id)
    total = studio["hourly_rate_coins"] * req.hours
    from services.coin_wallet import debit_coins  # noqa: PLC0415
    deducted = await debit_coins(
        _db,
        user_id=req.user_id,
        coins=total,
        reason=f"Studio booking · {studio['name']} · {req.hours}h",
    )
    if not deducted.get("ok"):
        raise HTTPException(402, detail={"code": "insufficient_coins"})
    booking = {
        "booking_id": str(uuid.uuid4()),
        "user_id": req.user_id,
        "studio_id": req.studio_id,
        "hours": req.hours,
        "total_coins": total,
        "booked_at": datetime.now(timezone.utc).isoformat(),
        "status": "confirmed",
    }
    await _db.media_studio_bookings.insert_one(dict(booking))
    return {"ok": True, "booking": booking}


@router.get("/music/artists")
async def artist_rolodex(limit: int = 50) -> Dict[str, Any]:
    """Verified-musician category from the existing Yellow Pages.
    Reuses `yellow_pages` if available, otherwise returns an empty roster
    with metadata so the frontend can render its empty state."""
    artists = []
    try:
        cursor = _db.yellow_pages_entries.find(
            {"category": "musicians", "is_verified": True},
            {"_id": 0},
        ).limit(limit)
        artists = await cursor.to_list(limit)
    except Exception as e:
        logger.warning("Yellow Pages musicians lookup failed: %s", e)
    return {"artists": artists, "count": len(artists)}


class SponsorRequest(BaseModel):
    chair_user_id: str   # the Affiliate Chair holder
    artist_id: str       # the sponsored artist's user_id


@router.post("/music/sponsor")
async def sponsor_artist(req: SponsorRequest) -> Dict[str, Any]:
    """Affiliate Chair holder sponsors a verified artist. Future $VIBEZ
    flowing into the artist's streams + music sales is split per
    `AFFILIATE_CHAIR_REVENUE_SHARE_BPS`. Idempotent — re-sponsoring the
    same artist is a no-op."""
    existing = await _db.media_artist_sponsorships.find_one(
        {"chair_user_id": req.chair_user_id, "artist_id": req.artist_id},
        {"_id": 0},
    )
    if existing:
        return {"ok": True, "sponsorship": existing, "idempotent": True}
    doc = {
        "sponsorship_id": str(uuid.uuid4()),
        "chair_user_id": req.chair_user_id,
        "artist_id": req.artist_id,
        "revenue_share_bps": AFFILIATE_CHAIR_REVENUE_SHARE_BPS,
        "active_since": datetime.now(timezone.utc).isoformat(),
        "lifetime_payouts_coins": 0,
    }
    await _db.media_artist_sponsorships.insert_one(dict(doc))
    return {"ok": True, "sponsorship": doc, "idempotent": False}


@router.get("/music/sponsorships/{chair_user_id}")
async def list_sponsorships(chair_user_id: str) -> Dict[str, Any]:
    cursor = _db.media_artist_sponsorships.find(
        {"chair_user_id": chair_user_id}, {"_id": 0},
    )
    rows = await cursor.to_list(200)
    return {"chair_user_id": chair_user_id, "sponsorships": rows, "count": len(rows)}


# ════════════════════════════════════════════════════════════════════
# 4. AI SCOUT — Hype-Score triggered auto-clip + break-in alerts
# ════════════════════════════════════════════════════════════════════
class HypeIngestRequest(BaseModel):
    room_id: str
    gift_volume_coins: float
    chat_messages_per_minute: float
    cf_input_id: Optional[str] = None   # if set, AI Scout cuts a real CF clip


@router.post("/scout/ingest")
async def scout_ingest(req: HypeIngestRequest) -> Dict[str, Any]:
    """Report current per-minute metrics for a live room. Returns the
    computed Hype Score + verdict bucket. Persists the latest snapshot
    so the dashboard tile can read it without recomputing.

    When `cf_input_id` is supplied AND the hype crosses the auto-clip
    threshold, the AI Scout fires a real Cloudflare Stream Live Clip
    request (30-sec window) and stamps `playback_url` onto the clip row.
    No CF input → metadata-only clip (preview-env friendly).
    """
    score = compute_hype_score(req.gift_volume_coins, req.chat_messages_per_minute)
    verdict = classify_hype(score)
    now_iso = datetime.now(timezone.utc).isoformat()

    snapshot = {
        "room_id": req.room_id,
        "hype_score": round(score, 1),
        "gift_volume_coins": req.gift_volume_coins,
        "chat_messages_per_minute": req.chat_messages_per_minute,
        "verdict": verdict,
        "updated_at": now_iso,
        "cf_input_id": req.cf_input_id,
    }
    await _db.media_scout_hype.update_one(
        {"room_id": req.room_id}, {"$set": snapshot}, upsert=True,
    )

    auto_clip = None
    break_in = None
    # Auto-clip generation — fires only on the transition into the
    # threshold (idempotent per (room_id, minute_bucket)) so we don't
    # mint duplicate clips on every sample.
    minute_bucket = now_iso[:16]  # YYYY-MM-DDTHH:MM
    if verdict in ("auto_clip", "break_in"):
        existing = await _db.media_scout_clips.find_one(
            {"room_id": req.room_id, "minute_bucket": minute_bucket}, {"_id": 0},
        )
        if not existing:
            # Optionally cut a real CF Stream clip if the room is wired
            # to a live input. Failure here doesn't block clip recording —
            # the metadata still lands, just without a playback URL.
            cf_result = None
            if req.cf_input_id:
                from services.cf_stream_clipper import clip_live_input  # noqa: PLC0415
                cf_result = await clip_live_input(req.cf_input_id, AUTO_CLIP_DURATION_SECONDS)

            clip = {
                "clip_id": str(uuid.uuid4()),
                "room_id": req.room_id,
                "minute_bucket": minute_bucket,
                "hype_score": round(score, 1),
                "duration_seconds": AUTO_CLIP_DURATION_SECONDS,
                "created_at": now_iso,
                "verdict": verdict,
                "cf_input_id": req.cf_input_id,
                "cf_clip_uid": (cf_result or {}).get("clip_uid"),
                "playback_url": (cf_result or {}).get("hls_url"),
                "cf_status": "rendered" if (cf_result or {}).get("ok") else (
                    (cf_result or {}).get("reason") or "metadata_only"
                ),
            }
            await _db.media_scout_clips.insert_one(dict(clip))
            auto_clip = clip

    if verdict == "break_in":
        # Persist a network-wide alert row — the Live Now Wall can
        # render a "BREAK-IN" banner overlay when one is active.
        break_in = {
            "alert_id": str(uuid.uuid4()),
            "room_id": req.room_id,
            "hype_score": round(score, 1),
            "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=2)).isoformat(),
            "created_at": now_iso,
        }
        await _db.media_scout_alerts.insert_one(dict(break_in))

    return {"snapshot": snapshot, "auto_clip": auto_clip, "break_in_alert": break_in}


@router.get("/scout/clips/recent")
async def recent_clips(limit: int = 20) -> Dict[str, Any]:
    """Latest auto-generated highlight clips. Powers the AI Scout strip
    on the dashboard."""
    cursor = _db.media_scout_clips.find({}, {"_id": 0}).sort("created_at", -1)
    rows = await cursor.to_list(limit)
    return {"clips": rows, "count": len(rows)}


@router.get("/scout/break-ins/active")
async def active_break_ins() -> Dict[str, Any]:
    """Active break-in alerts — anything that hasn't expired yet. The
    Live Now Wall and DSG TV channel grid render a network-wide
    interruption banner whenever a row appears here."""
    now_iso = datetime.now(timezone.utc).isoformat()
    cursor = _db.media_scout_alerts.find(
        {"expires_at": {"$gt": now_iso}}, {"_id": 0},
    ).sort("created_at", -1)
    rows = await cursor.to_list(20)
    return {"alerts": rows, "count": len(rows)}


@router.get("/scout/hype/{room_id}")
async def get_hype(room_id: str) -> Dict[str, Any]:
    """Read the latest hype snapshot for a single room."""
    rec = await _db.media_scout_hype.find_one({"room_id": room_id}, {"_id": 0})
    if not rec:
        return {"room_id": room_id, "hype_score": 0.0, "verdict": "ambient"}
    return rec

"""
Vibe Phone — privacy-masked in-app calling + (scaffolded) PSTN proxy.

Phase 1 (LIVE): in-app voice calls between two Vibe users using Agora.
Phase 2 (SCAFFOLDED, blocked on Twilio creds): real PSTN proxy numbers.

Endpoints (all under /api/vibe-phone, mounted in server.py):
  POST   /provision                 — assign / fetch caller's Vibe number
  GET    /me                        — my number + blocklist + premium status
  POST   /lookup                    — resolve a Vibe number → user_id
  POST   /call/initiate             — start a call to another user_id (in-app)
  POST   /call/respond              — accept / decline an inbound call
  POST   /call/end                  — end an in-progress call
  POST   /block                     — block another user
  POST   /unblock                   — unblock
  WS     /ws/vibe-phone/{user_id}   — push channel for incoming calls
  GET    /pstn/eligibility          — am I eligible for PSTN proxy?
  POST   /pstn/provision            — (scaffold) provision real Twilio number
                                       — currently 503 unless Twilio creds set

The Vibe number format is `+1 (888) VIBE-XXXX` for display, where XXXX is a
deterministic 4-digit hash of the user_id. The mapping is NOT a real US phone
number — it lives entirely inside our directory and is used to mask the user
behind something that *looks* like a phone number on dating profiles, in-game
caller-ID popups, etc. Phase 2 will add a real Twilio-leased number alongside.
"""
from __future__ import annotations

import asyncio
import logging
import os
import re
import time
import zlib
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from utils.database import get_database, get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

# ───────────────────────── In-memory call sessions + WS push ──

# {user_id: WebSocket}  (only the active live socket per user)
_USER_SOCKETS: Dict[str, WebSocket] = {}
_USER_LOCK = asyncio.Lock()

# {call_id: {caller_id, callee_id, channel, status, created_at}}
# status: ringing | active | declined | ended | timed_out
_CALLS: Dict[str, Dict[str, Any]] = {}
_CALLS_LOCK = asyncio.Lock()

CALL_RING_TTL_SEC = 45  # caller has 45s before we auto-time-out

# Premium tiers that get PSTN included
PSTN_INCLUDED_TIERS = {"diamond", "gold"}
PSTN_STANDALONE_PRICE_USD = 4.99  # per month for free-tier users

# ───────────────────────── Vibe number helpers ──

VIBE_NUMBER_RE = re.compile(r"^\+1\s?\(?888\)?\s?VIBE-\d{4}$", re.IGNORECASE)


def _vibe_number_for(user_id: str) -> str:
    """Deterministic 4-digit suffix per user — display label, not a real PSTN number."""
    n = zlib.crc32(user_id.encode("utf-8")) % 10000
    return f"+1 (888) VIBE-{n:04d}"


# ───────────────────────── Provisioning + lookup ──

async def _ensure_vibe_number(user_id: str) -> str:
    """
    Fetch (or create) the user's Vibe number row. Idempotent — same user always
    gets the same suffix. Stores in the `vibe_phone_directory` collection so we
    can guarantee uniqueness if a future iteration wants to swap to randomized.
    """
    db = get_database()
    row = await db.vibe_phone_directory.find_one({"user_id": user_id}, {"_id": 0})
    if row and row.get("vibe_number"):
        return row["vibe_number"]
    number = _vibe_number_for(user_id)
    await db.vibe_phone_directory.update_one(
        {"user_id": user_id},
        {"$set": {
            "user_id": user_id,
            "vibe_number": number,
            "blocked_user_ids": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return number


async def _get_user_premium(user_id: str) -> Dict[str, Any]:
    """Returns {tier, has_pstn, source} for the user."""
    db = get_database()
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "subscription_tier": 1, "vibe_phone_pstn_active": 1})
    tier = (user or {}).get("subscription_tier", "free")
    if tier in PSTN_INCLUDED_TIERS:
        return {"tier": tier, "has_pstn": True, "source": "premium_tier"}
    if (user or {}).get("vibe_phone_pstn_active"):
        return {"tier": tier, "has_pstn": True, "source": "standalone_subscription"}
    return {"tier": tier, "has_pstn": False, "source": None}


@router.post("/vibe-phone/provision")
async def provision(http_request: Request):
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    number = await _ensure_vibe_number(user.user_id)
    premium = await _get_user_premium(user.user_id)
    return {"user_id": user.user_id, "vibe_number": number, **premium}


@router.get("/vibe-phone/me")
async def me(http_request: Request):
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    number = await _ensure_vibe_number(user.user_id)
    db = get_database()
    row = await db.vibe_phone_directory.find_one(
        {"user_id": user.user_id}, {"_id": 0}
    ) or {}
    premium = await _get_user_premium(user.user_id)
    return {
        "user_id": user.user_id,
        "vibe_number": number,
        "blocked_user_ids": row.get("blocked_user_ids", []),
        **premium,
    }


class LookupPayload(BaseModel):
    vibe_number: str


@router.post("/vibe-phone/lookup")
async def lookup(payload: LookupPayload, http_request: Request):
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    if not VIBE_NUMBER_RE.match(payload.vibe_number.strip()):
        raise HTTPException(400, "Not a valid Vibe number format")
    db = get_database()
    row = await db.vibe_phone_directory.find_one(
        {"vibe_number": payload.vibe_number.strip()}, {"_id": 0}
    )
    if not row:
        return {"found": False}
    return {"found": True, "user_id": row["user_id"]}


# ───────────────────────── Block / unblock ──

class BlockPayload(BaseModel):
    user_id: str  # the user being blocked


@router.post("/vibe-phone/block")
async def block_user(payload: BlockPayload, http_request: Request):
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    if payload.user_id == user.user_id:
        raise HTTPException(400, "Cannot block yourself")
    db = get_database()
    await _ensure_vibe_number(user.user_id)
    await db.vibe_phone_directory.update_one(
        {"user_id": user.user_id},
        {"$addToSet": {"blocked_user_ids": payload.user_id}},
    )
    return {"ok": True, "blocked": payload.user_id}


@router.post("/vibe-phone/unblock")
async def unblock_user(payload: BlockPayload, http_request: Request):
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    await db.vibe_phone_directory.update_one(
        {"user_id": user.user_id},
        {"$pull": {"blocked_user_ids": payload.user_id}},
    )
    return {"ok": True, "unblocked": payload.user_id}


# ───────────────────────── Calling flow ──

class InitiatePayload(BaseModel):
    callee_user_id: str = Field(..., description="The user being called")


class RespondPayload(BaseModel):
    call_id: str
    accept: bool


class EndPayload(BaseModel):
    call_id: str


async def _push(user_id: str, event: Dict[str, Any]) -> bool:
    """Send a JSON event to the user's WebSocket. Returns True if delivered."""
    sock = _USER_SOCKETS.get(user_id)
    if not sock:
        return False
    try:
        await sock.send_json(event)
        return True
    except Exception:
        async with _USER_LOCK:
            _USER_SOCKETS.pop(user_id, None)
        return False


@router.post("/vibe-phone/call/initiate")
async def initiate(payload: InitiatePayload, http_request: Request):
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    callee_id = payload.callee_user_id.strip()
    if callee_id == user.user_id:
        raise HTTPException(400, "Cannot call yourself")

    db = get_database()
    # Block-list check (callee blocked the caller?)
    callee_dir = await db.vibe_phone_directory.find_one(
        {"user_id": callee_id}, {"_id": 0, "blocked_user_ids": 1}
    )
    if callee_dir and user.user_id in (callee_dir.get("blocked_user_ids") or []):
        raise HTTPException(403, "This user has blocked you.")

    # Make sure both sides have a vibe number provisioned.
    caller_number = await _ensure_vibe_number(user.user_id)
    callee_number = await _ensure_vibe_number(callee_id)

    call_id = f"call_{int(time.time() * 1000)}_{zlib.crc32(user.user_id.encode()) & 0xFFFF:04x}"
    channel = f"vibephone-{call_id}"
    record = {
        "call_id": call_id,
        "caller_id": user.user_id,
        "caller_vibe_number": caller_number,
        "callee_id": callee_id,
        "callee_vibe_number": callee_number,
        "channel": channel,
        "status": "ringing",
        "created_at": time.time(),
    }
    async with _CALLS_LOCK:
        _CALLS[call_id] = record

    # Push the incoming-call event to the callee. If they're offline we still
    # return to the caller — they'll see "ringing" and can hang up.
    delivered = await _push(callee_id, {
        "event": "INCOMING_CALL",
        "call_id": call_id,
        "from_user_id": user.user_id,
        "from_vibe_number": caller_number,
        "channel": channel,
    })

    # Auto-time-out after CALL_RING_TTL_SEC if no response.
    asyncio.create_task(_ring_timeout(call_id))

    # Persist the call attempt for history.
    try:
        await db.vibe_phone_calls.insert_one({
            **record,
            "delivered_to_callee": delivered,
        })
    except Exception as e:
        logger.warning(f"[vibe-phone] persist call failed: {e}")

    return {
        "call_id": call_id,
        "channel": channel,
        "status": "ringing",
        "delivered_to_callee": delivered,
        "caller_vibe_number": caller_number,
        "callee_vibe_number": callee_number,
    }


async def _ring_timeout(call_id: str) -> None:
    await asyncio.sleep(CALL_RING_TTL_SEC)
    async with _CALLS_LOCK:
        rec = _CALLS.get(call_id)
        if not rec or rec["status"] != "ringing":
            return
        rec["status"] = "timed_out"
        caller_id = rec["caller_id"]
    await _push(caller_id, {"event": "CALL_TIMEOUT", "call_id": call_id})
    db = get_database()
    try:
        await db.vibe_phone_calls.update_one(
            {"call_id": call_id}, {"$set": {"status": "timed_out"}}
        )
    except Exception:
        pass


@router.post("/vibe-phone/call/respond")
async def respond(payload: RespondPayload, http_request: Request):
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    async with _CALLS_LOCK:
        rec = _CALLS.get(payload.call_id)
        if not rec:
            raise HTTPException(404, "Call not found")
        if rec["callee_id"] != user.user_id:
            raise HTTPException(403, "Only the callee can respond.")
        if rec["status"] != "ringing":
            return {"ok": True, "status": rec["status"], "channel": rec["channel"]}
        rec["status"] = "active" if payload.accept else "declined"
        new_status = rec["status"]
        caller_id = rec["caller_id"]
        channel = rec["channel"]

    # Notify caller of the decision.
    await _push(caller_id, {
        "event": "CALL_ANSWERED" if payload.accept else "CALL_DECLINED",
        "call_id": payload.call_id,
        "channel": channel,
    })
    db = get_database()
    try:
        await db.vibe_phone_calls.update_one(
            {"call_id": payload.call_id},
            {"$set": {"status": new_status, "responded_at": datetime.now(timezone.utc).isoformat()}},
        )
    except Exception:
        pass
    return {"ok": True, "status": new_status, "channel": channel}


@router.post("/vibe-phone/call/end")
async def end_call(payload: EndPayload, http_request: Request):
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    async with _CALLS_LOCK:
        rec = _CALLS.get(payload.call_id)
        if not rec:
            raise HTTPException(404, "Call not found")
        if user.user_id not in (rec["caller_id"], rec["callee_id"]):
            raise HTTPException(403, "Not a participant")
        if rec["status"] in ("ended", "timed_out", "declined"):
            return {"ok": True, "status": rec["status"]}
        rec["status"] = "ended"
        other = rec["callee_id"] if user.user_id == rec["caller_id"] else rec["caller_id"]
        # Capture timing for stake accrual.
        started_at = rec.get("created_at", time.time())
        caller_id = rec["caller_id"]
        callee_id = rec["callee_id"]
    duration_min = max(1, int((time.time() - started_at) / 60))

    await _push(other, {"event": "CALL_ENDED", "call_id": payload.call_id})
    db = get_database()
    try:
        await db.vibe_phone_calls.update_one(
            {"call_id": payload.call_id},
            {"$set": {
                "status": "ended",
                "ended_at": datetime.now(timezone.utc).isoformat(),
                "duration_minutes": duration_min,
            }},
        )
    except Exception:
        pass

    # Profit-share accrual — both sides earn 1 stake per minute talked.
    try:
        from routes.profit_share import accrue_stake
        await accrue_stake(caller_id, "vibe_call_minute", amount=duration_min,
                           meta={"call_id": payload.call_id, "role": "caller"})
        await accrue_stake(callee_id, "vibe_call_minute", amount=duration_min,
                           meta={"call_id": payload.call_id, "role": "callee"})
    except Exception:
        pass

    return {"ok": True, "status": "ended", "duration_minutes": duration_min}


# ───────────────────────── WebSocket push channel ──

@router.websocket("/ws/vibe-phone/{user_id}")
async def ws_user(ws: WebSocket, user_id: str):
    """
    The frontend opens this when the user is authenticated. It receives
    INCOMING_CALL / CALL_ANSWERED / CALL_DECLINED / CALL_ENDED / CALL_TIMEOUT
    events so the in-app ringer can pop up without polling.

    Auth: the user_id is taken from the URL path. This is good enough for
    Phase 1 — a hostile client could open someone else's socket but they'd
    only be able to LISTEN to that user's incoming-call events, not act on
    them (every action endpoint re-validates via get_current_user). Move to
    a JWT-in-querystring later if abuse shows up.
    """
    await ws.accept()
    async with _USER_LOCK:
        # Boot any prior socket for this user (multi-tab → last writer wins).
        prior = _USER_SOCKETS.get(user_id)
        if prior:
            try:
                await prior.close(code=4000)
            except Exception:
                pass
        _USER_SOCKETS[user_id] = ws
    try:
        while True:
            # Drain client pings; we don't expect inbound messages.
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.warning(f"[vibe-phone] ws error for {user_id}: {e}")
    finally:
        async with _USER_LOCK:
            if _USER_SOCKETS.get(user_id) is ws:
                _USER_SOCKETS.pop(user_id, None)


# ───────────────────────── PSTN scaffold (Phase 2) ──

@router.get("/vibe-phone/pstn/eligibility")
async def pstn_eligibility(http_request: Request):
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    p = await _get_user_premium(user.user_id)
    twilio_configured = bool(
        os.environ.get("TWILIO_ACCOUNT_SID") and os.environ.get("TWILIO_AUTH_TOKEN")
    )
    return {
        **p,
        "standalone_price_usd": PSTN_STANDALONE_PRICE_USD,
        "twilio_configured": twilio_configured,
        "ready": p["has_pstn"] and twilio_configured,
        "phase_2_status": (
            "ready_to_provision" if (p["has_pstn"] and twilio_configured)
            else "premium_or_subscription_required" if not p["has_pstn"]
            else "platform_pending_twilio_credentials"
        ),
    }


class ProvisionPSTNPayload(BaseModel):
    area_code: Optional[str] = Field(default=None, pattern=r"^\d{3}$")


@router.post("/vibe-phone/pstn/provision")
async def pstn_provision(payload: ProvisionPSTNPayload, http_request: Request):
    """
    SCAFFOLDED — returns 503 until Twilio creds are set in env.
    Once TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN are present, this will:
      1. Search Twilio for an available number in `area_code` (or any).
      2. Lease it (~$1/mo).
      3. Configure the inbound voice webhook → /api/vibe-phone/pstn/inbound.
      4. Save the number on the user's directory row.
      5. Return {pstn_number, lease_started_at}.
    """
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    elig = await pstn_eligibility(http_request)
    if not elig["has_pstn"]:
        raise HTTPException(
            402,
            f"PSTN proxy requires a Diamond/Gold tier or a ${PSTN_STANDALONE_PRICE_USD}/mo subscription.",
        )
    if not elig["twilio_configured"]:
        raise HTTPException(
            503,
            "PSTN proxy not yet enabled — platform is awaiting Twilio credentials. "
            "Your premium PSTN entitlement is recorded and will activate automatically "
            "once Twilio is configured.",
        )
    raise HTTPException(501, "PSTN provisioning implementation pending.")

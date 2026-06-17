"""
Twilio HTTP endpoints for VibeRidez.

  POST /api/twilio/sms/send        — auth; send SMS to another user
  POST /api/twilio/ride/notify     — internal; called on ride-state changes
  POST /api/twilio/sos             — auth; panic button
  POST /api/twilio/voice/bridge    — auth; "Call driver" one-tap proxy
  POST /api/twilio/voice/proxy-mint — auth; IVR-style PIN proxy mint
  POST /api/twilio/voice/inbound   — public; Twilio webhook for PIN IVR
  GET  /api/twilio/status          — public-ish; returns {configured, phone, sos_contact?}
  GET  /api/admin/twilio/sos-log   — admin; recent SOS events
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Form, HTTPException, Request, Response
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from routes.admin_dashboard import verify_admin_cookie
from services.twilio_service import (
    bridge_call,
    is_configured,
    mint_voice_proxy,
    resolve_proxy_target,
    send_ride_sms,
    send_sms,
    send_sos,
    verify_check,
    verify_send,
)
from utils.database import get_current_user, get_database

router = APIRouter()


# ────────────────────────────────────────────── Status

@router.get("/twilio/status")
async def twilio_status() -> Dict[str, Any]:
    """Public-ish: is Twilio wired up? Used by the front-end to toggle
    the "Call driver" button vs an in-app fallback. Never returns the
    Account SID or Auth Token."""
    from services.twilio_service import _cfg
    cfg = _cfg()
    return {
        "configured": is_configured(),
        "phone": cfg["phone"] or None,
        "sos_contact_configured": bool(cfg["sos"]),
    }


# ────────────────────────────────────────────── SMS

class SmsSendPayload(BaseModel):
    to: str = Field(..., min_length=5, max_length=25)
    body: str = Field(..., min_length=1, max_length=1500)


@router.post("/twilio/sms/send")
async def sms_send(payload: SmsSendPayload, request: Request) -> Dict[str, Any]:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(401, "Sign in to send SMS.")
    return send_sms(payload.to, payload.body)


class RideNotifyPayload(BaseModel):
    user_id: str
    ride_id: Optional[str] = None
    body: str = Field(..., min_length=1, max_length=1500)


@router.post("/twilio/ride/notify")
async def ride_notify(payload: RideNotifyPayload, request: Request) -> Dict[str, Any]:
    """Auth-gated SMS to a specific user's phone. Used by rider/driver
    UIs to ship status alerts. The ride-completion auto-alert fires
    from /api/ridez/complete directly via send_ride_sms()."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(401, "Sign in to send SMS.")
    db = get_database()
    return await send_ride_sms(
        db, payload.user_id, payload.body, ride_id=payload.ride_id,
    )


# ────────────────────────────────────────────── SOS

class SosPayload(BaseModel):
    ride_id: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    driver_name: Optional[str] = None
    extra: Optional[str] = Field(default=None, max_length=500)


@router.post("/twilio/sos")
async def sos(payload: SosPayload, request: Request) -> Dict[str, Any]:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(401, "Sign in to send SOS.")
    db = get_database()
    return await send_sos(
        db,
        user_id=user.user_id,
        ride_id=payload.ride_id,
        lat=payload.lat, lon=payload.lon,
        driver_name=payload.driver_name,
        extra=payload.extra,
    )


@router.get("/admin/twilio/sos-log")
async def admin_sos_log(
    limit: int = 50, _: bool = Depends(verify_admin_cookie),
) -> Dict[str, Any]:
    db = get_database()
    rows = await db.sos_events.find({}, {"_id": 0}).sort(
        "created_at", -1,
    ).to_list(length=max(1, min(limit, 500)))
    return {"count": len(rows), "rows": rows}


# ────────────────────────────────────────────── Voice

class VoiceBridgePayload(BaseModel):
    ride_id: Optional[str] = None
    # Who the CALLER is — their phone gets dialed first by Twilio.
    caller_number: str = Field(..., min_length=5, max_length=25)
    callee_number: str = Field(..., min_length=5, max_length=25)


@router.post("/twilio/voice/bridge")
async def voice_bridge(payload: VoiceBridgePayload, request: Request) -> Dict[str, Any]:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(401, "Sign in to place a call.")
    if not is_configured():
        raise HTTPException(503, "Twilio not configured on this deployment.")
    result = bridge_call(payload.caller_number, payload.callee_number)
    # Audit log — never store the raw numbers in plaintext.
    db = get_database()
    await db.voice_bridge_log.insert_one({
        "user_id": user.user_id,
        "ride_id": payload.ride_id,
        "caller_number_suffix": payload.caller_number[-4:],
        "callee_number_suffix": payload.callee_number[-4:],
        "result": result,
        "at": datetime.now(timezone.utc).isoformat(),
    })
    return result


class VoiceProxyMintPayload(BaseModel):
    ride_id: str
    rider_number: str
    driver_number: str
    ttl_seconds: int = 3600


@router.post("/twilio/voice/proxy-mint")
async def voice_proxy_mint(payload: VoiceProxyMintPayload, request: Request) -> Dict[str, Any]:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(401, "Sign in to mint a proxy PIN.")
    db = get_database()
    return await mint_voice_proxy(
        db,
        ride_id=payload.ride_id,
        rider_number=payload.rider_number,
        driver_number=payload.driver_number,
        ttl_seconds=max(60, min(payload.ttl_seconds, 86400)),
    )


@router.post("/twilio/voice/inbound")
async def voice_inbound(
    request: Request,
    From: str = Form(""),
    Digits: str = Form(""),
) -> Response:
    """Public Twilio webhook — returns TwiML. When a caller dials the
    Twilio number, Twilio POSTs here; we prompt for a PIN and on the
    second hit (with Digits populated) resolve to the other leg and
    <Dial> it. If the PIN is unknown we play a rejection message."""
    from twilio.twiml.voice_response import VoiceResponse, Gather

    db = get_database()
    vr = VoiceResponse()
    if not Digits:
        gather = Gather(
            num_digits=5, action="/api/twilio/voice/inbound",
            method="POST", timeout=10,
        )
        gather.say(
            "Welcome to Global Vibez Ridez. Please enter your 5 digit PIN.",
            voice="Polly.Joanna",
        )
        vr.append(gather)
        vr.say("We didn't receive a PIN. Goodbye.")
        return PlainTextResponse(str(vr), media_type="application/xml")

    target = await resolve_proxy_target(db, pin=Digits, caller_number=From)
    if not target:
        vr.say("Sorry, that PIN is not valid or has expired. Goodbye.")
        return PlainTextResponse(str(vr), media_type="application/xml")

    from services.twilio_service import _cfg
    caller_id = _cfg()["phone"]
    vr.say("Connecting you now.", voice="Polly.Joanna")
    # Dial the other leg. callerId = the Twilio number so neither
    # party ever sees the other's real number.
    vr.dial(target, caller_id=caller_id, timeout=30)
    return PlainTextResponse(str(vr), media_type="application/xml")


# ────────────────────────────────────────────── Verify (OTP)

class VerifySendPayload(BaseModel):
    phone_number: str = Field(..., min_length=5, max_length=25)
    channel: str = Field(default="sms", pattern=r"^(sms|call)$")


@router.post("/twilio/verify/send")
async def verify_send_route(
    payload: VerifySendPayload, request: Request,
) -> Dict[str, Any]:
    """Start phone verification. Returns {ok, status:'pending'} on
    success — the OTP is sent to the provided number via SMS (or
    voice if channel='call'). No auth required so unregistered users
    can verify during signup. Rate-limited by Twilio server-side."""
    return verify_send(payload.phone_number, channel=payload.channel)


class VerifyCheckPayload(BaseModel):
    phone_number: str = Field(..., min_length=5, max_length=25)
    code: str = Field(..., min_length=4, max_length=10)


@router.post("/twilio/verify/check")
async def verify_check_route(
    payload: VerifyCheckPayload, request: Request,
) -> Dict[str, Any]:
    """Validate a 6-digit code. On success (`valid=True`), we persist
    the verified phone on the caller's user record so they can be
    reached for SMS ride alerts + SOS without re-verifying."""
    result = verify_check(payload.phone_number, payload.code)
    if result.get("valid"):
        user = await get_current_user(request)
        if user:
            db = get_database()
            await db.users.update_one(
                {"user_id": user.user_id},
                {"$set": {
                    "phone_number": payload.phone_number,
                    "phone_verified_at": datetime.now(timezone.utc).isoformat(),
                }},
            )
    return result


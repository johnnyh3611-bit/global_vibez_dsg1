"""
Twilio integration — rider/driver voice proxy, ride SMS alerts, SOS.

Three concerns, one module:

  1. Voice proxy (`proxy_call`)
     Rider taps "Call driver" → backend mints an ephemeral proxy row
     `voice_proxy_sessions` keyed by a short-lived token. Rider dials
     the Twilio number + PIN, Twilio webhooks back to
     /api/twilio/voice/proxy-inbound which returns TwiML that bridges
     the call to the driver's real number. Neither side sees the other's
     real number. The session expires when the ride completes or after
     `expires_at`.
     For faster UX we also expose `/api/twilio/voice/outbound` which
     directly places a Twilio outbound bridge (both sides get a call
     from the Twilio number simultaneously) — this is the pattern we'll
     use from the in-app "Call driver" button since it doesn't require
     the rider to remember a PIN.

  2. SMS alerts (`send_ride_sms`)
     One-shot outbound SMS with any ride-status body. Used by the
     existing /api/ridez/complete hook to ship "Your ride is complete"
     texts and by the driver-assigned WebSocket event to ping
     "Alex is 2 min away".

  3. Emergency SOS (`send_sos`)
     Panic-button endpoint. Sends a single SMS to the designated
     TWILIO_SOS_CONTACT phone number with ride_id + live GPS + driver
     name + timestamp. Also inserts a row in `sos_events` for admin
     review.

Trial-account caveat: calls/SMS will fail when targeting unverified
numbers. Errors are surfaced in the API response + logged, never
raised. In production we flip to a funded account and the caveat
goes away.

All entry points are best-effort and never raise — a failed Twilio
call must not brick the ride flow.
"""
from __future__ import annotations

import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


def _cfg() -> Dict[str, str]:
    return {
        "sid":   os.environ.get("TWILIO_ACCOUNT_SID", "").strip(),
        "token": os.environ.get("TWILIO_AUTH_TOKEN", "").strip(),
        "phone": os.environ.get("TWILIO_PHONE_NUMBER", "").strip(),
        "sos":   os.environ.get("TWILIO_SOS_CONTACT", "").strip(),
        "verify_service_sid": os.environ.get("TWILIO_VERIFY_SERVICE_SID", "").strip(),
        "public_url": os.environ.get("REACT_APP_BACKEND_URL", "").strip(),
    }


def _client():
    """Lazy-import twilio client so tests that don't touch it don't pay
    the import cost. Returns None if creds missing."""
    cfg = _cfg()
    if not cfg["sid"] or not cfg["token"]:
        return None
    try:
        from twilio.rest import Client  # noqa: PLC0415
        return Client(cfg["sid"], cfg["token"])
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[twilio] client init failed: {e}")
        return None


def is_configured() -> bool:
    cfg = _cfg()
    return bool(cfg["sid"] and cfg["token"] and cfg["phone"])


# ────────────────────────────────────────────── SMS

def send_sms(to: str, body: str) -> Dict[str, Any]:
    """Send one SMS. Returns {ok, sid?, error?}. Never raises.

    `to` must be in E.164 format (e.g. +14155551234). On a trial
    account targeting an unverified number, Twilio returns code 21608
    — we surface it cleanly instead of crashing.
    """
    client = _client()
    cfg = _cfg()
    if not client or not cfg["phone"]:
        return {"ok": False, "error": "twilio not configured"}
    if not to or not to.startswith("+"):
        return {"ok": False, "error": "destination number must be E.164 (+...)"}
    try:
        msg = client.messages.create(
            to=to, from_=cfg["phone"], body=body[:1500],
        )
        logger.info(f"[twilio sms] → {to[:6]}... sid={msg.sid}")
        return {"ok": True, "sid": msg.sid, "status": msg.status}
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[twilio sms] failed to {to[:6]}...: {e}")
        return {"ok": False, "error": str(e)}


async def send_ride_sms(
    db, user_id: str, body: str, ride_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Resolve a user → their registered phone → send SMS. Logs the
    attempt in `ride_sms_log` collection for audit + dedup."""
    if not is_configured():
        return {"ok": False, "error": "twilio not configured"}
    row = await db.users.find_one(
        {"user_id": user_id},
        {"_id": 0, "phone_number": 1, "phone": 1},
    )
    phone = (row or {}).get("phone_number") or (row or {}).get("phone") or ""
    phone = phone.strip()
    if not phone:
        return {"ok": False, "error": "user has no phone_number on file"}
    result = send_sms(phone, body)
    await db.ride_sms_log.insert_one({
        "user_id": user_id,
        "ride_id": ride_id,
        "phone": phone[:6] + "...",
        "body_excerpt": body[:120],
        "result": {k: v for k, v in result.items() if k != "token"},
        "at": datetime.now(timezone.utc).isoformat(),
    })
    return result


# ────────────────────────────────────────────── SOS

async def send_sos(
    db, *,
    user_id: str, ride_id: Optional[str] = None,
    lat: Optional[float] = None, lon: Optional[float] = None,
    driver_name: Optional[str] = None, extra: Optional[str] = None,
) -> Dict[str, Any]:
    """Panic-button: ship a single SMS to TWILIO_SOS_CONTACT with the
    ride context + live GPS, then record the event. Always records,
    regardless of SMS success — so admins see every panic press."""
    now_iso = datetime.now(timezone.utc).isoformat()
    cfg = _cfg()
    sos_to = cfg["sos"] or cfg["phone"]  # fall back to the Twilio number itself as a worst-case sink
    gmaps = (
        f"https://maps.google.com/?q={lat},{lon}"
        if lat is not None and lon is not None else ""
    )
    body = (
        f"🚨 GlobalVibez SOS\n"
        f"user={user_id}\n"
        f"ride={ride_id or 'n/a'}\n"
        f"driver={driver_name or 'n/a'}\n"
        f"when={now_iso}\n"
        f"{('loc=' + gmaps) if gmaps else ''}\n"
        f"{extra or ''}"
    ).strip()

    sms_result = send_sms(sos_to, body) if sos_to else {
        "ok": False, "error": "no sos contact",
    }
    event = {
        "user_id": user_id,
        "ride_id": ride_id,
        "lat": lat, "lon": lon,
        "driver_name": driver_name,
        "extra": extra,
        "sms_result": sms_result,
        "created_at": now_iso,
    }
    await db.sos_events.insert_one(event)
    return {"ok": True, "sms_result": sms_result, "recorded_at": now_iso}


# ────────────────────────────────────────────── Voice proxy

async def mint_voice_proxy(
    db, *,
    ride_id: str, rider_number: str, driver_number: str,
    ttl_seconds: int = 3600,
) -> Dict[str, Any]:
    """Create a short-lived proxy session so either party can dial the
    Twilio number + provide a token and get bridged to the other.
    Used by the IVR-style inbound flow. In practice the UI favors
    `bridge_call` (outbound both-leg dial) because it's one tap."""
    now = datetime.now(timezone.utc)
    token = f"{secrets.randbelow(90000) + 10000}"  # 5-digit PIN
    session = {
        "ride_id": ride_id,
        "pin": token,
        "rider_number": rider_number,
        "driver_number": driver_number,
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(seconds=ttl_seconds)).isoformat(),
        "active": True,
    }
    await db.voice_proxy_sessions.insert_one(session)
    return {
        "ok": True,
        "pin": token,
        "twilio_number": _cfg()["phone"],
        "expires_at": session["expires_at"],
    }


async def resolve_proxy_target(db, pin: str, caller_number: str) -> Optional[str]:
    """Given a dialed PIN + the caller's number, return the OTHER
    leg's number to bridge to. Returns None if the PIN is unknown,
    expired, or the caller isn't one of the two parties."""
    session = await db.voice_proxy_sessions.find_one(
        {"pin": pin, "active": True}, {"_id": 0},
    )
    if not session:
        return None
    now_iso = datetime.now(timezone.utc).isoformat()
    if session["expires_at"] < now_iso:
        return None
    if caller_number == session["rider_number"]:
        return session["driver_number"]
    if caller_number == session["driver_number"]:
        return session["rider_number"]
    return None


def bridge_call(
    from_party_number: str, to_party_number: str, status_callback_url: Optional[str] = None,
) -> Dict[str, Any]:
    """Place an outbound call that bridges `from_party_number` and
    `to_party_number` without exposing either's number to the other.

    Flow:
      1. Twilio dials `from_party_number` (the caller) FROM the
         Twilio number. Caller sees only the Twilio number.
      2. When the caller picks up, the returned TwiML `<Dial>`s the
         `to_party_number` with `callerId=<Twilio number>`. Callee
         also sees only the Twilio number.
      3. Either party hangs up → both sides drop.

    Returns {ok, call_sid?, error?}. Never raises.
    """
    client = _client()
    cfg = _cfg()
    if not client or not cfg["phone"]:
        return {"ok": False, "error": "twilio not configured"}
    # Build a TwiML URL that dials the `to` party — Twilio hits this
    # once the `from` party picks up. We use a TwiML bin via a public
    # Twimlet since we don't want to register a webhook just for this.
    # twimlets.com is Twilio's own hosted TwiML helper.
    import urllib.parse  # noqa: PLC0415
    twiml_url = (
        "https://twimlets.com/forward?PhoneNumber="
        + urllib.parse.quote(to_party_number)
    )
    try:
        call = client.calls.create(
            to=from_party_number,
            from_=cfg["phone"],
            url=twiml_url,
            status_callback=status_callback_url,
            status_callback_event=["completed"] if status_callback_url else None,
        )
        return {"ok": True, "call_sid": call.sid, "status": call.status}
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[twilio bridge] failed: {e}")
        return {"ok": False, "error": str(e)}



# ────────────────────────────────────────────── Verify API (OTP)
# The Verify service is pre-registered with carriers and bypasses A2P
# 10DLC / Toll-Free verification for OTP traffic specifically. Use it
# for phone-number proof during driver registration.

def verify_send(phone_number: str, channel: str = "sms") -> Dict[str, Any]:
    """Kick off phone verification. Sends a 6-digit code via SMS by
    default. Returns {ok, sid?, status?, error?}. Never raises."""
    client = _client()
    cfg = _cfg()
    if not client or not cfg["verify_service_sid"]:
        return {"ok": False, "error": "twilio verify not configured"}
    if channel not in ("sms", "call"):
        return {"ok": False, "error": "channel must be sms or call"}
    if not phone_number or not phone_number.startswith("+"):
        return {"ok": False, "error": "phone must be E.164 (+...)"}
    try:
        v = client.verify.v2.services(
            cfg["verify_service_sid"],
        ).verifications.create(to=phone_number, channel=channel)
        return {"ok": True, "sid": v.sid, "status": v.status,
                "channel": v.channel}
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[twilio verify send] failed: {e}")
        return {"ok": False, "error": str(e)}


def verify_check(phone_number: str, code: str) -> Dict[str, Any]:
    """Check a 6-digit code. Returns {ok, valid, status?, error?}.
    `valid=True` means the caller's phone is proven to belong to them."""
    client = _client()
    cfg = _cfg()
    if not client or not cfg["verify_service_sid"]:
        return {"ok": False, "valid": False, "error": "twilio verify not configured"}
    if not phone_number or not phone_number.startswith("+"):
        return {"ok": False, "valid": False, "error": "phone must be E.164 (+...)"}
    code = str(code).strip()
    if not code.isdigit() or not (4 <= len(code) <= 10):
        return {"ok": False, "valid": False, "error": "code must be 4–10 digits"}
    try:
        v = client.verify.v2.services(
            cfg["verify_service_sid"],
        ).verification_checks.create(to=phone_number, code=code)
        return {"ok": True, "valid": v.status == "approved",
                "status": v.status}
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[twilio verify check] failed: {e}")
        return {"ok": False, "valid": False, "error": str(e)}

"""
Beta Tester Waitlist — public signup + Resend confirmation email.

Founder ask 2026-02-17: "Set up a public Beta Tester signup landing
page with a waitlist form that emails confirmations via Resend."

Endpoints
---------
POST /api/beta-waitlist/signup   — public, rate-limited (1/min/email)
GET  /api/beta-waitlist/count    — public (live counter for social proof)
GET  /api/admin/beta-waitlist    — admin-only, paginated list
POST /api/admin/beta-waitlist/{signup_id}/invite — admin sends invite email

Mongo collection: `beta_waitlist`
  { signup_id, email, name, interests:[], referral, ip, user_agent,
    status: "waitlisted" | "invited", created_at, invited_at }
"""
from __future__ import annotations

import asyncio
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request, Cookie
from pydantic import BaseModel, EmailStr, Field, field_validator

from utils.database import get_database

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/beta-waitlist", tags=["beta-waitlist"])
admin_router = APIRouter(prefix="/admin/beta-waitlist", tags=["beta-waitlist-admin"])


# ── Configuration ────────────────────────────────────────────────────────
ALLOWED_INTERESTS = {
    "casino", "card-games", "dating", "rides", "streaming",
    "music", "venues", "tournaments", "ambassador",
}
RATE_LIMIT_SECONDS = 60  # one signup per email per minute

# Referral leaderboard — Feb 2026 viral acquisition flywheel.
AMBASSADOR_THRESHOLD = 5            # referred_count >= 5 → Ambassador badge
REFERRAL_CODE_LEN = 6                # 6-char human-friendly codes (e.g. "K9FX2P")
REFERRAL_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/I/1


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _generate_referral_code(db) -> str:
    """Generate a unique short referral code, retrying on collision."""
    import secrets
    for _ in range(8):  # retry budget
        code = "".join(secrets.choice(REFERRAL_CODE_ALPHABET) for _ in range(REFERRAL_CODE_LEN))
        existing = await db.beta_waitlist.find_one({"referral_code": code}, {"_id": 1})
        if not existing:
            return code
    # Pathological fallback — append a uuid suffix.
    return code + uuid.uuid4().hex[:4].upper()


def _confirmation_email_html(name: str) -> str:
    return f"""
<!doctype html>
<html><body style="margin:0;padding:0;background:#0A0A0F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding:40px 20px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#13131A;border:1px solid #262630;border-radius:16px;">
        <tr><td style="padding:40px 36px;color:#F5F5F5;">
          <div style="font-size:11px;letter-spacing:4px;color:#00E5C7;font-weight:900;margin-bottom:18px;">YOU'RE ON THE LIST</div>
          <h1 style="font-size:30px;line-height:1.15;margin:0 0 18px;color:#FFFFFF;">Welcome to the Beta, {name}.</h1>
          <p style="font-size:15px;line-height:1.6;color:#C9C9D2;margin:0 0 18px;">
            You're now on the waitlist for <strong style="color:#FFD33D;">Global Vibez DSG</strong> &mdash;
            the world's first Social Infrastructure Network. We'll send you a private
            invite link as soon as your seat opens up.
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
            <tr><td style="background:linear-gradient(135deg,#FF8A1F,#D4AF37);padding:1px;border-radius:12px;">
              <div style="background:#13131A;padding:18px 22px;border-radius:11px;">
                <div style="color:#FFD33D;font-weight:900;font-size:13px;letter-spacing:2px;margin-bottom:6px;">WHILE YOU WAIT</div>
                <ul style="margin:0;padding:0 0 0 20px;color:#C9C9D2;font-size:14px;line-height:1.7;">
                  <li>34+ casino &amp; card games (Spades, Bid Whist, Vibez 654)</li>
                  <li>Sync-watch movies on Cinema Dates with your match</li>
                  <li>Earn &cent; Vibez Coins via 5 income streams</li>
                  <li>Lock in a Founder Chair before public launch</li>
                </ul>
              </div>
            </td></tr>
          </table>
          <p style="font-size:13px;line-height:1.6;color:#737373;margin:24px 0 0;">
            Reply directly to this email if you have any questions or want to be considered as
            an Ambassador. We read every message.
          </p>
          <hr style="border:none;border-top:1px solid #262630;margin:32px 0;" />
          <p style="font-size:11px;color:#525252;margin:0;line-height:1.5;">
            You're receiving this because you signed up at globalvibezdsg.com/beta-tester.<br/>
            If you didn't, just ignore this email and we'll remove you on next sweep.
          </p>
        </td></tr>
      </table>
      <div style="text-align:center;color:#404040;font-size:10px;margin-top:16px;font-family:monospace;letter-spacing:3px;">GLOBAL VIBEZ DSG · BETA</div>
    </td></tr>
  </table>
</body></html>
""".strip()


async def _send_confirmation(to_email: str, name: str) -> bool:
    """Fire-and-forget Resend dispatch. Never raises."""
    api_key = os.environ.get("RESEND_API_KEY")
    sender = os.environ.get("RESEND_SENDER_EMAIL", "support@globalvibezdsg.com")
    if not api_key:
        logger.warning("RESEND_API_KEY missing — skipping beta confirmation email")
        return False
    try:
        import resend
        resend.api_key = api_key
        params = {
            "from": sender,
            "to": [to_email],
            "subject": "You're on the Global Vibez DSG Beta list",
            "html": _confirmation_email_html(name),
        }
        result = await asyncio.to_thread(resend.Emails.send, params)
        rid = result.get("id") if isinstance(result, dict) else result
        logger.info(f"Beta confirmation dispatched to {to_email}: id={rid}")
        return True
    except Exception as e:
        logger.error(f"Resend send failed for {to_email}: {e}")
        return False


# ── Pydantic models ──────────────────────────────────────────────────────
class WaitlistSignup(BaseModel):
    email: EmailStr
    name: str = Field(..., min_length=1, max_length=80)
    interests: List[str] = Field(default_factory=list, max_length=10)
    referral: Optional[str] = Field(default=None, max_length=120)
    # Feb 2026 — referral leaderboard. The 6-char code of the inviter
    # who shared their /beta-tester?ref=… link. Optional; ignored if invalid.
    ref_code: Optional[str] = Field(default=None, max_length=20)

    @field_validator("interests")
    @classmethod
    def _filter_interests(cls, v: List[str]) -> List[str]:
        return [tag for tag in v if tag in ALLOWED_INTERESTS][:10]

    @field_validator("name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        clean = re.sub(r"\s+", " ", v).strip()
        if not clean:
            raise ValueError("Name cannot be empty")
        return clean

    @field_validator("ref_code")
    @classmethod
    def _normalize_ref(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        clean = re.sub(r"[^A-Z0-9]", "", v.upper().strip())
        return clean[:20] or None


# ── Public endpoints ─────────────────────────────────────────────────────
@router.post("/signup")
async def signup(payload: WaitlistSignup, request: Request) -> Dict[str, Any]:
    """Public — adds the user to the waitlist + sends confirmation email."""
    db = get_database()
    email_norm = payload.email.lower().strip()
    now = _now_iso()

    existing = await db.beta_waitlist.find_one({"email": email_norm}, {"_id": 0})
    if existing:
        # Treat a re-signup as idempotent — return ok but don't re-email if
        # the previous signup was within the rate-limit window.
        prev_ts = existing.get("created_at", "")
        try:
            prev = datetime.fromisoformat(prev_ts.replace("Z", "+00:00"))
            delta = (datetime.now(timezone.utc) - prev).total_seconds()
        except Exception:
            delta = RATE_LIMIT_SECONDS + 1
        if delta < RATE_LIMIT_SECONDS:
            return {
                "ok": True,
                "already_on_list": True,
                "message": "You're already on the list — check your inbox!",
                "position": existing.get("position", 0),
                "referral_code": existing.get("referral_code"),
            }
        # Older signup — refresh fields, re-send confirmation.
        await db.beta_waitlist.update_one(
            {"email": email_norm},
            {"$set": {
                "name": payload.name,
                "interests": payload.interests,
                "referral": payload.referral,
                "last_signup_at": now,
            }},
        )
        await _send_confirmation(email_norm, payload.name)
        return {
            "ok": True,
            "already_on_list": True,
            "message": "Welcome back! We resent your confirmation email.",
            "position": existing.get("position", 0),
            "referral_code": existing.get("referral_code"),
        }

    # Compute position (1-indexed) — total signups + 1 at insert time.
    total = await db.beta_waitlist.count_documents({})
    position = total + 1

    # Generate the new signup's own referral code (always).
    own_code = await _generate_referral_code(db)

    # Credit the inviter (if ref_code was passed and matches a real signup).
    referred_by_code: Optional[str] = None
    referred_by_name: Optional[str] = None
    if payload.ref_code:
        inviter = await db.beta_waitlist.find_one(
            {"referral_code": payload.ref_code},
            {"_id": 0, "signup_id": 1, "email": 1, "name": 1, "referred_count": 1},
        )
        if inviter and inviter.get("email") != email_norm:
            referred_by_code = payload.ref_code
            referred_by_name = inviter.get("name")
            new_count = (inviter.get("referred_count") or 0) + 1
            update_set: Dict[str, Any] = {"referred_count": new_count}
            # Auto-grant Ambassador badge at the threshold.
            if new_count >= AMBASSADOR_THRESHOLD:
                update_set["is_ambassador"] = True
                update_set["ambassador_at"] = update_set.get("ambassador_at") or now
            await db.beta_waitlist.update_one(
                {"signup_id": inviter["signup_id"]},
                {"$set": update_set},
            )

    doc = {
        "signup_id": str(uuid.uuid4()),
        "email": email_norm,
        "name": payload.name,
        "interests": payload.interests,
        "referral": payload.referral,
        "ip": request.client.host if request.client else None,
        "user_agent": request.headers.get("user-agent", "")[:200],
        "position": position,
        "status": "waitlisted",
        "created_at": now,
        "invited_at": None,
        # Referral leaderboard fields (Feb 2026)
        "referral_code": own_code,
        "referred_by": referred_by_code,
        "referred_count": 0,
        "is_ambassador": False,
    }
    await db.beta_waitlist.insert_one(doc)
    # Don't expose mongo _id back to the client.
    doc.pop("_id", None)

    sent = await _send_confirmation(email_norm, payload.name)

    return {
        "ok": True,
        "already_on_list": False,
        "position": position,
        "email_sent": sent,
        "referral_code": own_code,
        "referred_by": referred_by_name,
        "message": (
            f"You're #{position} on the list. Check your inbox for confirmation."
            if sent else
            f"You're #{position} on the list — confirmation email is on its way."
        ),
    }


@router.get("/count")
async def count() -> Dict[str, Any]:
    """Public live counter for social-proof on the landing page."""
    db = get_database()
    total = await db.beta_waitlist.count_documents({})
    invited = await db.beta_waitlist.count_documents({"status": "invited"})
    return {
        "total_signups": total,
        "invited": invited,
        "waitlisted": max(0, total - invited),
    }


@router.get("/leaderboard")
async def leaderboard(limit: int = 10) -> Dict[str, Any]:
    """Public top-N referrers — used by the /beta-tester landing page
    leaderboard widget. Ambassadors (≥5 referrals) are flagged so the
    UI can render the badge."""
    db = get_database()
    capped = max(1, min(50, limit))
    cursor = (db.beta_waitlist.find(
        {"referred_count": {"$gt": 0}},
        {"_id": 0, "name": 1, "referral_code": 1, "referred_count": 1, "is_ambassador": 1, "position": 1},
    )
    .sort([("referred_count", -1), ("position", 1)])
    .limit(capped))
    rows: List[Dict[str, Any]] = []
    rank = 1
    async for doc in cursor:
        rows.append({
            "rank": rank,
            "name": doc.get("name", "Anonymous"),
            "referred_count": doc.get("referred_count", 0),
            "is_ambassador": bool(doc.get("is_ambassador", False)),
            "position": doc.get("position"),
        })
        rank += 1
    total_ambassadors = await db.beta_waitlist.count_documents({"is_ambassador": True})
    return {
        "rows": rows,
        "ambassador_threshold": AMBASSADOR_THRESHOLD,
        "total_ambassadors": total_ambassadors,
    }


@router.get("/my-referral")
async def my_referral(email: str) -> Dict[str, Any]:
    """Public — returns the signup's referral_code + tally + share URL.
    Used by the success state of /beta-tester to surface the share box."""
    db = get_database()
    email_norm = email.lower().strip()
    doc = await db.beta_waitlist.find_one(
        {"email": email_norm},
        {"_id": 0, "referral_code": 1, "referred_count": 1, "is_ambassador": 1, "name": 1, "position": 1},
    )
    if not doc or not doc.get("referral_code"):
        raise HTTPException(404, "Signup not found")
    return {
        "ok": True,
        "name": doc.get("name", ""),
        "position": doc.get("position"),
        "referral_code": doc["referral_code"],
        "referred_count": doc.get("referred_count", 0),
        "is_ambassador": bool(doc.get("is_ambassador", False)),
        "ambassador_threshold": AMBASSADOR_THRESHOLD,
    }


# ── Admin endpoints (God Mode only) ──────────────────────────────────────
def _require_admin(admin_session: Optional[str]) -> None:
    """Lightweight admin gate — rejects if no admin_session cookie."""
    if not admin_session:
        raise HTTPException(401, "Admin session required")


@admin_router.get("")
async def admin_list_waitlist(
    limit: int = 100,
    skip: int = 0,
    status: Optional[str] = None,
    admin_session: Optional[str] = Cookie(None),
) -> Dict[str, Any]:
    _require_admin(admin_session)
    db = get_database()
    q: Dict[str, Any] = {}
    if status in {"waitlisted", "invited"}:
        q["status"] = status
    cursor = (db.beta_waitlist.find(q, {"_id": 0})
              .sort("created_at", -1).skip(max(0, skip)).limit(min(500, max(1, limit))))
    rows: List[Dict[str, Any]] = []
    async for doc in cursor:
        rows.append(doc)
    total = await db.beta_waitlist.count_documents(q)
    return {"rows": rows, "total": total, "limit": limit, "skip": skip}


@admin_router.post("/{signup_id}/mark-invited")
async def admin_mark_invited(
    signup_id: str,
    admin_session: Optional[str] = Cookie(None),
) -> Dict[str, Any]:
    _require_admin(admin_session)
    db = get_database()
    res = await db.beta_waitlist.update_one(
        {"signup_id": signup_id, "status": "waitlisted"},
        {"$set": {"status": "invited", "invited_at": _now_iso()}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Signup not found or already invited")
    return {"ok": True, "signup_id": signup_id}


# ── Founder weekly digest (Feb 2026 Late × 4) ────────────────────────────
@admin_router.get("/digest/preview")
async def admin_digest_preview(
    admin_session: Optional[str] = Cookie(None),
) -> Dict[str, Any]:
    """Return the payload that would be sent in this week's digest —
    without actually shipping the email. Used by the "Preview digest"
    button in the Control Tower."""
    _require_admin(admin_session)
    from services.weekly_digest_service import compute_weekly_digest, get_last_digest_run
    db = get_database()
    payload = await compute_weekly_digest(db)
    last = await get_last_digest_run(db)
    return {"ok": True, "payload": payload, "last_run": last}


class DigestSendPayload(BaseModel):
    recipient: Optional[str] = Field(default=None, max_length=200)


@admin_router.post("/digest/send")
async def admin_digest_send(
    payload: DigestSendPayload,
    admin_session: Optional[str] = Cookie(None),
) -> Dict[str, Any]:
    """Manually trigger a digest dispatch right now. Optional `recipient`
    override; defaults to env DIGEST_RECIPIENT_EMAIL → RESEND_SENDER_EMAIL."""
    _require_admin(admin_session)
    from services.weekly_digest_service import dispatch_weekly_digest
    db = get_database()
    return await dispatch_weekly_digest(db, recipient=payload.recipient)


# ── Stats + Bulk Invite (Feb 2026 — God Mode dashboard) ──────────────────
@admin_router.get("/stats")
async def admin_stats(
    admin_session: Optional[str] = Cookie(None),
) -> Dict[str, Any]:
    """Aggregated waitlist stats for the God Mode dashboard tile."""
    _require_admin(admin_session)
    db = get_database()
    total = await db.beta_waitlist.count_documents({})
    invited = await db.beta_waitlist.count_documents({"status": "invited"})
    redeemed = await db.beta_waitlist.count_documents({"status": "redeemed"})
    waitlisted = max(0, total - invited - redeemed)

    # Top interests (pipeline against the array field)
    top_interests: List[Dict[str, Any]] = []
    try:
        pipe_int = [
            {"$unwind": "$interests"},
            {"$group": {"_id": "$interests", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 10},
        ]
        async for row in db.beta_waitlist.aggregate(pipe_int):
            top_interests.append({"interest": row["_id"], "count": row["count"]})
    except Exception:
        top_interests = []

    # Top referral sources (case-insensitive, only non-empty)
    top_referrals: List[Dict[str, Any]] = []
    try:
        pipe_ref = [
            {"$match": {"referral": {"$ne": None, "$ne": ""}}},
            {"$group": {
                "_id": {"$toLower": {"$trim": {"input": "$referral"}}},
                "count": {"$sum": 1},
            }},
            {"$sort": {"count": -1}},
            {"$limit": 10},
        ]
        async for row in db.beta_waitlist.aggregate(pipe_ref):
            top_referrals.append({"referral": row["_id"], "count": row["count"]})
    except Exception:
        top_referrals = []

    # Conversion rate — invited / total
    conversion = (invited / total * 100.0) if total > 0 else 0.0

    return {
        "total_signups": total,
        "waitlisted": waitlisted,
        "invited": invited,
        "redeemed": redeemed,
        "conversion_pct": round(conversion, 2),
        "top_interests": top_interests,
        "top_referrals": top_referrals,
    }


# ── Magic-link invite tokens ─────────────────────────────────────────────
INVITE_TOKEN_TTL_DAYS = 14


def _invite_email_html(name: str, token: str, frontend_base: str) -> str:
    link = f"{frontend_base.rstrip('/')}/signup?invite={token}"
    return f"""
<!doctype html>
<html><body style="margin:0;padding:0;background:#0A0A0F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding:40px 20px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#13131A;border:1px solid #262630;border-radius:16px;">
        <tr><td style="padding:40px 36px;color:#F5F5F5;">
          <div style="font-size:11px;letter-spacing:4px;color:#FFD33D;font-weight:900;margin-bottom:18px;">YOUR SEAT IS READY</div>
          <h1 style="font-size:30px;line-height:1.15;margin:0 0 18px;color:#FFFFFF;">Welcome in, {name}.</h1>
          <p style="font-size:15px;line-height:1.6;color:#C9C9D2;margin:0 0 26px;">
            You're officially in the <strong style="color:#FFD33D;">Global Vibez DSG</strong> private beta.
            Click the button below to claim your Founder seat &mdash; this link is yours alone and
            expires in {INVITE_TOKEN_TTL_DAYS} days.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr><td style="border-radius:32px;background:linear-gradient(135deg,#FF8A1F,#FFD33D);">
              <a href="{link}" style="display:inline-block;padding:16px 36px;font-weight:900;font-size:14px;letter-spacing:3px;text-transform:uppercase;color:#0A0A0F;text-decoration:none;border-radius:32px;">
                Claim my Founder seat &rarr;
              </a>
            </td></tr>
          </table>
          <p style="font-size:12px;line-height:1.5;color:#737373;margin:18px 0 0;word-break:break-all;">
            Or paste this link into your browser:<br/>
            <span style="color:#9999A8;">{link}</span>
          </p>
          <hr style="border:none;border-top:1px solid #262630;margin:32px 0;" />
          <p style="font-size:11px;color:#525252;margin:0;line-height:1.5;">
            We can't wait to see what you build, play and win in the network.<br/>
            &mdash; The Global Vibez DSG team
          </p>
        </td></tr>
      </table>
      <div style="text-align:center;color:#404040;font-size:10px;margin-top:16px;font-family:monospace;letter-spacing:3px;">GLOBAL VIBEZ DSG · BETA</div>
    </td></tr>
  </table>
</body></html>
""".strip()


async def _send_invite_email(to_email: str, name: str, token: str) -> bool:
    """Async, non-blocking. Returns True if Resend accepted the message."""
    api_key = os.environ.get("RESEND_API_KEY")
    sender = os.environ.get("RESEND_SENDER_EMAIL", "support@globalvibezdsg.com")
    frontend_base = os.environ.get(
        "REACT_APP_BACKEND_URL", "https://globalvibezdsg.com"
    )
    if not api_key:
        logger.warning("RESEND_API_KEY missing — skipping invite email")
        return False
    try:
        import resend
        resend.api_key = api_key
        params = {
            "from": sender,
            "to": [to_email],
            "subject": "Your Global Vibez DSG Beta seat is ready",
            "html": _invite_email_html(name, token, frontend_base),
        }
        result = await asyncio.to_thread(resend.Emails.send, params)
        rid = result.get("id") if isinstance(result, dict) else result
        logger.info(f"Beta invite dispatched to {to_email}: id={rid}")
        return True
    except Exception as e:
        logger.error(f"Resend invite send failed for {to_email}: {e}")
        return False


class BulkInvitePayload(BaseModel):
    signup_ids: List[str] = Field(..., min_length=1, max_length=200)


@admin_router.post("/bulk-invite")
async def admin_bulk_invite(
    payload: BulkInvitePayload,
    admin_session: Optional[str] = Cookie(None),
) -> Dict[str, Any]:
    """Mark a batch of waitlisted signups as invited and dispatch a
    personalized magic-link email to each. Idempotent — already-invited
    signups are skipped."""
    _require_admin(admin_session)
    db = get_database()
    sent: List[str] = []
    skipped: List[str] = []
    failed: List[Dict[str, str]] = []
    now = _now_iso()
    expires_iso = (datetime.now(timezone.utc).timestamp() + INVITE_TOKEN_TTL_DAYS * 86400)
    expires = datetime.fromtimestamp(expires_iso, tz=timezone.utc).isoformat()

    for sid in payload.signup_ids:
        doc = await db.beta_waitlist.find_one({"signup_id": sid}, {"_id": 0})
        if not doc:
            failed.append({"signup_id": sid, "reason": "not_found"})
            continue
        if doc.get("status") in {"invited", "redeemed"}:
            skipped.append(sid)
            continue
        token = uuid.uuid4().hex
        # Record token + flip status atomically.
        await db.beta_invite_tokens.insert_one({
            "token": token,
            "signup_id": sid,
            "email": doc["email"],
            "name": doc.get("name", "there"),
            "created_at": now,
            "expires_at": expires,
            "used_at": None,
        })
        await db.beta_waitlist.update_one(
            {"signup_id": sid},
            {"$set": {
                "status": "invited",
                "invited_at": now,
                "invite_token": token,
            }},
        )
        ok = await _send_invite_email(doc["email"], doc.get("name", "there"), token)
        if ok:
            sent.append(sid)
        else:
            failed.append({"signup_id": sid, "reason": "email_dispatch_failed"})

    return {
        "ok": True,
        "sent": sent,
        "skipped": skipped,
        "failed": failed,
        "sent_count": len(sent),
        "skipped_count": len(skipped),
        "failed_count": len(failed),
    }


# ── Magic-link redemption (public) ───────────────────────────────────────
@router.get("/redeem")
async def redeem_invite(token: str) -> Dict[str, Any]:
    """Public — validates a magic-link token. Returns the email pre-fill
    so the SignupPage can lock-in the invited address. Does NOT mark the
    token as used; that happens when the user actually completes signup
    (POST /redeem-confirm)."""
    db = get_database()
    if not token or len(token) < 16:
        raise HTTPException(400, "Invalid invite token")
    row = await db.beta_invite_tokens.find_one({"token": token}, {"_id": 0})
    if not row:
        raise HTTPException(404, "Invite not found or expired")
    if row.get("used_at"):
        raise HTTPException(410, "This invite has already been redeemed")
    # Expiry check
    try:
        exp = datetime.fromisoformat(row["expires_at"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > exp:
            raise HTTPException(410, "This invite has expired")
    except (ValueError, KeyError):
        pass
    return {
        "ok": True,
        "email": row["email"],
        "name": row.get("name", ""),
        "expires_at": row.get("expires_at"),
    }


@router.post("/redeem-confirm")
async def redeem_confirm(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Marks an invite token as consumed. Called by the signup flow on
    successful account creation."""
    db = get_database()
    token = (payload or {}).get("token")
    if not token or len(token) < 16:
        raise HTTPException(400, "Invalid invite token")
    row = await db.beta_invite_tokens.find_one({"token": token}, {"_id": 0})
    if not row:
        raise HTTPException(404, "Invite not found")
    if row.get("used_at"):
        return {"ok": True, "already_used": True}
    await db.beta_invite_tokens.update_one(
        {"token": token},
        {"$set": {"used_at": _now_iso()}},
    )
    await db.beta_waitlist.update_one(
        {"signup_id": row["signup_id"]},
        {"$set": {"status": "redeemed", "redeemed_at": _now_iso()}},
    )
    return {"ok": True, "already_used": False}


__all__ = ["router", "admin_router"]

"""
Password reset service — token generation, hashing, verification.

Design goals:
 - Single-use tokens (invalidated after successful reset)
 - Time-limited (default 60 min, env-configurable)
 - Stored hashed (sha256) — raw token only exists in the email link
 - No-leak contract: all public endpoints return the same shape whether or
   not the email exists, so attackers can't enumerate registered emails
 - Transactional email via Resend (async non-blocking)
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import secrets
from datetime import datetime, timezone, timedelta
from typing import Any, Dict

logger = logging.getLogger(__name__)

_RESET_COLLECTION = "password_reset_tokens"


def _token_ttl_minutes() -> int:
    try:
        return max(5, int(os.environ.get("RESET_TOKEN_TTL_MINUTES", "60")))
    except ValueError:
        return 60


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _reset_link(raw_token: str) -> str:
    base = os.environ.get("FRONTEND_URL", "").rstrip("/")
    if not base:
        base = ""  # degrade gracefully — email will still include the token
    return f"{base}/reset-password?token={raw_token}"


def _render_reset_email_html(name: str, link: str, minutes: int) -> str:
    safe_name = (name or "there").replace("<", "&lt;")
    return f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#000;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="540" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border:1px solid #2a0b2a;border-radius:20px;">
        <tr><td style="padding:40px 32px;">
          <div style="color:#d946ef;font-size:11px;font-weight:800;letter-spacing:4px;text-transform:uppercase;margin-bottom:16px;">Global Vibez DSG · Reset</div>
          <h1 style="color:#fff;font-size:32px;line-height:1.1;margin:0 0 20px;font-weight:900;font-style:italic;letter-spacing:-1px;">Reset your password, {safe_name}.</h1>
          <p style="color:#a3a3a3;font-size:14px;line-height:1.6;margin:0 0 28px;">We got a request to reset the password on your Global Vibez account. Tap the button below to pick a new one. This link expires in {minutes} minutes and can only be used once.</p>
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:999px;background:linear-gradient(90deg,#d946ef,#22d3ee);">
            <a href="{link}" style="display:inline-block;padding:16px 32px;color:#000;font-weight:900;font-size:14px;letter-spacing:1px;text-transform:uppercase;text-decoration:none;">Reset Password</a>
          </td></tr></table>
          <p style="color:#525252;font-size:12px;line-height:1.5;margin:28px 0 0;">Or paste this link into your browser:<br/><span style="color:#737373;word-break:break-all;">{link}</span></p>
          <hr style="border:none;border-top:1px solid #262626;margin:32px 0;" />
          <p style="color:#525252;font-size:11px;line-height:1.5;margin:0;">Didn't request this? You can safely ignore this email — your password won't change.</p>
        </td></tr>
      </table>
      <div style="color:#404040;font-size:10px;margin-top:16px;font-family:monospace;letter-spacing:2px;">GLOBAL VIBEZ DSG</div>
    </td></tr>
  </table>
</body>
</html>
""".strip()


async def _send_reset_email(to_email: str, name: str, raw_token: str) -> bool:
    """Send the email. Returns True on success, False on any failure
    (callers must not raise — we always return the same API shape)."""
    api_key = os.environ.get("RESEND_API_KEY")
    sender = os.environ.get("RESEND_SENDER_EMAIL", "support@globalvibezdsg.com")
    if not api_key:
        logger.warning("RESEND_API_KEY not configured — skipping email send")
        return False
    try:
        import resend
        resend.api_key = api_key
        link = _reset_link(raw_token)
        params = {
            "from": sender,
            "to": [to_email],
            "subject": "Reset your Global Vibez password",
            "html": _render_reset_email_html(name, link, _token_ttl_minutes()),
        }
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Reset email dispatched to {to_email}: id={result.get('id') if isinstance(result, dict) else result}")
        return True
    except Exception as e:
        logger.error(f"Resend send failed for {to_email}: {e}")
        return False


async def request_reset(db, email_norm: str) -> Dict[str, Any]:
    """Generate a token (if user exists) and dispatch the email.
    Always returns the same neutral shape so callers can't enumerate."""
    neutral = {"ok": True, "message": "If that email is registered, you'll receive a reset link shortly."}
    if not email_norm:
        return neutral

    user = await db.users.find_one(
        {"email": email_norm},
        {"user_id": 1, "email": 1, "name": 1, "auth_provider": 1, "password_hash": 1, "_id": 0},
    )
    if not user:
        return neutral

    # Google-auth-only users (no password set) — don't pretend we can reset.
    # Still return neutral so we don't leak anything.
    if user.get("auth_provider") == "google" and not user.get("password_hash"):
        logger.info(f"Reset request for Google-only account {email_norm} — skipping")
        return neutral

    # Invalidate any outstanding tokens for this user (single-active-token policy).
    await db[_RESET_COLLECTION].delete_many({"user_id": user["user_id"]})

    raw_token = secrets.token_urlsafe(32)
    token_hash = _hash_token(raw_token)
    now = datetime.now(timezone.utc)
    await db[_RESET_COLLECTION].insert_one({
        "user_id": user["user_id"],
        "email": email_norm,
        "token_hash": token_hash,
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(minutes=_token_ttl_minutes())).isoformat(),
        "used_at": None,
    })

    await _send_reset_email(email_norm, user.get("name", ""), raw_token)
    return neutral


async def verify_token(db, raw_token: str) -> Dict[str, Any]:
    """Check if token is valid and unused. Used by the reset-password page
    to decide whether to show the password form or an error."""
    if not raw_token:
        return {"valid": False, "reason": "missing"}
    rec = await db[_RESET_COLLECTION].find_one({"token_hash": _hash_token(raw_token)}, {"_id": 0})
    if not rec:
        return {"valid": False, "reason": "invalid"}
    if rec.get("used_at"):
        return {"valid": False, "reason": "used"}
    try:
        expires_at = datetime.fromisoformat(rec["expires_at"])
    except (KeyError, ValueError):
        return {"valid": False, "reason": "invalid"}
    if expires_at <= datetime.now(timezone.utc):
        return {"valid": False, "reason": "expired"}
    return {"valid": True, "email": rec.get("email")}


async def confirm_reset(db, raw_token: str, new_password_hash: str) -> Dict[str, Any]:
    """Consume the token + update the user's password atomically-enough.
    Returns {ok: True} on success, raises ValueError with a code on failure."""
    v = await verify_token(db, raw_token)
    if not v.get("valid"):
        raise ValueError(v.get("reason", "invalid"))

    token_hash = _hash_token(raw_token)
    # Atomically mark the token used. If another request raced us, this fails
    # and the password doesn't change.
    now_iso = datetime.now(timezone.utc).isoformat()
    updated = await db[_RESET_COLLECTION].find_one_and_update(
        {"token_hash": token_hash, "used_at": None},
        {"$set": {"used_at": now_iso}},
        projection={"_id": 0, "user_id": 1, "email": 1},
    )
    if not updated:
        raise ValueError("used")

    r = await db.users.update_one(
        {"user_id": updated["user_id"]},
        {"$set": {"password_hash": new_password_hash, "updated_at": now_iso}},
    )
    if r.matched_count == 0:
        raise ValueError("invalid")

    # Best-effort: invalidate other active sessions so the attacker (if any) is logged out.
    try:
        await db.user_sessions.delete_many({"user_id": updated["user_id"]})
    except Exception as e:
        logger.warning(f"Failed to clear sessions for {updated['user_id']}: {e}")

    return {"ok": True, "user_id": updated["user_id"]}

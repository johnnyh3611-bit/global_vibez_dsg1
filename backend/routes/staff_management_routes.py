"""
Staff Management API Routes

God-Mode endpoints for:
- Inviting staff members
- Managing role levels
- Revoking staff access
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Dict, Any
import secrets
import os

import bcrypt

from config import db
from middleware.permissions import (
    require_god_mode,
    ROLE_NAMES,
    set_user_role
)

router = APIRouter(prefix="/v1/admin", tags=["Admin - Staff Management"])


# === REQUEST MODELS ===

class StaffInvite(BaseModel):
    email: EmailStr
    role_level: int


class RoleUpdate(BaseModel):
    role_level: int


class StaffSetupPassword(BaseModel):
    """Body for completing the staff invite flow."""
    token: str = Field(..., min_length=10)
    password: str = Field(..., min_length=10, max_length=128)
    username: str = Field(..., min_length=3, max_length=40)


def _hash_password(plain: str) -> str:
    """Bcrypt-hash a plaintext password (cost 12)."""
    return bcrypt.hashpw(
        plain.encode("utf-8"),
        bcrypt.gensalt(rounds=12),
    ).decode("utf-8")


async def _send_staff_invite_email(email: str, invite_link: str, role_name: str) -> bool:
    """Send the staff-invite email via Resend if RESEND_API_KEY is set."""
    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        return False
    try:
        import resend  # type: ignore
        resend.api_key = api_key
        sender = os.environ.get("RESEND_FROM", "Global Vibez DSG <noreply@globalvibez.com>")
        resend.Emails.send({
            "from": sender,
            "to": [email],
            "subject": f"You're invited to join Global Vibez DSG as {role_name}",
            "html": (
                "<div style='font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px'>"
                "<h1 style='color:#facc15;font-size:24px'>Welcome to Global Vibez DSG</h1>"
                f"<p>You've been invited to join the staff as <strong>{role_name}</strong>.</p>"
                "<p>Tap the button below to set up your password and activate your account. Link expires in 7 days.</p>"
                f"<p style='margin:32px 0'><a href='{invite_link}' style='background:#facc15;color:#0f172a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold'>Activate my account</a></p>"
                f"<p style='font-size:12px;color:#64748b'>If the button doesn't work, paste this URL into your browser:<br>{invite_link}</p>"
                "</div>"
            ),
        })
        return True
    except Exception:
        return False


# === STAFF MANAGEMENT ENDPOINTS ===

@router.post("/invite-staff", dependencies=[Depends(require_god_mode)])
async def invite_staff_member(invite: StaffInvite, request: Request) -> Dict[str, Any]:
    """Invite a new staff member (God-Mode only).

    Generates an invite token, creates a pending staff account, and emails
    the invite link via Resend (if RESEND_API_KEY is configured).
    """
    # Validate role level
    if invite.role_level not in [1, 2, 3]:
        raise HTTPException(
            status_code=400,
            detail="Invalid role level. Must be 1 (Floor Staff), 2 (Manager), or 3 (God-Mode)"
        )
    
    # Check if email already exists (case-insensitive normalization)
    invite_email_norm = (invite.email or "").strip().lower()
    existing = await db.users.find_one({"email": invite_email_norm}, {"_id": 0})
    if existing:
        raise HTTPException(
            status_code=400,
            detail="User with this email already exists"
        )
    
    # Generate secure invite token
    invite_token = secrets.token_urlsafe(32)
    
    # Resolve the actual admin user from the auth header so the audit
    # log shows WHO invited this staff member (not generic "god_mode").
    invited_by = "god_mode"
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        token = auth.split(" ", 1)[1].strip()
        sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
        if sess and sess.get("user_id"):
            invited_by = sess["user_id"]

    # Create pending staff account
    staff_account = {
        "id": f"staff-{secrets.token_urlsafe(16)}",
        "email": invite_email_norm,
        "role_level": invite.role_level,
        "role_name": ROLE_NAMES[invite.role_level],
        "status": "pending_setup",
        "invite_token": invite_token,
        "invited_at": datetime.utcnow(),
        "invited_by": invited_by,
        "created_at": datetime.utcnow()
    }

    await db.users.insert_one(staff_account)

    invite_link = f"{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/staff/setup?token={invite_token}"

    # Send email via Resend (no-ops if RESEND_API_KEY is missing).
    email_sent = await _send_staff_invite_email(
        invite_email_norm, invite_link, ROLE_NAMES[invite.role_level],
    )

    return {
        "message": "Staff invite created successfully",
        "email": invite.email,
        "role": ROLE_NAMES[invite.role_level],
        "invite_link": invite_link,
        "invite_token": invite_token,
        "email_sent": email_sent,
    }


@router.get("/staff-list", dependencies=[Depends(require_god_mode)])
async def get_staff_list() -> Dict[str, Any]:
    """
    Get list of all staff members (God-Mode only).
    """
    staff = await db.users.find(
        {"role_level": {"$gte": 1}},
        {"_id": 0, "password_hash": 0, "invite_token": 0}
    ).to_list(1000)
    
    return {
        "count": len(staff),
        "staff": staff
    }


@router.put("/staff/{staff_id}/role", dependencies=[Depends(require_god_mode)])
async def update_staff_role(staff_id: str, role_update: RoleUpdate) -> Dict[str, Any]:
    """
    Change a staff member's role level (God-Mode only).
    """
    # Validate role level
    if role_update.role_level not in [1, 2, 3]:
        raise HTTPException(
            status_code=400,
            detail="Invalid role level"
        )
    
    # Check if staff exists
    staff = await db.users.find_one({"id": staff_id}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    
    # Update role
    await set_user_role(staff_id, role_update.role_level)
    
    return {
        "message": "Role updated successfully",
        "staff_id": staff_id,
        "new_role": ROLE_NAMES[role_update.role_level]
    }


@router.post("/staff/{staff_id}/revoke", dependencies=[Depends(require_god_mode)])
async def revoke_staff_access(staff_id: str) -> Dict[str, Any]:
    """
    Revoke staff access (convert to regular user) (God-Mode only).
    """
    staff = await db.users.find_one({"id": staff_id}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    
    # Remove staff role
    await db.users.update_one(
        {"id": staff_id},
        {
            "$set": {
                "role_level": 0,
                "role_name": "Regular User",
                "access_revoked_at": datetime.utcnow()
            }
        }
    )
    
    return {
        "message": "Staff access revoked successfully",
        "staff_id": staff_id
    }


@router.post("/staff/setup-password")
async def setup_staff_password(payload: StaffSetupPassword) -> Dict[str, Any]:
    """Complete staff account setup (password + username).

    Public endpoint — uses the one-time invite token for auth. The
    plaintext password is bcrypt-hashed before storage.
    """
    # Find staff by invite token
    staff = await db.users.find_one({"invite_token": payload.token}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Invalid or expired invite token")

    if staff.get("status") != "pending_setup":
        raise HTTPException(status_code=400, detail="Account already activated")

    password_hash = _hash_password(payload.password)

    await db.users.update_one(
        {"invite_token": payload.token},
        {
            "$set": {
                "username": payload.username,
                "password_hash": password_hash,
                "status": "active",
                "activated_at": datetime.utcnow()
            },
            "$unset": {"invite_token": ""}
        }
    )

    return {
        "message": "Staff account activated successfully",
        "username": payload.username,
        "role": staff.get("role_name")
    }


@router.post("/staff/{staff_id}/revoke", dependencies=[Depends(require_god_mode)])
async def revoke_staff_access_legacy(staff_id: str) -> Dict[str, Any]:
    """Revoke staff access (convert to regular user) (God-Mode only).

    Idempotent — safe to call against a staff_id that is already
    revoked. Returns 404 only if the staff_id was never an account.
    """
    staff = await db.users.find_one({"id": staff_id}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")

    await db.users.update_one(
        {"id": staff_id},
        {
            "$set": {
                "role_level": 0,
                "role_name": "Regular User",
                "access_revoked_at": datetime.utcnow()
            }
        }
    )

    return {
        "message": "Staff access revoked successfully",
        "staff_id": staff_id
    }

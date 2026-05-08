"""
Staff Permission System

Role levels:
- Level 3: God-Mode (Founder) - All permissions
- Level 2: Manager - Game management, user moderation, view finances (not approve payouts)
- Level 1: Floor Staff - Chat moderation, basic player support
"""

from fastapi import HTTPException, Depends, Header, Cookie
from typing import Optional
from config import db
from routes.admin_dashboard import verify_admin_session


# === ROLE LEVEL CONSTANTS ===

ROLE_FLOOR_STAFF = 1
ROLE_MANAGER = 2
ROLE_GOD_MODE = 3

ROLE_NAMES = {
    1: "Floor Staff",
    2: "Manager",
    3: "God-Mode (Founder)"
}


# === PERMISSION DEPENDENCIES ===

# Synthetic user returned when the request is authenticated via the Vault
# HttpOnly cookie rather than a Bearer token.  This unifies the two admin
# auth systems: a founder logged in through /api/admin/vault-auth gets the
# same downstream access as a Bearer-token God-Mode user.
_VAULT_FOUNDER = {
    "id": "__vault_founder__",
    "role_level": ROLE_GOD_MODE,
    "role_name": ROLE_NAMES[ROLE_GOD_MODE],
    "auth_source": "vault_cookie",
}


async def get_current_user_from_token(
    authorization: Optional[str] = Header(None),
    admin_session: Optional[str] = Cookie(None),
):
    """
    Resolve the caller to a user record.

    Two accepted auth paths:
      1. `Authorization: Bearer <token>` — looks up user in db.users.
      2. `admin_session` HttpOnly cookie minted by /api/admin/vault-auth —
         returns a synthetic God-Mode founder user.

    TODO: Replace Bearer lookup with real JWT decoding when ready.
    """
    # Path 2 — vault cookie (accept first; founders bypass Bearer flow)
    if admin_session and verify_admin_session(admin_session):
        return dict(_VAULT_FOUNDER)

    # Path 1 — Bearer token
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized: Missing token")

    token = authorization.replace("Bearer ", "")
    user = await db.users.find_one({"id": token}, {"_id": 0})

    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid token")

    return user


async def require_floor_staff(user = Depends(get_current_user_from_token)):
    """Require at least Floor Staff level (1+)"""
    role_level = user.get("role_level", 0)
    
    if role_level < ROLE_FLOOR_STAFF:
        raise HTTPException(
            status_code=403,
            detail=f"Access Denied: Floor Staff permission required (you have level {role_level})"
        )
    
    return user


async def require_manager(user = Depends(get_current_user_from_token)):
    """Require at least Manager level (2+)"""
    role_level = user.get("role_level", 0)
    
    if role_level < ROLE_MANAGER:
        raise HTTPException(
            status_code=403,
            detail=f"Access Denied: Manager permission required (you have level {role_level})"
        )
    
    return user


async def require_god_mode(user = Depends(get_current_user_from_token)):
    """Require God-Mode level (3 only)"""
    role_level = user.get("role_level", 0)
    
    if role_level < ROLE_GOD_MODE:
        raise HTTPException(
            status_code=403,
            detail=f"Access Denied: Founder permission required (you have level {role_level})"
        )
    
    return user


# === HELPER FUNCTIONS ===

async def check_permission(user_id: str, required_level: int) -> bool:
    """
    Check if a user has the required permission level.
    
    Args:
        user_id: User's ID
        required_level: Minimum role level required
        
    Returns:
        True if user has permission, False otherwise
    """
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    
    if not user:
        return False
    
    user_level = user.get("role_level", 0)
    return user_level >= required_level


async def get_user_role_name(user_id: str) -> str:
    """Get the role name for a user"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    
    if not user:
        return "Unknown"
    
    role_level = user.get("role_level", 0)
    return ROLE_NAMES.get(role_level, "Regular User")


async def set_user_role(user_id: str, role_level: int):
    """
    Set a user's role level.
    
    Args:
        user_id: User's ID
        role_level: New role level (1-3)
    """
    if role_level not in [1, 2, 3]:
        raise ValueError("Invalid role level. Must be 1 (Floor Staff), 2 (Manager), or 3 (God-Mode)")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"role_level": role_level, "role_name": ROLE_NAMES[role_level]}}
    )

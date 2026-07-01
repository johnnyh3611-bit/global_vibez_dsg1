"""
Authentication dependencies for FastAPI
Middleware to verify user sessions and extract current user
"""
from fastapi import HTTPException, Request, Depends, Cookie
from typing import Optional
from datetime import datetime, timezone

from utils.database import get_database


async def get_current_user_from_session(
    request: Request,
    session_token: Optional[str] = Cookie(None)
) -> dict:
    """
    Extract and validate current user from session cookie OR Authorization
    header. Accepts:
      * `Cookie: session_token=...` (browser SPA flow)
      * `Authorization: Bearer <token>` (curl + server-to-server flow,
        also used by `POST /api/auth/demo-login`)

    Args:
        request: FastAPI request object
        session_token: Session token from cookie

    Returns:
        User dict with user_id, email, name, etc.

    Raises:
        HTTPException 401 if not authenticated
    """
    # Fall back to the Authorization: Bearer header if no cookie was set.
    # This unblocks the demo-login flow (Bearer token returned to client)
    # for routes that previously only accepted the cookie path.
    if not session_token:
        auth_header = request.headers.get("Authorization") or request.headers.get("authorization") or ""
        if auth_header.lower().startswith("bearer "):
            session_token = auth_header.split(" ", 1)[1].strip() or None

    if not session_token:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated. Please log in."
        )
    
    db = get_database()
    
    # Find session in database - check both collections for compatibility
    session = await db.sessions.find_one({
        "session_token": session_token
    }, {"_id": 0})
    
    # Also check user_sessions collection (used by demo-login)
    if not session:
        session = await db.user_sessions.find_one({
            "session_token": session_token
        }, {"_id": 0})
    
    if not session:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired session. Please log in again."
        )
    
    # Check if session is expired
    expires_at = session.get("expires_at")
    if expires_at:
        # `expires_at` may already be a datetime (when Mongo returned a
        # native BSON date) or a string (ISO-formatted). Handle both.
        if isinstance(expires_at, str):
            expires_dt = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
        else:
            expires_dt = expires_at
        # Ensure the comparison datetime is tz-aware.
        if expires_dt.tzinfo is None:
            expires_dt = expires_dt.replace(tzinfo=timezone.utc)
        if expires_dt < datetime.now(timezone.utc):
            # Delete expired session from both collections
            await db.sessions.delete_one({"session_token": session_token})
            await db.user_sessions.delete_one({"session_token": session_token})
            raise HTTPException(
                status_code=401,
                detail="Session expired. Please log in again."
            )
    
    user_id = session.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Invalid session data"
        )
    
    # Get user from database
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    
    if not user:
        raise HTTPException(
            status_code=401,
            detail="User not found"
        )
    
    return user


async def get_current_user_optional(
    request: Request,
    session_token: Optional[str] = Cookie(None)
) -> Optional[dict]:
    """
    Same as get_current_user_from_session but returns None if not authenticated
    instead of raising an error. Use for optional authentication.
    Accepts either the `session_token` cookie OR `Authorization: Bearer ...`.
    """
    if not session_token:
        auth_header = request.headers.get("Authorization") or request.headers.get("authorization") or ""
        if auth_header.lower().startswith("bearer "):
            session_token = auth_header.split(" ", 1)[1].strip() or None
    if not session_token:
        return None

    try:
        return await get_current_user_from_session(request, session_token)
    except HTTPException:
        return None


def verify_user_id(user_id: str, current_user: dict) -> None:
    """
    Verify that the provided user_id matches the authenticated user
    
    Args:
        user_id: User ID from request (query param, body, etc.)
        current_user: Current authenticated user from session
        
    Raises:
        HTTPException 403 if user_id doesn't match
    """
    if user_id != current_user.get("user_id"):
        raise HTTPException(
            status_code=403,
            detail="Forbidden: You can only access your own data"
        )


# Dependency alias for cleaner code
CurrentUser = Depends(get_current_user_from_session)
OptionalUser = Depends(get_current_user_optional)

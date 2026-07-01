"""
Admin authorization helper (May 2026)
─────────────────────────────────────────────────────────────────
Single source of truth for "is the caller an admin?" used by every
moderation/verification endpoint that previously had ``# TODO admin``
markers.

Pre-deploy security lockdown — without this, ANY logged-in user could:
  • approve / reject driver licenses
  • verify users
  • approve insurance docs
  • edit any restaurant listing
  • moderate any post
  • set vibe scores

Two ways to qualify as admin:
  1. The user's email is in the comma-separated ``ADMIN_EMAILS`` env
     var (founder + ops staff)
  2. The user document has ``is_admin: True`` (set explicitly by a
     founder via the staff-management panel)
"""
from __future__ import annotations

import os
from typing import Any
from fastapi import HTTPException, Request

from utils.database import get_current_user


def _admin_email_set() -> set[str]:
    """Lowercased set of admin emails from the env var."""
    raw = os.environ.get(
        "ADMIN_EMAILS",
        # Sane default for the founder + demo accounts. Override in
        # production via env var.
        "admin@globalvibez.com,founder@globalvibez.com,demo@globalvibez.com,johnnyh3611@gmail.com",
    )
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


def is_admin(user: Any) -> bool:
    """Return True if the user qualifies as admin.

    Accepts either a Pydantic ``User`` model (with ``email``,
    ``is_admin`` attrs) or a raw dict from a Mongo lookup.
    """
    if user is None:
        return False
    email = (getattr(user, "email", None) or (user.get("email") if isinstance(user, dict) else None) or "").lower()
    flag = bool(getattr(user, "is_admin", None) if hasattr(user, "is_admin")
                else (user.get("is_admin", False) if isinstance(user, dict) else False))
    return flag or email in _admin_email_set()


async def require_admin(request: Request):
    """FastAPI dependency / inline helper. Raises 401 if not signed in
    and 403 if signed in but not an admin."""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if not is_admin(current_user):
        raise HTTPException(
            status_code=403,
            detail="Admin only — this action requires founder/ops privileges.",
        )
    return current_user

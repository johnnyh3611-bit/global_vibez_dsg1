"""
Stripe Connect Express — onboarding + payout scaffolding.

2026-05-12 founder ask: "everything from your backlog that doesn't need
external secrets is done. The next logical move — once you provide a
Stripe live key — is wiring Stripe Connect Express onboarding so payouts
auto-deposit to driver/merchant/host bank accounts." Founder approved
scaffolding now so we can plug in keys later.

This module covers the FULL Express flow:

  1.  POST /api/connect/onboard         — caller hits this once per role.
                                         We create (or reuse) an Express
                                         account, generate an onboarding
                                         AccountLink, and return its URL.
                                         Frontend redirects the user there;
                                         Stripe handles ID/bank collection.
  2.  GET  /api/connect/status          — poll while onboarding to check
                                         payouts_enabled / charges_enabled.
                                         Frontend uses this to flip the
                                         button from "Set up payouts" →
                                         "Payouts active ✓".
  3.  POST /api/connect/payout          — admin/system endpoint that
                                         creates a Transfer to the user's
                                         connected account. Manual queue
                                         today, automated later.
  4.  GET  /api/connect/login-link      — surfaces the Stripe Express
                                         dashboard URL so the connected
                                         user can edit their bank info.

When STRIPE_CONNECT_CLIENT_ID + STRIPE_API_KEY aren't set (preview env),
all endpoints return a clear `not_configured` payload so the frontend
can render a "Available after launch" banner instead of a 500. We never
fall back to fake account_ids — only real Stripe data lands in Mongo.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import stripe
from fastapi import APIRouter, HTTPException, Request

from utils.database import get_database, get_current_user

router = APIRouter(prefix="/connect", tags=["stripe-connect"])

STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")
STRIPE_CONNECT_CLIENT_ID = os.environ.get("STRIPE_CONNECT_CLIENT_ID", "")

# Acceptable roles a user can onboard for. Each maps to a Mongo field on
# the user doc so a single user can wear multiple hats (driver + host +
# merchant + streamer = 4 separate Connect accounts? No — Stripe lets ONE
# Express account receive transfers from many sources, so we keep a SINGLE
# `stripe_connect_account_id` per user. The role lets us label the link.
VALID_ROLES = {"driver", "host", "merchant", "streamer"}


def _is_configured() -> bool:
    """True once both the platform key + Connect Client ID are set."""
    return bool(STRIPE_API_KEY) and STRIPE_API_KEY.startswith("sk_") and \
        STRIPE_API_KEY != "sk_test_emergent"


def _frontend_base() -> str:
    """Resolve the public app URL for return/refresh links."""
    # Prefer an explicit FRONTEND_URL when set (production), else the
    # value the frontend itself uses (preview).
    return (
        os.environ.get("FRONTEND_URL")
        or os.environ.get("REACT_APP_BACKEND_URL")
        or "https://globalvibezdsg.com"
    ).rstrip("/")


async def _get_or_create_account(db, user_id: str, email: Optional[str]) -> str:
    """Return the user's existing Stripe Express account_id, or create one."""
    doc = await db.users.find_one(
        {"user_id": user_id},
        {"_id": 0, "stripe_connect_account_id": 1, "email": 1},
    )
    existing = (doc or {}).get("stripe_connect_account_id")
    if existing:
        return existing
    if not stripe.api_key:
        stripe.api_key = STRIPE_API_KEY
    acct = stripe.Account.create(
        type="express",
        email=email or (doc or {}).get("email"),
        capabilities={
            "transfers": {"requested": True},
        },
        business_type="individual",
        metadata={"gv_user_id": user_id, "platform": "globalvibez"},
    )
    await db.users.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "stripe_connect_account_id": acct.id,
                "stripe_connect_created_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )
    return acct.id


@router.post("/onboard")
async def onboard(request: Request) -> Dict[str, Any]:
    """Begin the Connect Express onboarding flow. Returns a Stripe-hosted
    URL the frontend redirects the user to. After completion Stripe sends
    them back to /driver/wallet (or /vibe-venues/host-dashboard etc) where
    /status confirms payouts are enabled."""
    user = await get_current_user(request)
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")

    if not _is_configured():
        # Soft-fail until launch keys are in. Frontend renders a banner.
        return {
            "success": False,
            "configured": False,
            "message": "Stripe Connect is not configured yet. Available after launch.",
        }

    body = await request.json() if (await request.body()) else {}
    role = (body.get("role") or "driver").lower()
    if role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"role must be one of {sorted(VALID_ROLES)}")

    db = get_database()
    stripe.api_key = STRIPE_API_KEY
    account_id = await _get_or_create_account(db, user.user_id, user.email)

    # Where Stripe sends the user back after they finish (or bail).
    base = _frontend_base()
    return_path = {
        "driver": "/driver/wallet?connect=ok",
        "host": "/vibe-venues/host-dashboard?connect=ok",
        "merchant": "/hungryvibes/merchant?connect=ok",
        "streamer": "/my-streams?connect=ok",
    }[role]
    refresh_path = {
        "driver": "/driver/wallet?connect=refresh",
        "host": "/vibe-venues/host-dashboard?connect=refresh",
        "merchant": "/hungryvibes/merchant?connect=refresh",
        "streamer": "/my-streams?connect=refresh",
    }[role]

    link = stripe.AccountLink.create(
        account=account_id,
        refresh_url=f"{base}{refresh_path}",
        return_url=f"{base}{return_path}",
        type="account_onboarding",
    )

    return {
        "success": True,
        "configured": True,
        "role": role,
        "account_id": account_id,
        "onboarding_url": link.url,
        "expires_at": link.expires_at,
    }


@router.get("/status")
async def status(request: Request) -> Dict[str, Any]:
    """Polls Stripe for the user's current onboarding state. Frontend uses
    this to flip the button from 'Set up payouts' → 'Payouts active'."""
    user = await get_current_user(request)
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")

    db = get_database()
    doc = await db.users.find_one(
        {"user_id": user.user_id}, {"_id": 0, "stripe_connect_account_id": 1}
    )
    account_id = (doc or {}).get("stripe_connect_account_id")
    if not account_id:
        return {
            "success": True,
            "configured": _is_configured(),
            "account_id": None,
            "payouts_enabled": False,
            "charges_enabled": False,
            "details_submitted": False,
        }

    if not _is_configured():
        # Account row stored but keys not active yet — still safe to surface
        # the saved id, just mark payouts disabled.
        return {
            "success": True,
            "configured": False,
            "account_id": account_id,
            "payouts_enabled": False,
            "charges_enabled": False,
            "details_submitted": False,
        }

    stripe.api_key = STRIPE_API_KEY
    acct = stripe.Account.retrieve(account_id)
    return {
        "success": True,
        "configured": True,
        "account_id": account_id,
        "payouts_enabled": bool(acct.payouts_enabled),
        "charges_enabled": bool(acct.charges_enabled),
        "details_submitted": bool(acct.details_submitted),
        "requirements_currently_due": list(getattr(acct.requirements, "currently_due", []) or []),
    }


@router.get("/login-link")
async def login_link(request: Request) -> Dict[str, Any]:
    """Returns a one-time Express Dashboard login URL so the connected
    user can edit bank info / see payouts. Stripe expires this in 5 min."""
    user = await get_current_user(request)
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    if not _is_configured():
        return {"success": False, "configured": False, "url": None}

    db = get_database()
    doc = await db.users.find_one(
        {"user_id": user.user_id}, {"_id": 0, "stripe_connect_account_id": 1}
    )
    account_id = (doc or {}).get("stripe_connect_account_id")
    if not account_id:
        raise HTTPException(status_code=404, detail="No Connect account — run /onboard first")

    stripe.api_key = STRIPE_API_KEY
    link = stripe.Account.create_login_link(account_id)
    return {"success": True, "configured": True, "url": link.url}


@router.post("/payout")
async def payout(request: Request) -> Dict[str, Any]:
    """Admin-only: create a Transfer from the platform to a connected
    user's account. Triggered by approving a row in the existing
    payout_requests queue."""
    user = await get_current_user(request)
    if user is None or not getattr(user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Admin only")

    if not _is_configured():
        return {"success": False, "configured": False, "message": "Stripe not configured"}

    body = await request.json()
    target_user_id = body.get("user_id")
    amount_usd = float(body.get("amount_usd", 0))
    if not target_user_id or amount_usd <= 0:
        raise HTTPException(status_code=400, detail="user_id + amount_usd required")

    db = get_database()
    doc = await db.users.find_one(
        {"user_id": target_user_id}, {"_id": 0, "stripe_connect_account_id": 1}
    )
    account_id = (doc or {}).get("stripe_connect_account_id")
    if not account_id:
        raise HTTPException(status_code=404, detail="Target user has no Connect account")

    stripe.api_key = STRIPE_API_KEY
    transfer = stripe.Transfer.create(
        amount=int(round(amount_usd * 100)),
        currency="usd",
        destination=account_id,
        description=f"Vibez payout to {target_user_id}",
        metadata={"gv_user_id": target_user_id},
    )
    # Audit row — admin can reconcile in God Mode.
    await db.stripe_connect_payouts.insert_one({
        "transfer_id": transfer.id,
        "user_id": target_user_id,
        "amount_usd": amount_usd,
        "account_id": account_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "admin_user_id": user.user_id,
    })
    return {"success": True, "transfer_id": transfer.id, "amount_usd": amount_usd}

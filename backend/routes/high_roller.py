"""High Roller VIP tier — gated 10,000-coin-minimum casino room.

Endpoints under `/api/high-roller`:
  GET  /tiers                          — public list of Genius/Genesis/Apex pricing
  GET  /eligibility/{user_id}          — does this user have an active VIP window?
  POST /checkout                       — create a Stripe Checkout for a tier upgrade
  POST /blackjack/deal                 — VIP-gated Blackjack with 10k min bet
  POST /blackjack/action               — VIP-gated Blackjack action passthrough

Webhook fan-out (NOT a route here): on Stripe `checkout.session.completed`
with a `client_reference_id` starting with `vip:`, the existing
`stripe_payouts_webhook._handle_checkout_completed` delegates to
`apply_vip_grant()` below. Single source of truth for granting/extending
a user's VIP window.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import stripe
from fastapi import APIRouter, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

from services.high_roller_economy import (
    HIGH_ROLLER_MIN_BET,
    HIGH_ROLLER_GRANT_DAYS,
    HIGH_ROLLER_REF_PREFIX,
    VIP_TIERS,
    is_valid_tier,
    tier_price_usd,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/high-roller", tags=["high-roller"])

STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")
if STRIPE_API_KEY:
    stripe.api_key = STRIPE_API_KEY

_db = AsyncIOMotorClient(os.environ.get("MONGO_URL"))[
    os.environ.get("DB_NAME", "global_vibez_dsg")
]


# ────────────────────────────────────────────── Models ──
class CheckoutRequest(BaseModel):
    user_id: str
    tier: str  # "genius" | "genesis" | "apex"
    return_url: Optional[str] = None


class BlackjackDealRequest(BaseModel):
    user_id: str
    bet_amount: float
    side_bets: Optional[Dict[str, float]] = {}
    client_seed: Optional[str] = None


class BlackjackActionRequest(BaseModel):
    user_id: str
    session_id: str
    action: str  # 'hit', 'stand', 'double', 'split', 'insurance'
    hand_index: Optional[int] = 0


# ────────────────────────────────────────────── Helpers ──
async def _is_vip_active(user_id: str) -> Dict[str, Any]:
    """Single read returning {is_vip, tier, vip_until} for a user."""
    rec = await _db.high_roller_vip.find_one({"user_id": user_id}, {"_id": 0})
    now_iso = datetime.now(timezone.utc).isoformat()
    if not rec or not rec.get("vip_until") or rec["vip_until"] <= now_iso:
        return {"is_vip": False, "tier": None, "vip_until": None}
    return {
        "is_vip": True,
        "tier": rec.get("tier"),
        "vip_until": rec.get("vip_until"),
    }


async def _require_vip(user_id: str) -> Dict[str, Any]:
    """Raise 403 unless the user is currently inside their VIP window."""
    status = await _is_vip_active(user_id)
    if not status["is_vip"]:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "vip_required",
                "message": (
                    "High Roller rooms require an active VIP membership. "
                    "Upgrade at /casino/high-roller."
                ),
            },
        )
    return status


# ────────────────────────────────────────────── Endpoints ──
@router.get("/tiers")
async def list_tiers() -> Dict[str, Any]:
    """Public — render the High Roller pricing page."""
    return {
        "tiers": list(VIP_TIERS.values()),
        "min_bet": HIGH_ROLLER_MIN_BET,
        "duration_days": HIGH_ROLLER_GRANT_DAYS,
        "ref_prefix": HIGH_ROLLER_REF_PREFIX,
    }


@router.get("/eligibility/{user_id}")
async def get_eligibility(user_id: str) -> Dict[str, Any]:
    """Used by the High Roller room shell to gate entry, and by the
    upgrade page to show 'You're VIP · 12 days left' or 'Upgrade' CTAs.
    Wallet balance is intentionally NOT checked here — the per-game
    min-bet validators (10k floor) enforce that at deal time."""
    status = await _is_vip_active(user_id)
    return {
        "user_id": user_id,
        **status,
        "min_bet": HIGH_ROLLER_MIN_BET,
    }


@router.post("/checkout")
async def create_checkout(req: CheckoutRequest) -> Dict[str, Any]:
    """Spin a Stripe Checkout Session for a tier upgrade. The session's
    `client_reference_id` is `vip:<user_id>:<tier>` — the payouts webhook
    parses it and calls `apply_vip_grant`."""
    if not is_valid_tier(req.tier):
        raise HTTPException(400, detail=f"Unknown tier '{req.tier}'")

    price_usd = tier_price_usd(req.tier)
    tier_info = VIP_TIERS[req.tier]

    if not STRIPE_API_KEY:
        # Mock checkout for preview env / test runs.
        return {
            "mode": "mock",
            "checkout_url": (
                f"https://example.com/mock-checkout?user={req.user_id}"
                f"&tier={req.tier}&plan=high_roller"
            ),
            "tier": req.tier,
            "price_usd": price_usd,
            "duration_days": HIGH_ROLLER_GRANT_DAYS,
        }

    return_url = req.return_url or "https://globalvibezdsg.com/casino/high-roller"

    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": f"High Roller VIP · {tier_info['label']}",
                        "description": (
                            f"{tier_info['tagline']} 30-day window. "
                            f"Includes the {HIGH_ROLLER_MIN_BET:,} ₵ min-bet VIP Blackjack room."
                        ),
                    },
                    "unit_amount": int(price_usd * 100),
                },
                "quantity": 1,
            }],
            success_url=f"{return_url}?vip=success",
            cancel_url=f"{return_url}?vip=cancel",
            client_reference_id=f"{HIGH_ROLLER_REF_PREFIX}{req.user_id}:{req.tier}",
            metadata={
                "kind": "high_roller_vip",
                "user_id": req.user_id,
                "tier": req.tier,
                "duration_days": str(HIGH_ROLLER_GRANT_DAYS),
            },
        )
    except stripe.error.StripeError as e:
        raise HTTPException(502, detail=f"Stripe checkout error: {e}")

    return {
        "mode": "live",
        "checkout_url": session.url,
        "session_id": session.id,
        "tier": req.tier,
        "price_usd": price_usd,
        "duration_days": HIGH_ROLLER_GRANT_DAYS,
    }


@router.post("/blackjack/deal")
async def vip_blackjack_deal(req: BlackjackDealRequest) -> Dict[str, Any]:
    """VIP-gated Blackjack deal. Enforces the 10,000 ₵ floor BEFORE
    delegating to the same engine used by the public Blackjack route.
    Keeps blackjack engine isolation: the public 50-coin floor remains
    untouched, and standard games' regression assertions don't fire."""
    await _require_vip(req.user_id)
    if req.bet_amount < HIGH_ROLLER_MIN_BET:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "below_high_roller_min",
                "message": (
                    f"High Roller minimum bet is ₵{HIGH_ROLLER_MIN_BET:,}. "
                    f"You bet ₵{int(req.bet_amount):,}."
                ),
                "min_bet": HIGH_ROLLER_MIN_BET,
            },
        )

    # Delegate to the public Blackjack engine. Same provably-fair seed
    # generation, same dealer logic — only the entry gate differs.
    from routes.blackjack import DealRequest, deal_initial_hand  # noqa: PLC0415
    deal_req = DealRequest(
        player_id=req.user_id,
        bet_amount=req.bet_amount,
        side_bets=req.side_bets or {},
        client_seed=req.client_seed,
        lightning_active=False,
    )
    result = await deal_initial_hand(deal_req)
    # Stamp the response so the frontend can render VIP chrome.
    if isinstance(result, dict):
        result["vip"] = True
        result["min_bet"] = HIGH_ROLLER_MIN_BET
    return result


@router.post("/blackjack/action")
async def vip_blackjack_action(req: BlackjackActionRequest) -> Dict[str, Any]:
    """VIP-gated Blackjack action passthrough (hit/stand/double/split)."""
    await _require_vip(req.user_id)
    from routes.blackjack import ActionRequest, player_action  # noqa: PLC0415

    action_req = ActionRequest(
        session_id=req.session_id,
        action=req.action,
        hand_index=req.hand_index or 0,
    )
    result = await player_action(action_req)
    if isinstance(result, dict):
        result["vip"] = True
    return result


# ────────────────────────────────────────────── Grant fn (webhook) ──
async def apply_vip_grant(
    user_id: str,
    tier: str,
    stripe_session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Idempotently extend a user's VIP window by 30 days.

    Called by `routes/stripe_payouts_webhook.py::_handle_checkout_completed`
    when the `client_reference_id` starts with `vip:`. Idempotency via
    `last_grant_session_id` — Stripe webhook retries are no-ops.

    Renewals don't reset the clock; they extend from the existing end date
    (same UX rule as Featured Streamers).
    """
    if not is_valid_tier(tier):
        logger.warning("apply_vip_grant: ignoring unknown tier '%s'", tier)
        return {}

    existing = await _db.high_roller_vip.find_one({"user_id": user_id}, {"_id": 0})
    if existing and existing.get("last_grant_session_id") == stripe_session_id:
        return existing  # already applied — Stripe retry

    now = datetime.now(timezone.utc)
    base = now
    if existing and existing.get("vip_until"):
        try:
            current = datetime.fromisoformat(existing["vip_until"])
            if current > now:
                base = current
        except ValueError:
            base = now
    new_until = base + timedelta(days=HIGH_ROLLER_GRANT_DAYS)

    doc = {
        "user_id": user_id,
        "tier": tier,  # most-recent tier wins; lower tiers can't downgrade an active higher tier
        "vip_until": new_until.isoformat(),
        "last_grant_session_id": stripe_session_id,
        "last_granted_at": now.isoformat(),
        "grant_count": (existing.get("grant_count", 0) if existing else 0) + 1,
    }
    # Don't downgrade an active higher tier on a lower-tier renewal.
    if existing:
        prior_tier = existing.get("tier")
        order = {"genius": 1, "genesis": 2, "apex": 3}
        if prior_tier in order and order.get(tier, 0) < order.get(prior_tier, 0):
            doc["tier"] = prior_tier

    await _db.high_roller_vip.update_one(
        {"user_id": user_id}, {"$set": doc}, upsert=True,
    )
    logger.info(
        "Granted VIP (%s) to %s until %s (session=%s)",
        doc["tier"], user_id, new_until.isoformat(), stripe_session_id,
    )
    return doc

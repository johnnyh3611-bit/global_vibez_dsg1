"""
Sovereign Tiers — the platform's 5-tier premium ladder (May 2026 founder ask).

Replaces the scattered tier files (`pricing_tiers_routes.py`,
`subscription_tiers.py`, `elite_subscription.py`, `premium_pricing.py`)
with a single canonical source of truth. The legacy files keep working
for now — once the new pricing page is live we'll switch the frontend
imports over and retire the duplicates in a follow-up cleanup.

ENDPOINTS (mounted under /api):
  GET  /api/tiers/catalog    — public read of all tiers + perks
  GET  /api/tiers/me         — caller's current tier
  POST /api/tiers/subscribe  — create a Stripe subscription checkout
                               (returns a cs_test_… URL today; production
                               price IDs slot in via env vars when ready)
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from utils.database import get_database, get_current_user

router = APIRouter()


# ─── PRICING MATH (2026-05-12 founder ask: "best for me AND for users") ───
# Curve: each step is ~2× price for ~2× perceived value. Middle tier is
# anchored as the obvious sweet spot. Whales get a non-trivial Sovereign
# delta so the ceiling never feels capped. Genius Chair (one-time $20)
# is the long-tail asset play — "subscribers consume, owners hold".
#
# Annual = 2 months free (16.67% off, not 20% — protects margin while
# still feeling like a real discount). Frontend renders `price_usd_year`
# as the headline annual figure.
#
# Featured/popular_anchor toggles let the frontend highlight Tastemaker
# without hard-coding which tier is "MOST POPULAR".

ANNUAL_DISCOUNT_PCT = 16.67  # 2 months free


def _annual(price_usd: int) -> int:
    """Compute the annual price applying the 2-months-free discount."""
    if not price_usd:
        return 0
    return int(round(price_usd * 12 * (1 - ANNUAL_DISCOUNT_PCT / 100)))


# Ordered, lowest → highest. Each tier lists ONLY the deltas vs the
# tier below it (the frontend renders cumulative perks).
TIERS: List[Dict[str, Any]] = [
    {
        "id": "guest",
        "label": "Guest",
        "type_of_premium": "exploring",
        "price_usd": 0,
        "price_usd_year": 0,
        "interval": None,
        "stripe_price_env": None,
        "tagline": "Try the floor before you take a seat.",
        "popular_anchor": False,
        "activity_caps": {
            "daily_allowance_credits": 50,
            "tournament_entries_per_week": 1,
            "saved_replays": 0,
            "private_rooms_hosted": 0,
            "chair_mining_cap_x": 1,
            "broadcasting_tier": "none",
            "vote_weight": 0,
        },
        "perks": [
            "All public rooms",
            "₵50 daily allowance",
            "1 free tournament entry per week",
            "Standard 3% maintenance fee",
            "Browse, chat, watch — earn at 1× rate",
        ],
    },
    {
        "id": "insider",
        "label": "Insider",
        "type_of_premium": "Starter Premium · you skip the door fee",
        "price_usd": 9,
        "price_usd_year": _annual(9),
        "interval": "month",
        "stripe_price_env": "STRIPE_PRICE_INSIDER",
        "tagline": "You're in the room.",
        "popular_anchor": False,
        "trial_intro_usd": 1,  # first-month $1 trial — funnel hook
        "activity_caps": {
            "daily_allowance_credits": 250,
            "tournament_entries_per_week": -1,   # unlimited
            "saved_replays": 3,
            "private_rooms_hosted": 0,
            "chair_mining_cap_x": 2,
            "broadcasting_tier": "none",
            "vote_weight": 1,
        },
        "perks": [
            "₵250 daily allowance (5× Guest)",
            "5% bonus on every wallet top-up",
            "Unlimited tournament entries",
            "2× chair-mining cap",
            "No pre-game ads",
            "2% maintenance fee (33% lower)",
            "Premium badge in chat",
            "Daily Puzzle hint preview",
            "Save 3 game replays",
            "DM other players",
            "First month $1 · cancel anytime",
        ],
    },
    {
        "id": "tastemaker",
        "label": "Tastemaker",
        "type_of_premium": "Influence Premium · you shape the rooms",
        "price_usd": 19,
        "price_usd_year": _annual(19),
        "interval": "month",
        "stripe_price_env": "STRIPE_PRICE_TASTEMAKER",
        "tagline": "You set the rhythm.",
        "popular_anchor": True,  # ANCHOR — frontend marks "MOST POPULAR"
        "activity_caps": {
            "daily_allowance_credits": 750,
            "tournament_entries_per_week": -1,
            "saved_replays": 10,
            "private_rooms_hosted": 3,
            "chair_mining_cap_x": 5,
            "broadcasting_tier": "none",
            "vote_weight": 1,
        },
        "perks": [
            "₵750 daily allowance (15× Guest)",
            "Host up to 3 private game rooms",
            "5× chair-mining cap",
            "Skip tournament queue (priority bracket)",
            "10% bonus on every winning bet",
            "Save 10 replays",
            "Custom username color",
            "1% maintenance fee",
            "24h early access to new rooms · films · fixtures",
            "Voice-coach in Chess Hall",
        ],
    },
    {
        "id": "royal",
        "label": "Royal",
        "type_of_premium": "Elevated Premium · you walk the velvet rope",
        "price_usd": 39,
        "price_usd_year": _annual(39),
        "interval": "month",
        "stripe_price_env": "STRIPE_PRICE_ROYAL",
        "tagline": "Doors open before you ask.",
        "popular_anchor": False,
        "activity_caps": {
            "daily_allowance_credits": 2000,
            "tournament_entries_per_week": -1,
            "saved_replays": 25,
            "private_rooms_hosted": 10,
            "chair_mining_cap_x": 10,
            "broadcasting_tier": "basic",       # low-tier streaming
            "vote_weight": 2,
        },
        "perks": [
            "₵2,000 daily allowance",
            "Host up to 10 private rooms",
            "10× chair-mining cap",
            "Stream from your room (basic broadcasting)",
            "Founder badge on profile",
            "Vote on new-game proposals (2× weight)",
            "The Underground without the ₵5k floor",
            "Voice-coach across every game room",
            "Highlight reels auto-saved to your gallery",
            "0% maintenance fee on top-ups",
            "Direct line to Lou (AI host)",
            "₵500/mo VibeRidez ride credit ($5 retail)",
            "Custom room banner",
            "15% Owner Fee Reduction on Sports Lounge wins",
        ],
    },
    {
        "id": "sovereign",
        "label": "Sovereign",
        "type_of_premium": "Sovereign Premium · everything, every room",
        "price_usd": 89,
        "price_usd_year": _annual(89),
        "interval": "month",
        "stripe_price_env": "STRIPE_PRICE_SOVEREIGN",
        "tagline": "Unlock the whole floor.",
        "popular_anchor": False,
        "activity_caps": {
            "daily_allowance_credits": 5000,
            "tournament_entries_per_week": -1,
            "saved_replays": -1,                  # unlimited
            "private_rooms_hosted": -1,
            "chair_mining_cap_x": 15,
            "broadcasting_tier": "dsg_tv",        # full DSG TV slots
            "vote_weight": 3,
        },
        "perks": [
            "₵5,000 daily allowance — felt across the platform",
            "15× chair-mining cap",
            "Unlimited private rooms · unlimited replays",
            "Full DSG TV broadcasting slots (apply once, slot for life)",
            "Animated name with custom emoji prefix in chat",
            "Custom welcome animation when you enter any room",
            "Monthly 1-on-1 with founder (15-min Zoom)",
            "Profile featured in the Sovereign Hall directory",
            "Priority customer support (4h response SLA)",
            "Vote on governance with 3× weight",
            "DSG 6 Lottery: free daily ticket (1/day · ~$60/mo retail)",
            "Sports Lounge: ₵250 free-stake credit weekly",
            "All Cinema Room admin previews (unreleased films)",
            "2× rewards on Vibe Check correct reports",
            "Founder Mailbox · direct DM to the founder",
            "Beta feature flag — opt in to everything pre-launch",
            "SOVEREIGN status badge across every room",
            "Bridge bonus 1.5× → 1.75× on ₵→DSG conversion",
            "ALL Royal · Tastemaker · Insider perks included",
        ],
    },
    {
        "id": "genius_chair",
        "label": "Genius Chair",
        "type_of_premium": "Ownership Premium · you own a piece",
        "price_usd": 20,
        "price_usd_year": 0,  # one-time
        "interval": "one_time",
        "supply_cap": 50_000,
        "stripe_price_env": "STRIPE_PRICE_GENIUS_CHAIR",
        "tagline": "Lifetime asset · subscribers consume, owners hold.",
        "popular_anchor": False,
        "activity_caps": {
            # Chair-holder activity stacks WITH any active subscription —
            # e.g. Sovereign + Chair = 15× × 3× = 45× chair-mining ceiling.
            "earn_multiplier_x": 3,
            "vote_weight": 2,
            "dividend_share": "13.5% sovereign tax + 3.5% ambassador",
            "stacks_with_subscription": True,
        },
        "perks": [
            "3× earn-rate multiplier — locked at purchase, never decays",
            "Share of 13.5% sovereign tax recirculation",
            "Ambassador dividends (3.5%) + override (5%)",
            "Multiplier STACKS with any subscription tier (Sovereign + Chair = 45× mining ceiling)",
            "2× voting weight in Vibe Check consensus",
            "2× voting weight in chair-holder governance",
            "Custom emissive gold name badge",
            "Future TGE airdrop allocation",
            "Tradeable on secondary market once supply caps",
            "Break-even vs Sovereign in ~9 weeks · pure upside after",
        ],
    },
]


class SubscribePayload(BaseModel):
    tier_id: str = Field(min_length=2, max_length=24)
    origin_url: str = Field(default="", max_length=512)


@router.get("/tiers/catalog")
async def catalog():
    """Public read of every tier + perks. The frontend renders this as
    the /pricing page."""
    return {
        "count": len(TIERS),
        "tiers": TIERS,
        "annual_discount_pct": ANNUAL_DISCOUNT_PCT,
        "annual_discount_label": "2 months free",
    }


@router.get("/tiers/me")
async def my_tier(http_request: Request):
    """Returns the caller's current tier. Defaults to 'guest' for any
    user without an active subscription record."""
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    sub = await db.tier_subscriptions.find_one(
        {"user_id": user.user_id, "status": "active"},
        {"_id": 0},
        sort=[("activated_at", -1)],
    )
    # Chair holders auto-resolve to sovereign-plus benefits.
    chair = await db.chairs.find_one({"user_id": user.user_id}, {"_id": 0, "chair_id": 1})
    if chair:
        return {"tier_id": "genius_chair", "chair_holder": True, "subscription": sub}
    if sub:
        return {"tier_id": sub.get("tier_id", "guest"), "chair_holder": False, "subscription": sub}
    return {"tier_id": "guest", "chair_holder": False, "subscription": None}


@router.post("/tiers/subscribe")
async def subscribe(payload: SubscribePayload, http_request: Request):
    """Create a Stripe checkout session for the chosen tier.

    Today this returns the existing `sk_test_emergent` Stripe checkout
    URL using one-time payment mode (since real subscription price IDs
    aren't wired yet). When the founder adds production price IDs into
    `.env` (STRIPE_PRICE_INSIDER, etc.), this function uses subscription
    mode automatically.
    """
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    tier = next((t for t in TIERS if t["id"] == payload.tier_id), None)
    if not tier:
        raise HTTPException(404, "Unknown tier")
    if tier["price_usd"] == 0:
        raise HTTPException(400, "Guest is free — no checkout required.")

    stripe_key = os.environ.get("STRIPE_API_KEY")
    if not stripe_key:
        raise HTTPException(503, "Stripe not configured on this environment.")

    import stripe as _stripe  # noqa: PLC0415
    _stripe.api_key = stripe_key

    price_id_env = tier.get("stripe_price_env")
    price_id = os.environ.get(price_id_env) if price_id_env else None

    origin = payload.origin_url or os.environ.get("PUBLIC_APP_URL") or "https://social-connect-953.preview.emergentagent.com"
    success_url = f"{origin}/tiers/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/pricing"

    try:
        if price_id and tier.get("interval") == "month":
            # Real subscription mode (when production price IDs are set).
            session = _stripe.checkout.Session.create(
                mode="subscription",
                line_items=[{"price": price_id, "quantity": 1}],
                success_url=success_url,
                cancel_url=cancel_url,
                client_reference_id=user.user_id,
                metadata={"tier_id": tier["id"], "user_id": user.user_id},
            )
        else:
            # Test-mode fallback: inline price_data. Monthly tiers run as
            # subscription mode; one-time tiers (Genius Chair) run as
            # payment mode. The `recurring` block is ONLY allowed inside
            # subscription mode (Stripe rejects it on payment mode).
            is_monthly = tier.get("interval") == "month"
            mode = "subscription" if is_monthly else "payment"
            product_data = {
                "name": f"Global Vibez DSG — {tier['label']}",
                "description": tier["tagline"],
            }
            price_data: Dict[str, Any] = {
                "currency": "usd",
                "product_data": product_data,
                "unit_amount": tier["price_usd"] * 100,
            }
            if is_monthly:
                price_data["recurring"] = {"interval": "month"}
            session = _stripe.checkout.Session.create(
                mode=mode,
                line_items=[{"price_data": price_data, "quantity": 1}],
                success_url=success_url,
                cancel_url=cancel_url,
                client_reference_id=user.user_id,
                metadata={"tier_id": tier["id"], "user_id": user.user_id},
            )
    except Exception as exc:
        raise HTTPException(500, f"Stripe error: {exc}")

    # Record the intent so /tiers/success can finalize on poll.
    db = get_database()
    await db.tier_subscriptions.insert_one({
        "subscription_id": session.id,
        "user_id": user.user_id,
        "tier_id": tier["id"],
        "tier_label": tier["label"],
        "price_usd": tier["price_usd"],
        "status": "pending",
        "stripe_session_id": session.id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return {
        "tier_id": tier["id"],
        "checkout_url": session.url,
        "session_id": session.id,
    }


@router.get("/tiers/subscribe/status/{session_id}")
async def subscribe_status(session_id: str, http_request: Request):
    """Poll endpoint — flips a pending subscription to active when
    Stripe confirms payment. Mirrors the existing /coins/topup/status
    pattern."""
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    stripe_key = os.environ.get("STRIPE_API_KEY")
    if not stripe_key:
        raise HTTPException(503, "Stripe not configured")
    import stripe as _stripe  # noqa: PLC0415
    _stripe.api_key = stripe_key
    try:
        session = _stripe.checkout.Session.retrieve(session_id)
    except Exception as exc:
        raise HTTPException(500, f"Stripe error: {exc}")

    db = get_database()
    if session.payment_status == "paid":
        await db.tier_subscriptions.update_one(
            {"stripe_session_id": session_id},
            {"$set": {
                "status": "active",
                "activated_at": datetime.now(timezone.utc).isoformat(),
                "stripe_customer_id": session.customer,
                "stripe_subscription_id": session.subscription,
            }},
        )
    return {
        "session_id": session_id,
        "payment_status": session.payment_status,
        "tier_id": session.metadata.get("tier_id") if session.metadata else None,
    }

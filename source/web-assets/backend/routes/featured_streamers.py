"""
Featured Streamers — paid promotion tier for the Live Now Wall.

$5/month grants a streamer a glowing pinned position at the top of
`/streams/live` for 30 days. Payments use Helio or Solana — Stripe
checkout was retired in favor of Helio/Solana-only flows.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/featured-streamers", tags=["featured-streamers"])

_db = AsyncIOMotorClient(os.environ.get("MONGO_URL"))[
    os.environ.get("DB_NAME", "global_vibez_dsg")
]

# ────────────────────────────────────────────── Constants ──
# DEFAULT values — actual price/duration read from the live pricing
# catalog so the founder can hot-edit from /admin/tier-pricing without
# a redeploy. Catalog ID: "featured_streamer".
FEATURED_PRICE_USD = 5.00
FEATURED_DURATION_DAYS = 30
FEATURED_REF_PREFIX = "feature:"


async def _live_pricing() -> Dict[str, Any]:
    """Read live featured-streamer pricing from the catalog. Falls back
    to the hardcoded defaults on any error so checkout never crashes."""
    try:
        from services.pricing_catalog import get_featured_streamer_pricing  # noqa: PLC0415
        return await get_featured_streamer_pricing(_db)
    except Exception:
        return {"price_usd": FEATURED_PRICE_USD, "duration_days": FEATURED_DURATION_DAYS}


class CheckoutRequest(BaseModel):
    streamer_id: str
    return_url: Optional[str] = None  # where to send the user after payment


# ────────────────────────────────────────────── Endpoints ──
@router.post("/checkout")
async def create_checkout(req: CheckoutRequest) -> Dict[str, Any]:
    """Retired — Stripe featured-streamer checkout is no longer supported."""
    raise HTTPException(
        status_code=410,
        detail={
            "error": "stripe_retired",
            "message": (
                "Stripe checkout is retired. Use Helio or Solana deposit "
                "for featured streamer promotion."
            ),
            "use": "/api/coins/topup/helio",
        },
    )


@router.get("/status/{streamer_id}")
async def feature_status(streamer_id: str) -> Dict[str, Any]:
    """Read whether a streamer is currently featured and when the
    grant expires. Public — used by the Live Now Wall to render the
    'pinned' style and by the Studio page to show 'Featured · 12 days
    left' messaging."""
    rec = await _db.featured_streamers.find_one(
        {"streamer_id": streamer_id}, {"_id": 0}
    )
    if not rec:
        return {"streamer_id": streamer_id, "is_featured": False, "featured_until": None}
    now = datetime.now(timezone.utc).isoformat()
    return {
        "streamer_id": streamer_id,
        "is_featured": (rec.get("featured_until") or "") > now,
        "featured_until": rec.get("featured_until"),
        "last_grant_session_id": rec.get("last_grant_session_id"),
    }


@router.get("/all-active")
async def list_active_features() -> Dict[str, Any]:
    """Bulk helper used by the Live Now Wall to mark featured streamers
    in a single round-trip (instead of N calls per tile)."""
    now = datetime.now(timezone.utc).isoformat()
    cursor = _db.featured_streamers.find(
        {"featured_until": {"$gt": now}}, {"_id": 0}
    )
    items = await cursor.to_list(500)
    return {"featured": items, "count": len(items)}


# ────────────────────────────────────────────── Grant fn (called by webhook) ──
async def apply_feature_grant(
    streamer_id: str, stripe_session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Idempotently extend a streamer's feature window by 30 days.

    Called when a Helio/Solana payment completes for a featured-streamer
    grant. Idempotency via `last_grant_session_id` — if we've already
    applied a grant for the same payment session, no-op on retry.
    """
    existing = await _db.featured_streamers.find_one(
        {"streamer_id": streamer_id}, {"_id": 0}
    )
    if existing and existing.get("last_grant_session_id") == stripe_session_id:
        return existing  # already applied — Stripe retry

    now = datetime.now(timezone.utc)
    # If they're already featured, extend from their current end date,
    # not from now (don't penalize early renewals).
    base = now
    if existing and existing.get("featured_until"):
        try:
            current = datetime.fromisoformat(existing["featured_until"])
            if current > now:
                base = current
        except ValueError:
            base = now
    new_until = base + timedelta(days=FEATURED_DURATION_DAYS)

    doc = {
        "streamer_id": streamer_id,
        "featured_until": new_until.isoformat(),
        "last_grant_session_id": stripe_session_id,
        "last_granted_at": now.isoformat(),
        "grant_count": (existing.get("grant_count", 0) if existing else 0) + 1,
    }
    await _db.featured_streamers.update_one(
        {"streamer_id": streamer_id}, {"$set": doc}, upsert=True,
    )
    logger.info("Granted FEATURED to %s until %s (session=%s)",
                streamer_id, new_until.isoformat(), stripe_session_id)
    return doc

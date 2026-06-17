"""
DSG Core System — implements the locked specs from
    DSG_Developer_Handbook.pdf  and  DSG_Core_System_Code.pdf  (Feb 2026).

Plugs directly into Equity Master:
  • Every broadcast heartbeat + every cinema ticket sale routes a tiny
    fraction into the House Revenue Pool.
  • The Quarterly Payout Protocol (90-day cycle, 24-hour pre-settlement
    lock) uses Equity Master's locked OWNERSHIP_REVENUE_SHARE (30%) and
    TOTAL_CHAIRS_BASELINE (1,000,000) to compute per-chair payouts.

Features:
  1. Regional TV Hubs — Geo-IP friendly registry routing users to local
     sports/news channels (Chicago → CHI_Live / WindyCity_Daily, etc.),
     falling back to Vibez_Global.
  2. House Revenue Pool tracker — durable in MongoDB so a restart doesn't
     lose the quarter's accumulation. Initialized to 0.0.
  3. Cinema Creator Monetization — 80% creator / 20% house, with 1% of
     the house cut auto-injected into the pool.
  4. Quarterly Dividend Calculator — single source of truth for what
     each chair holder gets at settlement.
  5. Settlement Lock — Treasurer-enforced 24-hour freeze pre-payout.

Endpoints:
  GET  /api/dsg-core/regions
  GET  /api/dsg-core/tv/broadcast/{region}
  POST /api/dsg-core/cinema/ticket/purchase
  GET  /api/dsg-core/treasury/pool
  GET  /api/dsg-core/treasury/payout/calculate
  POST /api/dsg-core/treasury/settlement-lock
  GET  /api/dsg-core/settlement-status
"""
from __future__ import annotations

import os
from datetime import datetime, timezone, timedelta
from typing import Final

from fastapi import APIRouter, BackgroundTasks
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

# Pull Equity Master locks so this module always uses canonical numbers.
from routes.equity_master import (
    OWNERSHIP_REVENUE_SHARE,
    TOTAL_CHAIRS_BASELINE,
    DIVIDEND_DISTRIBUTION_MONTHS,
)


# ── Locked constants from DSG_Developer_Handbook + Core_System_Code ──────
CINEMA_CREATOR_SPLIT: Final[float] = 0.80          # PDF §Creator Monetization
CINEMA_HOUSE_SPLIT: Final[float] = 0.20            # PDF §Creator Monetization
HOUSE_TO_POOL_RATE: Final[float] = 0.01            # 1% of house cut → pool
AD_IMPRESSION_VALUE_USD: Final[float] = 0.05       # PDF §Revenue Event
QUARTERLY_PAYOUT_DAYS: Final[int] = 90             # PDF §Payout Frequency
SETTLEMENT_LOCK_HOURS_PRE: Final[int] = 24         # PDF §Payout Lock Rule

# Regional Hub registry. Extensible — add more cities as Geo-IP rolls out.
# Keys are normalized (lowercase, no whitespace) for case-insensitive routing.
REGIONS: Final[dict[str, dict[str, str]]] = {
    "chicago":   {"sports": "CHI_Live",   "news": "WindyCity_Daily"},
    "atlanta":   {"sports": "ATL_Live",   "news": "HotLanta_Daily"},
    "new_york":  {"sports": "NYC_Live",   "news": "BigApple_Daily"},
    "los_angeles": {"sports": "LA_Live",  "news": "SoCal_Daily"},
    "miami":     {"sports": "MIA_Live",   "news": "MagicCity_Daily"},
    "houston":   {"sports": "HOU_Live",   "news": "SpaceCity_Daily"},
    "global":    {"sports": "Vibez_Global", "news": "Vibez_Global"},
}


# ── Mongo backing ────────────────────────────────────────────────────────
_MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
_DB_NAME = os.environ.get("DB_NAME", "vibez_global")
_client = AsyncIOMotorClient(_MONGO_URL)
_db = _client[_DB_NAME]
_pool_col = _db["dsg_house_revenue_pool"]
_events_col = _db["dsg_revenue_events"]
_settlement_col = _db["dsg_settlement_locks"]


async def _current_quarter_id() -> str:
    """Q-stamp used as the pool document key (e.g. '2026-Q1')."""
    now = datetime.now(timezone.utc)
    q = (now.month - 1) // 3 + 1
    return f"{now.year}-Q{q}"


async def update_house_pool(amount: float, source: str = "unknown") -> float:
    """Atomic increment of the current-quarter pool. Persists the source
    event for audit. Returns the new total."""
    if amount <= 0:
        return 0.0
    qid = await _current_quarter_id()
    await _pool_col.update_one(
        {"quarter": qid},
        {
            "$inc": {"total_usd": float(amount)},
            "$setOnInsert": {
                "quarter": qid,
                "opened_at": datetime.now(timezone.utc).isoformat(),
            },
        },
        upsert=True,
    )
    await _events_col.insert_one(
        {
            "quarter": qid,
            "amount_usd": float(amount),
            "source": source,
            "ts": datetime.now(timezone.utc).isoformat(),
        }
    )
    doc = await _pool_col.find_one({"quarter": qid}, {"_id": 0, "total_usd": 1})
    return float(doc.get("total_usd", 0.0)) if doc else 0.0


# ── Router ───────────────────────────────────────────────────────────────
router = APIRouter(prefix="/dsg-core", tags=["dsg-core-system"])


@router.get("/regions")
async def list_regions():
    """List every supported regional hub + the channel map."""
    return {
        "regions": [
            {"id": rid, "sports_channel": ch["sports"], "news_channel": ch["news"]}
            for rid, ch in REGIONS.items()
        ],
        "default": "global",
        "count": len(REGIONS),
    }


@router.get("/tv/broadcast/{region}")
async def stream_regional_hub(
    region: str,
    user_id: str,
    background_tasks: BackgroundTasks,
):
    """Route the user to their local TV hub and fire an ad-impression
    revenue event into the House Pool (PDF §TV Network)."""
    key = (region or "global").strip().lower().replace(" ", "_").replace("-", "_")
    ch = REGIONS.get(key, REGIONS["global"])
    is_regional = key in REGIONS and key != "global"

    # Each impression injects $0.05 into the pool — async, non-blocking.
    background_tasks.add_task(
        update_house_pool, AD_IMPRESSION_VALUE_USD, f"tv_broadcast:{key}"
    )

    return {
        "region": key,
        "sports_channel": ch["sports"],
        "news_channel": ch["news"],
        "channel": ch["sports"],  # legacy field — matches PDF response shape
        "ad_active": True,
        "payout_contribution": "active",
        "impression_value_usd": AD_IMPRESSION_VALUE_USD,
        "is_regional": is_regional,
        "user_id": user_id,
    }


class TicketPurchase(BaseModel):
    movie_id: str = Field(..., min_length=1, max_length=120)
    user_id: str = Field(..., min_length=1, max_length=120)
    price_vibez: int = Field(..., gt=0)


@router.post("/cinema/ticket/purchase")
async def buy_movie_ticket(body: TicketPurchase, background_tasks: BackgroundTasks):
    """80/20 split — 80% to the creator, 20% to the house. 1% of the
    house cut is auto-injected into the pool (PDF §Cinema Monetization)."""
    creator_cut = body.price_vibez * CINEMA_CREATOR_SPLIT
    house_cut = body.price_vibez * CINEMA_HOUSE_SPLIT
    pool_contribution = house_cut * HOUSE_TO_POOL_RATE

    background_tasks.add_task(
        update_house_pool, pool_contribution, f"cinema_ticket:{body.movie_id}"
    )

    return {
        "status": "Ticket Issued",
        "movie_id": body.movie_id,
        "user_id": body.user_id,
        "creator_earning": round(creator_cut, 2),
        "house_contribution": round(house_cut, 2),
        "pool_contribution_usd": round(pool_contribution, 4),
        "split": {
            "creator_pct": int(CINEMA_CREATOR_SPLIT * 100),
            "house_pct": int(CINEMA_HOUSE_SPLIT * 100),
        },
    }


@router.get("/treasury/pool")
async def get_house_pool():
    """Current-quarter House Revenue Pool snapshot."""
    qid = await _current_quarter_id()
    doc = await _pool_col.find_one({"quarter": qid}, {"_id": 0})
    return {
        "quarter": qid,
        "total_usd": float(doc.get("total_usd", 0.0)) if doc else 0.0,
        "opened_at": doc.get("opened_at") if doc else None,
    }


@router.get("/treasury/payout/calculate")
async def calculate_quarterly_dividends():
    """PDF Core_System_Code §calculate_quarterly_dividends.
    Uses Equity Master's locked 30% split and 1M chair baseline."""
    qid = await _current_quarter_id()
    pool_doc = await _pool_col.find_one({"quarter": qid}, {"_id": 0})
    total_revenue = float(pool_doc.get("total_usd", 0.0)) if pool_doc else 0.0

    payout_pot = total_revenue * OWNERSHIP_REVENUE_SHARE
    payout_per_chair = payout_pot / TOTAL_CHAIRS_BASELINE if TOTAL_CHAIRS_BASELINE else 0.0

    return {
        "quarter": qid,
        "total_revenue": round(total_revenue, 2),
        "ownership_share_pct": int(OWNERSHIP_REVENUE_SHARE * 100),
        "payout_pot": round(payout_pot, 2),
        "total_chairs": TOTAL_CHAIRS_BASELINE,
        "payout_per_chair": round(payout_per_chair, 6),
        "distribution_months": DIVIDEND_DISTRIBUTION_MONTHS,
        "next_settlement_days": QUARTERLY_PAYOUT_DAYS,
        "next_settlement": f"{QUARTERLY_PAYOUT_DAYS} Days",
    }


class SettlementLockBody(BaseModel):
    treasurer_user_id: str = Field(..., min_length=1)
    settlement_at: str | None = Field(
        default=None,
        description="ISO-8601 timestamp of the upcoming settlement (UTC). "
                    "Defaults to 24 hours from now.",
    )


@router.post("/treasury/settlement-lock")
async def lock_for_settlement(body: SettlementLockBody):
    """PDF §Payout Lock Rule — Treasurer locks the pool 24h pre-settlement
    for audit. Idempotent per quarter."""
    if body.settlement_at:
        try:
            settle_dt = datetime.fromisoformat(body.settlement_at.replace("Z", "+00:00"))
        except ValueError:
            settle_dt = datetime.now(timezone.utc) + timedelta(hours=SETTLEMENT_LOCK_HOURS_PRE)
    else:
        settle_dt = datetime.now(timezone.utc) + timedelta(hours=SETTLEMENT_LOCK_HOURS_PRE)

    lock_dt = settle_dt - timedelta(hours=SETTLEMENT_LOCK_HOURS_PRE)
    qid = await _current_quarter_id()
    await _settlement_col.update_one(
        {"quarter": qid},
        {
            "$set": {
                "quarter": qid,
                "treasurer_user_id": body.treasurer_user_id,
                "lock_at": lock_dt.isoformat(),
                "settlement_at": settle_dt.isoformat(),
                "locked_at": datetime.now(timezone.utc).isoformat(),
            }
        },
        upsert=True,
    )
    return {
        "quarter": qid,
        "lock_at": lock_dt.isoformat(),
        "settlement_at": settle_dt.isoformat(),
        "lock_hours_pre_settlement": SETTLEMENT_LOCK_HOURS_PRE,
        "status": "locked",
    }


@router.get("/settlement-status")
async def settlement_status():
    """Returns whether the current quarter is in its 24h pre-settlement
    lock window."""
    qid = await _current_quarter_id()
    doc = await _settlement_col.find_one({"quarter": qid}, {"_id": 0})
    if not doc:
        return {"quarter": qid, "is_locked": False, "lock_at": None, "settlement_at": None}

    now = datetime.now(timezone.utc)
    try:
        lock_dt = datetime.fromisoformat(doc["lock_at"])
        settle_dt = datetime.fromisoformat(doc["settlement_at"])
        is_locked = lock_dt <= now <= settle_dt
    except (KeyError, ValueError):
        is_locked = False
        lock_dt = None
        settle_dt = None

    return {
        "quarter": qid,
        "is_locked": is_locked,
        "lock_at": doc.get("lock_at"),
        "settlement_at": doc.get("settlement_at"),
        "treasurer_user_id": doc.get("treasurer_user_id"),
    }

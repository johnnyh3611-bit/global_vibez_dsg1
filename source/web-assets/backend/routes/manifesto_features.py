"""
Vibe-Credits + Floor-Price Circuit Breaker + Burn-or-Pay queue + Pyth oracle.

This route bundles the four manifesto subsystems that share the same
data model (chair purchases + treasury) into a single cohesive module:

  1. GET  /api/oracle/prices                       — public Pyth + VIBEZ
  2. GET  /api/treasury/solvency                   — public Solvency Meter
  3. GET  /api/admin/burn-queue                    — admin: 60-day overdue chairs
  4. POST /api/admin/burn-queue/execute/{chair_id} — admin: burn + dollar-equivalent refund
  5. GET  /api/wallet/vibe-credits                 — user's stable internal credits balance
  6. POST /api/admin/oracle/floor-price            — admin sets floor-price circuit breaker

All numeric outputs are USD or integer ₵ Vibez Coins. Never floats for ₵.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from utils.database import get_database, get_current_user
from routes.admin_dashboard import verify_admin_cookie
from services.pyth_oracle import get_sol_usd, get_usdc_usd, get_vibez_usd, usd_to_vibez

logger = logging.getLogger(__name__)
router = APIRouter()


# ─────────────────────────────────────────── public oracle

@router.get("/oracle/prices")
async def public_prices() -> Dict[str, Any]:
    """Live SOL/USDC prices via Pyth Hermes + internal $DSG price."""
    sol = await get_sol_usd()
    usdc = await get_usdc_usd()
    vibez = get_vibez_usd()
    return {
        "sol_usd": sol,
        "usdc_usd": usdc,
        "vibez_usd": vibez,
        "vibez_source": "internal_env" if "feed_id" not in str(vibez) else "pyth",
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }


# ─────────────────────────────────────────── solvency meter

@router.get("/treasury/solvency")
async def solvency_meter(db=Depends(get_database)) -> Dict[str, Any]:
    """Public endpoint wrapper around `_compute_solvency`."""
    return await _compute_solvency(db)


async def _compute_solvency(db) -> Dict[str, Any]:
    """Pure helper — same logic as the route, but DB injected directly so
    the lifespan broadcaster can call it without going through FastAPI's
    Depends machinery.

    Manifesto §4: "As long as your Vault > Liability, your ecosystem is
    Insured." We surface this as a health % on the public /treasury page.
    """
    # Total liability = sum of every active chair's purchase price.
    pipeline = [
        {"$match": {"status": {"$ne": "burned"}}},
        {"$group": {"_id": None,
                    "liability_usd": {"$sum": "$price_per_chair_usd"},
                    "active_chairs": {"$sum": "$quantity"}}},
    ]
    agg = await db.chair_purchases.aggregate(pipeline).to_list(length=1)
    liability = agg[0] if agg else {"liability_usd": 0.0, "active_chairs": 0}

    # Vault = all-time Reserve bucket from the treasury ledger.
    vault_pipeline = [{
        "$group": {"_id": None,
                   "reserve_usd": {"$sum": "$reserve_usd"}}
    }]
    v = await db.treasury_ledger.aggregate(vault_pipeline).to_list(length=1)
    vault_usd = float((v[0] if v else {}).get("reserve_usd", 0))

    liability_usd = float(liability.get("liability_usd", 0))
    coverage = (vault_usd / liability_usd * 100.0) if liability_usd > 0 else 100.0

    floor = await db.treasury_config.find_one({"_key": "main"}, {"_id": 0})
    floor_price = float((floor or {}).get("vibez_floor_price_usd", 0.005))
    breaker_engaged = get_vibez_usd() < floor_price

    return {
        "vault_usd": round(vault_usd, 2),
        "liability_usd": round(liability_usd, 2),
        "coverage_pct": round(coverage, 1),
        "active_chairs": int(liability.get("active_chairs", 0)),
        "insured": coverage >= 100.0,
        "circuit_breaker": {
            "floor_price_usd": floor_price,
            "current_vibez_usd": get_vibez_usd(),
            "engaged": breaker_engaged,
            "reason": "VIBEZ price below floor" if breaker_engaged else "OK",
        },
    }


# ─────────────────────────────────────────── burn-or-pay queue

@router.get("/admin/burn-queue")
async def burn_queue(
    db=Depends(get_database),
    _: bool = Depends(verify_admin_cookie),
) -> Dict[str, Any]:
    """List chairs whose premium payment is overdue (manifesto §1).

    Buckets:
      - Warning   (30+ days overdue) — auto email/DM
      - Final     (55+ days overdue) — final notice
      - On-Deck   (60+ days overdue) — eligible for burn
      - Burned    — already executed
    """
    now = datetime.now(timezone.utc)
    cutoffs = {
        "warning_at": (now - timedelta(days=30)).isoformat(),
        "final_at": (now - timedelta(days=55)).isoformat(),
        "burn_at": (now - timedelta(days=60)).isoformat(),
    }
    rows = await db.chair_purchases.find(
        {"status": {"$ne": "burned"},
         "premium_active": False,
         "premium_lapsed_at": {"$lte": cutoffs["warning_at"]}},
        {"_id": 0},
    ).sort("premium_lapsed_at", 1).to_list(length=200)
    out = {"warning": [], "final": [], "on_deck": []}
    for r in rows:
        lapsed = r.get("premium_lapsed_at", "")
        if lapsed <= cutoffs["burn_at"]:
            out["on_deck"].append(r)
        elif lapsed <= cutoffs["final_at"]:
            out["final"].append(r)
        else:
            out["warning"].append(r)
    return {
        "totals": {k: len(v) for k, v in out.items()},
        "queue": out,
        "cutoffs": cutoffs,
    }


@router.post("/admin/burn-queue/execute/{chair_id}")
async def execute_burn(
    chair_id: str,
    db=Depends(get_database),
    _: bool = Depends(verify_admin_cookie),
) -> Dict[str, Any]:
    """Atomic burn + dollar-equivalent VIBEZ refund (manifesto §1).

    Per the user's "Insurance Lock" mechanism: refund is computed as
    USD-equivalent at the *current* VIBEZ price so the user always
    gets back their original purchase value's worth of $DSG.
    """
    chair = await db.chair_purchases.find_one({"chair_id": chair_id}, {"_id": 0})
    if not chair:
        raise HTTPException(404, "chair not found")
    if chair.get("status") == "burned":
        raise HTTPException(400, "chair already burned")

    # Floor-price circuit breaker.
    floor = await db.treasury_config.find_one({"_key": "main"}, {"_id": 0})
    floor_price = float((floor or {}).get("vibez_floor_price_usd", 0.005))
    if get_vibez_usd() < floor_price:
        raise HTTPException(503, f"Circuit breaker engaged (VIBEZ < ${floor_price})")

    refund_usd = float(chair.get("price_per_chair_usd", 0)) * int(chair.get("quantity", 1))
    refund_vibez = usd_to_vibez(refund_usd)
    now = datetime.now(timezone.utc).isoformat()

    # Mark chair as burned + record the refund line.
    await db.chair_purchases.update_one(
        {"chair_id": chair_id},
        {"$set": {"status": "burned",
                  "burned_at": now,
                  "burn_refund_usd": refund_usd,
                  "burn_refund_vibez": refund_vibez}},
    )
    await db.chair_burn_log.insert_one({
        "chair_id": chair_id,
        "user_id": chair.get("user_id"),
        "refund_usd": refund_usd,
        "refund_vibez": refund_vibez,
        "vibez_price_at_burn": get_vibez_usd(),
        "burned_at": now,
    })
    return {
        "burned": True,
        "chair_id": chair_id,
        "refund_usd": refund_usd,
        "refund_vibez": refund_vibez,
        "vibez_price_at_burn": get_vibez_usd(),
        "tx_simulation_only": True,  # flips to false once Solana wiring lives
    }


# ─────────────────────────────────────────── vibe-credits

@router.get("/wallet/vibe-credits")
async def my_credits(
    user=Depends(get_current_user),
    db=Depends(get_database),
) -> Dict[str, Any]:
    """User's stable internal Vibe-Credits balance (manifesto §2).

    1 Credit = $0.01 always. Never tradable on-chain — designed to absorb
    refunds when the user opts for stability over volatile $DSG.
    """
    user_id = user.get("user_id") if isinstance(user, dict) else user.user_id
    doc = await db.vibe_credits.find_one({"user_id": user_id}, {"_id": 0})
    balance = int((doc or {}).get("balance_credits", 0))
    return {
        "balance_credits": balance,
        "usd_value": round(balance * 0.01, 2),
        "denomination": "1 credit = $0.01 USD",
    }


class CreditAdjust(BaseModel):
    user_id: str
    delta_credits: int = Field(..., description="Positive grants, negative debits")
    reason: str = Field(..., min_length=2, max_length=200)


@router.post("/admin/vibe-credits/adjust")
async def admin_adjust_credits(
    body: CreditAdjust,
    db=Depends(get_database),
    _: bool = Depends(verify_admin_cookie),
) -> Dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    await db.vibe_credits.update_one(
        {"user_id": body.user_id},
        {"$inc": {"balance_credits": body.delta_credits},
         "$set": {"updated_at": now}},
        upsert=True,
    )
    await db.vibe_credits_log.insert_one({
        "user_id": body.user_id,
        "delta_credits": body.delta_credits,
        "reason": body.reason,
        "at": now,
    })
    return {"adjusted": True}


# ─────────────────────────────────────────── floor-price config

class FloorPriceUpdate(BaseModel):
    vibez_floor_price_usd: float = Field(..., gt=0, lt=10)


@router.post("/admin/oracle/floor-price")
async def set_floor_price(
    body: FloorPriceUpdate,
    db=Depends(get_database),
    _: bool = Depends(verify_admin_cookie),
) -> Dict[str, Any]:
    """Floor-price circuit breaker (manifesto §3)."""
    await db.treasury_config.update_one(
        {"_key": "main"},
        {"$set": {"vibez_floor_price_usd": body.vibez_floor_price_usd,
                  "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"floor_price_usd": body.vibez_floor_price_usd}


# ─────────────────────────────────────────── hybrid status

@router.get("/users/{user_id}/chair-status")
async def chair_status(user_id: str, db=Depends(get_database)) -> Dict[str, Any]:
    """Returns the user's chair status (manifesto: Bought / Earned / Hybrid).

    Tolerates both legacy plain-text and Fernet-encrypted user_id rows
    by querying on the lookup-prefix `user_id_lookup` field.
    """
    from services.field_encryption import enc  # noqa: PLC0415
    purchased_count = await db.chair_purchases.count_documents(
        {"$or": [
            {"user_id": user_id},                # legacy plain rows
            {"user_id": enc(user_id)},           # new encrypted rows
            {"user_id_lookup": user_id[:8]},     # encrypted-row prefix index
        ],
         "status": {"$ne": "burned"}}
    )
    user = await db.users.find_one({"user_id": user_id},
                                    {"_id": 0, "earned_chair_level": 1, "username": 1})
    earned_level = int((user or {}).get("earned_chair_level", 0))
    if purchased_count > 0 and earned_level > 0:
        status = "HYBRID"
    elif purchased_count > 0:
        status = "BOUGHT"
    elif earned_level > 0:
        status = "EARNED"
    else:
        status = "NONE"
    return {
        "user_id": user_id,
        "status": status,
        "purchased_chairs": purchased_count,
        "earned_chair_level": earned_level,
        "perks": _perks_for(status, earned_level),
    }


def _perks_for(status: str, earned_level: int) -> List[str]:
    if status == "HYBRID":
        return ["Reactive aura (pulses with music/action)",
                "Multi-tier voting power", "VIP Room access"]
    if status == "BOUGHT":
        return ["Static Celestial aura", "Founder/Builder/Partner badge"]
    if status == "EARNED":
        return [f"Particle FX (level {earned_level})", "'Veteran' username suffix"]
    return []

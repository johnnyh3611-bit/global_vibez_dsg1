"""
Vibez Treasury — public + admin endpoints + ledger writer.

Architecture (40-30-30 with auto-cap):
  - Every successful Stripe / chair purchase / Solana payment is recorded
    into `treasury_ledger` via `record_revenue()`.
  - The split is computed by `services.treasury_split.calculate_split()`.
  - Public route /api/treasury/transparency surfaces the
    chair-holder–facing dashboard (totals + last 30d distributions).
  - Admin route /api/admin/treasury/* lets the founder tune the config
    and view the full per-tx breakdown.

External integrations (Squads multi-sig, Streamflow streaming, USDC
swap) are NOT live yet — they're surfaced as "configured / not
configured" status fields. Wiring them is a follow-up once the user
provides real on-chain credentials.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from utils.database import get_database
from services.treasury_split import (
    TreasuryConfig,
    calculate_split,
)

logger = logging.getLogger(__name__)
router = APIRouter()  # mounted under /api by registry


# ─────────────────────────────────────────── DB helpers
TREASURY_CONFIG_KEY = "main"


async def _get_config(db) -> TreasuryConfig:
    """Load (or seed) the canonical treasury config."""
    doc = await db.treasury_config.find_one({"_key": TREASURY_CONFIG_KEY}, {"_id": 0})
    if not doc:
        cfg = TreasuryConfig()
        await db.treasury_config.update_one(
            {"_key": TREASURY_CONFIG_KEY},
            {"$set": {**cfg.__dict__, "_key": TREASURY_CONFIG_KEY,
                      "created_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True,
        )
        return cfg
    # `_key` isn't a TreasuryConfig field — strip before constructing.
    # Same for any extension fields written by other routes (e.g. the
    # manifesto floor-price config writes `vibez_floor_price_usd`
    # directly to the same doc).
    doc.pop("_key", None)
    doc.pop("created_at", None)
    doc.pop("updated_at", None)
    valid = {f for f in TreasuryConfig.__dataclass_fields__}
    extras = {k: v for k, v in doc.items() if k not in valid}
    cleaned = {k: v for k, v in doc.items() if k in valid}
    cfg = TreasuryConfig(**cleaned)
    # Stash the extras on the instance so callers can read them without
    # paying the round-trip cost.
    for k, v in extras.items():
        setattr(cfg, k, v)
    return cfg


async def _month_revenue_and_founder_paid(db) -> Dict[str, float]:
    """Return MTD revenue and MTD founder-paid totals (used for the cap)."""
    now = datetime.now(timezone.utc)
    month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc).isoformat()
    cursor = db.treasury_ledger.find(
        {"created_at": {"$gte": month_start}},
        {"_id": 0, "gross_usd": 1, "founder_usd": 1},
    )
    total = 0.0
    paid = 0.0
    async for row in cursor:
        total += float(row.get("gross_usd", 0) or 0)
        paid += float(row.get("founder_usd", 0) or 0)
    return {"mtd_revenue_usd": total, "mtd_founder_paid_usd": paid}


# ─────────────────────────────────────────── public ledger writer
async def record_revenue(
    db,
    *,
    gross_usd: float,
    source: str,
    tx_id: str,
    user_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Apply the 40-30-30 split and persist a ledger row.

    Idempotent on `tx_id`: replaying the same Stripe webhook won't
    double-allocate.

    Returns the persisted ledger document.
    """
    if gross_usd <= 0:
        return {"skipped": True, "reason": "non-positive gross"}

    existing = await db.treasury_ledger.find_one({"tx_id": tx_id}, {"_id": 0})
    if existing:
        return existing

    cfg = await _get_config(db)
    mtd = await _month_revenue_and_founder_paid(db)

    split = calculate_split(
        gross_usd=gross_usd,
        config=cfg,
        current_month_founder_paid_usd=mtd["mtd_founder_paid_usd"],
        current_month_revenue_usd=mtd["mtd_revenue_usd"],
    )

    row = {
        "tx_id": tx_id,
        "source": source,
        "user_id": user_id,
        "gross_usd": split.gross_usd,
        "team_usd": split.team_usd,
        "ops_usd": split.ops_usd,
        "reserve_usd": split.reserve_usd,
        "founder_usd": split.founder_usd,
        "core_team_usd": split.core_team_usd,
        "founder_capped": split.founder_capped,
        "founder_overflow_to_chair_pool_usd": split.founder_overflow_to_chair_pool_usd,
        "metadata": metadata or {},
        "config_snapshot": split.config_snapshot,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.treasury_ledger.insert_one(row)
    row.pop("_id", None)
    return row


# ─────────────────────────────────────────── public transparency endpoint
@router.get("/treasury/public-status")
async def public_treasury_status() -> Dict[str, Any]:
    """Public-safe sliver of treasury state for the landing page.

    Exposes only non-sensitive on-chain numbers (network + vault balance)
    so the marketing roadmap component can show live data without
    leaking cosigner addresses or admin-only fields. Anyone can read
    the on-chain balance themselves anyway via a Solana explorer; this
    endpoint just saves a round-trip.
    """
    try:
        from services.squads_status import get_squads_status  # noqa: PLC0415
        full = await get_squads_status()
    except Exception as e:
        logger.warning(f"[treasury] public status fetch failed: {e}")
        return {"configured": False, "network": None, "vault_balance_sol": None}

    return {
        "configured": full.get("configured", False),
        "network": full.get("network"),
        "is_mainnet": full.get("is_mainnet", False),
        "vault_balance_sol": full.get("vault_balance_sol"),
        "rpc_ok": full.get("rpc_ok", False),
    }


@router.get("/treasury/transparency")
async def public_transparency(db=Depends(get_database)) -> Dict[str, Any]:
    """Read-only chair-holder view of vault health + recent distributions.

    Intentionally hides per-user data — only aggregate totals and the
    public Squads address (when configured) are exposed.
    """
    cfg = await _get_config(db)

    now = datetime.now(timezone.utc)
    thirty_days_ago = (now - timedelta(days=30)).isoformat()

    pipeline = [
        {"$match": {"created_at": {"$gte": thirty_days_ago}}},
        {"$group": {
            "_id": None,
            "gross_usd": {"$sum": "$gross_usd"},
            "team_usd": {"$sum": "$team_usd"},
            "ops_usd": {"$sum": "$ops_usd"},
            "reserve_usd": {"$sum": "$reserve_usd"},
            "founder_usd": {"$sum": "$founder_usd"},
            "core_team_usd": {"$sum": "$core_team_usd"},
            "chair_pool_overflow_usd": {"$sum": "$founder_overflow_to_chair_pool_usd"},
            "tx_count": {"$sum": 1},
        }}
    ]
    agg = await db.treasury_ledger.aggregate(pipeline).to_list(length=1)
    totals = agg[0] if agg else {
        "gross_usd": 0, "team_usd": 0, "ops_usd": 0,
        "reserve_usd": 0, "founder_usd": 0, "core_team_usd": 0,
        "chair_pool_overflow_usd": 0, "tx_count": 0,
    }
    totals.pop("_id", None)

    # Most recent monthly distribution snapshot (if any).
    last_dist = await db.treasury_distributions.find_one(
        {}, {"_id": 0}, sort=[("snapshot_at", -1)]
    )

    return {
        "split_policy": {
            "team_pct": cfg.team_pct,
            "operations_pct": cfg.ops_pct,
            "reserve_pct": cfg.reserve_pct,
            "founder_pct_of_gross": cfg.founder_pct,
            "core_team_pct_of_gross": cfg.core_team_pct,
            "founder_cap": {
                "auto_enabled": cfg.auto_cap_enabled,
                "trigger_mrr_usd": cfg.founder_cap_trigger_mrr_usd,
                "monthly_amount_usd": cfg.founder_cap_amount_usd,
                "overflow_destination": "Chair Holder Rewards Pool (Reserve)",
            },
        },
        "rolling_30d": {k: round(float(v or 0), 2) for k, v in totals.items()},
        "integrations": {
            "squads_multisig_address": cfg.squads_address,
            "streamflow_payroll_active": cfg.streamflow_api_key_present,
            "usdc_auto_swap_active": cfg.usdc_swap_enabled,
        },
        "last_monthly_distribution": last_dist,
        "promise": (
            "70% of all revenue is locked for platform growth and stability. "
            "30% facilitates team operations, with the founder's draw capped "
            f"at ${int(cfg.founder_cap_amount_usd):,}/month once monthly "
            f"revenue exceeds ${int(cfg.founder_cap_trigger_mrr_usd):,}."
        ),
    }


# ─────────────────────────────────────────── admin endpoints
# We import verify_admin_cookie at module scope (direct dep, no cycle).
from routes.admin_dashboard import verify_admin_cookie  # noqa: E402


class TreasuryConfigUpdate(BaseModel):
    team_pct: Optional[float] = None
    ops_pct: Optional[float] = None
    reserve_pct: Optional[float] = None
    founder_pct: Optional[float] = None
    core_team_pct: Optional[float] = None
    founder_cap_trigger_mrr_usd: Optional[float] = None
    founder_cap_amount_usd: Optional[float] = None
    auto_cap_enabled: Optional[bool] = None
    squads_address: Optional[str] = None


@router.get("/admin/treasury/config")
async def admin_get_config(
    db=Depends(get_database),
    _: bool = Depends(verify_admin_cookie),
):
    cfg = await _get_config(db)
    return cfg.__dict__


@router.put("/admin/treasury/config")
async def admin_update_config(
    update: TreasuryConfigUpdate,
    db=Depends(get_database),
    _: bool = Depends(verify_admin_cookie),
):
    cfg = await _get_config(db)
    payload = update.model_dump(exclude_none=True)
    for k, v in payload.items():
        setattr(cfg, k, v)
    cfg.validate()  # raises if percentages don't add up.
    await db.treasury_config.update_one(
        {"_key": TREASURY_CONFIG_KEY},
        {"$set": {**cfg.__dict__,
                  "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"updated": True, "config": cfg.__dict__}


@router.get("/admin/treasury/ledger")
async def admin_get_ledger(
    limit: int = 50,
    db=Depends(get_database),
    _: bool = Depends(verify_admin_cookie),
):
    """Recent ledger entries (most recent first)."""
    limit = max(1, min(limit, 500))
    rows = await db.treasury_ledger.find({}, {"_id": 0}).sort(
        "created_at", -1
    ).to_list(length=limit)
    return {"count": len(rows), "rows": rows}


@router.get("/admin/treasury/dashboard")
async def admin_dashboard(
    db=Depends(get_database),
    _: bool = Depends(verify_admin_cookie),
):
    """All-time + MTD bucket totals + cap status + on-chain Squads vault."""
    cfg = await _get_config(db)

    all_time_pipeline = [{
        "$group": {
            "_id": None,
            "gross_usd": {"$sum": "$gross_usd"},
            "team_usd": {"$sum": "$team_usd"},
            "ops_usd": {"$sum": "$ops_usd"},
            "reserve_usd": {"$sum": "$reserve_usd"},
            "founder_usd": {"$sum": "$founder_usd"},
            "core_team_usd": {"$sum": "$core_team_usd"},
            "chair_pool_overflow_usd": {"$sum": "$founder_overflow_to_chair_pool_usd"},
            "tx_count": {"$sum": 1},
        }
    }]
    all_time = await db.treasury_ledger.aggregate(all_time_pipeline).to_list(length=1)
    all_time = all_time[0] if all_time else {}
    all_time.pop("_id", None)

    mtd = await _month_revenue_and_founder_paid(db)
    cap_engaged = (
        cfg.auto_cap_enabled
        and mtd["mtd_revenue_usd"] >= cfg.founder_cap_trigger_mrr_usd
    )
    cap_remaining = max(
        cfg.founder_cap_amount_usd - mtd["mtd_founder_paid_usd"], 0.0
    ) if cap_engaged else None

    # On-chain Squads vault snapshot (read-only). Wrapped in a try block
    # so an RPC outage can't 500 the whole dashboard — the UI degrades
    # to a "vault status unavailable" pill in that case.
    squads_block: Dict[str, Any] = {"configured": False}
    try:
        from services.squads_status import get_squads_status  # noqa: PLC0415
        squads_block = await get_squads_status()
    except Exception as e:
        logger.warning(f"[treasury] squads status fetch failed: {e}")

    return {
        "config": cfg.__dict__,
        "all_time": {k: round(float(v or 0), 2) for k, v in all_time.items()},
        "month_to_date": {
            "revenue_usd": round(mtd["mtd_revenue_usd"], 2),
            "founder_paid_usd": round(mtd["mtd_founder_paid_usd"], 2),
            "cap_engaged": cap_engaged,
            "cap_headroom_usd": (round(cap_remaining, 2)
                                 if cap_remaining is not None else None),
        },
        "squads": squads_block,
    }


@router.get("/admin/treasury/squads-status")
async def admin_squads_status(_: bool = Depends(verify_admin_cookie)):
    """Standalone on-chain Squads vault read.

    Exposed separately from `/dashboard` so a dedicated UI panel (or a
    poll) can refresh just the on-chain block at a faster cadence than
    the heavier dashboard aggregation.
    """
    from services.squads_status import get_squads_status  # noqa: PLC0415
    return await get_squads_status()


@router.get("/admin/treasury/squads-rpc")
async def admin_squads_rpc(_: bool = Depends(verify_admin_cookie)):
    """Hand the admin frontend the live Solana RPC URL so the SDK
    Compatibility Verifier can read on-chain state without us
    embedding the API key in client bundles.

    Strictly admin-gated — the URL contains a paid Helius API key.
    """
    rpc = (os.environ.get("SOLANA_MAINNET_RPC")
           or os.environ.get("VIBEZ_SOLANA_RPC") or "")
    if not rpc:
        raise HTTPException(503, detail="No mainnet RPC configured")
    return {"rpc_url": rpc}


@router.post("/admin/treasury/distribute")
async def admin_distribute(
    db=Depends(get_database),
    _: bool = Depends(verify_admin_cookie),
):
    """Snapshot the current bucket totals into `treasury_distributions`.

    This is the LEDGER side of monthly payday — the actual on-chain
    transfer happens via Squads multi-sig + Streamflow streams once
    those credentials are wired in. Calling this manually creates an
    auditable snapshot of "what was due on this date".
    """
    now = datetime.now(timezone.utc)
    cfg = await _get_config(db)
    pipeline = [{
        "$group": {
            "_id": None,
            "gross_usd": {"$sum": "$gross_usd"},
            "team_usd": {"$sum": "$team_usd"},
            "ops_usd": {"$sum": "$ops_usd"},
            "reserve_usd": {"$sum": "$reserve_usd"},
            "founder_usd": {"$sum": "$founder_usd"},
            "core_team_usd": {"$sum": "$core_team_usd"},
            "chair_pool_overflow_usd": {"$sum": "$founder_overflow_to_chair_pool_usd"},
            "tx_count": {"$sum": 1},
        }
    }]
    totals = await db.treasury_ledger.aggregate(pipeline).to_list(length=1)
    totals = totals[0] if totals else {}
    totals.pop("_id", None)
    snapshot = {
        "snapshot_at": now.isoformat(),
        "period_label": now.strftime("%Y-%m"),
        "totals": {k: round(float(v or 0), 2) for k, v in totals.items()},
        "config_snapshot": cfg.__dict__,
        "status": "snapshot_ready",
        "released_to_chain": False,  # flips true once Squads tx confirms
        "release_tx_signatures": [],
    }
    await db.treasury_distributions.insert_one(snapshot)
    snapshot.pop("_id", None)
    return snapshot


# ─────────────────────────────────────────── monthly auto-snapshot
async def monthly_distribution_job(db) -> Optional[Dict[str, Any]]:
    """Called by the APScheduler hook on the 1st of every month at 00:05 UTC.

    Skips silently if a snapshot for the current month already exists,
    so doubled cron runs are safe.
    """
    now = datetime.now(timezone.utc)
    label = now.strftime("%Y-%m")
    existing = await db.treasury_distributions.find_one({"period_label": label})
    if existing:
        logger.info(f"[treasury] {label} snapshot already exists — skipping")
        return None
    cfg = await _get_config(db)
    pipeline = [{
        "$group": {
            "_id": None,
            "gross_usd": {"$sum": "$gross_usd"},
            "team_usd": {"$sum": "$team_usd"},
            "ops_usd": {"$sum": "$ops_usd"},
            "reserve_usd": {"$sum": "$reserve_usd"},
            "founder_usd": {"$sum": "$founder_usd"},
            "core_team_usd": {"$sum": "$core_team_usd"},
            "chair_pool_overflow_usd": {"$sum": "$founder_overflow_to_chair_pool_usd"},
            "tx_count": {"$sum": 1},
        }
    }]
    totals = await db.treasury_ledger.aggregate(pipeline).to_list(length=1)
    totals = totals[0] if totals else {}
    totals.pop("_id", None)
    doc = {
        "snapshot_at": now.isoformat(),
        "period_label": label,
        "totals": {k: round(float(v or 0), 2) for k, v in totals.items()},
        "config_snapshot": cfg.__dict__,
        "status": "auto_snapshot",
        "released_to_chain": False,
        "release_tx_signatures": [],
    }
    await db.treasury_distributions.insert_one(doc)
    logger.info(f"[treasury] auto-snapshot persisted for {label}")
    doc.pop("_id", None)
    return doc

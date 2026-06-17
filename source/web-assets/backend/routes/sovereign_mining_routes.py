"""
Mining Vault routes — six mining streams + maturity lock enforcement.

Endpoints (all /api/mining/*):

  PUBLIC (read-only snapshots)
    GET  /constants                — all mining constants (pool, rates, gates)
    GET  /summary/{user_id}        — last-24h mining totals for a user

  AUTHED (user emits a mining event)
    POST /leasing/pulse            — Hardware Leasing heartbeat (Stream 1)
    POST /stream/watch             — Stream-to-Earn watch-time tick (Stream 3)
    POST /movement/trip            — Proof-of-Movement trip settle (Stream 4)

  AUTHED (server-authoritative; only the app server calls these)
    POST /ambassador/settle        — Ambassador override daily settle (Stream 2)
    POST /tournament/mint          — Tournament bonus mint on winner (Stream 5)

  ADMIN
    GET  /admin/ledger             — query the mining_ledger (founder-only)

Every mining event feeds a MATURITY window: the emitted ₵ cannot be
bridged to DSG until `MATURITY_DAYS` have elapsed. The bridge queue
(`routes/sovereign_ops_routes.py`) reads `mining_ledger` to compute
each user's bridgeable ₵.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from utils.database import get_database, get_current_user
from routes.admin_dashboard import verify_admin_cookie
from services import sovereign_mining as sm

router = APIRouter(prefix="/mining", tags=["sovereign-mining"])


# ── Request models ────────────────────────────────────────────────────

class LeasingPulse(BaseModel):
    device_power_score: int = Field(..., ge=0, le=1_000_000)
    is_active_pulse: bool = True
    total_network_power: Optional[int] = Field(None, ge=0)  # server re-computes if omitted


class StreamWatch(BaseModel):
    watch_time_minutes: float = Field(..., gt=0, le=600)   # 10-hr cap per tick
    interaction_count: int = Field(..., ge=0, le=100_000)


class MovementTrip(BaseModel):
    miles: float = Field(..., gt=0, le=2000)
    is_driver: bool = False


class AmbassadorSettle(BaseModel):
    # Server-computed. Included here so the endpoint can be curl'd in ops.
    user_id: str = Field(..., min_length=1)
    network_game_volume: int = Field(..., ge=0)
    recruit_count: int = Field(..., ge=0)


class TournamentMint(BaseModel):
    tournament_id: str = Field(..., min_length=1)
    winner_user_id: str = Field(..., min_length=1)
    prize_pool: int = Field(..., ge=0)


# ── Helpers ───────────────────────────────────────────────────────────

async def _current_network_power(db) -> int:
    """Sum of device_power_score across all active leasing pulses in last 24h."""
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    rows = await db.mining_ledger.aggregate([
        {"$match": {"stream": "LEASING", "ts": {"$gte": cutoff}}},
        {"$group": {"_id": "$user_id", "last_power": {"$last": "$metadata.device_power_score"}}},
        {"$group": {"_id": None, "total": {"$sum": "$last_power"}}},
    ]).to_list(1)
    return int(rows[0]["total"]) if rows else 1  # avoid div-by-zero


async def _record_mining_event(
    db,
    *,
    user_id: str,
    stream: str,
    base_yield: float,
    is_chair_holder: bool,
    is_golden_hour: bool,
    metadata: Dict[str, Any],
) -> Dict[str, Any]:
    """Apply multipliers, write the ledger row, emit founder-master-node cut."""
    final = sm.apply_multipliers(base_yield, is_chair_holder, is_golden_hour)
    multipliers = []
    if is_chair_holder:
        multipliers.append("chair")
    if is_golden_hour:
        multipliers.append("golden")

    now = datetime.now(timezone.utc)
    matured_at = (now + timedelta(days=sm.MATURITY_DAYS)).isoformat()
    ts_iso = now.isoformat()

    doc = {
        "user_id": user_id,
        "stream": stream,
        "base_yield": float(base_yield),
        "final_yield": float(final),
        "multipliers_applied": multipliers,
        "metadata": metadata,
        "ts": ts_iso,
        "matured_at": matured_at,
    }
    await db.mining_ledger.insert_one(doc)
    doc.pop("_id", None)

    # Founder Master Node cut — 1% of every community block.
    master_cut = sm.founder_master_node_cut(int(round(final)))
    if master_cut > 0:
        await db.crew_vault_state.update_one(
            {"_id": "vault"},
            {
                "$inc": {"balance": int(master_cut), "lifetime": int(master_cut)},
                "$set": {"updated_at": ts_iso},
            },
            upsert=True,
        )

    # Credit user's credits_balance with final yield (post-multipliers,
    # pre-bridge-maturity). They can earn/spend in-app immediately; only
    # bridging to DSG is gated.
    if int(round(final)) > 0:
        await db.users.update_one(
            {"user_id": user_id},
            {"$inc": {"credits_balance": int(round(final))}},
        )
    return {
        "event": doc,
        "credited": int(round(final)),
        "founder_master_cut": int(master_cut),
    }


async def _is_chair_holder(db, user_id: str) -> bool:
    """User is a chair holder if they own ≥1 non-refunded chair."""
    count = await db.chair_purchases.count_documents(
        {"user_id": user_id, "status": {"$ne": "refunded"}},
    )
    return count > 0


async def _is_golden_hour(db) -> bool:
    """Check `platform_state.golden_hour_until` — set by God Mode admin."""
    state = await db.platform_state.find_one(
        {"_id": "mining"}, {"_id": 0, "golden_hour_until": 1},
    )
    if not state or not state.get("golden_hour_until"):
        return False
    try:
        until = datetime.fromisoformat(state["golden_hour_until"])
        return datetime.now(timezone.utc) < until
    except (TypeError, ValueError):
        return False


# ── PUBLIC endpoints ──────────────────────────────────────────────────

@router.get("/constants")
async def mining_constants() -> Dict[str, Any]:
    """Return every mining constant — consumed by the God Mode panel +
    any client wanting to project yield before a pulse fires."""
    return {
        "leasing": {
            "global_pool_24h": sm.GLOBAL_MINT_POOL_24H,
            "chromebook_floor": sm.CHROMEBOOK_FLOOR,
            "chromebook_minimum": sm.CHROMEBOOK_MINIMUM,
            "inactive_penalty": sm.ACTIVE_PULSE_PENALTY,
        },
        "ambassador": {
            "recruit_gate": sm.AMBASSADOR_RECRUIT_GATE,
            "override_rate": sm.AMBASSADOR_OVERRIDE_RATE,
        },
        "stream": {
            "rate_per_minute": sm.STREAM_RATE_PER_MINUTE,
            "min_interactions": sm.STREAM_MIN_INTERACTIONS,
        },
        "movement": {
            "driver_rate": sm.MOVEMENT_DRIVER_RATE,
            "rider_rate": sm.MOVEMENT_RIDER_RATE,
        },
        "tournament": {"mint_pct": sm.TOURNAMENT_MINT_PCT},
        "multipliers": {
            "chair": sm.CHAIR_MULTIPLIER,
            "golden_hour": sm.GOLDEN_HOUR_MULTIPLIER,
        },
        "security": {
            "maturity_days": sm.MATURITY_DAYS,
            "founder_master_node_rate": sm.FOUNDER_MASTER_NODE_RATE,
        },
    }


@router.get("/summary/{user_id}")
async def mining_summary(user_id: str) -> Dict[str, Any]:
    """Per-user 24-hour + lifetime mining breakdown by stream.
    Also returns mature vs pending-maturity ₵ split.
    """
    db = get_database()
    now = datetime.now(timezone.utc)
    cutoff_24h = (now - timedelta(hours=24)).isoformat()

    rows_24h = await db.mining_ledger.aggregate([
        {"$match": {"user_id": user_id, "ts": {"$gte": cutoff_24h}}},
        {"$group": {"_id": "$stream", "total": {"$sum": "$final_yield"}}},
    ]).to_list(10)
    rows_lifetime = await db.mining_ledger.aggregate([
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": "$stream", "total": {"$sum": "$final_yield"}}},
    ]).to_list(10)

    # Bridgeable ₵ = sum of final_yield where matured_at < now.
    now_iso = now.isoformat()
    mature = await db.mining_ledger.aggregate([
        {"$match": {"user_id": user_id, "matured_at": {"$lt": now_iso}}},
        {"$group": {"_id": None, "total": {"$sum": "$final_yield"}}},
    ]).to_list(1)
    pending = await db.mining_ledger.aggregate([
        {"$match": {"user_id": user_id, "matured_at": {"$gte": now_iso}}},
        {"$group": {"_id": None, "total": {"$sum": "$final_yield"}}},
    ]).to_list(1)

    return {
        "user_id": user_id,
        "last_24h": {r["_id"]: int(round(r["total"])) for r in rows_24h},
        "lifetime": {r["_id"]: int(round(r["total"])) for r in rows_lifetime},
        "maturity": {
            "mature_coins": int(round(mature[0]["total"])) if mature else 0,
            "pending_coins": int(round(pending[0]["total"])) if pending else 0,
            "maturity_days": sm.MATURITY_DAYS,
        },
        "generated_at": now_iso,
    }


# ── AUTHED endpoints (user-emitted) ───────────────────────────────────

@router.post("/leasing/pulse")
async def leasing_pulse(payload: LeasingPulse, http_request: Request) -> Dict[str, Any]:
    user = await get_current_user(http_request)
    db = get_database()
    network_power = payload.total_network_power or await _current_network_power(db)
    base = sm.calculate_leasing_yield(
        device_power_score=payload.device_power_score,
        total_network_power=network_power,
        daily_pool_slice=sm.GLOBAL_MINT_POOL_24H,
        is_active_pulse=payload.is_active_pulse,
    )
    chair = await _is_chair_holder(db, user["user_id"])
    golden = await _is_golden_hour(db)
    return await _record_mining_event(
        db, user_id=user["user_id"], stream="LEASING", base_yield=base,
        is_chair_holder=chair, is_golden_hour=golden,
        metadata={
            "device_power_score": int(payload.device_power_score),
            "network_power_snapshot": int(network_power),
            "is_active_pulse": bool(payload.is_active_pulse),
        },
    )


@router.post("/stream/watch")
async def stream_watch(payload: StreamWatch, http_request: Request) -> Dict[str, Any]:
    user = await get_current_user(http_request)
    db = get_database()
    base = sm.calculate_stream_yield(
        watch_time_minutes=payload.watch_time_minutes,
        interaction_count=payload.interaction_count,
    )
    chair = await _is_chair_holder(db, user["user_id"])
    golden = await _is_golden_hour(db)
    return await _record_mining_event(
        db, user_id=user["user_id"], stream="STREAM", base_yield=base,
        is_chair_holder=chair, is_golden_hour=golden,
        metadata={
            "watch_time_minutes": float(payload.watch_time_minutes),
            "interaction_count": int(payload.interaction_count),
        },
    )


@router.post("/movement/trip")
async def movement_trip(payload: MovementTrip, http_request: Request) -> Dict[str, Any]:
    user = await get_current_user(http_request)
    db = get_database()
    base = sm.movement_mint(miles=payload.miles, is_driver=payload.is_driver)
    chair = await _is_chair_holder(db, user["user_id"])
    golden = await _is_golden_hour(db)
    return await _record_mining_event(
        db, user_id=user["user_id"], stream="MOVEMENT", base_yield=base,
        is_chair_holder=chair, is_golden_hour=golden,
        metadata={"miles": float(payload.miles), "is_driver": bool(payload.is_driver)},
    )


# ── AUTHED endpoints (server-authoritative) ───────────────────────────

@router.post("/ambassador/settle", dependencies=[Depends(verify_admin_cookie)])
async def ambassador_settle(payload: AmbassadorSettle) -> Dict[str, Any]:
    """Admin-gated daily settle for Ambassadors. Prevents a user from
    self-claiming arbitrary network volume — server/cron calls this with
    real aggregates.
    """
    db = get_database()
    base = sm.ambassador_mining_override(
        network_game_volume=payload.network_game_volume,
        recruit_count=payload.recruit_count,
    )
    chair = await _is_chair_holder(db, payload.user_id)
    golden = await _is_golden_hour(db)
    return await _record_mining_event(
        db, user_id=payload.user_id, stream="AMBASSADOR", base_yield=base,
        is_chair_holder=chair, is_golden_hour=golden,
        metadata={
            "network_game_volume": int(payload.network_game_volume),
            "recruit_count": int(payload.recruit_count),
            "gate_met": payload.recruit_count >= sm.AMBASSADOR_RECRUIT_GATE,
        },
    )


@router.post("/tournament/mint", dependencies=[Depends(verify_admin_cookie)])
async def tournament_mint(payload: TournamentMint) -> Dict[str, Any]:
    """10% of the prize pool is minted fresh as a skill-mining bonus
    when a tournament completes. Admin-gated because only the tournament
    engine should call this."""
    db = get_database()
    base = float(sm.unlock_tournament_block(payload.prize_pool))
    chair = await _is_chair_holder(db, payload.winner_user_id)
    golden = await _is_golden_hour(db)
    return await _record_mining_event(
        db, user_id=payload.winner_user_id, stream="TOURNAMENT", base_yield=base,
        is_chair_holder=chair, is_golden_hour=golden,
        metadata={
            "tournament_id": payload.tournament_id,
            "prize_pool": int(payload.prize_pool),
            "mint_pct": sm.TOURNAMENT_MINT_PCT,
        },
    )


# ── ADMIN ─────────────────────────────────────────────────────────────

@router.get("/admin/ledger", dependencies=[Depends(verify_admin_cookie)])
async def admin_ledger(
    user_id: Optional[str] = None,
    stream: Optional[str] = None,
    limit: int = 100,
) -> Dict[str, Any]:
    """Founder-only read access to the mining_ledger. Used by the
    upcoming God Mode Mining panel."""
    db = get_database()
    q: Dict[str, Any] = {}
    if user_id:
        q["user_id"] = user_id
    if stream:
        q["stream"] = stream.upper()
    rows = await db.mining_ledger.find(q, {"_id": 0}).sort("ts", -1).limit(max(1, min(limit, 500))).to_list(limit)
    return {
        "events": rows,
        "count": len(rows),
        "filters": {"user_id": user_id, "stream": stream},
    }

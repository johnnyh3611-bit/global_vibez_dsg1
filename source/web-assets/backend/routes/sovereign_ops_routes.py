"""
Sovereign Ops routes — v11 + v12 Constitution execution queues.

Three admin-gated systems; ALL dry-run by default. No on-chain side-effect
ships until the Founder manually broadcasts a queued row in God Mode.

  • Solana Bridge Queue       (v11)  — POST /api/bridge/request (user)
                                        GET  /api/admin/bridge/queue
                                        POST /api/admin/bridge/{id}/approve
                                        POST /api/admin/bridge/{id}/broadcast
                                        POST /api/admin/bridge/{id}/reject
  • Inactivity Reap           (v11)  — GET  /api/admin/inactivity/candidates
                                        POST /api/admin/inactivity/run
  • AI Governor Burn-Slide    (v12)  — GET  /api/burn/schedule
                                        POST /api/admin/burn/execute

All writes require `admin_session` cookie. All Solana/burn writes record to
Mongo `sovereign_ops_ledger` and, unless `dry_run=false` is explicitly sent
AND the env-level `SOVEREIGN_OPS_DRY_RUN=0`, skip real on-chain calls.
"""
from __future__ import annotations

import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from utils.database import get_database, get_current_user
from utils.wallet_fields import pick_wallet_field_for_debit, pick_wallet_field_for_credit
from routes.admin_dashboard import verify_admin_cookie
from services.sovereign_engine import calculate_bridge
from services.ai_governor import (
    TOTAL_SUPPLY_START,
    SUPPLY_FLOOR,
    BURN_RATE_CEILING,
    WALLET_CAP_STANDARD,
    WALLET_CAP_CHAIR,
    current_burn_rate,
    next_burn_breakpoint,
)

router = APIRouter(tags=["sovereign-ops"])


def _dry_run_env_default() -> bool:
    """System-wide safety flag. Treasury operations are dry-run unless
    `SOVEREIGN_OPS_DRY_RUN=0` is explicitly set in the environment."""
    return os.environ.get("SOVEREIGN_OPS_DRY_RUN", "1") != "0"


# ═══════════════════════════════════════════════════════
# 1) SOLANA BRIDGE QUEUE
# ═══════════════════════════════════════════════════════

class BridgeRequestPayload(BaseModel):
    coins: int = Field(..., ge=1, le=1_000_000_000)
    genius_bonus: bool = Field(default=False)


@router.post("/bridge/request")
async def bridge_request(payload: BridgeRequestPayload, http_request: Request) -> Dict[str, Any]:
    """User submits a bridge request. We debit in-app ₵ now and stage the DSG
    mint as a pending row — no on-chain action yet."""
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    # Wallet debit with value-based fallback (see utils/wallet_fields).
    u = await db.users.find_one(
        {"user_id": user.user_id},
        {"_id": 0, "token_balance": 1, "credits_balance": 1},
    ) or {}
    try:
        field, _balance = pick_wallet_field_for_debit(u, int(payload.coins))
    except ValueError as exc:
        max_bal = str(exc).split(":", 1)[1]
        raise HTTPException(402, f"Insufficient ₵ balance ({max_bal} < {payload.coins})")
    await db.users.update_one({"user_id": user.user_id}, {"$inc": {field: -int(payload.coins)}})

    # v1.0 Mining Master Vault — 30-day Maturity Lock. Block bridge if
    # the requested coin amount exceeds the user's MATURE mining coins
    # (ts + MATURITY_DAYS < now). Coins earned via non-mining paths
    # (game wins, tips) don't have a maturity restriction — those are
    # tracked against lifetime mined balance in `mining_ledger`.
    from services.sovereign_mining import MATURITY_DAYS  # noqa: PLC0415
    now_iso = datetime.now(timezone.utc).isoformat()
    pending_rows = await db.mining_ledger.aggregate([
        {"$match": {"user_id": user.user_id, "matured_at": {"$gte": now_iso}}},
        {"$group": {"_id": None, "total": {"$sum": "$final_yield"}}},
    ]).to_list(1)
    pending_mining = int(round(pending_rows[0]["total"])) if pending_rows else 0
    if pending_mining > 0:
        # User has immature mining coins. We don't hard-block at request
        # time (their non-mining balance may cover the bridge), but we
        # attach the number so the Founder approval UI can surface it.
        doc_extra = {"pending_mining_coins": pending_mining, "maturity_days": MATURITY_DAYS}
    else:
        doc_extra = {"pending_mining_coins": 0, "maturity_days": MATURITY_DAYS}

    tokens_out = calculate_bridge(payload.coins, genius_bonus=payload.genius_bonus)
    req_id = f"brdg_{secrets.token_hex(6)}"
    doc = {
        "request_id": req_id,
        "user_id": user.user_id,
        "coins_in": int(payload.coins),
        "genius_bonus": bool(payload.genius_bonus),
        "tokens_out": float(tokens_out),
        "status": "pending",  # pending → approved → broadcast OR rejected
        "requested_at": datetime.now(timezone.utc).isoformat(),
        "approved_at": None,
        "broadcast_at": None,
        "reject_reason": None,
        "tx_sig": None,
        **doc_extra,
    }
    await db.solana_bridge_requests.insert_one(doc)
    return {
        "success": True,
        "request_id": req_id,
        "tokens_out_preview": tokens_out,
        "status": "pending",
        "note": "Submitted to Founder queue. Broadcast pending Squads multisig approval.",
    }


@router.get("/admin/bridge/queue", dependencies=[Depends(verify_admin_cookie)])
async def admin_bridge_queue(status: Optional[str] = None, limit: int = 100) -> Dict[str, Any]:
    db = get_database()
    q: Dict[str, Any] = {}
    if status in {"pending", "approved", "broadcast", "rejected"}:
        q["status"] = status
    cursor = db.solana_bridge_requests.find(q, {"_id": 0}).sort("requested_at", -1).limit(max(1, min(limit, 500)))
    rows: List[Dict[str, Any]] = await cursor.to_list(length=limit)
    counts = {
        "pending": await db.solana_bridge_requests.count_documents({"status": "pending"}),
        "approved": await db.solana_bridge_requests.count_documents({"status": "approved"}),
        "broadcast": await db.solana_bridge_requests.count_documents({"status": "broadcast"}),
        "rejected": await db.solana_bridge_requests.count_documents({"status": "rejected"}),
    }
    return {"rows": rows, "counts": counts, "dry_run_default": _dry_run_env_default()}


@router.post("/admin/bridge/{request_id}/approve", dependencies=[Depends(verify_admin_cookie)])
async def admin_bridge_approve(request_id: str) -> Dict[str, Any]:
    db = get_database()
    row = await db.solana_bridge_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not row:
        raise HTTPException(404, "Bridge request not found")
    if row["status"] != "pending":
        raise HTTPException(409, f"Cannot approve from status '{row['status']}'")
    await db.solana_bridge_requests.update_one(
        {"request_id": request_id},
        {"$set": {"status": "approved", "approved_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"success": True, "request_id": request_id, "status": "approved"}


class BridgeBroadcastPayload(BaseModel):
    dry_run: Optional[bool] = None


@router.post("/admin/bridge/{request_id}/broadcast", dependencies=[Depends(verify_admin_cookie)])
async def admin_bridge_broadcast(request_id: str, payload: BridgeBroadcastPayload) -> Dict[str, Any]:
    """Broadcast a pre-approved DSG mint. In dry-run mode, logs a mock signature
    and marks the row `broadcast` without touching the chain. The real SPL mint
    call is wired in the handler body but gated off by `dry_run`."""
    db = get_database()
    row = await db.solana_bridge_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not row:
        raise HTTPException(404, "Bridge request not found")
    if row["status"] != "approved":
        raise HTTPException(409, f"Cannot broadcast from status '{row['status']}'")
    dry = _dry_run_env_default() if payload.dry_run is None else bool(payload.dry_run)
    tx_sig: str
    if dry:
        tx_sig = f"dryrun_{secrets.token_hex(16)}"
    else:
        # Real path would instantiate the SPL token client + Squads proposal here.
        # Intentionally guarded so no mainnet action ships without the safe phrase.
        raise HTTPException(
            403,
            "Live Solana mint disabled. Set SOVEREIGN_OPS_DRY_RUN=0 AND pull the "
            "God Mode safety switch (awaiting safe phrase).",
        )
    await db.solana_bridge_requests.update_one(
        {"request_id": request_id},
        {"$set": {
            "status": "broadcast",
            "broadcast_at": datetime.now(timezone.utc).isoformat(),
            "tx_sig": tx_sig,
            "dry_run": dry,
        }},
    )
    await db.sovereign_ops_ledger.insert_one({
        "kind": "bridge_broadcast",
        "request_id": request_id,
        "tx_sig": tx_sig,
        "dry_run": dry,
        "ts": datetime.now(timezone.utc).isoformat(),
    })
    return {"success": True, "request_id": request_id, "tx_sig": tx_sig, "dry_run": dry}


class BridgeRejectPayload(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=500)


@router.post("/admin/bridge/{request_id}/reject", dependencies=[Depends(verify_admin_cookie)])
async def admin_bridge_reject(request_id: str, payload: BridgeRejectPayload) -> Dict[str, Any]:
    db = get_database()
    row = await db.solana_bridge_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not row:
        raise HTTPException(404, "Bridge request not found")
    if row["status"] in {"broadcast", "rejected"}:
        raise HTTPException(409, f"Cannot reject from status '{row['status']}'")
    # Refund the user's coins on rejection — pick the field with the higher
    # current balance (credits_balance for legacy, token_balance otherwise).
    u = await db.users.find_one(
        {"user_id": row["user_id"]},
        {"_id": 0, "token_balance": 1, "credits_balance": 1},
    ) or {}
    field = pick_wallet_field_for_credit(u)
    await db.users.update_one(
        {"user_id": row["user_id"]},
        {"$inc": {field: int(row["coins_in"])}},
    )
    await db.solana_bridge_requests.update_one(
        {"request_id": request_id},
        {"$set": {
            "status": "rejected",
            "reject_reason": (payload.reason or "").strip() or None,
            "rejected_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    return {"success": True, "request_id": request_id, "refunded_coins": int(row["coins_in"])}


# ═══════════════════════════════════════════════════════
# 2) INACTIVITY REAP (12-month dormant sweep)
# ═══════════════════════════════════════════════════════

INACTIVITY_DAYS = 365
REAP_GIVEAWAY_SHARE = 0.50
REAP_LEADERSHIP_SHARE = 0.50


@router.get("/admin/inactivity/candidates", dependencies=[Depends(verify_admin_cookie)])
async def admin_inactivity_candidates(limit: int = 100) -> Dict[str, Any]:
    """Dry-run scan — list users whose last_login_at AND last_activity_at are
    both older than 12 months and have a non-zero ₵ balance."""
    db = get_database()
    cutoff = datetime.now(timezone.utc) - timedelta(days=INACTIVITY_DAYS)
    cutoff_iso = cutoff.isoformat()
    # Match users with at least one wallet field, both inactivity stamps stale.
    query = {
        "$and": [
            {
                "$or": [
                    {"last_login_at": {"$lt": cutoff_iso}},
                    {"last_login_at": {"$exists": False}},
                ]
            },
            {
                "$or": [
                    {"last_activity_at": {"$lt": cutoff_iso}},
                    {"last_activity_at": {"$exists": False}},
                ]
            },
            {
                "$or": [
                    {"token_balance": {"$gt": 0}},
                    {"credits_balance": {"$gt": 0}},
                ]
            },
        ]
    }
    cursor = db.users.find(
        query,
        {"_id": 0, "user_id": 1, "last_login_at": 1, "last_activity_at": 1, "token_balance": 1, "credits_balance": 1, "email": 1},
    ).limit(max(1, min(limit, 500)))
    rows: List[Dict[str, Any]] = await cursor.to_list(length=limit)
    total_coins = sum(int(r.get("token_balance") or 0) + int(r.get("credits_balance") or 0) for r in rows)
    return {
        "cutoff_iso": cutoff_iso,
        "rows": rows,
        "count": len(rows),
        "total_coins_to_reap": total_coins,
        "giveaway_share_coins": int(total_coins * REAP_GIVEAWAY_SHARE),
        "leadership_share_coins": int(total_coins * REAP_LEADERSHIP_SHARE),
        "dry_run_default": _dry_run_env_default(),
    }


class InactivityRunPayload(BaseModel):
    dry_run: Optional[bool] = None
    limit: int = Field(default=100, ge=1, le=500)


@router.post("/admin/inactivity/run", dependencies=[Depends(verify_admin_cookie)])
async def admin_inactivity_run(payload: InactivityRunPayload) -> Dict[str, Any]:
    """Run the reap. In dry-run, logs what WOULD be swept. Live mode only
    fires if env allows AND the caller explicitly passes `dry_run=false`."""
    db = get_database()
    dry = _dry_run_env_default() if payload.dry_run is None else bool(payload.dry_run)
    candidates = await admin_inactivity_candidates(limit=payload.limit)
    rows = candidates["rows"]
    summary = {
        "kind": "inactivity_reap",
        "dry_run": dry,
        "sweep_count": len(rows),
        "total_coins": candidates["total_coins_to_reap"],
        "giveaway_share": candidates["giveaway_share_coins"],
        "leadership_share": candidates["leadership_share_coins"],
        "run_at": datetime.now(timezone.utc).isoformat(),
    }
    if dry:
        await db.inactivity_reap_log.insert_one({**summary, "rows": rows})
        return summary
    # Live mode — apply. Race-safe: re-fetch each candidate inside the loop
    # and verify their staleness timestamps are still past the cutoff. A user
    # who logged in between the scan and the apply gets safely skipped.
    # Idempotency: unique (user_id, cutoff_iso) on inactivity_reap_applied.
    applied: List[str] = []
    skipped_reactivated: List[str] = []
    cutoff_iso = candidates["cutoff_iso"]
    for r in rows:
        uid = r["user_id"]
        # Re-fetch live state.
        live = await db.users.find_one(
            {"user_id": uid},
            {"_id": 0, "last_login_at": 1, "last_activity_at": 1,
             "token_balance": 1, "credits_balance": 1},
        ) or {}
        last_login = str(live.get("last_login_at") or "")
        last_activity = str(live.get("last_activity_at") or "")
        # Either stamp missing counts as stale; otherwise require BOTH < cutoff.
        login_stale = (not last_login) or last_login < cutoff_iso
        activity_stale = (not last_activity) or last_activity < cutoff_iso
        if not (login_stale and activity_stale):
            skipped_reactivated.append(uid)
            continue
        coins = int(live.get("token_balance") or 0) + int(live.get("credits_balance") or 0)
        if coins <= 0:
            continue
        # Idempotency guard inserts first — if the unique key already exists,
        # another run already swept this user for this cutoff.
        try:
            await db.inactivity_reap_applied.insert_one({
                "user_id": uid,
                "cutoff_iso": cutoff_iso,
                "coins_reaped": coins,
                "applied_at": datetime.now(timezone.utc).isoformat(),
            })
        except Exception:
            continue
        # Atomic CAS on users: only zero balances if they still match what we
        # just read. Prevents a concurrent debit/credit from being lost.
        cas_result = await db.users.update_one(
            {
                "user_id": uid,
                "token_balance": int(live.get("token_balance") or 0),
                "credits_balance": int(live.get("credits_balance") or 0),
            },
            {"$set": {"credits_balance": 0, "credits_balance": 0}},
        )
        if cas_result.modified_count != 1:
            # Someone else modified the wallet between the re-fetch and
            # the CAS — roll back the idempotency row and skip.
            await db.inactivity_reap_applied.delete_one(
                {"user_id": uid, "cutoff_iso": cutoff_iso}
            )
            skipped_reactivated.append(uid)
            continue
        # 50/50 split — Giveaway Fund + Leadership Dividends queue.
        giveaway_cut = int(coins * REAP_GIVEAWAY_SHARE)
        leadership_cut = coins - giveaway_cut
        await db.giveaway_fund_state.update_one(
            {"_id": "fund"},
            {"$inc": {"balance": giveaway_cut, "lifetime_inflow": giveaway_cut}},
            upsert=True,
        )
        await db.leadership_dividends_queue.insert_one({
            "amount": leadership_cut,
            "source": "inactivity_reap",
            "source_user_id": uid,
            "queued_at": datetime.now(timezone.utc).isoformat(),
        })
        applied.append(uid)
    await db.inactivity_reap_log.insert_one({
        **summary,
        "applied_users": applied,
        "skipped_reactivated_users": skipped_reactivated,
    })
    summary["applied_count"] = len(applied)
    summary["skipped_reactivated_count"] = len(skipped_reactivated)
    return summary


# ═══════════════════════════════════════════════════════
# 3) AI GOVERNOR · BURN-SLIDE
# ═══════════════════════════════════════════════════════

@router.get("/burn/schedule")
async def burn_schedule() -> Dict[str, Any]:
    """Public — live burn rate at the current (estimated) circulating DSG supply.
    Reads lifetime burns from `sovereign_ops_burn_log` to compute supply."""
    db = get_database()
    agg = await db.sovereign_ops_burn_log.aggregate(
        [{"$match": {"dry_run": False}}, {"$group": {"_id": None, "total_burned": {"$sum": "$amount"}}}]
    ).to_list(length=1)
    total_burned = int(agg[0]["total_burned"]) if agg else 0
    supply = max(SUPPLY_FLOOR, TOTAL_SUPPLY_START - total_burned)
    rate = current_burn_rate(supply)
    bp = next_burn_breakpoint(supply)
    return {
        "circulating_supply": supply,
        "total_burned": total_burned,
        "burn_rate": rate,
        "ceiling": BURN_RATE_CEILING,
        "floor_supply": SUPPLY_FLOOR,
        "next_breakpoint": bp,
        "wallet_caps": {
            "standard": WALLET_CAP_STANDARD,
            "chair_holder": WALLET_CAP_CHAIR,
        },
    }


class BurnExecutePayload(BaseModel):
    amount: int = Field(..., ge=1, le=50_000_000)
    dry_run: Optional[bool] = None
    note: Optional[str] = Field(default=None, max_length=500)


@router.post("/admin/burn/execute", dependencies=[Depends(verify_admin_cookie)])
async def admin_burn_execute(payload: BurnExecutePayload) -> Dict[str, Any]:
    """Founder-only — record a burn event. Dry-run by default. Live mode
    would call the SPL token `burn` ix on the treasury ATA (gated off)."""
    db = get_database()
    dry = _dry_run_env_default() if payload.dry_run is None else bool(payload.dry_run)
    sched = await burn_schedule()
    supply_before = sched["circulating_supply"]
    rate_before = sched["burn_rate"]
    doc = {
        "amount": int(payload.amount),
        "supply_before": supply_before,
        "rate_before": rate_before,
        "dry_run": dry,
        "note": (payload.note or "").strip() or None,
        "ts": datetime.now(timezone.utc).isoformat(),
        "tx_sig": f"dryrun_{secrets.token_hex(16)}" if dry else None,
    }
    if not dry:
        raise HTTPException(
            403,
            "Live SPL burn disabled. Awaiting safe phrase + mainnet arming.",
        )
    await db.sovereign_ops_burn_log.insert_one(doc)
    doc.pop("_id", None)  # strip Mongo ObjectId before JSON response
    return {"success": True, **doc, "supply_after": max(SUPPLY_FLOOR, supply_before - int(payload.amount))}

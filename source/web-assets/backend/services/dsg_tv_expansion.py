"""
DSG TV Expansion — Prestige · Stools · Predict-to-Win
─────────────────────────────────────────────────────
Implements the DSG TV Expansion Blueprint with counter-proposal
economics:
  • Prestige Chair upgrades — DSG SPL burns the 50% on-chain, NOT
    in-app coins (consistent with the rest of the platform).
  • Micro-Chairs (Stools) — 100 stools = 1 chair claim. Stools
    accrue from broadcast consistency or chart points.
  • Predict-to-Win — 5% broadcaster commission · 1% to Treasury
    (NOT a 1% burn — counter-proposal).
        Remaining 94% returned to winning predictors pro-rata.

COLLECTIONS:
  • prestige_chairs       — { chair_id, owner_id, tier ("standard"
                              |"neon_ruby"|"cyber_diamond"),
                              upgraded_at }
  • stool_balances        — { user_id, balance, lifetime_earned }
  • prediction_pools      — { pool_id, broadcaster_id, prompt,
                              options, outcome, status, total_pot }
  • prediction_stakes     — { stake_id, pool_id, user_id, option,
                              coins, paid_out }
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

log = logging.getLogger(__name__)

PRESTIGE_TIERS = ("standard", "neon_ruby", "cyber_diamond")
UPGRADE_COIN_COSTS = {
    # Cost in COINS to upgrade. The on-chain SPL burn is handled by
    # the indexer worker — this service only enqueues the intent.
    ("standard", "neon_ruby"): 500_000,
    ("neon_ruby", "cyber_diamond"): 2_000_000,
}

# Predict-to-Win split
PRED_BROADCASTER_PCT = 0.05
PRED_TREASURY_PCT = 0.01
PRED_WINNERS_PCT = 0.94

STOOLS_PER_CHAIR = 100


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ───────────────────────── Prestige Chairs ─────────────────────────

async def get_my_chair(db, user_id: str) -> Dict[str, Any]:
    row = await db.prestige_chairs.find_one(
        {"owner_id": user_id, "status": "active"}, {"_id": 0},
    )
    return row or {"owner_id": user_id, "tier": None}


async def upgrade_chair(db, *, user_id: str, target_tier: str
                        ) -> Dict[str, Any]:
    if target_tier not in PRESTIGE_TIERS or target_tier == "standard":
        return {"ok": False, "reason": "invalid_target_tier"}

    chair = await db.prestige_chairs.find_one(
        {"owner_id": user_id, "status": "active"}, {"_id": 0},
    )
    if not chair:
        return {"ok": False, "reason": "no_active_chair"}

    current = chair.get("tier", "standard")
    cost = UPGRADE_COIN_COSTS.get((current, target_tier))
    if not cost:
        return {"ok": False, "reason": "invalid_upgrade_path"}

    # Charge the user
    from services.coin_wallet import debit_coins  # noqa: PLC0415
    try:
        await debit_coins(
            db, user_id, cost, reason="prestige_upgrade",
            metadata={"from": current, "to": target_tier},
        )
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "reason": "insufficient_funds",
                "detail": str(exc)}

    # Apply upgrade
    await db.prestige_chairs.update_one(
        {"chair_id": chair["chair_id"]},
        {"$set": {"tier": target_tier,
                  "upgraded_at": _now_iso()}},
    )

    # Enqueue SPL burn for the 50% on-chain portion (no in-app burn)
    burn_id = f"prestige_{uuid.uuid4().hex[:14]}"
    await db.dsg_spl_burn_queue.insert_one({
        "queue_id": burn_id,
        "kind": "prestige_upgrade_burn",
        "amount_coins": cost // 2,
        "source_user_id": user_id,
        "status": "queued",
        "at": _now_iso(),
    })

    return {"ok": True, "tier": target_tier, "cost_coins": cost,
            "spl_burn_queue_id": burn_id}


# ──────────────────────────── Stools ───────────────────────────────

async def get_stool_balance(db, user_id: str) -> Dict[str, Any]:
    row = await db.stool_balances.find_one(
        {"user_id": user_id}, {"_id": 0},
    )
    return row or {
        "user_id": user_id, "balance": 0, "lifetime_earned": 0,
    }


async def grant_stools(db, *, user_id: str, count: int,
                       reason: str = "broadcast_consistency"
                       ) -> Dict[str, Any]:
    if count <= 0:
        return {"ok": False, "reason": "must_be_positive"}
    await db.stool_balances.update_one(
        {"user_id": user_id},
        {"$inc": {"balance": count, "lifetime_earned": count},
         "$set": {"updated_at": _now_iso(),
                  "last_grant_reason": reason},
         "$setOnInsert": {"user_id": user_id, "created_at": _now_iso()}},
        upsert=True,
    )
    return {"ok": True, "granted": count, "reason": reason}


async def redeem_stools_for_chair(db, *, user_id: str
                                  ) -> Dict[str, Any]:
    row = await db.stool_balances.find_one(
        {"user_id": user_id}, {"_id": 0, "balance": 1},
    ) or {}
    balance = int(row.get("balance", 0))
    if balance < STOOLS_PER_CHAIR:
        return {"ok": False, "reason": "insufficient_stools",
                "balance": balance, "required": STOOLS_PER_CHAIR}

    # Atomically debit stools
    dec = await db.stool_balances.update_one(
        {"user_id": user_id, "balance": {"$gte": STOOLS_PER_CHAIR}},
        {"$inc": {"balance": -STOOLS_PER_CHAIR,
                  "chairs_redeemed": 1},
         "$set": {"updated_at": _now_iso()}},
    )
    if dec.modified_count == 0:
        return {"ok": False, "reason": "concurrent_modification"}

    chair_id = f"chair_{uuid.uuid4().hex[:14]}"
    await db.prestige_chairs.insert_one({
        "chair_id": chair_id,
        "owner_id": user_id,
        "tier": "standard",
        "source": "stool_redeem",
        "status": "active",
        "created_at": _now_iso(),
        "upgraded_at": _now_iso(),
    })
    return {"ok": True, "chair_id": chair_id, "stools_spent": STOOLS_PER_CHAIR}


# ──────────────────────── Predict-to-Win ───────────────────────────

async def create_pool(db, *, broadcaster_id: str, prompt: str,
                      options: List[str]) -> Dict[str, Any]:
    if len(options) < 2 or len(options) > 6:
        return {"ok": False, "reason": "options_must_be_2_to_6"}
    pool_id = f"pred_{uuid.uuid4().hex[:14]}"
    await db.prediction_pools.insert_one({
        "pool_id": pool_id,
        "broadcaster_id": broadcaster_id,
        "prompt": prompt,
        "options": options,
        "outcome": None,
        "status": "open",
        "total_pot": 0,
        "stakes_count": 0,
        "created_at": _now_iso(),
    })
    return {"ok": True, "pool_id": pool_id}


async def stake_on_pool(db, *, pool_id: str, user_id: str,
                        option: str, coins: int) -> Dict[str, Any]:
    if coins <= 0:
        return {"ok": False, "reason": "must_be_positive"}
    pool = await db.prediction_pools.find_one(
        {"pool_id": pool_id, "status": "open"}, {"_id": 0},
    )
    if not pool:
        return {"ok": False, "reason": "pool_not_open"}
    if option not in pool["options"]:
        return {"ok": False, "reason": "invalid_option"}

    # Debit user
    from services.coin_wallet import debit_coins  # noqa: PLC0415
    try:
        await debit_coins(
            db, user_id, coins, reason="predict_stake",
            metadata={"pool_id": pool_id, "option": option},
        )
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "reason": "insufficient_funds",
                "detail": str(exc)}

    stake_id = f"stake_{uuid.uuid4().hex[:14]}"
    await db.prediction_stakes.insert_one({
        "stake_id": stake_id,
        "pool_id": pool_id,
        "user_id": user_id,
        "option": option,
        "coins": int(coins),
        "paid_out": False,
        "at": _now_iso(),
    })
    await db.prediction_pools.update_one(
        {"pool_id": pool_id},
        {"$inc": {"total_pot": coins, "stakes_count": 1},
         "$set": {"updated_at": _now_iso()}},
    )
    return {"ok": True, "stake_id": stake_id}


async def resolve_pool(db, *, pool_id: str, outcome: str
                       ) -> Dict[str, Any]:
    """Close the pool, pay winners pro-rata (94%), broadcaster (5%),
    Treasury (1% — NOT burn, per counter-proposal)."""
    pool = await db.prediction_pools.find_one(
        {"pool_id": pool_id, "status": "open"}, {"_id": 0},
    )
    if not pool:
        return {"ok": False, "reason": "pool_not_open"}
    if outcome not in pool["options"]:
        return {"ok": False, "reason": "invalid_outcome"}

    total_pot = int(pool["total_pot"])
    broadcaster_take = int(total_pot * PRED_BROADCASTER_PCT)
    treasury_take = int(total_pot * PRED_TREASURY_PCT)
    winners_pool = total_pot - broadcaster_take - treasury_take

    # Find winning stakes
    cursor = db.prediction_stakes.find(
        {"pool_id": pool_id, "option": outcome, "paid_out": False},
        {"_id": 0},
    )
    winners = [s async for s in cursor]
    winning_total = sum(int(w["coins"]) for w in winners)

    from services.coin_wallet import credit_coins  # noqa: PLC0415

    # Pay broadcaster (credited to their wallet)
    if broadcaster_take > 0:
        await credit_coins(
            db, pool["broadcaster_id"], broadcaster_take,
            reason="predict_broadcaster_take",
            metadata={"pool_id": pool_id},
        )
    # Treasury 1%
    if treasury_take > 0:
        await db.recirculation_pools.update_one(
            {"_id": "treasury"},
            {"$inc": {"balance": treasury_take},
             "$set": {"updated_at": _now_iso()}},
            upsert=True,
        )

    # Pay winners pro-rata
    payouts: List[Dict[str, Any]] = []
    if winners and winning_total > 0:
        for w in winners:
            share = int(winners_pool * (int(w["coins"]) / winning_total))
            if share > 0:
                await credit_coins(
                    db, w["user_id"], share,
                    reason="predict_win",
                    metadata={"pool_id": pool_id, "stake_id": w["stake_id"]},
                )
            payouts.append({"stake_id": w["stake_id"],
                             "user_id": w["user_id"], "payout": share})
            await db.prediction_stakes.update_one(
                {"stake_id": w["stake_id"]},
                {"$set": {"paid_out": True, "payout": share}},
            )
    else:
        # No winners — winners_pool flows back to Treasury (counter-prop
        # preserves zero-burn rule even on a void pool).
        if winners_pool > 0:
            await db.recirculation_pools.update_one(
                {"_id": "treasury"},
                {"$inc": {"balance": winners_pool}}, upsert=True,
            )

    await db.prediction_pools.update_one(
        {"pool_id": pool_id},
        {"$set": {"status": "resolved", "outcome": outcome,
                  "resolved_at": _now_iso(),
                  "broadcaster_take": broadcaster_take,
                  "treasury_take": treasury_take,
                  "winners_pool": winners_pool,
                  "winner_count": len(winners)}},
    )

    return {
        "ok": True, "pool_id": pool_id, "outcome": outcome,
        "total_pot": total_pot,
        "broadcaster_take": broadcaster_take,
        "treasury_take": treasury_take,
        "winners_pool": winners_pool,
        "winner_count": len(winners),
        "payouts": payouts,
    }


async def list_open_pools(db, limit: int = 25) -> List[Dict[str, Any]]:
    cursor = db.prediction_pools.find(
        {"status": "open"}, {"_id": 0},
    ).sort([("created_at", -1)]).limit(limit)
    return [p async for p in cursor]

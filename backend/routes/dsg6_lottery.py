"""
DSG 6 Lottery — Quantum Vault Mechanics (Genius Phase PDF, page 1).

OFFICIAL RULES
==============
  Structure:  5 Core Numbers (1-50) + 1 Vibe Ball Choice (RUBY / SAPPHIRE
              / EMERALD / GOLD / DIAMOND).
  Ticket:     $2 VIBE per line.
  Fees:       10% Platform Maintenance Fee deducted at ENTRY (secured up-front).
              13.5% Sovereign Tax deducted from SETTLEMENT on winnings.
  Payouts:
    • 5-Number match           → JACKPOT (full pool after fees)
    • 4-Number match           → roll-down tier
    • 3-Number match           → roll-down tier
    • Vibe Ball correct        → 2× multiplier on tier win
    • Vibe Ball partial match  → 1.5× multiplier on tier win

Endpoints (mounted under /api):
  GET  /api/dsg6/current        — current draw window + jackpot pool
  POST /api/dsg6/buy            — buy 1 or more tickets (debits user wallet)
  POST /api/dsg6/draw           — admin-only: settle current draw + open next
  GET  /api/dsg6/my-tickets     — caller's tickets (newest first)
  GET  /api/dsg6/last-draw      — latest settled draw (numbers + winners)
"""
from __future__ import annotations

import logging
import random
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from utils.database import get_database, get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

TICKET_COST_VIBE = 200          # $2 VIBE in cents (single source of truth)
MAINTENANCE_PCT = 0.10          # 10% deducted at entry
CORE_POOL = list(range(1, 51))  # 1..50
VIBE_BALLS = ["RUBY", "SAPPHIRE", "EMERALD", "GOLD", "DIAMOND"]

TIER_PAYOUT_PCT: Dict[int, float] = {
    5: 1.00,   # JACKPOT — full prize pool
    4: 0.10,   # 10% of pool split among 4-number matches (roll-down)
    3: 0.03,   # 3% of pool split among 3-number matches (roll-down)
}


class BuyPayload(BaseModel):
    core: List[int] = Field(min_length=5, max_length=5)
    vibe_ball: str
    quantity: int = Field(default=1, ge=1, le=20)


def _current_draw_id() -> str:
    """Daily draw id like dsg6-2026-05-09. Auto-rolls every UTC midnight."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return f"dsg6-{today}"


def _draws_at_play() -> str:
    """Tomorrow's UTC midnight ISO — when the current draw settles."""
    now = datetime.now(timezone.utc)
    settle = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return settle.isoformat()


def _validate_picks(core: List[int], vibe_ball: str) -> None:
    if len(set(core)) != 5:
        raise HTTPException(400, "Core numbers must be 5 distinct values.")
    if any(n not in CORE_POOL for n in core):
        raise HTTPException(400, f"Core numbers must each be 1..{CORE_POOL[-1]}.")
    if vibe_ball not in VIBE_BALLS:
        raise HTTPException(400, f"Vibe ball must be one of {VIBE_BALLS}")


@router.get("/dsg6/current")
async def current_draw():
    """Current open draw window. Aggregates tickets sold + pool size."""
    db = get_database()
    draw_id = _current_draw_id()
    n_tickets = await db.dsg6_tickets.count_documents({"draw_id": draw_id})
    # Pool = (1 - maintenance) × tickets × ticket_cost.
    pool = int(n_tickets * TICKET_COST_VIBE * (1 - MAINTENANCE_PCT))
    return {
        "draw_id": draw_id,
        "settles_at": _draws_at_play(),
        "tickets_sold": n_tickets,
        "ticket_cost_vibe": TICKET_COST_VIBE,
        "pool_vibe": pool,
        "maintenance_pct": MAINTENANCE_PCT,
        "core_pool_max": CORE_POOL[-1],
        "vibe_balls": VIBE_BALLS,
    }


@router.post("/dsg6/buy")
async def buy_tickets(payload: BuyPayload, http_request: Request):
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    _validate_picks(payload.core, payload.vibe_ball)

    db = get_database()
    total_cost = TICKET_COST_VIBE * payload.quantity

    from utils.wallet_fields import pick_wallet_field_for_debit  # noqa: PLC0415
    u = await db.users.find_one(
        {"user_id": user.user_id},
        {"_id": 0, "token_balance": 1, "credits_balance": 1},
    ) or {}
    try:
        field, _bal = pick_wallet_field_for_debit(u, total_cost)
    except ValueError:
        raise HTTPException(402, "Insufficient ₵ balance for ticket purchase.")

    await db.users.update_one({"user_id": user.user_id}, {"$inc": {field: -total_cost}})

    draw_id = _current_draw_id()
    now = datetime.now(timezone.utc).isoformat()
    tickets = [
        {
            "ticket_id": f"t_{uuid.uuid4().hex[:12]}",
            "user_id": user.user_id,
            "draw_id": draw_id,
            "core": sorted(payload.core),
            "vibe_ball": payload.vibe_ball,
            "cost_vibe": TICKET_COST_VIBE,
            "purchased_at": now,
            "status": "pending",
            "matches": 0,
            "vibe_ball_match": False,
            "payout_vibe": 0,
        }
        for _ in range(payload.quantity)
    ]
    if tickets:
        await db.dsg6_tickets.insert_many(tickets)
    return {
        "draw_id": draw_id,
        "quantity": payload.quantity,
        "total_cost_vibe": total_cost,
        "tickets": [
            {k: t[k] for k in ("ticket_id", "core", "vibe_ball", "draw_id", "status")}
            for t in tickets
        ],
    }


@router.get("/dsg6/my-tickets")
async def my_tickets(http_request: Request, limit: int = 50):
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    cursor = db.dsg6_tickets.find(
        {"user_id": user.user_id},
        {"_id": 0},
    ).sort("purchased_at", -1).limit(max(1, min(int(limit), 100)))
    rows = await cursor.to_list(length=100)
    return {"count": len(rows), "rows": rows}


@router.get("/dsg6/last-draw")
async def last_draw():
    """Most recent SETTLED draw — for the public ticker."""
    db = get_database()
    doc = await db.dsg6_draws.find_one(
        {"status": "settled"},
        {"_id": 0},
        sort=[("settled_at", -1)],
    )
    return {"draw": doc}


@router.post("/dsg6/draw")
async def run_draw(http_request: Request, draw_id: Optional[str] = None):
    """Admin-only: settle the current (or specified) draw. Picks winning
    numbers, scores every ticket, applies the Vibe Ball multipliers,
    deducts the 13.5% Sovereign Tax, credits winners.
    """
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    if not getattr(user, "is_admin", False) and getattr(user, "role", "") != "admin":
        raise HTTPException(403, "Admin only")

    db = get_database()
    target_draw = draw_id or _current_draw_id()

    existing = await db.dsg6_draws.find_one({"draw_id": target_draw})
    if existing and existing.get("status") == "settled":
        raise HTTPException(400, f"Draw {target_draw} already settled.")

    # 1. Pick winning numbers (provably random via secrets-grade `random.SystemRandom`).
    rng = random.SystemRandom()
    winning_core = sorted(rng.sample(CORE_POOL, 5))
    winning_ball = rng.choice(VIBE_BALLS)

    # 2. Compute pool from tickets sold.
    tickets = await db.dsg6_tickets.find({"draw_id": target_draw}).to_list(None)
    n_tickets = len(tickets)
    pool_after_maint = int(n_tickets * TICKET_COST_VIBE * (1 - MAINTENANCE_PCT))

    # 3. Score every ticket.
    winning_set = set(winning_core)
    by_tier: Dict[int, List[Dict[str, Any]]] = {5: [], 4: [], 3: []}
    for t in tickets:
        matches = len(set(t["core"]) & winning_set)
        ball_match = t["vibe_ball"] == winning_ball
        t["matches"] = matches
        t["vibe_ball_match"] = ball_match
        if matches in (5, 4, 3):
            by_tier[matches].append(t)

    # 4. Apply tier payouts + Vibe Ball multipliers + Sovereign Tax.
    from services.sovereign_validator import apply_sovereign_tax  # noqa: PLC0415

    settlements: List[Dict[str, Any]] = []
    sovereign_tax_total = 0
    payouts_total = 0
    for tier in (5, 4, 3):
        tier_tickets = by_tier[tier]
        if not tier_tickets:
            continue
        tier_pool = int(pool_after_maint * TIER_PAYOUT_PCT[tier])
        base_share = tier_pool // len(tier_tickets) if tier_tickets else 0
        for t in tier_tickets:
            mult = 2.0 if t["vibe_ball_match"] else 1.5 if tier >= 4 else 1.0
            gross = int(base_share * mult)
            tax_split = apply_sovereign_tax(gross)
            net = tax_split["net"]
            sovereign_tax_total += tax_split["tax"]
            payouts_total += net

            # Credit the winner.
            from utils.wallet_fields import pick_wallet_field_for_credit  # noqa: PLC0415
            uw = await db.users.find_one(
                {"user_id": t["user_id"]},
                {"_id": 0, "token_balance": 1, "credits_balance": 1},
            ) or {}
            field = pick_wallet_field_for_credit(uw)
            await db.users.update_one(
                {"user_id": t["user_id"]},
                {"$inc": {field: net}},
            )
            await db.dsg6_tickets.update_one(
                {"ticket_id": t["ticket_id"]},
                {"$set": {
                    "status": "won",
                    "matches": tier,
                    "vibe_ball_match": t["vibe_ball_match"],
                    "payout_vibe": net,
                    "gross_payout_vibe": gross,
                    "tax_vibe": tax_split["tax"],
                }},
            )
            settlements.append({
                "ticket_id": t["ticket_id"],
                "user_id": t["user_id"],
                "tier": tier,
                "vibe_ball_match": t["vibe_ball_match"],
                "gross": gross,
                "net": net,
            })

    # 5. Mark all losing tickets.
    await db.dsg6_tickets.update_many(
        {"draw_id": target_draw, "status": "pending"},
        {"$set": {"status": "lost"}},
    )

    # 6. Persist the draw record.
    now = datetime.now(timezone.utc).isoformat()
    draw_doc = {
        "draw_id": target_draw,
        "winning_core": winning_core,
        "winning_ball": winning_ball,
        "tickets_sold": n_tickets,
        "pool_vibe": pool_after_maint,
        "payouts_total_vibe": payouts_total,
        "sovereign_tax_total_vibe": sovereign_tax_total,
        "winners": len(settlements),
        "status": "settled",
        "settled_at": now,
    }
    await db.dsg6_draws.update_one(
        {"draw_id": target_draw},
        {"$set": draw_doc},
        upsert=True,
    )
    return {**draw_doc, "settlements": settlements}

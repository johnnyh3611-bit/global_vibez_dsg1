"""
Vibe Integrity & Ban Protocol — Sovereign Master Code §2 + Integrity Protocol PDF.

Provides:
  • Crowdsourced score-report submission for sports settlements.
  • Consensus Mesh ("Vibe Check") — requires 10 reporters @ 75% agreement.
    Chair holders ("Geniuses") vote with 2× weight.
  • Three-Strike fraud-ban enforcement (10% Vibe Credit Tax + 24h ban on
    strike 1, 50% + 7d on strike 2, permanent on strike 3).
  • Correct-report reward (5 ₵ VIBE per validated report).

ENDPOINTS (mounted under /api):
  POST /api/integrity/report           — submit a score report for a game
  POST /api/integrity/resolve          — run the consensus + settle / ban
  GET  /api/integrity/my-status        — caller's strikes + ban state
  GET  /api/integrity/config           — public read of the Vibe Check params
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from utils.database import get_database, get_current_user

router = APIRouter()

# Configurable via env later; sourced verbatim from Integrity Protocol PDF.
VIBE_CHECK = {
    "Min_Reporters": 10,
    "Consensus_Threshold": 0.75,
    "Genius_Chair_Weight": 2.0,
    "Reward_Per_Correct_Report_Vibe": 5,
    "Fraud_Detection": "Active",
    # Penalties (Three-Strike Ban Policy):
    "Strike_1": {"tax_pct": 0.10, "suspension_hours": 24},
    "Strike_2": {"tax_pct": 0.50, "suspension_hours": 24 * 7},
    "Strike_3": {"permanent_ban": True},
}


class ReportPayload(BaseModel):
    game_id: str = Field(min_length=4, max_length=64)
    reported_winner: str = Field(min_length=2, max_length=24)


class ResolvePayload(BaseModel):
    game_id: str


async def _is_chair_holder(db, user_id: str) -> bool:
    doc = await db.chairs.find_one({"user_id": user_id}, {"_id": 0, "chair_id": 1})
    return doc is not None


async def _is_banned(db, user_id: str) -> Optional[Dict[str, Any]]:
    """Return ban record if user is currently banned, else None."""
    rec = await db.integrity_users.find_one({"user_id": user_id}, {"_id": 0})
    if not rec:
        return None
    if rec.get("permanent_ban"):
        return rec
    until = rec.get("suspended_until")
    if until and datetime.fromisoformat(until.replace("Z", "+00:00")) > datetime.now(timezone.utc):
        return rec
    return None


@router.get("/integrity/config")
async def public_config():
    return VIBE_CHECK


@router.get("/integrity/my-status")
async def my_status(http_request: Request):
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    rec = await db.integrity_users.find_one({"user_id": user.user_id}, {"_id": 0}) or {
        "user_id": user.user_id, "strikes": 0, "permanent_ban": False,
    }
    ban = await _is_banned(db, user.user_id)
    return {**rec, "currently_banned": ban is not None, "ban_record": ban}


@router.post("/integrity/report")
async def submit_report(payload: ReportPayload, http_request: Request):
    """Crowdsourced score report — one per user per game."""
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()

    # Reject banned users.
    ban = await _is_banned(db, user.user_id)
    if ban:
        raise HTTPException(403, f"Banned from reporting: strikes={ban.get('strikes', 0)} permanent={ban.get('permanent_ban', False)}")

    # Idempotent — same user can only report once per game.
    existing = await db.integrity_reports.find_one(
        {"game_id": payload.game_id, "user_id": user.user_id},
        {"_id": 0},
    )
    if existing:
        return {"status": "already_reported", "report": existing}

    chair = await _is_chair_holder(db, user.user_id)
    report = {
        "report_id": f"ir_{uuid.uuid4().hex[:12]}",
        "user_id": user.user_id,
        "game_id": payload.game_id,
        "reported_winner": payload.reported_winner,
        "weight": VIBE_CHECK["Genius_Chair_Weight"] if chair else 1.0,
        "chair_holder": chair,
        "reported_at": datetime.now(timezone.utc).isoformat(),
        "validated": None,  # filled at resolve time
    }
    await db.integrity_reports.insert_one(report)
    report.pop("_id", None)
    return {"status": "submitted", "report": report}


async def _process_report_outcome(db, user_id: str, was_correct: bool) -> Dict[str, Any]:
    """ProcessReport() — Three-Strike Ban Policy enforcement. Returns the
    updated user-integrity record. Mirrors the Sovereign PDF spec."""
    rec = await db.integrity_users.find_one({"user_id": user_id}, {"_id": 0}) or {
        "user_id": user_id, "strikes": 0, "permanent_ban": False,
    }
    if rec.get("permanent_ban"):
        return rec

    if was_correct:
        # Reward: +5 ₵ VIBE
        from utils.wallet_fields import pick_wallet_field_for_credit  # noqa: PLC0415
        uw = await db.users.find_one(
            {"user_id": user_id}, {"_id": 0, "token_balance": 1, "credits_balance": 1},
        ) or {}
        field = pick_wallet_field_for_credit(uw)
        await db.users.update_one(
            {"user_id": user_id},
            {"$inc": {field: VIBE_CHECK["Reward_Per_Correct_Report_Vibe"]}},
        )
        await db.integrity_users.update_one(
            {"user_id": user_id},
            {"$set": {"last_correct_at": datetime.now(timezone.utc).isoformat()}, "$inc": {"correct_reports": 1}},
            upsert=True,
        )
        rec["correct_reports"] = (rec.get("correct_reports") or 0) + 1
        return rec

    # Incorrect → apply strike + penalty.
    new_strikes = rec.get("strikes", 0) + 1
    update: Dict[str, Any] = {"strikes": new_strikes, "last_strike_at": datetime.now(timezone.utc).isoformat()}

    if new_strikes >= 3:
        update["permanent_ban"] = True
        update["banned_at"] = datetime.now(timezone.utc).isoformat()
    else:
        cfg = VIBE_CHECK["Strike_2"] if new_strikes == 2 else VIBE_CHECK["Strike_1"]
        # Apply Vibe Credit Tax.
        uw = await db.users.find_one(
            {"user_id": user_id}, {"_id": 0, "token_balance": 1, "credits_balance": 1},
        ) or {}
        balance = max(uw.get("token_balance") or 0, uw.get("credits_balance") or 0)
        tax = int(balance * cfg["tax_pct"])
        if tax > 0:
            from utils.wallet_fields import pick_wallet_field_for_credit  # noqa: PLC0415
            field = pick_wallet_field_for_credit(uw)
            await db.users.update_one(
                {"user_id": user_id}, {"$inc": {field: -tax}},
            )
            update["last_tax_vibe"] = tax
        # Suspension window.
        until = datetime.now(timezone.utc) + timedelta(hours=cfg["suspension_hours"])
        update["suspended_until"] = until.isoformat()

    await db.integrity_users.update_one(
        {"user_id": user_id}, {"$set": update}, upsert=True,
    )
    return {**rec, **update}


@router.post("/integrity/resolve")
async def resolve_consensus(payload: ResolvePayload, http_request: Request):
    """Run the Consensus Mesh on a game's reports. Caller must be admin
    OR the game's settlement is automatic via cron — for beta we keep it
    admin-only so a human can audit before mass strikes.
    """
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    if not getattr(user, "is_admin", False) and getattr(user, "role", "") != "admin":
        raise HTTPException(403, "Admin only")
    db = get_database()

    reports = await db.integrity_reports.find(
        {"game_id": payload.game_id, "validated": None},
        {"_id": 0},
    ).to_list(None)
    if len(reports) < VIBE_CHECK["Min_Reporters"]:
        return {"status": "insufficient_reports", "received": len(reports), "needed": VIBE_CHECK["Min_Reporters"]}

    # Tally weighted votes by winner.
    tally: Dict[str, float] = {}
    total_weight = 0.0
    for r in reports:
        w = float(r.get("weight") or 1.0)
        tally[r["reported_winner"]] = tally.get(r["reported_winner"], 0) + w
        total_weight += w

    leader, leader_weight = max(tally.items(), key=lambda kv: kv[1])
    consensus_ratio = leader_weight / total_weight if total_weight else 0
    if consensus_ratio < VIBE_CHECK["Consensus_Threshold"]:
        return {
            "status": "no_consensus",
            "tally": tally,
            "ratio": consensus_ratio,
            "threshold": VIBE_CHECK["Consensus_Threshold"],
        }

    # Consensus reached — process each reporter's outcome.
    processed = []
    for r in reports:
        correct = r["reported_winner"] == leader
        outcome = await _process_report_outcome(db, r["user_id"], correct)
        await db.integrity_reports.update_one(
            {"report_id": r["report_id"]},
            {"$set": {"validated": correct, "validated_at": datetime.now(timezone.utc).isoformat()}},
        )
        processed.append({
            "user_id": r["user_id"][:10] + "…",
            "correct": correct,
            "strikes_after": outcome.get("strikes", 0),
            "permanent_ban": outcome.get("permanent_ban", False),
        })

    return {
        "status": "consensus_reached",
        "game_id": payload.game_id,
        "winner": leader,
        "ratio": consensus_ratio,
        "total_reports": len(reports),
        "processed": processed,
    }

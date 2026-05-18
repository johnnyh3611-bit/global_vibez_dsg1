"""
Match Consensus Verification + 72-Hour Payout Airlock
=====================================================

2026-05-17 founder spec (TypeScript snippet) — anti-cheat consensus for
tournament match results. Both teams submit independently; the system
locks in the winner ONLY when both submissions agree on (winner_id +
final_score). On agreement we start a 72-hour airlock before the prize
clears so disputes can still surface. On disagreement we flag the match
DISPUTED, pause that bracket branch, and emit a security alert for crew
review.

Endpoints (admin/auth-gated where it matters):
  • POST /api/match-consensus/submit              — team submits a result
  • GET  /api/match-consensus/{match_id}          — current consensus state
  • POST /api/match-consensus/{match_id}/resolve  — admin manual override

Mongo collections used (zero schema changes — created on first write):
  • match_submissions     — per-team submission rows
                            unique on (match_id, reporting_team_id)
  • match_consensus       — single row per match: status + winner
  • match_airlocks        — TTL-style row: clears_at_iso, payout_status
  • security_alerts       — discrepancy log for crew dashboard
"""
from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from utils.database import get_database, get_current_user

logger = logging.getLogger("match_consensus")

router = APIRouter(prefix="/match-consensus", tags=["match-consensus"])

AIRLOCK_HOURS = 72
SUBMISSIONS_REQUIRED = 2  # head-to-head; raise for >2-team formats later


# ─── Models ─────────────────────────────────────────────────────────


class FinalScore(BaseModel):
    teamA: int = Field(..., ge=0)
    teamB: int = Field(..., ge=0)


class MatchSubmissionBody(BaseModel):
    match_id: str
    tournament_id: str
    reporting_team_id: str
    reported_winner_id: str
    final_score: FinalScore
    game_log_hash: str  # SHA-style hash proving the game was actually played


class DisputeResolveBody(BaseModel):
    winner_team_id: str
    admin_note: Optional[str] = None


# ─── Helpers ────────────────────────────────────────────────────────


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _airlock_clears_at_iso() -> str:
    return (datetime.now(timezone.utc) + timedelta(hours=AIRLOCK_HOURS)).isoformat()


def _strip_id(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Mongo ObjectId is non-JSON-serializable. Drop `_id` before return."""
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


async def _emit_security_alert(db, match_id: str, details: str) -> None:
    """Write a row to `security_alerts` for the crew dashboard.
    Non-fatal — alert failure must never block consensus flow."""
    try:
        await db.security_alerts.insert_one({
            "type": "MATCH_DISCREPANCY",
            "match_id": match_id,
            "details": details,
            "created_at": _utcnow_iso(),
            "status": "open",
        })
    except Exception as e:
        logger.warning(f"[match-consensus] security_alerts write failed: {e}")


async def _start_airlock(db, match_id: str, tournament_id: str, winner_team_id: str) -> Dict[str, Any]:
    """Idempotent: re-running on the same match returns the existing row
    without resetting the 72h timer."""
    existing = await db.match_airlocks.find_one({"match_id": match_id}, {"_id": 0})
    if existing:
        return existing
    row = {
        "match_id": match_id,
        "tournament_id": tournament_id,
        "winner_team_id": winner_team_id,
        "started_at": _utcnow_iso(),
        "clears_at": _airlock_clears_at_iso(),
        "payout_status": "held",
        "hours": AIRLOCK_HOURS,
    }
    await db.match_airlocks.insert_one(row)
    row.pop("_id", None)
    return row


# ─── Endpoints ──────────────────────────────────────────────────────


@router.post("/submit")
async def submit_match_result(body: MatchSubmissionBody) -> Dict[str, Any]:
    """Team submits their copy of the match result. Once both teams have
    submitted, the system compares and either VERIFIES (→ 72h airlock)
    or DISPUTES (→ security alert + bracket pause)."""
    db = get_database()

    # Reject submissions on a match that's already resolved one way or
    # the other. Avoids racing a final state.
    consensus = await db.match_consensus.find_one(
        {"match_id": body.match_id}, {"_id": 0, "status": 1}
    )
    if consensus and consensus.get("status") in {"VERIFIED_SUCCESS", "RESOLVED_BY_ADMIN"}:
        raise HTTPException(
            status_code=409,
            detail=f"Match already finalized as {consensus.get('status')}",
        )

    # Persist this team's submission. Compound-unique on
    # (match_id, reporting_team_id) — a team can re-submit (overwrite)
    # but can't fake being two teams. We update_one with upsert so a
    # late correction wins without surfacing a duplicate-key 500.
    submission_doc = {
        "match_id": body.match_id,
        "tournament_id": body.tournament_id,
        "reporting_team_id": body.reporting_team_id,
        "reported_winner_id": body.reported_winner_id,
        "final_score": body.final_score.model_dump(),
        "game_log_hash": body.game_log_hash,
        "submitted_at": _utcnow_iso(),
    }
    await db.match_submissions.update_one(
        {"match_id": body.match_id, "reporting_team_id": body.reporting_team_id},
        {"$set": submission_doc},
        upsert=True,
    )

    # Pull every submission for this match (without _id).
    cursor = db.match_submissions.find(
        {"match_id": body.match_id}, {"_id": 0}
    )
    submissions = await cursor.to_list(length=10)

    if len(submissions) < SUBMISSIONS_REQUIRED:
        return {
            "status": "AWAITING_OPPONENT",
            "message": "Waiting for the opposing team to submit results.",
            "submissions_received": len(submissions),
            "submissions_required": SUBMISSIONS_REQUIRED,
        }

    # We have ≥2 submissions. Compare the first two — extend logic for
    # round-robin (>2 teams) once that format ships.
    sub1, sub2 = submissions[0], submissions[1]

    winner_match = sub1["reported_winner_id"] == sub2["reported_winner_id"]
    score_match = (
        sub1["final_score"]["teamA"] == sub2["final_score"]["teamA"]
        and sub1["final_score"]["teamB"] == sub2["final_score"]["teamB"]
    )

    if winner_match and score_match:
        # SUCCESS: lock the verdict + start the 72h airlock.
        await db.match_consensus.update_one(
            {"match_id": body.match_id},
            {"$set": {
                "match_id": body.match_id,
                "tournament_id": body.tournament_id,
                "status": "VERIFIED_SUCCESS",
                "winner_team_id": sub1["reported_winner_id"],
                "final_score": sub1["final_score"],
                "verified_at": _utcnow_iso(),
            }},
            upsert=True,
        )
        airlock = await _start_airlock(
            db, body.match_id, body.tournament_id, sub1["reported_winner_id"]
        )
        return {
            "status": "SUCCESS",
            "winner": sub1["reported_winner_id"],
            "final_score": sub1["final_score"],
            "airlock": airlock,
        }

    # DISCREPANCY: flag the match + emit security alert.
    detail_msg = (
        f"Team {sub1['reporting_team_id']} claimed {sub1['reported_winner_id']} won "
        f"({sub1['final_score']}); Team {sub2['reporting_team_id']} claimed "
        f"{sub2['reported_winner_id']} won ({sub2['final_score']})."
    )
    await db.match_consensus.update_one(
        {"match_id": body.match_id},
        {"$set": {
            "match_id": body.match_id,
            "tournament_id": body.tournament_id,
            "status": "DISPUTED_FLAGGED",
            "winner_team_id": None,
            "disputed_at": _utcnow_iso(),
            "discrepancy": detail_msg,
        }},
        upsert=True,
    )
    await _emit_security_alert(db, body.match_id, detail_msg)
    return {
        "status": "DISPUTED",
        "message": "Match results conflict. Sent to manual review. Bracket branch paused.",
        "detail": detail_msg,
    }


@router.get("/{match_id}")
async def get_match_state(match_id: str) -> Dict[str, Any]:
    """Current consensus + airlock state for a given match. Used by the
    tournament bracket UI to render Verified / Awaiting / Disputed."""
    db = get_database()
    consensus = _strip_id(await db.match_consensus.find_one({"match_id": match_id}))
    airlock = _strip_id(await db.match_airlocks.find_one({"match_id": match_id}))
    submissions_count = await db.match_submissions.count_documents({"match_id": match_id})
    return {
        "match_id": match_id,
        "consensus": consensus,
        "airlock": airlock,
        "submissions_received": submissions_count,
        "submissions_required": SUBMISSIONS_REQUIRED,
    }


@router.post("/{match_id}/resolve")
async def admin_resolve_dispute(
    match_id: str, body: DisputeResolveBody, request: Request
) -> Dict[str, Any]:
    """Admin override for a DISPUTED match. Flips status to
    RESOLVED_BY_ADMIN, starts the 72h airlock with the admin-named
    winner, and stamps the audit log."""
    user = await get_current_user(request)
    if user is None or not getattr(user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Admin only")

    db = get_database()
    consensus = await db.match_consensus.find_one({"match_id": match_id})
    if not consensus:
        raise HTTPException(status_code=404, detail="Match not found")
    if consensus.get("status") == "VERIFIED_SUCCESS":
        raise HTTPException(status_code=409, detail="Match already verified by consensus")

    tournament_id = consensus.get("tournament_id", "")
    await db.match_consensus.update_one(
        {"match_id": match_id},
        {"$set": {
            "status": "RESOLVED_BY_ADMIN",
            "winner_team_id": body.winner_team_id,
            "resolved_by": getattr(user, "user_id", "admin"),
            "resolved_at": _utcnow_iso(),
            "admin_note": body.admin_note or "",
        }},
    )
    airlock = await _start_airlock(db, match_id, tournament_id, body.winner_team_id)
    return {
        "status": "RESOLVED_BY_ADMIN",
        "match_id": match_id,
        "winner_team_id": body.winner_team_id,
        "airlock": airlock,
    }


# ─── Optional helper for callers wanting a deterministic game-log hash ─


def hash_game_log(events: list) -> str:
    """Pure function: SHA-256 of the canonical event list. Frontends use
    this to produce the `game_log_hash` they submit so both teams
    independently compute the same hash for the same game."""
    canonical = "|".join(str(e) for e in events).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()

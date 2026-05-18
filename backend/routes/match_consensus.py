"""
Match Consensus Verification + 72-Hour Payout Airlock
=====================================================

2026-05-17 founder spec (TypeScript snippet) — anti-cheat consensus for
tournament match results. Both teams submit independently; the system
locks in the winner ONLY when both submissions agree on (winner_id +
final_score + game_log_hash). On agreement we start a 72-hour airlock
before the prize clears so disputes can still surface. On disagreement
we flag the match DISPUTED, pause that bracket branch, and emit a
security alert for crew review.

2026-05-17 (cont.) extensions on top of the original TS spec:
  • >2-team support — N submissions, majority winner rule (strict majority).
  • Hash-mismatch downgrade — even when winner_id + score agree, if
    the `game_log_hash` differs across teams the match is flipped to
    HASH_MISMATCH_REVIEW (catches a smarter cheater who scripts
    matching winner claims but plays different game states).
  • Airlock-release worker — periodic loop in `lifespan.py` flips
    `payout_status: held → cleared` once `clears_at` passes AND no
    open dispute exists. Manual ops endpoint exposed for curl/test.

Endpoints (admin/auth-gated where it matters):
  • POST /api/match-consensus/submit                — team submits a result
  • GET  /api/match-consensus/{match_id}            — current state
  • POST /api/match-consensus/{match_id}/resolve    — admin manual override
  • POST /api/match-consensus/airlock/release-due   — release matured airlocks (ops)

Mongo collections used (zero schema changes — created on first write):
  • match_submissions  — per-team row, unique on (match_id, reporting_team_id)
  • match_consensus    — single row per match: status + winner
  • match_airlocks     — TTL-style row: clears_at, payout_status
  • security_alerts    — discrepancy log for the crew dashboard
"""
from __future__ import annotations

import hashlib
import logging
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from utils.database import get_database, get_current_user

logger = logging.getLogger("match_consensus")

router = APIRouter(prefix="/match-consensus", tags=["match-consensus"])

AIRLOCK_HOURS = 72
DEFAULT_SUBMISSIONS_REQUIRED = 2  # head-to-head; override per-match below.


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
    game_log_hash: str
    # Optional override for >2-team formats (round-robin / free-for-all).
    # Defaults to 2 (head-to-head) so existing callers don't change.
    expected_submissions: Optional[int] = Field(default=None, ge=2, le=16)


class DisputeResolveBody(BaseModel):
    winner_team_id: str
    admin_note: Optional[str] = None


# ─── Helpers ────────────────────────────────────────────────────────


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _utcnow_iso() -> str:
    return _utcnow().isoformat()


def _airlock_clears_at_iso() -> str:
    return (_utcnow() + timedelta(hours=AIRLOCK_HOURS)).isoformat()


def _strip_id(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


async def _emit_security_alert(db, match_id: str, alert_type: str, details: str) -> None:
    """Crew dashboard alert. Non-fatal — never block consensus flow."""
    try:
        await db.security_alerts.insert_one({
            "type": alert_type,
            "match_id": match_id,
            "details": details,
            "created_at": _utcnow_iso(),
            "status": "open",
        })
    except Exception as e:
        logger.warning(f"[match-consensus] security_alerts write failed: {e}")


async def _start_airlock(db, match_id: str, tournament_id: str, winner_team_id: str) -> Dict[str, Any]:
    """Idempotent: re-running on the same match returns the existing
    row without resetting the 72h timer."""
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


def _strict_majority_winner(subs: List[Dict[str, Any]]) -> Tuple[Optional[str], Optional[Dict[str, int]]]:
    """Strict-majority rule: returns (winner_id, agreed_score) when a
    single winner has > 50% of votes AND that majority cohort agrees
    on the final_score. Otherwise (None, None).

    For 2-submission head-to-head the rule degenerates to "both agree",
    matching the original founder spec exactly.
    """
    if not subs:
        return None, None
    votes = Counter(s["reported_winner_id"] for s in subs)
    winner_id, count = votes.most_common(1)[0]
    if count * 2 <= len(subs):  # need strict majority
        return None, None
    # All majority voters must also agree on the score.
    majority_scores = [
        (s["final_score"]["teamA"], s["final_score"]["teamB"])
        for s in subs if s["reported_winner_id"] == winner_id
    ]
    if len(set(majority_scores)) != 1:
        return None, None
    a, b = majority_scores[0]
    return winner_id, {"teamA": a, "teamB": b}


def _hashes_consistent(subs: List[Dict[str, Any]]) -> bool:
    """True iff every submission carries the same game_log_hash."""
    hashes = {s.get("game_log_hash") for s in subs}
    return len(hashes) == 1


# ─── Endpoints ──────────────────────────────────────────────────────


@router.post("/submit")
async def submit_match_result(body: MatchSubmissionBody) -> Dict[str, Any]:
    """Team submits their copy of the match result. Once the expected
    number of submissions land, the system runs:
      1. Strict-majority winner check (degenerates to "both agree" for N=2)
      2. Score agreement among the majority cohort
      3. game_log_hash equality across ALL submissions
    On all-three-pass → VERIFIED_SUCCESS + 72h airlock.
    On winner+score pass but hash mismatch → HASH_MISMATCH_REVIEW.
    On winner or score mismatch → DISPUTED_FLAGGED.
    """
    db = get_database()

    consensus = await db.match_consensus.find_one(
        {"match_id": body.match_id}, {"_id": 0, "status": 1}
    )
    if consensus and consensus.get("status") in {"VERIFIED_SUCCESS", "RESOLVED_BY_ADMIN"}:
        raise HTTPException(
            status_code=409,
            detail=f"Match already finalized as {consensus.get('status')}",
        )

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

    cursor = db.match_submissions.find({"match_id": body.match_id}, {"_id": 0})
    submissions = await cursor.to_list(length=16)

    expected = body.expected_submissions or DEFAULT_SUBMISSIONS_REQUIRED
    if len(submissions) < expected:
        return {
            "status": "AWAITING_OPPONENT",
            "message": "Waiting for the opposing team(s) to submit results.",
            "submissions_received": len(submissions),
            "submissions_required": expected,
        }

    # ─── Consensus pipeline ───────────────────────────────────────
    winner_id, agreed_score = _strict_majority_winner(submissions)

    if winner_id and agreed_score:
        # Winner + score agree among the majority. Now check the hash
        # invariant across ALL submissions (catches matching winner
        # claims with mismatched game states).
        if _hashes_consistent(submissions):
            await db.match_consensus.update_one(
                {"match_id": body.match_id},
                {"$set": {
                    "match_id": body.match_id,
                    "tournament_id": body.tournament_id,
                    "status": "VERIFIED_SUCCESS",
                    "winner_team_id": winner_id,
                    "final_score": agreed_score,
                    "verified_at": _utcnow_iso(),
                }},
                upsert=True,
            )
            airlock = await _start_airlock(
                db, body.match_id, body.tournament_id, winner_id
            )
            return {
                "status": "SUCCESS",
                "winner": winner_id,
                "final_score": agreed_score,
                "airlock": airlock,
            }

        # Winner + score match but hashes don't → smarter-cheater pattern.
        all_hashes = sorted({s.get("game_log_hash", "") for s in submissions})
        detail = (
            f"Winner ({winner_id}) and score ({agreed_score}) agree but "
            f"game_log_hash mismatch across {len(submissions)} submissions: "
            f"{all_hashes}"
        )
        await db.match_consensus.update_one(
            {"match_id": body.match_id},
            {"$set": {
                "match_id": body.match_id,
                "tournament_id": body.tournament_id,
                "status": "HASH_MISMATCH_REVIEW",
                "winner_team_id": None,
                "final_score": agreed_score,
                "flagged_at": _utcnow_iso(),
                "discrepancy": detail,
            }},
            upsert=True,
        )
        await _emit_security_alert(db, body.match_id, "GAME_LOG_HASH_MISMATCH", detail)
        return {
            "status": "HASH_MISMATCH_REVIEW",
            "message": (
                "Both teams agree on winner and score but their game-log "
                "hashes differ. Sent to manual review — payout NOT released."
            ),
            "detail": detail,
        }

    # ─── DISCREPANCY ──────────────────────────────────────────────
    detail_msg = "; ".join(
        f"Team {s['reporting_team_id']} → winner={s['reported_winner_id']} score={s['final_score']}"
        for s in submissions
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
    await _emit_security_alert(db, body.match_id, "MATCH_DISCREPANCY", detail_msg)
    return {
        "status": "DISPUTED",
        "message": "Match results conflict. Sent to manual review. Bracket branch paused.",
        "detail": detail_msg,
    }


@router.get("/bulk")
async def get_match_state_bulk(match_ids: str) -> Dict[str, Any]:
    """Batch consensus + airlock lookup for an entire bracket in ONE
    round-trip. `match_ids` is a comma-separated list (max 128 ids).

    Frontend pattern: a 64-team single-elim bracket has 32 matches per
    refresh. Calling /match-consensus/{id} once per cell = 32 polls
    every 20s. This endpoint collapses that to 1 poll → 32 cells.

    NOTE: must be declared BEFORE `/{match_id}` so FastAPI's path
    resolver doesn't match `/bulk` as `match_id=bulk`.

    Response shape (one entry per requested match_id, in input order):
      { results: [{ match_id, consensus, airlock, submissions_received }] }
    """
    db = get_database()
    ids = [m.strip() for m in match_ids.split(",") if m.strip()]
    if not ids:
        return {"results": []}
    if len(ids) > 128:
        raise HTTPException(status_code=400, detail="max 128 match_ids per request")

    consensus_docs = await db.match_consensus.find(
        {"match_id": {"$in": ids}}, {"_id": 0}
    ).to_list(length=128)
    airlock_docs = await db.match_airlocks.find(
        {"match_id": {"$in": ids}}, {"_id": 0}
    ).to_list(length=128)
    sub_counts_cursor = db.match_submissions.aggregate([
        {"$match": {"match_id": {"$in": ids}}},
        {"$group": {"_id": "$match_id", "n": {"$sum": 1}}},
    ])
    sub_counts = {r["_id"]: r["n"] async for r in sub_counts_cursor}

    consensus_by_id = {c["match_id"]: c for c in consensus_docs}
    airlock_by_id = {a["match_id"]: a for a in airlock_docs}

    results = [{
        "match_id": mid,
        "consensus": consensus_by_id.get(mid),
        "airlock": airlock_by_id.get(mid),
        "submissions_received": sub_counts.get(mid, 0),
        "submissions_required": DEFAULT_SUBMISSIONS_REQUIRED,
    } for mid in ids]
    return {"results": results}


@router.get("/{match_id}")
async def get_match_state(match_id: str) -> Dict[str, Any]:
    db = get_database()
    consensus = _strip_id(await db.match_consensus.find_one({"match_id": match_id}))
    airlock = _strip_id(await db.match_airlocks.find_one({"match_id": match_id}))
    submissions_count = await db.match_submissions.count_documents({"match_id": match_id})
    return {
        "match_id": match_id,
        "consensus": consensus,
        "airlock": airlock,
        "submissions_received": submissions_count,
        "submissions_required": DEFAULT_SUBMISSIONS_REQUIRED,
    }


@router.post("/{match_id}/resolve")
async def admin_resolve_dispute(
    match_id: str, body: DisputeResolveBody, request: Request
) -> Dict[str, Any]:
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


# ─── Airlock release worker ─────────────────────────────────────────


async def release_due_airlocks(db) -> Dict[str, Any]:
    """Scan `match_airlocks` for matured rows (clears_at < now, still
    held) and flip them to `cleared` — UNLESS the match has been
    flipped to DISPUTED_FLAGGED or HASH_MISMATCH_REVIEW in the
    meantime (in which case the airlock stays held pending admin
    resolution).

    On clearance the worker hands off to the tournament service:
      • inserts a row into `match_payout_events` (audit + downstream hook)
      • notifies the winner via `engagement` collection (same shape
        the existing tournament-win notification uses)

    Returns a small summary dict. Safe to call repeatedly.
    """
    now_iso = _utcnow_iso()
    cursor = db.match_airlocks.find(
        {"payout_status": "held", "clears_at": {"$lte": now_iso}},
        {"_id": 0},
    )
    matured = await cursor.to_list(length=500)

    released = 0
    held_due_to_dispute = 0
    for row in matured:
        match_id = row["match_id"]
        consensus = await db.match_consensus.find_one(
            {"match_id": match_id}, {"_id": 0, "status": 1, "winner_team_id": 1}
        )
        status = (consensus or {}).get("status")
        if status in {"DISPUTED_FLAGGED", "HASH_MISMATCH_REVIEW"}:
            held_due_to_dispute += 1
            continue
        await db.match_airlocks.update_one(
            {"match_id": match_id, "payout_status": "held"},
            {"$set": {"payout_status": "cleared", "cleared_at": now_iso}},
        )
        released += 1

        # ─── Tournament service handoff ─────────────────────────
        # Non-fatal — the airlock clearance is the source of truth;
        # downstream hooks failing must NEVER hold up payouts.
        winner_id = row.get("winner_team_id") or (consensus or {}).get("winner_team_id")
        tournament_id = row.get("tournament_id", "")
        try:
            await db.match_payout_events.insert_one({
                "match_id": match_id,
                "tournament_id": tournament_id,
                "winner_team_id": winner_id,
                "event": "airlock_cleared",
                "at": now_iso,
            })
        except Exception as e:
            logger.warning(f"[match-consensus] payout-event write failed: {e}")
        if winner_id:
            try:
                await db.engagement.insert_one({
                    "id": f"airlock_{match_id}",
                    "user_id": winner_id,
                    "type": "match_payout_cleared",
                    "title": "💰 Match Payout Released",
                    "message": (
                        f"The 72-hour airlock on your match cleared. "
                        f"Your prize for match {match_id} is now released."
                    ),
                    "action_url": (
                        f"/tournament/{tournament_id}" if tournament_id else "/tournaments"
                    ),
                    "is_read": False,
                    "created_at": now_iso,
                })
            except Exception as e:
                logger.warning(f"[match-consensus] engagement notify failed: {e}")

    return {
        "matured": len(matured),
        "released": released,
        "held_due_to_dispute": held_due_to_dispute,
    }


@router.post("/airlock/release-due")
async def release_due_airlocks_endpoint() -> Dict[str, Any]:
    """Ops/manual trigger for the airlock-release worker. Returns the
    same summary the scheduled loop reports."""
    db = get_database()
    return await release_due_airlocks(db)


# ─── Optional helper for callers wanting a deterministic game-log hash ─


def hash_game_log(events: list) -> str:
    """Pure function: SHA-256 of the canonical event list. Frontends use
    this to produce the `game_log_hash` they submit so both teams
    independently compute the same hash for the same game."""
    canonical = "|".join(str(e) for e in events).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()

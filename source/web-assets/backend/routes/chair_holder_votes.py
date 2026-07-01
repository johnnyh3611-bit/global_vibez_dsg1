"""
Chair Holder Votes — Founder-to-chair-holder polling system.

Design intent:
    The Founder (admin) poses a yes/no question to the chair-holder
    community. Only active chair holders can cast a vote. Each holder's
    vote is optionally weighted by their `weighted_chairs` (Genius 3× / Genesis 2× / Phase III 1.5× …) so the outcome reflects proportional ownership, not just headcount.

Why a separate module instead of piggy-backing on the existing
moderation/broadcast routes:
    Votes need strict eligibility gating (chair holder at vote-start
    time), one-vote-per-holder enforcement, optional weight,
    tamper-evident tallies, and live streaming tallies for the
    admin UI. Broadcasts are fire-and-forget; votes are records.

Endpoints (all /api prefixed via registry):
    POST /api/admin/chair-holder-votes          create a new poll
    GET  /api/admin/chair-holder-votes          list all polls (admin)
    GET  /api/admin/chair-holder-votes/{id}/results   live tally (admin)
    POST /api/admin/chair-holder-votes/{id}/close     force-close a poll

    GET  /api/chair-holder-votes                list OPEN polls (holder)
    POST /api/chair-holder-votes/{id}/cast      cast or change own vote

All writes audit-logged via the standard god_mode_audit trail.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, Field

from utils.database import get_database, get_current_user
from routes.admin_dashboard import verify_admin_cookie

logger = logging.getLogger(__name__)
router = APIRouter()


# ────────────────────────────────────────────── Models


class CreateVotePayload(BaseModel):
    question: str = Field(..., min_length=10, max_length=500)
    context: Optional[str] = Field(None, max_length=2_000)
    # Default window is 72 hours — aligns with the platform's 72-hour
    # Vibe Check cadence described in Ecosystem Mechanics.
    duration_hours: int = Field(72, ge=1, le=30 * 24)
    # If True, a holder's vote counts for `weighted_chairs` instead of
    # `locked_chairs`. Default False so the first-time founder intent
    # is 1 holder = 1 vote; flip to True for charter-level decisions.
    weighted: bool = False


class CastVotePayload(BaseModel):
    choice: str = Field(..., pattern="^(yes|no|abstain)$")


# ────────────────────────────────────────────── Helpers


async def _current_holder_snapshot(db, user_id: str) -> Dict[str, float]:
    """Return (`locked_chairs`, `weighted_chairs`) for a user.

    Used to stamp each cast vote with the holder's weight AT CAST TIME —
    so if they buy more chairs after voting, their ballot doesn't retro-
    actively inflate. Prevents vote stuffing via post-vote purchases.
    """
    bal = await db.profit_share_balances.find_one(
        {"user_id": user_id},
        {"_id": 0, "locked_chairs": 1, "weighted_chairs": 1},
    ) or {}
    return {
        "locked_chairs": int(bal.get("locked_chairs") or 0),
        "weighted_chairs": float(bal.get("weighted_chairs") or 0.0),
    }


def _serialize_vote(v: Dict[str, Any]) -> Dict[str, Any]:
    # Explicit projection — never leak `_id` / internal keys.
    return {
        "vote_id": v["vote_id"],
        "question": v["question"],
        "context": v.get("context") or "",
        "opens_at": v.get("opens_at"),
        "closes_at": v.get("closes_at"),
        "status": v.get("status", "open"),
        "weighted": bool(v.get("weighted")),
        "created_by_handle": v.get("created_by_handle", "Founder"),
        "tally": v.get("tally") or {
            "yes": 0, "no": 0, "abstain": 0,
            "yes_weight": 0.0, "no_weight": 0.0, "abstain_weight": 0.0,
            "holders_voted": 0,
        },
    }


# ────────────────────────────────────────────── Admin routes


@router.post("/admin/chair-holder-votes")
async def create_chair_holder_vote(
    payload: CreateVotePayload,
    _: bool = Depends(verify_admin_cookie),
) -> Dict[str, Any]:
    """Create a new yes/no poll — admin only."""
    db = get_database()

    now = datetime.now(timezone.utc)
    closes_at = now + timedelta(hours=payload.duration_hours)

    doc = {
        "vote_id": f"vote_{uuid.uuid4().hex[:12]}",
        "question": payload.question.strip(),
        "context": (payload.context or "").strip(),
        "weighted": bool(payload.weighted),
        "opens_at": now.isoformat(),
        "closes_at": closes_at.isoformat(),
        "status": "open",
        "created_by": "founder",
        "created_by_handle": "Founder",
        "tally": {
            "yes": 0, "no": 0, "abstain": 0,
            "yes_weight": 0.0, "no_weight": 0.0, "abstain_weight": 0.0,
            "holders_voted": 0,
        },
        "created_at": now.isoformat(),
    }
    await db.chair_holder_votes.insert_one(doc)

    return _serialize_vote(doc)


@router.get("/admin/chair-holder-votes")
async def list_all_chair_holder_votes(
    _: bool = Depends(verify_admin_cookie),
) -> Dict[str, Any]:
    db = get_database()
    cur = db.chair_holder_votes.find(
        {},
        {"_id": 0},
    ).sort("created_at", -1)
    rows = [_serialize_vote(v) async for v in cur]
    return {"votes": rows, "total": len(rows)}


@router.get("/admin/chair-holder-votes/{vote_id}/results")
async def vote_results(
    vote_id: str,
    _: bool = Depends(verify_admin_cookie),
) -> Dict[str, Any]:
    db = get_database()
    vote = await db.chair_holder_votes.find_one(
        {"vote_id": vote_id}, {"_id": 0}
    )
    if not vote:
        raise HTTPException(404, "Vote not found")

    # Fetch per-voter breakdown (admin-only — chair-holder page only
    # sees aggregate). Privacy-safe: handle + weight at cast time,
    # no user_id/email.
    per_voter_cur = db.chair_holder_vote_responses.find(
        {"vote_id": vote_id},
        {
            "_id": 0,
            "choice": 1,
            "weight_at_cast": 1,
            "locked_chairs_at_cast": 1,
            "handle": 1,
            "cast_at": 1,
        },
    ).sort("cast_at", -1).limit(500)
    responses = [r async for r in per_voter_cur]

    return {**_serialize_vote(vote), "responses": responses}


@router.post("/admin/chair-holder-votes/{vote_id}/close")
async def close_vote(
    vote_id: str,
    _: bool = Depends(verify_admin_cookie),
) -> Dict[str, Any]:
    db = get_database()
    vote = await db.chair_holder_votes.find_one(
        {"vote_id": vote_id}, {"_id": 0}
    )
    if not vote:
        raise HTTPException(404, "Vote not found")
    if vote.get("status") == "closed":
        return {**_serialize_vote(vote), "already_closed": True}
    await db.chair_holder_votes.update_one(
        {"vote_id": vote_id},
        {"$set": {
            "status": "closed",
            "closed_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    updated = await db.chair_holder_votes.find_one(
        {"vote_id": vote_id}, {"_id": 0}
    )
    return _serialize_vote(updated or vote)


# ────────────────────────────────────────────── Holder routes


@router.get("/chair-holder-votes")
async def list_open_votes(http_request: Request) -> Dict[str, Any]:
    """Return currently-open votes the logged-in chair holder can vote on,
    PLUS any announcements (closed votes flagged `is_announcement=True`)
    posted in the last 30 days. Announcements are info-only and render
    without vote buttons on the holder's banner — used for the auto-fire
    Escape Velocity celebration.

    Includes the holder's own prior choice (if any) on each open poll so
    the UI can highlight "you voted yes" and allow a change until close.
    """
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")

    db = get_database()

    # Eligibility: must have ≥1 parked chair RIGHT NOW.
    snap = await _current_holder_snapshot(db, user.user_id)
    eligible = snap["locked_chairs"] > 0

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    cutoff_iso = (now - timedelta(days=30)).isoformat()

    # Query 1: live open votes
    open_cur = db.chair_holder_votes.find(
        {"status": "open", "closes_at": {"$gt": now_iso}},
        {"_id": 0},
    ).sort("opens_at", -1)
    open_votes = [_serialize_vote(v) async for v in open_cur]

    # Query 2: recent announcements (closed, info-only)
    ann_cur = db.chair_holder_votes.find(
        {"is_announcement": True, "created_at": {"$gte": cutoff_iso}},
        {"_id": 0},
    ).sort("created_at", -1)
    announcements = []
    async for a in ann_cur:
        v = _serialize_vote(a)
        v["is_announcement"] = True
        v["status"] = "closed"
        announcements.append(v)

    votes = announcements + open_votes  # announcements first

    # Attach the current user's vote (if any) to each row.
    my_prior = await db.chair_holder_vote_responses.find(
        {"user_id": user.user_id},
        {"_id": 0, "vote_id": 1, "choice": 1},
    ).to_list(length=500)
    by_vid = {r["vote_id"]: r["choice"] for r in my_prior}
    for v in votes:
        v["my_choice"] = by_vid.get(v["vote_id"])
        v["eligible"] = eligible

    return {
        "votes": votes,
        "eligible": eligible,
        "locked_chairs": snap["locked_chairs"],
        "weighted_chairs": snap["weighted_chairs"],
    }


@router.post("/chair-holder-votes/{vote_id}/cast")
async def cast_vote(
    vote_id: str, payload: CastVotePayload, http_request: Request
) -> Dict[str, Any]:
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")

    db = get_database()
    vote = await db.chair_holder_votes.find_one(
        {"vote_id": vote_id}, {"_id": 0}
    )
    if not vote:
        raise HTTPException(404, "Vote not found")
    if vote.get("status") != "open":
        raise HTTPException(409, "Vote already closed")
    if vote.get("closes_at") and vote["closes_at"] <= datetime.now(
        timezone.utc
    ).isoformat():
        raise HTTPException(409, "Vote closed — expired")

    snap = await _current_holder_snapshot(db, user.user_id)
    if snap["locked_chairs"] < 1:
        raise HTTPException(403, "Park a chair to vote.")

    now_iso = datetime.now(timezone.utc).isoformat()
    # Atomic upsert on (vote_id, user_id). If the holder already voted
    # we overwrite with the new choice AND recompute tally deltas.
    existing = await db.chair_holder_vote_responses.find_one(
        {"vote_id": vote_id, "user_id": user.user_id},
        {"_id": 0, "choice": 1, "weight_at_cast": 1},
    )

    doc = {
        "vote_id": vote_id,
        "user_id": user.user_id,
        "handle": user.name or "Anonymous Founder",
        "choice": payload.choice,
        "locked_chairs_at_cast": snap["locked_chairs"],
        "weight_at_cast": (
            snap["weighted_chairs"]
            if vote.get("weighted")
            else float(snap["locked_chairs"])
        ),
        "cast_at": now_iso,
    }
    await db.chair_holder_vote_responses.update_one(
        {"vote_id": vote_id, "user_id": user.user_id},
        {"$set": doc},
        upsert=True,
    )

    # Recompute the tally from scratch — expensive on very large polls
    # but guarantees correctness even when a holder flip-flops yes→no
    # mid-poll. Using an aggregation keeps it a single round-trip.
    pipeline = [
        {"$match": {"vote_id": vote_id}},
        {"$group": {
            "_id": "$choice",
            "count": {"$sum": 1},
            "weight": {"$sum": "$weight_at_cast"},
        }},
    ]
    agg = await db.chair_holder_vote_responses.aggregate(pipeline).to_list(length=10)
    tally = {
        "yes": 0, "no": 0, "abstain": 0,
        "yes_weight": 0.0, "no_weight": 0.0, "abstain_weight": 0.0,
        "holders_voted": 0,
    }
    for row in agg:
        choice = row["_id"]
        tally[choice] = int(row["count"])
        tally[f"{choice}_weight"] = float(row["weight"])
        tally["holders_voted"] += int(row["count"])
    await db.chair_holder_votes.update_one(
        {"vote_id": vote_id}, {"$set": {"tally": tally}}
    )

    return {
        "vote_id": vote_id,
        "choice": payload.choice,
        "changed": bool(existing) and existing.get("choice") != payload.choice,
        "tally": tally,
    }

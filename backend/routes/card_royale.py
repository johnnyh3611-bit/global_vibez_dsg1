"""
Daily Card Royale — Multi-Game Tournament routes.

Thin HTTP layer over utils/tournament_engine.py. Coexists with the legacy
/api/tournaments routes (single-game format). New prefix: /api/card-royale.

Economy rules:
- 1 free entry per template per day, unlimited paid retries at template.retry_buy_in_coins (₵)
- 50% of retry buy-in feeds prize pool, 50% is house sink
- Finalization distributes prize_split across top finishers
- Rewards route as (₵ → balance_coins) + ($DSG → vibez_mining_ledger, 72h Vibe Check hold)
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Dict, Any
from datetime import datetime, timezone

from utils.database import get_database
from utils.tournament_engine import (
    enter_tournament,
    submit_round_score,
    get_leaderboard,
    finalize_tournament,
    scheduler_tick,
)

router = APIRouter(prefix="/card-royale", tags=["card-royale"])


def _db():
    return get_database()


async def _resolve_user_id(request: Request) -> str:
    """Best-effort user id resolution for auth-optional tournament play."""
    # Session cookie first
    session_token = request.cookies.get("session_token")
    if session_token:
        doc = await _db().user_sessions.find_one(
            {"session_token": session_token}, {"user_id": 1, "_id": 0}
        )
        if doc:
            return doc["user_id"]
    # Fallback: x-user-id header (used by demo login / guest sessions)
    uid = request.headers.get("x-user-id") or request.headers.get("X-User-Id")
    if uid:
        return uid
    # Anonymous guest id (stable per-request-set — clients can pass same value)
    raise HTTPException(status_code=401, detail="Not authenticated")


# ==================== LISTINGS ====================

@router.get("/templates")
async def list_templates() -> Dict[str, Any]:
    templates = await _db().tournament_templates.find({}, {"_id": 0}).to_list(length=100)
    return {"templates": templates, "count": len(templates)}


@router.get("/active")
async def list_active() -> Dict[str, Any]:
    cursor = _db().tournaments.find(
        {"status": {"$in": ["OPEN", "RUNNING"]}}, {"_id": 0}
    ).sort("starts_at", 1)
    docs = await cursor.to_list(length=100)
    return {"tournaments": docs, "count": len(docs)}


@router.get("/upcoming")
async def list_upcoming() -> Dict[str, Any]:
    now_iso = datetime.now(timezone.utc).isoformat()
    cursor = _db().tournaments.find(
        {"status": "OPEN", "starts_at": {"$gt": now_iso}}, {"_id": 0}
    ).sort("starts_at", 1)
    docs = await cursor.to_list(length=50)
    return {"tournaments": docs, "count": len(docs)}


@router.get("/recent")
async def list_recent(limit: int = 20) -> Dict[str, Any]:
    cursor = _db().tournaments.find(
        {"status": "COMPLETED"}, {"_id": 0}
    ).sort("finalized_at", -1).limit(limit)
    docs = await cursor.to_list(length=limit)
    return {"tournaments": docs, "count": len(docs)}


@router.get("/details/{tournament_id}")
async def get_tournament_details(tournament_id: str) -> Dict[str, Any]:
    t = await _db().tournaments.find_one({"tournament_id": tournament_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, f"No tournament {tournament_id}")
    lb = await get_leaderboard(tournament_id, limit=20)
    return {"tournament": t, "leaderboard": lb}


@router.get("/leaderboard/{tournament_id}")
async def leaderboard(tournament_id: str, limit: int = 50) -> Dict[str, Any]:
    lb = await get_leaderboard(tournament_id, limit=limit)
    return {"tournament_id": tournament_id, "leaderboard": lb, "count": len(lb)}


# ==================== ENTRY + SCORING ====================

class EnterRequest(BaseModel):
    tournament_id: str
    use_free_entry: bool = True


@router.post("/enter")
async def enter(req: EnterRequest, request: Request) -> Dict[str, Any]:
    user_id = await _resolve_user_id(request)
    result = await enter_tournament(req.tournament_id, user_id, req.use_free_entry)
    if result.get("error"):
        raise HTTPException(400, result["error"])
    return result


class SubmitScoreRequest(BaseModel):
    tournament_id: str
    round_num: int
    raw_score: Dict[str, Any]


@router.post("/submit-score")
async def submit_score(req: SubmitScoreRequest, request: Request) -> Dict[str, Any]:
    user_id = await _resolve_user_id(request)
    result = await submit_round_score(
        req.tournament_id, user_id, req.round_num, req.raw_score
    )
    if result.get("error"):
        raise HTTPException(400, result["error"])
    return result


@router.get("/my-entries")
async def my_entries(request: Request, include_completed: bool = True) -> Dict[str, Any]:
    user_id = await _resolve_user_id(request)
    q: Dict[str, Any] = {"user_id": user_id}
    if not include_completed:
        q["status"] = "ACTIVE"
    cursor = _db().tournament_entries.find(q, {"_id": 0}).sort("joined_at", -1).limit(100)
    entries = await cursor.to_list(length=100)
    # Enrich with tournament basics
    tids = list({e["tournament_id"] for e in entries})
    tours = await _db().tournaments.find(
        {"tournament_id": {"$in": tids}}, {"_id": 0}
    ).to_list(length=len(tids))
    tour_map = {t["tournament_id"]: t for t in tours}
    for e in entries:
        t = tour_map.get(e["tournament_id"], {})
        e["tournament_name"] = t.get("name", "?")
        e["tournament_status"] = t.get("status", "UNKNOWN")
        e["tournament_format"] = t.get("format", "?")
    return {"entries": entries, "count": len(entries), "user_id": user_id}


@router.get("/my-entry/{tournament_id}")
async def my_entry(tournament_id: str, request: Request) -> Dict[str, Any]:
    user_id = await _resolve_user_id(request)
    entry = await _db().tournament_entries.find_one(
        {"tournament_id": tournament_id, "user_id": user_id}, {"_id": 0}
    )
    if not entry:
        return {"entry": None, "user_id": user_id}
    return {"entry": entry, "user_id": user_id}


# ==================== ADMIN ====================

class FinalizeRequest(BaseModel):
    tournament_id: str


@router.post("/admin/finalize")
async def admin_finalize(req: FinalizeRequest, request: Request) -> Dict[str, Any]:
    # Simple vault-cookie gate. Anything stricter lives in middleware/permissions.
    if not request.cookies.get("admin_session"):
        raise HTTPException(403, "Admin only")
    result = await finalize_tournament(req.tournament_id)
    if result.get("error"):
        raise HTTPException(400, result["error"])
    return result


@router.post("/admin/scheduler-tick")
async def admin_scheduler_tick(request: Request) -> Dict[str, Any]:
    if not request.cookies.get("admin_session"):
        raise HTTPException(403, "Admin only")
    return await scheduler_tick()

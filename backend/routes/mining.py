"""
$DSG Mining REST + WebSocket endpoints.
"""
from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone

from utils.database import get_current_user, get_database
from utils.mining_engine import (
    record_event, get_balance, is_mining_eligible, _get_user,
    set_global_boost, sweep_vibe_check_holds, _get_global_boost,
)

router = APIRouter(prefix="/mining", tags=["mining"])


class EventRequest(BaseModel):
    event: str  # trick_won | game_won | minute_at_table | spades_hand_won | interaction_tick | ...
    game_type: Optional[str] = None
    interaction_count: Optional[int] = None
    table_id: Optional[str] = None


class GlobalBoostRequest(BaseModel):
    value: float


@router.get("/my-balance")
async def my_balance(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return await get_balance(user.user_id)


@router.get("/my-history")
async def my_history(request: Request, limit: int = 50):
    """Recent mining ledger events for the current user, newest first.

    Used by the MyVibez profile page to render a personal activity feed.
    """
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    db = get_database()
    limit = max(1, min(200, limit))
    rows = await db.vibez_mining_ledger.find(
        {"user_id": user.user_id}, {"_id": 0},
    ).sort("created_at", -1).limit(limit).to_list(length=limit)

    # Aggregate win counts by game_type for headline stats
    by_game: dict[str, dict] = {}
    for r in rows:
        gt = r.get("game_type") or "other"
        evt = r.get("event") or ""
        d = by_game.setdefault(gt, {"game_type": gt, "wins": 0, "mined": 0.0, "events": 0})
        d["events"] += 1
        d["mined"] += float(r.get("mined", 0) or 0)
        if evt == "game_won":
            d["wins"] += 1
    return {
        "count": len(rows),
        "rows": rows,
        "by_game": sorted(
            ({**v, "mined": round(v["mined"], 2)} for v in by_game.values()),
            key=lambda x: x["mined"], reverse=True,
        ),
    }


@router.get("/recent-wins")
async def recent_wins(limit: int = 20, window_hours: int = 24):
    """Public platform-wide recent `game_won` events.

    Decorated with the winner's username so the games-menu ticker can render
    'Alice just won Spades · +5.0 $DSG'. No PII beyond username.
    """
    from datetime import datetime, timezone, timedelta
    db = get_database()
    limit = max(1, min(50, limit))
    window_hours = max(1, min(168, window_hours))
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=window_hours)).isoformat()
    rows = await db.vibez_mining_ledger.find(
        {
            "event": "game_won",
            "created_at": {"$gte": cutoff},
            "status": {"$ne": "SHADOW"},
        },
        {"_id": 0, "user_id": 1, "mined": 1, "game_type": 1, "created_at": 1},
    ).sort("created_at", -1).limit(limit).to_list(length=limit)

    user_ids = list({r["user_id"] for r in rows if r.get("user_id")})
    users = await db.users.find(
        {"user_id": {"$in": user_ids}}, {"user_id": 1, "username": 1, "_id": 0},
    ).to_list(length=len(user_ids)) if user_ids else []
    name_map = {u["user_id"]: u.get("username") or u["user_id"] for u in users}

    return {
        "count": len(rows),
        "rows": [
            {
                "username": name_map.get(r["user_id"], "Player"),
                "mined": round(float(r.get("mined", 0) or 0), 2),
                "game_type": r.get("game_type") or "game",
                "at": r["created_at"],
            }
            for r in rows
        ],
    }


@router.post("/record")
async def record(data: EventRequest, request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return await record_event(
        user.user_id,
        data.event,
        game_type=data.game_type,
        interaction_count=data.interaction_count,
    )


@router.get("/leaderboard")
async def leaderboard(window_hours: int = 24, limit: int = 50):
    """24-hour rolling top-N by $DSG mined. Default 24h window."""
    from datetime import datetime, timezone, timedelta
    db = get_database()
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=max(1, min(168, window_hours)))).isoformat()
    pipeline = [
        {"$match": {"created_at": {"$gte": cutoff}, "status": {"$ne": "SHADOW"}}},
        {"$group": {"_id": "$user_id", "mined": {"$sum": "$mined"}, "events": {"$sum": 1}}},
        {"$sort": {"mined": -1}},
        {"$limit": max(1, min(200, limit))},
    ]
    rows = await db.vibez_mining_ledger.aggregate(pipeline).to_list(length=limit)
    # Decorate with usernames
    user_ids = [r["_id"] for r in rows]
    users = await db.users.find(
        {"user_id": {"$in": user_ids}}, {"user_id": 1, "username": 1, "_id": 0}
    ).to_list(length=len(user_ids))
    name_map = {u["user_id"]: u.get("username", u["user_id"]) for u in users}
    return {
        "window_hours": window_hours,
        "count": len(rows),
        "rows": [
            {
                "rank": i + 1,
                "user_id": r["_id"],
                "username": name_map.get(r["_id"], r["_id"]),
                "mined": round(r["mined"], 2),
                "events": r["events"],
                "is_leader": i == 0,  # gets the :vibez_crown: badge
            }
            for i, r in enumerate(rows)
        ],
    }


# ==================== ADMIN / FOUNDER ENDPOINTS ====================

@router.get("/admin/global-boost")
async def get_global_boost_endpoint(request: Request):
    # Gated by caller: admin routes already check vault-auth; we piggyback on that.
    boost = await _get_global_boost()
    return {"global_boost": boost}


@router.post("/admin/global-boost")
async def set_global_boost_endpoint(data: GlobalBoostRequest, request: Request):
    value = await set_global_boost(data.value)
    return {"ok": True, "global_boost": value}


@router.post("/admin/sweep-vibe-check")
async def sweep_endpoint(request: Request):
    """Move any ledger entries past their 72h hold from pending → available."""
    count = await sweep_vibe_check_holds()
    return {"swept": count}


@router.get("/admin/mining-stats")
async def mining_stats(request: Request):
    db = get_database()
    from datetime import datetime, timezone, timedelta

    # Totals
    total_pending = await db.vibez_mining_balance.aggregate(
        [{"$group": {"_id": None, "total": {"$sum": "$pending_balance"}}}]
    ).to_list(length=1)
    total_available = await db.vibez_mining_balance.aggregate(
        [{"$group": {"_id": None, "total": {"$sum": "$balance"}}}]
    ).to_list(length=1)
    total_lifetime = await db.vibez_mining_balance.aggregate(
        [{"$group": {"_id": None, "total": {"$sum": "$lifetime_mined"}}}]
    ).to_list(length=1)

    # Last 24h mined
    cutoff_24 = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    last_24h = await db.vibez_mining_ledger.aggregate(
        [
            {"$match": {"created_at": {"$gte": cutoff_24}}},
            {"$group": {"_id": None, "total": {"$sum": "$mined"}, "events": {"$sum": 1}}},
        ]
    ).to_list(length=1)

    # Shadow-banned / flagged users
    flagged_count = await db.users.count_documents({"is_shadow_banned": True})
    flagged_users = await db.users.find(
        {"is_shadow_banned": True},
        {
            "user_id": 1, "username": 1, "shadow_ban_reason": 1,
            "shadow_ban_stddev": 1, "shadow_ban_at": 1, "_id": 0,
        },
    ).limit(25).to_list(length=25)

    return {
        "total_pending": (total_pending[0]["total"] if total_pending else 0.0),
        "total_available": (total_available[0]["total"] if total_available else 0.0),
        "total_lifetime_mined": (total_lifetime[0]["total"] if total_lifetime else 0.0),
        "last_24h_mined": (last_24h[0]["total"] if last_24h else 0.0),
        "last_24h_events": (last_24h[0]["events"] if last_24h else 0),
        "global_boost": await _get_global_boost(),
        "flagged_user_count": flagged_count,
        "flagged_users": flagged_users,
    }


@router.get("/admin/mining-snapshot")
async def mining_snapshot(request: Request):
    """
    SCAFFOLD for future TGE (Token Generation Event):
    returns a snapshot of every user's pending_balance ready for Solana minting.
    Does NOT touch any chain — purely a read-only export.
    """
    db = get_database()
    rows = await db.vibez_mining_balance.find(
        {"$or": [{"pending_balance": {"$gt": 0}}, {"balance": {"$gt": 0}}]},
        {"_id": 0},
    ).to_list(length=100_000)
    return {
        "snapshot_at": datetime.now(timezone.utc).isoformat(),
        "row_count": len(rows),
        "rows": rows,
        "note": "Future TGE: this snapshot will be the source of truth for Solana SPL minting.",
    }


# ==================== WEBSOCKET ====================

@router.websocket("/ws/{user_id}")
async def mining_socket(websocket: WebSocket, user_id: str):
    """
    Client sends:  {"event": "trick_won", "game_type": "spades"}
    Server sends:  {"mined": 2.25, "pending": 125.5, "status": "PENDING_VIBE_CHECK"}
    """
    await websocket.accept()

    user = await _get_user(user_id)
    if not user:
        await websocket.send_json({"error": "User not found"})
        await websocket.close()
        return

    eligible, reason = is_mining_eligible(user)
    if not eligible:
        await websocket.send_json({"locked": True, "reason": reason})
        await websocket.close()
        return

    try:
        while True:
            data = await websocket.receive_json()
            event = data.get("event", "")
            result = await record_event(
                user_id,
                event,
                multiplier_context=data.get("context"),
                game_type=data.get("game_type"),
                interaction_count=data.get("interaction_count"),
            )
            await websocket.send_json(result)
    except WebSocketDisconnect:
        return

"""Marathon Mode leaderboard — tracks the BIGGER-board variants of TTT XL
and Connect 4 XL where rounds take longer. We record two stats per game:

  • longest_moves  — the most moves in a completed round (endurance flex)
  • fastest_win   — the fewest moves to force a win (skill flex)

Storage: a single `marathon_rounds` collection with one doc per completed
round. Leaderboards are aggregated on read so we can slice by game_type +
metric + window without extra writes.
"""
from __future__ import annotations
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional, Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from utils.database import get_database, get_current_user

router = APIRouter(prefix="/marathon", tags=["marathon"])

SUPPORTED_GAMES = {"tictactoe_xl", "connect4_xl"}


class RecordRound(BaseModel):
    game_type: Literal["tictactoe_xl", "connect4_xl"]
    moves: int = Field(ge=1, le=500, description="Total moves (both players) in the completed round")
    result: Literal["win", "loss", "draw"]
    # Optional — included only when the user is anon / demo. The auth'd user
    # takes precedence if logged in.
    display_name: Optional[str] = None


@router.post("/record")
async def record_round(payload: RecordRound, request: Request) -> Dict[str, Any]:
    """Record a completed Marathon round for the current user.

    Unauthenticated users can still post (anon leaderboards are fun) but we
    tag the row so spammy/fake entries can be filtered later.
    """
    user = await get_current_user(request)
    user_id = user.user_id if user else None
    display_name = (
        (getattr(user, "name", None) or getattr(user, "username", None)) if user else None
    ) or payload.display_name or "Player"

    db = get_database()
    doc = {
        "user_id": user_id,
        "anon": user is None,
        "display_name": display_name,
        "game_type": payload.game_type,
        "moves": int(payload.moves),
        "result": payload.result,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.marathon_rounds.insert_one(doc)
    return {"ok": True, "recorded": True, "anon": user is None}


@router.get("/leaderboard")
async def leaderboard(
    game_type: str,
    metric: Literal["longest", "fastest_win"] = "longest",
    window_days: int = 30,
    limit: int = 10,
) -> Dict[str, Any]:
    """Top N entries for a given game + metric.

    • longest     → MAX(moves) per user for any terminal round (win/loss/draw)
    • fastest_win → MIN(moves) per user for rounds where result == 'win'
    """
    if game_type not in SUPPORTED_GAMES:
        raise HTTPException(status_code=400, detail=f"Unsupported game_type '{game_type}'")
    limit = max(1, min(50, limit))
    window_days = max(1, min(365, window_days))
    cutoff = (datetime.now(timezone.utc) - timedelta(days=window_days)).isoformat()

    db = get_database()
    match: Dict[str, Any] = {
        "game_type": game_type,
        "created_at": {"$gte": cutoff},
    }
    if metric == "fastest_win":
        match["result"] = "win"

    pipeline: list[dict] = [
        {"$match": match},
        {
            "$group": {
                "_id": {"$ifNull": ["$user_id", {"$concat": ["anon:", "$display_name"]}]},
                "display_name": {"$first": "$display_name"},
                "best_moves": {"$max" if metric == "longest" else "$min": "$moves"},
                "rounds": {"$sum": 1},
                "last_played": {"$max": "$created_at"},
            }
        },
        {"$sort": {"best_moves": -1 if metric == "longest" else 1}},
        {"$limit": limit},
    ]
    raw = await db.marathon_rounds.aggregate(pipeline).to_list(length=limit)
    rows = [
        {
            "user_id": r["_id"] if not str(r["_id"]).startswith("anon:") else None,
            "display_name": r.get("display_name") or "Player",
            "best_moves": r["best_moves"],
            "rounds": r["rounds"],
            "last_played": r.get("last_played"),
        }
        for r in raw
    ]
    return {
        "game_type": game_type,
        "metric": metric,
        "window_days": window_days,
        "count": len(rows),
        "rows": rows,
    }


@router.get("/my-stats")
async def my_stats(request: Request, game_type: Optional[str] = None) -> Dict[str, Any]:
    """Personal Marathon stats for the logged-in user."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_database()
    q: Dict[str, Any] = {"user_id": user.user_id}
    if game_type:
        if game_type not in SUPPORTED_GAMES:
            raise HTTPException(status_code=400, detail="Unsupported game_type")
        q["game_type"] = game_type

    pipeline = [
        {"$match": q},
        {
            "$group": {
                "_id": "$game_type",
                "rounds": {"$sum": 1},
                "wins": {"$sum": {"$cond": [{"$eq": ["$result", "win"]}, 1, 0]}},
                "longest_moves": {"$max": "$moves"},
                "fastest_win": {
                    "$min": {"$cond": [{"$eq": ["$result", "win"]}, "$moves", 99999]}
                },
            }
        },
    ]
    raw = await db.marathon_rounds.aggregate(pipeline).to_list(length=10)
    out = []
    for r in raw:
        fastest = r["fastest_win"] if r.get("fastest_win", 99999) != 99999 else None
        out.append({
            "game_type": r["_id"],
            "rounds": r["rounds"],
            "wins": r["wins"],
            "longest_moves": r["longest_moves"],
            "fastest_win": fastest,
        })
    return {"stats": out}

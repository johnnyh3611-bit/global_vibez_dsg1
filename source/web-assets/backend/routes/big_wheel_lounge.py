"""
Big Wheel Lounge — curated sub-experience for the higher-variance Spades
ruleset. Three public endpoints powering the /spades/big-wheel page:

  GET /api/spades/big-wheel/lobbies      — active BIG_WHEEL tables
  GET /api/spades/big-wheel/leaderboard  — top earners (last 7 / 30 days)
  GET /api/spades/big-wheel/stats        — table count + total pot in air

The leaderboard ranks users by `session_earnings` summed across every
BIG_WHEEL game they've played in the lookback window. Pulled from the
existing `spades_games` collection — no schema migration needed.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from fastapi import APIRouter, Query

from utils.database import get_database

router = APIRouter()


def _since_iso(days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()


@router.get("/spades/big-wheel/lobbies")
async def big_wheel_lobbies(
    limit: int = Query(20, ge=1, le=100),
) -> Dict[str, Any]:
    """List active Big Wheel tables — feeds the lobby grid."""
    db = get_database()
    rows = await db.spades_games.find(
        {"ruleset": "BIG_WHEEL", "status": "active"},
        {
            "_id": 0,
            "game_id": 1,
            "wager": 1,
            "pot": 1,
            "phase": 1,
            "created_at": 1,
            "scores": 1,
            "player_mapping": 1,
        },
    ).sort("created_at", -1).limit(limit).to_list(length=limit)

    lobbies = []
    for r in rows:
        mapping = r.get("player_mapping") or {}
        scores = r.get("scores") or {}
        lobbies.append({
            "game_id": r.get("game_id"),
            "wager": int(r.get("wager") or 0),
            "pot": int(r.get("pot") or 0),
            "phase": r.get("phase") or "active",
            "seat_count": sum(1 for v in mapping.values() if v and v != "AI"),
            "team1_points": (scores.get("team1") or {}).get("points", 0),
            "team2_points": (scores.get("team2") or {}).get("points", 0),
            "spectate_url": f"/spades-aaa/{r.get('game_id')}",
        })

    return {"count": len(lobbies), "lobbies": lobbies}


@router.get("/spades/big-wheel/leaderboard")
async def big_wheel_leaderboard(
    period_days: int = Query(7, ge=1, le=90),
    limit: int = Query(25, ge=1, le=100),
) -> Dict[str, Any]:
    """Top Big Wheel earners. Aggregates final team scores per player
    across every BIG_WHEEL game finished in the lookback window."""
    db = get_database()
    since = _since_iso(period_days)

    pipeline = [
        {
            "$match": {
                "ruleset": "BIG_WHEEL",
                "created_at": {"$gte": since},
                "status": {"$in": ["active", "finished"]},
            }
        },
        # Each game has a player_mapping {position: user_id} + scores.team1/team2.
        # Unwind by mapping entry, decide which team that seat is on, attach
        # the team's points as that user's earnings for the game.
        {"$project": {
            "game_id": 1,
            "team1_points": {"$ifNull": ["$scores.team1.points", 0]},
            "team2_points": {"$ifNull": ["$scores.team2.points", 0]},
            "mapping_arr": {"$objectToArray": "$player_mapping"},
        }},
        {"$unwind": "$mapping_arr"},
        {"$project": {
            "user_id": "$mapping_arr.v",
            "position": "$mapping_arr.k",
            "earnings": {
                "$cond": [
                    {"$in": ["$mapping_arr.k", ["north", "south"]]},
                    "$team1_points",
                    "$team2_points",
                ]
            },
        }},
        {"$match": {
            "user_id": {"$nin": [None, "", "AI", "AI_PARTNER", "AI_OPP1", "AI_OPP2"]},
        }},
        {"$group": {
            "_id": "$user_id",
            "earnings": {"$sum": "$earnings"},
            "games_played": {"$sum": 1},
        }},
        {"$sort": {"earnings": -1}},
        {"$limit": limit},
    ]
    rows = await db.spades_games.aggregate(pipeline).to_list(length=limit)

    # Hydrate usernames in one round-trip.
    user_ids = [r["_id"] for r in rows if r.get("_id")]
    users = {}
    if user_ids:
        async for u in db.users.find(
            {"user_id": {"$in": user_ids}},
            {"_id": 0, "user_id": 1, "username": 1, "name": 1, "email": 1},
        ):
            users[u["user_id"]] = (
                u.get("username")
                or u.get("name")
                or (u.get("email") or "").split("@")[0]
                or "Founder"
            )

    leaders = []
    for i, r in enumerate(rows, start=1):
        uid = r["_id"]
        leaders.append({
            "rank": i,
            "user_id": (uid[:6] + "…" + uid[-2:]) if uid and len(uid) > 10 else uid,
            "display_name": users.get(uid, "Founder"),
            "earnings": int(r.get("earnings") or 0),
            "games_played": int(r.get("games_played") or 0),
        })

    return {
        "period_days": period_days,
        "since": since,
        "count": len(leaders),
        "leaders": leaders,
    }


@router.get("/spades/big-wheel/stats")
async def big_wheel_stats() -> Dict[str, Any]:
    """Live snapshot for the lounge header — table count, total pot."""
    db = get_database()
    pipeline = [
        {"$match": {"ruleset": "BIG_WHEEL", "status": "active"}},
        {"$group": {
            "_id": None,
            "tables_active": {"$sum": 1},
            "total_pot": {"$sum": "$pot"},
        }},
    ]
    rows = await db.spades_games.aggregate(pipeline).to_list(length=1)
    if rows:
        return {
            "tables_active": int(rows[0].get("tables_active") or 0),
            "total_pot": int(rows[0].get("total_pot") or 0),
        }
    return {"tables_active": 0, "total_pot": 0}

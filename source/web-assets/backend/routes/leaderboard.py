"""
Public $DSG leaderboard.

Reuses the same `$lookup` aggregation path proven at scale
(services.tge_service.build_eligible_cohort) but exposes only the top-N
slice. Cached in-process for 60s so a viral share doesn't hammer Mongo.
"""
import asyncio
import time
from typing import Any, Dict, List

from fastapi import APIRouter

from utils.database import get_database

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])

_CACHE_TTL_SEC = 60
_cache_lock = asyncio.Lock()
_cache: Dict[str, Any] = {"ts": 0.0, "payload": None}


async def _compute_top_n(n: int = 100) -> Dict[str, Any]:
    db = get_database()
    pipeline: List[Dict[str, Any]] = [
        {"$match": {"$or": [
            {"pending_balance": {"$gt": 0}},
            {"balance": {"$gt": 0}},
        ]}},
        {"$addFields": {
            "pending_amt": {"$ifNull": ["$pending_balance", 0]},
            "avail_amt": {"$ifNull": ["$balance", 0]},
        }},
        {"$addFields": {
            "total_amt": {"$add": ["$pending_amt", "$avail_amt"]},
        }},
        {"$sort": {"total_amt": -1}},
        {"$limit": n},
        {"$lookup": {
            "from": "users",
            "localField": "user_id",
            "foreignField": "user_id",
            "as": "user",
        }},
        {"$unwind": {"path": "$user", "preserveNullAndEmptyArrays": True}},
        {"$project": {
            "_id": 0,
            "user_id": "$user_id",
            # Public leaderboard — no emails, no wallets, no PII.
            "display_name": {
                "$ifNull": [
                    "$user.username",
                    {"$concat": [{"$substr": ["$user_id", 0, 6]}, "…"]},
                ],
            },
            "avatar_url": {"$ifNull": ["$user.avatar_url", None]},
            "total_vibez": {"$round": ["$total_amt", 2]},
            "pending_vibez": {"$round": ["$pending_amt", 2]},
            "available_vibez": {"$round": ["$avail_amt", 2]},
            "is_elite": {"$eq": [{"$ifNull": ["$user.membership_type", ""]}, "elite"]},
        }},
    ]
    rows = await db.vibez_mining_balance.aggregate(pipeline).to_list(length=n)
    for i, r in enumerate(rows):
        r["rank"] = i + 1
    return {"top": rows, "count": len(rows)}


@router.get("/vibez-top100")
async def vibez_top100(limit: int = 100) -> Dict[str, Any]:
    limit = max(10, min(200, int(limit)))
    now = time.time()
    async with _cache_lock:
        cached = _cache["payload"]
        if cached and now - _cache["ts"] < _CACHE_TTL_SEC and cached.get("limit") == limit:
            return cached
    payload = await _compute_top_n(limit)
    payload["limit"] = limit
    payload["cached_until"] = int(now + _CACHE_TTL_SEC)
    async with _cache_lock:
        _cache["ts"] = now
        _cache["payload"] = payload
    return payload

"""
Admin live-seats — aggregator endpoint feeding the God-Mode "Seat Card"
widget. Returns the N most-recent active card-game tables and the
players sitting in them so the founder can spectate live action.

Pulls from `spades_games` for now; trivially extendable to other game
collections by adding entries to `_GAME_SOURCES`.

Returned shape (one row per occupied seat):
    {
        seat_id: "spades_xxxxxx-north",
        username: "Demo One",
        is_live: true,
        game_type: "spades",
        ruleset: "BIG_WHEEL",
        table_id: "spades_xxxxxx",
        seat_number: 1,
        chair_phase: "Genius",                    # if buyer
        chair_multiplier: 4.0,
        session_earnings: 320,
        spectate_url: "/spades-aaa/spades_xxxxxx",
    }
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List

from fastapi import APIRouter, Depends

from utils.database import get_database
from routes.admin_dashboard import verify_admin_cookie

logger = logging.getLogger(__name__)
router = APIRouter()


# Collection → (display_name, spectate_url_template, player_mapping_field).
_GAME_SOURCES = [
    {
        "coll": "spades_games",
        "game_type": "spades",
        "spectate_template": "/spades-aaa/{table_id}",
        "mapping_field": "player_mapping",
        "table_id_field": "game_id",
    },
]


async def _hydrate_user(db, user_id: str) -> Dict[str, Any]:
    """Pull the username + chair phase + multiplier for a seated player."""
    if not user_id or user_id == "AI":
        return {
            "username": "AI",
            "chair_phase": None,
            "chair_multiplier": None,
        }
    user = await db.users.find_one(
        {"user_id": user_id},
        {"_id": 0, "username": 1, "name": 1, "email": 1},
    ) or {}
    bal = await db.profit_share_balances.find_one(
        {"user_id": user_id},
        {"_id": 0, "weighted_chairs": 1, "locked_chairs": 1, "phase": 1},
    ) or {}
    weighted = float(bal.get("weighted_chairs") or 0.0)
    locked = int(bal.get("locked_chairs") or 0)
    avg_mult = round(weighted / locked, 2) if locked else None
    return {
        "username": (
            user.get("username")
            or user.get("name")
            or (user.get("email") or "").split("@")[0]
            or "Founder"
        ),
        "chair_phase": bal.get("phase"),
        "chair_multiplier": avg_mult,
    }


@router.get("/admin/live-seats")
async def admin_live_seats(
    limit: int = 24,
    _: bool = Depends(verify_admin_cookie),
) -> Dict[str, Any]:
    """List the latest occupied seats across all active card-game tables."""
    db = get_database()
    limit = max(1, min(int(limit), 96))
    seats: List[Dict[str, Any]] = []

    for src in _GAME_SOURCES:
        # Pull the most-recent active games from the source collection.
        active = (
            await db[src["coll"]].find(
                {"status": "active"},
                {
                    "_id": 0,
                    src["table_id_field"]: 1,
                    src["mapping_field"]: 1,
                    "ruleset": 1,
                    "wager": 1,
                    "pot": 1,
                    "scores": 1,
                    "created_at": 1,
                    "phase": 1,
                },
            ).sort("created_at", -1).limit(limit).to_list(limit)
        )

        for game in active:
            mapping = game.get(src["mapping_field"]) or {}
            table_id = game.get(src["table_id_field"])
            if not table_id:
                continue
            spectate_url = src["spectate_template"].format(table_id=table_id)
            for seat_num, (pos, uid) in enumerate(mapping.items(), start=1):
                if not uid:
                    continue
                hydrated = await _hydrate_user(db, uid)
                # session_earnings — derive from team scores when available;
                # otherwise the wager pot. Best-effort, fine for a dashboard.
                team1 = (game.get("scores") or {}).get("team1", {}).get("points", 0)
                team2 = (game.get("scores") or {}).get("team2", {}).get("points", 0)
                session = team1 if pos in {"north", "south"} else team2
                seats.append({
                    "seat_id": f"{table_id}-{pos}",
                    "table_id": table_id,
                    "seat_number": seat_num,
                    "position": pos,
                    "is_live": (game.get("phase") or "active") not in {"finished", "abandoned"},
                    "game_type": src["game_type"],
                    "ruleset": game.get("ruleset", "CLASSIC"),
                    "spectate_url": spectate_url,
                    "wager": int(game.get("wager") or 0),
                    "pot": int(game.get("pot") or 0),
                    "session_earnings": int(session),
                    **hydrated,
                })
            if len(seats) >= limit:
                break
        if len(seats) >= limit:
            break

    return {
        "count": len(seats),
        "seats": seats[:limit],
    }

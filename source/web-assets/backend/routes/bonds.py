"""
Couple Bonds — shared milestone + cosmetic unlock system.

Tracks a "bond" document per unique pair of users, incrementing shared stats
(`date_count`, `games_played`, `shared_jackpots`, `spades_win_streak`,
`current_vibe_level`) and auto-unlocking shared cosmetics when milestone
thresholds are hit (e.g., `twin_flame_vfx` on the 3rd shared date).

Endpoints:
    POST /api/bonds/milestone        — increment a counter; returns unlocks
    GET  /api/bonds/{user_a}/{user_b} — fetch the shared bond state
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from config import db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/bonds", tags=["bonds"])


# ────────────────────────────────────────────────────────────────────────────
#  Unlock rules — threshold → cosmetic ID
# ────────────────────────────────────────────────────────────────────────────
BOND_UNLOCK_RULES = {
    "date_count": [(3, "twin_flame_vfx"), (10, "nebula_floor_skin"), (25, "eternal_vibe_aura")],
    "games_played": [(25, "synergy_glow"), (100, "dynamic_duo_frame")],
    "shared_jackpots": [(1, "lucky_seven_trail"), (5, "golden_dust_portal")],
    "spades_win_streak": [(5, "spades_dynasty_crown"), (10, "grandmaster_partnership")],
}


# ────────────────────────────────────────────────────────────────────────────
#  Models
# ────────────────────────────────────────────────────────────────────────────
class MilestoneRequest(BaseModel):
    user_a: str
    user_b: str
    stat: str = Field(description="One of: date_count, games_played, shared_jackpots, spades_win_streak, current_vibe_level")
    increment: int = 1


class BondState(BaseModel):
    bond_id: str
    user_a: str
    user_b: str
    shared_stats: dict
    unlocked_shared_cosmetics: list
    created_at: str
    updated_at: str


# ────────────────────────────────────────────────────────────────────────────
#  Helpers
# ────────────────────────────────────────────────────────────────────────────
def _bond_id(user_a: str, user_b: str) -> str:
    return "-".join(sorted([user_a, user_b]))


def _check_unlocks(stat: str, new_value: int, already_unlocked: list) -> list:
    """Return any cosmetic IDs unlocked by reaching `new_value` on `stat`."""
    rules = BOND_UNLOCK_RULES.get(stat, [])
    fresh = []
    for threshold, cosmetic_id in rules:
        if new_value >= threshold and cosmetic_id not in already_unlocked:
            fresh.append(cosmetic_id)
    return fresh


# ────────────────────────────────────────────────────────────────────────────
#  Endpoints
# ────────────────────────────────────────────────────────────────────────────
@router.post("/milestone")
async def track_milestone(req: MilestoneRequest) -> dict:
    """Increment a shared stat and auto-unlock any cosmetic milestones."""
    if req.stat not in BOND_UNLOCK_RULES and req.stat != "current_vibe_level":
        raise HTTPException(status_code=400, detail=f"Unknown stat: {req.stat}")

    bond_key = _bond_id(req.user_a, req.user_b)
    now = datetime.now(timezone.utc).isoformat()

    bond = await db.bonds.find_one_and_update(
        {"bond_id": bond_key},
        {
            "$inc": {f"shared_stats.{req.stat}": req.increment},
            "$setOnInsert": {
                "user_a": sorted([req.user_a, req.user_b])[0],
                "user_b": sorted([req.user_a, req.user_b])[1],
                "created_at": now,
                "unlocked_shared_cosmetics": [],
            },
            "$set": {"updated_at": now},
        },
        upsert=True,
        return_document=True,
        projection={"_id": 0},
    )

    new_value = int(bond.get("shared_stats", {}).get(req.stat, 0))
    already = list(bond.get("unlocked_shared_cosmetics", []))
    fresh_unlocks = _check_unlocks(req.stat, new_value, already)

    if fresh_unlocks:
        await db.bonds.update_one(
            {"bond_id": bond_key},
            {"$addToSet": {"unlocked_shared_cosmetics": {"$each": fresh_unlocks}}},
        )
        already.extend(fresh_unlocks)

    return {
        "bond_id": bond_key,
        "stat": req.stat,
        "new_value": new_value,
        "unlocked_now": fresh_unlocks,
        "all_unlocked": already,
    }


@router.get("/list/{user_id}")
async def list_user_bonds(user_id: str) -> dict:
    """Return every bond this user is part of (either side) + unlock progress."""
    cursor = db.bonds.find(
        {"$or": [{"user_a": user_id}, {"user_b": user_id}]},
        {"_id": 0},
    )
    bonds = await cursor.to_list(length=200)

    # Decorate each bond with per-stat progress toward the next milestone
    for bond in bonds:
        stats = bond.get("shared_stats", {}) or {}
        unlocked = set(bond.get("unlocked_shared_cosmetics", []) or [])
        progress = {}
        for stat_name, rules in BOND_UNLOCK_RULES.items():
            current = int(stats.get(stat_name, 0))
            next_rule = next(
                ((thr, cid) for thr, cid in rules if cid not in unlocked),
                None,
            )
            if next_rule:
                thr, cid = next_rule
                progress[stat_name] = {
                    "current": current,
                    "next_threshold": thr,
                    "next_cosmetic_id": cid,
                    "percent": min(100, int(current / thr * 100)) if thr else 100,
                }
            else:
                progress[stat_name] = {
                    "current": current,
                    "next_threshold": None,
                    "next_cosmetic_id": None,
                    "percent": 100,
                }
        bond["milestone_progress"] = progress
        bond["partner_id"] = bond["user_b"] if bond["user_a"] == user_id else bond["user_a"]

    return {"user_id": user_id, "bond_count": len(bonds), "bonds": bonds}


@router.get("/unlock-rules")
async def get_unlock_rules() -> dict:
    """Expose the milestone rule table so the UI can render thresholds."""
    return {
        "rules": {
            stat: [{"threshold": thr, "cosmetic_id": cid} for thr, cid in rules]
            for stat, rules in BOND_UNLOCK_RULES.items()
        }
    }


@router.get("/{user_a}/{user_b}")
async def get_bond(user_a: str, user_b: str) -> dict:
    bond_key = _bond_id(user_a, user_b)
    bond = await db.bonds.find_one({"bond_id": bond_key}, {"_id": 0})
    if not bond:
        return {
            "bond_id": bond_key,
            "user_a": sorted([user_a, user_b])[0],
            "user_b": sorted([user_a, user_b])[1],
            "shared_stats": {},
            "unlocked_shared_cosmetics": [],
            "exists": False,
        }
    bond["exists"] = True
    return bond

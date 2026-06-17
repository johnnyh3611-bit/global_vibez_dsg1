"""
Unified Plex Room — Master Living-Room Engine (V3 + counter-proposal)
─────────────────────────────────────────────────────────────────────
Single container that collapses Gaming, Dating, and Showcase into one
room with mode toggles, the Affinity Engine, and ripple-trigger
visual gifts. Implements the V3 blueprint *minus* the broken 50/30/20
economics (the platform-wide 80/15/5 from media_engine.py is used
for every transaction inside the Plex Room — no separate ledger).

ECONOMIC CONTRACT (NON-NEGOTIABLE — same as Media Engine):
  • Fan→Artist transactions inside Plex go through services.media_engine
  • Battle Wager routing: 40% Tournament Pool / 30% Treasury / 30% Airlock
    (mirrors the Recirculation 40/30/30 rule — NOT 100% Treasury)
  • Wager caps: 100K / 1M / 5M ₵ (matches Prize Wheel + Media Engine)
  • Zero burn on in-app coins (burns only on DSG SPL Gas-Out)
  • All API payloads denominated in coins (₵)

COLLECTIONS:
  • unified_rooms       — { room_id, host_id, active_mode,
                            affinity_score, visual_override, status }
  • room_participants   — { node_id, room_id, user_id, seat_index,
                            is_video_active, joined_at }
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

log = logging.getLogger(__name__)

VALID_MODES = {"GAMING", "DATING", "SHOWCASE"}

# Battle wager routing — mirrors the platform Recirculation 40/30/30
WAGER_TOURNAMENT_PCT = 0.40
WAGER_TREASURY_PCT = 0.30
WAGER_AIRLOCK_PCT = 0.30

WAGER_CAPS_COINS: Dict[str, int] = {
    "free": 100_000,
    "mid": 1_000_000,
    "top": 5_000_000,
}

# Affinity thresholds → ambient visual state (the V3 Affinity Engine)
AFFINITY_STATES = (
    # (min_score, state_key, label)
    (0, "icebreaker", "Icebreaker — cool cyber-blue"),
    (40, "neon_spark", "Neon Spark — energetic violet"),
    (75, "synergy_flare", "Synergy Flare — gold & pink"),
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _resolve_affinity_state(score: int) -> Dict[str, Any]:
    """Pick the highest threshold the score crosses."""
    chosen = AFFINITY_STATES[0]
    for row in AFFINITY_STATES:
        if score >= row[0]:
            chosen = row
    return {"score": int(score), "key": chosen[1], "label": chosen[2]}


def _compute_affinity(participants: List[Dict[str, Any]]) -> int:
    """Minimum-viable affinity = overlap of declared interests
    among room participants, normalized to 0..100. For sparse
    rooms (< 2 participants) we return 0 → Icebreaker state."""
    if len(participants) < 2:
        return 0
    interest_sets = [set(p.get("interests") or []) for p in participants
                     if p.get("interests")]
    if len(interest_sets) < 2:
        return 0
    universe = set().union(*interest_sets)
    if not universe:
        return 0
    # Average pairwise Jaccard × 100
    pairs = 0
    total = 0.0
    for i in range(len(interest_sets)):
        for j in range(i + 1, len(interest_sets)):
            a, b = interest_sets[i], interest_sets[j]
            uni = a | b
            if not uni:
                continue
            total += len(a & b) / len(uni)
            pairs += 1
    if pairs == 0:
        return 0
    return int(round((total / pairs) * 100))


# ─────────────────────── Room lifecycle ─────────────────────────

async def create_room(db, *, host_id: str, host_name: str,
                      initial_mode: str = "GAMING") -> Dict[str, Any]:
    mode = initial_mode if initial_mode in VALID_MODES else "GAMING"
    room_id = f"plex_{uuid.uuid4().hex[:14]}"
    doc = {
        "room_id": room_id,
        "host_id": host_id,
        "host_name": host_name,
        "active_mode": mode,
        "affinity_score": 0,
        "affinity_key": "icebreaker",
        "visual_override_id": None,
        "status": "live",
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    await db.unified_rooms.insert_one(doc)

    # Auto-seat the host at index 0
    await db.room_participants.insert_one({
        "node_id": f"node_{uuid.uuid4().hex[:14]}",
        "room_id": room_id,
        "user_id": host_id,
        "user_name": host_name,
        "seat_index": 0,
        "is_video_active": True,
        "interests": [],
        "joined_at": _now_iso(),
    })

    doc.pop("_id", None)
    return doc


async def get_room_state(db, room_id: str) -> Dict[str, Any]:
    room = await db.unified_rooms.find_one(
        {"room_id": room_id}, {"_id": 0}
    )
    if not room:
        return {"ok": False, "reason": "room_not_found"}
    cursor = db.room_participants.find(
        {"room_id": room_id}, {"_id": 0}
    ).sort([("seat_index", 1)])
    participants = [p async for p in cursor]
    affinity = _resolve_affinity_state(room.get("affinity_score", 0))
    return {
        "ok": True,
        "room": room,
        "participants": participants,
        "affinity": affinity,
        "wager_caps_coins": WAGER_CAPS_COINS,
    }


async def set_mode(db, *, room_id: str, mode: str,
                   actor_id: str) -> Dict[str, Any]:
    if mode not in VALID_MODES:
        return {"ok": False, "reason": "invalid_mode"}
    room = await db.unified_rooms.find_one(
        {"room_id": room_id}, {"_id": 0, "host_id": 1}
    )
    if not room:
        return {"ok": False, "reason": "room_not_found"}
    # Only the host can flip the mode toggle. The Affinity Engine
    # adjusts ambient visuals automatically regardless.
    if room["host_id"] != actor_id:
        return {"ok": False, "reason": "host_only"}
    await db.unified_rooms.update_one(
        {"room_id": room_id},
        {"$set": {"active_mode": mode, "updated_at": _now_iso()}},
    )
    return {"ok": True, "active_mode": mode}


async def set_visual_override(db, *, room_id: str,
                              override_id: Optional[str],
                              actor_id: str) -> Dict[str, Any]:
    """Hybrid Control Protocol — host overrides the algorithmic
    baseline with a manual visual theme. Pass override_id=None to
    clear and return to algorithmic visuals."""
    room = await db.unified_rooms.find_one(
        {"room_id": room_id}, {"_id": 0, "host_id": 1}
    )
    if not room:
        return {"ok": False, "reason": "room_not_found"}
    if room["host_id"] != actor_id:
        return {"ok": False, "reason": "host_only"}
    await db.unified_rooms.update_one(
        {"room_id": room_id},
        {"$set": {"visual_override_id": override_id,
                  "updated_at": _now_iso()}},
    )
    return {"ok": True, "visual_override_id": override_id}


async def join_room(db, *, room_id: str, user_id: str, user_name: str,
                    interests: Optional[List[str]] = None
                    ) -> Dict[str, Any]:
    room = await db.unified_rooms.find_one(
        {"room_id": room_id, "status": "live"}, {"_id": 0}
    )
    if not room:
        return {"ok": False, "reason": "room_not_found"}

    # Already seated?
    existing = await db.room_participants.find_one(
        {"room_id": room_id, "user_id": user_id}, {"_id": 0}
    )
    if existing:
        return {"ok": True, "already_seated": True,
                "node_id": existing["node_id"],
                "seat_index": existing["seat_index"]}

    # Find next free seat (0-3)
    occupied = {
        p["seat_index"] async for p in
        db.room_participants.find(
            {"room_id": room_id}, {"_id": 0, "seat_index": 1}
        )
    }
    next_seat = None
    for i in range(4):
        if i not in occupied:
            next_seat = i
            break
    if next_seat is None:
        return {"ok": False, "reason": "room_full"}

    node_id = f"node_{uuid.uuid4().hex[:14]}"
    await db.room_participants.insert_one({
        "node_id": node_id,
        "room_id": room_id,
        "user_id": user_id,
        "user_name": user_name,
        "seat_index": next_seat,
        "is_video_active": True,
        "interests": interests or [],
        "joined_at": _now_iso(),
    })

    # Recompute affinity
    participants = [
        p async for p in db.room_participants.find(
            {"room_id": room_id}, {"_id": 0, "interests": 1}
        )
    ]
    score = _compute_affinity(participants)
    await db.unified_rooms.update_one(
        {"room_id": room_id},
        {"$set": {"affinity_score": score,
                  "affinity_key": _resolve_affinity_state(score)["key"],
                  "updated_at": _now_iso()}},
    )

    return {"ok": True, "node_id": node_id, "seat_index": next_seat,
            "affinity_score": score}


async def leave_room(db, *, room_id: str, user_id: str
                     ) -> Dict[str, Any]:
    res = await db.room_participants.delete_one(
        {"room_id": room_id, "user_id": user_id}
    )
    if res.deleted_count == 0:
        return {"ok": False, "reason": "not_in_room"}

    # Recompute affinity post-leave
    participants = [
        p async for p in db.room_participants.find(
            {"room_id": room_id}, {"_id": 0, "interests": 1}
        )
    ]
    score = _compute_affinity(participants)
    await db.unified_rooms.update_one(
        {"room_id": room_id},
        {"$set": {"affinity_score": score,
                  "affinity_key": _resolve_affinity_state(score)["key"],
                  "updated_at": _now_iso()}},
    )
    return {"ok": True, "affinity_score": score}


async def list_live_rooms(db, limit: int = 30) -> List[Dict[str, Any]]:
    cursor = db.unified_rooms.find(
        {"status": "live"}, {"_id": 0}
    ).sort([("affinity_score", -1), ("created_at", -1)]).limit(limit)
    return [r async for r in cursor]

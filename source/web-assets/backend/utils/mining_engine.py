"""
$DSG Mining — premium-gated token earning from gameplay.

Economy model (user choice: Option C — Aggressive, reward premium members):
  - 1.5 $DSG per trick/win
  - 5.0 $DSG per game/hand completed with a win
  - 0.1 $DSG per minute at a live-stakes table
  - Loyalty multiplier: 1.0 + (years_active * 0.10), capped at 2.0
  - Free tier: 0 $DSG (mining disabled entirely)
  - Plus tier:     half rate (0.5x)
  - Premium tier:  full rate (1.0x)
  - Elite tier:    1.5x

$DSG is a SEPARATE token from the base Vibez Coins (₵). Stored in
`vibez_mining_ledger` (per-event) and `vibez_mining_balance` (denormalized summary).

This module is safe to call from both HTTP routes AND the /ws/mining WebSocket.
"""
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, Tuple

from utils.database import get_database
from utils.safety_gate import check_and_flag, log_action


# ==================== CONSTANTS ====================

BASE_REWARDS = {
    "trick_won": 1.5,
    "game_won":  5.0,
    "minute_at_table": 0.1,
    # Per-hand-win rewards keyed by game type. Falls back to `game_won` if absent.
    "spades_hand_won":    5.0,   # Higher stakes
    "bid_whist_hand_won": 5.0,
    "poker_hand_won":     3.0,
    "rummy_hand_won":     2.5,
    "blackjack_round":    2.0,
    "roulette_spin_won":  2.0,
    "interaction_tick":   0.0,   # computed via skill_multiplier; base multiplied separately
}

# Per-game-type multiplier bump so Spades/BidWhist pay the premium implied
# in the Mining Heartbeat spec.
GAME_TYPE_MULTIPLIER = {
    "spades":       1.0,
    "bid_whist":    1.0,
    "hearts":       0.9,
    "uno":          0.85,
    "poker":        0.9,
    "rummy":        0.85,
    "gin_rummy":    0.85,
    "crazy_eights": 0.75,
    "go_fish":      0.7,
    "war":          0.6,   # lowest — mostly luck
    "blackjack":    0.8,
    "roulette":     0.8,
    "dice":         0.75,
}

TIER_MULTIPLIER = {
    "free":    0.0,
    "plus":    0.5,
    "premium": 1.0,
    "elite":   1.5,
}

MAX_LOYALTY = 2.0  # cap

# 72-hour "Vibe Check" safety hold before mined $DSG becomes available.
VIBE_CHECK_HOLD_HOURS = 72


# ==================== HELPERS ====================

async def _get_user(user_id: str) -> Optional[Dict[str, Any]]:
    db = get_database()
    return await db.users.find_one({"user_id": user_id}, {"_id": 0})


def _years_active(user: Dict[str, Any]) -> float:
    """Count years since join_date (created_at)."""
    created = user.get("created_at") or user.get("join_date")
    if not created:
        return 0.0
    if isinstance(created, str):
        try:
            created = datetime.fromisoformat(created.replace("Z", "+00:00"))
        except ValueError:
            return 0.0
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    delta = datetime.now(timezone.utc) - created
    return delta.total_seconds() / (365.25 * 24 * 3600)


def compute_loyalty_multiplier(user: Dict[str, Any]) -> float:
    years = _years_active(user)
    return min(MAX_LOYALTY, 1.0 + years * 0.10)


def compute_tier_multiplier(user: Dict[str, Any]) -> float:
    tier = (user.get("subscription_tier") or "free").lower()
    return TIER_MULTIPLIER.get(tier, 0.0)


def is_mining_eligible(user: Dict[str, Any]) -> Tuple[bool, str]:
    """Returns (eligible, reason_if_not)."""
    tier = (user.get("subscription_tier") or "free").lower()
    if tier == "free":
        return False, "Mining inactive. Upgrade to Plus or Premium to earn $DSG."
    if user.get("is_shadow_banned"):
        # Shadow-banned users silently fail — return eligible=True so they SEE
        # animations, but the ledger write is a no-op (see record_event).
        return True, ""
    return True, ""


# ==================== PUBLIC API ====================

async def record_event(
    user_id: str,
    event: str,
    multiplier_context: Optional[Dict[str, Any]] = None,
    game_type: Optional[str] = None,
    interaction_count: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Record a mining event for a user. Returns the mined amount + new balance.

    `event` must be a BASE_REWARDS key.
    `game_type` optionally applies GAME_TYPE_MULTIPLIER (e.g., "spades" pays premium).
    `interaction_count` only meaningful for event="interaction_tick" — applies
        a log(1 + interactions) skill multiplier (rewards engagement quality).
    `multiplier_context` accepts {"room_multiplier": 1.1, ...}.
    """
    import math

    if event not in BASE_REWARDS:
        return {"mined": 0.0, "reason": f"Unknown event: {event}"}

    user = await _get_user(user_id)
    if not user:
        return {"mined": 0.0, "reason": "User not found"}

    eligible, reason = is_mining_eligible(user)
    if not eligible:
        return {"mined": 0.0, "reason": reason, "locked": True}

    # Log for safety-gate timing check; if flagged, silently skip the ledger write.
    log_action(user_id)
    flagged = await check_and_flag(user_id)
    if flagged or user.get("is_shadow_banned"):
        return {
            "mined": round(BASE_REWARDS[event], 2),
            "total": 0.0,
            "shadow": True,
        }

    tier_mult = compute_tier_multiplier(user)
    if tier_mult == 0.0:
        return {"mined": 0.0, "reason": "Free tier cannot mine", "locked": True}

    loyalty_mult = compute_loyalty_multiplier(user)

    # Context multipliers (from streaming gifts, events, etc.)
    ctx_mult = 1.0
    if multiplier_context:
        for v in multiplier_context.values():
            try:
                ctx_mult *= float(v)
            except (TypeError, ValueError):
                pass

    # Founder/admin global boost applies to everyone.
    global_boost = await _get_global_boost()
    ctx_mult *= global_boost

    # Per-user founder "mining_multiplier" override (e.g., community rewards, bug bounties).
    personal_mult = float(user.get("mining_multiplier") or 1.0)

    # Architect Pack ($20) Ambassador mining-override (Pricing Master Vault v1.0).
    # Set to 0.05 by routes/wallet.py upon successful Architect purchase.
    architect_boost = 1.0 + float(user.get("mining_override_pct") or 0.0)
    personal_mult *= architect_boost

    # Game-type premium/penalty
    game_mult = GAME_TYPE_MULTIPLIER.get((game_type or "").lower(), 1.0)

    # Interaction skill multiplier (only for interaction_tick events)
    skill_mult = 1.0
    if event == "interaction_tick" and interaction_count is not None:
        # Base rate of 0.5/min log-scaled.
        base_override = 0.5 * math.log(max(1, int(interaction_count)) + 1)
        # Bypass the zero base by injecting base into formula below.
        mined = round(base_override * tier_mult * loyalty_mult * ctx_mult * personal_mult, 4)
    else:
        mined = round(
            BASE_REWARDS[event] * tier_mult * loyalty_mult * ctx_mult * personal_mult * game_mult * skill_mult,
            4,
        )

    if mined <= 0:
        return {"mined": 0.0, "reason": "Zero reward"}

    db = get_database()
    now_dt = datetime.now(timezone.utc)
    hold_until = now_dt + timedelta(hours=VIBE_CHECK_HOLD_HOURS)
    entry = {
        "user_id": user_id,
        "event": event,
        "game_type": (game_type or "").lower() or None,
        "base": BASE_REWARDS[event],
        "tier_multiplier": tier_mult,
        "loyalty_multiplier": loyalty_mult,
        "game_multiplier": game_mult,
        "personal_multiplier": personal_mult,
        "global_boost": global_boost,
        "context_multiplier": ctx_mult / global_boost if global_boost else 1.0,
        "mined": mined,
        "status": "PENDING_VIBE_CHECK",
        "hold_until": hold_until.isoformat(),
        "created_at": now_dt.isoformat(),
    }
    await db.vibez_mining_ledger.insert_one(entry)
    # Pending balance accumulates; available-balance settlement happens via sweeper.
    await db.vibez_mining_balance.update_one(
        {"user_id": user_id},
        {
            "$inc": {"pending_balance": mined, "lifetime_mined": mined},
            "$set": {"updated_at": now_dt.isoformat()},
            "$setOnInsert": {
                "user_id": user_id,
                "balance": 0.0,
                "created_at": now_dt.isoformat(),
            },
        },
        upsert=True,
    )
    bal = await db.vibez_mining_balance.find_one({"user_id": user_id}, {"_id": 0})
    return {
        "mined": mined,
        "pending": (bal or {}).get("pending_balance", 0.0),
        "available": (bal or {}).get("balance", 0.0),
        "lifetime": (bal or {}).get("lifetime_mined", 0.0),
        "status": "PENDING_VIBE_CHECK",
        "available_at": hold_until.isoformat(),
    }


async def _get_global_boost() -> float:
    """Admin-controllable global mining multiplier (default 1.0)."""
    db = get_database()
    doc = await db.mining_settings.find_one({"key": "global_boost"}, {"_id": 0})
    if not doc:
        return 1.0
    try:
        return float(doc.get("value", 1.0))
    except (TypeError, ValueError):
        return 1.0


async def set_global_boost(value: float) -> float:
    """Admin-only: dial the current mining boost (e.g., 1.5 for 50% bump during events)."""
    db = get_database()
    value = max(0.0, min(10.0, float(value)))
    await db.mining_settings.update_one(
        {"key": "global_boost"},
        {"$set": {"key": "global_boost", "value": value, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return value


async def sweep_vibe_check_holds() -> int:
    """
    Moves any ledger entries past their hold_until into the available balance.
    Called periodically (or via admin trigger).
    """
    db = get_database()
    now_iso = datetime.now(timezone.utc).isoformat()
    cursor = db.vibez_mining_ledger.find(
        {"status": "PENDING_VIBE_CHECK", "hold_until": {"$lt": now_iso}},
        {"_id": 0},
    )
    swept = 0
    async for entry in cursor:
        await db.vibez_mining_ledger.update_one(
            {"user_id": entry["user_id"], "created_at": entry["created_at"]},
            {"$set": {"status": "AVAILABLE", "settled_at": now_iso}},
        )
        await db.vibez_mining_balance.update_one(
            {"user_id": entry["user_id"]},
            {"$inc": {"pending_balance": -entry["mined"], "balance": entry["mined"]}},
        )
        swept += 1
    return swept


async def get_balance(user_id: str) -> Dict[str, Any]:
    db = get_database()
    doc = await db.vibez_mining_balance.find_one({"user_id": user_id}, {"_id": 0})
    user = await _get_user(user_id)
    tier_mult = compute_tier_multiplier(user) if user else 0.0
    loyalty_mult = compute_loyalty_multiplier(user) if user else 1.0
    personal_mult = float((user or {}).get("mining_multiplier") or 1.0)
    architect_boost = 1.0 + float((user or {}).get("mining_override_pct") or 0.0)
    personal_mult *= architect_boost
    global_boost = await _get_global_boost()
    return {
        "available": (doc or {}).get("balance", 0.0),
        "pending": (doc or {}).get("pending_balance", 0.0),
        "lifetime_mined": (doc or {}).get("lifetime_mined", 0.0),
        "tier": (user or {}).get("subscription_tier", "free"),
        "tier_multiplier": tier_mult,
        "loyalty_multiplier": round(loyalty_mult, 3),
        "personal_multiplier": personal_mult,
        "architect_boost": architect_boost,
        "global_boost": global_boost,
        "effective_rate_per_trick": round(BASE_REWARDS["trick_won"] * tier_mult * loyalty_mult * global_boost * personal_mult, 4),
        "locked": tier_mult == 0.0,
    }

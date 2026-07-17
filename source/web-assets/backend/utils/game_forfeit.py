"""
Mid-game quit / forfeit settlement for team card games.

Policy (agreed product rule):
  1. Entry already paid into the pot is forfeited — not refunded.
  2. Extra house penalty = 15% of entry fee, debited from the quitter's
     credits_balance (cannot exceed available balance).
  3. Quitter's entry is redistributed to remaining human players:
       - Partner (N↔S / E↔W) receives 50%.
       - Remaining opponents split the other 50% equally.
  4. Free games / lobby / finished tables: no financial penalty.
  5. Idempotent via the `game_forfeits` collection.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

from fastapi import HTTPException

from utils.database import get_database

# ── Tunables (keep in sync with frontend forfeitPolicy) ──────────────────────
HOUSE_PENALTY_PCT = 0.15
PARTNER_SHARE_PCT = 0.50  # of redistributed entry
OPPONENT_SHARE_PCT = 0.50

# Seats that are partners in standard 4-hand partnership games
PARTNER_OF = {
    "N": "S", "S": "N", "E": "W", "W": "E",
    "n": "s", "s": "n", "e": "w", "w": "e",
    "north": "south", "south": "north",
    "east": "west", "west": "east",
}

PARTNERSHIP_GAME_TYPES = frozenset({
    "bid_whist", "spades", "hearts", "euchre", "pinochle",
})

ACTIVE_STATUSES = frozenset({
    "bidding", "playing", "active", "in_progress", "dealing", "paused",
})

# Collections keyed by game_type for REST quit handlers
GAME_COLLECTIONS = {
    "bid_whist": "bid_whist_games",
    "spades": "spades_games",
    "hearts": "hearts_games",
}


def forfeit_policy_public() -> Dict[str, Any]:
    """Safe summary for API/UI copy."""
    return {
        "house_penalty_pct": HOUSE_PENALTY_PCT,
        "partner_share_pct": PARTNER_SHARE_PCT,
        "opponent_share_pct": OPPONENT_SHARE_PCT,
        "description": (
            "Quit mid-game: entry fee is forfeited, plus a 15% house penalty. "
            "Half of your entry goes to your partner; the rest is split among "
            "remaining opponents."
        ),
    }


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def is_mid_game(status: Optional[str]) -> bool:
    if status is None:
        return False
    # Enum-like objects (RoomState) expose .value
    raw = getattr(status, "value", status)
    return str(raw).lower() in ACTIVE_STATUSES


def _is_human(user_id: Optional[str]) -> bool:
    if not user_id or not isinstance(user_id, str):
        return False
    return not user_id.startswith("AI_")


def _seat_of(players: List[Dict], user_id: str) -> Optional[str]:
    for p in players or []:
        if p.get("user_id") == user_id:
            return p.get("seat") or p.get("position")
    return None


def players_from_mapping(player_mapping: Dict[str, str]) -> List[Dict[str, str]]:
    """Convert {seat: user_id} mapping used by Bid Whist / Spades docs."""
    out: List[Dict[str, str]] = []
    for seat, uid in (player_mapping or {}).items():
        if uid:
            out.append({"user_id": uid, "seat": seat})
    return out


def plan_redistribution(
    players: List[Dict],
    quitter_id: str,
    entry_fee: float,
    *,
    partnership: bool = True,
) -> List[Tuple[str, float, str]]:
    """
    Return [(user_id, amount, role), ...] where role is 'partner' | 'opponent'.
    Amounts use whole-credit floors so the sum never exceeds entry_fee.
    AI seats never receive credits.
    """
    if entry_fee <= 0:
        return []

    humans = [
        p for p in (players or [])
        if _is_human(p.get("user_id")) and p.get("user_id") != quitter_id
    ]
    if not humans:
        return []

    entry_int = int(entry_fee)

    # Non-partnership (or missing seat info): equal split
    quitter_seat = _seat_of(players, quitter_id)
    partner_seat = PARTNER_OF.get(quitter_seat) if quitter_seat else None
    partner = next(
        (p for p in humans if partner_seat and (p.get("seat") or p.get("position")) == partner_seat),
        None,
    ) if partnership else None

    if not partnership or not partner_seat or not partner:
        n = len(humans)
        base = entry_int // n
        rem = entry_int - base * n
        out: List[Tuple[str, float, str]] = []
        for i, p in enumerate(humans):
            amt = base + (1 if i < rem else 0)
            if amt > 0:
                out.append((p["user_id"], float(amt), "opponent"))
        return out

    partner_amt = int(entry_fee * PARTNER_SHARE_PCT)
    opponent_pool = entry_int - partner_amt
    opponents = [p for p in humans if p is not partner]

    out: List[Tuple[str, float, str]] = []
    if partner_amt > 0:
        out.append((partner["user_id"], float(partner_amt), "partner"))

    if opponents and opponent_pool > 0:
        n = len(opponents)
        base = opponent_pool // n
        rem = opponent_pool - base * n
        for i, p in enumerate(opponents):
            amt = base + (1 if i < rem else 0)
            if amt > 0:
                out.append((p["user_id"], float(amt), "opponent"))
    elif opponent_pool > 0:
        # No human opponents — give leftover to partner
        if out:
            uid, amt, role = out[0]
            out[0] = (uid, amt + float(opponent_pool), role)
        else:
            out.append((partner["user_id"], float(opponent_pool), "partner"))

    return out


async def apply_quitter_penalty(
    db,
    *,
    game_type: str,
    game_id: str,
    quitter_id: str,
    entry_fee: float,
    players: List[Dict],
    status: Optional[str],
) -> Dict[str, Any]:
    """
    Apply forfeit + 15% house penalty + redistribute entry.
    Safe to call multiple times — second call is a no-op.
    """
    entry = float(entry_fee or 0)
    policy = forfeit_policy_public()

    if entry <= 0 or not is_mid_game(status):
        return {
            "success": True,
            "applied": False,
            "penalty_applied": False,
            "reason": "no_penalty",
            "entry_fee": entry,
            "house_penalty": 0.0,
            "penalty": 0.0,
            "house_penalty_pct": HOUSE_PENALTY_PCT,
            "total_deducted": 0.0,
            "redistributed": [],
            "message": "No penalty — free game or not in progress",
            "policy": policy,
        }

    existing = await db.game_forfeits.find_one(
        {"game_type": game_type, "game_id": game_id, "user_id": quitter_id}
    )
    if existing:
        hp = float(existing.get("house_penalty") or existing.get("penalty_amount") or 0)
        return {
            "success": True,
            "applied": False,
            "penalty_applied": True,
            "reason": "already_forfeited",
            "entry_fee": entry,
            "house_penalty": hp,
            "penalty": hp,
            "house_penalty_pct": HOUSE_PENALTY_PCT,
            "total_deducted": entry + hp,
            "redistributed": existing.get("redistributed") or [],
            "message": "Forfeit already recorded",
            "policy": policy,
        }

    # ── House penalty (15% of entry, capped at available balance) ────────────
    user = await db.users.find_one(
        {"user_id": quitter_id}, {"_id": 0, "credits_balance": 1}
    )
    balance = float((user or {}).get("credits_balance") or 0)
    raw_penalty = round(entry * HOUSE_PENALTY_PCT, 2)
    house_penalty = min(raw_penalty, balance)

    if house_penalty > 0:
        result = await db.users.update_one(
            {"user_id": quitter_id, "credits_balance": {"$gte": house_penalty}},
            {"$inc": {"credits_balance": -house_penalty}},
        )
        if result.modified_count == 0:
            fresh = await db.users.find_one(
                {"user_id": quitter_id}, {"_id": 0, "credits_balance": 1}
            )
            house_penalty = float((fresh or {}).get("credits_balance") or 0)
            if house_penalty > 0:
                await db.users.update_one(
                    {"user_id": quitter_id},
                    {"$set": {"credits_balance": 0}},
                )

    # ── Redistribute entry to remaining human players ────────────────────────
    partnership = game_type in PARTNERSHIP_GAME_TYPES
    plan = plan_redistribution(
        players, quitter_id, entry, partnership=partnership
    )
    redistributed: List[Dict[str, Any]] = []
    for uid, amount, role in plan:
        if amount <= 0:
            continue
        await db.users.update_one(
            {"user_id": uid},
            {"$inc": {"credits_balance": amount}},
        )
        redistributed.append({"user_id": uid, "amount": amount, "role": role})

    record = {
        "id": str(uuid4()),
        "game_type": game_type,
        "game_id": game_id,
        "user_id": quitter_id,
        "entry_fee": entry,
        "penalty_amount": house_penalty,
        "house_penalty": house_penalty,
        "house_penalty_pct": HOUSE_PENALTY_PCT,
        "total_forfeited": entry + house_penalty,
        "redistributed": redistributed,
        "reason": "quit_mid_game",
        "timestamp": _utc_now().isoformat(),
        "created_at": _utc_now().isoformat(),
    }
    await db.game_forfeits.insert_one(record)

    if house_penalty > 0:
        try:
            await db.platform_revenue.insert_one({
                "source": "forfeit_penalty",
                "game_type": game_type,
                "game_id": game_id,
                "user_id": quitter_id,
                "amount": house_penalty,
                "timestamp": _utc_now().isoformat(),
            })
        except Exception:
            pass

    try:
        await db.transactions.insert_one({
            "id": str(uuid4()),
            "user_id": quitter_id,
            "type": "game_forfeit",
            "amount": -(entry + house_penalty),
            "entry_fee_forfeited": entry,
            "house_penalty": house_penalty,
            "game_type": game_type,
            "game_id": game_id,
            "description": (
                f"Quit mid-{game_type}: forfeited {int(entry)} entry + "
                f"{house_penalty:g} house penalty (15%)"
            ),
            "created_at": _utc_now().isoformat(),
        })
    except Exception:
        pass

    msg = (
        f"Forfeited {int(entry)} entry + {house_penalty:g} penalty (15%) "
        f"= {entry + house_penalty:g} total"
    )
    return {
        "success": True,
        "applied": True,
        "penalty_applied": True,
        "reason": "mid_game_quit",
        "entry_fee": entry,
        "entry_fee_forfeited": entry,
        "house_penalty": house_penalty,
        "penalty": house_penalty,
        "house_penalty_pct": HOUSE_PENALTY_PCT,
        "total_deducted": entry + house_penalty,
        "redistributed": redistributed,
        "message": msg,
        "policy": policy,
    }


async def handle_player_quit(
    user_id: str,
    game_id: str,
    game_type: str,
) -> dict:
    """
    Compatibility wrapper used by Bid Whist / Spades REST quit handlers.
    Looks up the game, applies forfeit if mid-match with a paid entry.
    """
    db = get_database()
    collection = GAME_COLLECTIONS.get(game_type, f"{game_type}_games")
    game = await db[collection].find_one({"game_id": game_id}, {"_id": 0})

    if not game:
        return {"success": False, "error": "Game not found", "penalty_applied": False}

    entry_fee = (
        game.get("wager")
        or game.get("entry_fee")
        or game.get("buy_in")
        or 0
    )
    players = players_from_mapping(game.get("player_mapping") or {})
    if not players and game.get("players"):
        players = game["players"]

    result = await apply_quitter_penalty(
        db,
        game_type=game_type,
        game_id=game_id,
        quitter_id=user_id,
        entry_fee=float(entry_fee),
        players=players,
        status=game.get("status") or game.get("phase"),
    )

    if result.get("penalty_applied") and result.get("applied"):
        await db[collection].update_one(
            {"game_id": game_id},
            {
                "$set": {
                    f"forfeits.{user_id}": {
                        "timestamp": _utc_now().isoformat(),
                        "amount": result.get("total_deducted", 0),
                        "house_penalty": result.get("house_penalty", 0),
                        "redistributed": result.get("redistributed") or [],
                    }
                }
            },
        )

    return result


async def get_user_forfeit_history(user_id: str, limit: int = 10) -> list:
    """Get user's forfeit history."""
    db = get_database()
    forfeits = await db.game_forfeits.find(
        {"user_id": user_id},
        {"_id": 0},
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    return forfeits


async def require_player(game: Dict, user_id: str) -> None:
    mapping = game.get("player_mapping") or {}
    if user_id in mapping.values():
        return
    if any(p.get("user_id") == user_id for p in (game.get("players") or [])):
        return
    raise HTTPException(status_code=403, detail="Not a player in this game")

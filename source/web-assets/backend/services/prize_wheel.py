"""
Random Tier Prize Wheel Engine — Stabilization Patch v1.1 (Feb 2026)
─────────────────────────────────────────────────────────────────
Implements the Global Vibez DSG Random Tier Prize Blueprint + the
v1.1 Stabilization Patch. Replaces all static "daily login coin
drops" with a weighted-probability wheel that is mathematically
incapable of bankrupting the treasury.

DESIGN CONTRACT (all four pillars are NON-NEGOTIABLE):
  1. Funding bucket lock: the wheel ONLY draws coins from the
     30% Treasury pool of the Recirculation engine. The 40%
     Tournament pool and the 30% Airlock are insulated.
  2. Cumulative stop-loss: total real-coin mint per rolling 24h
     is hard-capped at 0.5% of the Treasury balance. When the
     ceiling is hit, the wheel auto-falls to $0-cost utility
     prizes only until the rolling window resets.
  3. Sybil gating: SMS-verified phone + complete dating profile
     + ≥1 game hand in the last 24h. Top Tier additionally
     requires a Founder Chair (hardware-locked).
  4. All user-facing values denominated in COINS (₵). USD numbers
     are only used for INTERNAL economic math and never returned
     in API payloads to non-admin clients.

DSG SPL token burns are SEPARATE (see services/ai_governor.py
and routes/sovereign_ops_routes.py). This engine never touches
on-chain assets.
"""
from __future__ import annotations

import logging
import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

log = logging.getLogger(__name__)

# ─────────── Tier configs (Blueprint v1 + v1.1 Patch) ──────────
# Coin amounts only — never dollars in API responses. Conversion is
# done internally via services.coin_wallet.COINS_PER_USD (1000 ₵ = $1)
# strictly to enforce the 0.5%-of-treasury circuit breaker, which is
# a USD-denominated stability rule by design.

# Probability matrices. Each row: (probability, prize_kind, payload)
# prize_kind values:
#   "coins"          → mint ``coins`` ₵ to user wallet, counts against breaker
#   "digital_asset"  → $0-cost utility perk (Dating Boost, Gaming Shield, etc.)
#                       → does NOT count against breaker
#   "merchant_perk"  → merchant-sponsored / ad-funded perk (free delivery,
#                       discount coupon). Cost is borne off-platform.

TIER_CONFIGS: Dict[str, Dict[str, Any]] = {
    "free": {
        "label": "Free Tier",
        "matrix": [
            (0.75, "digital_asset", {"asset_key": "gaming_shield_basic",
                                     "title": "DSG Gaming Shield",
                                     "subtitle": "Cushions your next card-table loss"}),
            (0.20, "coins",         {"min_coins": 10_000, "max_coins": 10_000}),
            (0.05, "coins",         {"min_coins": 50_000, "max_coins": 50_000,
                                     "is_jackpot": True}),
        ],
        "spin_cooldown_seconds": 24 * 60 * 60,
        "requires_chair": False,
    },
    "mid": {
        "label": "Mid Tier",
        "matrix": [
            (0.60, "digital_asset",  {"asset_key": "dating_hyper_boost_1h",
                                      "title": "Dating Hyper-Boost",
                                      "subtitle": "1 hour priority profile exposure"}),
            (0.25, "coins",          {"min_coins": 40_000, "max_coins": 40_000}),
            (0.12, "merchant_perk",  {"perk_key": "merchant_ad_coupon",
                                      "title": "Sponsored Merchant Coupon",
                                      "subtitle": "Discount code at a partner vendor"}),
            (0.03, "coins",          {"min_coins": 300_000, "max_coins": 300_000,
                                      "is_jackpot": True}),
        ],
        "spin_cooldown_seconds": 24 * 60 * 60,
        "requires_chair": False,
    },
    "top": {
        "label": "Top Tier",
        "matrix": [
            # Top common reward: 200K-350K ₵ range (≈ $200-$350 perceived).
            # Top Tier is hardware-locked to Founder Chair holders.
            (0.60, "coins",          {"min_coins": 200_000, "max_coins": 350_000}),
            (0.25, "digital_asset",  {"asset_key": "dating_hyper_boost_multi",
                                      "title": "Multi-Hour Hyper-Boost",
                                      "subtitle": "6 hours priority dating exposure"}),
            (0.12, "merchant_perk",  {"perk_key": "logistics_free_delivery",
                                      "title": "Hungry VIBEZ Free Delivery",
                                      "subtitle": "Driver fee covered by ad subsidy"}),
            (0.03, "coins",          {"min_coins": 1_500_000, "max_coins": 1_500_000,
                                      "is_jackpot": True}),
        ],
        "spin_cooldown_seconds": 24 * 60 * 60,
        "requires_chair": True,
    },
}

# Circuit-breaker constant: 0.5% of the Treasury balance per rolling
# 24h is the hard ceiling for net coin minting via the wheel. When the
# ceiling is hit, the wheel falls back to digital_asset / merchant_perk
# outcomes only until the window rolls.
BREAKER_TREASURY_PCT: float = 0.005

# Sybil gating constants
SYBIL_RECENT_GAME_WINDOW_HOURS: int = 24


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _now_iso() -> str:
    return _now().isoformat()


def _pick_weighted(matrix: List[Tuple[float, str, Dict[str, Any]]]
                   ) -> Tuple[str, Dict[str, Any]]:
    """Standard inverse-CDF sampling. Matrix probabilities must
    sum to 1.0 (we assert this at config load time)."""
    r = random.random()
    cumulative = 0.0
    for prob, kind, payload in matrix:
        cumulative += prob
        if r <= cumulative:
            return kind, dict(payload)
    # Floating-point fallthrough → return last row
    _, kind, payload = matrix[-1]
    return kind, dict(payload)


for _tier_key, _cfg in TIER_CONFIGS.items():
    _total = sum(p for p, _, _ in _cfg["matrix"])
    assert abs(_total - 1.0) < 1e-9, (
        f"Tier '{_tier_key}' probabilities sum to {_total}, must be 1.0"
    )


# ─────────── Sybil gate ──────────

async def _passes_sybil_gate(
    db, user: Dict[str, Any], tier: str
) -> Tuple[bool, str]:
    """Returns (passes, reason_if_blocked)."""
    user_id = user.get("user_id")

    # 1. SMS-verified phone
    if not user.get("phone_verified"):
        return False, "phone_not_verified"

    # 2. Complete dating profile (minimal proxy: name + bio + 1 photo)
    profile_complete = bool(
        user.get("name") and user.get("bio") and (user.get("photos") or [])
    )
    if not profile_complete:
        return False, "profile_incomplete"

    # 3. ≥1 game hand played in last 24h
    cutoff = (_now() - timedelta(hours=SYBIL_RECENT_GAME_WINDOW_HOURS)).isoformat()
    recent_hand = await db.coin_ledger.find_one({
        "user_id": user_id,
        "reason": {"$regex": "^game_|^card_|^bid_whist|^spades|^uno|^chess|^baccarat|^blackjack"},
        "created_at": {"$gte": cutoff},
    }, {"_id": 0, "user_id": 1})
    if not recent_hand:
        return False, "no_game_hand_in_24h"

    # 4. Top Tier requires Founder Chair (hardware-locked)
    if tier == "top":
        chair = await db.chair_holders.find_one(
            {"user_id": user_id, "status": {"$in": ["active", "held"]}},
            {"_id": 0, "chair_id": 1},
        )
        if not chair:
            return False, "founder_chair_required"

    return True, ""


# ─────────── Circuit breaker ──────────

async def _breaker_state(db) -> Dict[str, Any]:
    """Returns the breaker context.

    {
      "treasury_balance": int,    # current Treasury 30% bucket balance (₵)
      "rolling_minted":   int,    # net wheel-mint in trailing 24h (₵)
      "ceiling":          int,    # 0.5% of treasury (₵)
      "tripped":          bool,
      "next_reset_at":    iso,    # earliest moment ceiling could drop
    }
    """
    pool = await db.recirculation_pools.find_one(
        {"_id": "treasury"}, {"_id": 0, "balance": 1}
    )
    treasury = int((pool or {}).get("balance", 0))
    ceiling = int(round(treasury * BREAKER_TREASURY_PCT))

    cutoff = (_now() - timedelta(hours=24)).isoformat()
    agg = await db.prize_wheel_spins.aggregate([
        {"$match": {
            "at": {"$gte": cutoff},
            "kind": "coins",
        }},
        {"$group": {"_id": None, "minted": {"$sum": "$coin_amount"}}},
    ]).to_list(length=1)
    minted = int(agg[0]["minted"]) if agg else 0

    return {
        "treasury_balance": treasury,
        "rolling_minted": minted,
        "ceiling": ceiling,
        "tripped": ceiling > 0 and minted >= ceiling,
        "next_reset_at": (_now() + timedelta(hours=24)).isoformat(),
    }


async def _filter_matrix_for_breaker(
    matrix: List[Tuple[float, str, Dict[str, Any]]]
) -> List[Tuple[float, str, Dict[str, Any]]]:
    """When breaker is tripped, drop all 'coins' rows and re-normalize
    the remaining probabilities. If the tier has no non-coin rows
    (theoretically possible), returns the original matrix and the
    caller is expected to NO-OP the spin."""
    survivors = [(p, k, payload) for (p, k, payload) in matrix if k != "coins"]
    if not survivors:
        return matrix  # caller will handle as 'breaker_blocked'
    total = sum(p for p, _, _ in survivors)
    if total <= 0:
        return matrix
    return [(p / total, k, payload) for (p, k, payload) in survivors]


# ─────────── Cooldown ──────────

async def _last_spin_at(db, user_id: str) -> Optional[datetime]:
    last = await db.prize_wheel_spins.find_one(
        {"user_id": user_id}, {"_id": 0, "at": 1}, sort=[("at", -1)],
    )
    if not last:
        return None
    try:
        return datetime.fromisoformat(last["at"])
    except Exception:  # noqa: BLE001
        return None


async def _can_spin_now(db, user_id: str, tier: str
                        ) -> Tuple[bool, Optional[str]]:
    cooldown = TIER_CONFIGS[tier]["spin_cooldown_seconds"]
    last = await _last_spin_at(db, user_id)
    if not last:
        return True, None
    next_at = last + timedelta(seconds=cooldown)
    if _now() >= next_at:
        return True, None
    return False, next_at.isoformat()


# ─────────── Public API ──────────

async def get_status(db, user: Dict[str, Any], tier: str
                     ) -> Dict[str, Any]:
    """Return spin eligibility + breaker state for the wheel UI.

    Tier resolution is automatic-when-unspecified at the route level;
    this function expects the resolved tier string.
    """
    if tier not in TIER_CONFIGS:
        return {"ok": False, "reason": "unknown_tier"}

    passes, sybil_reason = await _passes_sybil_gate(db, user, tier)
    can_spin, next_at = await _can_spin_now(db, user["user_id"], tier)
    breaker = await _breaker_state(db)

    return {
        "ok": True,
        "tier": tier,
        "tier_label": TIER_CONFIGS[tier]["label"],
        "eligible": passes and can_spin,
        "sybil_passes": passes,
        "sybil_blocked_reason": sybil_reason or None,
        "cooldown_active": not can_spin,
        "next_spin_at": next_at,
        "breaker": {
            "tripped": breaker["tripped"],
            "rolling_minted_coins": breaker["rolling_minted"],
            "ceiling_coins": breaker["ceiling"],
            "next_reset_at": breaker["next_reset_at"],
        },
        # Show outcomes — coin amounts and probabilities. NO USD anywhere.
        "outcomes": [
            {
                "kind": k,
                "probability": p,
                "label": (
                    f"{payload.get('min_coins'):,} – {payload.get('max_coins'):,} ₵"
                    if k == "coins" and payload.get("min_coins") != payload.get("max_coins")
                    else f"{payload.get('min_coins'):,} ₵"
                    if k == "coins"
                    else payload.get("title", "")
                ),
                "is_jackpot": bool(payload.get("is_jackpot")),
            }
            for (p, k, payload) in TIER_CONFIGS[tier]["matrix"]
        ],
    }


async def spin(db, user: Dict[str, Any], tier: str) -> Dict[str, Any]:
    """Execute a single daily spin for the given tier.

    Side effects:
      • One row appended to ``prize_wheel_spins`` (full audit trail).
      • If outcome is 'coins':
          - Conditional Treasury debit (we never overdraw the bucket).
          - User wallet credit via services.coin_wallet.credit_coins.
          - Counts against the rolling-24h breaker.
      • Non-coin outcomes write a row but do not move coins; the
        utility asset / merchant perk is recorded for the caller
        to redeem in its own surface.
    """
    if tier not in TIER_CONFIGS:
        return {"ok": False, "reason": "unknown_tier"}

    user_id = user["user_id"]

    # 1. Sybil gate
    passes, sybil_reason = await _passes_sybil_gate(db, user, tier)
    if not passes:
        return {"ok": False, "reason": f"sybil:{sybil_reason}"}

    # 2. Cooldown
    can_spin, next_at = await _can_spin_now(db, user_id, tier)
    if not can_spin:
        return {"ok": False, "reason": "cooldown_active", "next_spin_at": next_at}

    # 3. Resolve matrix (apply breaker filter if tripped)
    breaker = await _breaker_state(db)
    matrix = TIER_CONFIGS[tier]["matrix"]
    breaker_applied = False
    if breaker["tripped"]:
        filtered = await _filter_matrix_for_breaker(matrix)
        if filtered is matrix:
            # No non-coin rows in this tier — block the spin gracefully.
            return {
                "ok": False, "reason": "breaker_blocked",
                "breaker": breaker,
            }
        matrix = filtered
        breaker_applied = True

    # 4. Pick outcome
    kind, payload = _pick_weighted(matrix)

    spin_id = f"spin_{uuid.uuid4().hex[:14]}"
    coin_amount = 0
    treasury_debited = False
    credited_balance = None

    if kind == "coins":
        # Roll within bounds (inclusive)
        lo, hi = payload["min_coins"], payload["max_coins"]
        coin_amount = lo if lo == hi else random.randint(lo, hi)

        # Conditional Treasury debit — never overdraw.
        result = await db.recirculation_pools.update_one(
            {"_id": "treasury", "balance": {"$gte": coin_amount}},
            {"$inc": {"balance": -coin_amount},
             "$set": {"updated_at": _now_iso()}},
        )
        if result.modified_count == 0:
            # Treasury is too dry — degrade gracefully to a digital asset.
            kind = "digital_asset"
            payload = {
                "asset_key": "gaming_shield_basic",
                "title": "DSG Gaming Shield",
                "subtitle": "Treasury cooldown — utility prize awarded",
            }
            coin_amount = 0
        else:
            treasury_debited = True
            # Credit user wallet
            from services.coin_wallet import credit_coins  # noqa: PLC0415
            credit_res = await credit_coins(
                db, user_id, coin_amount,
                reason="prize_wheel_payout",
                metadata={"tier": tier, "spin_id": spin_id,
                          "is_jackpot": bool(payload.get("is_jackpot"))},
            )
            credited_balance = credit_res.get("balance_after")

    # 5. Append spin audit row
    spin_doc = {
        "spin_id": spin_id,
        "user_id": user_id,
        "tier": tier,
        "kind": kind,
        "payload": payload,
        "coin_amount": int(coin_amount),
        "treasury_debited": treasury_debited,
        "breaker_applied": breaker_applied,
        "at": _now_iso(),
    }
    await db.prize_wheel_spins.insert_one(spin_doc)

    # 6. If non-coin perk, drop a row in user_prize_inventory so the
    #    caller surface (dating boost ribbon, hungry-vibez checkout
    #    coupon picker, etc.) can redeem it.
    if kind in ("digital_asset", "merchant_perk"):
        await db.user_prize_inventory.insert_one({
            "user_id": user_id,
            "spin_id": spin_id,
            "kind": kind,
            "asset_key": payload.get("asset_key") or payload.get("perk_key"),
            "title": payload.get("title", ""),
            "subtitle": payload.get("subtitle", ""),
            "status": "unclaimed",
            "awarded_at": _now_iso(),
        })

    return {
        "ok": True,
        "spin_id": spin_id,
        "tier": tier,
        "tier_label": TIER_CONFIGS[tier]["label"],
        "outcome": {
            "kind": kind,
            "coin_amount": int(coin_amount) if coin_amount else 0,
            "title": payload.get("title", ""),
            "subtitle": payload.get("subtitle", ""),
            "is_jackpot": bool(payload.get("is_jackpot")),
        },
        "balance_after_coins": credited_balance,
        "breaker_applied": breaker_applied,
    }


async def resolve_user_tier(db, user: Dict[str, Any]) -> str:
    """Decide the highest tier a user qualifies for.

    Resolution order (highest → lowest):
      • Top   — has an active Founder Chair (hardware-locked)
      • Mid   — has spent ≥ 50,000 ₵ in last 30 days (active player)
      • Free  — fallback for everyone else who passes the sybil gate
    """
    user_id = user["user_id"]

    # Top: chair holder
    chair = await db.chair_holders.find_one(
        {"user_id": user_id, "status": {"$in": ["active", "held"]}},
        {"_id": 0, "chair_id": 1},
    )
    if chair:
        return "top"

    # Mid: cumulative ₵ spent in last 30 days
    cutoff = (_now() - timedelta(days=30)).isoformat()
    agg = await db.coin_ledger.aggregate([
        {"$match": {
            "user_id": user_id,
            "created_at": {"$gte": cutoff},
            "coins": {"$lt": 0},   # debits only
        }},
        {"$group": {"_id": None, "spent": {"$sum": "$coins"}}},
    ]).to_list(length=1)
    spent_abs = abs(int(agg[0]["spent"])) if agg else 0
    if spent_abs >= 50_000:
        return "mid"

    return "free"

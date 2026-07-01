"""
Sovereign Engine — Master Vault v9 (uploaded 2026-02-06).

Implements the constitutional economic primitives from
`Global_Vibez_Sovereign_Master_Vault_v9.pdf`:

  • Fixed Supply:          3,000,000,000 Vibez Coins
  • Treasury Reserve:      1,500,000,000
  • Market Circulation:    1,500,000,000
  • Sovereign Tax:         13.5% (default)
  • VibeRidez Tax:         30%   (overrides default for VIBE_RIDEZ + tips)
  • Ambassador Dividend:   2%    (kicked back from the tax bucket)
  • VibeRidez Split:       70% Driver / 30% Platform (tips fully protected)

Every server-side ₵ debit/credit related to gameplay or VibeRidez should
route through `process_transaction()` so the Sovereign Treasury is
recirculated and ambassador dividends are emitted from a single
audited bucket.

Two helpers:
  • process_transaction(...) — applies tax + computes ambassador dividend +
    deposits into the treasury vault ledger collection.
  • get_economy_status() — returns the live state for the
    `/api/economy/status` endpoint (consumed by the Chair Hall
    "Infinity Table" 3D widget per the v9 Integration Guide).
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional


# ── Sovereign Constants (read from env with safe defaults from PDF) ──
def _f(key: str, default: float) -> float:
    try:
        return float(os.environ.get(key, default))
    except (TypeError, ValueError):
        return default


TOTAL_SUPPLY_CAP: int = int(_f("TOTAL_SUPPLY_CAP", 3_000_000_000))
TREASURY_RESERVE: int = int(_f("TREASURY_RESERVE", 1_500_000_000))
SOVEREIGN_TAX: float = _f("SOVEREIGN_TAX", 0.135)         # 13.5% default
VIBERIDEZ_TAX: float = _f("VIBERIDEZ_TAX", 0.30)          # 30% on rides
RIDE_SPLIT: float = _f("RIDE_SPLIT", 0.70)                # 70% driver share
# v12 Final Vault — Ambassador Dividend bumped 2% → 3.5%; Ambassador
# Override is a separate 5% mining kickback added on top.
AMBASSADOR_DIVIDEND: float = _f("AMBASSADOR_DIVIDEND", 0.035)
AMBASSADOR_OVERRIDE: float = _f("AMBASSADOR_OVERRIDE", 0.05)

# v12 Founder Vault — 200M DSG, locked until 50,000th chair sold;
# 25% immediate release on unlock + 11-month monthly drip.
FOUNDER_VAULT_TOTAL: int = int(_f("FOUNDER_VAULT_TOTAL", 200_000_000))
FOUNDER_VAULT_UNLOCK_CHAIRS: int = int(_f("FOUNDER_VAULT_UNLOCK_CHAIRS", 50_000))
FOUNDER_VAULT_IMMEDIATE_RELEASE: float = _f("FOUNDER_VAULT_IMMEDIATE_RELEASE", 0.25)

# v12 Crew Vaults — 50M DSG exempt from per-wallet ownership limits.
CREW_VAULT_TOTAL: int = int(_f("CREW_VAULT_TOTAL", 50_000_000))

# ── v10 Constitution: Solana Bridge (4:1 compression of in-app coins → DSG)
DSG_TOTAL_SUPPLY: int = int(_f("DSG_TOTAL_SUPPLY", 750_000_000))
DSG_MARKET_SALE: int = int(_f("DSG_MARKET_SALE", 500_000_000))
DSG_FOUNDER_VAULT: int = int(_f("DSG_FOUNDER_VAULT", 200_000_000))
DSG_GIVEAWAY_RESERVE: int = int(_f("DSG_GIVEAWAY_RESERVE", 50_000_000))
BRIDGE_COMPRESSION_RATIO: int = int(_f("BRIDGE_COMPRESSION_RATIO", 4))
GENIUS_PHASE_BONUS: float = _f("GENIUS_PHASE_BONUS", 1.5)


def calculate_bridge(coins: int, genius_bonus: bool = False) -> float:
    """v10 Solana Bridge — 4:1 compression of in-app coins to DSG tokens.
    During the Genius Phase, holders bridging in get a 1.5× multiplier
    on the bridged amount (per `Global_Vibez_Sovereign_Final_Constitution_v10.pdf`).
    """
    base = max(0, int(coins)) / max(1, BRIDGE_COMPRESSION_RATIO)
    if genius_bonus:
        return base * GENIUS_PHASE_BONUS
    return base


async def _founder_vault_state(db) -> Dict[str, Any]:
    """v12 Founder Vault live state.

    Unlock gate = 50,000 chairs sold (counted from `chair_purchases` where
    `status != refunded`). On unlock: 25% released immediately, balance
    released monthly over 11 further months → 12-month total drip.
    """
    from datetime import datetime, timezone  # noqa: PLC0415
    chairs_sold = await db.chair_purchases.count_documents({"status": {"$ne": "refunded"}})
    unlocked = chairs_sold >= FOUNDER_VAULT_UNLOCK_CHAIRS
    state = await db.founder_vault_state.find_one({"_id": "vault"}, {"_id": 0}) or {}
    unlocked_at_iso = state.get("unlocked_at")
    immediate = int(round(FOUNDER_VAULT_TOTAL * FOUNDER_VAULT_IMMEDIATE_RELEASE))
    released = 0
    months_since_unlock = 0
    if unlocked:
        if not unlocked_at_iso:
            unlocked_at_iso = datetime.now(timezone.utc).isoformat()
            await db.founder_vault_state.update_one(
                {"_id": "vault"},
                {"$set": {"unlocked_at": unlocked_at_iso}},
                upsert=True,
            )
        released += immediate
        try:
            unlocked_at = datetime.fromisoformat(unlocked_at_iso)
        except Exception:  # noqa: BLE001
            unlocked_at = datetime.now(timezone.utc)
        now = datetime.now(timezone.utc)
        months_since_unlock = max(0, (now.year - unlocked_at.year) * 12 + (now.month - unlocked_at.month))
        remaining_after_immediate = FOUNDER_VAULT_TOTAL - immediate
        monthly_drip = remaining_after_immediate // 11
        released += min(remaining_after_immediate, monthly_drip * months_since_unlock)
    return {
        "total": FOUNDER_VAULT_TOTAL,
        "unlock_chairs": FOUNDER_VAULT_UNLOCK_CHAIRS,
        "chairs_sold": chairs_sold,
        "unlocked": unlocked,
        "released": released,
        "remaining_locked": max(0, FOUNDER_VAULT_TOTAL - released),
        "months_since_unlock": months_since_unlock,
        "immediate_release_pct": FOUNDER_VAULT_IMMEDIATE_RELEASE,
        "unlocked_at": unlocked_at_iso,
    }


async def process_transaction(
    db,
    *,
    user_id: str,
    amount: int,
    tx_type: str,
    is_ambassador: bool = False,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Apply the sovereign tax on a Vibez Coin transaction. Idempotent at
    the `(user_id, tx_type, ts_iso)` granularity is the caller's
    responsibility (we don't fingerprint here so multiple legitimate
    same-second tx's still process)."""
    if amount <= 0:
        return {"payout": 0, "dividend": 0, "tax": 0, "tax_rate": 0}

    tax_rate = VIBERIDEZ_TAX if tx_type.upper() in {"VIBE_RIDEZ", "VIBE_DRIVE_TIP"} else SOVEREIGN_TAX
    house_take = int(round(amount * tax_rate))
    # Ambassador kickback: 2% of `house_take`, scaled relative to default
    # tax so VibeRidez ambassadors don't get an outsized cut from the
    # 30% bracket. Per v9 PDF: dividend = house_take * (AMB / GOV).
    dividend = 0
    if is_ambassador and SOVEREIGN_TAX > 0:
        dividend = int(round(house_take * (AMBASSADOR_DIVIDEND / SOVEREIGN_TAX)))

    payout = max(0, amount - house_take)
    now_iso = datetime.now(timezone.utc).isoformat()

    # Treasury Vault ledger — feeds the /api/economy/status snapshot.
    await db.sovereign_treasury_ledger.insert_one({
        "user_id": user_id,
        "tx_type": tx_type.upper(),
        "amount": int(amount),
        "tax": int(house_take),
        "tax_rate": tax_rate,
        "ambassador_dividend": int(dividend),
        "payout": int(payout),
        "ts": now_iso,
        "metadata": metadata or {},
    })
    await db.sovereign_treasury_state.update_one(
        {"_id": "vault"},
        {
            "$inc": {
                "vault_balance": int(house_take),
                "lifetime_tax": int(house_take),
                "lifetime_dividends_paid": int(dividend),
                "lifetime_volume": int(amount),
            },
            "$set": {"updated_at": now_iso},
        },
        upsert=True,
    )
    return {
        "payout": payout,
        "dividend": dividend,
        "tax": house_take,
        "tax_rate": tax_rate,
    }


async def get_economy_status(db) -> Dict[str, Any]:
    """Live state of the 3-Billion-Coin economy — used by the /economy/status
    endpoint and the Chair Hall "Infinity Table" 3D widget."""
    state = await db.sovereign_treasury_state.find_one({"_id": "vault"}, {"_id": 0}) or {}
    vault_balance = int(state.get("vault_balance") or 0)
    lifetime_tax = int(state.get("lifetime_tax") or 0)
    lifetime_dividends = int(state.get("lifetime_dividends_paid") or 0)
    lifetime_volume = int(state.get("lifetime_volume") or 0)

    # Circulating estimate: cap minus reserve minus the live treasury bucket.
    circulating = max(0, TOTAL_SUPPLY_CAP - TREASURY_RESERVE - vault_balance)
    return {
        "supply": {
            "total_cap": TOTAL_SUPPLY_CAP,
            "treasury_reserve": TREASURY_RESERVE,
            "vault_balance": vault_balance,
            "circulating_estimate": circulating,
        },
        "constants": {
            "sovereign_tax": SOVEREIGN_TAX,
            "viberidez_tax": VIBERIDEZ_TAX,
            "ride_split": RIDE_SPLIT,
            "ambassador_dividend": AMBASSADOR_DIVIDEND,
            "ambassador_override": AMBASSADOR_OVERRIDE,
        },
        "founder_vault": await _founder_vault_state(db),
        "crew_vault": {
            "total": CREW_VAULT_TOTAL,
            "policy": "50M exempt from per-wallet ownership limits (v12).",
        },
        "lifetime": {
            "volume": lifetime_volume,
            "tax_collected": lifetime_tax,
            "dividends_paid": lifetime_dividends,
        },
        # v10 Constitution — Solana Bridge supply allocations
        "dsg": {
            "total_supply": DSG_TOTAL_SUPPLY,
            "market_sale": DSG_MARKET_SALE,
            "founder_vault": DSG_FOUNDER_VAULT,
            "giveaway_reserve": DSG_GIVEAWAY_RESERVE,
            "compression_ratio": BRIDGE_COMPRESSION_RATIO,
            "genius_phase_bonus": GENIUS_PHASE_BONUS,
        },
        "updated_at": state.get("updated_at"),
    }

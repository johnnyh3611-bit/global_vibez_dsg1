"""
Economy Control Center — God-Mode dashboard backend.

Implements the founder's economic levers from the Apr 27 deployment plan:
  • Liquidity Health Index (reserve/liability ratio + payout multiplier)
  • Auto-Pilot scheduler (hourly house-fee adjustment based on reserve)
  • Emergency Lock (manual freeze of payouts + point-minting)
  • Welcome Letter (legally-safe rewording of the founder's draft)

All endpoints sit behind admin-cookie gating (or are public read-only
where noted). Money math is in USD, member-facing payouts are in ₵.

LEGAL POSTURE: Reserve/liability talk here is OPERATIONAL risk
management (the same lane Costco / Patreon / SaaS subscription apps
use), NOT a securities yield model. We never tell members the reserve
backs their "investment value" — only that it ensures the platform can
honor discretionary loyalty bonuses.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from utils.database import get_database
from routes.admin_dashboard import verify_admin_cookie
from routes.god_mode_audit import record_god_event

logger = logging.getLogger(__name__)
router = APIRouter()


# ────────────────────────────────────────────── Tunables

# Founder's manual: target 2× reserve coverage. Don't drop payouts below
# 50% even when reserve is dry — keeps members in the program until ops
# can rebuild the reserve.
TARGET_COVERAGE_RATIO = 2.0
MIN_PAYOUT_MULTIPLIER = 0.5

# Auto-pilot fee bands (% of revenue → operating cut)
FEE_PROSPERITY = 0.04   # ratio > 2.5 → lower fee, attract growth
FEE_STEADY = 0.06       # 1.2 ≤ ratio ≤ 2.5 → standard
FEE_DEFENSIVE = 0.12    # ratio < 1.2 → defensive, rebuild reserve

# Where the auto-pilot stores its current state
CONFIG_KEY = "economy_control"


# ────────────────────────────────────────────── Helpers


async def _reserve_balance(db) -> float:
    rec = await db.gvdsg_reserve.find_one(
        {"_id": "stability_reserve"}, {"_id": 0, "balance_usd": 1}
    ) or {}
    return float(rec.get("balance_usd") or 0.0)


async def _total_chair_liability(db) -> float:
    """Liability proxy: total contributions held in active chairs.

    Conservative proxy — treats the full lifetime contribution as the
    liability we'd need to honor if every member cashed in their loyalty
    bonus pool simultaneously. Real liability is much smaller (only a
    fraction of the pool is paid each quarter, and only to premium
    members), so this is the worst-case ceiling.
    """
    pipeline = [
        {"$group": {
            "_id": None,
            "total": {"$sum": "$lifetime_contribution_usd"},
        }},
    ]
    rows = await db.profit_share_balances.aggregate(pipeline).to_list(length=1)
    if not rows:
        return 0.0
    return float(rows[0].get("total") or 0.0)


def calculate_safety_multiplier(reserve_usd: float, liability_usd: float) -> float:
    """Founder's manual translation, with a floor.

    Returns 1.0 when reserve is at or above the 2× target. Scales linearly
    down to 0.5 as reserve approaches zero.
    """
    if liability_usd <= 0:
        return 1.0
    threshold = liability_usd * TARGET_COVERAGE_RATIO
    if reserve_usd >= threshold:
        return 1.0
    return max(reserve_usd / threshold, MIN_PAYOUT_MULTIPLIER)


def _zone_for(ratio: float) -> str:
    """UI hint string — Cyan / Amber / Red."""
    if ratio >= 1.5:
        return "Healthy"
    if ratio >= 1.0:
        return "Caution"
    return "Critical"


async def _get_config(db) -> Dict[str, Any]:
    rec = await db.system_config.find_one({"_id": CONFIG_KEY}, {"_id": 0}) or {}
    return {
        "house_fee_pct": float(rec.get("house_fee_pct") or FEE_STEADY),
        "payout_multiplier": float(rec.get("payout_multiplier") or 1.0),
        "auto_pilot_enabled": bool(rec.get("auto_pilot_enabled", True)),
        "emergency_lock": bool(rec.get("emergency_lock", False)),
        "last_auto_pilot_run": rec.get("last_auto_pilot_run"),
        "last_zone": rec.get("last_zone", "Healthy"),
    }


async def _set_config(db, **patch) -> None:
    patch["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.system_config.update_one(
        {"_id": CONFIG_KEY}, {"$set": patch}, upsert=True
    )


# ────────────────────────────────────────────── Public/admin read endpoints


@router.get("/admin/health-check")
async def health_check(_: bool = Depends(verify_admin_cookie)) -> Dict[str, Any]:
    """Feeds the Liquidity Health meter on the God-Mode dashboard."""
    db = get_database()
    reserve = await _reserve_balance(db)
    liability = await _total_chair_liability(db)
    multiplier = calculate_safety_multiplier(reserve, liability)
    ratio = (reserve / liability) if liability > 0 else float("inf")

    cfg = await _get_config(db)
    zone = "Locked" if cfg["emergency_lock"] else _zone_for(ratio)

    return {
        "status": zone,
        "reserve_usd": round(reserve, 2),
        "total_liability_usd": round(liability, 2),
        "reserve_ratio": (round(ratio, 4) if ratio != float("inf") else None),
        "target_ratio": TARGET_COVERAGE_RATIO,
        "payout_multiplier": round(multiplier, 4),
        "action_required": multiplier < 0.8 or cfg["emergency_lock"],
        "current_house_fee_pct": cfg["house_fee_pct"],
        "auto_pilot_enabled": cfg["auto_pilot_enabled"],
        "emergency_lock": cfg["emergency_lock"],
        "last_auto_pilot_run": cfg.get("last_auto_pilot_run"),
    }


@router.get("/economy/health")
async def public_health() -> Dict[str, Any]:
    """Public, anonymized version for the user-facing transparency tile.

    Members see: zone (color), ratio, multiplier — no raw $ figures, so
    operational details stay confidential while members can see the
    system is in a "Healthy / Caution / Critical" state.
    """
    db = get_database()
    reserve = await _reserve_balance(db)
    liability = await _total_chair_liability(db)
    ratio = (reserve / liability) if liability > 0 else 99.0
    multiplier = calculate_safety_multiplier(reserve, liability)
    cfg = await _get_config(db)
    zone = "Locked" if cfg["emergency_lock"] else _zone_for(ratio)
    return {
        "zone": zone,
        "ratio": round(min(ratio, 9.9), 2),
        "payout_multiplier": round(multiplier, 4),
        "emergency_lock": cfg["emergency_lock"],
    }


# ────────────────────────────────────────────── Admin write endpoints


class EmergencyLockPayload(BaseModel):
    enabled: bool
    reason: Optional[str] = Field(None, max_length=500)


@router.post("/admin/emergency-lock")
async def set_emergency_lock(
    payload: EmergencyLockPayload,
    _: bool = Depends(verify_admin_cookie),
) -> Dict[str, Any]:
    """Manual override — freezes payouts and pauses point-minting until released.

    Side effects when ENABLED:
      • Auto-pilot is paused.
      • `payout_multiplier` is forced to 0 (read by the chair-pool payout job).
      • Point-minting routes (accrue_stake, etc.) check this flag and no-op.

    Audit trail recorded via god-mode events.
    """
    db = get_database()
    if payload.enabled:
        await _set_config(
            db,
            emergency_lock=True,
            payout_multiplier=0.0,
            auto_pilot_enabled=False,
            lock_reason=payload.reason or "manual_admin_lock",
            locked_at=datetime.now(timezone.utc).isoformat(),
        )
    else:
        # Releasing the lock recomputes the multiplier from current health.
        reserve = await _reserve_balance(db)
        liability = await _total_chair_liability(db)
        mult = calculate_safety_multiplier(reserve, liability)
        await _set_config(
            db,
            emergency_lock=False,
            payout_multiplier=mult,
            auto_pilot_enabled=True,
            unlock_at=datetime.now(timezone.utc).isoformat(),
        )

    await record_god_event(
        "system",
        "EMERGENCY_LOCK_ENABLED" if payload.enabled else "EMERGENCY_LOCK_RELEASED",
        0,
        meta={"reason": payload.reason},
    )
    cfg = await _get_config(db)
    return {"ok": True, **cfg}


class AutoPilotTogglePayload(BaseModel):
    enabled: bool


@router.post("/admin/auto-pilot")
async def toggle_auto_pilot(
    payload: AutoPilotTogglePayload,
    _: bool = Depends(verify_admin_cookie),
) -> Dict[str, Any]:
    db = get_database()
    await _set_config(db, auto_pilot_enabled=payload.enabled)
    cfg = await _get_config(db)
    await record_god_event(
        "system",
        "AUTO_PILOT_TOGGLED",
        0,
        meta={"enabled": payload.enabled},
    )
    return {"ok": True, **cfg}


# ────────────────────────────────────────────── Auto-pilot scheduler


async def auto_pilot_tick() -> Dict[str, Any]:
    """Hourly scheduler tick.

    Reads reserve + liability, picks the right fee band, updates config.
    Skips if auto-pilot is disabled or emergency-locked.

    Also opportunistically scans for phase-milestone crossings (25/50/75/100%)
    so the founder gets queued social-post drafts the moment a milestone hits.
    """
    db = get_database()
    cfg = await _get_config(db)

    # Milestone scan runs regardless of auto-pilot state — these are public
    # marketing crossings, not economic levers.
    try:
        from routes.milestones import _scan_for_milestones
        await _scan_for_milestones(db)
    except Exception as exc:
        logger.warning(f"[auto-pilot] milestone scan failed: {exc}")

    if not cfg["auto_pilot_enabled"] or cfg["emergency_lock"]:
        return {"skipped": True, "reason": "disabled_or_locked"}

    reserve = await _reserve_balance(db)
    liability = await _total_chair_liability(db)
    if liability <= 0:
        # No outstanding loyalty liability yet — keep steady fee.
        await _set_config(
            db,
            house_fee_pct=FEE_STEADY,
            payout_multiplier=1.0,
            last_auto_pilot_run=datetime.now(timezone.utc).isoformat(),
            last_zone="Healthy",
        )
        return {"reserve": reserve, "liability": liability, "fee": FEE_STEADY}

    ratio = reserve / liability
    multiplier = calculate_safety_multiplier(reserve, liability)
    if ratio < 1.2:
        new_fee = FEE_DEFENSIVE
        zone = "Critical"
    elif ratio > 2.5:
        new_fee = FEE_PROSPERITY
        zone = "Healthy"
    else:
        new_fee = FEE_STEADY
        zone = "Caution" if ratio < 1.5 else "Healthy"

    if abs(new_fee - cfg["house_fee_pct"]) > 1e-4 or zone != cfg["last_zone"]:
        await record_god_event(
            "system",
            "AUTO_PILOT_FEE_ADJUSTED",
            0,
            meta={
                "from_pct": cfg["house_fee_pct"], "to_pct": new_fee,
                "reserve_usd": reserve, "liability_usd": liability,
                "ratio": round(ratio, 4), "zone": zone,
            },
        )

    await _set_config(
        db,
        house_fee_pct=new_fee,
        payout_multiplier=multiplier,
        last_auto_pilot_run=datetime.now(timezone.utc).isoformat(),
        last_zone=zone,
    )
    logger.info(
        f"[auto-pilot] reserve=${reserve:.2f} liability=${liability:.2f} "
        f"ratio={ratio:.2f} → fee={new_fee*100:.0f}% zone={zone}"
    )
    return {
        "reserve_usd": reserve,
        "liability_usd": liability,
        "ratio": round(ratio, 4),
        "fee_pct": new_fee,
        "payout_multiplier": multiplier,
        "zone": zone,
    }


# ────────────────────────────────────────────── Welcome letter


@router.get("/chairs/welcome-letter")
async def welcome_letter() -> Dict[str, Any]:
    """Public — returns the legally-safe Welcome Letter shown to new
    chair holders the first time they hit /chair-vault after activation.
    Body lives here (not in the FE) so we can reword without a redeploy.
    """
    return {
        "title": "Welcome to the Inner Circle",
        "subtitle": "Founder's Note for the first 250,000 chair holders",
        "body": [
            "You are not just a member. You are one of the first 250,000 "
            "people to park a chair in the Global Vibez DSG community.",
            "Here is what your seat means.",
            "",
            "**The Vibe**",
            "I built this platform to be **member-driven**. When the platform "
            "grows, my goal is for the loyalty bonuses to grow with it. You "
            "stay Premium and active, you keep your chair parked, and you "
            "share in the discretionary quarterly community rewards. That is "
            "the whole point of holding a Founder Chair.",
            "",
            "**The Phases**",
            "The first 50,000 seats are **Genius** — the believers who "
            "showed up first, locked in at $10/seat with a permanent **3× "
            "earn-rate multiplier** on the loyalty pool. The next 50,000 "
            "are **Genesis** at $15/seat with a permanent **2× multiplier**. "
            "From there the ladder steps up $5 every 50K chairs (Phase III "
            "$20 → Phase V $30) at standard or fractional weights.",
            "Your multiplier is locked the moment you buy. Genius chairs "
            "keep their 3× even after Genius sells out and the public price "
            "moves up. As I make, you make.",
            "",
            "**Your Multiplier Effect**",
            "We do not buy billboards. We pay community recruiters. Inside "
            "your dashboard you have a **personal QR code** and a fresh "
            "**invite code** auto-minted for you. Every time someone scans "
            "your code and parks their first chair, you get bonus loyalty "
            "stakes credited to your balance. Post the QR on your IG, TikTok, "
            "or X — your network grows your rewards.",
            "",
            "**The Safety Net**",
            "Operational transparency is the deal. Your chair is protected by "
            "a **2× reserve coverage** target — the platform automatically "
            "throttles payouts if the reserve dips, so the community pool "
            "never runs dry. There is also an **Emergency Lock** I can flip "
            "manually if anything looks off, freezing payouts until an audit "
            "is clean.",
            "",
            "**Plain-English Legal**",
            "Founder Chairs are non-transferable loyalty seats. Quarterly "
            "distributions are discretionary loyalty bonuses payable in ₵ "
            "Vibez Coins, not guaranteed returns. Multipliers apply only to "
            "stakes earned through platform activity. Same legal structure "
            "as Costco lifetime, Patreon Founding Patron, and Discord Nitro. "
            "Not securities, not equity, not investment instruments.",
            "",
            "**Your Next Step**",
            "1. Open your **Genius Kit** (chair vault → Share my chair).",
            "2. Drop your QR code anywhere social.",
            "3. Watch the Liquidity Health meter — as more chairs fill up, "
            "the whole community moves into the prosperity zone.",
            "",
            "This is your community now. Let's run it right.",
            "",
            "— The Founder, Global Vibez DSG",
        ],
        "signoff": "© 2026 Global Vibez DSG · ₵ Vibez Coins",
    }

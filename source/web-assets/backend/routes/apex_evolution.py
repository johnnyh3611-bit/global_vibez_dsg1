"""
Apex Evolution — economy expansion event.

Runs ONCE at a configurable timestamp (`APEX_EVOLUTION_TIMESTAMP` env var,
ISO-8601 UTC). When the timer hits, OR when a Founder hits the manual
"Activate Now" admin button:

  1. **Multiplier Pump** — every existing `chair_purchases` row gets
     `weight += 1.0`. Genius 3× → 4×, Genesis 2× → 3×, Phase III/IV/V
     1×–1.5× → 2×–2.5×. `profit_share_balances.weighted_chairs` is bumped
     by `+ locked_chairs * 1.0` per holder so the quarterly payout job
     sees the new totals immediately.
  2. **Legacy phases lock** — no new Genius $10 → Phase V $30 sales after this point.
     Existing holders keep their chairs untouched.
  3. **Apex bracket opens** — 250,000 new seats @ $50 USD, weight 1.0.

Idempotent on `platform_state.apex.pump_applied`. Re-firing the activator
(scheduler tick, manual admin click, or accidental double-call) is a
no-op once the pump has landed.

Apex Race Leaderboard:
  • `race_started_at` is stamped at backend boot if the platform_state
    doc doesn't already have one, OR can be reset by the founder.
  • Counts invite redemptions where `used_at >= race_started_at`.
  • On evolution day, the founder can hit `award-bonuses` to give the
    top 100 a free Apex chair (idempotent on `apex_race_bonus_payment_ref`).

Endpoints:
  GET  /api/apex/status                       (public)
  GET  /api/apex/race/leaders                 (public, anonymized)
  POST /api/admin/apex/activate-now           (admin)
  POST /api/admin/apex/award-bonuses          (admin, idempotent)
  POST /api/admin/apex/reset-race             (admin, restarts race window)
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from utils.database import get_database, get_current_user
from routes.admin_dashboard import verify_admin_cookie
from routes.god_mode_audit import record_god_event

logger = logging.getLogger(__name__)
router = APIRouter()


# ────────────────────────────────────────────── Constants

APEX_PHASE = {
    "name": "Apex",
    "price_usd": 50.00,
    "weight": 1.0,
    "capacity": 250_000,
    "tagline": "Elite Apex seats — standard 1× multiplier, $50 each.",
}

# Top 100 referrers each get one free Apex chair on evolution day.
APEX_RACE_PRIZE_COUNT = 100


# ────────────────────────────────────────────── Helpers


def _evolution_timestamp() -> Optional[datetime]:
    """Read APEX_EVOLUTION_TIMESTAMP env var. Returns None if unset."""
    raw = os.environ.get("APEX_EVOLUTION_TIMESTAMP")
    if not raw:
        return None
    try:
        # Accept "2026-06-01T00:00:00Z" or "2026-06-01T00:00:00+00:00"
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except Exception as e:
        logger.warning(f"[apex] APEX_EVOLUTION_TIMESTAMP parse failed: {e}")
        return None


async def _state(db) -> Dict[str, Any]:
    """Reads platform_state.apex; lazily inits with race_started_at=now."""
    rec = await db.platform_state.find_one({"_id": "apex"}, {"_id": 0})
    if rec:
        return rec
    now_iso = datetime.now(timezone.utc).isoformat()
    seed = {
        "_id": "apex",
        "race_started_at": now_iso,
        "apex_unlocked": False,
        "pump_applied": False,
        "sold_at_unlock": None,
        "activated_at": None,
        "activated_by": None,
        "race_bonuses_awarded": False,
    }
    await db.platform_state.update_one(
        {"_id": "apex"}, {"$setOnInsert": seed}, upsert=True,
    )
    seed.pop("_id", None)
    return seed


async def is_apex_unlocked(db) -> bool:
    s = await _state(db)
    return bool(s.get("apex_unlocked"))


async def apex_state_for_phase(db) -> Optional[Dict[str, Any]]:
    """If Apex is live, return the chairs.py-shaped phase dict for it.
    Else return None (legacy phases drive)."""
    s = await _state(db)
    if not s.get("apex_unlocked"):
        return None
    sold_at_unlock = int(s.get("sold_at_unlock") or 0)
    # Direct import from the neutral shared module — no longer goes
    # through chairs.py (which would re-create a circular cycle).
    from shared.chair_counters import total_chairs_sold  # noqa: PLC0415
    sold = await total_chairs_sold(db)
    apex_sold = max(0, sold - sold_at_unlock)
    return {
        "phase": APEX_PHASE["name"],
        "price_usd": APEX_PHASE["price_usd"],
        "weight": APEX_PHASE["weight"],
        "limit": sold_at_unlock + APEX_PHASE["capacity"],
        "in_phase_capacity": APEX_PHASE["capacity"],
        "in_phase_sold": apex_sold,
        "remaining_in_phase": max(0, APEX_PHASE["capacity"] - apex_sold),
        "tagline": APEX_PHASE["tagline"],
        "total_sold": sold,
        "apex_active": True,
    }


# ────────────────────────────────────────────── The pump itself


async def _pump_multipliers(db) -> Dict[str, Any]:
    """Atomically bump every existing chair purchase weight by +1.0 and the
    aggregate `weighted_chairs` per holder.

    Idempotent — short-circuits once `pump_applied=True`.
    """
    s = await _state(db)
    if s.get("pump_applied"):
        return {"already_applied": True, "rows_bumped": 0}

    # 1. Tag every purchase row with apex_pump_added=True ONCE so a partial
    #    failure can be retried without double-pumping individual rows.
    purchases = await db.chair_purchases.find(
        {"apex_pump_added": {"$ne": True}},
        {"_id": 0, "user_id": 1, "quantity": 1, "weight": 1, "phase_at_purchase": 1},
    ).to_list(length=10_000_000)

    rows_bumped = 0
    user_qty: Dict[str, int] = {}
    for p in purchases:
        uid = p.get("user_id")
        qty = int(p.get("quantity") or 0)
        if not uid or qty < 1:
            continue
        user_qty[uid] = user_qty.get(uid, 0) + qty
        rows_bumped += 1

    # Bulk-update purchase rows.
    if rows_bumped:
        await db.chair_purchases.update_many(
            {"apex_pump_added": {"$ne": True}},
            {"$inc": {"weight": 1.0, "weighted_units": 0},  # weight pumped
             "$set": {"apex_pump_added": True}},
        )
        # `weighted_units` was qty * old_weight; we need qty * (old+1) =
        # weighted_units + qty. Re-loop and patch in bulk.
        for uid, qty in user_qty.items():
            await db.profit_share_balances.update_one(
                {"user_id": uid},
                {"$inc": {"weighted_chairs": float(qty)}},
                upsert=True,
            )

    # 2. Patch each chair_purchase row's `weighted_units` (qty * weight).
    #    Easier than $expr math: re-pull tagged rows and persist correct
    #    weighted_units.
    tagged = await db.chair_purchases.find(
        {"apex_pump_added": True},
        {"_id": 1, "quantity": 1, "weight": 1, "weighted_units": 1},
    ).to_list(length=10_000_000)
    for r in tagged:
        qty = int(r.get("quantity") or 0)
        w = float(r.get("weight") or 0.0)
        new_units = round(qty * w, 4)
        if abs(new_units - float(r.get("weighted_units") or 0.0)) > 0.001:
            await db.chair_purchases.update_one(
                {"_id": r["_id"]},
                {"$set": {"weighted_units": new_units}},
            )

    # 3. Stamp the state doc.
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.platform_state.update_one(
        {"_id": "apex"},
        {"$set": {
            "pump_applied": True,
            "pump_applied_at": now_iso,
            "pump_rows_bumped": rows_bumped,
        }},
        upsert=True,
    )
    await record_god_event(
        "system", "APEX_EVOLUTION_PUMP_APPLIED", 0,
        meta={"rows_bumped": rows_bumped, "users_affected": len(user_qty)},
    )
    logger.info(
        f"[apex] Multiplier pump applied: {rows_bumped} purchase rows, "
        f"{len(user_qty)} unique holders."
    )
    return {
        "already_applied": False,
        "rows_bumped": rows_bumped,
        "users_affected": len(user_qty),
    }


async def _activate_apex(db, *, source: str) -> Dict[str, Any]:
    """Run the full evolution: pump multipliers, lock legacy, unlock Apex.
    Idempotent — calling twice is a no-op once `apex_unlocked=True`.
    """
    s = await _state(db)
    if s.get("apex_unlocked"):
        return {"already_active": True}

    # 1. Pump.
    pump_result = await _pump_multipliers(db)

    # 2. Snapshot the cumulative sold counter so Apex's "in_phase_sold"
    #    starts at 0 when the math runs.
    from shared.chair_counters import total_chairs_sold  # noqa: PLC0415
    sold_now = await total_chairs_sold(db)

    # 3. Flip the unlock flag.
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.platform_state.update_one(
        {"_id": "apex"},
        {"$set": {
            "apex_unlocked": True,
            "sold_at_unlock": int(sold_now),
            "activated_at": now_iso,
            "activated_by": source,
        }},
        upsert=True,
    )
    await record_god_event(
        "system", "APEX_EVOLUTION_ACTIVATED", 0,
        meta={"source": source, "sold_at_unlock": int(sold_now),
              "pump_rows_bumped": pump_result.get("rows_bumped", 0)},
    )
    logger.info(
        f"[apex] EVOLUTION ACTIVE — source={source}, sold_at_unlock={sold_now}"
    )

    # 4. Auto-broadcast the celebration announcement. Lands on every
    #    chair holder's dashboard banner the next time their tab
    #    re-polls (~60s). We post it as a CLOSED `chair_holder_votes`
    #    row — it shows up in the same UI surface as votes, but with no
    #    voting buttons rendered (status=closed). Idempotent because
    #    _activate_apex itself short-circuits if already unlocked.
    try:
        import uuid  # noqa: PLC0415
        announcement = {
            "vote_id": f"announce_ev_{uuid.uuid4().hex[:10]}",
            "question": (
                "Escape Velocity reached. Your chair earnings just doubled."
            ),
            "context": (
                "We crossed the user milestone. Reserve Vault chairs are "
                "unlocking, every existing chair just got +1× on its earn-rate "
                "multiplier (Genius 3× → 4×, Genesis 2× → 3×, …), and the "
                "chair-holder profit share auto-bumped from 14% to 30% of "
                "quarterly platform profit. Same chair, ~2× the payout from "
                "today forward. Thank you for showing up early."
            ),
            "weighted": False,
            "opens_at": now_iso,
            "closes_at": now_iso,         # closed at create — info-only
            "status": "closed",
            "is_announcement": True,
            "created_by": "system_escape_velocity",
            "created_by_handle": "Founder",
            "tally": {
                "yes": 0, "no": 0, "abstain": 0,
                "yes_weight": 0.0, "no_weight": 0.0, "abstain_weight": 0.0,
                "holders_voted": 0,
            },
            "created_at": now_iso,
            "closed_at": now_iso,
        }
        await db.chair_holder_votes.insert_one(announcement)
        logger.info("[apex] Posted Escape Velocity celebration announcement.")
    except Exception as e:  # noqa: BLE001 — never block EV on broadcast failure
        logger.warning(f"[apex] EV announcement post failed (non-fatal): {e}")

    return {
        "already_active": False,
        "sold_at_unlock": int(sold_now),
        "pump": pump_result,
    }


# ────────────────────────────────────────────── Background scheduler


async def apex_evolution_scheduler():
    """Polls every 5 minutes for the timestamp. Auto-fires the activation
    once the wall clock crosses APEX_EVOLUTION_TIMESTAMP."""
    db = get_database()
    # Lazy-init the state doc so race_started_at is set from app startup.
    await _state(db)
    logger.info("[apex] Evolution scheduler started")

    while True:
        try:
            target = _evolution_timestamp()
            if target:
                now = datetime.now(timezone.utc)
                s = await _state(db)
                if (
                    not s.get("apex_unlocked")
                    and now >= target
                ):
                    logger.info(
                        f"[apex] Wall clock {now.isoformat()} ≥ target "
                        f"{target.isoformat()} → auto-activating."
                    )
                    await _activate_apex(db, source="auto_scheduler")
        except Exception as e:
            logger.warning(f"[apex] Scheduler tick failed: {e}")
        await asyncio.sleep(300)  # 5 min


# ────────────────────────────────────────────── Public endpoints


@router.get("/apex/status")
async def apex_status() -> Dict[str, Any]:
    """Public — drives the countdown banner on landing + chair-vault."""
    db = get_database()
    target = _evolution_timestamp()
    s = await _state(db)
    now = datetime.now(timezone.utc)

    seconds_left = None
    if target:
        seconds_left = max(0, int((target - now).total_seconds()))

    return {
        "evolution_at": target.isoformat() if target else None,
        "seconds_until_evolution": seconds_left,
        "apex_unlocked": bool(s.get("apex_unlocked")),
        "pump_applied": bool(s.get("pump_applied")),
        "race_started_at": s.get("race_started_at"),
        "activated_at": s.get("activated_at"),
        "race_bonuses_awarded": bool(s.get("race_bonuses_awarded")),
        "next_pump": {
            # Old → New multiplier map. Helpful for the marketing banner.
            "Genius":    {"old": 3.0, "new": 4.0},
            "Genesis":   {"old": 2.0, "new": 3.0},
            "Vanguard":  {"old": 2.0, "new": 3.0},
            "Global":    {"old": 1.0, "new": 2.0},
            "Stellar":   {"old": 1.0, "new": 2.0},
            "Celestial": {"old": 1.0, "new": 2.0},
            "Apex":      {"old": None, "new": 1.0},
        },
        "apex_phase": APEX_PHASE,
    }


@router.get("/apex/race/leaders")
async def race_leaders(limit: int = 100) -> Dict[str, Any]:
    """Public — anonymized referrer leaderboard since the race started."""
    db = get_database()
    s = await _state(db)
    race_started_at = s.get("race_started_at")
    limit = max(1, min(int(limit), APEX_RACE_PRIZE_COUNT))

    # Match used invites where used_at >= race_started_at. Group by inviter.
    match: Dict[str, Any] = {"status": "used"}
    if race_started_at:
        match["used_at"] = {"$gte": race_started_at}
    pipeline = [
        {"$match": match},
        {"$group": {"_id": "$owner_user_id", "race_invites": {"$sum": 1}}},
        {"$sort": {"race_invites": -1}},
        {"$limit": limit},
    ]
    rows = await db.invites.aggregate(pipeline).to_list(length=limit)
    out = []
    for i, r in enumerate(rows, start=1):
        uid = r["_id"]
        if not uid:
            continue
        anon = (uid[:6] + "…" + uid[-2:]) if len(uid) > 10 else uid
        out.append({
            "rank": i,
            "anon_id": anon,
            "race_invites": int(r["race_invites"]),
            "qualifies_for_bonus": i <= APEX_RACE_PRIZE_COUNT,
        })
    return {
        "race_started_at": race_started_at,
        "prize_count": APEX_RACE_PRIZE_COUNT,
        "leaders": out,
    }


# ────────────────────────────────────────────── Admin endpoints


@router.post("/admin/apex/activate-now")
async def admin_activate_now(
    _: bool = Depends(verify_admin_cookie),
) -> Dict[str, Any]:
    """Manual fire — bypass the timestamp wait."""
    db = get_database()
    result = await _activate_apex(db, source="manual_admin_override")
    return {"ok": True, **result}


@router.post("/admin/apex/award-bonuses")
async def admin_award_bonuses(
    _: bool = Depends(verify_admin_cookie),
) -> Dict[str, Any]:
    """Award one free Apex chair to each of the top 100 race finishers.
    Idempotent on `platform_state.apex.race_bonuses_awarded` — second
    click returns `already_awarded: True` and grants nothing."""
    db = get_database()
    s = await _state(db)
    if s.get("race_bonuses_awarded"):
        return {"already_awarded": True, "winners": 0}

    if not s.get("apex_unlocked"):
        raise HTTPException(
            400, "Apex must be activated before bonuses are awarded.",
        )

    # Re-run the leaderboard query — top 100.
    leaders = (await race_leaders(limit=APEX_RACE_PRIZE_COUNT)).get("leaders", [])
    granted = 0
    granted_ids: List[str] = []

    from routes.chairs import _grant_chairs  # noqa: PLC0415

    # Look up the actual user_ids from invites — anon_id was masked.
    # Re-query to get the real ids for the top N inviters.
    race_started_at = s.get("race_started_at")
    match: Dict[str, Any] = {"status": "used"}
    if race_started_at:
        match["used_at"] = {"$gte": race_started_at}
    pipeline = [
        {"$match": match},
        {"$group": {"_id": "$owner_user_id", "race_invites": {"$sum": 1}}},
        {"$sort": {"race_invites": -1}},
        {"$limit": APEX_RACE_PRIZE_COUNT},
    ]
    rows = await db.invites.aggregate(pipeline).to_list(length=APEX_RACE_PRIZE_COUNT)

    for r in rows:
        uid = r.get("_id")
        if not uid:
            continue
        ref = f"apex_race_bonus_{uid}"
        try:
            res = await _grant_chairs(
                db,
                user_id=uid,
                quantity=1,
                price_per_chair_usd=0.0,  # bonus, not a sale
                payment_ref=ref,
                invite_code=None,
            )
            if not res.get("idempotent_replay"):
                granted += 1
                granted_ids.append(uid)
        except Exception as e:
            logger.warning(f"[apex] race bonus grant failed for {uid}: {e}")

    # Mark bonuses awarded so a second click is a no-op. Only flip the flag
    # when at least one chair was actually granted — keeps the founder's
    # retry path open if the leaderboard query came back empty (e.g. before
    # any invites have been redeemed).
    if granted > 0:
        await db.platform_state.update_one(
            {"_id": "apex"},
            {"$set": {
                "race_bonuses_awarded": True,
                "race_bonuses_awarded_at": datetime.now(timezone.utc).isoformat(),
                "race_bonuses_count": granted,
            }},
        )
    await record_god_event(
        "system", "APEX_RACE_BONUSES_AWARDED", float(granted),
        meta={"winners": granted, "granted_ids": granted_ids[:10]},
    )
    return {
        "already_awarded": False,
        "winners": granted,
        "leaders": leaders[:granted],
    }


@router.post("/admin/apex/reset-race")
async def admin_reset_race(
    _: bool = Depends(verify_admin_cookie),
) -> Dict[str, Any]:
    """Reset the race window to NOW. Useful if the founder wants a clean
    countdown after marketing flips a switch."""
    db = get_database()
    s = await _state(db)
    if s.get("apex_unlocked"):
        raise HTTPException(
            400, "Cannot reset race after Apex has activated."
        )
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.platform_state.update_one(
        {"_id": "apex"},
        {"$set": {"race_started_at": now_iso}},
        upsert=True,
    )
    await record_god_event(
        "system", "APEX_RACE_RESET", 0, meta={"new_start": now_iso},
    )
    return {"ok": True, "race_started_at": now_iso}


# ────────────────────────────────────────────── Apex Pre-Sale Wishlist


class WishlistOptIn(BaseModel):
    email: Optional[str] = Field(default=None, max_length=200)
    chairs_wanted: int = Field(default=1, ge=1, le=100)


@router.post("/apex/wishlist")
async def join_wishlist(
    body: "WishlistOptIn", request: "Request",
) -> Dict[str, Any]:
    """Opt the current user into the Apex pre-sale list. Idempotent on
    user_id — second call updates `chairs_wanted` instead of creating a
    duplicate row.
    """
    user = await get_current_user(request)
    db = get_database()
    user_id = user.user_id if user else None

    # Anonymous opt-in still allowed if they provide an email; falls back
    # to a UUID-keyed record so the count is honest.
    record_key = user_id or (body.email or "").strip().lower()
    if not record_key:
        raise HTTPException(400, "Provide an email or sign in to join the list.")

    now_iso = datetime.now(timezone.utc).isoformat()
    doc = {
        "user_id": user_id,
        "email": (body.email or "").strip().lower() or None,
        "chairs_wanted": int(body.chairs_wanted),
        "joined_at": now_iso,
        "user_agent": request.headers.get("user-agent", "")[:200],
    }
    await db.apex_wishlist.update_one(
        {"key": record_key},
        {"$set": {"key": record_key, "updated_at": now_iso, **doc},
         "$setOnInsert": {"first_joined_at": now_iso}},
        upsert=True,
    )
    return {"ok": True, "chairs_wanted": body.chairs_wanted}


@router.get("/apex/wishlist/count")
async def wishlist_count() -> Dict[str, Any]:
    """Public count + total chairs reserved — drives social proof on the
    countdown banner."""
    db = get_database()
    pipeline = [
        {"$group": {
            "_id": None,
            "count": {"$sum": 1},
            "chairs_reserved": {"$sum": "$chairs_wanted"},
        }},
    ]
    rows = await db.apex_wishlist.aggregate(pipeline).to_list(length=1)
    if rows:
        return {
            "count": int(rows[0].get("count") or 0),
            "chairs_reserved": int(rows[0].get("chairs_reserved") or 0),
        }
    return {"count": 0, "chairs_reserved": 0}


@router.get("/admin/apex/wishlist")
async def admin_wishlist(
    limit: int = 200,
    _: bool = Depends(verify_admin_cookie),
) -> Dict[str, Any]:
    """Founder-facing dump of the wishlist for outreach / DM blasts."""
    db = get_database()
    limit = max(1, min(int(limit), 5000))
    rows = await db.apex_wishlist.find(
        {}, {"_id": 0},
    ).sort("first_joined_at", -1).to_list(length=limit)
    return {"count": len(rows), "rows": rows}

"""
Live Activity Ticker — derives a real-time feed of platform events
from existing collections without adding a dedicated event bus.

Reads recent docs from:
  • spectator_bonus_caps  → "✦ {user} hit a Vibe Check streak"
  • jftn_gifts            → "🎁 {gifter} gifted a room to {recipient}"
  • jftn_season_passes    → "👑 {user} grabbed a JFTN Season Pass"
  • chair_purchases       → "🪑 {user} claimed a Genius Chair"
  • coin_top_up_transactions → "💎 {user} loaded ₵{amount}"
  • lottery_tickets       → "🎟 {user} grabbed a DSG 6 ticket"
  • underground_battles   → "🎤 {battle} just went live"

Anonymizes usernames by initial + last char (e.g. "j…s") so we never
leak full handles on a public feed.

ENDPOINT:
  GET /api/live-activity/recent?limit=12 — last events, newest first
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, Query, Request

from utils.database import get_database, get_current_user

router = APIRouter()


def _anon(name: str | None) -> str:
    if not name:
        return "someone"
    n = name.strip()
    if len(n) <= 2:
        return f"{n[0]}…"
    return f"{n[0]}…{n[-1]}"


@router.get("/live-activity/recent")
async def recent_activity(limit: int = Query(default=12, ge=1, le=40)):
    db = get_database()
    since = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()
    events: List[Dict[str, Any]] = []

    async def _pull(coll: str, query: Dict[str, Any], shape) -> None:
        rows = await db[coll].find(query, {"_id": 0}).sort(
            "created_at", -1
        ).limit(8).to_list(8)
        for r in rows:
            try:
                evt = shape(r)
                if evt:
                    events.append(evt)
            except Exception:
                continue

    # Gifts
    await _pull("jftn_gifts", {"created_at": {"$gte": since}}, lambda r: {
        "ts": r.get("created_at"),
        "emoji": "🎁",
        "text": f"{_anon(r.get('gifter_name'))} gifted a JFTN room",
    })
    # Season passes
    await _pull("jftn_season_passes", {"issued_at_iso": {"$gte": since}}, lambda r: {
        "ts": r.get("issued_at_iso"),
        "emoji": "👑",
        "text": f"{_anon(r.get('user_id'))} grabbed a JFTN Season Pass",
    })
    # Coin top-ups
    await _pull("coin_top_up_transactions", {
        "created_at": {"$gte": since}, "status": "completed",
    }, lambda r: {
        "ts": r.get("created_at"),
        "emoji": "💎",
        "text": f"{_anon(r.get('user_id'))} loaded ₵{int(r.get('coins_credited') or 0):,}",
    })
    # Lottery tickets
    await _pull("lottery_tickets", {"created_at": {"$gte": since}}, lambda r: {
        "ts": r.get("created_at"),
        "emoji": "🎟",
        "text": f"{_anon(r.get('user_id'))} grabbed a DSG 6 ticket",
    })
    # Underground Live going live
    await _pull("underground_battles", {"status": "live"}, lambda r: {
        "ts": r.get("live_since") or r.get("starts_at_iso"),
        "emoji": "🎤",
        "text": f"{r.get('title')} just went live",
    })
    # Vibe Check resolved games (Integrity Protocol)
    await _pull("integrity_resolutions", {"resolved_at": {"$gte": since}}, lambda r: {
        "ts": r.get("resolved_at"),
        "emoji": "🛡",
        "text": f"Vibe Check settled {r.get('game_id') or 'a market'}",
    })

    # Sort newest first; cap to requested limit.
    events.sort(key=lambda e: e.get("ts") or "", reverse=True)
    return {"count": len(events[:limit]), "events": events[:limit]}


# ==================== ADMIN ACTIVITY PULSE ====================
#
# Same source data as the public ticker but UN-anonymized + with
# dollar amounts attached. Founder-only — surfaced as a card on
# /vibe-vault-admin so the founder can feel the platform breathe in
# real time.

@router.get("/live-activity/admin-pulse")
async def admin_pulse(
    http_request: Request,
    limit: int = Query(default=20, ge=1, le=100),
):
    user = await get_current_user(http_request)
    if not user or not (getattr(user, "is_admin", False) or getattr(user, "role", "") == "admin"):
        raise HTTPException(403, "Admin only")

    db = get_database()
    since = (datetime.now(timezone.utc) - timedelta(hours=72)).isoformat()
    events: List[Dict[str, Any]] = []

    async def _pull_admin(coll: str, query: Dict[str, Any], shape, sort_key: str = "created_at") -> None:
        rows = await db[coll].find(query, {"_id": 0}).sort(sort_key, -1).limit(15).to_list(15)
        for r in rows:
            try:
                evt = shape(r)
                if evt:
                    events.append(evt)
            except Exception:
                continue

    await _pull_admin("jftn_gifts", {"created_at": {"$gte": since}}, lambda r: {
        "ts": r.get("created_at"),
        "kind": "jftn_gift",
        "emoji": "🎁",
        "user": r.get("gifter_name") or r.get("gifter_id"),
        "recipient": r.get("recipient_id"),
        "amount_vibe": int(r.get("amount") or 0),
        "text": f"{r.get('gifter_name') or 'unknown'} gifted JFTN room → {r.get('recipient_id')} · ₵{int(r.get('amount') or 0):,}",
    })
    await _pull_admin("jftn_season_passes", {"issued_at_iso": {"$gte": since}}, lambda r: {
        "ts": r.get("issued_at_iso"),
        "kind": "season_pass",
        "emoji": "👑",
        "user": r.get("user_id"),
        "amount_usd": int(r.get("price_usd") or 0),
        "text": f"{r.get('user_id')} bought JFTN Season Pass · ${int(r.get('price_usd') or 0)}",
    }, sort_key="issued_at_iso")
    await _pull_admin("coin_top_up_transactions", {
        "created_at": {"$gte": since}, "status": "completed",
    }, lambda r: {
        "ts": r.get("created_at"),
        "kind": "topup",
        "emoji": "💎",
        "user": r.get("user_id"),
        "amount_vibe": int(r.get("coins_credited") or 0),
        "amount_usd": float(r.get("amount_usd") or 0),
        "text": f"{r.get('user_id')} loaded ₵{int(r.get('coins_credited') or 0):,} · ${float(r.get('amount_usd') or 0):.2f}",
    })
    await _pull_admin("lottery_tickets", {"created_at": {"$gte": since}}, lambda r: {
        "ts": r.get("created_at"),
        "kind": "lottery",
        "emoji": "🎟",
        "user": r.get("user_id"),
        "amount_vibe": int(r.get("price") or 0),
        "text": f"{r.get('user_id')} bought DSG 6 ticket · ₵{int(r.get('price') or 0):,}",
    })
    await _pull_admin("underground_battles", {"status": "live"}, lambda r: {
        "ts": r.get("live_since") or r.get("starts_at_iso"),
        "kind": "underground_live",
        "emoji": "🎤",
        "text": f"Underground Live · {r.get('title')} — pool ₵{int(r.get('pool_vibe') or 0):,}",
    }, sort_key="starts_at_iso")
    await _pull_admin("integrity_resolutions", {"resolved_at": {"$gte": since}}, lambda r: {
        "ts": r.get("resolved_at"),
        "kind": "vibe_check",
        "emoji": "🛡",
        "text": f"Vibe Check settled · game {r.get('game_id')} → winner {r.get('winning_choice')}",
    }, sort_key="resolved_at")
    await _pull_admin("free_spectator_bets", {"created_at": {"$gte": since}}, lambda r: {
        "ts": r.get("created_at"),
        "kind": "spectator_bet",
        "emoji": "👀",
        "user": r.get("user_id"),
        "text": f"{r.get('user_id')} free-staked on {r.get('market_id')} · pick {r.get('choice')}",
    })
    await _pull_admin("receipt_submissions", {
        "submitted_at_iso": {"$gte": since}, "status": "verified",
    }, lambda r: {
        "ts": r.get("submitted_at_iso"),
        "kind": "receipt",
        "emoji": "🧾",
        "user": r.get("user_id"),
        "amount_usd": float(r.get("amount_usd") or 0),
        "amount_vibe": int(r.get("bonus_vibe_credited") or 0),
        "text": f"{r.get('user_id')} verified ${float(r.get('amount_usd') or 0):.2f} receipt → +₵{int(r.get('bonus_vibe_credited') or 0)} bonus",
    }, sort_key="submitted_at_iso")

    events.sort(key=lambda e: e.get("ts") or "", reverse=True)
    sliced = events[:limit]

    # Aggregate totals for the pulse summary card.
    totals = {
        "events_72h": len(events),
        "gross_vibe_72h": sum(e.get("amount_vibe", 0) for e in events),
        "gross_usd_72h": round(sum(e.get("amount_usd", 0) for e in events), 2),
        "topups_72h": sum(1 for e in events if e.get("kind") == "topup"),
        "season_passes_72h": sum(1 for e in events if e.get("kind") == "season_pass"),
        "jftn_gifts_72h": sum(1 for e in events if e.get("kind") == "jftn_gift"),
    }
    return {"count": len(sliced), "events": sliced, "totals": totals}

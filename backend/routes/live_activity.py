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

from fastapi import APIRouter, Query

from utils.database import get_database

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

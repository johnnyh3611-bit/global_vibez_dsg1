"""
Event-driven gamification — time-limited contests + rewarded social actions.

Collections:
  vibe_live_events       — contest definitions
  vibe_live_entries      — paid entries / boosts
  vibe_rewarded_actions  — idempotent social-task credits
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

# Catalog of recurring / seeded events (ids are stable).
EVENT_CATALOG: Dict[str, Dict[str, Any]] = {
    "weekly_top_vibe": {
        "event_id": "weekly_top_vibe",
        "title": "Weekly Top-Vibe",
        "kind": "leaderboard",
        "entry_coins": 250,
        "boost_coins": 100,
        "description": "Climb the weekly vibe board — enter or boost with ₵.",
        "duration_days": 7,
    },
    "grand_dsg_sweepstakes": {
        "event_id": "grand_dsg_sweepstakes",
        "title": "Grand DSG Sweepstakes",
        "kind": "sweepstakes",
        "entry_coins": 500,
        "boost_coins": 200,
        "description": "Limited seat sweepstakes for Founding Member prizes.",
        "duration_days": 14,
    },
}

# Rewarded actions — small ₵ grants (anti-farm via daily caps + event keys).
REWARDED_ACTIONS: Dict[str, Dict[str, Any]] = {
    "invite_friend": {
        "action_id": "invite_friend",
        "label": "Invite a friend",
        "coins": 100,
        "daily_cap": 5,
        "description": "Earn ₵ when a friend joins via your referral.",
    },
    "complete_profile": {
        "action_id": "complete_profile",
        "label": "Complete your profile",
        "coins": 150,
        "daily_cap": 1,
        "once": True,
        "description": "One-time bonus for finishing your profile.",
    },
    "partner_spot_visit": {
        "action_id": "partner_spot_visit",
        "label": "Visit a Sponsored Spot",
        "coins": 50,
        "daily_cap": 3,
        "description": "Engage partner venues — drives traffic into game rooms.",
    },
    "share_room": {
        "action_id": "share_room",
        "label": "Share a room",
        "coins": 40,
        "daily_cap": 5,
        "description": "Share a live room link with your network.",
    },
}


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def utc_now_iso() -> str:
    return utc_now().isoformat()


def event_window(event_def: Dict[str, Any]) -> Dict[str, str]:
    days = int(event_def.get("duration_days") or 7)
    start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
    # Align weekly to Monday UTC
    if event_def["event_id"] == "weekly_top_vibe":
        start = start - timedelta(days=start.weekday())
    end = start + timedelta(days=days)
    return {"starts_at": start.isoformat(), "ends_at": end.isoformat()}


async def ensure_active_events(db: Any) -> List[Dict[str, Any]]:
    """Upsert catalog events for the current window."""
    out: List[Dict[str, Any]] = []
    for eid, base in EVENT_CATALOG.items():
        window = event_window(base)
        doc = {
            **base,
            **window,
            "status": "active",
            "prize_pool_coins": 0,
            "entries": 0,
            "updated_at": utc_now_iso(),
        }
        await db.vibe_live_events.update_one(
            {"event_id": eid, "starts_at": window["starts_at"]},
            {"$set": doc, "$setOnInsert": {"created_at": utc_now_iso()}},
            upsert=True,
        )
        row = await db.vibe_live_events.find_one(
            {"event_id": eid, "starts_at": window["starts_at"]}, {"_id": 0}
        )
        if row:
            out.append(row)
    return out

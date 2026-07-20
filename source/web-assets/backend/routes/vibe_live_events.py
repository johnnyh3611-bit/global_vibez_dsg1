"""
Live events + rewarded actions (gamification revenue layer).

  GET  /vibe-events                 — active contests
  POST /vibe-events/{id}/enter      — pay ₵ to enter
  POST /vibe-events/{id}/boost      — pay ₵ to boost standing
  GET  /vibe-events/rewarded        — action catalog
  POST /vibe-events/rewarded/{id}   — claim social-task ₵
"""
from __future__ import annotations

import uuid
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from utils.database import get_current_user, get_database
from services.vibe_live_events import (
    REWARDED_ACTIONS,
    ensure_active_events,
    event_window,
    EVENT_CATALOG,
    utc_now_iso,
)

router = APIRouter(tags=["vibe-events"])


class EnterPayload(BaseModel):
    note: Optional[str] = None


async def _debit(db, user_id: str, coins: int) -> str:
    from utils.wallet_fields import pick_wallet_field_for_debit  # noqa: PLC0415

    u = await db.users.find_one(
        {"user_id": user_id},
        {"_id": 0, "token_balance": 1, "credits_balance": 1},
    ) or {}
    try:
        field, _ = pick_wallet_field_for_debit(u, coins)
    except ValueError:
        raise HTTPException(402, f"Need ₵{coins:,} to continue")
    await db.users.update_one({"user_id": user_id}, {"$inc": {field: -coins}})
    return field


async def _credit(db, user_id: str, coins: int) -> str:
    from utils.wallet_fields import pick_wallet_field_for_credit  # noqa: PLC0415

    u = await db.users.find_one(
        {"user_id": user_id},
        {"_id": 0, "token_balance": 1, "credits_balance": 1},
    ) or {}
    field = pick_wallet_field_for_credit(u)
    await db.users.update_one({"user_id": user_id}, {"$inc": {field: coins}})
    return field


@router.get("/vibe-events")
async def list_events() -> Dict[str, Any]:
    db = get_database()
    events = await ensure_active_events(db)
    return {"events": events, "count": len(events)}


@router.post("/vibe-events/{event_id}/enter")
async def enter_event(
    event_id: str, payload: EnterPayload, http_request: Request
) -> Dict[str, Any]:
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    base = EVENT_CATALOG.get(event_id)
    if not base:
        raise HTTPException(404, "Unknown event")
    db = get_database()
    await ensure_active_events(db)
    window = event_window(base)
    existing = await db.vibe_live_entries.find_one(
        {
            "event_id": event_id,
            "user_id": user.user_id,
            "starts_at": window["starts_at"],
            "kind": "entry",
        },
        {"_id": 0},
    )
    if existing:
        return {"ok": True, "already": True, "entry": existing}

    coins = int(base["entry_coins"])
    await _debit(db, user.user_id, coins)
    entry = {
        "entry_id": f"ve_{uuid.uuid4().hex[:12]}",
        "event_id": event_id,
        "user_id": user.user_id,
        "kind": "entry",
        "coins": coins,
        "boost_score": 1,
        "starts_at": window["starts_at"],
        "note": payload.note,
        "at": utc_now_iso(),
    }
    await db.vibe_live_entries.insert_one(dict(entry))
    await db.vibe_live_events.update_one(
        {"event_id": event_id, "starts_at": window["starts_at"]},
        {"$inc": {"entries": 1, "prize_pool_coins": coins}},
    )
    return {"ok": True, "entry": entry, "prize_pool_added": coins}


@router.post("/vibe-events/{event_id}/boost")
async def boost_event(event_id: str, http_request: Request) -> Dict[str, Any]:
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    base = EVENT_CATALOG.get(event_id)
    if not base:
        raise HTTPException(404, "Unknown event")
    db = get_database()
    window = event_window(base)
    coins = int(base["boost_coins"])
    await _debit(db, user.user_id, coins)
    boost = {
        "entry_id": f"vb_{uuid.uuid4().hex[:12]}",
        "event_id": event_id,
        "user_id": user.user_id,
        "kind": "boost",
        "coins": coins,
        "boost_score": 1,
        "starts_at": window["starts_at"],
        "at": utc_now_iso(),
    }
    await db.vibe_live_entries.insert_one(dict(boost))
    await db.vibe_live_entries.update_one(
        {
            "event_id": event_id,
            "user_id": user.user_id,
            "starts_at": window["starts_at"],
            "kind": "entry",
        },
        {"$inc": {"boost_score": 1}},
    )
    await db.vibe_live_events.update_one(
        {"event_id": event_id, "starts_at": window["starts_at"]},
        {"$inc": {"prize_pool_coins": coins}},
    )
    return {"ok": True, "boost": boost}


@router.get("/vibe-events/rewarded")
async def rewarded_catalog() -> Dict[str, Any]:
    return {"actions": list(REWARDED_ACTIONS.values())}


@router.post("/vibe-events/rewarded/{action_id}")
async def claim_rewarded(
    action_id: str, http_request: Request, ref: Optional[str] = None
) -> Dict[str, Any]:
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    action = REWARDED_ACTIONS.get(action_id)
    if not action:
        raise HTTPException(404, "Unknown action")
    db = get_database()
    day = utc_now_iso()[:10]
    if action.get("once"):
        event_key = f"reward::{action_id}::{user.user_id}"
    else:
        event_key = f"reward::{action_id}::{user.user_id}::{day}::{ref or 'default'}"

    existing = await db.vibe_rewarded_actions.find_one(
        {"event_key": event_key}, {"_id": 0}
    )
    if existing:
        return {"ok": True, "already": True, "coins": 0}

    # Daily cap
    if not action.get("once"):
        count = await db.vibe_rewarded_actions.count_documents(
            {
                "user_id": user.user_id,
                "action_id": action_id,
                "day": day,
            }
        )
        if count >= int(action.get("daily_cap") or 1):
            raise HTTPException(429, "Daily cap reached for this action")

    coins = int(action["coins"])
    await _credit(db, user.user_id, coins)
    row = {
        "event_key": event_key,
        "action_id": action_id,
        "user_id": user.user_id,
        "coins": coins,
        "day": day,
        "ref": ref,
        "at": utc_now_iso(),
    }
    await db.vibe_rewarded_actions.insert_one(dict(row))
    return {"ok": True, "coins": coins, "action": action["label"]}

"""
User preferences — small per-user persisted-state endpoints.

Currently:
  • table_style: cosmetic preference for card-game backgrounds
    (celestial / neon / cherry / midnight / royal). Default = celestial.
  • wallet_memo: free-text personal note shown on the /wallet page.
    Survives device hand-off so a user can jot a SOL deposit memo on
    desktop and read it back on mobile.

Both fields live on `users.preferences.{key}` so the rest of the app
(games, wallet UI) can light them up via /api/users/me.
"""
from __future__ import annotations

from typing import Any, Dict
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from utils.database import get_database, get_current_user

router = APIRouter()


# ────────────────────────────────────────────── Constants

TABLE_STYLES = ["celestial", "neon", "cherry", "midnight", "royal"]
WALLET_MEMO_MAX = 500


def _spades_rulesets() -> list:
    """Source of truth for valid Spades ruleset IDs comes from
    utils.spades_game so adding a new ruleset is a single-file change.
    Lazy-imported to avoid circular import at module load."""
    from utils.spades_game import RULESETS  # noqa: PLC0415
    return list(RULESETS.keys())


# ────────────────────────────────────────────── Models


class TableStyleUpdate(BaseModel):
    style: str = Field(..., description="One of TABLE_STYLES")


class WalletMemoUpdate(BaseModel):
    # No max_length here — handler truncates to WALLET_MEMO_MAX so callers
    # never get a 422 surprise. Spec says "truncate", not "reject".
    memo: str = Field(default="")


class SpadesRulesetUpdate(BaseModel):
    ruleset: str = Field(..., description="One of SPADES_RULESETS")


# ────────────────────────────────────────────── Helpers


async def _user_or_401(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    return user


async def _read_pref(db, user_id: str, key: str, default):
    rec = await db.users.find_one(
        {"user_id": user_id},
        {"_id": 0, f"preferences.{key}": 1},
    ) or {}
    return (rec.get("preferences") or {}).get(key, default)


async def _write_pref(db, user_id: str, key: str, value) -> None:
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            f"preferences.{key}": value,
            "preferences.updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )


# ────────────────────────────────────────────── Table style


@router.get("/preferences/table-style")
async def get_table_style(request: Request) -> Dict[str, Any]:
    user = await _user_or_401(request)
    db = get_database()
    style = await _read_pref(db, user.user_id, "table_style", "celestial")
    return {"style": style, "available": TABLE_STYLES}


@router.put("/preferences/table-style")
async def set_table_style(
    body: TableStyleUpdate, request: Request,
) -> Dict[str, Any]:
    user = await _user_or_401(request)
    if body.style not in TABLE_STYLES:
        raise HTTPException(
            400, f"Unknown style. Choose one of: {', '.join(TABLE_STYLES)}",
        )
    db = get_database()
    await _write_pref(db, user.user_id, "table_style", body.style)
    return {"ok": True, "style": body.style}


# ────────────────────────────────────────────── Wallet memo


@router.get("/preferences/wallet-memo")
async def get_wallet_memo(request: Request) -> Dict[str, Any]:
    user = await _user_or_401(request)
    db = get_database()
    memo = await _read_pref(db, user.user_id, "wallet_memo", "")
    return {"memo": memo, "max_length": WALLET_MEMO_MAX}


@router.put("/preferences/wallet-memo")
async def set_wallet_memo(
    body: WalletMemoUpdate, request: Request,
) -> Dict[str, Any]:
    user = await _user_or_401(request)
    db = get_database()
    # Pydantic already enforces the max length; keep an explicit guard for
    # raw integrations.
    memo = (body.memo or "")[:WALLET_MEMO_MAX]
    await _write_pref(db, user.user_id, "wallet_memo", memo)
    return {"ok": True, "memo": memo, "saved_len": len(memo)}


# ────────────────────────────────────────────── Spades default ruleset


@router.get("/preferences/spades-ruleset")
async def get_spades_ruleset(request: Request) -> Dict[str, Any]:
    user = await _user_or_401(request)
    db = get_database()
    ruleset = await _read_pref(db, user.user_id, "spades_ruleset", "CLASSIC")
    return {"ruleset": ruleset, "available": _spades_rulesets()}


@router.put("/preferences/spades-ruleset")
async def set_spades_ruleset(
    body: SpadesRulesetUpdate, request: Request,
) -> Dict[str, Any]:
    user = await _user_or_401(request)
    valid = _spades_rulesets()
    if body.ruleset not in valid:
        raise HTTPException(
            400, f"Unknown ruleset. Choose one of: {', '.join(valid)}",
        )
    db = get_database()
    await _write_pref(db, user.user_id, "spades_ruleset", body.ruleset)
    return {"ok": True, "ruleset": body.ruleset}

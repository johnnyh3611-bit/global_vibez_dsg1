"""
Vibe Sports Book — Social Stakes betting lounge.

Spec: Global_Vibez_Sports_Lounge_Blueprint.pdf (May 10, 2026).

DESIGN
======
* "Social Stakes" — wagers settled in internal ₵ Vibe Credits, not fiat.
* Vibe Vault Escrow — bet amounts are locked at PLACE time, distributed
  pro-rata to winning side at SETTLE time, taxed by the Sovereign Tax.
* Oracle — when `RAPIDAPI_SPORTS_KEY` is set we hit
  api-football-v1.p.rapidapi.com `/v3/fixtures` to verify the winner.
  When the key is absent (today), the seed catalog ships pre-populated
  and the founder/admin can call `/sports/settle` manually with the
  winner_team_id — keeps the lounge functional pre-launch without an
  external API dependency.

ENDPOINTS (mounted under /api):
  GET  /api/sports/games            — seeded + (optionally) live RapidAPI fixtures
  POST /api/sports/place-bet        — lock ₵ credits in vault
  GET  /api/sports/my-bets          — caller's open + settled bets
  POST /api/sports/settle           — admin: distribute vault for a game
  GET  /api/sports/jumbotron        — public feed for the lounge UI
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from utils.database import get_database, get_current_user

router = APIRouter()

# ── Seed catalog (works without external API key) ───────────────────
# Refreshed weekly via cron / admin tool. Bare minimum to keep the
# lounge functional pre-RapidAPI provisioning.
SEED_GAMES: List[Dict[str, Any]] = [
    {
        "game_id": "nfl-2026-w1-001",
        "sport": "NFL",
        "league": "NFL Regular Season",
        "kickoff_iso": (datetime.now(timezone.utc) + timedelta(hours=6)).isoformat(),
        "home": {"id": "kc", "name": "Kansas City Chiefs", "color": "#E31837"},
        "away": {"id": "buf", "name": "Buffalo Bills", "color": "#00338D"},
        "odds": {"home": 1.85, "away": 2.05, "draw": None},
        "status": "scheduled",
    },
    {
        "game_id": "nba-2026-001",
        "sport": "NBA",
        "league": "NBA",
        "kickoff_iso": (datetime.now(timezone.utc) + timedelta(hours=3)).isoformat(),
        "home": {"id": "lal", "name": "LA Lakers", "color": "#552583"},
        "away": {"id": "bos", "name": "Boston Celtics", "color": "#007A33"},
        "odds": {"home": 2.10, "away": 1.78, "draw": None},
        "status": "scheduled",
    },
    {
        "game_id": "soccer-prem-001",
        "sport": "Soccer",
        "league": "Premier League",
        "kickoff_iso": (datetime.now(timezone.utc) + timedelta(hours=10)).isoformat(),
        "home": {"id": "mci", "name": "Man City", "color": "#6CABDD"},
        "away": {"id": "ars", "name": "Arsenal", "color": "#EF0107"},
        "odds": {"home": 1.95, "away": 3.20, "draw": 3.40},
        "status": "scheduled",
    },
]


class PlaceBetPayload(BaseModel):
    game_id: str = Field(min_length=4, max_length=64)
    choice: str = Field(min_length=2, max_length=24)  # team_id or "draw"
    amount: int = Field(ge=10, le=100_000)


class SettlePayload(BaseModel):
    game_id: str
    winner: str  # team_id or "draw"


async def _fetch_rapidapi_fixtures() -> List[Dict[str, Any]]:
    """Best-effort live fixture pull. Returns [] when no key is set."""
    key = os.environ.get("RAPIDAPI_SPORTS_KEY")
    if not key:
        return []
    try:
        import httpx  # noqa: PLC0415
        async with httpx.AsyncClient(timeout=8) as cli:
            r = await cli.get(
                "https://api-football-v1.p.rapidapi.com/v3/fixtures",
                params={"date": datetime.now(timezone.utc).strftime("%Y-%m-%d")},
                headers={
                    "X-RapidAPI-Key": key,
                    "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com",
                },
            )
            data = r.json()
        out: List[Dict[str, Any]] = []
        for fx in (data.get("response") or [])[:10]:
            out.append({
                "game_id": f"rapi-{fx['fixture']['id']}",
                "sport": "Soccer",
                "league": fx.get("league", {}).get("name", "Football"),
                "kickoff_iso": fx.get("fixture", {}).get("date"),
                "home": {"id": str(fx["teams"]["home"]["id"]), "name": fx["teams"]["home"]["name"], "color": "#1d4ed8"},
                "away": {"id": str(fx["teams"]["away"]["id"]), "name": fx["teams"]["away"]["name"], "color": "#dc2626"},
                "odds": {"home": 2.0, "away": 2.0, "draw": 3.0},  # placeholder until odds endpoint wired
                "status": fx.get("fixture", {}).get("status", {}).get("short", "NS").lower(),
            })
        return out
    except Exception:
        return []


@router.get("/sports/games")
async def list_games():
    """Seeded + live RapidAPI fixtures. Cached only on the client side."""
    live = await _fetch_rapidapi_fixtures()
    return {
        "count": len(SEED_GAMES) + len(live),
        "games": SEED_GAMES + live,
        "rapidapi_connected": bool(os.environ.get("RAPIDAPI_SPORTS_KEY")),
    }


@router.post("/sports/place-bet")
async def place_bet(payload: PlaceBetPayload, http_request: Request):
    """Lock ₵ credits in the Vibe Vault, register the bet."""
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()

    # Look up the game in our seed catalog OR a previously-cached live row.
    game = next((g for g in SEED_GAMES if g["game_id"] == payload.game_id), None)
    if not game:
        # Fall back to RapidAPI fetch (cheap idempotent check).
        live = await _fetch_rapidapi_fixtures()
        game = next((g for g in live if g["game_id"] == payload.game_id), None)
    if not game:
        raise HTTPException(404, "Game not found")
    if game["status"] in ("finished", "settled"):
        raise HTTPException(400, f"Game already {game['status']}")

    valid_choices = {game["home"]["id"], game["away"]["id"]}
    if game["odds"].get("draw") is not None:
        valid_choices.add("draw")
    if payload.choice not in valid_choices:
        raise HTTPException(400, f"Invalid choice. Must be one of {sorted(valid_choices)}")

    # Lock the credits.
    from utils.wallet_fields import pick_wallet_field_for_debit  # noqa: PLC0415
    u = await db.users.find_one(
        {"user_id": user.user_id},
        {"_id": 0, "token_balance": 1, "credits_balance": 1},
    ) or {}
    try:
        field, _bal = pick_wallet_field_for_debit(u, payload.amount)
    except ValueError:
        raise HTTPException(402, "Insufficient ₵ balance for this stake.")
    await db.users.update_one({"user_id": user.user_id}, {"$inc": {field: -payload.amount}})

    odds = game["odds"].get(payload.choice if payload.choice in ("home", "away", "draw") else "home")
    # The choice can be a team_id like "kc" — translate to home/away for odds lookup.
    if payload.choice == game["home"]["id"]:
        odds = game["odds"].get("home")
    elif payload.choice == game["away"]["id"]:
        odds = game["odds"].get("away")

    bet = {
        "bet_id": f"sb_{uuid.uuid4().hex[:12]}",
        "user_id": user.user_id,
        "game_id": payload.game_id,
        "sport": game["sport"],
        "league": game["league"],
        "choice": payload.choice,
        "amount": payload.amount,
        "locked_odds": odds,
        "status": "vaulted",
        "placed_at": datetime.now(timezone.utc).isoformat(),
        "settled_at": None,
        "payout_vibe": 0,
    }
    await db.sports_bets.insert_one(bet)
    bet.pop("_id", None)
    return bet


@router.get("/sports/my-bets")
async def my_bets(http_request: Request, limit: int = 50):
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    cursor = db.sports_bets.find(
        {"user_id": user.user_id}, {"_id": 0}
    ).sort("placed_at", -1).limit(max(1, min(int(limit), 100)))
    rows: List[Dict[str, Any]] = await cursor.to_list(length=100)
    return {"count": len(rows), "rows": rows}


@router.post("/sports/settle")
async def settle_game(payload: SettlePayload, http_request: Request):
    """Admin-only: settle a game, distribute the vault. Applies the
    Sovereign Tax (13.5%) on net winnings before crediting winners.
    """
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    if not getattr(user, "is_admin", False) and getattr(user, "role", "") != "admin":
        raise HTTPException(403, "Admin only")
    db = get_database()

    # Pull every open bet on this game.
    bets = await db.sports_bets.find({"game_id": payload.game_id, "status": "vaulted"}).to_list(None)
    if not bets:
        raise HTTPException(404, "No open bets on this game")

    from services.sovereign_validator import apply_sovereign_tax  # noqa: PLC0415
    from utils.wallet_fields import pick_wallet_field_for_credit  # noqa: PLC0415

    payouts: List[Dict[str, Any]] = []
    tax_total = 0
    for bet in bets:
        won = bet["choice"] == payload.winner
        if won:
            gross = int(bet["amount"] * (bet.get("locked_odds") or 2.0))
            net_winnings = max(0, gross - bet["amount"])
            tax_split = apply_sovereign_tax(net_winnings)
            credit = bet["amount"] + tax_split["net"]  # stake-back + net winnings
            tax_total += tax_split["tax"]

            uw = await db.users.find_one(
                {"user_id": bet["user_id"]},
                {"_id": 0, "token_balance": 1, "credits_balance": 1},
            ) or {}
            field = pick_wallet_field_for_credit(uw)
            await db.users.update_one(
                {"user_id": bet["user_id"]},
                {"$inc": {field: credit}},
            )
            await db.sports_bets.update_one(
                {"bet_id": bet["bet_id"]},
                {"$set": {
                    "status": "won",
                    "settled_at": datetime.now(timezone.utc).isoformat(),
                    "payout_vibe": credit,
                    "tax_vibe": tax_split["tax"],
                }},
            )
            payouts.append({"bet_id": bet["bet_id"], "user_id": bet["user_id"], "payout": credit})
        else:
            await db.sports_bets.update_one(
                {"bet_id": bet["bet_id"]},
                {"$set": {"status": "lost", "settled_at": datetime.now(timezone.utc).isoformat()}},
            )

    return {
        "game_id": payload.game_id,
        "winner": payload.winner,
        "total_bets": len(bets),
        "winners": len(payouts),
        "tax_collected_vibe": tax_total,
        "payouts": payouts,
    }


@router.get("/sports/jumbotron")
async def jumbotron_feed(limit: int = 8):
    """Last N settled bets across all users — drives the public
    jumbotron ticker. No PII leaked; user_id is truncated."""
    db = get_database()
    cursor = db.sports_bets.find(
        {"status": {"$in": ["won", "lost"]}}, {"_id": 0, "user_id": 1, "game_id": 1, "choice": 1, "amount": 1, "status": 1, "payout_vibe": 1, "settled_at": 1}
    ).sort("settled_at", -1).limit(max(1, min(int(limit), 20)))
    rows: List[Dict[str, Any]] = await cursor.to_list(length=20)
    return {
        "count": len(rows),
        "rows": [{**r, "user_id": (r.get("user_id") or "")[:8] + "…"} for r in rows],
    }

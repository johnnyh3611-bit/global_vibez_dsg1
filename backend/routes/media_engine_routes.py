"""
Master Media Engine — public + admin API surface.

All endpoints under /api/media (public) and /api/admin/media (founder-only).
Every monetary value in coins (₵). No USD in any payload.
"""
from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, Depends, Query
from pydantic import BaseModel, Field

from config import db
from services.media_engine import (
    distribute_weekly_chart_bonus,
    enqueue_track,
    gas_out,
    get_artist_balance,
    get_room_queue,
    list_audio_unlock_nodes,
    list_top_tracks,
    record_transaction,
    upsert_track,
    TXN_KINDS,
)
from utils.admin_guard import require_admin
from utils.auth_dependencies import get_current_user_from_session

router = APIRouter(prefix="/media", tags=["media-engine"])
admin_router = APIRouter(prefix="/admin/media", tags=["admin-media-engine"])


# ──────────────────────── Public — Tracks / Queue ────────────────

@router.get("/discovery/unlock-nodes")
async def discovery_unlock_nodes() -> Dict[str, Any]:
    """Anti-payola — surface the 3 lowest-momentum active tracks."""
    rows = await list_audio_unlock_nodes(db, limit=3)
    return {"rows": rows, "count": len(rows)}


@router.get("/charts/weekly")
async def weekly_chart_top(limit: int = Query(default=50, ge=1, le=100)
                           ) -> Dict[str, Any]:
    rows = await list_top_tracks(db, limit=limit)
    return {"rows": rows, "count": len(rows)}


@router.get("/rooms/{room_id}/queue")
async def room_queue(room_id: str) -> Dict[str, Any]:
    rows = await get_room_queue(db, room_id)
    return {"room_id": room_id, "queue": rows, "count": len(rows)}


class EnqueueRequest(BaseModel):
    track_id: str = Field(..., min_length=4, max_length=64)


@router.post("/rooms/{room_id}/queue")
async def room_queue_add(
    room_id: str,
    body: EnqueueRequest,
    current_user=Depends(get_current_user_from_session),
) -> Dict[str, Any]:
    return await enqueue_track(
        db, room_id=room_id, track_id=body.track_id,
        user_id=current_user["user_id"],
    )


# ──────────────────────── Public — Transactions ──────────────────

class TransactionRequest(BaseModel):
    track_id: str = Field(..., min_length=4, max_length=64)
    room_id: Optional[str] = Field(default=None, max_length=80)
    coins: int = Field(..., gt=0, le=100_000_000)


@router.post("/tip")
async def transact_tip(
    body: TransactionRequest,
    current_user=Depends(get_current_user_from_session),
) -> Dict[str, Any]:
    return await record_transaction(
        db, user_id=current_user["user_id"],
        track_id=body.track_id, room_id=body.room_id,
        txn_kind="ROOM_TIP", coins_spent=body.coins,
    )


@router.post("/vote-boost")
async def transact_vote_boost(
    body: TransactionRequest,
    current_user=Depends(get_current_user_from_session),
) -> Dict[str, Any]:
    return await record_transaction(
        db, user_id=current_user["user_id"],
        track_id=body.track_id, room_id=body.room_id,
        txn_kind="QUEUE_BOOST", coins_spent=body.coins,
    )


@router.post("/stream-unlock")
async def transact_stream_unlock(
    body: TransactionRequest,
    current_user=Depends(get_current_user_from_session),
) -> Dict[str, Any]:
    return await record_transaction(
        db, user_id=current_user["user_id"],
        track_id=body.track_id, room_id=body.room_id,
        txn_kind="STREAM_UNLOCK", coins_spent=body.coins,
    )


@router.post("/visual-gift")
async def transact_visual_gift(
    body: TransactionRequest,
    current_user=Depends(get_current_user_from_session),
) -> Dict[str, Any]:
    return await record_transaction(
        db, user_id=current_user["user_id"],
        track_id=body.track_id, room_id=body.room_id,
        txn_kind="VISUAL_GIFT", coins_spent=body.coins,
    )


# ──────────────────────── Public — Artist self-serve ─────────────

@router.get("/artist/me/balance")
async def artist_balance_self(
    current_user=Depends(get_current_user_from_session),
) -> Dict[str, Any]:
    # An artist's ``artist_id`` IS their ``user_id`` — we keep them
    # 1:1 unless/until labels are introduced.
    return await get_artist_balance(db, current_user["user_id"])


@router.get("/artist/me/transactions")
async def artist_transactions_self(
    limit: int = Query(default=50, ge=1, le=200),
    current_user=Depends(get_current_user_from_session),
) -> Dict[str, Any]:
    """Recent fan→artist transactions for the calling artist.
    Used by the creator dashboard ledger view."""
    cursor = (db.music_transactions
              .find({"artist_id": current_user["user_id"]}, {"_id": 0})
              .sort("at", -1)
              .limit(limit))
    rows = [r async for r in cursor]
    return {"rows": rows, "count": len(rows)}


@router.get("/artist/me/tracks")
async def artist_tracks_self(
    current_user=Depends(get_current_user_from_session),
) -> Dict[str, Any]:
    """The calling artist's own track catalog (descending by chart points)."""
    cursor = (db.dsg_tracks
              .find({"artist_id": current_user["user_id"]}, {"_id": 0})
              .sort([("lifetime_chart_points", -1)])
              .limit(50))
    rows = [r async for r in cursor]
    return {"rows": rows, "count": len(rows)}


class GasOutRequest(BaseModel):
    coins: int = Field(..., gt=0, le=1_000_000_000)
    solana_wallet: str = Field(..., min_length=32, max_length=64)


@router.post("/artist/me/gas-out")
async def artist_gas_out_self(
    body: GasOutRequest,
    current_user=Depends(get_current_user_from_session),
) -> Dict[str, Any]:
    return await gas_out(
        db, artist_id=current_user["user_id"],
        coins=body.coins, solana_wallet=body.solana_wallet,
    )


# ──────────────────────── Admin — Catalog + Bonus ────────────────

class UpsertTrackRequest(BaseModel):
    artist_id: str = Field(..., min_length=3, max_length=64)
    artist_name: str = Field(..., min_length=1, max_length=120)
    track_title: str = Field(..., min_length=1, max_length=160)
    audio_url: str = Field(..., min_length=4, max_length=800)
    cover_art_url: Optional[str] = Field(default=None, max_length=800)
    track_id: Optional[str] = Field(default=None, max_length=64)


@admin_router.post("/tracks")
async def admin_upsert_track(
    body: UpsertTrackRequest,
    admin=Depends(require_admin),
) -> Dict[str, Any]:
    track = await upsert_track(
        db, artist_id=body.artist_id, artist_name=body.artist_name,
        track_title=body.track_title, audio_url=body.audio_url,
        cover_art_url=body.cover_art_url, track_id=body.track_id,
    )
    return {"ok": True, "track": track}


@admin_router.post("/distribute-weekly-chart-bonus")
async def admin_distribute_chart_bonus(
    top_n: int = Query(default=3, ge=1, le=10),
    bonus_pct: float = Query(default=0.05, gt=0, le=0.25),
    admin=Depends(require_admin),
) -> Dict[str, Any]:
    return await distribute_weekly_chart_bonus(
        db, top_n=top_n, bonus_pct=bonus_pct,
    )


@admin_router.get("/transactions")
async def admin_recent_transactions(
    limit: int = Query(default=50, ge=1, le=500),
    admin=Depends(require_admin),
) -> Dict[str, Any]:
    cursor = (db.music_transactions
              .find({}, {"_id": 0})
              .sort("at", -1)
              .limit(limit))
    rows = [r async for r in cursor]
    return {"rows": rows, "count": len(rows), "split_rule": "80/15/5"}


@admin_router.get("/constants")
async def admin_constants(admin=Depends(require_admin)) -> Dict[str, Any]:
    """Surface the contract for QA + the founder dashboard."""
    from services.media_engine import (
        ARTIST_PCT, TREASURY_PCT, TOURNAMENT_PCT, GAS_OUT_FEE_PCT,
        WAGER_CAPS_COINS,
    )
    return {
        "split": {
            "artist_pct": ARTIST_PCT,
            "treasury_pct": TREASURY_PCT,
            "tournament_pct": TOURNAMENT_PCT,
            "burn_pct": 0.0,
        },
        "gas_out_fee_pct": GAS_OUT_FEE_PCT,
        "gas_out_fee_destination": "dsg_spl_burn",
        "wager_caps_coins": WAGER_CAPS_COINS,
        "transaction_kinds": sorted(TXN_KINDS),
    }

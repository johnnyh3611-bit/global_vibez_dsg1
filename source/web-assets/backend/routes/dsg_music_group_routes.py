"""DSG Music Group routes — Rights Ledger + Collaborator Splits.

Mounts under `/api/music-group/*` (artist-side) + `/api/admin/music-group/*`
(admin audit). Composes WITH the existing Master Media Engine —
the 80/15/5 platform split is unchanged; this module only governs
how the 80 % artist-collective slice is further sub-divided.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from config import db
from services.dsg_music_group import (
    set_track_rights, get_track_rights, check_can_play,
    set_collaborator_splits, get_collaborator_splits,
    disburse_collective_royalty, list_recent_payouts,
    BPS_TOTAL, MAX_COLLABORATORS_PER_TRACK, ARTIST_COLLECTIVE_PCT,
)
from utils.admin_guard import require_admin
from utils.auth_dependencies import get_current_user_from_session

router = APIRouter(prefix="/music-group", tags=["dsg-music-group"])
admin_router = APIRouter(prefix="/admin/music-group",
                          tags=["admin-dsg-music-group"])


@router.get("/constants")
async def constants() -> Dict[str, Any]:
    return {
        "bps_total": BPS_TOTAL,
        "max_collaborators_per_track": MAX_COLLABORATORS_PER_TRACK,
        "artist_collective_pct": ARTIST_COLLECTIVE_PCT,
        "platform_split": {"artist_collective": 0.80,
                           "treasury": 0.15, "tournament": 0.05,
                           "burn": 0.0},
        "sync_contexts": ["tv_sync", "casino_background", "commercial_use"],
    }


# ─── Rights Ledger ───

class RightsRequest(BaseModel):
    track_id: str
    allow_tv_sync: bool = False
    allow_casino_background: bool = False
    allow_commercial_use: bool = False


@router.post("/rights/set")
async def rights_set(body: RightsRequest,
                      current_user=Depends(get_current_user_from_session)) -> Dict[str, Any]:
    return await set_track_rights(
        db, track_id=body.track_id, owner_id=current_user["user_id"],
        allow_tv_sync=body.allow_tv_sync,
        allow_casino_background=body.allow_casino_background,
        allow_commercial_use=body.allow_commercial_use,
    )


@router.get("/rights/{track_id}")
async def rights_get(track_id: str) -> Dict[str, Any]:
    return await get_track_rights(db, track_id)


@router.get("/rights/{track_id}/can-play")
async def can_play(track_id: str, context: str = "tv_sync") -> Dict[str, Any]:
    return await check_can_play(db, track_id=track_id, context=context)


@router.get("/marketplace/licensable")
async def licensable_tracks(context: str = "tv_sync",
                             limit: int = 50) -> Dict[str, Any]:
    """Browse tracks the artist has opted into licensing for ``context``.

    ``context`` ∈ {tv_sync, casino_background, commercial_use}.
    Joins `tracks_rights_ledger` with `dsg_tracks` so every row carries
    the metadata a broadcaster / merchant ad-buyer needs to make a
    decision (title, artist, momentum score, rights flags).
    """
    field = f"allow_{context}"
    if field not in {"allow_tv_sync", "allow_casino_background",
                     "allow_commercial_use"}:
        return {"ok": False, "reason": "invalid_context", "rows": []}
    cursor = db.tracks_rights_ledger.find(
        {field: True}, {"_id": 0},
    ).limit(max(1, min(int(limit), 100)))
    rights_rows = [r async for r in cursor]
    if not rights_rows:
        return {"ok": True, "context": context, "rows": [], "count": 0}

    track_ids = [r["track_id"] for r in rights_rows]
    cursor2 = db.dsg_tracks.find(
        {"track_id": {"$in": track_ids}, "status": "active"},
        {"_id": 0, "track_id": 1, "artist_id": 1, "artist_name": 1,
         "track_title": 1, "title": 1, "cover_art_url": 1,
         "momentum_score": 1, "lifetime_chart_points": 1},
    )
    tracks_by_id = {t["track_id"]: t async for t in cursor2}
    rows = []
    for r in rights_rows:
        t = tracks_by_id.get(r["track_id"])
        if not t:
            continue
        rows.append({
            "track_id": r["track_id"],
            "title": t.get("track_title") or t.get("title"),
            "artist_id": t.get("artist_id"),
            "artist_name": t.get("artist_name"),
            "cover_art_url": t.get("cover_art_url", ""),
            "momentum_score": int(t.get("momentum_score") or 0),
            "lifetime_chart_points": int(t.get("lifetime_chart_points") or 0),
            "rights": {
                "allow_tv_sync": bool(r.get("allow_tv_sync")),
                "allow_casino_background": bool(r.get("allow_casino_background")),
                "allow_commercial_use": bool(r.get("allow_commercial_use")),
            },
        })
    rows.sort(key=lambda x: x["momentum_score"], reverse=True)
    return {"ok": True, "context": context, "rows": rows,
            "count": len(rows)}


# ─── Collaborator Splits ───

class SplitRow(BaseModel):
    user_id: str
    role: Optional[str] = Field(default="collaborator", max_length=40)
    basis_points: int = Field(..., ge=1, le=10_000)


class SplitsRequest(BaseModel):
    track_id: str
    splits: List[SplitRow] = Field(..., min_length=1,
                                    max_length=MAX_COLLABORATORS_PER_TRACK)


@router.post("/splits/set")
async def splits_set(body: SplitsRequest,
                      current_user=Depends(get_current_user_from_session)) -> Dict[str, Any]:
    return await set_collaborator_splits(
        db, track_id=body.track_id, owner_id=current_user["user_id"],
        splits=[s.model_dump() for s in body.splits],
    )


@router.get("/splits/{track_id}")
async def splits_get(track_id: str) -> Dict[str, Any]:
    rows = await get_collaborator_splits(db, track_id)
    total = sum(int(r["basis_points"]) for r in rows)
    return {"rows": rows, "count": len(rows),
            "total_basis_points": total,
            "valid": total == BPS_TOTAL}


# ─── Royalty Disbursement (admin-triggered for now; the MME will
# call the service function directly once collaborator splits exist) ─

class DisburseRequest(BaseModel):
    track_id: str
    payout_coins: int = Field(..., gt=0, le=100_000_000)
    source: Optional[str] = Field(default="manual_admin", max_length=80)


@admin_router.post("/royalty/disburse")
async def admin_disburse(body: DisburseRequest,
                          admin=Depends(require_admin)) -> Dict[str, Any]:
    return await disburse_collective_royalty(
        db, track_id=body.track_id, payout_coins=body.payout_coins,
        source=body.source or "manual_admin",
    )


@admin_router.get("/royalty/recent")
async def admin_recent_royalty(track_id: Optional[str] = None,
                                admin=Depends(require_admin)) -> Dict[str, Any]:
    rows = await list_recent_payouts(db, track_id=track_id, limit=25)
    return {"rows": rows, "count": len(rows)}


@router.get("/royalty/me")
async def my_recent_royalty(current_user=Depends(get_current_user_from_session)) -> Dict[str, Any]:
    """All royalty payouts for tracks the user is registered as the
    primary artist on (audit + tax-export ready)."""
    cursor = db.music_royalty_payouts.find(
        {"primary_artist_id": current_user["user_id"]}, {"_id": 0},
    ).sort([("at", -1)]).limit(25)
    rows = [r async for r in cursor]
    return {"rows": rows, "count": len(rows)}

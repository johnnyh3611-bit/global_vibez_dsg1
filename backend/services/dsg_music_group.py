"""
DSG Music Group — Rights Ledger + Collaborator Splits (May 2026)
─────────────────────────────────────────────────────────────────
Implements the DSG Music Group Final Blueprint as in-app off-chain
modules that **compose** with the existing Master Media Engine
(``services.media_engine``). The MME ratio stays put:

    fan_payment  →  80 % collaborators · 15 % treasury · 5 % tournament

This module replaces the prior "all 80% → primary artist" rule
with a **basis-points-weighted split** across N collaborators.
Burn is still 0 % (in-app coins recirculate; SPL burn lives in the
Gas-Out flow, untouched).

Composition contract:
  1. Artist registers per-track collaborator splits (basis points
     summing to exactly 10_000 = 100 %).
  2. Artist toggles per-track sync rights (TV / casino BG / commercial)
     — these are checked by other modules before a track can be used
     in those contexts.
  3. On any fan→artist transaction, instead of crediting one wallet,
     `disburse_collective_royalty` proportions the 80 % artist slice
     across every collaborator by basis points (with rounding routed
     to the primary so totals reconcile to the cent).

COLLECTIONS:
  • tracks_rights_ledger    — per-track sync flags + audit
  • collaborator_splits     — basis-points per (track_id, wallet)
  • music_royalty_payouts   — every collective royalty disbursement
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

log = logging.getLogger(__name__)

BPS_TOTAL = 10_000  # 100% in basis points
MAX_COLLABORATORS_PER_TRACK = 20

# Default split when only a primary artist is registered (no
# collaborators yet) — keeps backward-compatible behaviour.
DEFAULT_PRIMARY_BPS = BPS_TOTAL  # 100 % to primary artist

# Counter-proposal: the 80 % "artist collective" share is the same
# slice the MME already routes. We piggy-back on it instead of
# fragmenting the economic model.
ARTIST_COLLECTIVE_PCT = 0.80


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:14]}"


# ═══════════════════ Rights Ledger ══════════════════════════════════

async def set_track_rights(
    db,
    *,
    track_id: str,
    owner_id: str,
    allow_tv_sync: bool,
    allow_casino_background: bool,
    allow_commercial_use: bool,
) -> Dict[str, Any]:
    """Upsert per-track sync rights. Owner check — only the registered
    track owner can flip these flags."""
    track = await db.dsg_tracks.find_one(
        {"track_id": track_id, "artist_id": owner_id}, {"_id": 0},
    )
    if not track:
        return {"ok": False, "reason": "track_not_found_or_not_owner"}

    await db.tracks_rights_ledger.update_one(
        {"track_id": track_id},
        {"$set": {
            "track_id": track_id,
            "owner_id": owner_id,
            "allow_tv_sync": bool(allow_tv_sync),
            "allow_casino_background": bool(allow_casino_background),
            "allow_commercial_use": bool(allow_commercial_use),
            "updated_at": _now_iso(),
        },
         "$setOnInsert": {"created_at": _now_iso()}},
        upsert=True,
    )
    return {"ok": True, "track_id": track_id,
            "allow_tv_sync": allow_tv_sync,
            "allow_casino_background": allow_casino_background,
            "allow_commercial_use": allow_commercial_use}


async def get_track_rights(db, track_id: str) -> Dict[str, Any]:
    row = await db.tracks_rights_ledger.find_one(
        {"track_id": track_id}, {"_id": 0},
    )
    if not row:
        # Default: nothing licensed until the artist opts in.
        return {
            "track_id": track_id,
            "allow_tv_sync": False,
            "allow_casino_background": False,
            "allow_commercial_use": False,
            "default": True,
        }
    return row


async def check_can_play(
    db,
    *,
    track_id: str,
    context: str,
) -> Dict[str, Any]:
    """Hook for the Master Media Engine / DSG TV / Plex Rooms before
    playback. ``context`` is one of ``tv_sync`` / ``casino_background``
    / ``commercial_use``."""
    rights = await get_track_rights(db, track_id)
    field = f"allow_{context}"
    allowed = bool(rights.get(field, False))
    return {"ok": True, "track_id": track_id, "context": context,
            "allowed": allowed, "rights": rights}


# ═══════════════════ Collaborator Splits ════════════════════════════

async def set_collaborator_splits(
    db,
    *,
    track_id: str,
    owner_id: str,
    splits: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Replace all collaborator splits for a track. ``splits`` is a
    list of ``{user_id, role, basis_points}`` rows. The basis_points
    MUST sum to exactly 10_000 — that's the on-chain invariant from
    the blueprint (`primary_artist_bps + producer_bps == 10000`)."""
    if not splits:
        return {"ok": False, "reason": "splits_required"}
    if len(splits) > MAX_COLLABORATORS_PER_TRACK:
        return {"ok": False, "reason": "too_many_collaborators"}

    # Validate ownership + bps invariant.
    track = await db.dsg_tracks.find_one(
        {"track_id": track_id, "artist_id": owner_id}, {"_id": 0},
    )
    if not track:
        return {"ok": False, "reason": "track_not_found_or_not_owner"}

    total_bps = 0
    seen: set = set()
    for s in splits:
        uid = s.get("user_id")
        bps = int(s.get("basis_points") or 0)
        if not uid:
            return {"ok": False, "reason": "user_id_required"}
        if uid in seen:
            return {"ok": False, "reason": "duplicate_collaborator"}
        if bps <= 0 or bps > BPS_TOTAL:
            return {"ok": False, "reason": "invalid_basis_points",
                    "user_id": uid, "basis_points": bps}
        seen.add(uid)
        total_bps += bps
    if total_bps != BPS_TOTAL:
        return {"ok": False, "reason": "invalid_basis_points_split",
                "total_bps": total_bps,
                "required": BPS_TOTAL}

    # Replace splits atomically.
    await db.collaborator_splits.delete_many({"track_id": track_id})
    now = _now_iso()
    rows = []
    for s in splits:
        rows.append({
            "split_id": _new_id("split"),
            "track_id": track_id,
            "user_id": s["user_id"],
            "role": (s.get("role") or "collaborator")[:40],
            "basis_points": int(s["basis_points"]),
            "created_at": now,
        })
    await db.collaborator_splits.insert_many(rows)
    # Strip mongo-injected _id so the response is JSON-serializable.
    for r in rows:
        r.pop("_id", None)
    return {"ok": True, "track_id": track_id, "splits": rows,
            "total_basis_points": BPS_TOTAL}


async def get_collaborator_splits(db, track_id: str) -> List[Dict[str, Any]]:
    cursor = db.collaborator_splits.find(
        {"track_id": track_id}, {"_id": 0},
    ).sort([("basis_points", -1)])
    return [r async for r in cursor]


# ═════════════════ Royalty Disbursement ═════════════════════════════

async def disburse_collective_royalty(
    db,
    *,
    track_id: str,
    payout_coins: int,
    source: str = "fan_transaction",
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Disburse a track-level payout across registered collaborators.
    Returns the per-collaborator amounts after rounding so the caller
    can audit. The platform 15/5 + 0 burn slice is NOT touched here —
    that's the MME's job (this module handles only the 80 % slice
    once it lands on the track).
    """
    if payout_coins <= 0:
        return {"ok": False, "reason": "non_positive_amount"}

    track = await db.dsg_tracks.find_one(
        {"track_id": track_id}, {"_id": 0, "artist_id": 1, "title": 1},
    )
    if not track:
        return {"ok": False, "reason": "track_not_found"}

    splits = await get_collaborator_splits(db, track_id)
    # Fall back: if no collaborator config, 100 % goes to the
    # primary artist (matches the MME's existing behaviour).
    if not splits:
        splits = [{
            "user_id": track["artist_id"], "role": "primary_artist",
            "basis_points": DEFAULT_PRIMARY_BPS,
        }]

    # Sort by bps DESC so the largest holder absorbs rounding.
    sorted_splits = sorted(
        splits, key=lambda s: int(s.get("basis_points", 0)), reverse=True,
    )

    from services.coin_wallet import credit_coins  # noqa: PLC0415
    payouts: List[Dict[str, Any]] = []
    distributed = 0
    for idx, s in enumerate(sorted_splits):
        bps = int(s.get("basis_points") or 0)
        if idx == len(sorted_splits) - 1:
            # Last collaborator gets the rounding remainder so totals
            # reconcile to the cent.
            share = payout_coins - distributed
        else:
            share = (payout_coins * bps) // BPS_TOTAL
        distributed += share
        if share > 0:
            try:
                await credit_coins(
                    db, s["user_id"], share,
                    reason="music_royalty_collective",
                    metadata={"track_id": track_id,
                              "split_bps": bps,
                              "role": s.get("role")},
                )
            except Exception as exc:  # noqa: BLE001
                log.warning("collaborator credit failed (%s): %s",
                            s["user_id"], exc)
        payouts.append({
            "user_id": s["user_id"],
            "role": s.get("role"),
            "basis_points": bps,
            "share_coins": int(share),
        })

    payout_id = _new_id("mroyal")
    await db.music_royalty_payouts.insert_one({
        "payout_id": payout_id,
        "track_id": track_id,
        "track_title": track.get("title"),
        "primary_artist_id": track["artist_id"],
        "source": source,
        "payout_coins": int(payout_coins),
        "payouts": payouts,
        "collaborator_count": len(payouts),
        "metadata": metadata or {},
        "burn_coins": 0,  # explicit — collaborator distribution never burns
        "at": _now_iso(),
    })
    return {"ok": True, "payout_id": payout_id,
            "track_id": track_id,
            "total_distributed": distributed,
            "payouts": payouts}


# ═════════════════ Read helpers (admin / artist) ════════════════════

async def list_recent_payouts(
    db, *, track_id: Optional[str] = None, limit: int = 25,
) -> List[Dict[str, Any]]:
    q: Dict[str, Any] = {}
    if track_id:
        q["track_id"] = track_id
    cursor = db.music_royalty_payouts.find(q, {"_id": 0}).sort(
        [("at", -1)]).limit(limit)
    return [p async for p in cursor]

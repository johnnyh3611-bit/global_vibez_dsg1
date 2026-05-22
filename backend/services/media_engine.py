"""
Master Media Engine (MME) — Feb 2026
─────────────────────────────────────────────────────────────
Implementation of the Global Vibez DSG Master Media Engine
Blueprint, V2 + counter-proposal (artist-first economics).

ECONOMIC CONTRACT (NON-NEGOTIABLE):
  • Fan → Artist transaction split:
      80 % → Artist accrued balance (coins, cycles back as artist spend)
      15 % → Recirculation Treasury bucket
       5 % → Recirculation Tournament Pool bucket
      0  % → Burn   (in-app coins NEVER burn — that's the SPL token only)

  • Gas-Out Accelerator (creator's instant DSG SPL payout):
      90 % → DSG SPL transfer to creator's Solana wallet
      10 % → DSG SPL → dead burn wallet  (this is where the burn lives)

  Rationale: We separate the two economies cleanly. In-app coins
  recirculate. DSG SPL token burns. The Gas-Out is the bridge —
  and the only surface where any burn happens.

  Wagering caps (DSG TV battles) are denominated in coins (₵):
      free   →   100,000 ₵ / event
      mid    → 1,000,000 ₵ / event
      top    → 5,000,000 ₵ / event

  Audio Unlock Nodes: when a user lands on a "discovery" surface
  (random wheel, table juke selection), the system surfaces the
  3 LOWEST-momentum tracks platform-wide instead of the top 3.
  This is the anti-payola mechanic — undiscovered talent rotates.

  Weekly chart-bonus: top-3 chart-point earners receive a bonus
  distribution funded by the 5 % Tournament Pool slice (NOT the
  Treasury) so the stability pool stays intact.

COLLECTIONS:
  • dsg_tracks            — track catalog (artist_id, title, audio_url,
                            chart_points, momentum_score)
  • room_music_queues     — per-room queue state
  • music_transactions    — ledger (every tip / vote-boost / gift)
  • artist_balances       — { artist_id, balance_coins, lifetime_earned }
  • artist_gas_outs       — Gas-Out events (DSG SPL transfer record)
  • music_chart_bonuses   — weekly bonus distribution audit trail
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

log = logging.getLogger(__name__)

# ───────────────────────────── Splits ─────────────────────────────
ARTIST_PCT: float = 0.80
TREASURY_PCT: float = 0.15
TOURNAMENT_PCT: float = 0.05
GAS_OUT_FEE_PCT: float = 0.10  # of the artist's gross, burned as SPL

# Wagering caps in COINS (₵). No USD — values converted by the
# integration layer if/when DSG TV battles route through Stripe.
WAGER_CAPS_COINS: Dict[str, int] = {
    "free": 100_000,
    "mid": 1_000_000,
    "top": 5_000_000,
}

# Allowed transaction kinds.
TXN_KINDS = {"ROOM_TIP", "QUEUE_BOOST", "STREAM_UNLOCK", "VISUAL_GIFT"}

# Chart-point weights per transaction kind (drives discovery /
# weekly leaderboard). Tunable without breaking economics.
CHART_POINT_WEIGHTS: Dict[str, float] = {
    "ROOM_TIP": 1.0,
    "QUEUE_BOOST": 1.5,
    "STREAM_UNLOCK": 0.5,
    "VISUAL_GIFT": 2.0,
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _now_iso() -> str:
    return _now().isoformat()


def split_for(amount_coins: int) -> Dict[str, int]:
    """Compute the 80/15/5 split in whole coins. Round in artist's
    favor so the user-visible artist take is never *less* than the
    advertised 80 %. Any rounding remainder lands in the Artist
    bucket — never in burn / treasury."""
    if amount_coins <= 0:
        return {"artist": 0, "treasury": 0, "tournament": 0}
    treasury = int(amount_coins * TREASURY_PCT)
    tournament = int(amount_coins * TOURNAMENT_PCT)
    artist = int(amount_coins - treasury - tournament)
    return {"artist": artist, "treasury": treasury, "tournament": tournament}


# ──────────────────────── Track + Queue ──────────────────────────

async def list_audio_unlock_nodes(db, limit: int = 3) -> List[Dict[str, Any]]:
    """Anti-payola discovery surface — return the LOWEST-momentum
    tracks platform-wide. Excludes muted / deleted rows."""
    cursor = db.dsg_tracks.find(
        {"status": "active"},
        {"_id": 0, "track_id": 1, "artist_id": 1, "artist_name": 1,
         "track_title": 1, "audio_url": 1, "cover_art_url": 1,
         "weekly_chart_points": 1, "momentum_score": 1},
    ).sort([("momentum_score", 1)]).limit(limit)
    return [row async for row in cursor]


async def list_top_tracks(db, limit: int = 50) -> List[Dict[str, Any]]:
    """Weekly chart leaderboard — top tracks by chart_points."""
    cursor = db.dsg_tracks.find(
        {"status": "active"},
        {"_id": 0, "track_id": 1, "artist_id": 1, "artist_name": 1,
         "track_title": 1, "audio_url": 1, "cover_art_url": 1,
         "weekly_chart_points": 1},
    ).sort([("weekly_chart_points", -1)]).limit(limit)
    return [row async for row in cursor]


async def upsert_track(db, *, artist_id: str, artist_name: str,
                       track_title: str, audio_url: str,
                       cover_art_url: Optional[str] = None,
                       track_id: Optional[str] = None) -> Dict[str, Any]:
    track_id = track_id or f"trk_{uuid.uuid4().hex[:14]}"
    doc = {
        "track_id": track_id,
        "artist_id": artist_id,
        "artist_name": artist_name,
        "track_title": track_title,
        "audio_url": audio_url,
        "cover_art_url": cover_art_url or "",
        "weekly_chart_points": 0,
        "lifetime_chart_points": 0,
        "momentum_score": 0,
        "status": "active",
        "created_at": _now_iso(),
    }
    await db.dsg_tracks.update_one(
        {"track_id": track_id}, {"$setOnInsert": doc}, upsert=True
    )
    return doc


async def get_room_queue(db, room_id: str) -> List[Dict[str, Any]]:
    cursor = db.room_music_queues.find(
        {"room_id": room_id, "status": {"$in": ["queued", "playing"]}},
        {"_id": 0},
    ).sort([("status", -1), ("votes", -1), ("queued_at", 1)])
    return [row async for row in cursor]


async def enqueue_track(db, *, room_id: str, track_id: str,
                        user_id: str) -> Dict[str, Any]:
    queue_id = f"q_{uuid.uuid4().hex[:14]}"
    # Look up track first so we can store denormalized title/artist
    # for fast queue rendering without a join on the read path.
    trk = await db.dsg_tracks.find_one(
        {"track_id": track_id, "status": "active"},
        {"_id": 0, "track_title": 1, "artist_id": 1, "artist_name": 1,
         "audio_url": 1, "cover_art_url": 1},
    )
    if not trk:
        return {"ok": False, "reason": "track_not_found"}

    doc = {
        "queue_id": queue_id,
        "room_id": room_id,
        "track_id": track_id,
        "track_title": trk["track_title"],
        "artist_id": trk["artist_id"],
        "artist_name": trk["artist_name"],
        "audio_url": trk["audio_url"],
        "cover_art_url": trk.get("cover_art_url", ""),
        "queued_by": user_id,
        "votes": 0,
        "status": "queued",
        "queued_at": _now_iso(),
    }
    await db.room_music_queues.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "queue_entry": doc}


# ──────────────────────── Transactions ────────────────────────────

async def _credit_artist_balance(db, *, artist_id: str, coins: int,
                                 txn_id: str) -> None:
    await db.artist_balances.update_one(
        {"artist_id": artist_id},
        {
            "$inc": {"balance_coins": coins,
                     "lifetime_earned_coins": coins,
                     "txn_count": 1},
            "$set": {"updated_at": _now_iso(),
                     "last_txn_id": txn_id},
            "$setOnInsert": {"artist_id": artist_id,
                             "created_at": _now_iso()},
        },
        upsert=True,
    )


async def _credit_recirculation_buckets(db, *, treasury: int,
                                        tournament: int,
                                        txn_id: str) -> None:
    if treasury > 0:
        await db.recirculation_pools.update_one(
            {"_id": "treasury"},
            {"$inc": {"balance": treasury},
             "$set": {"updated_at": _now_iso(),
                      "last_txn_id": txn_id}},
            upsert=True,
        )
    if tournament > 0:
        await db.recirculation_pools.update_one(
            {"_id": "tournament_pool"},
            {"$inc": {"balance": tournament},
             "$set": {"updated_at": _now_iso(),
                      "last_txn_id": txn_id}},
            upsert=True,
        )


async def _bump_chart_points(db, *, track_id: str, txn_kind: str,
                             coins_spent: int) -> None:
    """Chart points = coin_amount × kind_weight. Visual gifts weigh
    2× (premium), tips weigh 1×, stream-unlocks 0.5× (discovery).
    Momentum_score is a separate, time-decayed signal (incremented
    by the same delta but decayed nightly by the worker)."""
    weight = CHART_POINT_WEIGHTS.get(txn_kind, 1.0)
    delta = int(round(coins_spent * weight))
    if delta <= 0:
        return
    await db.dsg_tracks.update_one(
        {"track_id": track_id},
        {"$inc": {"weekly_chart_points": delta,
                  "lifetime_chart_points": delta,
                  "momentum_score": delta},
         "$set": {"updated_at": _now_iso()}},
    )


async def record_transaction(
    db,
    *,
    user_id: str,
    track_id: str,
    room_id: Optional[str],
    txn_kind: str,
    coins_spent: int,
) -> Dict[str, Any]:
    """Process a fan → artist transaction.

    Steps:
      1. Debit the user's wallet (atomic, conditional).
      2. Compute the 80/15/5 split.
      3. Credit artist accrued balance + recirculation buckets.
      4. Bump track chart-points + momentum.
      5. Append immutable row to music_transactions.

    Never burns in-app coins.
    """
    if txn_kind not in TXN_KINDS:
        return {"ok": False, "reason": "invalid_txn_kind"}
    if coins_spent <= 0:
        return {"ok": False, "reason": "amount_must_be_positive"}

    trk = await db.dsg_tracks.find_one(
        {"track_id": track_id, "status": "active"},
        {"_id": 0, "artist_id": 1, "artist_name": 1, "track_title": 1},
    )
    if not trk:
        return {"ok": False, "reason": "track_not_found"}

    # 1. Debit user. We import lazily to avoid a circular import.
    from services.coin_wallet import debit_coins   # noqa: PLC0415

    txn_id = f"mtx_{uuid.uuid4().hex[:14]}"
    try:
        debit_res = await debit_coins(
            db, user_id, coins_spent,
            reason=f"media:{txn_kind.lower()}",
            metadata={"track_id": track_id, "room_id": room_id,
                      "artist_id": trk["artist_id"], "txn_id": txn_id},
        )
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "reason": "insufficient_funds",
                "detail": str(exc)}

    balance_after = debit_res.get("balance_after")

    # 2. Split + 3. Credits
    split = split_for(coins_spent)
    await _credit_artist_balance(
        db, artist_id=trk["artist_id"], coins=split["artist"],
        txn_id=txn_id,
    )
    await _credit_recirculation_buckets(
        db, treasury=split["treasury"], tournament=split["tournament"],
        txn_id=txn_id,
    )

    # 4. Chart points (Vote Boost / Gift route to the track they
    #    boosted; Stream Unlock + Room Tip target the now-playing
    #    track).
    await _bump_chart_points(
        db, track_id=track_id, txn_kind=txn_kind, coins_spent=coins_spent,
    )

    # 5. Immutable transaction row
    txn_doc = {
        "txn_id": txn_id,
        "user_id": user_id,
        "track_id": track_id,
        "artist_id": trk["artist_id"],
        "artist_name": trk["artist_name"],
        "track_title": trk["track_title"],
        "room_id": room_id,
        "transaction_type": txn_kind,
        "coin_amount_spent": int(coins_spent),
        "artist_payout": int(split["artist"]),
        "treasury_allocation": int(split["treasury"]),
        "tournament_allocation": int(split["tournament"]),
        "coins_burned": 0,            # in-app coins never burn
        "burn_kind": "none",
        "split_rule": "80/15/5",
        "at": _now_iso(),
    }
    await db.music_transactions.insert_one(txn_doc)

    return {
        "ok": True,
        "txn_id": txn_id,
        "split": split,
        "balance_after_coins": balance_after,
    }


# ──────────────────────── Artist payouts ──────────────────────────

async def get_artist_balance(db, artist_id: str) -> Dict[str, Any]:
    row = await db.artist_balances.find_one(
        {"artist_id": artist_id}, {"_id": 0},
    )
    return row or {
        "artist_id": artist_id,
        "balance_coins": 0,
        "lifetime_earned_coins": 0,
        "txn_count": 0,
    }


async def gas_out(db, *, artist_id: str, coins: int,
                  solana_wallet: str) -> Dict[str, Any]:
    """Instant Gas-Out — convert accrued in-app coins into a DSG SPL
    transfer to the artist's Solana wallet. 10 % fee → 100 % burned
    as DSG SPL on the public token (NOT on in-app coins).

    NOTE: The actual on-chain SPL transfer + burn is performed by
    the existing Solana indexer worker (queued via the
    ``dsg_spl_burn_queue`` collection). This function records the
    intent + decrements the accrued balance atomically."""
    if coins <= 0:
        return {"ok": False, "reason": "amount_must_be_positive"}

    bal_row = await db.artist_balances.find_one(
        {"artist_id": artist_id}, {"_id": 0, "balance_coins": 1},
    ) or {}
    available = int(bal_row.get("balance_coins", 0))
    if coins > available:
        return {"ok": False, "reason": "insufficient_artist_balance",
                "available_coins": available}

    fee_coins = int(coins * GAS_OUT_FEE_PCT)
    net_coins = coins - fee_coins

    # Decrement balance atomically (race-safe)
    dec = await db.artist_balances.update_one(
        {"artist_id": artist_id, "balance_coins": {"$gte": coins}},
        {"$inc": {"balance_coins": -coins, "gas_out_count": 1},
         "$set": {"updated_at": _now_iso()}},
    )
    if dec.modified_count == 0:
        return {"ok": False, "reason": "concurrent_modification"}

    gas_id = f"gas_{uuid.uuid4().hex[:14]}"
    gas_doc = {
        "gas_id": gas_id,
        "artist_id": artist_id,
        "solana_wallet": solana_wallet,
        "gross_coins": int(coins),
        "fee_coins": int(fee_coins),
        "net_coins": int(net_coins),
        "fee_destination": "dsg_spl_burn",
        "spl_transfer_status": "queued",  # picked up by Solana indexer worker
        "at": _now_iso(),
    }
    await db.artist_gas_outs.insert_one(gas_doc)

    # Enqueue the DSG SPL burn intent. The Solana indexer worker
    # already reads ``dsg_spl_burn_queue`` and executes the burn
    # on-chain — we just leave a row here.
    await db.dsg_spl_burn_queue.insert_one({
        "queue_id": gas_id,
        "kind": "media_gas_out_fee",
        "amount_coins": int(fee_coins),
        "source_artist_id": artist_id,
        "status": "queued",
        "at": _now_iso(),
    })

    return {
        "ok": True,
        "gas_id": gas_id,
        "gross_coins": int(coins),
        "fee_coins": int(fee_coins),
        "net_coins": int(net_coins),
        "spl_transfer_status": "queued",
    }


# ─────────────────────── Weekly chart bonus ───────────────────────

async def distribute_weekly_chart_bonus(db, top_n: int = 3,
                                        bonus_pct: float = 0.05
                                        ) -> Dict[str, Any]:
    """Take ``bonus_pct`` of the current Tournament Pool, split it
    among the top ``top_n`` artists by weekly_chart_points, and
    credit their accrued balances. Reset weekly_chart_points to 0
    at the end. Returns the audit trail row."""
    pool = await db.recirculation_pools.find_one(
        {"_id": "tournament_pool"}, {"_id": 0, "balance": 1},
    )
    pool_balance = int((pool or {}).get("balance", 0))
    bonus_total = int(pool_balance * bonus_pct)
    if bonus_total <= 0:
        return {"ok": False, "reason": "tournament_pool_empty",
                "pool_balance": pool_balance}

    # Pick winners
    cursor = db.dsg_tracks.find(
        {"status": "active", "weekly_chart_points": {"$gt": 0}},
        {"_id": 0, "track_id": 1, "artist_id": 1, "artist_name": 1,
         "track_title": 1, "weekly_chart_points": 1},
    ).sort([("weekly_chart_points", -1)]).limit(top_n)
    winners = [row async for row in cursor]
    if not winners:
        return {"ok": False, "reason": "no_chart_activity"}

    # Pay 50/30/20 to top-3 (industry-standard prize split). Tunable.
    pay_pcts = [0.50, 0.30, 0.20]
    distributions: List[Dict[str, Any]] = []
    paid = 0
    bonus_id = f"chart_{uuid.uuid4().hex[:14]}"

    # Atomically drain the pool first (race-safe)
    drain = await db.recirculation_pools.update_one(
        {"_id": "tournament_pool", "balance": {"$gte": bonus_total}},
        {"$inc": {"balance": -bonus_total},
         "$set": {"updated_at": _now_iso()}},
    )
    if drain.modified_count == 0:
        return {"ok": False, "reason": "pool_drained_concurrently"}

    for i, winner in enumerate(winners):
        share = int(bonus_total * (pay_pcts[i] if i < len(pay_pcts) else 0))
        if share <= 0:
            continue
        paid += share
        await _credit_artist_balance(
            db, artist_id=winner["artist_id"], coins=share,
            txn_id=bonus_id,
        )
        distributions.append({
            "rank": i + 1,
            "artist_id": winner["artist_id"],
            "artist_name": winner["artist_name"],
            "track_id": winner["track_id"],
            "track_title": winner["track_title"],
            "chart_points": int(winner["weekly_chart_points"]),
            "bonus_coins": share,
        })

    # Refund rounding remainder back to the pool so we don't lose ₵
    remainder = bonus_total - paid
    if remainder > 0:
        await db.recirculation_pools.update_one(
            {"_id": "tournament_pool"},
            {"$inc": {"balance": remainder}},
        )

    # Reset chart points for everyone (new week)
    await db.dsg_tracks.update_many(
        {"status": "active"},
        {"$set": {"weekly_chart_points": 0,
                  "weekly_reset_at": _now_iso()}},
    )

    audit = {
        "bonus_id": bonus_id,
        "distributed_at": _now_iso(),
        "pool_balance_at_start": pool_balance,
        "bonus_pool": bonus_total,
        "bonus_paid": paid,
        "refunded_remainder": remainder,
        "distributions": distributions,
        "source_bucket": "tournament_pool",
    }
    await db.music_chart_bonuses.insert_one(audit)
    return {"ok": True, **audit}

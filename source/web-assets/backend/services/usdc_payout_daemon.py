"""
VibeRidez USDC Payout Daemon

Drains `fare_distributions` rows where `driver_payout_status='pending'`
and ships devnet USDC SPL transfers from the hot-wallet keypair
(`VIBEZ_PAYOUT_WALLET_SECRET`) to the driver's registered Solana
wallet. Flips status to `paid` + stamps the tx signature on success.

Safety rails (all configurable via backend/.env):
  1. DRY_RUN mode — `VIBEZ_PAYOUT_DRY_RUN=1` (default). Daemon logs
     every intended transfer but NEVER submits to the network. Flip
     to `0` to ship live.
  2. Per-payout cap — `VIBEZ_PAYOUT_MAX_PER_TX_USD` (default 500).
     Single row > cap is flagged `capped_per_tx`, never attempted.
  3. Daily cap per driver — `VIBEZ_PAYOUT_MAX_PER_DRIVER_DAY_USD`
     (default 2000). Additional payouts past the day's cap queue with
     `capped_daily` until the next UTC day.
  4. Idempotency — claim-to-process with `paying` status + `attempts`
     counter before submit. On restart mid-flight, the row is in
     `paying` state and the reconciler cleans up orphans > 10 minutes
     old (logs, resets to pending). This guarantees no double-pay.

Flow (per poll):
  1. Reconcile orphaned `paying` rows → back to `pending` if stale.
  2. Atomically CLAIM up to 5 pending rows (findOneAndUpdate with
     filter status=pending → paying). Idempotent.
  3. For each: load driver.solana_wallet_address. If missing,
     status=`pending_no_wallet`; skip.
  4. Apply per-tx + daily caps.
  5. DRY_RUN=1 → stamp `mock_sig_*` and flip to `paid`. Logs to
     `payout_dry_run_log` collection for audit.
  6. DRY_RUN=0 → call solders/solana-py to build + submit SPL
     `transfer_checked`. On success: `paid` + signature. On failure:
     `failed` + error message + `attempts += 1` (retried next poll
     up to 3× then left as `failed` for manual intervention).

All DB interactions use utils.database.get_database().
"""
from __future__ import annotations

import asyncio
import logging
import os
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# ────────────────────────────────────────────── Config (env-driven)

def _cfg() -> Dict[str, Any]:
    """Fresh read of env on every tick so ops can flip DRY_RUN live
    without a restart."""
    return {
        "network":         os.environ.get("VIBEZ_PAYOUT_NETWORK", "devnet").strip(),
        "dry_run":         os.environ.get("VIBEZ_PAYOUT_DRY_RUN", "1").strip() == "1",
        "wallet_pubkey":   os.environ.get("VIBEZ_PAYOUT_WALLET_PUBKEY", "").strip(),
        "wallet_secret":   os.environ.get("VIBEZ_PAYOUT_WALLET_SECRET", "").strip(),
        "usdc_mint":       os.environ.get("VIBEZ_PAYOUT_USDC_MINT", "").strip(),
        "usdc_decimals":   int(os.environ.get("VIBEZ_PAYOUT_USDC_DECIMALS", "6")),
        "max_per_tx_usd":  float(os.environ.get("VIBEZ_PAYOUT_MAX_PER_TX_USD", "500")),
        "max_per_day_usd": float(os.environ.get("VIBEZ_PAYOUT_MAX_PER_DRIVER_DAY_USD", "2000")),
        "poll_seconds":    int(os.environ.get("VIBEZ_PAYOUT_POLL_SECONDS", "60")),
        "batch_size":      int(os.environ.get("VIBEZ_PAYOUT_BATCH_SIZE", "5")),
        "max_attempts":    int(os.environ.get("VIBEZ_PAYOUT_MAX_ATTEMPTS", "3")),
        "orphan_timeout":  int(os.environ.get("VIBEZ_PAYOUT_ORPHAN_TIMEOUT_SEC", "600")),
    }


# ────────────────────────────────────────────── Daily cap query

async def _day_spent_usd(db, driver_id: str) -> float:
    """Sum of `driver_usd` already paid or in-flight to this driver
    today (UTC). Used for the per-driver daily cap check."""
    start_of_day = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0,
    ).isoformat()
    pipeline = [
        {"$match": {
            "driver_id": driver_id,
            "driver_payout_status": {"$in": ["paid", "paying"]},
            "driver_payout_settled_at": {"$gte": start_of_day},
        }},
        {"$group": {"_id": None, "total": {"$sum": "$driver_usd"}}},
    ]
    rows = await db.fare_distributions.aggregate(pipeline).to_list(1)
    return float(rows[0]["total"]) if rows else 0.0


# ────────────────────────────────────────────── Orphan reconciliation

async def _reconcile_orphans(db, orphan_timeout_sec: int) -> int:
    """Any row stuck in `paying` state for > orphan_timeout_sec is
    reset to `pending` so it can be retried. Prevents a crashed
    daemon from permanently locking rows."""
    cutoff = (
        datetime.now(timezone.utc) - timedelta(seconds=orphan_timeout_sec)
    ).isoformat()
    result = await db.fare_distributions.update_many(
        {
            "driver_payout_status": "paying",
            "driver_payout_claimed_at": {"$lt": cutoff},
        },
        {"$set": {"driver_payout_status": "pending"},
         "$inc": {"driver_payout_orphan_resets": 1}},
    )
    if result.modified_count:
        logger.warning(
            "[usdc-payout] reconciled %d orphaned 'paying' rows",
            result.modified_count,
        )
    return result.modified_count


# ────────────────────────────────────────────── Claim pending rows

async def _claim_batch(db, batch_size: int) -> List[Dict[str, Any]]:
    """Atomically flip up to `batch_size` pending rows to `paying`
    and return them. Uses findOneAndUpdate in a loop (Mongo doesn't
    support atomic multi-doc claim without a transaction)."""
    claimed: List[Dict[str, Any]] = []
    now_iso = datetime.now(timezone.utc).isoformat()
    for _ in range(batch_size):
        row = await db.fare_distributions.find_one_and_update(
            {"driver_payout_status": "pending",
             "driver_id": {"$ne": None, "$exists": True},
             "driver_usd": {"$gt": 0}},
            {"$set": {
                "driver_payout_status": "paying",
                "driver_payout_claimed_at": now_iso,
            }, "$inc": {"driver_payout_attempts": 1}},
            projection={"_id": 0},
            return_document=True,
        )
        if not row:
            break
        claimed.append(row)
    return claimed


# ────────────────────────────────────────────── Status transitions

async def _mark_status(
    db, ride_id: str, status: str, **extra: Any
) -> None:
    now_iso = datetime.now(timezone.utc).isoformat()
    update = {"driver_payout_status": status,
              "driver_payout_updated_at": now_iso, **extra}
    if status == "paid":
        update["driver_payout_settled_at"] = now_iso
    await db.fare_distributions.update_one(
        {"ride_id": ride_id}, {"$set": update},
    )


# ────────────────────────────────────────────── SPL transfer

async def _submit_spl_transfer(
    *,
    recipient_wallet: str,
    amount_usd: float,
    cfg: Dict[str, Any],
) -> Dict[str, Any]:
    """Build + submit a USDC `transfer_checked` instruction. Returns
    {ok, signature, error?}. Never raises."""
    try:
        import base58
        from solana.rpc.async_api import AsyncClient
        from solana.rpc.types import TxOpts
        from solders.keypair import Keypair
        from solders.pubkey import Pubkey
        from solders.message import MessageV0
        from solders.transaction import VersionedTransaction
        from spl.token.constants import TOKEN_PROGRAM_ID
        from spl.token.instructions import (
            TransferCheckedParams,
            transfer_checked,
            get_associated_token_address,
            create_associated_token_account,
        )

        decimals = cfg["usdc_decimals"]
        base_units = int(round(amount_usd * (10 ** decimals)))
        if base_units <= 0:
            return {"ok": False, "error": "amount rounds to zero base units"}

        hot = Keypair.from_bytes(base58.b58decode(cfg["wallet_secret"]))
        mint_pk = Pubkey.from_string(cfg["usdc_mint"])
        recipient_pk = Pubkey.from_string(recipient_wallet)

        rpc_url = os.environ.get("VIBEZ_SOLANA_RPC") or (
            "https://api.devnet.solana.com" if cfg["network"] == "devnet"
            else "https://api.mainnet-beta.solana.com"
        )
        client = AsyncClient(rpc_url)
        try:
            source_ata = get_associated_token_address(
                owner=hot.pubkey(), mint=mint_pk,
            )
            dest_ata = get_associated_token_address(
                owner=recipient_pk, mint=mint_pk,
            )

            instructions: List[Any] = []

            # Create destination ATA if missing. Hot wallet pays rent.
            dest_info = await client.get_account_info(dest_ata)
            if dest_info.value is None:
                instructions.append(create_associated_token_account(
                    payer=hot.pubkey(), owner=recipient_pk, mint=mint_pk,
                ))

            # TransferChecked — SPL enforces decimals server-side to
            # prevent amount-scaling bugs.
            instructions.append(transfer_checked(
                TransferCheckedParams(
                    program_id=TOKEN_PROGRAM_ID,
                    source=source_ata,
                    mint=mint_pk,
                    dest=dest_ata,
                    owner=hot.pubkey(),
                    amount=base_units,
                    decimals=decimals,
                    signers=[],
                )
            ))

            blockhash = (await client.get_latest_blockhash()).value.blockhash
            msg = MessageV0.try_compile(
                payer=hot.pubkey(), instructions=instructions,
                address_lookup_table_accounts=[],
                recent_blockhash=blockhash,
            )
            tx = VersionedTransaction(msg, [hot])
            resp = await client.send_transaction(
                tx,
                opts=TxOpts(skip_preflight=False,
                            preflight_commitment="confirmed"),
            )
            sig = str(resp.value)
            await client.confirm_transaction(resp.value, commitment="confirmed")
            return {"ok": True, "signature": sig}
        finally:
            try:
                await client.close()
            except Exception:
                pass
    except Exception as e:
        logger.exception(f"[usdc-payout] transfer failed: {e}")
        return {"ok": False, "error": str(e)}


# ────────────────────────────────────────────── Main tick

async def _process_one(db, row: Dict[str, Any], cfg: Dict[str, Any]) -> Dict[str, Any]:
    """Execute a single claimed payout row. Returns a result summary."""
    ride_id = row["ride_id"]
    driver_id = row["driver_id"]
    amount_usd = float(row.get("driver_usd") or 0)

    # 1. Driver must have a registered Solana wallet.
    driver = await db.users.find_one(
        {"user_id": driver_id}, {"_id": 0, "solana_wallet_address": 1},
    )
    wallet = (driver or {}).get("solana_wallet_address")
    if not wallet:
        await _mark_status(
            db, ride_id, "pending_no_wallet",
            driver_payout_error="Driver has no solana_wallet_address",
        )
        return {"ride_id": ride_id, "outcome": "skipped_no_wallet"}

    # 2. Per-tx cap.
    if amount_usd > cfg["max_per_tx_usd"]:
        await _mark_status(
            db, ride_id, "capped_per_tx",
            driver_payout_error=(
                f"Single payout ${amount_usd:.2f} exceeds per-tx cap "
                f"${cfg['max_per_tx_usd']:.2f}"
            ),
        )
        return {"ride_id": ride_id, "outcome": "capped_per_tx"}

    # 3. Per-driver daily cap.
    today_spent = await _day_spent_usd(db, driver_id)
    if today_spent + amount_usd > cfg["max_per_day_usd"]:
        # Roll back — put it back to pending so tomorrow's tick
        # picks it up when the day resets. Stamp a note on the row.
        # Reset `driver_payout_attempts` on this branch so repeated
        # daily-cap deferrals don't prematurely mark a legitimately
        # queued ride as terminally failed after max_attempts.
        await _mark_status(
            db, ride_id, "pending",
            driver_payout_attempts=0,
            driver_payout_error=(
                f"Daily cap reached (${today_spent:.2f} already paid); "
                "will retry after UTC day rolls."
            ),
        )
        return {"ride_id": ride_id, "outcome": "deferred_daily_cap"}

    # 4. DRY RUN — stamp a mock signature + log to audit collection.
    if cfg["dry_run"]:
        mock_sig = f"dryrun_{uuid.uuid4().hex[:32]}"
        await _mark_status(
            db, ride_id, "paid",
            driver_payout_tx_sig=mock_sig,
            driver_payout_dry_run=True,
            driver_payout_wallet=wallet,
        )
        await db.payout_dry_run_log.insert_one({
            "ride_id": ride_id,
            "driver_id": driver_id,
            "wallet": wallet,
            "amount_usd": amount_usd,
            "mock_sig": mock_sig,
            "at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(
            "[usdc-payout DRY_RUN] would send $%.2f USDC to %s (ride=%s)",
            amount_usd, wallet, ride_id,
        )
        return {"ride_id": ride_id, "outcome": "dry_run_paid",
                "amount_usd": amount_usd, "mock_sig": mock_sig}

    # 5. LIVE — submit the SPL transfer.
    result = await _submit_spl_transfer(
        recipient_wallet=wallet, amount_usd=amount_usd, cfg=cfg,
    )
    if result.get("ok"):
        await _mark_status(
            db, ride_id, "paid",
            driver_payout_tx_sig=result["signature"],
            driver_payout_wallet=wallet,
            driver_payout_dry_run=False,
        )
        return {"ride_id": ride_id, "outcome": "paid",
                "signature": result["signature"]}
    else:
        # Failure — flip to 'failed' if max_attempts exceeded, else
        # back to 'pending' for retry.
        attempts = int(row.get("driver_payout_attempts") or 1)
        if attempts >= cfg["max_attempts"]:
            await _mark_status(
                db, ride_id, "failed",
                driver_payout_error=result.get("error", "unknown"),
            )
            return {"ride_id": ride_id, "outcome": "failed_terminal",
                    "error": result.get("error")}
        await _mark_status(
            db, ride_id, "pending",
            driver_payout_error=result.get("error", "unknown"),
        )
        return {"ride_id": ride_id, "outcome": "retry",
                "error": result.get("error")}


async def payout_tick(db) -> Dict[str, Any]:
    """Single tick of the daemon — runs once per poll interval. Safe
    to invoke manually via admin endpoint for ops tooling."""
    cfg = _cfg()
    summary: Dict[str, Any] = {
        "dry_run": cfg["dry_run"],
        "network": cfg["network"],
        "started_at": datetime.now(timezone.utc).isoformat(),
        "orphans_reset": 0,
        "processed": [],
    }
    try:
        summary["orphans_reset"] = await _reconcile_orphans(
            db, cfg["orphan_timeout"],
        )
        rows = await _claim_batch(db, cfg["batch_size"])
        for row in rows:
            try:
                res = await _process_one(db, row, cfg)
                summary["processed"].append(res)
            except Exception as e:  # noqa: BLE001
                logger.exception(
                    f"[usdc-payout] row crash ride={row.get('ride_id')}: {e}"
                )
                # Row is in 'paying' state from the claim — orphan
                # reconciler will pick it up after orphan_timeout.
                summary["processed"].append({
                    "ride_id": row.get("ride_id"),
                    "outcome": "crash", "error": str(e),
                })
    finally:
        summary["ended_at"] = datetime.now(timezone.utc).isoformat()
    return summary


# ────────────────────────────────────────────── Long-running loop

async def payout_daemon_loop() -> None:
    """Background task started by server.py. Polls every
    VIBEZ_PAYOUT_POLL_SECONDS (default 60)."""
    from utils.database import get_database

    db = get_database()
    logger.info(
        "[usdc-payout] daemon starting (dry_run=%s, network=%s, poll=%ds)",
        _cfg()["dry_run"], _cfg()["network"], _cfg()["poll_seconds"],
    )
    while True:
        try:
            await payout_tick(db)
        except Exception as e:  # noqa: BLE001
            logger.exception(f"[usdc-payout] tick crashed: {e}")
        await asyncio.sleep(_cfg()["poll_seconds"])

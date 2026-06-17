"""
USDC Payout admin + driver-wallet endpoints.

  POST /api/driver/wallet                   — (auth) driver registers solana wallet
  GET  /api/driver/wallet                   — (auth) read current registered wallet
  GET  /api/admin/usdc-payout/queue         — (admin) paginated queue snapshot
  GET  /api/admin/usdc-payout/stats         — (admin) counts per status
  POST /api/admin/usdc-payout/tick-now      — (admin) fire one tick manually
  POST /api/admin/usdc-payout/dry-run       — (admin) live-toggle dry-run flag
  POST /api/admin/usdc-payout/retry/{ride}  — (admin) reset a failed row to pending

Note: the daemon's hot-wallet keypair is loaded from VIBEZ_PAYOUT_WALLET_SECRET.
Admin endpoints never expose the secret — only the public pubkey.
"""
from __future__ import annotations

import logging
import os
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from routes.admin_dashboard import verify_admin_cookie
from services.usdc_payout_daemon import _cfg, payout_tick
from utils.database import get_current_user, get_database

logger = logging.getLogger(__name__)
router = APIRouter()


# Solana base58 wallet address shape (32–44 chars, base58 charset).
_WALLET_RE = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$")


# ────────────────────────────────────────────── Driver wallet

class WalletRegistration(BaseModel):
    solana_wallet_address: str = Field(..., min_length=32, max_length=44)


@router.post("/driver/wallet")
async def register_driver_wallet(
    body: WalletRegistration, request: Request,
) -> Dict[str, Any]:
    """Driver registers the Solana wallet that should receive USDC
    payouts. Idempotent — updates the existing field."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(401, "Sign in to register a wallet.")

    addr = body.solana_wallet_address.strip()
    if not _WALLET_RE.match(addr):
        raise HTTPException(
            400, "Invalid Solana wallet address format.",
        )

    db = get_database()
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {
            "solana_wallet_address": addr,
            "solana_wallet_registered_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    logger.info(
        "[driver-wallet] user=%s registered wallet=%s", user.user_id, addr,
    )
    return {"ok": True, "solana_wallet_address": addr}


@router.get("/driver/wallet")
async def get_driver_wallet(request: Request) -> Dict[str, Any]:
    """Return the caller's registered payout wallet (or null)."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(401, "Sign in to view your wallet.")
    db = get_database()
    row = await db.users.find_one(
        {"user_id": user.user_id},
        {"_id": 0, "solana_wallet_address": 1, "solana_wallet_registered_at": 1},
    )
    return {
        "solana_wallet_address": (row or {}).get("solana_wallet_address"),
        "registered_at": (row or {}).get("solana_wallet_registered_at"),
    }


# ────────────────────────────────────────────── Admin endpoints

@router.get("/admin/usdc-payout/stats")
async def admin_stats(_: bool = Depends(verify_admin_cookie)) -> Dict[str, Any]:
    """Per-status aggregate counts + cfg snapshot — drives the
    God-Mode admin panel health tile."""
    db = get_database()
    pipeline = [
        {"$group": {
            "_id": "$driver_payout_status",
            "count": {"$sum": 1},
            "total_usd": {"$sum": "$driver_usd"},
        }}
    ]
    rows = await db.fare_distributions.aggregate(pipeline).to_list(length=50)
    by_status = {
        (r["_id"] or "unknown"): {
            "count": int(r["count"]),
            "total_usd": round(float(r["total_usd"]), 2),
        } for r in rows
    }
    cfg = _cfg()
    # Never return the secret.
    return {
        "by_status": by_status,
        "config": {
            "network":         cfg["network"],
            "dry_run":         cfg["dry_run"],
            "wallet_pubkey":   cfg["wallet_pubkey"],
            "usdc_mint":       cfg["usdc_mint"],
            "max_per_tx_usd":  cfg["max_per_tx_usd"],
            "max_per_day_usd": cfg["max_per_day_usd"],
            "poll_seconds":    cfg["poll_seconds"],
        },
    }


@router.get("/admin/usdc-payout/queue")
async def admin_queue(
    status: Optional[str] = None,
    limit: int = 50,
    _: bool = Depends(verify_admin_cookie),
) -> Dict[str, Any]:
    """Paginated queue view for the admin panel. Filter by status
    (pending | paying | paid | failed | pending_no_wallet | capped_per_tx)."""
    db = get_database()
    q: Dict[str, Any] = {}
    if status:
        q["driver_payout_status"] = status
    limit = max(1, min(int(limit), 500))
    rows = await db.fare_distributions.find(q, {"_id": 0}).sort(
        "created_at", -1,
    ).to_list(length=limit)
    return {"count": len(rows), "rows": rows, "filter_status": status}


class DryRunToggle(BaseModel):
    dry_run: bool
    # Defense-in-depth: flipping DRY_RUN=False on mainnet (i.e. live
    # USDC going out) requires an explicit ack. Safe on devnet.
    mainnet_ack: bool = False


@router.post("/admin/usdc-payout/dry-run")
async def admin_set_dry_run(
    body: DryRunToggle, _: bool = Depends(verify_admin_cookie),
) -> Dict[str, Any]:
    """Live-toggle the dry-run flag via env mutation. The daemon
    reads cfg on every tick so the change takes effect within one
    poll interval — no restart required.

    Mainnet safeguard: disabling dry-run on mainnet requires
    `mainnet_ack=true` in the request body. A careless misclick on
    devnet won't accidentally nuke a production wallet.
    """
    cfg = _cfg()
    if (
        cfg["network"] == "mainnet"
        and body.dry_run is False
        and not body.mainnet_ack
    ):
        raise HTTPException(
            400,
            "Refusing to disable DRY_RUN on mainnet without "
            "mainnet_ack=true in request body.",
        )
    os.environ["VIBEZ_PAYOUT_DRY_RUN"] = "0" if not body.dry_run else "1"
    logger.warning(
        "[usdc-payout] DRY_RUN flipped to %s by admin (network=%s)",
        body.dry_run, cfg["network"],
    )
    return {"ok": True, "dry_run": _cfg()["dry_run"]}


@router.post("/admin/usdc-payout/tick-now")
async def admin_tick_now(
    _: bool = Depends(verify_admin_cookie),
) -> Dict[str, Any]:
    """Fire one daemon tick immediately — drains the queue once
    without waiting for the poll interval."""
    db = get_database()
    return await payout_tick(db)


@router.post("/admin/usdc-payout/retry/{ride_id}")
async def admin_retry(
    ride_id: str, _: bool = Depends(verify_admin_cookie),
) -> Dict[str, Any]:
    """Reset a failed / capped / no-wallet row back to pending so the
    next tick will retry it. Useful after a driver registers their
    wallet late, or after fixing a cap."""
    db = get_database()
    res = await db.fare_distributions.update_one(
        {"ride_id": ride_id,
         "driver_payout_status": {"$in": [
             "failed", "pending_no_wallet", "capped_per_tx",
         ]}},
        {"$set": {
            "driver_payout_status": "pending",
            "driver_payout_attempts": 0,
            "driver_payout_error": None,
        }},
    )
    if res.matched_count == 0:
        raise HTTPException(
            404, "Ride not found or not in a retryable state.",
        )
    return {"ok": True, "ride_id": ride_id, "reset_to": "pending"}


# ────────────────────────────────────────────── Funding helpers

class FundingCheck(BaseModel):
    test_recipient_wallet: Optional[str] = None


@router.get("/admin/usdc-payout/funding-status")
async def admin_funding_status(
    _: bool = Depends(verify_admin_cookie),
) -> Dict[str, Any]:
    """Live SOL + USDC balance of the hot-wallet pubkey on whichever
    network is configured. Used by the ops-validation playbook to
    confirm the faucet drops landed before flipping DRY_RUN off."""
    return await _funding_status_raw()


async def _funding_status_raw() -> Dict[str, Any]:
    """Internal helper — returns funding snapshot, no auth. Reused by
    the ops-validate one-shot endpoint so both use the same logic."""
    try:
        import os as _os
        from solana.rpc.async_api import AsyncClient
        from solders.pubkey import Pubkey
        from spl.token.instructions import get_associated_token_address

        cfg = _cfg()
        pubkey = cfg["wallet_pubkey"]
        if not pubkey:
            return {"ok": False, "error": "no hot wallet configured"}
        rpc = _os.environ.get("VIBEZ_SOLANA_RPC") or (
            "https://api.devnet.solana.com" if cfg["network"] == "devnet"
            else "https://api.mainnet-beta.solana.com"
        )
        c = AsyncClient(rpc)
        try:
            owner = Pubkey.from_string(pubkey)
            mint = Pubkey.from_string(cfg["usdc_mint"])
            ata = get_associated_token_address(owner=owner, mint=mint)

            sol_lamports = (await c.get_balance(owner)).value
            try:
                tok = await c.get_token_account_balance(ata)
                usdc_ui = float(tok.value.ui_amount or 0)
                usdc_base = int(tok.value.amount or 0)
                ata_exists = True
            except Exception:
                usdc_ui = 0.0
                usdc_base = 0
                ata_exists = False
            return {
                "ok": True,
                "network": cfg["network"],
                "wallet_pubkey": pubkey,
                "ata": str(ata),
                "ata_exists": ata_exists,
                "usdc_mint": cfg["usdc_mint"],
                "sol_balance": sol_lamports / 1e9,
                "sol_lamports": sol_lamports,
                "usdc_balance": usdc_ui,
                "usdc_base_units": usdc_base,
                "ready_for_live": ata_exists and usdc_ui > 0 and sol_lamports > 5_000_000,
            }
        finally:
            try:
                await c.close()
            except Exception:
                pass
    except Exception as e:
        return {"ok": False, "error": str(e)}


class OpsValidatePayload(BaseModel):
    test_recipient_wallet: str = Field(..., min_length=32, max_length=44)
    test_fare_usd: float = Field(default=1.0, gt=0, le=10)


@router.post("/admin/usdc-payout/ops-validate")
async def admin_ops_validate(
    body: OpsValidatePayload, _: bool = Depends(verify_admin_cookie),
) -> Dict[str, Any]:
    """One-shot ops validation:
      1. Require the hot wallet to have funded SOL + USDC (else abort
         with a clear explainer).
      2. Create a synthetic `test_recipient_driver` user with the
         supplied wallet.
      3. Record a small `fare_distributions` row (default $1 gross →
         $0.70 driver payout — well under every cap).
      4. Flip DRY_RUN=false in-process.
      5. Fire one daemon tick — this submits a REAL devnet SPL
         transfer.
      6. Flip DRY_RUN back to true (safety).
      7. Return the tx signature + a Solana Explorer link.
    Idempotent on `test_recipient_wallet`+`test_fare_usd` — re-running
    creates a fresh synthetic ride each time."""
    db = get_database()

    # 1. Pre-flight funding check.
    funding = await _funding_status_raw()
    if not funding.get("ok"):
        raise HTTPException(400, f"Funding check failed: {funding}")
    if not funding.get("ready_for_live"):
        raise HTTPException(400, {
            "error": "Hot wallet is not ready for live payout yet.",
            "funding": funding,
            "needed": "At least 0.005 SOL for fees + rent AND any non-zero USDC balance on the wallet's USDC ATA.",
        })

    if not _WALLET_RE.match(body.test_recipient_wallet):
        raise HTTPException(400, "Invalid recipient wallet")

    now_iso = datetime.now(timezone.utc).isoformat()
    synth_driver = f"ops_validator_{int(datetime.now(timezone.utc).timestamp())}"
    await db.users.update_one(
        {"user_id": synth_driver},
        {"$set": {
            "user_id": synth_driver,
            "email": f"{synth_driver}@ops.invalid",
            "solana_wallet_address": body.test_recipient_wallet,
            "solana_wallet_registered_at": now_iso,
        }}, upsert=True,
    )

    # 3. Seed the fare row directly — bypass /distribute to avoid
    # touching profit_share rails with test data.
    from routes.viberidez_fare_split import distribute_fare
    synth_ride = f"ops_validate_{synth_driver}"
    fare_row = await distribute_fare(
        db,
        ride_id=synth_ride,
        total_fare_usd=float(body.test_fare_usd),
        driver_id=synth_driver,
        rider_id=None,
    )

    # 4. Flip DRY_RUN off just for this tick.
    was_dry = os.environ.get("VIBEZ_PAYOUT_DRY_RUN", "1")
    os.environ["VIBEZ_PAYOUT_DRY_RUN"] = "0"
    try:
        tick_result = await payout_tick(db)
    finally:
        os.environ["VIBEZ_PAYOUT_DRY_RUN"] = was_dry

    # 6. Read the row back.
    final = await db.fare_distributions.find_one({"ride_id": synth_ride}, {"_id": 0})
    sig = (final or {}).get("driver_payout_tx_sig")
    return {
        "ok": bool(sig) and not str(sig).startswith("dryrun_"),
        "test_recipient_wallet": body.test_recipient_wallet,
        "synth_driver_id": synth_driver,
        "synth_ride_id": synth_ride,
        "driver_payout_usd": fare_row.get("driver_usd"),
        "tx_signature": sig,
        "explorer_url": (
            f"https://explorer.solana.com/tx/{sig}?cluster=devnet"
            if sig and not str(sig).startswith("dryrun_") else None
        ),
        "final_status": (final or {}).get("driver_payout_status"),
        "error": (final or {}).get("driver_payout_error"),
        "tick_summary": tick_result,
        "dry_run_restored_to": _cfg()["dry_run"],
    }

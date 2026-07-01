"""
Solana indexer — watches the GlobalVibe DSG treasury wallet and credits
₵ Vibez Coins to users whose deposit row's `memo` shows up in an incoming
on-chain SOL transfer.

How it works:
1. Polls Helius RPC every POLL_INTERVAL_S seconds for the most recent
   confirmed SOL transactions to the treasury wallet.
2. For each new tx, fetches the parsed transaction and walks its instructions
   looking for a Memo program instruction whose UTF-8 decoded value matches
   any pending `crypto_deposits` row's `memo` field (e.g. "GVZ-1a2b3c4d").
3. If a match is found AND the deposit is still `pending`, atomically:
     • mark the deposit `confirmed`
     • increment the user's `users.token_balance` by `amount_usd * 100`
       (1 USD = 100 ₵ Vibez Coins)
     • record the on-chain tx signature on the deposit row for auditing.
4. Persists a cursor (last_processed_signature) in `solana_indexer_state`
   so a restart doesn't double-credit.

If `GLOBAL_VIBEZ_SOLANA_RECEIVE_WALLET` is not set OR no Helius/Solana RPC
URL is configured, the loop exits cleanly — feature is opt-in.
"""
from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Dict, List, Optional

import httpx
from datetime import datetime, timezone

from utils.database import get_database

logger = logging.getLogger(__name__)

POLL_INTERVAL_S = 30  # seconds between RPC polls
MAX_BACKFILL_TX = 50  # cap on tx fetched per poll cycle

TREASURY_WALLET = os.environ.get("GLOBAL_VIBEZ_SOLANA_RECEIVE_WALLET", "").strip()
SOLANA_RPC_URL = (
    os.environ.get("HELIUS_RPC_URL")
    or os.environ.get("VIBEZ_SOLANA_RPC")
    or os.environ.get("SOLANA_RPC_URL")
    or ""
).strip()

# Solana memo program — canonical id only (used to spot the program in the
# parsed-instruction stream; matching is done via `program == 'spl-memo'`).
SPL_MEMO_PROGRAM = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"


async def _rpc(client: httpx.AsyncClient, method: str, params: List[Any]) -> Optional[Dict[str, Any]]:
    """Solana JSON-RPC call wrapper. Returns the `result` field or None."""
    try:
        r = await client.post(
            SOLANA_RPC_URL,
            json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
            timeout=15,
        )
        r.raise_for_status()
        data = r.json()
        if "error" in data:
            logger.warning(f"[solana-indexer] {method} rpc error: {data['error']}")
            return None
        return data.get("result")
    except Exception as e:
        logger.warning(f"[solana-indexer] {method} request failed: {e}")
        return None


def _extract_memo(parsed_tx: Dict[str, Any]) -> Optional[str]:
    """Walk the tx's instructions and return the first memo string we find."""
    if not parsed_tx:
        return None
    msg = parsed_tx.get("transaction", {}).get("message", {})
    for ix in msg.get("instructions", []):
        program = ix.get("program") or ix.get("programId")
        # jsonParsed encoding — memo program shows program=='spl-memo'
        if program == "spl-memo":
            parsed = ix.get("parsed")
            if isinstance(parsed, str):
                return parsed.strip()
            if isinstance(parsed, dict) and "memo" in parsed:
                return str(parsed["memo"]).strip()
        # Inner instructions sometimes carry the memo
        for inner in parsed_tx.get("meta", {}).get("innerInstructions", []) or []:
            for ix2 in inner.get("instructions", []) or []:
                if ix2.get("program") == "spl-memo":
                    parsed = ix2.get("parsed")
                    if isinstance(parsed, str):
                        return parsed.strip()
    # Fall back: log_messages often include "Program log: Memo (len X): \"...\""
    for line in parsed_tx.get("meta", {}).get("logMessages", []) or []:
        if "Memo" in line and '"' in line:
            try:
                return line.split('"', 1)[1].rsplit('"', 1)[0].strip()
            except Exception:
                pass
    return None


def _net_lamports_to_treasury(parsed_tx: Dict[str, Any], wallet: str) -> int:
    """How many lamports flowed INTO the treasury wallet in this tx (>=0)."""
    meta = parsed_tx.get("meta") or {}
    msg = parsed_tx.get("transaction", {}).get("message", {})
    keys = msg.get("accountKeys") or []
    pre = meta.get("preBalances") or []
    post = meta.get("postBalances") or []
    for i, k in enumerate(keys):
        addr = k if isinstance(k, str) else k.get("pubkey")
        if addr == wallet:
            try:
                return max(0, int(post[i]) - int(pre[i]))
            except (IndexError, ValueError, TypeError):
                return 0
    return 0


async def _credit_deposit(
    db,
    deposit: Dict[str, Any],
    signature: str,
    lamports: int,
) -> bool:
    """
    Atomically mark a deposit confirmed + bump the user's ₵ balance.
    Returns True if we actually credited (False if it was already confirmed).
    """
    # Idempotent guard
    res = await db.crypto_deposits.update_one(
        {"deposit_id": deposit["deposit_id"], "status": "pending"},
        {"$set": {
            "status": "confirmed",
            "confirmed_signature": signature,
            "confirmed_lamports": int(lamports),
            "confirmed_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    if res.modified_count != 1:
        return False  # someone else (or a previous run) beat us to it

    # 1 USD pledged → 100 ₵ Vibez Coins (matches the rest of the platform).
    coins = int(round(float(deposit.get("amount_usd", 0)) * 100))
    if coins > 0 and deposit.get("user_id"):
        await db.users.update_one(
            {"user_id": deposit["user_id"]},
            {"$inc": {"credits_balance": coins}},
            upsert=False,
        )
    logger.info(
        f"[solana-indexer] credited {coins} ₵ to user={deposit.get('user_id')} "
        f"deposit={deposit['deposit_id']} sig={signature[:10]}…"
    )

    # Profit-share accrual — +10 stakes per $1 deposited.
    try:
        from routes.profit_share import accrue_stake
        if deposit.get("user_id"):
            await accrue_stake(
                deposit["user_id"], "deposit_usd",
                amount=int(round(float(deposit.get("amount_usd", 0)))),
                meta={"deposit_id": deposit["deposit_id"]},
            )
    except Exception as e:
        logger.warning(f"[solana-indexer] stake accrual failed: {e}")
    return True


async def _process_tx(db, signature: str, wallet: str, client: httpx.AsyncClient) -> None:
    parsed = await _rpc(
        client,
        "getTransaction",
        [signature, {"encoding": "jsonParsed", "maxSupportedTransactionVersion": 0}],
    )
    if not parsed:
        return
    memo = _extract_memo(parsed)
    if not memo:
        return
    deposit = await db.crypto_deposits.find_one(
        {"memo": memo, "status": "pending"},
        {"_id": 0},
    )
    if not deposit:
        return
    lamports = _net_lamports_to_treasury(parsed, wallet)
    if lamports <= 0:
        return
    await _credit_deposit(db, deposit, signature, lamports)


async def _save_cursor(db, last_signature: str) -> None:
    await db.solana_indexer_state.update_one(
        {"_id": "treasury_cursor"},
        {"$set": {
            "last_signature": last_signature,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )


async def _load_cursor(db) -> Optional[str]:
    row = await db.solana_indexer_state.find_one({"_id": "treasury_cursor"})
    return (row or {}).get("last_signature")


async def solana_indexer_loop() -> None:
    """
    Long-running coroutine. Started in server.py on startup. Exits silently
    if the wallet or RPC env vars are unset (feature flag).
    """
    if not TREASURY_WALLET or not SOLANA_RPC_URL:
        logger.info(
            "[solana-indexer] disabled (set GLOBAL_VIBEZ_SOLANA_RECEIVE_WALLET "
            "and HELIUS_RPC_URL to enable)"
        )
        return

    logger.info(
        f"[solana-indexer] watching {TREASURY_WALLET[:6]}… every {POLL_INTERVAL_S}s"
    )

    db = get_database()
    async with httpx.AsyncClient() as client:
        while True:
            try:
                cursor = await _load_cursor(db)
                params: List[Any] = [TREASURY_WALLET, {"limit": MAX_BACKFILL_TX}]
                if cursor:
                    params[1]["until"] = cursor
                sigs = await _rpc(client, "getSignaturesForAddress", params)
                # sigs returns NEWEST first; reverse so we process oldest→newest.
                if sigs:
                    new_sig_for_cursor = sigs[0].get("signature")
                    for entry in reversed(sigs):
                        sig = entry.get("signature")
                        err = entry.get("err")
                        if not sig or err:
                            continue
                        await _process_tx(db, sig, TREASURY_WALLET, client)
                    if new_sig_for_cursor:
                        await _save_cursor(db, new_sig_for_cursor)
            except Exception as e:
                logger.warning(f"[solana-indexer] cycle error: {e}")
            await asyncio.sleep(POLL_INTERVAL_S)


# ───────────────────────── Admin / debug endpoints ──

from fastapi import APIRouter, HTTPException, Depends  # noqa: E402
from routes.admin_dashboard import verify_admin_cookie  # noqa: E402

router = APIRouter()


@router.get("/admin/solana-indexer/status")
async def indexer_status(_: bool = Depends(verify_admin_cookie)):
    """Read-only snapshot of the indexer state. Admin-gated."""
    db = get_database()
    cursor = await _load_cursor(db)
    pending = await db.crypto_deposits.count_documents(
        {"status": "pending", "network": "solana"}
    )
    confirmed = await db.crypto_deposits.count_documents(
        {"status": "confirmed", "network": "solana"}
    )
    return {
        "treasury_wallet": TREASURY_WALLET,
        "rpc_configured": bool(SOLANA_RPC_URL),
        "poll_interval_s": POLL_INTERVAL_S,
        "last_signature": cursor,
        "pending_deposits": pending,
        "confirmed_deposits": confirmed,
    }


@router.post("/admin/solana-indexer/manual-credit/{deposit_id}")
async def manual_credit(
    deposit_id: str,
    signature: str = "MANUAL_ADMIN",
    _: bool = Depends(verify_admin_cookie),
):
    """
    Admin override — manually mark a deposit confirmed + credit ₵ balance.
    Useful when a user paid out-of-band (wire transfer, partner promo) or
    when a memo was lost on-chain. Idempotent.

    Stamps `confirmed_method='manual_admin'` on the row so audits can
    distinguish indexer-confirmed vs human-confirmed deposits.
    """
    # Sanitize the signature to a small alphanumeric audit string.
    import re
    if not re.fullmatch(r"[A-Za-z0-9_\-:]{1,128}", signature):
        signature = "MANUAL_ADMIN"

    db = get_database()
    deposit = await db.crypto_deposits.find_one(
        {"deposit_id": deposit_id, "status": "pending"},
        {"_id": 0},
    )
    if not deposit:
        raise HTTPException(404, detail="Pending deposit not found")
    credited = await _credit_deposit(db, deposit, signature, 0)
    if credited:
        await db.crypto_deposits.update_one(
            {"deposit_id": deposit_id},
            {"$set": {"confirmed_method": "manual_admin"}},
        )
    return {"ok": True, "credited": credited, "deposit_id": deposit_id}


# ───────────── Sweep old wallet → new treasury wallet (safety net) ──
#
# When the platform's receive wallet is rotated, occasional users may still
# send funds to the *old* address (cached QR code, copy-paste habit, etc.).
# Without a signing key on-server we can't move those funds programmatically,
# but we can:
#   1. Show the admin the live balance of the old wallet so they know how
#      much is stranded.
#   2. Generate a copy-paste-ready transfer payload (recipient = current
#      treasury, amount = full balance minus a small fee buffer) so the
#      founder can sign + broadcast it from Phantom / Squads UI.
#
# This is a *one-shot manual safety net*, NOT continuous indexing. Use the
# Squads UI for repeated sweeps once the multisig is fully wired.

import re as _re_sweep  # avoid clobbering local imports

_SOLANA_BASE58_RE = _re_sweep.compile(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$")
# Reserve a small SOL buffer for the rent-exempt minimum + tx fee so the
# sweep doesn't fail with "InsufficientFundsForRent". 0.001 SOL = 1_000_000
# lamports is comfortable for any standard transfer.
_SWEEP_FEE_BUFFER_LAMPORTS = 1_000_000


def _is_solana_address(addr: str) -> bool:
    return bool(addr) and bool(_SOLANA_BASE58_RE.match(addr))


@router.get("/admin/solana-indexer/sweep-balance")
async def sweep_old_wallet_balance(
    old_wallet: str,
    _: bool = Depends(verify_admin_cookie),
):
    """Return the live SOL balance of an *old* receive wallet so the
    founder can decide whether to sweep it back to the current treasury.

    Read-only — no signing happens here. The caller is expected to be the
    admin / God-Mode dashboard. Both `old_wallet` and the current treasury
    address are validated as base58 Solana addresses to prevent CSRF
    abuse via crafted query params.
    """
    if not SOLANA_RPC_URL:
        raise HTTPException(503, detail="Solana RPC URL not configured")
    if not _is_solana_address(old_wallet):
        raise HTTPException(400, detail="old_wallet is not a valid Solana address")

    async with httpx.AsyncClient() as client:
        result = await _rpc(client, "getBalance", [old_wallet])
    if result is None:
        raise HTTPException(502, detail="RPC getBalance failed")
    lamports = int(result.get("value", 0)) if isinstance(result, dict) else int(result)
    sweepable = max(0, lamports - _SWEEP_FEE_BUFFER_LAMPORTS)

    return {
        "old_wallet": old_wallet,
        "current_treasury": TREASURY_WALLET or None,
        "balance_lamports": lamports,
        "balance_sol": round(lamports / 1_000_000_000, 9),
        "sweepable_lamports": sweepable,
        "sweepable_sol": round(sweepable / 1_000_000_000, 9),
        "fee_buffer_lamports": _SWEEP_FEE_BUFFER_LAMPORTS,
    }


@router.post("/admin/solana-indexer/sweep-instructions")
async def sweep_old_wallet_instructions(
    old_wallet: str,
    _: bool = Depends(verify_admin_cookie),
):
    """Return a structured "sweep this old wallet" instruction set the
    founder can paste into Phantom / Squads UI. We cannot sign it
    server-side because the old wallet's private key is held by the
    founder, not the server — that's the whole point of non-custodial
    treasury rotation.

    The response is shaped so the admin UI can render a "copy" button
    next to each field (recipient, amount, memo).
    """
    if not _is_solana_address(old_wallet):
        raise HTTPException(400, detail="old_wallet is not a valid Solana address")
    if not TREASURY_WALLET or not _is_solana_address(TREASURY_WALLET):
        raise HTTPException(503, detail="Current treasury wallet not configured")
    if old_wallet == TREASURY_WALLET:
        raise HTTPException(400, detail="old_wallet must differ from current treasury")

    if not SOLANA_RPC_URL:
        raise HTTPException(503, detail="Solana RPC URL not configured")
    async with httpx.AsyncClient() as client:
        result = await _rpc(client, "getBalance", [old_wallet])
    lamports = 0
    if isinstance(result, dict):
        lamports = int(result.get("value", 0))
    elif isinstance(result, int):
        lamports = result
    sweepable = max(0, lamports - _SWEEP_FEE_BUFFER_LAMPORTS)

    return {
        "from": old_wallet,
        "to": TREASURY_WALLET,
        "amount_lamports": sweepable,
        "amount_sol": round(sweepable / 1_000_000_000, 9),
        "memo": f"GVZ-SWEEP-{datetime.now(timezone.utc).strftime('%Y%m%d')}",
        "instructions": [
            "Open Phantom (or Squads UI) and connect the OLD treasury wallet.",
            f"Send {round(sweepable / 1_000_000_000, 6)} SOL to the current"
            " treasury address shown above.",
            "Add the memo so this sweep is auditable in the on-chain explorer.",
            "Confirm the transaction. The Solana indexer will pick it up on"
            " the next 30s poll cycle and reflect it in the Treasury ledger.",
        ],
    }

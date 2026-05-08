"""
Squads multi-sig — on-chain READ-ONLY status helpers.

Surfaces the live Squads vault state (network, balance, cosigners,
threshold) without holding any signing keys. The actual signing flow
(Phantom + Ledger 2-of-2) lives entirely on the client; the server only
*observes* the on-chain account so the operator dashboard can show
real treasury numbers instead of stale DB-only reserves.

ENV (all optional — feature is fully off if `SQUADS_VAULT_PDA` is unset):
  • SQUADS_NETWORK            — "mainnet" | "devnet"
  • SQUADS_VAULT_PDA          — Vault PDA (the on-chain account that holds funds)
  • SQUADS_ADDRESS            — Squad address (the multisig label account)
  • SQUADS_PHANTOM_COSIGNER   — Member 2 (software signer, base58)
  • SQUADS_THRESHOLD          — int, e.g. "2" for 2-of-2
  • SQUADS_MEMBER_COUNT       — int, e.g. "2"
  • SOLANA_MAINNET_RPC        — full URL incl api-key for mainnet RPC
  • VIBEZ_SOLANA_RPC          — devnet RPC URL (already used by the indexer)
"""
from __future__ import annotations

import logging
import os
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger(__name__)


def _env(key: str, default: str = "") -> str:
    return (os.environ.get(key) or "").strip() or default


def _network() -> str:
    """Lower-case network label. Defaults to devnet for safety."""
    return _env("SQUADS_NETWORK", "devnet").lower()


def _rpc_url() -> str:
    """Pick the right RPC URL based on the configured network."""
    if _network() == "mainnet":
        return _env("SOLANA_MAINNET_RPC")
    return _env("VIBEZ_SOLANA_RPC") or _env("SOLANA_RPC_URL") or ""


def is_configured() -> bool:
    """Return True if the minimum env is set to do on-chain reads."""
    return bool(_env("SQUADS_VAULT_PDA")) and bool(_rpc_url())


async def _get_balance_lamports(client: httpx.AsyncClient, addr: str) -> Optional[int]:
    """Wrapper around `getBalance` returning lamports or None on error.

    Errors are swallowed and logged so a transient RPC blip doesn't cascade
    into a 5xx on the admin dashboard — the UI already renders gracefully
    when the on-chain block is missing.
    """
    rpc = _rpc_url()
    if not rpc or not addr:
        return None
    try:
        r = await client.post(
            rpc,
            json={"jsonrpc": "2.0", "id": 1, "method": "getBalance", "params": [addr]},
            timeout=8,
        )
        r.raise_for_status()
        data = r.json()
        if "error" in data:
            logger.warning(f"[squads] getBalance rpc error: {data['error']}")
            return None
        result = data.get("result", {})
        if isinstance(result, dict):
            return int(result.get("value", 0))
        return int(result) if result else None
    except Exception as exc:
        logger.warning(f"[squads] getBalance failed for {addr[:8]}…: {exc}")
        return None


async def get_squads_status() -> Dict[str, Any]:
    """Build the public Squads status payload for the admin dashboard.

    Always returns a dict — even when not configured — so the frontend
    can use the same shape and just render an "unconfigured" state.
    """
    vault_pda = _env("SQUADS_VAULT_PDA")
    squad_addr = _env("SQUADS_ADDRESS")
    phantom = _env("SQUADS_PHANTOM_COSIGNER")
    founder = _env("SQUADS_FOUNDER_COSIGNER")
    network = _network()
    threshold = int(_env("SQUADS_THRESHOLD") or 0)
    member_count = int(_env("SQUADS_MEMBER_COUNT") or 0)

    payload: Dict[str, Any] = {
        "configured": is_configured(),
        "network": network,
        "is_mainnet": network == "mainnet",
        "vault_pda": vault_pda or None,
        "squad_address": squad_addr or None,
        "phantom_cosigner": phantom or None,
        "founder_cosigner": founder or None,
        "threshold": threshold or None,
        "member_count": member_count or None,
        "vault_balance_lamports": None,
        "vault_balance_sol": None,
        "rpc_ok": False,
    }

    if not is_configured():
        return payload

    async with httpx.AsyncClient() as client:
        lamports = await _get_balance_lamports(client, vault_pda)

    if lamports is not None:
        payload["vault_balance_lamports"] = lamports
        payload["vault_balance_sol"] = round(lamports / 1_000_000_000, 9)
        payload["rpc_ok"] = True

    return payload

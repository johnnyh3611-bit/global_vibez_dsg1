"""
Live Solana SPL minting for $DSG TGE.

Activates when VIBEZ_TGE_MODE=devnet or mainnet-beta AND
VIBEZ_TOKEN_MINT_ADDRESS + VIBEZ_TREASURY_SECRET are set.

Each mint is a self-contained transaction signed by the treasury keypair:
  1. Derive recipient's Associated Token Account (ATA).
  2. If ATA doesn't exist, create it.
  3. Send MintToChecked instruction for the amount scaled to token decimals.
  4. Await confirmation, return transaction signature.

Amounts are rounded at the smallest unit — e.g. decimals=9 means
1 $DSG = 10^9 base units. Fractions below that are floored.
"""
from __future__ import annotations

import os
import asyncio
import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

# Network → RPC endpoint map. Overridden by VIBEZ_SOLANA_RPC if set.
RPC_ENDPOINTS = {
    "devnet": "https://api.devnet.solana.com",
    "mainnet-beta": "https://api.mainnet-beta.solana.com",
}

DEFAULT_TOKEN_DECIMALS = int(os.environ.get("VIBEZ_TOKEN_DECIMALS", "9"))
CONFIRMATION_COMMITMENT = os.environ.get("VIBEZ_CONFIRMATION", "confirmed")


def _get_rpc_url(network: str) -> str:
    override = os.environ.get("VIBEZ_SOLANA_RPC", "").strip()
    if override:
        return override
    return RPC_ENDPOINTS.get(network, RPC_ENDPOINTS["devnet"])


async def mint_one(
    recipient_wallet: str,
    amount_vibez: float,
    *,
    network: str,
    token_mint_address: str,
    treasury_secret_b58: str,
    decimals: int = DEFAULT_TOKEN_DECIMALS,
) -> Dict[str, Any]:
    """
    Mint `amount_vibez` $DSG to `recipient_wallet`.

    Returns {ok, signature, recipient, amount, error?} — never raises so the
    batch caller can keep going on per-wallet failures.
    """
    # Lazy imports — solana/solders are only needed in live modes.
    from solana.rpc.async_api import AsyncClient
    from solana.rpc.types import TxOpts
    from solders.keypair import Keypair
    from solders.pubkey import Pubkey
    from solders.message import MessageV0
    from solders.transaction import VersionedTransaction
    from spl.token.constants import TOKEN_PROGRAM_ID
    from spl.token.instructions import (
        MintToCheckedParams,
        mint_to_checked,
        get_associated_token_address,
        create_associated_token_account,
    )

    base_units = int(amount_vibez * (10 ** decimals))
    if base_units <= 0:
        return {
            "ok": False,
            "recipient": recipient_wallet,
            "amount": amount_vibez,
            "error": "amount rounds to zero base units",
        }

    try:
        import base58
        treasury = Keypair.from_bytes(base58.b58decode(treasury_secret_b58))
    except Exception as e:
        return {"ok": False, "recipient": recipient_wallet, "amount": amount_vibez, "error": f"treasury keypair invalid: {e}"}

    try:
        recipient_pk = Pubkey.from_string(recipient_wallet)
    except Exception as e:
        return {"ok": False, "recipient": recipient_wallet, "amount": amount_vibez, "error": f"invalid wallet: {e}"}

    try:
        mint_pk = Pubkey.from_string(token_mint_address)
    except Exception as e:
        return {"ok": False, "recipient": recipient_wallet, "amount": amount_vibez, "error": f"invalid mint address: {e}"}

    rpc_url = _get_rpc_url(network)
    client = AsyncClient(rpc_url)
    try:
        ata = get_associated_token_address(owner=recipient_pk, mint=mint_pk)

        # Check if ATA exists; include create-ix if not.
        instructions: List[Any] = []
        account_info = await client.get_account_info(ata)
        if account_info.value is None:
            instructions.append(
                create_associated_token_account(
                    payer=treasury.pubkey(),
                    owner=recipient_pk,
                    mint=mint_pk,
                )
            )

        # MintToChecked — validates decimals server-side to prevent scaling bugs.
        instructions.append(
            mint_to_checked(
                MintToCheckedParams(
                    program_id=TOKEN_PROGRAM_ID,
                    mint=mint_pk,
                    dest=ata,
                    mint_authority=treasury.pubkey(),
                    amount=base_units,
                    decimals=decimals,
                    signers=[],
                )
            )
        )

        blockhash = (await client.get_latest_blockhash()).value.blockhash
        msg = MessageV0.try_compile(
            payer=treasury.pubkey(),
            instructions=instructions,
            address_lookup_table_accounts=[],
            recent_blockhash=blockhash,
        )
        tx = VersionedTransaction(msg, [treasury])

        resp = await client.send_transaction(
            tx,
            opts=TxOpts(skip_preflight=False, preflight_commitment=CONFIRMATION_COMMITMENT),
        )
        sig = resp.value
        # Wait for confirmation (bounded — blockhash expires in ~90s)
        await client.confirm_transaction(sig, commitment=CONFIRMATION_COMMITMENT)

        return {
            "ok": True,
            "recipient": recipient_wallet,
            "amount": amount_vibez,
            "base_units": base_units,
            "ata": str(ata),
            "signature": str(sig),
        }
    except Exception as e:
        logger.exception(f"[tge] mint failed for {recipient_wallet}: {e}")
        return {
            "ok": False,
            "recipient": recipient_wallet,
            "amount": amount_vibez,
            "error": str(e),
        }
    finally:
        try:
            await client.close()
        except Exception:
            pass


async def live_mint_batch(
    rows: List[Dict[str, Any]],
    *,
    network: str,
    token_mint_address: str,
    treasury_secret_b58: str,
    decimals: int = DEFAULT_TOKEN_DECIMALS,
    concurrency: int = 5,
) -> List[Dict[str, Any]]:
    """
    Mint to each row sequentially (bounded concurrency) and return per-row
    results. `rows` entries must have {wallet, total_vibez}.
    """
    sem = asyncio.Semaphore(max(1, concurrency))

    async def _one(row: Dict[str, Any]) -> Dict[str, Any]:
        async with sem:
            return await mint_one(
                recipient_wallet=row["wallet"],
                amount_vibez=float(row["total_vibez"]),
                network=network,
                token_mint_address=token_mint_address,
                treasury_secret_b58=treasury_secret_b58,
                decimals=decimals,
            )

    results = await asyncio.gather(*(_one(r) for r in rows))
    return list(results)


async def ping_rpc(network: str) -> Dict[str, Any]:
    """Lightweight readiness check — used by the admin banner."""
    from solana.rpc.async_api import AsyncClient

    url = _get_rpc_url(network)
    client = AsyncClient(url)
    try:
        h = await client.get_block_height()
        return {"ok": True, "rpc": url, "block_height": int(h.value)}
    except Exception as e:
        return {"ok": False, "rpc": url, "error": str(e)}
    finally:
        try:
            await client.close()
        except Exception:
            pass

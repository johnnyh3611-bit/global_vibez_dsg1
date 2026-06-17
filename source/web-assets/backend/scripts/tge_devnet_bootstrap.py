"""
One-shot devnet bootstrap for $DSG TGE:
1. Generate (or load) the treasury keypair.
2. Airdrop 2 SOL on devnet.
3. Create the SPL mint (decimals=9) with the treasury as mint authority.
4. Persist {VIBEZ_TOKEN_MINT_ADDRESS, VIBEZ_TREASURY_SECRET} to backend/.env.
5. Print the Solana Explorer URL for the new mint.

Run:  python scripts/tge_devnet_bootstrap.py
"""
import asyncio
import json
import os
from pathlib import Path

import base58
from solders.keypair import Keypair
from solana.rpc.async_api import AsyncClient
from spl.token.async_client import AsyncToken
from spl.token.constants import TOKEN_PROGRAM_ID


def _kp_to_b58(kp: Keypair) -> str:
    return base58.b58encode(bytes(kp)).decode("utf-8")


def _kp_from_b58(b58: str) -> Keypair:
    return Keypair.from_bytes(base58.b58decode(b58))


BACKEND_ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = BACKEND_ROOT / ".env"
KEYSTORE_FILE = BACKEND_ROOT / "tge_treasury.json"  # gitignored — local only
# Respect VIBEZ_SOLANA_RPC override (e.g. Helius key) so we bypass the
# public devnet faucet's tight rate limits.
_env_rpc = os.environ.get("VIBEZ_SOLANA_RPC", "").strip()
if not _env_rpc and ENV_FILE.exists():
    for _line in ENV_FILE.read_text().splitlines():
        if _line.startswith("VIBEZ_SOLANA_RPC="):
            _env_rpc = _line.split("=", 1)[1].strip().strip('"').strip("'")
            break
RPC_URL = _env_rpc or "https://api.devnet.solana.com"
DECIMALS = 9


async def load_or_create_treasury() -> Keypair:
    if KEYSTORE_FILE.exists():
        data = json.loads(KEYSTORE_FILE.read_text())
        kp = _kp_from_b58(data["secret_base58"])
        print(f"[bootstrap] Loaded existing treasury: {kp.pubkey()}")
        return kp
    kp = Keypair()
    KEYSTORE_FILE.write_text(json.dumps({
        "pubkey": str(kp.pubkey()),
        "secret_base58": _kp_to_b58(kp),
    }, indent=2))
    print(f"[bootstrap] Generated new treasury: {kp.pubkey()}")
    return kp


async def ensure_funded(client: AsyncClient, treasury: Keypair) -> None:
    bal = (await client.get_balance(treasury.pubkey())).value
    print(f"[bootstrap] Treasury balance: {bal / 1e9:.4f} SOL")
    if bal >= 1_500_000_000:  # 1.5 SOL already
        return
    last_err: Exception | None = None
    # Devnet airdrops via the default RPC are heavily rate-limited.
    # Try a few times with smaller amounts + backoff.
    for i, lamports in enumerate([1_000_000_000, 1_000_000_000, 500_000_000, 500_000_000]):
        try:
            print(f"[bootstrap] Airdrop attempt {i + 1}: {lamports / 1e9} SOL...")
            sig = await client.request_airdrop(treasury.pubkey(), lamports)
            await client.confirm_transaction(sig.value, commitment="confirmed")
            bal = (await client.get_balance(treasury.pubkey())).value
            print(f"[bootstrap] Balance: {bal / 1e9:.4f} SOL")
            if bal >= 1_500_000_000:
                return
        except Exception as e:
            last_err = e
            print(f"[bootstrap]   ...failed ({e!r}), retrying in 3s")
            await asyncio.sleep(3)
    if bal < 500_000_000:
        raise RuntimeError(
            f"Unable to fund treasury via devnet RPC airdrop. "
            f"Last error: {last_err}. "
            f"Alternatives: visit https://faucet.solana.com and airdrop to {treasury.pubkey()} "
            "manually, or set VIBEZ_SOLANA_RPC to a Helius/QuickNode devnet endpoint and rerun."
        )


async def create_mint(client: AsyncClient, treasury: Keypair) -> str:
    print(f"[bootstrap] Creating SPL mint (decimals={DECIMALS})...")
    token = await AsyncToken.create_mint(
        conn=client,
        payer=treasury,
        mint_authority=treasury.pubkey(),
        decimals=DECIMALS,
        program_id=TOKEN_PROGRAM_ID,
        freeze_authority=None,
    )
    mint_pk = str(token.pubkey)
    print(f"[bootstrap] Mint created: {mint_pk}")
    print(f"[bootstrap] Explorer: https://explorer.solana.com/address/{mint_pk}?cluster=devnet")
    return mint_pk


def patch_env(mint_address: str, treasury_secret_b58: str) -> None:
    """Merge the TGE env vars into backend/.env without touching other keys."""
    existing: dict[str, str] = {}
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                existing[k.strip()] = v
    existing["VIBEZ_TGE_MODE"] = "devnet"
    existing["VIBEZ_TOKEN_MINT_ADDRESS"] = mint_address
    existing["VIBEZ_TREASURY_SECRET"] = treasury_secret_b58
    existing["VIBEZ_TOKEN_DECIMALS"] = str(DECIMALS)
    ENV_FILE.write_text("\n".join(f"{k}={v}" for k, v in existing.items()) + "\n")
    print(f"[bootstrap] Patched {ENV_FILE}")


async def main() -> None:
    treasury = await load_or_create_treasury()
    async with AsyncClient(RPC_URL) as client:
        await ensure_funded(client, treasury)
        mint_address = await create_mint(client, treasury)
    patch_env(mint_address, _kp_to_b58(treasury))
    print("\n✅ Devnet TGE bootstrap complete.")
    print(f"   Mint:     {mint_address}")
    print(f"   Treasury: {treasury.pubkey()}")


if __name__ == "__main__":
    asyncio.run(main())

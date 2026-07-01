# Vibez Rewards — Solana / Anchor on-chain program

On-chain $DSG mint program for Global Vibez DSG. The Python backend
already has a working off-chain mint path via `services/solana_minter.py`
that signs `MintToChecked` instructions directly. **This Anchor program
is optional and a future-facing alternative** that lets you push an
auditable, version-controlled smart contract to Solana so any third
party can verify the issuance logic on-chain.

## Build / deploy (run on your own machine — NOT inside this container)

```bash
# 1. Install Anchor (Solana 1.18 + Rust + Anchor 0.30)
curl --proto '=https' --tlsv1.2 -sSfL https://release.anza.xyz/stable/install | sh
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install 0.30.1 && avm use 0.30.1

# 2. Build
cd /path/to/this/folder
anchor build

# 3. Generate program keypair (or reuse an existing one)
solana-keygen new -o target/deploy/vibez_rewards-keypair.json
solana address -k target/deploy/vibez_rewards-keypair.json
# → paste this pubkey into both `declare_id!()` and Anchor.toml

# 4. Deploy to devnet
solana config set --url https://api.devnet.solana.com
solana airdrop 2          # for fees
anchor deploy

# 5. Initialize the $DSG mint (one-time)
spl-token create-token --decimals 9
spl-token create-account <MINT_ADDRESS>
spl-token mint <MINT_ADDRESS> 1000000   # initial supply

# 6. Wire to backend
echo "VIBEZ_TOKEN_MINT_ADDRESS=<MINT_ADDRESS>" >> /app/backend/.env
echo "VIBEZ_TREASURY_SECRET=<base58 secret key>" >> /app/backend/.env
echo "VIBEZ_PAYOUT_NETWORK=devnet" >> /app/backend/.env
sudo supervisorctl restart backend
```

## Program-level invariants

- Only the registered God-Mode admin signer can call `issue_reward`.
- `MintTo` mutates the player's existing ATA; if the ATA doesn't exist
  yet, the off-chain caller must pre-create it (the Python `mint_one`
  flow already handles this).
- Amounts are u64 base units; the Python backend handles decimals
  conversion (₵ → 10^9 base units).

## When to flip the platform from Python-side mint to Anchor mint

Today: Python `mint_one` already writes the same `MintToChecked`
instruction. Switching to this Anchor program adds:
- An on-chain authority list (multi-sig admin support).
- Auditable instruction logs (`msg!` lines).
- Composability — other Solana programs can CPI into our reward issuance.

It is **not required** for live $DSG payouts. Treat as P3.

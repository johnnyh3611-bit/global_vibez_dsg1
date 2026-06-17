# VibeRidez Fare Splitter — Solana Anchor Program

**Status:** SCAFFOLD ONLY — not yet deployed. The off-chain canonical
implementation lives in `/app/backend/routes/viberidez_fare_split.py`
and currently powers every live ride. This Rust program mirrors that
exact split logic so it can be deployed to devnet (then mainnet)
without a behavioral diff once auditing is complete.

## Why scaffold now?

The off-chain splitter is the source of truth for production
revenue today. The on-chain program is here so:

1. The community can **audit the math against the same code that runs**
   off-chain — they're the same percentages, same rounding rules.
2. When the founder is ready to flip the switch ("`domains`" safe
   word + Mainnet TGE), this folder is the deploy target.
3. Future integrations (Squads multisig, on-chain dispute resolution,
   trust-less driver payouts) can call this program directly.

## Locked split

```
Pre-Escape Velocity                Post-Escape Velocity
───────────────────                ────────────────────
🚗 Driver         70%              🚗 Driver         70%   (NEVER moves)
💺 Chair pool     14%              💺 Chair pool     30%
🏛️  Platform       8.5%             🏛️  Platform       0%
🛡️  Insurance      5%               🛡️  Insurance      0%
🎁 Referrals      2.5%             🎁 Referrals      0%
                 100%                              100%
```

## Tokens

- **Driver payout**: USDC SPL token (devnet then mainnet). Stable,
  drivers can cash out instantly. The off-chain `driver_payout_status`
  field on each `fare_distributions` row will be flipped to `paid`
  once the on-chain transfer settles.
- **Chair-pool, platform, insurance, referral**: routed through the
  existing `profit_share_balances` rails on the backend. On-chain we
  just emit events for transparency; settlement happens off-chain.

## Layout

```
onchain/viberidez_fare_splitter/
├── Cargo.toml          # Anchor 0.30 program manifest
├── Xargo.toml          # cross-compile shim (Anchor convention)
├── programs/
│   └── viberidez_fare_splitter/
│       ├── Cargo.toml
│       └── src/
│           └── lib.rs  # The actual program
└── README.md           # this file
```

## Build (later, when we go on-chain)

```sh
# Install Anchor 0.30
avm install 0.30.0 && avm use 0.30.0
# Build the program
cd onchain/viberidez_fare_splitter
anchor build
# Deploy to devnet
anchor deploy --provider.cluster devnet
```

## Tests

The program has not been compiled or tested in this repo (no
Rust/Anchor toolchain in the sandbox). When we deploy, expected test
matrix:

1. `distribute_fare(10_000_000)` (10 USDC, 6 decimals) →
   driver=7_000_000, chair=1_400_000, platform=850_000, insurance=500_000,
   referral=250_000. Sum = 10_000_000.
2. Replay-protection: same `ride_id` PDA → tx fails with
   `FareAlreadyDistributed`.
3. Post-EV flag flip → 70/30/0/0/0 split lands.

Reference test vectors in `routes/viberidez_fare_split.py` (sanity
check at module import time).

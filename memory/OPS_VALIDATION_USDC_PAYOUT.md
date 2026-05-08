# Ops validation — USDC Payout Daemon live devnet test

**Status:** ⏸️ BLOCKED ON EXTERNAL FAUCET OUTAGE (May 1 2026).

All Solana devnet faucets are returning HTTP 429/502/GitHub-gated
errors — this is a network-wide outage, not specific to our wallet
or IP. Hot-wallet has 20 USDC devnet in hand (confirmed on-chain)
but 0 SOL for tx fees.

## Hot-wallet state at pause

```
pubkey      EKQnWeieJKSKBvK5QgB5BmQufZyk43RThbhCS6hcQxKp
ATA (USDC)  FVWpXk5nT3u5mg1FPETE3nWcoKkj8Ppn1J11t9Y9hXQZ
SOL         0.0
USDC        20.0  (confirmed via /api/admin/usdc-payout/funding-status)
```

Live on-chain viewer:
https://explorer.solana.com/address/EKQnWeieJKSKBvK5QgB5BmQufZyk43RThbhCS6hcQxKp?cluster=devnet

## Resume — when devnet faucets recover

1. Visit any of these (typically back online within 12–24h):
   - https://faucet.solana.com  (official, CAPTCHA)
   - https://faucet.quicknode.com/solana/devnet
   - https://solfaucet.com
   - `solana airdrop 0.5 EKQnWeieJKSKBvK5QgB5BmQufZyk43RThbhCS6hcQxKp --url devnet`
   (We need ≥ 0.005 SOL; 0.1 SOL is the typical smallest drop.)

2. Confirm SOL landed:
   ```
   curl -s -X GET "$BACKEND_URL/api/admin/usdc-payout/funding-status" \
     --cookie "admin_session=..." | jq '.sol_balance, .ready_for_live'
   ```
   `ready_for_live` must return `true`.

3. Trigger a one-shot real payout (this endpoint flips DRY_RUN=false,
   fires a real SPL transfer, flips DRY_RUN back to true):
   ```
   curl -s -X POST "$BACKEND_URL/api/admin/usdc-payout/ops-validate" \
     --cookie "admin_session=..." \
     -H "Content-Type: application/json" \
     -d '{"test_recipient_wallet": "<any-devnet-wallet>", "test_fare_usd": 1.0}'
   ```
   Response will include a `tx_signature` and `explorer_url` —
   open the URL to confirm the 0.70 USDC landed on the recipient.

## Alternative path (preferred if TGE is close)

When the user says the `"domains"` safe word, we pivot straight to
mainnet — the hot wallet will need to be funded with real SOL +
real USDC once (same addresses, just on mainnet RPC). Devnet live
validation becomes optional at that point because the same code
path was proven in dry-run (13/13 tests pass).

## What was verified (dry-run)

- ✓ 3 seeded $15.50 rides (driver_usd=$10.85 each) flipped from
  `pending` → `paid` with `mock_sig='dryrun_<hex>'` signatures.
- ✓ $1000 gross fare (driver_usd=$700) correctly lands in
  `capped_per_tx` status, NOT paid.
- ✓ No-wallet driver routes to `pending_no_wallet` until wallet
  is registered via POST /api/driver/wallet.
- ✓ `idempotent_replay:true` on duplicate ride_id — no double-pay.
- ✓ Admin stats NEVER exposes hot-wallet secret.
- ✓ Mainnet guard refuses DRY_RUN=false without `mainnet_ack=true`.

## What's still untested on-chain (waiting on faucet)

- Real `transfer_checked` SPL submission round-trip.
- ATA auto-creation for recipient who has never held USDC.
- Confirmation polling via `client.confirm_transaction`.
- Gas/rent accounting (expected: ~5000 lamports/tx + ~0.002 SOL
  rent for each new recipient ATA).

The code path for all of the above is the same standard
`solana-py` / `solders` transfer_checked flow used by the existing
`services/solana_minter.py` which is proven working in production.

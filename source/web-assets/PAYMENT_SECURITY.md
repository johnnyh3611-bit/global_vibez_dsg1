# Payment Security & PCI Compliance (Global Vibez)

**Card rail = Helio (MoonPay Commerce) only.** Solana deposits never touch card data.  
**We do not use Stripe for coin top-up or wallet card checkout.**

## 1. Tokenization — never handle raw cards

| Rule | How we enforce it |
|------|-------------------|
| No PAN / CVV on our servers | Card entry is the **Helio embed / hosted charge page** only |
| No card fields in Mongo | Audit + webhook stores keep charge ids, amounts, status — never PAN/CVC |
| Prefer Solana for open access | Wallet UI puts Solana first; Helio card is Founding-Member gated in beta |

**Do not add** custom card number / CVV inputs to the SPA. If Helio’s embed isn’t configured, show Solana — do not invent a card form.

## 2. TLS / SSL (client ↔ FastAPI)

Every production request must be HTTPS:

| Surface | Expectation |
|---------|-------------|
| Railway API | Public domain auto-provisions TLS (`https://…up.railway.app`) |
| Vercel frontend | `https://www.globalvibezdsg.com` |
| `REACT_APP_BACKEND_URL` | Must be `https://…` in production builds |

```bash
curl -sSI https://YOUR-API/health | head -n 5
openssl s_client -connect YOUR-API-HOST:443 -servername YOUR-API-HOST </dev/null 2>/dev/null | openssl x509 -noout -dates
```

## 3. Data minimization

Store only what support needs to reconcile:

- `user_id`, pack id, USD amount, coins, Helio `charge_id` / `payment_id`, status, timestamps
- Do **not** store full card numbers, CVV, or full billing PAN copies

## 4. Fraud protection (via Helio / MoonPay)

Fraud controls (AVS, CVV, 3DS, Radar-equivalent) run **inside Helio / MoonPay** before settlement. We:

- Never accept an unsigned Helio webhook
- Credit coins only after a verified SUCCESS/COMPLETED-style event
- Log every attempt (created / rejected_signature / credited) in `payments_audit`

Configure AVS/CVV and risk rules in the Helio / MoonPay Commerce dashboard — not in our app.

## 5. Webhook security (Helio)

| Endpoint | Verification |
|----------|--------------|
| `POST /api/coins/webhook/helio` | Bearer `HELIO_WEBHOOK_TOKEN` and/or HMAC; **fail closed** in production if token unset |

Never trust a Helio payment event without a valid signature/token.

Legacy `POST /api/coins/topup/checkout` (Stripe) returns **410 Gone**.

## 6. Audit logging

Collection: `payments_audit` (append-only, unique `event_id`).

Record at minimum:

- Helio checkout **created**
- Webhook **received** / **rejected_signature**
- Coin **credited**

Admin UI: `/admin/payments-audit`.

## 7. Founding Member beta rollout

Env:

```bash
PAYMENT_BETA_MODE=true
PAYMENT_BETA_ALLOWLIST=alice@example.com,bob@example.com
PAYMENT_SUPPORT_EMAIL=payments-beta@globalvibezdsg.com
PAYMENT_SUPPORT_DISCORD=https://discord.gg/globalvibez
HELIO_WEBHOOK_TOKEN=<required in production>
HELIO_NETWORK=test   # until sandbox credits reconcile, then main
# optional hard-fail for Helio even in staging:
# PAYMENTS_REQUIRE_WEBHOOK_AUTH=1
```

When beta mode is on (default in `ENVIRONMENT=production` until set `false`):

- Helio card checkout requires Founding Member / allowlist / beta tester / admin
- Solana deposits stay open for everyone
- UI shows **Beta Payment Environment** + support links

Start with **20–50** Founding Members. Open the gate only after live Helio credits reconcile.

## 8. Founding Member Top-Up Workflow (live staging)

Staging host: `https://www.globalvibezdsg.com` → API `https://globalvibezdsg1-production.up.railway.app`.

| Prep check | Status |
|------------|--------|
| Frontend bake points at Railway API (not localhost) | Verified in `main.*.js` |
| `HELIO_*` present (`integrations/health` → helio configured) | Verified (api/secret/paylink/webhook token) |
| Helio dashboard Payload URL | Must be `…/api/coins/webhook/helio` (HMAC via `HELIO_WEBHOOK_TOKEN`) |
| Spoof webhook → 401 | Verified live |

**Happy path (Solana):** Demo Login (`demo@globalvibez.com` is beta-allowed). Popular pack ₵10,000 / $9 mints deposit + `GVZ-*` memo. Solana treasury is **mainnet** (not Devnet) — send a real SOL transfer with the memo to credit; indexer credits `users.credits_balance`. Do not expect 500→10500 unless that user started at ₵500.

**Cancel path (Helio):** Embed loads in **test mode**. Closing the Top-Up shell while Card is active shows `Payment cancelled — no charge was made…` (`data-testid=topup-helio-status`). Helio’s own wallet-picker X does not always fire `onCancel`.

**Monitor:** Railway logs for `POST /api/coins/webhook/helio` → **200** on paid events; **401** on unsigned/spoofed POSTs.

> Note: `POST /api/coins/topup/helio` (redirect charge API) currently returns **502 / Helio 401** on staging while the **embed paylink** path works. Prefer the embed; rotate Helio API/secret keys if redirect checkout is still needed.

## 9. Final Payment Test Protocol (Helio sandbox)

Executable runner (no live Helio keys required — simulates the SUCCESS webhook):

```bash
cd source/web-assets/backend && . .venv/bin/activate
python scripts/run_helio_payment_protocol.py
# pytest: tests/test_helio_payment_protocol.py
```

| Step | Check |
|------|--------|
| Sandbox webhook | Signed `POST /api/coins/webhook/helio` (alias `/api/webhooks/helio`) returns `payment_request_id` + `transaction_hash` |
| Ledger | `users.credits_balance` += exact pack coins (popular = ₵10,000 for $9) |
| Audit | `payments_audit` row with `status=credited`, tx hash, `payment_request_id` |
| Cancel UX | Helio embed `onCancel` → friendly status (`data-testid=topup-helio-status`), no unhandled exception |
| Security handshake | Missing/invalid `x-helio-signature` → **401** + `rejected_signature` audit |

Staging with a real Helio charge:

1. Set `HELIO_NETWORK=test` + test API keys / Pay Link + `HELIO_WEBHOOK_TOKEN`
2. Point Helio dashboard webhook at `/api/coins/webhook/helio` (or `/api/webhooks/helio`)
3. Complete a test card checkout, then cancel once to confirm cancel copy
4. Flip to `HELIO_NETWORK=main` only after credits reconcile
5. Keep the Beta banner until you exit Founding Member mode

## 10. Related files

- `backend/services/helio_client.py` — charges + webhook verify (`x-helio-signature`)
- `backend/services/payment_beta_gate.py` — cohort gate
- `backend/services/payments_audit.py` — append-only ledger
- `backend/routes/coin_topup.py` — Helio coin packs (Stripe path retired)
- `backend/scripts/run_helio_payment_protocol.py` — protocol runner
- `frontend/src/components/wallet/BetaPaymentBanner.tsx`
- `frontend/src/components/wallet/TopUpVibezCoinsModal.tsx`
- `backend/ENV_VARIABLES.md` — Helio secret catalogue

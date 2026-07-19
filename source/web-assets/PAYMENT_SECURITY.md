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

## 8. Sandbox before Live (Helio)

1. Set `HELIO_NETWORK=test` + test API keys / Pay Link
2. Run a real Helio card checkout (Helio test cards / MoonPay test mode)
3. Confirm webhook → `payments_audit` → `users.credits_balance`
4. Flip to `HELIO_NETWORK=main` only after that path is green
5. Keep the Beta banner until you exit Founding Member mode

## 9. Related files

- `backend/services/helio_client.py` — charges + webhook verify
- `backend/services/payment_beta_gate.py` — cohort gate
- `backend/services/payments_audit.py` — append-only ledger
- `backend/routes/coin_topup.py` — Helio coin packs (Stripe path retired)
- `frontend/src/components/wallet/BetaPaymentBanner.tsx`
- `frontend/src/components/wallet/TopUpVibezCoinsModal.tsx`
- `backend/ENV_VARIABLES.md` — Helio secret catalogue

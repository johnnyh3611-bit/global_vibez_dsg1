# Payment Security & PCI Compliance (Global Vibez)

**Non-negotiable rules for card / fiat rails.** Crypto (Solana) deposits never touch card data and are out of PCI scope.

## 1. Tokenization — never handle raw cards

| Rule | How we enforce it |
|------|-------------------|
| No PAN / CVV on our servers | Card entry is **Stripe Checkout** or **Helio embed** only — never Elements/raw inputs in our SPA |
| No card fields in Mongo | `payments_audit` + webhook stores strip `number` / `cvc` / nested PAN via `sanitize_stripe_object` |
| Prefer Solana for open beta | Wallet UI puts Solana first; card rails are Founding-Member gated |

**Do not add** `@stripe/react-stripe-js` CardElement or custom card forms without a PCI SAQ review.

## 2. TLS / SSL (client ↔ FastAPI)

Every production request must be HTTPS:

| Surface | Expectation |
|---------|-------------|
| Railway API | Public domain auto-provisions TLS (`https://…up.railway.app`) |
| Vercel frontend | `https://www.globalvibezdsg.com` |
| `REACT_APP_BACKEND_URL` | Must be `https://…` in production builds — never `http://` or `*.railway.internal` for the browser |

Verify SSL:

```bash
curl -sSI https://YOUR-API/health | head -n 5
# expect HTTP/2 200 and no certificate errors
openssl s_client -connect YOUR-API-HOST:443 -servername YOUR-API-HOST </dev/null 2>/dev/null | openssl x509 -noout -dates
```

## 3. Data minimization

Store only what support needs to reconcile:

- `user_id`, amounts, pack ids, Stripe/Helio session/charge ids, status, timestamps
- Optional: card **brand**, **last4**, AVS/CVC **check results** (never full PAN)
- Do **not** store billing address copies beyond what Stripe keeps on their side

## 4. Fraud protection (AVS / CVV / 3DS)

`services/payment_hub.py` creates Checkout sessions with:

- `billing_address_collection="required"` (AVS)
- `payment_method_options.card.request_three_d_secure="automatic"`
- Webhook path logs `card_checks` and refuses credit when CVC / postal checks report `fail`

Radar rules stay in the Stripe Dashboard (velocity, blocked countries, etc.).

## 5. Webhook security

| Endpoint | Verification |
|----------|--------------|
| `POST /api/payouts/stripe-webhook` | `stripe.Webhook.construct_event` + hard-fail if secret missing |
| `POST /api/coins/webhook/stripe` (+ other hub callers) | Same via `StripeCheckout.handle_webhook` |
| `POST /api/coins/webhook/helio` | Bearer token and/or HMAC; **fail closed** in production if token unset |

Never trust a payment event without a valid signature.

## 6. Audit logging

Collection: `payments_audit` (append-only, unique `event_id`).

Record at minimum:

- Checkout **created**
- Webhook **received** / **rejected_signature** / **rejected_fraud_checks**
- Coin **credited** / **failed**

Admin UI: `/admin/payments-audit` (see `routes/admin_payments_audit.py`).

## 7. Founding Member beta rollout

Env:

```bash
PAYMENT_BETA_MODE=true
PAYMENT_BETA_ALLOWLIST=alice@example.com,bob@example.com,user_id_xyz
PAYMENT_SUPPORT_EMAIL=payments-beta@globalvibezdsg.com
PAYMENT_SUPPORT_DISCORD=https://discord.gg/globalvibez
# optional hard-fail for Helio even in staging:
PAYMENTS_REQUIRE_WEBHOOK_AUTH=1
```

When `PAYMENT_BETA_MODE` is on (default in `ENVIRONMENT=production` until set `false`):

- Helio / Stripe coin checkout and High Roller card checkout require Founding Member / allowlist / admin
- Solana deposits stay open for everyone
- UI shows **Beta Payment Environment** banner with support links

Start with **20–50** Founding Members. Open the gate (`PAYMENT_BETA_MODE=false`) only after live credits reconcile cleanly.

## 8. Sandbox before Live

1. Use Stripe **test** keys (`sk_test_…` / `pk_test_…`) and Helio `HELIO_NETWORK=test`
2. Run a real Checkout with Stripe test cards (e.g. `4242…`) against production product/price IDs mirrored in test
3. Confirm webhook → `payments_audit` → `users.credits_balance` update
4. Flip to `sk_live_` / Helio main only after that path is green
5. Keep the Beta banner until you exit Founding Member mode

## 9. Related files

- `backend/services/payment_hub.py` — Checkout + signed webhooks
- `backend/services/payment_beta_gate.py` — cohort gate
- `backend/services/payments_audit.py` — append-only ledger
- `backend/routes/coin_topup.py` — Helio/Stripe coin packs
- `frontend/src/components/wallet/BetaPaymentBanner.tsx`
- `backend/ENV_VARIABLES.md` — secret catalogue

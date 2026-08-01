# 🚀 Deploy Checklist — Global Vibez DSG

Run through this checklist **BEFORE every deploy** to prevent 3rd-party surprises.
Items here are things that live OUTSIDE our codebase (dashboards, external APIs) that
we can't catch with tests, but break silently when misconfigured.

---

## 🛡 Step 1 — Run the regression shield

```bash
/app/scripts/run_shield.sh
```

If ANY test fails — **do not deploy**. Fix it first. The shield catches:
- Card-game engine regressions
- Hand-visibility regressions (Euchre / Pinochle bidding)
- Meld-grouping regressions (Gin Rummy / Rummy)
- Card legibility regressions (Hearts pass modal)
- Baccarat canonical route + currency-brand rule
- Demo-login credits seed
- Coming Soon gating
- Privy self-hide guard
- Docker build heap cap
- FastAPI route count

---

## 🌐 Step 2 — 3rd-party dashboard verification

### Privy (https://dashboard.privy.io)

App ID: `cmof0ab0b00mj0ckzhthh8x8o`

**Allowed URLs / Domains** must include:
- [ ] `https://globalvibezdsg.com`
- [ ] `https://www.globalvibezdsg.com`
- [ ] `http://localhost:3000` (dev only — keep for local)

If any domain is missing, Privy's iframe gets CSP-blocked → users see a huge
full-screen popup. The `PrivyLoginButton` will self-hide to prevent this, but
users on unlisted domains just won't see Privy at all.

### Helio / MoonPay (https://moonpay.hel.io) — only card rail

> Stripe is retired. Legacy Stripe routes return 410 — do **not** provision `STRIPE_*`.

- [ ] **Webhook endpoint** points at the prod API:
      `POST https://<api-host>/api/coins/webhook/helio`
      (also activates `kind=chair_park` payments from `POST /api/chairs/checkout`)
- [ ] **Keys in backend env** — `HELIO_API_KEY`, `HELIO_SECRET_KEY`, `HELIO_PAYLINK_ID`
- [ ] **`HELIO_WEBHOOK_TOKEN`** matches the token returned by the Helio webhook create
      call (webhooks fail closed in production without it)
- [ ] **`HELIO_NETWORK`** — `test` for sandbox (dev-host keys), `main` when live
- [ ] **`GET /api/integrations/health`** → `services.helio.configured` is true

### Solana deposit rail (primary coin rail)

- [ ] `GLOBAL_VIBEZ_SOLANA_RECEIVE_WALLET` set to the treasury pubkey in `backend/.env`

Rules + runbook: `source/web-assets/PAYMENT_SECURITY.md`.
Variable reference: `source/web-assets/backend/ENV_VARIABLES.md`.

### Resend (https://resend.com/domains)

- [ ] Current sender: `onboarding@resend.dev` (TEST — default)
- [ ] Production sender (locked until safe phrase `"project complete"`):
      `noreply@globalvibezdsg.com`

**DO NOT switch to the custom domain until the user says the exact phrase
`"project complete"`.** This is a standing rule.

### Solana network (`backend/.env` → `SOLANA_NETWORK`)

- [ ] Currently: `devnet` (TEST)
- [ ] Production: `mainnet-beta` — **LOCKED until safe phrase `"project complete"`**

### Google / X social login (Privy)

- [ ] `PRIVY_APP_ID` on the backend matches `REACT_APP_PRIVY_APP_ID` baked into the
      frontend build; deploy URL is allowlisted in the Privy dashboard.

### AI — Google Gemini

- [ ] `GEMINI_API_KEY` (or the `GOOGLE_API_KEY` alias) set on the backend
      (key from https://aistudio.google.com/apikey)
- [ ] `OPENAI_API_KEY` set only if Voice Mirror / Voice Coach audio is needed — it is
      not used for chat

### Twilio (https://console.twilio.com) — SMS / OTP

- [ ] Sending number provisioned
- [ ] Account balance > $10

### Agora RTC (https://console.agora.io) — video/voice

- [ ] App ID + App Certificate in `backend/.env`
- [ ] Token expiry policy matches client timeout

---

## 🔧 Step 3 — Env file sanity

```bash
# Confirm prod-safe values only
grep -E "localhost|127.0.0.1|test_key|YOUR_" /app/backend/.env /app/frontend/.env
```

Expected: no matches (other than intentional comments). If any shows up, the
app is pointing at dev values.

---

## 🧪 Step 4 — Post-deploy smoke

After the deploy finishes, hit these 5 URLs manually in incognito
(fresh session, no stale cookies) on the production URL:

1. `/login` → should load without console errors (yellow warnings OK)
2. Click **Demo Login** → should land on `/dashboard` as "Demo User"
3. Visit `/baccarat` → monaco felt table renders with bet zones
4. Visit `/chair-wall` → floating orb constellation renders
5. Visit `/practice/play/yahtzee` → Coming Soon overlay renders

If any fail, check the Railway / Vercel deploy logs. The app runtime is healthy if
`/health` returns 200 at the backend domain.

---

## 📖 Step 5 — Update the lock log

Every permanent fix MUST be recorded in `/app/memory/REGRESSION_LOCK.md`.
Forks lose context — the lock log is how we remember.

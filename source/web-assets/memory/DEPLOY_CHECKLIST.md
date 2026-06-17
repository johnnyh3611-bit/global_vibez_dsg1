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
- [ ] `https://social-connect-953.emergent.host` (Emergent prod)
- [ ] `https://social-connect-953.preview.emergentagent.com` (preview)
- [ ] `http://localhost:3000` (dev only — keep for local)

If any domain is missing, Privy's iframe gets CSP-blocked → users see a huge
full-screen popup. The `PrivyLoginButton` will self-hide to prevent this, but
users on unlisted domains just won't see Privy at all.

### Stripe (https://dashboard.stripe.com)

- [ ] **Webhook endpoints** all four point at prod URL:
  - `/api/hungryvibes/merchant/sponsorship/webhook` (merchant sponsorship)
  - `/api/subscriptions/webhook` (platform subscription tiers)
  - `/api/vibes-slots/webhook` (if enabled)
  - `/api/chairs/checkout/webhook` (chair purchases)
- [ ] **API key environment** — confirm live key is in `backend/.env` as
      `STRIPE_API_KEY` and test key is NOT.
- [ ] **Webhook signing secret** — `STRIPE_WEBHOOK_SECRET` matches the endpoint's
      "Signing secret" in dashboard.

### Resend (https://resend.com/domains)

- [ ] Current sender: `onboarding@resend.dev` (TEST — default)
- [ ] Production sender (locked until safe phrase `"project complete"`):
      `noreply@globalvibezdsg.com`

**DO NOT switch to the custom domain until the user says the exact phrase
`"project complete"`.** This is a standing rule.

### Solana network (`backend/.env` → `SOLANA_NETWORK`)

- [ ] Currently: `devnet` (TEST)
- [ ] Production: `mainnet-beta` — **LOCKED until safe phrase `"project complete"`**

### Google OAuth (Emergent-managed — https://auth.emergentagent.com)

- [ ] Emergent auth proxy should auto-register the deploy URL. If Google login
      redirects but returns "invalid redirect_uri", reach out to Emergent support.

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

After Emergent shows "deployed", hit these 5 URLs manually in incognito
(fresh session, no stale cookies) on the production URL:

1. `/login` → should load without console errors (yellow warnings OK)
2. Click **Demo Login** → should land on `/dashboard` as "Demo User"
3. Visit `/baccarat` → monaco felt table renders with bet zones
4. Visit `/chair-wall` → floating orb constellation renders
5. Visit `/practice/play/yahtzee` → Coming Soon overlay renders

If any fail, check the Emergent deploy logs. The app runtime is healthy if
`/health` returns 200 at the backend domain.

---

## 📖 Step 5 — Update the lock log

Every permanent fix MUST be recorded in `/app/memory/REGRESSION_LOCK.md`.
Forks lose context — the lock log is how we remember.

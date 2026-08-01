# GO LIVE — Global Vibez DSG production readiness

**This is THE single authoritative go-live checklist, as of 2026-08-01.**
It supersedes `source/web-assets/memory/LAUNCH_CHECKLIST.md` and all archived
session / launch notes. It is rooted strictly in the current stack:
**Helio (card) + Solana deposit** for payments and **Google Gemini** for AI.

> Live runtime source of truth: `GET /api/integrations/health` — confirm any item
> below against its `runtime`, `services[*].configured` flags and `notes`.

Still-current deep dives (this file links, does not replace them):
[`source/web-assets/backend/ENV_VARIABLES.md`](source/web-assets/backend/ENV_VARIABLES.md) ·
[`source/web-assets/PAYMENT_SECURITY.md`](source/web-assets/PAYMENT_SECURITY.md) ·
[`PRODUCTION_OPS.md`](PRODUCTION_OPS.md) ·
[`source/web-assets/RAILWAY_DEPLOY.md`](source/web-assets/RAILWAY_DEPLOY.md)

---

## 1. Stack summary

| Concern | What we actually run | Key env vars |
|---------|----------------------|--------------|
| Coin top-up / chairs (primary) | **Solana deposit** + memo credit (open to everyone) | `GLOBAL_VIBEZ_SOLANA_RECEIVE_WALLET` |
| Card checkout | **Helio (MoonPay Commerce)** — Founding-Member beta gated | `HELIO_API_KEY`, `HELIO_SECRET_KEY`, `HELIO_PAYLINK_ID`, `HELIO_WEBHOOK_TOKEN`, `HELIO_NETWORK`, `PAYMENT_BETA_MODE`, `PAYMENT_BETA_ALLOWLIST` |
| AI (planner, coaches, matching, translation) | **Google Gemini** | `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) |
| Audio STT/TTS (Voice Mirror / Voice Coach only) | **OpenAI** (Whisper + tts-1) | `OPENAI_API_KEY` |
| Database | **MongoDB** (Motor) — *not* Postgres | `MONGO_URL`, `DB_NAME` |
| Auth | JWT + Privy (Google / X) | `JWT_SECRET`, `PRIVY_APP_ID`, `REACT_APP_PRIVY_APP_ID` |
| Live audio/video (Vibe Phone) | **Agora RTC** | `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE` |
| Email | **Resend** | `RESEND_API_KEY`, `RESEND_SENDER_EMAIL` |
| Live video ingest (DSG TV) | **Cloudflare Stream** | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_STREAM_SUBDOMAIN` |
| Realtime scale-out | Redis adapter for Socket.IO | `REDIS_URL` |

**Retired / unused — do not provision:**
- **Stripe** is retired. Legacy Stripe checkout routes return **410 Gone**;
  `STRIPE_API_KEY` remains in `config/settings.py` only as a backward-compat shim.
- **Emergent** is not used. `EMERGENT_LLM_KEY` is only a legacy alias that now
  resolves to the Gemini key.

---

## 2. 🔴 BLOCKERS — must be done before real users

### 2.1 Backend live on Railway (FastAPI + MongoDB)

- [ ] Railway service → **Root Directory** `source/web-assets/backend`
- [ ] Attach **MongoDB** (Railway MongoDB plugin or Atlas). **Not** PostgreSQL /
      `DATABASE_URL` — this backend is Motor/PyMongo.
- [ ] Set backend vars:

```bash
MONGO_URL=${{MongoDB.MONGO_URL}}
DB_NAME=global_vibez
JWT_SECRET=$(openssl rand -hex 32)   # 24+ chars, non-default
ENVIRONMENT=production
DISABLE_BG_SCHEDULERS=1              # required on small plans (avoids OOM → 502)
CORS_ORIGINS=https://www.globalvibezdsg.com,https://globalvibezdsg.com
FRONTEND_URL=https://www.globalvibezdsg.com
```

- [ ] Public domain generated under **Settings → Networking**
- [ ] Verify (`/health` is intentionally DB-free so probes pass while Mongo warms):

```bash
curl -sS https://YOUR-API/health                      # expect JSON, not HTML
curl -sS -X POST https://YOUR-API/api/auth/demo-login # expect 200 + token
```

### 2.2 Frontend (Vercel) pointed at the Railway API

- [ ] Vercel → Settings → Environment Variables (Production):
      `REACT_APP_BACKEND_URL=https://YOUR-API` (**no trailing slash**),
      `REACT_APP_FRONTEND_URL=https://www.globalvibezdsg.com`
- [ ] **Redeploy** — CRA bakes env at build time; changing the var without a
      rebuild does nothing.
- [ ] Do **not** leave an empty `REACT_APP_BACKEND_URL` in `vercel.json`; it
      overrides the dashboard value and the SPA falls back to same-origin `/api`,
      which Vercel answers with `index.html` (looks "up", is not FastAPI).

### 2.3 Payments (Solana + Helio)

- [ ] `GLOBAL_VIBEZ_SOLANA_RECEIVE_WALLET` set — the primary, ungated coin rail.
- [ ] Helio secrets on the backend: `HELIO_API_KEY`, `HELIO_SECRET_KEY`,
      `HELIO_PAYLINK_ID`, `HELIO_WEBHOOK_TOKEN`.
- [ ] `HELIO_NETWORK=test` (routes to `api.dev.hel.io`) until sandbox credits
      reconcile; **only then** flip to `main`. There is no auto-promotion —
      `/api/integrations/health` reports `helio.test_mode_isolated`.
- [ ] Helio dashboard webhook → `POST https://YOUR-API/api/coins/webhook/helio`.
      **Webhooks fail closed in production when `HELIO_WEBHOOK_TOKEN` is unset**
      (force it elsewhere with `PAYMENTS_REQUIRE_WEBHOOK_AUTH=1`); unsigned POSTs
      must return **401** and write a `rejected_signature` audit row.
- [ ] Keep the Founding-Member gate on: `PAYMENT_BETA_MODE=true`,
      `PAYMENT_BETA_ALLOWLIST` (20–50 emails), `PAYMENT_SUPPORT_EMAIL`,
      `PAYMENT_SUPPORT_DISCORD`. Solana stays open to everyone.
- [ ] Run the payment test protocol before opening the card rail:

```bash
cd source/web-assets/backend && . .venv/bin/activate
python scripts/run_helio_payment_protocol.py
```

- [ ] Never add card number / CVV inputs to the SPA — Helio embed or hosted page only.

### 2.4 AI

- [ ] `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) set on the backend
      (key: https://aistudio.google.com/apikey). Without it the date planner,
      coaches, matching and translation degrade.

### 2.5 Auth & security

- [ ] `JWT_SECRET` strong (24+ chars, not a known default) — surfaced as
      `runtime.jwt.weak_or_default` in integrations health.
- [ ] `ADMIN_PASSWORD` changed from the documented sample; `ADMIN_EMAILS` correct.
- [ ] `ELD_SIGNING_KEY` non-default (startup errors in `ENVIRONMENT=production`
      on weak values; rotation requires a re-sign migration).
- [ ] Privy: `PRIVY_APP_ID` on the backend and `REACT_APP_PRIVY_APP_ID` baked
      into the frontend build for Google / X login.

### 2.6 Email deliverability

- [ ] `RESEND_API_KEY` + `RESEND_SENDER_EMAIL` on a **verified domain**
      (not `onboarding@resend.dev`), with SPF, DKIM and DMARC DNS records
      published. Password reset and digests depend on it.

---

## 3. 🟡 HIGH — week one

- [ ] **Agora**: `AGORA_APP_ID` + `AGORA_APP_CERTIFICATE` — without them Vibe
      Phone calls ring but carry no audio/video (`GET /api/agora/health`).
- [ ] **Redis**: set `REDIS_URL` before scaling Socket.IO past one replica, or
      users on different pods stop seeing each other's moves.
- [ ] **Cloudflare Stream**: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`,
      `CLOUDFLARE_STREAM_SUBDOMAIN` — until set, `/api/streaming/cloudflare/*`
      runs in stub mode and DSG TV live ingest is unavailable.
- [ ] **OAuth / redirect URIs** registered for the production domain (Privy app,
      Google / X consoles) — `https://www.globalvibezdsg.com`.
- [ ] **Casino compliance**: sweepstakes / skill-game disclosures, state-level
      geo gating, and clear no-purchase-necessary + odds copy.
- [ ] **Legal, lawyer-reviewed**: Terms, Privacy, age verification (18+/21+),
      DMCA agent + takedown flow, GDPR / CCPA data-deletion path.
- [ ] **Monitoring**: Sentry (frontend + backend), uptime probe on
      `/api/health`, and alerting on Helio webhook delivery failures / 401 spikes.

---

## 4. 🟢 POLISH / deferred

- [ ] **Crypto / TGE stays locked** — no Solana mainnet token mint and no bridge
      until 4–6 weeks of stable real-user data post-launch.
- [ ] **Twilio** (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`)
      is optional PSTN/SMS only; in-app calling uses Agora.
- [ ] **Azure VM static mirror** (nginx) — optional; blocked on SSH/NSG and it
      soft-fails without blocking `main`.

---

## 5. Verification commands

```bash
# 1. Strict env gate (backend: JWT_SECRET, MONGO_URL, DB_NAME; frontend build: REACT_APP_BACKEND_URL)
node scripts/check-env.js

# 2. DB-free liveness probe — must return JSON, never HTML
curl -sS https://YOUR-API/health

# 3. Runtime readiness — the source of truth for this checklist
curl -sS https://YOUR-API/api/integrations/health
#    ok / runtime_ok            → JWT strong + Mongo reachable
#    services.<svc>.configured  → that integration's env vars are present
#    services.helio.test_mode_isolated / network → sandbox vs mainnet
#    notes[]                    → plain-English remaining gaps

# 4. Backend tests
cd source/web-assets/backend && pytest tests/ -v --maxfail=1

# 5. Public smoke tests
npm run smoke        # frontend on www
npm run smoke:full   # + API host (SMOKE_REQUIRE_API=1)
```

---

## 6. Supersedes / cross-links

**Superseded by this file:** `source/web-assets/memory/LAUNCH_CHECKLIST.md` and
archived session / launch notes. Treat any conflict with those as resolved here.

**Still authoritative deep dives:**

| Doc | Covers |
|-----|--------|
| [`source/web-assets/backend/ENV_VARIABLES.md`](source/web-assets/backend/ENV_VARIABLES.md) | Full env var catalogue (Mongo, JWT, Solana, Helio, Gemini, OpenAI audio, Agora, Resend, Cloudflare Stream, Redis, Privy, CORS) |
| [`source/web-assets/PAYMENT_SECURITY.md`](source/web-assets/PAYMENT_SECURITY.md) | Helio PCI / TLS / webhook / audit rules, Founding Member beta, payment test protocol |
| [`PRODUCTION_OPS.md`](PRODUCTION_OPS.md) | Railway + Vercel deploy truth, `/health` probe, schedulers, SEO / canonical host |
| [`source/web-assets/RAILWAY_DEPLOY.md`](source/web-assets/RAILWAY_DEPLOY.md) | Railway service setup detail |

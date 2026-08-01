# Global Vibez DSG — Pre-Launch Checklist

> The honest, no-fluff list of everything you (the founder) need to do
> before flipping the switch on real, paying users at launch.
>
> Last updated: 2026-08-01 — the 💳 Payments and 🤖 LLM sections were revised after the
> Stripe → Helio + Solana payment migration and the Emergent → Google Gemini LLM migration.
> Canonical env references: `source/web-assets/backend/ENV_VARIABLES.md` and
> `source/web-assets/PAYMENT_SECURITY.md`.

Tick boxes as you go. Items grouped by urgency:
**🔴 BLOCKERS** = real users WILL hit this and break · don't launch without
**🟡 HIGH** = launch can technically happen but you'll fix this within a week
**🟢 POLISH** = nice-to-have, fix on the second week or batch with v1.1

---

## 🔴 BLOCKERS (must-do before paying users)

### 💳 Payments

> Stripe is retired — legacy Stripe routes return HTTP 410. The coin rails are
> **Solana deposit** (primary) and **Helio** (only card rail). Full rules:
> `source/web-assets/PAYMENT_SECURITY.md`; variable reference:
> `source/web-assets/backend/ENV_VARIABLES.md`.

- [ ] **Set the Solana deposit rail.** Backend env: `GLOBAL_VIBEZ_SOLANA_RECEIVE_WALLET=<treasury pubkey>`. Send one small real deposit and confirm the wallet credits.
- [ ] **Set the Helio card rail** on the backend: `HELIO_API_KEY`, `HELIO_SECRET_KEY`, `HELIO_PAYLINK_ID` (from https://moonpay.hel.io → Developers → API keys + dynamic Pay Link).
- [ ] **Add `HELIO_WEBHOOK_TOKEN`** (shared token from the Helio webhook create call). Without it, webhooks fail closed in production — no credits land.
- [ ] **Flip `HELIO_NETWORK` from `test` to `main`** once a sandbox checkout has credited end-to-end. Keys from `moonpay.dev.hel.io` only work on the dev host.
- [ ] **Confirm `GET /api/integrations/health`** shows `services.helio.configured` and the Solana wallet present.
- [ ] **Test every coin/card path** in production once `HELIO_NETWORK=main`:
  - [ ] Vibez Coin top-up (₵ packs) via Solana deposit
  - [ ] Vibez Coin top-up (₵ packs) via Helio card checkout
  - [ ] Vibez Wallet top-up
  - [ ] Chair vault checkout (`POST /api/chairs/checkout` → Helio `kind=chair_park`)
  - [ ] Confirm `payments_audit` entries + wallet credit for each
- [ ] **Keep `PAYMENT_BETA_MODE=true`** with `PAYMENT_BETA_ALLOWLIST` (Founding Members) until live credits reconcile; Solana stays open to everyone.

### 📧 Email Deliverability
- [ ] **IONOS DNS records for `globalvibez.com`** so Resend can send from your domain:
  - [ ] Add SPF TXT record
  - [ ] Add DKIM TXT records (Resend gives you the values)
  - [ ] Add DMARC TXT record
  - [ ] Wait ~1 hour for propagation
- [ ] **Verify domain in Resend dashboard** → goes "verified"
- [ ] **Update backend `.env`**: `RESEND_SENDER_EMAIL=noreply@globalvibez.com`
- [ ] **Test:** sign up with a fresh email → confirm you receive the welcome email from `@globalvibez.com` (not the default Resend domain)

### 🔐 Auth & Security
- [ ] Confirm `JWT_SECRET` in backend `.env` is a long random string (not the default)
- [ ] Confirm admin/God Mode `VAULT_PASSWORD` env is changed from any default
- [ ] Spot-check `/api/auth/login` rate-limiting still active (brute-force protection)

### 🚖 Vibe Ridez Driver Payouts
- [ ] Currently every driver payout drops into the admin `payout_requests` queue → **manual approval only**. For launch, decide one:
  - Option A: keep manual approval (you eyeball every payout — fine for first 50 drivers)
  - Option B: wire an automatic driver payout rail (Solana payout to the driver's wallet, or a bank-transfer provider) — nothing is wired today
- [ ] If Option B → wire the chosen payout onboarding into the `/driver/wallet` page
- [ ] If Option A → write the operations doc: who approves, how often, expected SLA

### 🍕 HungryVibes Merchant Payouts
- [ ] Same decision as drivers — Vibe Account balance accrues on every delivered order (net of 2% Vibe Tax) but there's no auto-withdraw to merchant bank yet. Either:
  - Manual weekly payouts from the admin batch queue
  - Wire the same automatic payout rail chosen for drivers

---

## 🟡 HIGH (within first week of launch)

### 🌐 OAuth + Third-party Redirects
- [ ] Update **Google OAuth redirect URI** from preview domain to `https://globalvibezdsg.com/api/auth/google/callback` in Google Cloud Console
- [ ] Update **Smartcar OAuth redirect URI** to production domain
- [ ] Update **Spotify OAuth redirect URI** to production domain
- [ ] Update **Privy / Phantom / wallet redirects** if any preview URLs leak

### 🤖 LLM Budget
- [ ] Set **`GEMINI_API_KEY`** (or the `GOOGLE_API_KEY` alias) on the backend and confirm quota/billing in Google AI Studio — Receipt OCR + i18n + Vibe Core AI mediation gracefully degrade without it, but real users expect them to work
- [ ] Run `cd /app/backend && python scripts/generate_landing_tour_i18n.py` to generate the 7 i18n tour videos (Spanish, French, Portuguese, Chinese, Hindi, Arabic, Japanese) — ~$0.20, ~3 min
- [ ] Confirm Gemini chat/vision responses and Onyx TTS (`OPENAI_API_KEY`, audio only) are all responding

### 🚖 Vibe Ridez Real-time Improvements
- [x] Driver dispatch flow exists (`/api/ridez/request` → driver offer → respond → complete) ✅
- [ ] **Geo-proximity matching:** dispatch currently can broadcast to all online drivers — narrow to nearest 5 by haversine
- [ ] **Live map after pickup:** rider currently sees driver's last-known location at request time; add WebSocket location ping every 5s once accepted
- [ ] **ETA calculation:** use Google Distance Matrix or simple haversine + average speed for ETA on driver offer card
- [ ] **Surge pricing logic** (optional v1 — not needed for soft launch)

### 🍕 HungryVibes Polish (post-merchant-loop)
- [x] Order state machine: pending → preparing → ready → delivered ✅
- [x] Auto-refund on reject (coins) ✅
- [x] Auto-credit merchant Vibe Account on delivered (net 2% Vibe Tax) ✅
- [ ] **Customer-side order tracking page**: status badge that updates live (currently customer has `/api/hungryvibes/orders/my` but no dedicated tracking UI — show "Restaurant is preparing your food" / "Ready, on the way" / "Delivered")
- [ ] **Push notification** to customer when status changes (web push or email)
- [ ] **Optional v2:** wire SmartStack to offer the delivery leg to Vibe Ridez drivers automatically (`smartstack_offers` collection already exists — just wire the surface UI)

### 🎰 Casino Compliance
- [ ] Confirm you're **NOT** taking real-money bets — all stakes are in ₵ Vibez Coins (bought via Solana deposit or Helio card = entry fee, not gambling). Verify legal positioning is sweepstakes/promotional sweeps model OR your specific jurisdiction.
- [ ] Add visible "Sweepstakes / Skill Game" disclosure on all betting screens (Sports Lounge, Spectator Bets, Lottery, DSG 6)
- [ ] State-restriction screen for WA/ID/NV/etc. if applicable (use IP geolocation)
- [ ] **TOS + Privacy + Responsible Gaming pages** linked from footer

### 📜 Legal
- [ ] **Terms of Service** page reviewed by a lawyer (you're handling real money + user-generated content + chat)
- [ ] **Privacy Policy** mentions: cookies, location for VibeRidez, payment processing via Helio + Solana, OAuth providers, retention
- [ ] **Age verification** flow tested (DOB → age 18+/21+ gate depending on feature)
- [ ] **DMCA contact** listed for the Cinema Room + creator content
- [ ] **California / GDPR** data-export and delete-account endpoints exist (if you have any EU/CA users)

### 📊 Monitoring
- [ ] **Backend error reporting** — wire Sentry or similar (currently errors only show in supervisor logs)
- [ ] **Uptime monitor** — Pingdom/UptimeRobot hitting `/api/health` every minute
- [ ] **Helio webhook delivery monitor** — alert on failed `POST /api/coins/webhook/helio` deliveries (Helio dashboard + backend logs)
- [ ] **Daily admin email**: weekly digest already exists; consider daily revenue snapshot too
- [ ] **God Mode Activity Pulse card** already shows live business pulse ✅

---

## 🟢 POLISH (week 2+ or batch with v1.1)

### Branding & Content
- [ ] Replace every remaining `placeholder/demo` text in the landing page with founder copy
- [ ] Profile pictures for the 3 beta tester accounts (currently no avatars)
- [ ] Logo SVG at all sizes (favicon, app icon, social share, login screen) — verify it's not the Vite default anywhere
- [ ] Social preview cards (`og:image`) for the top 10 routes (`/dashboard`, `/sports-lounge`, `/just-for-the-night`, etc.)

### UX
- [ ] **"Remember my role" toast** when user switches role for the first time
- [ ] **Onboarding tour** for first-time visitors (highlight Volumetric, Ride, Eat, Tiers)
- [ ] Mobile haptic feedback on key CTAs (Helio checkout, Ride Accept, JFTN Join)
- [ ] **Dark/Light mode toggle** (currently dark-only — most casino apps are dark-only so this is optional)

### Performance
- [ ] Lighthouse audit on landing page — aim for ≥85 on all metrics
- [ ] Code-split the Volumetric Galaxy bundle (Three.js is ~500KB — only load when user enters volumetric)
- [ ] Image lazy-load on all room thumbnails
- [ ] Service Worker for offline asset cache (especially the 23 MB 9x16 tour video)

### Crypto / TGE (locked until user types `project complete`)
- [ ] Solana mainnet RPC URL in `.env`
- [ ] Real $VIBEZ token mint address
- [ ] Bridge contract deployment + audit
- [ ] KYC for token sale participants
- [ ] **Flip `SOLANA_MAINNET_UNLOCKED=1`** in backend `.env`
- [ ] Test withdrawal of ₵ → SOL → user's Phantom wallet end-to-end on devnet first
- [ ] Then mainnet

---

## ✅ ALREADY DONE (no action needed)

These are wired and verified end-to-end as of 2026-05-12:

- [x] **Auth**: email/password + Google OAuth + Demo + age verification
- [x] **Profile**: complete profile flow with visible text (white-card bug fixed)
- [x] **Volumetric 3D Galaxy** default dashboard + Classic toggle (Switch View bug fixed)
- [x] **Switch Role pill** — 5 roles, one-tap navigate, persisted in localStorage
- [x] **30+ casino card rooms** (Spades, Bid Whist, Hearts, Blackjack, Baccarat, Vibez 654, Cyber Casino, Chess Hall × 5 modes…)
- [x] **JFTN** (Just For The Night) — Season Pass $25/mo + Gift Unlocks + Room Passwords
- [x] **Sovereign Tiers** — Guest free / Insider $9 / Tastemaker $19 / Royal $39 / Sovereign $89 / Genius Chair $20 one-time
- [x] **Sports Lounge** — bet placement, vaulting, Sovereign Tax 13.5%, Bet of the Day, Vibe Check crowd oracle
- [x] **DSG 6 Lottery** + Underground Live + Cinema Room + Spectator Bets + Integrity Protocol
- [x] **Vibe Ridez** MVP — driver dispatch with WebSocket, ride request/respond/complete flow, fare-split + payout (driver payouts queued for manual approval)
- [x] **HungryVibes Merchant** — register, menu CRUD, promos, sponsorship, **order fulfillment loop** (NEW), Vibe Account ledger
- [x] **Live Activity Ticker** (public anonymized) + Admin Activity Pulse Card (un-anonymized)
- [x] **God Mode Admin** — payout queue, treasury, audit, milestones, sponsor admin, sovereign ops, beta feedback, smartstack ops
- [x] **Vibez Wallet** with Phantom Connect (Solana mainnet stubbed behind TGE lock)
- [x] **Streamer Dashboard, SmartStack Driver Dashboard, Driver Earnings/Wallet/Registration/Dispatch**
- [x] **250/250 regression-shield pytest tests GREEN** — locked against future regressions
- [x] **Deployment Agent pre-check** PASS

---

## 🎯 Recommended Launch Order

1. **Today / this week**: Tick all 🔴 BLOCKERS. Especially the Helio live keys (`HELIO_NETWORK=main`) + Solana receive wallet + email DNS.
2. **Quiet beta (50 users)**: invite the beta-tester waitlist. Use this to find any 🟡 HIGH items you missed.
3. **Public beta (500 users)**: open `/beta-tester` waitlist signup, run for 2 weeks.
4. **Soft launch**: lift the waitlist gate. Marketing push.
5. **TGE / Token launch**: only after the platform has 4-6 weeks of stable real-user data. Type `project complete` here when you're ready to unlock the Solana mainnet bridge.

---

**Honest read**: the app is **functionally complete for a soft launch with 50-500 beta users** today. The biggest risks before broader launch are:

1. Helio still on `HELIO_NETWORK=test` → cannot charge real cards yet
2. No automatic driver/merchant bank payouts → manual approval bottleneck after first 100 transactions
3. No real-time delivery tracking for HungryVibes customer → they see "preparing" but don't get a "your food is here" ping

Everything else is either working, gracefully stubbed, or accepted polish for v1.1.

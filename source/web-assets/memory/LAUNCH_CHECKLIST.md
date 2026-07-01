# Global Vibez DSG — Pre-Launch Checklist

> The honest, no-fluff list of everything you (the founder) need to do
> before flipping the switch on real, paying users at launch.
>
> Last updated: 2026-05-12 (after HungryVibes merchant fulfillment loop shipped).

Tick boxes as you go. Items grouped by urgency:
**🔴 BLOCKERS** = real users WILL hit this and break · don't launch without
**🟡 HIGH** = launch can technically happen but you'll fix this within a week
**🟢 POLISH** = nice-to-have, fix on the second week or batch with v1.1

---

## 🔴 BLOCKERS (must-do before paying users)

### 💳 Payments
- [ ] **Swap Stripe from test to LIVE keys.** Backend `.env`: change `STRIPE_API_KEY` from `sk_test_emergent` to your real `sk_live_...`. Verify a $1 test card actually charges.
- [ ] **Add `STRIPE_WEBHOOK_SECRET`** to backend `.env`. Without this, webhook callbacks can be spoofed. Get from Stripe Dashboard → Developers → Webhooks → your endpoint → "Signing secret".
- [ ] **Test every Stripe checkout path** in production once live keys are in:
  - [ ] Vibez Coin top-up (₵ packs)
  - [ ] Vibez Wallet top-up
  - [ ] JFTN Season Pass subscription ($25/mo)
  - [ ] HungryVibes merchant sponsorship ($29.99/mo)
  - [ ] Genius Chair one-time ($20)
  - [ ] Sovereign Tier subscriptions ($9/$19/$39/$89)

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
  - Option B: wire **Stripe Connect** for automatic driver bank deposits
- [ ] If Option B → wire Stripe Connect onboarding into `/driver/wallet` page
- [ ] If Option A → write the operations doc: who approves, how often, expected SLA

### 🍕 HungryVibes Merchant Payouts
- [ ] Same decision as drivers — Vibe Account balance accrues on every delivered order (net of 2% Vibe Tax) but there's no auto-withdraw to merchant bank yet. Either:
  - Manual weekly payouts via Stripe Connect transfers (admin batch)
  - Wire Stripe Connect for merchants too (matches driver flow)

---

## 🟡 HIGH (within first week of launch)

### 🌐 OAuth + Third-party Redirects
- [ ] Update **Google OAuth redirect URI** from preview domain to `https://globalvibezdsg.com/api/auth/google/callback` in Google Cloud Console
- [ ] Update **Smartcar OAuth redirect URI** to production domain
- [ ] Update **Spotify OAuth redirect URI** to production domain
- [ ] Update **Privy / Phantom / wallet redirects** if any preview URLs leak

### 🤖 LLM Budget
- [ ] Top up **Emergent Universal LLM Key** budget (currently capped — Receipt OCR + i18n + Vibe Core AI mediation gracefully degrade but real users expect them to work)
- [ ] Run `cd /app/backend && python scripts/generate_landing_tour_i18n.py` to generate the 7 i18n tour videos (Spanish, French, Portuguese, Chinese, Hindi, Arabic, Japanese) — ~$0.20, ~3 min
- [ ] Confirm Claude Haiku + GPT image + Gemini Nano Banana + Onyx TTS all responding

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
- [ ] Confirm you're **NOT** taking real-money bets — all stakes are in ₵ Vibez Coins (you bought via Stripe = entry fee, not gambling). Verify legal positioning is sweepstakes/promotional sweeps model OR your specific jurisdiction.
- [ ] Add visible "Sweepstakes / Skill Game" disclosure on all betting screens (Sports Lounge, Spectator Bets, Lottery, DSG 6)
- [ ] State-restriction screen for WA/ID/NV/etc. if applicable (use IP geolocation)
- [ ] **TOS + Privacy + Responsible Gaming pages** linked from footer

### 📜 Legal
- [ ] **Terms of Service** page reviewed by a lawyer (you're handling real money + user-generated content + chat)
- [ ] **Privacy Policy** mentions: cookies, location for VibeRidez, payment processing via Stripe, OAuth providers, retention
- [ ] **Age verification** flow tested (DOB → age 18+/21+ gate depending on feature)
- [ ] **DMCA contact** listed for the Cinema Room + creator content
- [ ] **California / GDPR** data-export and delete-account endpoints exist (if you have any EU/CA users)

### 📊 Monitoring
- [ ] **Backend error reporting** — wire Sentry or similar (currently errors only show in supervisor logs)
- [ ] **Uptime monitor** — Pingdom/UptimeRobot hitting `/api/health` every minute
- [ ] **Stripe webhook delivery monitor** — Stripe Dashboard alerts on webhook failures
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
- [ ] Mobile haptic feedback on key CTAs (Stripe checkout, Ride Accept, JFTN Join)
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

1. **Today / this week**: Tick all 🔴 BLOCKERS. Especially Stripe live keys + email DNS.
2. **Quiet beta (50 users)**: invite the beta-tester waitlist. Use this to find any 🟡 HIGH items you missed.
3. **Public beta (500 users)**: open `/beta-tester` waitlist signup, run for 2 weeks.
4. **Soft launch**: lift the waitlist gate. Marketing push.
5. **TGE / Token launch**: only after the platform has 4-6 weeks of stable real-user data. Type `project complete` here when you're ready to unlock the Solana mainnet bridge.

---

**Honest read**: the app is **functionally complete for a soft launch with 50-500 beta users** today. The biggest risks before broader launch are:

1. Stripe in TEST mode → cannot charge real cards yet
2. No automatic driver/merchant bank payouts → manual approval bottleneck after first 100 transactions
3. No real-time delivery tracking for HungryVibes customer → they see "preparing" but don't get a "your food is here" ping

Everything else is either working, gracefully stubbed, or accepted polish for v1.1.

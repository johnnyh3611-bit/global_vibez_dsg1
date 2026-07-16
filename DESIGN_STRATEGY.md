# Global Vibez DSG Design Strategy (2026-07)

## Core Philosophy
Shift from a "Feature Collection" to a "Unified Platform."

Every user should feel like they're in one coherent ecosystem, not teleporting between apps.

---

## Top 3 Design Priorities

### 1. **Consolidate Information Architecture (IA)**
**Status**: ✅ COMPLETE (#100–#106)

Canonical hubs:
- `/dashboard` — Job Board (4 jobs)
- `/games` — Gaming
- `/dating/discover` — Dating
- `/streams` — Streaming (watch / go live)
- `/earn` — Monetization hub

Alias redirects for legacy `/tv*`, dashboard view URLs, earn deep-links, and games shortcuts are mounted. Product surfaces that are **not** aliases: `/glasshouse` (ownership), `/my-vibez*` (streaming), `/vibe-tv` (DSG TV).

**Metric**: Reduced cognitive load from 100+ routes to 4 clear jobs.

---

### 2. **"Play to Earn" UX**
**Status**: ✅ COMPLETE

- `/earn` hub with four paths + live chair ROI calculator
- EarningsBanner on Games / Dating surfaces
- Inline GlobalNavbar + mobile Earn tab (emerald highlight)
- UnifiedEarningsWidget on dashboard

**Metric**: Users see earn reminders before entering any game/date.

---

### 3. **Native Mobile Feel**
**Status**: ✅ COMPLETE (#104)

- Gesture library (`useGestures.ts`) — swipe, pull, long-press, haptics
- Discover: swipe like/pass, long-press sheet, pull-to-refresh, skeletons
- Dashboard / Earn / Games: haptics on primary CTAs

**Why**: Dating + gaming apps feel native. Web wrappers feel slow.

---

## Route Audit: Current State

### Primary Routes by Job
| Job | Primary Route | Sub-Routes | Status |
|-----|---------------|-----------|--------|
| Gaming | `/games` | `/spades`, `/bid-whist`, `/vibe-654-hall` | ✅ Ready |
| Dating | `/dating/discover` | `/speed-dating`, `/profile/edit` | ✅ Ready |
| Streaming | `/streams` | `/streamer/studio`, `/streamer/analytics` | ✅ Ready |
| Earning | `/earn` | `/chair-vault`, `/referral` | ✅ Ready |
| Hub | `/dashboard` | classic Job Board default | ✅ Ready |

### Alias Routes (Redirect)
- `/dashboard-classic` / `/dashboard-volumetric` → `/dashboard`
- `/lounge` → `/dashboard`
- `/tv` + `/tv/discover|broadcast|analytics` → streams / studio
- `/earn/chair` → `/chair-vault`, `/earn/referral` → `/referral`
- `/games/654`, `/games/vibez-654`, card aliases → canonical halls
- `/chair-registry` → `/chair-ledger`, `/dealer-lounge` → `/dealers`

### Navigation Labels
- Dice Games (not “654”) · Music Studio (route may still be `/plex`) · Dealers · Chair Ledger

---

## User Flow: First-Time User (FTU)

```
Landing (/)
  ↓ Demo Login  OR  email Sign Up / Sign In
Dashboard (/dashboard)
  ↓ Job Board + earnings + social proof
Pick first action:
  - Play Game → /games
  - Start Dating → /dating/discover
  - Watch / Go Live → /streams
  - Earn More → /earn
  - Wallet (optional) → /wallet  (Phantom after login)
```

**Key Insight**: No role selection survey. Let *actions* define role. Persona reorder (Phase 3) follows role + history.

---

## Visual Hierarchy: Action Tiers

```
Tier 1 (Primary): solid / high-contrast CTA
  - "Demo Login", "Enter Game", "Start Dating", "Go Live"

Tier 2 (Secondary): glass border, no fill
  - "Learn More", "View Profile", "Watch Stream"

Tier 3 (Tertiary): text link only
  - "See All", "Skip", "Back"

Tier 4 (Destructive): red solid
  - "Report", "Leave Room", "Cancel"
```

---

## Monetization Visibility

1. Dashboard → Earnings widget + banner + Job Board Earn section  
2. Games lobby → compact earnings banner + recommendations  
3. Dating → earn reminders without blocking swipe  
4. Streams → Go Live CTA  
5. Navigation → Earn highlighted (emerald)  
6. `/earn` → ROI calculator + four paths + social proof  

**Money story (public):** Vibez Coins (₵) are in-app credits today. At $DSG TGE, verified balances are **planned to convert 1:1**. Do not claim “100% on-chain” for the FTU loop.

---

## Roadmap: Phases

**Phase 1**: ✅ IA + Play to Earn + Earn nav + aliases  
**Phase 2**: ✅ Native mobile feel  
**Phase 3**: ✅ Personalization (persona, ROI, recs, social proof)  

**Landing honesty (follow-up):** Hero / FTU / money copy aligned to ship-core (Demo Login, four jobs, 1:1 TGE planned).

---

## Success Criteria

✅ **Phase 1–3:** Core loop solid; Earn visible; gestures + personalization live.  
✅ **Landing:** First viewport sells Demo Login + four jobs (not six utility rooms / wallet-first).

---

## Notes

- Do NOT sacrifice accessibility for aesthetics. Glass + glow must maintain WCAG AA contrast.
- Mobile-first always. Desktop is secondary layout.
- Every screen should answer: "What can I do right now?" and "What do I earn?"
- Chrome menu is **inline** (PageActionStrip / GlobalNavbar) — never sticky top bars.

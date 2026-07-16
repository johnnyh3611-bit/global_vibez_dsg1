# Global Vibez DSG Design Strategy (2026-07)

## Core Philosophy
Shift from a "Feature Collection" to a "Unified Platform."

Every user should feel like they're in one coherent ecosystem, not teleporting between apps.

---

## Top 3 Design Priorities

### 1. **Consolidate Information Architecture (IA)**
**Status**: ✅ COMPLETE

Kill alias routes and fragmented entry points:
- ~~`/glasshouse`~~ → Replaced with `/dashboard`
- ~~`/dashboard-classic` + `/dashboard-volumetric`~~ → Unified `/dashboard`
- ~~`/my-vibez` + `/my-vibez-themed`~~ → Consolidated view
- ~~`/vibe-tv` (DSG) + `/tv` (standalone)~~ → Single `/tv` namespace

**Implementation**:
- New **Job Board** component: 12 entry points across 4 job categories
  - 🎮 Gaming (Dice 654, Spade Plus, Bid Whist)
  - 💕 Dating (Discover, Speed-Dating, My Profile)
  - 📺 Streaming (Watch, Go Live, Analytics)
  - 💸 Earning (Chair, Referral, Games, Streamer)
- **Dashboard** now central hub — shows earnings stats + unified job board
- **Navigation**: Dashboard as primary entry point (moved before dating/games)

**Metric**: Reduced cognitive load from 100+ routes to 4 clear jobs.

---

### 2. **"Play to Earn" UX** (In Progress)
**Status**: 🟢 IN PROGRESS

Make monetization *visible on every screen*, not hidden in `/earn`.

**Implementation**:
- New `/earn` page: Full monetization hub with 4 earning paths
  - 💺 Chair Holder ($50-500/month passive)
  - 🎯 Referral Bounty ($5-50/invite)
  - 🏆 Game Winnings ($1-500/game)
  - 💰 Streamer Revenue ($50-5000/month)
- **EarningsBanner** component: Compact & full variants
  - Surfaces "Play to Earn" callout on Games, Dating, TV pages
  - Quick-start CTA buttons (Play Game, Share Code, Go Live, Buy Chair)
- **GlobalNavbar**: Highlighted "Earn 💸" link (green gradient)
- **EarningsWidget**: Dashboard shows balance, weekly earnings, earning breakdown

**Metric**: Users see 4+ earning reminders before entering any game/date.

---

### 3. **Native Mobile Feel** (Next Priority)
**Status**: 🟢 IN PROGRESS (Phase 2 wired on core loop)

Gesture-based interactions + haptics:
- ✅ Swipe left/right on `/dating/discover` (like / pass)
- ✅ Pull-to-refresh on discover + classic dashboard
- ✅ Long-press quick actions (save / share / report) on discover
- ✅ Haptic feedback on Job Board, Earn hub, game start, match
- ✅ Skeleton loaders on discover + dashboard bootstrap
- ✅ Smooth card / path transitions (Framer Motion)

**Why**: Dating + gaming apps feel native. Web wrappers feel slow.

---

## Route Audit: Current State

### Primary Routes by Job
| Job | Primary Route | Sub-Routes | Status |
|-----|---------------|-----------|--------|
| Gaming | `/games` | `/games/654`, `/games/tournaments`, `/dealer` | ✅ Ready |
| Dating | `/dating` | `/dating/discover`, `/dating/speed-dating` | ✅ Ready |
| Streaming | `/tv` | `/tv/discover`, `/tv/broadcast`, `/tv/analytics` | ✅ Ready |
| Earning | `/earn` | `/earn/chair`, `/earn/referral` | ✅ New |
| Hub | `/dashboard` | (curated job board + stats) | ✅ New |

### Alias Routes (Redirect) — status
- ✅ `/dashboard-classic` / `/dashboard-volumetric` → `/dashboard` (view preference)
- ✅ `/lounge` → `/dashboard`
- ✅ `/tv` + `/tv/*` discover/broadcast/analytics → streams / studio
- ✅ `/earn/chair` → `/chair-vault`, `/earn/referral` → `/referral`
- ✅ `/games/654`, `/games/vibez-654`, card-game aliases → canonical halls
- ✅ `/chair-registry` → `/chair-ledger`, `/dealer-lounge` → `/dealers`
- `/glasshouse` — **kept** as Celestial Glasshouse ownership (not an alias)
- `/my-vibez*` — **kept** as MY VIBEZ streaming product (not dating)
- `/vibe-tv` — **kept** as DSG Vibe TV hub; streaming Job Board uses `/streams`

### Navigation Labels to Rename (Clarity)
- ~~`654`~~ → `Dice Games` (mobile tab + Explore)
- ~~`Plex`~~ → `Music Studio` (Explore + mobile Music tab)
- ~~`Dealer Lounge`~~ → `/dealers` redirect
- ~~`Chair Registry`~~ → `/chair-ledger` redirect

---

## User Flow: First-Time User (FTU)

```
Landing (/) 
  ↓ Wallet Login
Dashboard (/dashboard)
  ↓ See earnings widget + job board
Pick first action:
  - Play Game → /games
  - Start Dating → /dating
  - Go Live → /tv
  - Earn More → /earn
```

**Key Insight**: No role selection survey. Let *actions* define role.

---

## Visual Hierarchy: Action Tiers

Consistency across all CTAs:

```
Tier 1 (Primary): Purple glow, solid bg
  - "Enter Game", "Start Dating", "Go Live"
  
Tier 2 (Secondary): Glass border, no fill
  - "Learn More", "View Profile", "Watch Stream"
  
Tier 3 (Tertiary): Text link only
  - "See All", "Skip", "Back"
  
Tier 4 (Destructive): Red glow, solid bg
  - "Report", "Leave Room", "Cancel"
```

---

## Monetization Visibility: Campaign

Where earnings reminders appear:

1. **Dashboard** → Top section: Earnings widget + earnings banner
2. **Games Lobby** (`/games`) → Compact earnings banner above game cards
3. **Dating** (`/dating`) → "See who earns" side panel (referral leaderboard)
4. **Streaming** (`/tv`) → "Go Live" CTA prominently featured
5. **Navigation** → "Earn 💸" link highlighted in green
6. **Every 3rd screen** → "Did you know?" earning tip modal (opt-out)

**Goal**: Whisper "you can earn here" without being pushy.

---

## Metrics to Track

1. **Navigation**: % users who click Dashboard first
2. **Discoverability**: % users who visit `/earn` per week
3. **Clarity**: % users who can name 3+ earning paths (survey)
4. **Engagement**: Avg time spent on earning flows vs gaming flows
5. **Monetization**: % of active users earning (any path)

---

## Roadmap: Phases

**Phase 1 (This week)**: Consolidate IA + Play to Earn UX
- ✅ Dashboard + Job Board
- ✅ Earn hub + Earnings Banner
- ✅ Global job nav (inline, not sticky) + mobile Earn tab + Quick Access Earn (emerald)
- ✅ Alias routes redirect (`/tv`→`/streams`, dashboard aliases, earn deep-links, games aliases)

**Phase 2 (Next week)**: Native Mobile Feel
- ✅ Gesture library (`src/hooks/useGestures.ts` — swipe, pull, long-press, haptics)
- ✅ Haptics on core-loop CTAs (Job Board, Earn, Games enter, Discover)
- ✅ Skeleton loaders on Discover + Dashboard
- ✅ Smooth transitions on Discover / Earn paths (Framer Motion)

**Phase 3 (Personalization)**: ✅ COMPLETE (#105)
- ✅ Role-based landing (`lib/persona.ts` reorders Job Board + Earn paths)
- ✅ Earnings calculator (`ChairRoiCalculator` on `/earn` via `/api/chairs/economics`)
- ✅ Recommendation engine (`useRecommendedGames` + Games hub strip + Job Board CTA)
- ✅ Social proof strip (live streams + top earner + WinnerTicker on dashboard/`/earn`)

---

## Design System: Tokens (Reminder)

### Colors
- Primary: `#7c3aed` (brand-primary, purple)
- Accent: `#ec4899` (brand-accent, pink)
- Success: `#10b981` (emerald-500, earning highlight)
- Destructive: `#ef4444` (red-500, warning/delete)
- Glass: `rgba(255,255,255,0.05)` (surface-glass)

### Typography
- Display: Geist Sans Bold, 5xl (landing)
- Heading: Geist Sans Bold, 2xl-3xl (section titles)
- Body: Geist Sans Regular, sm-base
- Mono: Geist Mono, xs-sm (codes, stats)

### Spacing Grid
- 4px / 8px / 16px (xs-md-lg)
- Container max-width: 1152px (max-w-6xl)

### Borders & Shadows
- Glass radius: 16px
- Glass border: `rgba(255,255,255,0.1)` with 1px
- Glow shadow: `0 0 20px rgba(124,58,237,0.4)` (brand-primary)

---

## Success Criteria

✅ **By end of Phase 1:**
- Dashboard is primary entry point (>60% of users land here first)
- Earnings banner visible on 5+ core screens
- `/earn` page gets 20+ unique visitors per day
- No ambiguous navigation labels
- Build time <30s, 0 type errors

✅ **By end of Phase 2:**
- Mobile swipe/haptic interactions feel native
- Mobile users spend 30% longer on app (retained by feel)
- Gestures reduce nav clicks by 20%

✅ **By end of Phase 3:**
- Users can complete a "first earning" flow in <3 minutes
- 30%+ of active users earn in any path per week
- Churn rate drops (monetization increases stickiness)

---

## Notes

- Do NOT sacrifice accessibility for aesthetics. Glass + glow must maintain WCAG AA contrast.
- Mobile-first always. Desktop is secondary layout (not feature parity).
- Every screen should answer: "What can I do right now?" and "What do I earn?"

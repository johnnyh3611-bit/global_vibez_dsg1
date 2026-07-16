# Ship Core — Definition of Complete

Global Vibez will never feel “done” by finishing every file in the repo.
Treat **complete** as a reliable core loop, not 100% of experimental surface.

## Core loop (must work end-to-end)

1. Land → Demo / email login → `/dashboard`
2. Dashboard shows earnings cue + **Job Board** (4 jobs)
3. Gaming: open `/games`, play Spades **or** Bid Whist **or** Dice Hall
4. Dating: `/dating/discover` → match list
5. Earn: `/earn` → chair / referral / games / studio (all live routes)
6. Wallet reachable from hub; logout works

Anything outside this loop is **optional** until the loop is solid.

## Four jobs (IA)

| Job | Primary entry | Notes |
|-----|---------------|--------|
| Gaming | `/games`, `/vibe-654-hall` | Gate unfinished titles via `comingSoonGames.ts` |
| Dating | `/dating`, `/dating/discover` | Prefer mounted paths over `/dating/*` aliases |
| Streaming | `/streams`, `/streamer/studio` | `/tv/*` redirects into these |
| Earning | `/earn` | Hub only; deep links go to chair/referral/wallet |

## Fine-tune rules

1. **No new product surface** until core loop QA passes.
2. **Dead links → redirect or Coming Soon**, never a 404 tile.
3. **Alias URLs redirect** to the canonical hub (`/dashboard`, `/earn`, etc.).
4. **Docs that say COMPLETE** but contradict mounted routes get ignored; code wins.
5. Keep experimental pillars (Ridez, Yellow Pages, UE5, Solana) behind Explore / Beta Hub — not the first viewport.

## Next fine-tune slices (ranked)

1. ~~Trim classic dashboard tile sprawl below the Job Board~~ (done — collapsed under More)
2. ~~Default dashboard to classic hub so Job Board is visible~~ (done)
3. Smoke the core loop on demo login (manual or Playwright).
4. Collapse stale markdown under `source/web-assets/*.md` into this file + README.
5. Native mobile gestures (DESIGN_STRATEGY Phase 2) only after loop QA.

## Done when

- [x] Classic dashboard leads with Job Board + earnings (beta/galaxy collapsed)
- [x] `/earn` and mobile **Earn** tab both land on live CTAs
- [x] Job Board / EarningsBanner links redirect to mounted routes
- [x] `yarn typecheck` clean
- [x] Demo login → dashboard Job Board → `/earn` + `/games` + `/spades` (local smoke)
- [x] Local CORS includes `http://localhost:3000` by default
- [ ] Production smoke (`npm run smoke`) green against live API

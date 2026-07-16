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
6. Session / sprint markdown belongs in `source/web-assets/docs/archive/session-notes/` — do not add new `*COMPLETE*.md` files at the app root.

## Canonical docs

| Doc | Purpose |
|-----|---------|
| This file | Definition of complete |
| `README.md` | Dev / smoke commands |
| `PRODUCTION_OPS.md` | Live www + API wiring |
| `source/web-assets/README.md` | App tree pointers |
| `source/web-assets/docs/archive/session-notes/` | Historical notes only |

## Next fine-tune slices (ranked)

1. ~~Earn hub + Job Board live links + nav clarity~~ (#100)
2. ~~Classic hub default + dashboard declutter + local CORS~~ (#101)
3. ~~Archive stale session markdown~~ (#102)
4. ~~Production smoke green with live FastAPI~~ (`npm run smoke:full` → Railway API)
5. ~~Bearer session fixes + Emergent login removed~~ (#103)
6. ~~Native mobile gestures (DESIGN_STRATEGY Phase 2)~~ (#104)
7. ~~Phase 3 personalization~~ (#105)
8. ~~Phase 1 leftovers: Earn nav highlight + alias redirects~~ (#106)
9. ~~Landing honesty — Demo Login FTU + four jobs + 1:1 TGE money story~~ (#107)
10. Landing trim + chair conversion focus — lifestyle dock / WaysToEarn beta collapse + `/earn` Start-here chairs CTA

## Done when

- [x] Classic dashboard leads with Job Board + earnings (see #101)
- [x] `/earn` and mobile **Earn** tab both land on live CTAs
- [x] Job Board / EarningsBanner links redirect to mounted routes
- [x] Stale session docs archived under `docs/archive/session-notes/`
- [x] `yarn typecheck` clean (local)
- [x] Demo login → dashboard Job Board → `/earn` + `/games` + `/spades` (local smoke)
- [x] Local CORS includes `http://localhost:3000` by default
- [x] Production smoke (`npm run smoke` + `smoke:full`) green against Railway API
- [x] Mobile discover: swipe like/pass + long-press sheet + pull-to-refresh (#104)
- [x] Dashboard / Earn / Games: haptics on primary CTAs; dashboard pull-to-refresh (#104)
- [x] Persona-ordered Job Board + Earn paths (#105)
- [x] Chair ROI calculator on `/earn` (#105)
- [x] Recommended games on `/games` + next-game CTA on dashboard (#105)
- [x] Social proof strip (wins / live / top earner) on dashboard + `/earn` (#105)
- [x] Desktop GlobalNavbar + dashboard Earn CTA (emerald highlight)
- [x] Canonical alias redirects for `/tv`, games, earn deep-links, dealer/chair labels
- [x] Production API: demo-login → `/api/auth/me` + `/api/chairs/economics`; www shells for `/dashboard` `/earn` `/games`
- [ ] Lifestyle dock = four beta pillars only (no “Six Utility Rooms”); WaysToEarn core-first + collapsed beta (merge + redeploy)
- [ ] `/earn` “Start here · Own a Chair” conversion band → `/chair-vault` (merge + redeploy)

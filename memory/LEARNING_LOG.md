# Agent Learning Log

**Append-only.** Never edit past entries. Every new lesson from the
`<LogDesignLesson />` button lands here automatically via
`POST /api/agent/learn`.

---

## 2026-04-27

- Status bars must be **pinned bottom** with `backdrop-blur-md` so gameplay never gets hidden behind them. (source: user feedback)
- Menu bars must use `flex flex-wrap` so items wrap on narrow screens (Chromebooks, tablets). Hard rule.
- Revenue split is locked at **30% Team (13% Founder + 17% Core) / 40% Operations / 30% Reserve**. Founder cap $20k/mo above $1M MRR.
- All raw `setTimeout` in React components leak if the user navigates mid-timer — mandate `useSafeTimeout` hook.
- Card-suit colors must be centralized in `@/lib/cardGameColors` so one file can re-theme the entire suite.
- Tailwind arbitrary-value syntax (`bg-[#050507]`) is the *sanctioned* design-token escape hatch — not a violation.
- `overflow-scroll` is BANNED. Use `overflow-y-auto scrollbar-hide` instead.
- Bets are ALWAYS sliders, never text inputs. Currency is `₵` Vibez Coins, never `$` USD.
- [Visuals] Test lesson from quality gate
- [Visuals] Status bars must be pinned bottom with backdrop-blur-md so gameplay never gets covered.
- [Treasury] Treasury split is 30% Team (13% Founder + 17% Core), 40% Operations, 30% Reserve. Founder cap is twenty thousand dollars per month above one million MRR.
- [Rules] Card dealing animations must use spring physics with stiffness 80 and damping 15.

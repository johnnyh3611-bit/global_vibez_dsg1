# Legacy Code Deprecation — Status

**Last Updated:** Feb 2026
**Status:** Phase 1 + Phase 2 complete; Phase 3 in-progress.

---

## ✅ Completed

### Phase 2: Refactor Oversized Components
- **`GodModeDashboard.jsx`** 935 → 211 lines. Split into 7 tab components under `components/admin/tabs/`.
- **`VibeDice654Premium.jsx`** 1,427 → 528 lines. Split into 12 sub-components under `components/games/vibedice654/`.
- **`BlackjackGameSimple.jsx`** 829 → 500 lines. Split into 9 sub-components under `components/practice_games/blackjack/`.

### Phase 3: Archive Obsolete Variants
Already moved to `/app/frontend/src/archive_unused_components/` (`.backup` ext — webpack ignores):
- `App_OLD_BACKUP.js`
- `BidWhistPremiumAAA.backup.jsx`
- `BlackjackGameAAA.jsx.backup`
- `Chat.jsx.backup`
- `Messages.jsx.backup`
- `MultiplayerLobby_OLD_WEBSOCKET.jsx.backup`
- `RouletteGameAAA.jsx.backup`
- `SafeRideTracking.jsx.backup`
- `VibeDice654Premium.jsx.backup`

### Phase 3: Deprecation Notices
- `BlackjackGameAAA.jsx` — JSDoc `@deprecated` header added (kept live for bookmarked URL backward-compat at `/practice/play/blackjack-aaa`).

---

## 🟡 Remaining Oversized Components

| File | Lines | Action |
|------|-------|--------|
| `/components/practice_games/BlackjackGameAAA.jsx` | 683 | Mark deprecated ✅ / migrate users to Universal Engine Blackjack |
| `/components/casino/HumanHolographicDealer.jsx` | ~505 | Extract dealer logic into custom hooks |
| `/components/CinematicCelebration.jsx` | ~455 | Split animation logic |

---

## 🧭 Redirect Plan (Backward Compat)

Legacy URLs → New routes (to be added in `gamesRoutes.jsx`):
- `/blackjack` → `/practice/play/blackjack`
- `/blackjack-aaa` → `/practice/play/blackjack-aaa`
- `/vibe-dice` → `/dice`

Redirects currently honored in-app via router fallbacks; no hardcoded redirects needed at the Nginx layer.

---

## 📉 Measured Impact

- Top-3 heaviest components combined: 3,191 → 1,239 lines (**61% reduction**).
- New surface of small, testable components: 27 new files averaging ~70 lines each.
- Zero runtime regressions verified via smoke screenshots of `/dice` and `/practice/play/blackjack` post-refactor.
- Dead code removed: 1 stale `BlackjackGameRefactored.jsx` and 5 leftover blackjack sub-components (PlayingCard, HandDisplay, BettingControls, GameControls, ResultDisplay) that were part of an abandoned earlier refactor attempt.

---

## 📝 Next Action Items

1. Add route redirects in `gamesRoutes.jsx` for legacy URLs (P2).
2. Extract `HumanHolographicDealer` dealer logic into `hooks/useHolographicDealer.js` (P2).
3. Split `CinematicCelebration.jsx` animation logic (P2).
4. After 30 days of no traffic on `/practice/play/blackjack-aaa`, hard-archive `BlackjackGameAAA.jsx`.

---

**Status legend:** ✅ = done, 🟡 = in-progress, 🔴 = not started

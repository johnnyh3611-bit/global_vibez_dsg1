# Global Vibez DSG — E2E (Playwright)

End-to-end smoke tests for the user-facing card games and admin flows.

## Running

```bash
cd frontend
yarn e2e          # headless chromium
yarn e2e:headed   # with browser UI
yarn e2e:report   # open last HTML report
```

Set `E2E_BASE_URL` to point at a specific environment:
```bash
E2E_BASE_URL=https://staging.example.com yarn e2e
```

Default is the preview URL baked into `playwright.config.ts`.

## Suites

| File | Covers |
|------|--------|
| `spades-practice.spec.ts` | `/spades-practice` — bid overlay, 13-card deal, playing phase enter |
| `blackjack-universal.spec.ts` | `/blackjack-universal` — bet → deal → hit/stand → settle |
| `poker-practice.spec.ts` | `/poker-practice` — blinds, 4 seats, fold → next hand |
| `rummy-practice.spec.ts` | `/rummy-practice` — 10-card deal, draw from stock |
| `bid-whist-platinum.spec.ts` | `/bid-whist-aaa` — regression, bidding ring appears |

## Auth

All tests sign in via `demoLogin()` from `_helpers/auth.ts`, which clicks the
"Demo Login (Quick Access)" button on `/login` and waits for the redirect.
No fixed accounts needed.

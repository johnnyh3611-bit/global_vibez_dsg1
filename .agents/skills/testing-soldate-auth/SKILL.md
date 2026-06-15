---
name: testing-soldate-auth
description: Test the SolDate (global_vibez_dsg1) wallet-auth and route-gating flows end-to-end. Use when verifying auth, login UI, or protected-route changes.
---

# Testing SolDate auth & route gating

SolDate is a Next.js 16 App Router app. Auth is Solana-wallet based: nonce -> wallet signature -> jose JWT cookie (`dating-auth-token`). Protected routes are gated by `src/proxy.ts` (Next.js 16 renamed the `middleware` convention to `proxy`), matcher `/dating/:path*` and `/dealer/:path*`.

## Important: this is Next.js 16, not the one you know
`AGENTS.md` warns the framework has breaking changes. Key one: middleware is now `src/proxy.ts` exporting `proxy` (NOT `src/middleware.ts`/`middleware`). A correctly-registered proxy shows up in `next build` output as `ƒ Proxy (Middleware)`. Read `node_modules/next/dist/docs/` before changing conventions. Review bots may flag the proxy rename as wrong — verify against the build output / a live request before believing it.

## Running locally for tests
The app builds with `output: 'standalone'`, so `next start` warns and won't serve correctly. Use the standalone server:
```bash
git_secret=... # not needed for build
JWT_SECRET="any-non-empty-string" npx next build      # build
cp -r .next/static .next/standalone/.next/static       # standalone needs assets copied
cp -r public .next/standalone/public
cd .next/standalone && JWT_SECRET="any-non-empty-string" PORT=3300 node server.js
```
`JWT_SECRET` MUST be set or `getSession`/proxy throw (the proxy then redirects to /login, which still 'works' but masks misconfig). `npx tsc --noEmit`, `npx eslint`, and `npx next build` are the standard checks.

## Vercel preview is usually unreachable
The Vercel preview deployment returns **401 on every path** (including `/`) due to Vercel Deployment Protection (SSO/password gate). You cannot test the preview without the owner disabling protection or providing a bypass token. Default to a local standalone prod build instead. If preview testing is required, ask the user to disable Deployment Protection or supply a protection-bypass token.

## What to verify (no wallet needed)
Full sign-in needs a real Solana wallet signature (Phantom/Solflare), which can't be done headlessly. Test everything up to that boundary:
- `/login` renders the `WalletAuth` component: "Select Wallet" button (opens a modal with Phantom/Solflare) + a disabled "Sign in with wallet" button. The string "Auth Component Removed" must NOT appear. Note: the login page is client/Suspense, so curl SSR only shows "Loading..."; verify in a real browser.
- Unauthenticated `/dealer` -> 307 redirect to `/login?redirect=%2Fdealer`.
- Unauthenticated `/dating` -> 307 redirect to `/login?redirect=%2Fdating`.
- `/` -> 200 (public). `POST /api/auth/demo-login` -> 404 (the old bypass endpoint was removed; if it returns 200 the bypass regressed).
- Quick curl checks: `curl -s -o /dev/null -D - http://localhost:3300/dating | grep -iE 'HTTP/|location'`.

## Devin Secrets Needed
- None required for local gating tests (`JWT_SECRET` can be any non-empty dev string).
- For a real end-to-end sign-in you'd need a funded/test Solana wallet able to sign messages (not available headlessly).
- For Vercel preview testing: a Vercel Deployment Protection bypass token (owner must provide).

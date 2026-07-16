# Global Vibez DSG — app tree

CRA frontend + FastAPI backend + MongoDB. Canonical product code lives here.

## Docs that matter

| Doc | Use |
|-----|-----|
| [`/SHIP_CORE.md`](../../SHIP_CORE.md) | What “complete” means (core loop) |
| [`/README.md`](../../README.md) | Dev commands (`npm run dev`, backend, smoke) |
| [`/PRODUCTION_OPS.md`](../../PRODUCTION_OPS.md) | Railway API + Vercel www |
| [`RAILWAY_DEPLOY.md`](./RAILWAY_DEPLOY.md) | Backend deploy details |
| [`BRAND_GUIDELINES.md`](./BRAND_GUIDELINES.md) | Brand tokens |
| [`TESTING_STRATEGY.md`](./TESTING_STRATEGY.md) | Test approach |
| [`docs/archive/session-notes/`](./docs/archive/session-notes/) | Historical sprint notes (not authoritative) |

## Quick start

From repo root:

```bash
npm run sync:guards:install   # once
npm run dev                   # mongo + :8001 + :3000
```

Demo Login on `/login`. Health: `GET http://localhost:8001/health`.

## Layout

```
frontend/   CRA + CRACO (Yarn) → :3000
backend/    FastAPI + Socket.IO → :8001
legal/      policies
onchain/    Solana experiments (optional)
```

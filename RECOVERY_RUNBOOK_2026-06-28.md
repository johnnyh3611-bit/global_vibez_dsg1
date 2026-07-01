# Global Vibez Recovery Runbook (2026-06-28)

## 1) Ground Truth (Verified)

- Current production domain `www.globalvibezdsg.com` resolves to Vercel and serves the root Next.js app in this repo.
- Current repo/branch: `johnnyh3611-bit/global_vibez_dsg1` on `main`.
- Active app entrypoint is root-level Next.js (`package.json`, `next.config.ts`, `src/app/**`).
- Root app includes its own API routes under `src/app/api/**` for wallet auth, dating, dealer, game, and tv.
- Vercel aliases are declared in `vercel.json` for `globalvibezdsg.com` and `www.globalvibezdsg.com`.
- Azure Container Apps (`web-vibez`, `api-vibez`) are currently a separate, unhealthy deployment track and are not attached to production DNS.
- `source/web-assets/**` is a separate legacy/parallel full-stack codebase (React + FastAPI + Mongo compose) and should not be treated as current production unless explicitly migrated.

## 2) Repo Boundary Decision

Treat the root Next.js app as the canonical production app.

In-scope production surface:
- `package.json`
- `next.config.ts`
- `vercel.json`
- `src/**`
- `public/**`

Out-of-scope (legacy) surface for production deploys:
- `source/web-assets/**`
- `source/scripts/**`

## 3) Immediate Security Actions

1. Rotate any secret previously exposed in Azure app settings (Mongo URI found earlier in Azure Container Apps env).
2. Ensure `JWT_SECRET` is set in Vercel production environment.
3. Add/update `.env.example` in repo root with only variable names, no real values.
4. Confirm no plaintext secrets remain in committed files.

## 4) Deployment Discipline (Single Source of Truth)

1. GitHub `main` is production source of truth.
2. Vercel production deploys only from `main`.
3. No direct cloud-only edits unless mirrored back to code immediately.
4. Azure changes must be defined from repo-based deployment artifacts (future IaC phase), not ad hoc portal edits.

## 5) Validation Pipeline (from this repo)

Because `npm ci` was terminated by host limits, use staged validation:

1. Dependency install with reduced pressure:
   - `npm install --no-audit --no-fund`
2. Static checks:
   - `npm run lint`
3. Build checks:
   - `npm run build`
4. Runtime checks:
   - `npm run dev` and verify:
     - `/`
     - `/login`
     - `/dating` (redirect behavior)
     - `/games`
     - `/tv`
     - `/dealer`
     - `/api/auth/nonce` and `/api/auth/verify` flow

## 6) Azure Reconciliation Strategy (Do After Root App Is Stable)

Target architecture options:

Option A (recommended short-term):
- Keep frontend production on Vercel.
- Rebuild Azure only for backend/staging workloads from explicit code.

Option B (later migration):
- Move full stack to Azure from this same repo only after staging parity.

Guardrails:
- Do not cut DNS until staging passes full route/auth tests.
- Ensure container target ports match actual listening ports.
- Remove drifted/old revisions and duplicate container definitions.

## 7) Legacy Subtree Handling

For `source/web-assets/**`:
- Mark as `legacy` in docs.
- Freeze from production deploy workflows.
- Decide later whether to archive or selectively migrate assets/features.

## 8) Operational Next Steps

1. Stabilize root app dependencies and pass lint/build.
2. Capture Vercel env vars into a managed secret inventory document (without secret values).
3. Create staging validation checklist and run it per commit.
4. Reintroduce Azure via explicit deployment code and staged validation only.

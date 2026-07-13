# Global Vibez Recovery Runbook (updated 2026-07-13)

## 1) Ground Truth (Verified)

- Production domain `www.globalvibezdsg.com` resolves to **Vercel** and serves the
  **CRA app** from `source/web-assets/frontend` (see root `vercel.json`).
- There is **no** root Next.js app in this tree (`next.config.*` / `src/app` absent).
- Canonical product path: `source/web-assets/` (frontend CRA + backend FastAPI + Mongo).
- Azure Container Apps (`web-vibez`, `api-vibez`) and the old Railway hostname in
  `frontend/Dockerfile` are **not** healthy production backends as of 2026-07-13.
- Azure VM deploy (`.github/workflows/deploy.yml`) now publishes
  `source/web-assets/frontend/build` to nginx — not `source/scripts` extension artifacts.

## 2) Blank-screen incident (fixed in repo)

**Symptom:** black page + only “Made with Emergent” badge; console
`TypeError: Cannot read properties of undefined (reading 'replace')`.

**Cause:** Vercel production build omitted `REACT_APP_BACKEND_URL`. Eager import of
`SpeedDatingVideo` did `undefined.replace('http','ws')` during module init.

**Fix:**
1. `src/config/backendUrl.ts` + safe usage in `SpeedDatingVideo.tsx`
2. `frontend/.env.production` ensures the key exists at build time
3. Set real `REACT_APP_BACKEND_URL` in the Vercel project env, then redeploy

## 3) Repo boundary

In-scope production surface:
- `source/web-assets/**`
- `vercel.json`
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml` (Azure VM static mirror)

Out-of-scope / do not treat as production:
- Root Next.js leftovers (`eslint.config.mjs` Next preset, orphan `next` deps)
- `source/scripts/**` (vendored VS Code Python extension)
- `source/azure-infra/**` (Foundry AI sample)

## 4) Workspace open / sync

```bash
npm run sync:workspace
npm run dev            # scripts/dev-up.sh
npm run smoke          # production shell checks
```

## 5) Azure reconciliation

Short-term:
- Keep DNS on Vercel for the frontend.
- Point `REACT_APP_BACKEND_URL` at a live FastAPI host (Railway service or Azure
  Container App once healthy).
- Use fixed `deploy.yml` only if the Azure VM nginx mirror should stay in sync.

Do not cut DNS to Azure until `/health` on the API host returns JSON 200 and the
frontend bundle includes a non-empty `REACT_APP_BACKEND_URL`.

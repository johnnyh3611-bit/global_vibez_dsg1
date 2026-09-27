This repository defaults to the completed **Global Vibez DSG** app in
`source/web-assets` (CRA frontend + FastAPI backend + MongoDB).

Root npm commands are wired to that app.

## Getting Started (opening script)

One command starts Mongo (if available), backend `:8001`, and frontend `:3000`:

```bash
npm run sync:guards:install   # once per clone
npm run sync:workspace        # match origin/main
npm run dev                   # scripts/dev-up.sh
```

Or with Docker Compose:

```bash
npm run dev:docker
```

> **Note:** `npm run dev:docker` runs Mongo with auth enabled (`docker-compose.yml`
> sets `MONGO_INITDB_ROOT_USERNAME`/`PASSWORD`), so its `MONGO_URL` is
> `mongodb://admin:<password>@mongodb:27017/`. `npm run dev` (via
> `scripts/dev-up.sh`) instead starts a local no-auth `mongod` and uses
> `mongodb://127.0.0.1:27017`. Don't mix `.env` files between the two flows.

Open [http://localhost:3000](http://localhost:3000). Use **Demo Login** on `/login`.

## Production (flawless www)

See **`PRODUCTION_OPS.md`** — short version:

1. Deploy FastAPI on Railway (`source/web-assets/backend`) + Mongo
2. Set Vercel env `REACT_APP_BACKEND_URL` to that API URL
3. Redeploy Vercel
4. `npm run smoke https://www.globalvibezdsg.com https://YOUR-API`

Useful commands:

```bash
npm run build
npm run backend
npm run typecheck
npm run smoke
```

## Deployment (single source of truth)

| Target | Role | Config |
|--------|------|--------|
| **Vercel** | Production frontend for `www.globalvibezdsg.com` | `vercel.json` → builds `source/web-assets/frontend` |
| **Railway** | Full-stack option (backend + frontend services) | `source/web-assets/{backend,frontend}/railway.json` |
| **Azure VM** | Optional static mirror via nginx | `.github/workflows/deploy.yml` → deploys `frontend/build` |

### Vercel project settings (must match repo)

- **Root Directory:** `source/web-assets/frontend`
- **Framework Preset:** `Other`
- **Install Command:** `yarn install --frozen-lockfile`
- **Build Command:** `yarn build`
- **Output Directory:** `build`
- **Config file used by this root:** `source/web-assets/frontend/vercel.json`

### Deployment source lock

- **GitHub `main` is the only deployment source** for Vercel and Railway.
- `vercel.json` keeps `git.deploymentEnabled.main=true`; no other branch may be enabled.
- Railway must deploy only the service roots:
  - `source/web-assets/backend`
  - `source/web-assets/frontend`
- Root guard files (`railway.json`, `source/web-assets/railway.json`) intentionally fail deploys from wrong directories.

### Required merge checks (branch protection)

Configure branch protection on `main` to require:

- `Core Health Check`
- `PR Up-To-Date Check`
- `Platform Parity Check`
- `Vercel runtime checks`
- `Railway health checks`

If any required check is red, do not merge.

Before and after deploy, verify:
- Deploy branch is `main`
- Deployed commit SHA matches latest GitHub `main`
- Do one **Redeploy with cache cleared** after changing root/build/env settings

Set **`REACT_APP_BACKEND_URL`** in Vercel (and GitHub secret for Azure builds)
to the live FastAPI base URL. Without that env var at **build** time, older
bundles crashed on a blank black screen.

## Workspace sync

```bash
npm run sync:workspace   # fast-forward local main to origin/main
npm run sync:verify      # assert HEAD == origin/main
```

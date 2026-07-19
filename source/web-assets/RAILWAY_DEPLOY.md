# Global Vibez DSG — Railway Deployment Guide

## Architecture

Two Railway services in **one project** (plus MongoDB):

| Service | Root Directory | Runtime | Start |
|---|---|---|---|
| `backend-api` | `source/web-assets/backend` | Python FastAPI + Socket.IO | `sh /app/entrypoint.sh` (`$PORT`) |
| `frontend-globalvibez` | `source/web-assets/frontend` | CRA static build + `serve` | `serve -s build -l $PORT` |

MongoDB: **Railway MongoDB plugin** OR **MongoDB Atlas** (free tier works).

### Why not a single multi-service `railway.json`?

Railway loads **one** `railway.json` per service (scoped by that service’s Root Directory). A root file with a `services: []` array is **not** supported and would be ignored or misapplied.

This repo already has the correct layout:

- Repo root `railway.json` — **guard** that fails if someone deploys the monorepo root by mistake
- `source/web-assets/backend/railway.json` — Docker + `/health`
- `source/web-assets/frontend/railway.json` — Docker + `/` healthcheck

`vercel.json` was renamed to `vercel.json.bak` so Railway/Nixpacks do not pick up Vercel-specific install/build settings if the root is ever scanned.

---

## Service networking (important)

| Traffic | URL to use |
|---|---|
| **Browser → API** (CRA axios/fetch/Socket.IO) | Backend **public** HTTPS URL, e.g. `https://backend-api-xxxx.up.railway.app` |
| **Service → service** (server-side only) | Optional: `http://backend-api.railway.internal:$PORT` |

The React app bakes `REACT_APP_BACKEND_URL` (alias: `REACT_APP_API_URL`) at **build time**. That value runs in the user’s browser, so it **must not** be `*.railway.internal` — browsers cannot resolve Railway private DNS.

Set on the **frontend** service (build args / variables):

```
REACT_APP_BACKEND_URL=https://<backend-public-host>
# optional alias (same public URL):
# REACT_APP_API_URL=https://<backend-public-host>
REACT_APP_FRONTEND_URL=https://<frontend-public-host>
```

Private networking still helps for future server-to-server calls (webhooks, SSR, workers). It does not replace the public URL for this SPA.

---

## Step 1 — Create Railway Project

1. Go to [railway.app](https://railway.app) → **New Project**
2. Choose **Deploy from GitHub repo** → select `johnnyh3611-bit/global_vibez_dsg1`

---

## Step 2 — Add MongoDB

> **Do not add PostgreSQL.** Global Vibez DSG uses MongoDB only (`MONGO_URL`).

In your Railway project:

- Click **+ New** → **Database** → **MongoDB** (not Postgres)
- Copy the `MONGO_URL` / connection string from the MongoDB service variables
- Optionally use **MongoDB Atlas** instead and paste that URI as `MONGO_URL`

---

## Step 3 — Deploy the Backend Service (`backend-api`)

1. Click **+ New** → **GitHub Repo** → same repo
2. Set **Root Directory** to: `source/web-assets/backend`
3. Railway uses `Dockerfile` + `railway.json` (not `npm run build:server` — there is no Node server dist)
4. Add these **Environment Variables**:

```
MONGO_URL=<from MongoDB plugin above>
DB_NAME=global_vibez
JWT_SECRET=<generate: openssl rand -hex 32>
DISABLE_BG_SCHEDULERS=1
ENVIRONMENT=production
CORS_ORIGINS=*
EMERGENT_LLM_KEY=<your Emergent LLM key>
STRIPE_API_KEY=<your Stripe secret key — sk_test_ until sandbox verified>
STRIPE_WEBHOOK_SECRET=<whsec_ from Stripe Dashboard webhook endpoint>
PAYMENT_BETA_MODE=true
PAYMENT_BETA_ALLOWLIST=<comma-separated founding member emails>
PAYMENT_SUPPORT_EMAIL=payments-beta@globalvibezdsg.com
HELIO_WEBHOOK_TOKEN=<required in production — Helio webhooks fail closed without it>
FRONTEND_URL=<set after frontend deploys>
```

5. Deploy — copy the backend **public** URL (e.g. `https://backend-api-xxxx.up.railway.app`)

---

## Step 4 — Deploy the Frontend Service (`frontend-globalvibez`)

1. Click **+ New** → **GitHub Repo** → same repo
2. Set **Root Directory** to: `source/web-assets/frontend`
3. Image builds with Docker (`yarn build`, then `serve -s build -l $PORT`). `serve` is a project dependency; Dockerfile also installs it globally as a fallback.
4. Add these **Environment Variables** (required to bake into the React build):

```
REACT_APP_BACKEND_URL=<backend public URL from Step 3>
REACT_APP_FRONTEND_URL=<this service's URL — set after first deploy>
NODE_OPTIONS=--max-old-space-size=4096
GENERATE_SOURCEMAP=false
TSC_COMPILE_ON_ERROR=true
DISABLE_ESLINT_PLUGIN=true
CI=false
```

Optional (enables extra features):

```
REACT_APP_STRIPE_KEY=<Stripe publishable key>
REACT_APP_MAPBOX_TOKEN=<Mapbox token>
REACT_APP_GIPHY_API_KEY=<Giphy key>
REACT_APP_SOLANA_DISABLE=true
REACT_APP_PRIVY_APP_ID=<Privy app id for social login>
```

5. Deploy — copy the frontend public URL

Local static preview (after `yarn build`):

```bash
cd source/web-assets/frontend && yarn serve:prod
```

---

## Step 5 — Wire Backend CORS to Frontend

Back in the **backend** service variables, update:

```
CORS_ORIGINS=https://<frontend-url>.up.railway.app,https://globalvibezdsg.com
FRONTEND_URL=https://<frontend-url>.up.railway.app
```

Then **redeploy the backend**.

---

## Step 6 — Point globalvibezdsg.com to Frontend

In Railway frontend service → **Settings** → **Custom Domain**:

- Add `globalvibezdsg.com`
- Add `www.globalvibezdsg.com`
- Update your DNS to point to the Railway CNAME

---

## Correct deploy workflow (checklist)

1. Push this branch / `main` so Railway sees updated Docker/`railway.json` and `vercel.json.bak`
2. Confirm two services with Root Directories above (not repo root)
3. Backend health: `GET /health`
4. Frontend: set `REACT_APP_BACKEND_URL` to the **public** backend URL, then redeploy frontend so the URL is baked into the bundle
5. Update backend `CORS_ORIGINS` / `FRONTEND_URL` to the frontend public URL
6. Do **not** point CRA env vars at `*.railway.internal`

---

## Auth Notes

- **Demo Login**: Works immediately, no config needed (`POST /api/auth/demo-login`)
- **Email/Password**: Works with MongoDB
- **Privy social (Google / X)**: Requires bake-time + runtime env (see below). Facebook stays **Coming Soon** (no Privy Facebook OAuth provider in this app).

### Environment variable finalization (Privy + API URL)

**Frontend service** (must redeploy after changing bake-time vars):

```
REACT_APP_BACKEND_URL=https://globalvibezdsg1-production.up.railway.app
REACT_APP_FRONTEND_URL=https://www.globalvibezdsg.com
REACT_APP_PRIVY_APP_ID=<from Privy dashboard>
```

**Backend service**:

```
PRIVY_APP_ID=<same app id as frontend>
PRIVY_JWKS_URL=https://auth.privy.io/api/v1/apps/<PRIVY_APP_ID>/jwks.json
CORS_ORIGINS=https://www.globalvibezdsg.com,https://globalvibezdsg.com
FRONTEND_URL=https://www.globalvibezdsg.com
```

Notes:

- This codebase verifies Privy JWTs with **JWKS** (`PRIVY_APP_ID` + `PRIVY_JWKS_URL`). It does **not** read `PRIVY_APP_SECRET` — you can keep that secret in Privy/dashboard tooling, but it is not required for our FastAPI session exchange.
- If login shows Google/X as **Not Configured**, `REACT_APP_PRIVY_APP_ID` was missing at frontend **build** time. Set it and **redeploy the frontend**.
- Also allowlist `https://www.globalvibezdsg.com` (and apex) in the Privy dashboard allowed origins / redirect URLs.

## Verify Deployment

```bash
# Backend health
curl https://globalvibezdsg1-production.up.railway.app/health
# expect: {"status":"ok"}

# Frontend
curl -I https://www.globalvibezdsg.com/

# CORS (expect Access-Control-Allow-Origin echoing the Origin)
curl -sD - -o /dev/null -X OPTIONS \
  https://globalvibezdsg1-production.up.railway.app/api/auth/demo-login \
  -H "Origin: https://www.globalvibezdsg.com" \
  -H "Access-Control-Request-Method: POST"

# Demo session
curl -s -X POST https://globalvibezdsg1-production.up.railway.app/api/auth/demo-login \
  -H "Content-Type: application/json" -d '{}'
```

### Production smoke checklist

| Check | How | Pass criteria |
|---|---|---|
| Landing Sun / logo | Open `/` | DSG branding visible; `/assets/logo.png` 200 |
| CORS | Browser console on `/` and `/login` | No CORS errors to `REACT_APP_BACKEND_URL` |
| Demo login | `/login` → Continue with demo account | Lands on `/dashboard` authenticated |
| Social Google/X | `/login` buttons | Opens Privy OAuth (not “Not Configured”) |
| AI practice | Spades / Bid Whist AI match | Cards dealt; moves talk to FastAPI |
| Railway logs | Both services first ~5 min | No Mongo timeouts / crash loops |

Known non-blocking gaps seen in live smoke (2026-07-19): `GET /api/recirculation/public-summary` → 404 (widget); social buttons **Not Configured** until Privy frontend bake is set.

### Healthcheck failure / edge 502

Railway reports **Healthcheck failure** when the container is up but `/health` (backend) or `/` (frontend) does not return 200 in time. Common causes:

| Cause | Fix |
|---|---|
| **Wrong Root Directory** (repo root or `source/web-assets`) | Backend → `source/web-assets/backend`; frontend → `source/web-assets/frontend` |
| **Missing `MONGO_URL`** | Add MongoDB plugin (not Postgres) and set `MONGO_URL=${{MongoDB.MONGO_URL}}` |
| **Wrong port bind** | Backend must listen on `$PORT` via `entrypoint.sh` (already in this repo) |
| **OOM from schedulers** | Keep `DISABLE_BG_SCHEDULERS=1` |
| **Frontend missing bake-time API URL** | Set `REACT_APP_BACKEND_URL` to the public backend URL and redeploy frontend |

In Deployments → failed deploy → **View Logs**, look for:

- `[entrypoint] binding 0.0.0.0:...` (confirms shell start + port)
- `WARNING: MONGO_URL is unset`
- `FATAL: Mongo ping failed`
- `Killed` / OOM

`/health` is process-only (no DB). It should pass even when Mongo is down; API routes will still 500 until Mongo is reachable.

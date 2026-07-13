# Production ops — make www.globalvibezdsg.com run end-to-end

Canonical app: `source/web-assets` (CRA frontend + FastAPI + Mongo).
Production frontend DNS: **Vercel** → `www.globalvibezdsg.com`.

## Current status (2026-07-13)

| Layer | Status |
|-------|--------|
| Frontend UI on www | ✅ Renders (blank-screen crash fixed) |
| Backend API behind www | ❌ `/api/*` returns HTML (no FastAPI attached) |
| Azure VM nginx mirror | ❌ `20.84.123.232:22` SSH timeout (NSG/VM) |
| Email signup/login | Fixed in code (`/api/auth/*`); needs live backend |

---

## Flawless checklist (do in order)

### 1) Stand up the FastAPI backend (Railway — recommended)

> **Use MongoDB, not PostgreSQL.** This backend is Motor/PyMongo (`MONGO_URL` +
> `DB_NAME`). A Railway **PostgreSQL** plugin / `DATABASE_URL` will not work.

1. Railway → New Project → Deploy from GitHub (`johnnyh3611-bit/global_vibez_dsg1`)
2. Add **MongoDB** plugin (Railway → + New → Database → **MongoDB**) **or** MongoDB Atlas. Copy `MONGO_URL` / connection string.
3. New service → Root Directory: `source/web-assets/backend`
4. Backend env vars:

```bash
MONGO_URL=${{MongoDB.MONGO_URL}}   # Railway variable reference to your Mongo service
DB_NAME=global_vibez
JWT_SECRET=<openssl rand -hex 32>
DISABLE_BG_SCHEDULERS=1            # REQUIRED on trial/small plans (avoids OOM → 502)
ENVIRONMENT=production
CORS_ORIGINS=https://www.globalvibezdsg.com,https://globalvibezdsg.com
FRONTEND_URL=https://www.globalvibezdsg.com
```

Also confirm on the **backend service**:
- **Settings → Root Directory** = `source/web-assets/backend`
- **Settings → Networking → Public Domain** is generated
- After each git merge to `main`, open **Deployments** and confirm a **new** deploy finished **Success** (not the old crashed one)

If you see **502 Application failed to respond**: open that deploy → **View logs** and look for `FATAL: Mongo ping failed`, `OOM`, `Killed`, or Python tracebacks.

5. Deploy → copy public URL, e.g. `https://gv-api-xxxx.up.railway.app`
6. Verify:

```bash
curl -sS https://YOUR-API/health
# expect JSON, not HTML
curl -sS -X POST https://YOUR-API/api/auth/demo-login
# expect 200 JSON with token
```

Details: `source/web-assets/RAILWAY_DEPLOY.md`

### 2) Point the Vercel frontend at that API

In **Vercel → Project → Settings → Environment Variables** (Production):

| Name | Value |
|------|-------|
| `REACT_APP_BACKEND_URL` | `https://YOUR-API` (no trailing slash) |
| `REACT_APP_FRONTEND_URL` | `https://www.globalvibezdsg.com` |

Then **Redeploy** Production (CRA bakes env at build time).

Do **not** put an empty `REACT_APP_BACKEND_URL` in `vercel.json` — that overrides the dashboard.

### 3) Confirm end-to-end

```bash
npm run smoke
curl -sS "$REACT_APP_BACKEND_URL/health"
# Browser: www → Demo Login → /dashboard
```

Smoke now fails if `/api` on www still serves HTML **unless** you use an absolute API host (relative `/api` on Vercel is static-only).

### 4) Optional — Azure VM static mirror

Only needed if you want nginx on `20.84.123.232` to mirror the SPA.

1. Azure Portal → VM → ensure **Running**
2. Networking / NSG → allow **TCP 22** from GitHub Actions IP ranges (or temporarily `*`)
3. GitHub → Settings → Secrets:
   - `SSH_PRIVATE_KEY` — azureuser private key
   - `AZURE_VM_HOST` — VM public IP (optional; defaults to `20.84.123.232`)
   - `REACT_APP_BACKEND_URL` — same API URL as Vercel
4. Re-run **Deploy Global Vibez DSG (Azure VM)** workflow

Until SSH is open, the Azure job **skips** (soft-fail) and does not block main.

### 5) DNS (already correct for frontend)

Keep `www` / apex on **Vercel**. Do not point DNS at Azure until the VM is healthy and intentionally cut over.

Optional later: `api.globalvibezdsg.com` CNAME → Railway backend, then set `REACT_APP_BACKEND_URL=https://api.globalvibezdsg.com`.

---

## Workspace open (local)

```bash
npm run sync:workspace
npm run dev          # scripts/dev-up.sh — mongo + :8001 + :3000
```

---

## Why demo / email login still fail today

Frontend is on Vercel. With no `REACT_APP_BACKEND_URL`, the browser calls same-origin `/api/...`, and Vercel’s SPA fallback returns `index.html` (HTTP 200 HTML). That looks “up” but is not FastAPI. Fix = steps 1–2 above.

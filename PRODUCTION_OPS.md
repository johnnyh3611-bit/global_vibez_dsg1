# Production ops — make www.globalvibezdsg.com run end-to-end

Canonical app: `source/web-assets` (CRA frontend + FastAPI + Mongo).
Production frontend DNS: **Vercel** → `www.globalvibezdsg.com`.

## Current status (2026-07-16)

| Layer | Status |
|-------|--------|
| Frontend UI on www | ✅ Renders (`npm run smoke` green) |
| FastAPI on Railway | ✅ `https://globalvibezdsg1-production.up.railway.app` — `/health` + demo-login 200 |
| Same-origin `/api` on www | ⚠️ Still HTML (Vercel has no FastAPI proxy; app uses baked `REACT_APP_BACKEND_URL`) |
| Azure VM nginx mirror | ❌ `20.84.123.232:22` SSH timeout (NSG/VM) — optional |
| Email / demo login | ✅ Against Railway API (`npm run smoke:full` green) |

Canonical API URL (also in `vercel.json` + `frontend/.env.production`):

```text
https://globalvibezdsg1-production.up.railway.app
```

---

## Deploy truth (2026-07-21)

- **Frontend DNS** (`www.globalvibezdsg.com`): **Vercel** project `global-vibez-dsg`. Requires root **`vercel.json`** (do not leave only `vercel.json.bak`).
- **API**: Railway `https://globalvibezdsg1-production.up.railway.app` (auto-deploys on `main`).
- **Beta payments**: Helio + `PAYMENT_BETA_MODE` on Railway; coin packs live via `/api/coins/packs`.
- **Voice Mirror STT**: set `OPENAI_API_KEY` on the Railway backend after #164.

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

# Vibe Phone / FaceTime video (Agora) — was set on Emergent; must be
# re-added on Railway after the migration. Without these,
# GET /api/agora/health returns configured:false and calls ring but
# have no live audio/video.
AGORA_APP_ID=<from https://console.agora.io>
AGORA_APP_CERTIFICATE=<from same project → App Certificate>
```

Also confirm on the **backend service**:
- **Settings → Root Directory** = `source/web-assets/backend`
- **Settings → Networking → Public Domain** is generated
- After each git merge to `main`, open **Deployments** and confirm a **new** deploy finished **Success** (not the old crashed one)

If you see **502 Application failed to respond** or **Healthcheck failure**: open that deploy → **View Logs** and look for:

- `[entrypoint] binding 0.0.0.0:<port>` — missing means the start command never reached the shell wrapper
- `WARNING: MONGO_URL is unset` — add MongoDB (not Postgres) and wire `MONGO_URL`
- `FATAL: Mongo ping failed` — bad URI / network / wrong plugin
- `OOM` / `Killed` — keep `DISABLE_BG_SCHEDULERS=1`; upgrade plan if needed
- `Invalid value for '--port'` — `$PORT` was not expanded (fixed by `entrypoint.sh`)

`/health` is intentionally DB-free so Railway probes pass while Mongo is still warming.

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

### 6) Google / SEO — one listing, not two

**Canonical host:** `https://www.globalvibezdsg.com`

Root cause of “two www.globalvibezdsg.com” (or www + bare domain) in Google: both
`globalvibezdsg.com` and `www.globalvibezdsg.com` used to return **200** with
identical HTML (no 301). Search engines then index both as separate results.

Repo fixes (deploy via Vercel on merge to `main`):

| Fix | Where |
|-----|--------|
| Apex → www **301** | `vercel.json` `redirects` (host `globalvibezdsg.com`) |
| `*.vercel.app` → www **301** | same (avoids a third indexed copy) |
| `<link rel="canonical">` + `og:url` | `frontend/public/index.html` |
| Real `robots.txt` + `sitemap.xml` | `frontend/public/` (were previously SPA-fallback HTML) |

After deploy, verify:

```bash
curl -sI https://globalvibezdsg.com/ | head -5
# expect: HTTP/2 308 (or 301) + Location: https://www.globalvibezdsg.com/
curl -sI https://www.globalvibezdsg.com/robots.txt | head -5
# expect: content-type: text/plain (NOT text/html)
```

**Google Search Console** (owner must do this — cannot automate from the repo):

1. Add / verify property for `https://www.globalvibezdsg.com` (URL-prefix) **or** Domain property for `globalvibezdsg.com`.
2. **Settings → Preferred domain** is obsolete for domain properties; the 301 + canonical are the signal.
3. Submit sitemap: `https://www.globalvibezdsg.com/sitemap.xml`
4. **Removals / Temporary removals** or **Inspect URL** → Request indexing for the www homepage; use **Page indexing** report to watch apex URLs drop after the 301.
5. If a lookalike domain appears (e.g. parked `globalvibezdsg.org` “for sale”), that is **not** our site — report via Search Console if it impersonates, or buy/redirect the TLD if you want to own it.

Unrelated brands that also show for “Global Vibez” (vibez.io, radio sites, LinkedIn profiles) cannot be removed from Google by us; strengthen brand signals (Business Profile, consistent NAP, branded queries to www).

---

## Workspace open (local)

```bash
npm run sync:workspace
npm run dev          # scripts/dev-up.sh — mongo + :8001 + :3000
```

---

## Payments / PCI (beta) — Helio only

Full runbook: `source/web-assets/PAYMENT_SECURITY.md`.

**Card rail = Helio.** We do not use Stripe for coin top-up.

Checklist before opening Helio beyond Founding Members:

1. **TLS** — Railway public domain is `https://…`. Confirm:
   ```bash
   curl -sSI https://YOUR-API/health | head -n 5
   ```
2. **Secrets on Railway** — `HELIO_API_KEY`, `HELIO_SECRET_KEY`, `HELIO_PAYLINK_ID`, `HELIO_WEBHOOK_TOKEN`, `PAYMENT_BETA_*`
3. **Sandbox first** — `HELIO_NETWORK=test`; run a real Helio checkout; confirm `payments_audit` + wallet credit
4. **Founding Member gate** — keep `PAYMENT_BETA_MODE=true` with a 20–50 email allowlist until live credits reconcile
5. **UI** — Wallet / Top-Up show **Beta Payment Environment** + support email/Discord
6. **Never** collect raw card numbers in the SPA — Helio embed only

---

## Why demo / email login still fail today

Frontend is on Vercel. With no `REACT_APP_BACKEND_URL`, the browser calls same-origin `/api/...`, and Vercel’s SPA fallback returns `index.html` (HTTP 200 HTML). That looks “up” but is not FastAPI. Fix = steps 1–2 above.

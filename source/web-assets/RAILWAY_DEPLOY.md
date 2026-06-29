# Global Vibez DSG — Railway Deployment Guide

## Architecture

Two Railway services in one project:

| Service | Directory | Port |
|---|---|---|
| `backend` | `source/web-assets/backend` | `$PORT` (Railway assigns) |
| `frontend` | `source/web-assets/frontend` | `$PORT` (Railway assigns) |

MongoDB: **Railway MongoDB plugin** OR **MongoDB Atlas** (free tier works)

---

## Step 1 — Create Railway Project

1. Go to [railway.app](https://railway.app) → **New Project**
2. Choose **Deploy from GitHub repo** → select `johnnyh3611-bit/global_vibez_dsg1`

---

## Step 2 — Add MongoDB

In your Railway project:
- Click **+ New** → **Database** → **MongoDB**
- Copy the `MONGO_URL` connection string from the MongoDB service variables

---

## Step 3 — Deploy the Backend Service

1. Click **+ New** → **GitHub Repo** → same repo
2. Set **Root Directory** to: `source/web-assets/backend`
3. Railway auto-detects Python via `requirements.txt` and uses `railway.json`
4. Add these **Environment Variables**:

```
MONGO_URL=<from MongoDB plugin above>
DB_NAME=casino_db
JWT_SECRET=<generate: openssl rand -hex 32>
ENVIRONMENT=production
CORS_ORIGINS=*
EMERGENT_LLM_KEY=<your Emergent LLM key>
STRIPE_API_KEY=<your Stripe secret key>
FRONTEND_URL=<set after frontend deploys>
```

5. Deploy — copy the backend public URL (e.g. `https://web-xxxx.up.railway.app`)

---

## Step 4 — Deploy the Frontend Service

1. Click **+ New** → **GitHub Repo** → same repo
2. Set **Root Directory** to: `source/web-assets/frontend`
3. Add these **Environment Variables** (required to bake into the React build):

```
REACT_APP_BACKEND_URL=<backend URL from Step 3>
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
```

4. Deploy — copy the frontend public URL

---

## Step 5 — Wire Backend CORS to Frontend

Back in the **backend service** variables, update:
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

## Auth Notes

- **Google Login**: Works via `https://auth.emergentagent.com` (still live ✓)
- **Demo Login**: Works immediately, no config needed
- **Email/Password**: Works with MongoDB

## Verify Deployment

```bash
# Backend health
curl https://<backend-url>.up.railway.app/health

# Frontend
curl -I https://<frontend-url>.up.railway.app
```

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

### What actually runs (the default product)
Despite the root `package.json` declaring a Next.js app, the root `dev`/`build`/`start`/`lint`
scripts are wired to the **Global Vibez DSG** app under `source/web-assets` (see root `README.md`).
That is the product to run. It has three services:

| Service | Dir | Port | Start command (run from repo root) |
|---|---|---|---|
| MongoDB | — | 27017 | `mongod --dbpath /data/db --bind_ip 127.0.0.1 --port 27017` |
| Backend (FastAPI + Socket.IO) | `source/web-assets/backend` | 8001 | `cd source/web-assets/backend && DISABLE_BG_SCHEDULERS=1 .venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001` |
| Frontend (CRA/CRACO) | `source/web-assets/frontend` | 3000 | `BROWSER=none npm run dev` (root) |

The `modern:*` Next.js app in root scripts and the SolDate app are NOT present in the current tree.

### Non-obvious startup caveats
- **MongoDB must be started manually each session.** It is installed (MongoDB 8.0) and its data
  in `/data/db` persists in the VM snapshot, but the `mongod` process does not — start it (command
  above) BEFORE the backend or every API request 500s. Verify with `mongosh --quiet --eval 'db.runCommand({ping:1})'`.
- **The backend uses a Python venv at `source/web-assets/backend/.venv`** (host Python is 3.12; the
  code targets 3.11 but runs fine on 3.12). Always invoke it as `.venv/bin/uvicorn` / `.venv/bin/python`.
- **Set `DISABLE_BG_SCHEDULERS=1`** when running the backend or tests to suppress ~25 background
  scheduler workers that otherwise spam logs and churn state.
- **`.env` files are git-ignored** and live at `source/web-assets/backend/.env` and
  `source/web-assets/frontend/.env` (they persist in the snapshot). The frontend needs
  `REACT_APP_BACKEND_URL=http://localhost:8001` to reach the API; the backend defaults are fine for local dev.
- **The frontend uses `yarn`** (`packageManager` pinned; a stray `package-lock.json` also exists — ignore it, use yarn).
- **Dev-only compile overlay:** the CRA dev server shows a "Compiled with problems" overlay because
  `src/pages/admin/StreamflowAdmin.tsx` lazy-imports `@streamflow/stream`, a package intentionally
  pruned from `package.json`. This only breaks that one lazy admin chunk — dismiss the overlay (X) and
  the rest of the app works normally. Do not "fix" it by reinstalling the dep unless the Streamflow
  admin page is specifically needed.

### Testing / lint / build
- Backend tests: `cd source/web-assets/backend && set -a && source .env && set +a && DISABLE_BG_SCHEDULERS=1 .venv/bin/python -m pytest tests/<file> -q`.
  Note many `tests/test_*.py` are **live integration tests** that hit `REACT_APP_BACKEND_URL` and/or
  expect pre-seeded data (e.g. `test_auth.py`'s hardcoded token) — pure-logic files like
  `test_fisher_yates_shuffle.py`, `test_dominoes_engine.py`, `test_casino_wave2_engines.py` run standalone.
  Also note the casino game API routers (baccarat/dice/etc.) are NOT mounted in `routes/registry.py`,
  so their API-based tests 404; the registered API is the dating/social core (`/api/discover`, `/api/swipe`, `/api/profile`, `/api/messages`, ...).
- Frontend typecheck: `npm --prefix source/web-assets/frontend run typecheck`.
- Frontend lint: the root `npm run lint` FAILS (frontend has no `lint` script); run eslint directly:
  `cd source/web-assets/frontend && npx eslint src`.
- Quick manual login: `POST /api/auth/demo-login` returns a bearer `token` (demo user starts with 5000
  credits); the UI has a "🎮 Demo Login (Quick Access)" button on `/login`.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

### What actually runs here
The active product is the **Global Vibez** app under `source/web-assets/`, not a Next.js app. There is no Next.js project in this tree (no `next.config.*`, `app/`, `pages/`, or `src/`); the root `package.json` `next` deps, the root `eslint.config.mjs`, and the `testing-soldate-auth` skill describe a legacy/alternate state that is not present. Root npm scripts proxy into `source/web-assets` (`npm run dev` → frontend, `npm run backend` → backend).

Three services make up the product (see `source/web-assets/README.md`, `backend/README.md`, `backend/ENV_VARIABLES.md`, and root `README.md` for the standard commands):
- **MongoDB** (required) on `localhost:27017`. No systemd on this VM — start it manually: `mongod --dbpath /data/db --bind_ip 127.0.0.1 --port 27017` (data dir `/data/db` must exist and be writable). The backend pings Mongo at startup and every request 500s until it is reachable.
- **Backend** — FastAPI + Socket.IO on `:8001`. Uses a venv at `source/web-assets/backend/.venv`. Run: `cd source/web-assets/backend && . .venv/bin/activate && uvicorn server:app --host 0.0.0.0 --port 8001`. Requires `source/web-assets/backend/.env` (gitignored; needs at least `MONGO_URL`, `DB_NAME=global_vibez`, `JWT_SECRET`). Set `DISABLE_BG_SCHEDULERS=1` in dev/CI to skip ~25 background scheduler workers that otherwise churn state. Health: `GET /health`; API docs: `/docs`.
- **Frontend** — CRA + CRACO (Yarn 1) on `:3000`. Run: `cd source/web-assets/frontend && ESLINT_NO_DEV_ERRORS=true BROWSER=none yarn start`. Requires `source/web-assets/frontend/.env` (gitignored) with `REACT_APP_BACKEND_URL=http://localhost:8001`.

### Non-obvious gotchas (pre-existing; do NOT treat as environment breakage)
- **`ESLINT_NO_DEV_ERRORS=true` is required for `yarn start`.** The CRA dev server otherwise shows a full-screen red overlay that blocks the app, because the bundled ESLint reports "Definition for rule not found" (for `react-hooks/exhaustive-deps`, `@typescript-eslint/*`) as errors. These are config-version quirks, not real code errors — the bundle compiles fine. The production `build` script already sets `DISABLE_ESLINT_PLUGIN=true` for the same reason.
- **`@streamflow/stream` must be installed** for the frontend to compile. It is lazily imported in `src/pages/admin/StreamflowAdmin.tsx` (with an ambient decl in `src/types/streamflow.d.ts`) but was missing from `package.json`; it has been added as a direct dependency. Without it, webpack fails with `Can't resolve '@streamflow/stream'`.
- **UI email signup/login return 404.** The frontend posts to `/api/auth/signup` and `/api/auth/login`, but the backend mounts the email-auth router at the double-prefixed `/api/api/auth/...`. To enter the app in the browser, use the **"Demo Login (Quick Access)"** button on `/login` (hits `/api/auth/demo-login`, which is correctly routed). The email flow does work directly against `/api/api/auth/signup`.
- **Only a subset of routes is mounted in `server.py`** (auth, dating/social, moderation, notifications, payments — see `GET /openapi.json`). Casino game routers (baccarat, blackjack, etc.) exist as files but are not wired in, so those endpoints and any tests hitting them return 404.

### Lint / test
- Frontend static check: `yarn typecheck` (`tsc --noEmit`) passes. There is no `yarn lint` script; ESLint runs inside the CRA pipeline.
- Backend: `pytest` self-contained engine/unit tests pass (e.g. `tests/test_fisher_yates_shuffle.py`, `tests/test_dominoes_engine.py`). Many other tests assume live-server routes that aren't mounted or seed a hardcoded `test_database` DB, so they fail for reasons unrelated to setup. `flake8` is the Python linter.

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

Open [http://localhost:3000](http://localhost:3000). Use **Demo Login** on `/login`
(email auth paths are double-prefixed on the backend — see `AGENTS.md`).

Useful commands:

```bash
npm run build          # production frontend build
npm run backend        # FastAPI only
npm run typecheck      # frontend tsc --noEmit
npm run smoke          # production domain blank-screen / shell checks
```

## Deployment (single source of truth)

| Target | Role | Config |
|--------|------|--------|
| **Vercel** | Production frontend for `www.globalvibezdsg.com` | `vercel.json` → builds `source/web-assets/frontend` |
| **Railway** | Full-stack option (backend + frontend services) | `source/web-assets/{backend,frontend}/railway.json` |
| **Azure VM** | Optional static mirror via nginx | `.github/workflows/deploy.yml` → deploys `frontend/build` |

Set **`REACT_APP_BACKEND_URL`** in Vercel (and GitHub secret for Azure builds)
to the live FastAPI base URL. Without that env var at **build** time, older
bundles crashed on a blank black screen.

## Workspace sync

```bash
npm run sync:workspace   # fast-forward local main to origin/main
npm run sync:verify      # assert HEAD == origin/main
```

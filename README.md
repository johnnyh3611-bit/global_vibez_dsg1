This repository now defaults to the completed Global Vibez app in
`source/web-assets` (the beta flow with the full games experience).

Root npm commands are wired to that app by default.

## Getting Started

Install dependencies for the completed app, then run it from the repo root:

```bash
cd source/web-assets/frontend && npm install
cd ../..
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Useful validation commands:

```bash
npm run build
```

Run backend locally (separate terminal):

```bash
pip install -r source/web-assets/backend/requirements.txt
npm run backend
```

The modern Next.js app is still available behind explicit scripts:

```bash
npm run modern:dev
npm run modern:build
npm run modern:start
```

## Deployment Notes

Primary deployment target for this default flow is the `source/web-assets`
frontend/backend setup (Railway/docker configs under that folder).

If you intentionally deploy the modern Next.js app, use the `modern:*`
scripts above.

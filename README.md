This is a Next.js 16 app for Global Vibez / SolDate.

## Getting Started

Install dependencies, then run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Useful validation commands:

```bash
npm run lint
npm run build
```

## Deployment Notes

For Vercel deployments:

- Set `JWT_SECRET` in Project Settings → Environment Variables. Wallet sign-in returns `503` until this is configured.
- Optional chair-holder overrides:
  - `CHAIR_HOLDER_WALLETS` — comma-separated wallet list
- The production build no longer depends on fetching Google Fonts during `next build`.

See the [Next.js documentation](https://nextjs.org/docs) for framework details.

This is the canonical Next.js 16 app for Global Vibez / SolDate.

The root app in this repository is the source of truth for production.
The legacy `source/web-assets` subtree is kept for reference only unless
we explicitly migrate a feature back into the root app.

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
- Set `NEXT_PUBLIC_SITE_URL` to the deployed origin when promoting to a new environment.
- Optional chair-holder overrides:
  - `CHAIR_HOLDER_WALLETS` — comma-separated wallet list
- The production build no longer depends on fetching Google Fonts during `next build`.

Common runtime variables:

- `JWT_SECRET` — required for auth sessions
- `CHAIR_HOLDER_WALLETS` — optional comma-separated allow list
- `AI_PROVIDER` — `ollama` or `openai`
- `OPENAI_API_KEY` — required only when `AI_PROVIDER=openai`
- `OPENAI_MODEL` — optional OpenAI model name
- `OLLAMA_BASE_URL` — optional Ollama endpoint
- `OLLAMA_MODEL` — optional Ollama model name
- `TV_VIDEO_PROVIDER` — `mock`, `luma`, `runway`, or `heygen`
- `TV_VIDEO_API_KEY` — required for real video providers
- `NEXT_PUBLIC_SITE_URL` — canonical site URL for metadata and links

Workflow rule:

- Make changes in this root app first, then mirror only the intended deployment
  surfaces in Vercel or Azure.
- Avoid editing the legacy `source/web-assets` subtree for production work.

See the [Next.js documentation](https://nextjs.org/docs) for framework details.

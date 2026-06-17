# 100K Scaling PDFs — Verdict & Action Map

> Reviewed: May 13 2026 — Three PDFs (`Ecosystem_Audit`, `System_Audit_Code`, `Production_Blueprint`)

## TL;DR

The 3 audits all converge on the same recommendation: **move to clustered/distributed infrastructure for 100k CCU**. They are 100% INFRASTRUCTURE asks, not feature asks. Your codebase is fine — the PDFs flag the *deployment topology*.

Most of these are handled by the **Emergent platform** as you scale your deploy. The few that need code-side prep are already in place or coming with this commit.

| PDF Ask | Status on this app |
|---|---|
| **SFU for streaming** | ✅ Already done — Cloudflare Stream IS an SFU (HLS edge fan-out, not P2P) |
| **Redis Pub/Sub for chat** | 🟡 Single-node WebSocket today. Need at 5k+ concurrent. Out of scope for code agent — request from Emergent infrastructure when needed |
| **Gunicorn multi-worker** | 🟡 Single uvicorn today (1 worker). Emergent handles this at deploy via container scaling. Not a code change |
| **Server sharding for casino** | 🟡 Casino is stateless per-room, so horizontal scaling is automatic on cluster. Concern only if rooms hold long-lived in-memory state (they don't — Mongo-backed) |
| **AWS S3 + CloudFront for media** | ✅ Already done via Cloudflare Stream (RTMP → HLS) and customer-assets CDN |
| **Redis for geolocation** | 🟡 N/A right now (Ridez geo is MongoDB 2dsphere index, fine to ~5k drivers). Re-evaluate at scale |
| **Virtual ledger for Solana** | ✅ Already designed — internal `credit_balance` is the virtual ledger; Solana bridge stubbed until TGE |
| **Bitrate cap + chat throttle** | 🟡 Cloudflare auto-caps. Chat throttle is server-side rate limiting (already partial via FastAPI middleware) |
| **Phased "Go-Live Stagger"** | 👤 Operational decision — yours. Recommend Wave 1 = 1k beta testers → Wave 2 = 10k → Wave 3 open |

## What to do with these PDFs

1. **Don't try to literally implement any of them today.** They're for the day you hit 5k–10k CCU.
2. **Keep them as scaling playbooks** for when you contact Emergent Support to add Redis / horizontal workers / Gunicorn config.
3. **None of the PDFs change the High Roller MVP build** — go ahead and ship.

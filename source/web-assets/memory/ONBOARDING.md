# Onboarding — Unity WebGL · Squads · Streamflow

Official links + click-by-click setup for the 3 remaining external
dependencies. Keep this file; each row below is copy-pasteable and
re-runnable if you ever need to redo any of it.

---

## 1. Unity WebGL "Cyber Casino" build

### What you need
A single `.zip` containing a fully-built Unity 6 LTS WebGL export of
your casino room scene, under 40 MB gzipped. Platform preview cannot
host Brotli — must be **Gzip**.

### Where to get it

| Path | Cost | Effort |
|---|---|---|
| **Build it yourself** | Free | ~2 days if new to Unity |
| **Hire on Fiverr** — search `unity webgl casino room` | $300 – $800 | 1 week |
| **Unity Asset Store** — 3D → Environments → Casino | $0 – $30 | 1 hour to wire |
| **itch.io assets** — https://itch.io/game-assets/tag-casino | Free – $50 | 1 hour |

**Direct links:**
- Unity Hub install: https://unity.com/download
- Unity 6 LTS docs: https://docs.unity3d.com/6000.0/Documentation/Manual/webgl.html
- WebGL build settings reference: https://docs.unity3d.com/Manual/webgl-building.html
- Unity Asset Store (Casino category): https://assetstore.unity.com/3d/environments?free=true&q=casino&orderBy=0
- itch.io casino assets: https://itch.io/game-assets/tag-casino

### DIY build steps
```
1. Unity Hub → Install Editor → Unity 6 LTS (2026.1.x)
2. New Project → 3D (Universal) → name: CyberCasino
3. Import your casino room model (.fbx / .gltf) into Assets/Scenes/
4. File → Build Settings → switch platform to WebGL
5. Player Settings → Publishing Settings → Compression Format: Gzip  ← CRITICAL
6. Player Settings → Resolution: 1920 × 1080 default
7. Click "Build" → pick an empty output folder
8. Zip the ENTIRE output folder (Build/ + TemplateData/ + index.html)
9. Upload zip to Google Drive / Dropbox / GitHub Releases
10. Right-click file → "Get shareable link" → set to "Anyone with link"
11. Paste the link in chat → I'll wire it into /cyber-casino
```

### If you need to redo everything
Just upload a new zip with the same folder structure — I will swap
the hosted URL and redeploy. No code changes on your end.

---

## 2. Squads Multi-Sig Vault (2-of-2 with your sister)

### Direct links
- Squads Protocol: **https://app.squads.so/**
- Squads docs: https://docs.squads.so/main
- Phantom wallet install: https://phantom.app/
- Solflare wallet install: https://solflare.com/

### Click-by-click
```
1. Both of you install Phantom (or Solflare) wallet if you haven't.
2. Fund each wallet with ~0.1 SOL from an exchange (need SOL for gas).
3. Open https://app.squads.so/ → click "Connect Wallet" (YOU).
4. Click "Create a Squad" → Network: Solana Devnet (for now) /
   Mainnet (when you're ready to go live).
5. Fill in:
     - Name: Vibez Treasury
     - Description: 40-30-30 revenue vault
     - Threshold: 2 of 2 (you + sister)
6. Add Member → paste your sister's wallet address.
7. Sign & submit → pay small SOL gas fee.
8. Sister opens the same Squad link → clicks "Accept Membership" →
   signs the accept transaction.
9. Copy your Squad's "Vault Address" (base58 string).
10. Come back to /vibe-vault-admin → Treasury tab → paste into
    "Squads Multi-Sig Address" field → Save.
```

The public `/treasury` dashboard immediately flips the Squads badge
from **Pending** → **Configured** with a link to app.squads.so.

### If you need to redo everything
`Treasury tab → blank out the Squads Address field → Save`.
Status flips back to "Pending" and the link vanishes. Then create a
new Squad and paste the new address. Zero backend change required.

---

## 3. Streamflow Auto-Payroll

### Direct links
- Streamflow: **https://streamflow.finance/**
- Streamflow docs: https://docs.streamflow.finance/
- Helio (alternative for fiat off-ramp): https://hel.io/

### Click-by-click
```
1. Open https://streamflow.finance/ → Connect Wallet (the SAME
   wallet that co-owns the Squad — not a personal one).
2. Dashboard → "Create a Stream" to test:
     - Recipient: sister's personal wallet
     - Amount: 100 USDC
     - Duration: 30 days
     - Start: now
     - Cliff: none
3. Dashboard → "API Keys" → "Create API Key"
     - Scope: Outgoing streams only
     - Name: Vibez Treasury Payroll
4. Copy the key (you only see it ONCE — save to 1Password).
5. Paste it in chat → I'll drop it into /app/backend/.env as
   STREAMFLOW_API_KEY and hot-reload.
```

### If you need to redo everything
Streamflow dashboard → revoke old key → create new one → send me the
new one. I'll swap `.env` and restart — 10-second downtime.

---

## 4. USDC Auto-Swap (no setup needed)

I wire this one in via **Jupiter v6 Aggregator** on the backend side.
No API key, no account. It just auto-swaps the 30% team slice
SOL→USDC on each ledger write, so your team gets paid in stablecoins
regardless of SOL price.

Public Jupiter endpoint: https://quote-api.jup.ag/v6
Jupiter terms: https://jup.ag/terms

You don't do anything here — once Squads + Streamflow are live,
give me the green light and I'll flip the `usdc_swap_enabled` config
to `true`.

---

## Delivery to me, in one message

When you're ready, paste a single message:

```
UNITY_ZIP_URL: <https://... public link>
SQUADS_ADDRESS: <base58 Solana address>
STREAMFLOW_API_KEY: <your key>
ENABLE_USDC_SWAP: yes
```

I'll wire all 4 in one shot and re-run the quality gates.

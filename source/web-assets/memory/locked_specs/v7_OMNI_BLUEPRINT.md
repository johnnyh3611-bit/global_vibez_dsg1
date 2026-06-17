# 🔒 LOCKED SPEC — Global Vibez DSG Omni-Blueprint v7.0

**Source**: `Global_Vibez_OMNI_BLUEPRINT_v7.pdf` uploaded 2026-02-15.
**Status**: 🟢 LOCKED. Do NOT lose, downgrade, or alter without an explicit founder instruction.
**Last reaffirmed**: 2026-02-15

> ⚠ This file is the canonical engineering source-of-truth for v7.0.
> Future agents: read this BEFORE editing anything in `services/infra_wallet*`,
> `services/pricing_tiers*`, `services/celestial_glasshouse*`, or any of the
> v6.5 phase modules listed below.

---

## 🏛 Brand Hierarchy (from intro video, locked here too)

**Global Vibez** is the parent. Three flagship divisions all share the DSG suffix:

1. **Global Vibez Music Group** — DSG Music · artist suite, Beat Vault, freestyle battles, collab matchmaker
2. **Global Vibez DSG TV** — 24/7 channel + Memory Bank cinema + Cinema Date + AI-targeted ads
3. **Global Vibez DSG Guard** — security / safety services (AI Oracle Safety Guardian, Red Protocol)

Visual identity: **gold + electric blue** color palette with the digital-globe radiating-data motif.

---

## 🔑 v7's Headline Innovation: Self-Sustaining Infrastructure

A **closed-loop economic system**: revenue from content listing fees flows directly into a dedicated **Infrastructure Wallet** that pays for cloud storage + bandwidth. The platform pays for itself.

### `processUpload` canonical flow (v7.0)
```js
function processUpload(creatorId, contentType, contentCount = 1) {
  const cost = PRICING_TIERS[contentType] * contentCount;
  if (creatorWallet[creatorId].balance >= cost) {
    transferToInfra(creatorId, cost);
    unlockUploadSlots(creatorId, contentCount);
    return { ok: true, status: "UPLOAD_READY" };
  }
  return { ok: false, status: "INSUFFICIENT_FUNDS" };
}
```

---

## 💰 v7 Pricing Tiers (LISTING FEES)

| Constant | $USD | Notes |
|---|---|---|
| `SINGLE_EPISODE` | **5.00** | One Vibe TV episode |
| `SERIES_BUNDLE` | **20.00** | Buy 4 Get 1 Free — 5 episodes for $20 |
| `VIBE_CLIP` | **0.50** | Short-form clip on the channel |
| `MUSIC_TRACK` | **0.50** | One downloadable music track |

Memory Bank Movies have NO listing fee — they go straight on a 70/30 platform-fee split.

---

## 📊 v7 Revenue & Partner Split Table (canonical)

| Product | Price | Platform Infrastructure Fee | Creator Share |
|---|---|---|---|
| **Vibe TV Episode** | $5.00 listing | **100% of Listing Fee** | **70% of Ad/Sub Sales** |
| **Series Bundle** (Buy 4 Get 1 Free) | $20.00 listing | **100% of Listing Fee** | **70% of Ad/Sub Sales** |
| **Memory Bank Movie** | variable | **30% Platform Fee** | **70% Creator Share** |
| **Music / Clips** | $0.50 listing | **100% of Listing Fee** | **70% of Download Sales** |

The Sovereign Tax (13.5%) still applies on top of every gross transaction across all divisions.

---

## 🌌 The Celestial Glasshouse Arena (v7 NEW)

A new virtual arena hosting all "Apex Factor" elements:

1. **Beat Auctions** — producers list beats, artists bid, highest bid wins exclusive rights
2. **Freestyle Battles** — already shipped in v6.5 Phase 3; now hosted *inside* the Arena
3. **Celebrity Power Couple status** — paired Apex-tier artists who've shipped a Collab Studio together; unlocks Arena headliner slots + global broadcast

Access gate: `compute_vip_tier(...).celestial_glasshouse_access == True`
(i.e. Vibe Legend OR Vibe Sovereign OR Apex tier)

---

## 🧱 Phase Map (locked sequence v6.5 → v7)

| Phase | Module | Status |
|---|---|---|
| v6.5 / 1 | `services/apex_sovereign.py` (synergy + AI Oracle + pulse polls + VIP gate) | ✅ SHIPPED |
| v6.5 / 2 | `services/collab_matchmaker.py` (Duo Up + Studio) | ✅ SHIPPED |
| v6.5 / 3 | `services/freestyle_battles.py` (Beat Vault + battles + betting) | ✅ SHIPPED |
| v6.5 / 4 | `services/memory_bank.py` (DRM cinema 70/30) | ✅ SHIPPED |
| v6.5 / 5 | `services/cinema_date.py` (cross-room streaming + pulses) | ✅ SHIPPED |
| v6.5 / 6 | `services/vibe_tv.py` ($5/30m listing · zip-targeted ads) | ✅ SHIPPED |
| **v7 / 7** | `services/infra_wallet.py` (closed-loop infra funding) | 🟢 SHIP NEXT |
| **v7 / 8** | `services/pricing_tiers.py` (canonical SKUs + Buy 4 Get 1 Free) | 🟢 SHIP NEXT |
| **v7 / 9** | `services/beat_auctions.py` (sealed-bid auctions for exclusive beats) | 🟢 SHIP NEXT |
| **v7 / 10** | `services/celestial_glasshouse.py` (Power Couple state · Arena gate) | 🟢 SHIP NEXT |

---

## 📦 Founder's Locking Directive (verbatim from 2026-02-15)

> "I'm going to give you more code. Do everything one by one until finished. In all phases of the operation, go one by one until finished. After I give you this code, also do that. And please lock in everything that I'm giving you so you don't lose it later on."

### Lockdown Contract
- **Every spec uploaded by the founder** must be saved to `/app/memory/locked_specs/` as a permanent reference file — including raw extracts, derived schemas, and the founder's verbatim instructions when given.
- **Every shipped phase** must have at least one regression test in `tests/test_*.py` AND an entry in this LOCKED_SPECS markdown file marked with ✅ SHIPPED.
- **No deleting locked specs without an explicit founder instruction** containing the safe phrase or the spec name.
- If a future fork agent reduces or rewrites this file, the regression test `tests/test_locked_specs_intact.py` will go red.

---

## 🔐 Untouchable Until Founder Says "project complete"
- v10 Solana Mainnet bridge — currently dry-run/mocked
- Resend custom-domain TGE configuration

---

## 🟡 In-flight when this lock was created (2026-02-15)
- Founder said: *"I'm going to give you more code"* — a code-drop is expected following this lock.
- Action: when the next user message arrives with code, IMPLEMENT IT one-by-one per the directive above.

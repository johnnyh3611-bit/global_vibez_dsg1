# 🔒 LOCKED SPEC — Global Vibez DSG International Globalization Protocol v2.0

**Source PDF**: `Global_Vibe_DSG_International_Logic.pdf` — uploaded 2026-02-16.

**Status**: 🟢 LOCKED. Do NOT lose, downgrade, or alter without explicit founder instruction.
**Last reaffirmed**: 2026-02-16

> ⚠ This file is the canonical engineering source-of-truth for the
> "200% global fit" globalization layer.
> Future agents: read this BEFORE editing anything in
> `services/localization.py`, `routes/localization_routes.py`, or
> `frontend/src/utils/globalVibeSync.ts`.

---

## 🎯 Goal: 200% Global Fit

Every user — regardless of country, language, or dialect — receives a
**culturally native** experience across Gaming (31 rooms), VibeRidez,
Hungry Vibes, Dating, Streaming, and the AI Dealer.

---

## 🌐 The Three-Tier Localization Trigger (LOCKED)

| Tier | Trigger | Mechanism |
|---|---|---|
| **1. Auto-Sync** | First launch | GISA Agent pings device locale (IP + System Language). Tokyo user → Japanese / ¥ Yen / Metric. |
| **2. Globe Overlay** | User taps the persistent 🌐 FAB | Opens the **Cultural Hub** modal for manual override. |
| **3. Deep Persistence** | After any selection | Preference written to `user_metadata.localization` in MongoDB so the 31 game rooms + AI Dealer never revert. |

---

## 🎨 The Globe FAB (Floating Action Button)

- Persistent across the entire app (every page).
- Globe icon (🌐 Lucide `Globe` or `Languages`).
- Shows the current country flag inside or beside.
- Click → opens **Cultural Hub** modal.

### Cultural Hub Modal Tabs

1. **Country** — flag + name list, search + autocomplete.
2. **Language** — full ISO list filtered by country.
3. **Dialect** — only shown for languages with sub-regions
   (e.g. en-US, en-GB; es-MX, es-ES, es-AR).
4. **Currency** — auto-derived from country, override allowed.
5. **Units** — Imperial (mi) vs Metric (km), auto-derived.

---

## 🧬 Detailed Dating Portal Onboarding (LOCKED)

Every new dating user goes through the **Cultural Onboarding Wizard**
segmented into 4 categories for "200% compatibility":

### 1. Origin & Current Vibe
- "Where is **home**?" (country + city)
- "Where are you **vibing today**?" (current country + city — for travelers/digital nomads)

### 2. Linguistic Range
- "Which languages do you **speak fluently**?" (multi-select)
- "Which languages are you **learning**?" (multi-select, for ice-breaker matching)

### 3. Dialect Selection (only for Spanish + English)
- For English: UK 🇬🇧 / USA 🇺🇸 / Caribbean 🇯🇲 / Aussie 🇦🇺 / South Africa 🇿🇦 / Indian 🇮🇳 etc.
- For Spanish: Mexico 🇲🇽 / Spain 🇪🇸 / Argentina 🇦🇷 / Caribbean / Andean etc.
- Reason: AI Dealer + matches use the right slang.

### 4. Cultural Values Filter (opt-in)
- Traditions
- Dietary habits (relevant for Hungry Vibes dates)
- Social etiquette / pace of communication

All answers persist to `user_metadata.localization` AND
`user_metadata.cultural_profile`.

---

## 🔄 Cross-Service Integration Logic (LOCKED)

| Service | Effect of Country / Language Change |
|---|---|
| **Gaming (31 rooms)** | Swap string tables. Baccarat / Bid Whist rulesets adjust to regional variants if applicable. |
| **VibeRidez** | Maps swap to local landmarks. Distance units swap (mi ⇄ km). Currency swap on fares. |
| **Hungry Vibes** | Menu algorithm prioritizes local cuisine. |
| **AI Dealer** | Voice + slang matches dialect selection. |
| **Dating** | Match-rank weights matching dialect / cultural values. |

---

## 🧠 The "Smart Translator" Agent — `globalVibeSync` (LOCKED)

```javascript
// /app/frontend/src/utils/globalVibeSync.ts
const globalVibeSync = (userSelection) => {
  // 1. Persist to backend
  updateUserMetadata(userSelection.language, userSelection.country);

  // 2. Notify Unreal Engine 5.5 container
  unrealEngine.emit('UpdateLocale', userSelection.localeCode);

  // 3. Swap React i18n string tables
  i18n.changeLanguage(userSelection.languageCode);

  // 4. Refresh service menus (Hungry Vibes / VibeRidez / Gaming)
  refreshServiceMenus(userSelection.countryCode);
};
```

`userSelection` shape:
```ts
{
  country: string;        // "US"
  countryCode: string;    // "US"
  language: string;       // "English"
  languageCode: string;   // "en"
  localeCode: string;     // "en-US"
  dialect?: string;       // "en-US" or "en-GB" etc.
  currency: string;       // "USD"
  unitSystem: 'imperial' | 'metric';
}
```

---

## 🗄 MongoDB Schema (canonical)

`user_metadata` collection, document shape:

```json
{
  "user_id": "u_abc123",
  "localization": {
    "country": "US",
    "country_code": "US",
    "language": "en",
    "language_code": "en",
    "locale_code": "en-US",
    "dialect": "en-US",
    "currency": "USD",
    "unit_system": "imperial",
    "auto_synced": true,
    "updated_at": "2026-02-16T08:32:00Z"
  },
  "cultural_profile": {
    "home_country": "US",
    "current_country": "JP",
    "languages_fluent": ["en", "es"],
    "languages_learning": ["ja"],
    "english_dialect": "en-US",
    "spanish_dialect": null,
    "cultural_values": {
      "traditions": ["western"],
      "dietary": ["omnivore"],
      "social_etiquette": "direct"
    }
  }
}
```

---

## ✅ Acceptance Criteria

1. First-time user in Tokyo (IP + system lang JA) lands on app → defaults to Japanese / ¥ Yen / Metric.
2. Globe FAB visible on every page after auth.
3. Cultural Hub modal opens, user can change country → entire app re-renders (game tables, Vibe Ridez units, Hungry menu).
4. Selection persists across logout/login (MongoDB confirmed).
5. Dating onboarding wizard captures all 4 cultural categories before Match feed unlocks.

---

## 📜 Version Log

- **v2.0** (2026-02-16) — locked from founder PDF.

/**
 * globalVibeSync — Smart Translator Agent (LOCKED v2.0)
 *
 * Source spec: /app/memory/locked_specs/v8_INTERNATIONAL_LOGIC.md
 *
 * The canonical bridge function between:
 *   - React UI (i18n string tables)
 *   - MongoDB user_metadata.localization (Tier-3 deep persistence)
 *   - Service menus (Hungry Vibes / VibeRidez / Gaming AI Dealer)
 *   - Unreal Engine 5.5 container (when present)
 *
 * Every Cultural Hub manual selection MUST flow through this function
 * so the 31 game rooms + AI Dealer never revert to the wrong language.
 */

const API = (process.env as any).REACT_APP_BACKEND_URL as string;

export type UnitSystem = 'imperial' | 'metric';

export interface UserLocaleSelection {
  country: string;
  countryCode: string;       // "JP"
  language: string;          // "Japanese"
  languageCode: string;      // "ja"
  localeCode: string;        // "ja-JP"
  dialect?: string;          // "ja-JP"
  currency: string;          // "JPY"
  currencySymbol: string;    // "¥"
  unitSystem: UnitSystem;
  autoSynced: boolean;
  updatedAt: string;
}

const STORAGE_KEY = 'gv_localization_v2';

/** Persist + emit window event so any listener (Unreal, i18n, menus) can re-render. */
export function persistLocaleLocally(payload: UserLocaleSelection): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* storage may be disabled — ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent('gv:locale-changed', { detail: payload }));
  } catch {
    /* SSR safety */
  }
}

export function loadLocalLocale(): UserLocaleSelection | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UserLocaleSelection) : null;
  } catch {
    return null;
  }
}

/** Tier-1: Auto-Sync from device locale. Called on first launch. */
export async function autoDetectLocale(): Promise<UserLocaleSelection | null> {
  try {
    const acceptLang =
      typeof navigator !== 'undefined'
        ? navigator.language
        : 'en-US';
    const res = await fetch(`${API}/api/localization/detect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': acceptLang,
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return mapPayload(data.localization);
  } catch {
    return null;
  }
}

/** Tier-2: User picks from the Cultural Hub — call this on save. */
export async function selectLocale(
  countryCode: string,
  languageCode?: string,
  dialect?: string,
): Promise<UserLocaleSelection | null> {
  try {
    const res = await fetch(`${API}/api/localization/select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        country_code: countryCode,
        language_code: languageCode,
        dialect,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return mapPayload(data.localization);
  } catch {
    return null;
  }
}

/** Tier-3: Deep persistence to MongoDB (when user is signed in). */
export async function saveLocaleForUser(
  userId: string,
  payload: { countryCode: string; languageCode?: string; dialect?: string },
): Promise<UserLocaleSelection | null> {
  try {
    const res = await fetch(`${API}/api/localization/me/${userId}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        country_code: payload.countryCode,
        language_code: payload.languageCode,
        dialect: payload.dialect,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return mapPayload(data.localization);
  } catch {
    return null;
  }
}

export async function loadLocaleForUser(
  userId: string,
): Promise<UserLocaleSelection | null> {
  try {
    const res = await fetch(`${API}/api/localization/me/${userId}`);
    if (!res.ok) return null;
    const data = await res.json();
    return mapPayload(data.localization);
  } catch {
    return null;
  }
}

/**
 * The canonical sync function from the LOCKED spec.
 * Wires React i18n + Unreal Engine 5.5 + service menus + persistence.
 */
export async function globalVibeSync(
  selection: { countryCode: string; languageCode?: string; dialect?: string },
  userId?: string,
): Promise<UserLocaleSelection | null> {
  const payload = userId
    ? await saveLocaleForUser(userId, selection)
    : await selectLocale(selection.countryCode, selection.languageCode, selection.dialect);
  if (!payload) return null;

  // 1. Persist locally + emit window event so listeners refresh.
  persistLocaleLocally(payload);

  // 2. Notify Unreal Engine 5.5 container if present.
  try {
    const ue = (window as any).unrealEngine;
    if (ue && typeof ue.emit === 'function') {
      ue.emit('UpdateLocale', payload.localeCode);
    }
  } catch {
    /* UE not mounted — ignore */
  }

  // 3. Swap React i18n string table if i18n is mounted.
  try {
    const i18n = (window as any).i18n;
    if (i18n && typeof i18n.changeLanguage === 'function') {
      i18n.changeLanguage(payload.languageCode);
    }
  } catch {
    /* no-op */
  }

  // 4. Service menus listen for the window event above.
  return payload;
}

/* ----------- internal helpers ----------- */
function mapPayload(p: any): UserLocaleSelection {
  return {
    country: p.country,
    countryCode: p.country_code,
    language: p.language,
    languageCode: p.language_code,
    localeCode: p.locale_code,
    dialect: p.dialect,
    currency: p.currency,
    currencySymbol: p.currency_symbol,
    unitSystem: p.unit_system as UnitSystem,
    autoSynced: !!p.auto_synced,
    updatedAt: p.updated_at,
  };
}

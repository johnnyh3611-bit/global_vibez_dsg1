/**
 * LandingLanguageSwitcher — inline language/country pill placed in the
 * top-right header (next to Sign In / Join Now).
 *
 * Founder ask 2026-02-18: "Add a little globe that switches to
 * different languages for different countries… make sure it's got its
 * own portal because currently when I click it, it goes into my God
 * Mode because it's next to my God Mode link."
 *
 * Defensive design (so the click can NEVER trigger a parent navigate):
 *   1. e.stopPropagation() on the button click
 *   2. The CulturalHubModal renders via createPortal directly into
 *      document.body — fully escapes any wrapping <Link> / onClick.
 *   3. e.preventDefault() in case the parent is an anchor.
 *
 * Reuses existing globalVibeSync utilities (auto-detect, persist
 * locally, broadcast `gv:locale-changed`) so it stays in lock-step
 * with the corner GlobeFAB and SettingsPage locale tab.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Globe, ChevronDown } from 'lucide-react';
import { CulturalHubModal } from './CulturalHubModal';
import {
  autoDetectLocale,
  loadLocalLocale,
  persistLocaleLocally,
  type UserLocaleSelection,
} from '@/utils/globalVibeSync';

const FLAG_FOR_COUNTRY: Record<string, string> = {
  US: '🇺🇸', GB: '🇬🇧', CA: '🇨🇦', AU: '🇦🇺', JM: '🇯🇲', ZA: '🇿🇦', IN: '🇮🇳',
  MX: '🇲🇽', ES: '🇪🇸', AR: '🇦🇷', CO: '🇨🇴', FR: '🇫🇷', DE: '🇩🇪', IT: '🇮🇹',
  PT: '🇵🇹', BR: '🇧🇷', JP: '🇯🇵', KR: '🇰🇷', CN: '🇨🇳', TW: '🇹🇼', RU: '🇷🇺',
  TR: '🇹🇷', AE: '🇦🇪', SA: '🇸🇦', NG: '🇳🇬', KE: '🇰🇪', PH: '🇵🇭',
};

// Friendly language label fallback. The full L10n catalog lives in
// CulturalHubModal — this is just for the inline pill display.
const LANGUAGE_LABEL: Record<string, string> = {
  en: 'English',  es: 'Español',   fr: 'Français',  de: 'Deutsch',
  it: 'Italiano', pt: 'Português', ja: '日本語',     ko: '한국어',
  zh: '中文',      ar: 'العربية',   hi: 'हिन्दी',
  ru: 'Русский', tr: 'Türkçe',    nl: 'Nederlands', sv: 'Svenska',
};

const labelForLocale = (locale: UserLocaleSelection | null): string => {
  if (!locale) return 'Detecting…';
  const lang = locale.localeCode.split('-')[0]?.toLowerCase() || 'en';
  return LANGUAGE_LABEL[lang] || locale.localeCode;
};

export function LandingLanguageSwitcher() {
  const [open, setOpen] = useState(false);
  const [locale, setLocale] = useState<UserLocaleSelection | null>(null);

  // Tier-1: Auto-detect from browser/IP if no local pref yet. Same flow
  // as the corner FAB so first-paint is consistent.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = loadLocalLocale();
      if (cached) {
        if (!cancelled) setLocale(cached);
        return;
      }
      const detected = await autoDetectLocale();
      if (!cancelled && detected) {
        persistLocaleLocally(detected);
        setLocale(detected);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Stay in sync with the corner FAB / Settings locale tab via the
  // shared `gv:locale-changed` custom event.
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<UserLocaleSelection>;
      if (ce.detail) setLocale(ce.detail);
    };
    window.addEventListener('gv:locale-changed', handler);
    return () => window.removeEventListener('gv:locale-changed', handler);
  }, []);

  const onSelected = useCallback((next: UserLocaleSelection) => {
    setLocale(next);
    setOpen(false);
  }, []);

  const flag = locale ? FLAG_FOR_COUNTRY[locale.countryCode] || '🌐' : '🌐';
  const langLabel = labelForLocale(locale);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          // Defensive: even though the switcher now lives in the
          // top-right (separate from any God-Mode hotspot), keep this
          // here so a future parent click handler can never hijack
          // the language picker.
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        data-testid="landing-language-switcher"
        title="Change country / language"
        aria-label="Change country and language"
        className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-black/40 hover:bg-cyan-500/10 hover:border-cyan-400/80 px-3.5 py-2 text-xs font-bold text-cyan-300 transition-all backdrop-blur-md group"
      >
        <span className="text-base leading-none" aria-hidden>{flag}</span>
        <Globe className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
        <span data-testid="landing-language-switcher-label" className="tabular-nums">
          {langLabel}
        </span>
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>
      {/* Render the modal through a DOM portal so the dialog can
          never be nested inside a click-bubbling parent (the founder
          hit this with the God-Mode logo hotspot). */}
      {open && typeof document !== 'undefined' && createPortal(
        <div data-testid="landing-language-switcher-portal" onClick={(e) => e.stopPropagation()}>
          <CulturalHubModal
            open={open}
            onClose={() => setOpen(false)}
            onSelected={onSelected}
          />
        </div>,
        document.body,
      )}
    </>
  );
}

export default LandingLanguageSwitcher;

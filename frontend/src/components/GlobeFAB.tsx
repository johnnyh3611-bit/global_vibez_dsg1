/**
 * GlobeFAB — persistent floating action button (LOCKED v2.0).
 *
 * Source spec: /app/memory/locked_specs/v8_INTERNATIONAL_LOGIC.md (Tier 2)
 *
 * Renders on every page (mounted in App.js). Click → opens CulturalHubModal.
 * Bottom-right, above mobile dock. Shows current country flag + locale code.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Globe } from 'lucide-react';
import useCornerDockTrigger from "@/hooks/useCornerDockTrigger";
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

export function GlobeFAB() {
  const [open, setOpen] = useState(false);
  const [locale, setLocale] = useState<UserLocaleSelection | null>(null);
  const triggerHidden = useCornerDockTrigger("cultural_hub", setOpen);

  // Tier-1: Auto-Sync on first launch (only if no local pref yet).
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

  // Listen for downstream changes
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
  const code = locale ? locale.localeCode : '...';

  return (
    <>
      {!triggerHidden && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-testid="globe-fab-button"
          title="Cultural Hub — change country / language / units"
          className="fixed bottom-24 right-4 z-50 flex items-center gap-1.5 rounded-full bg-[#0A0A0F]/95 hover:bg-[#1a1a25] text-[#00E5C7] border border-[#00E5C7]/40 px-3 py-2 text-sm font-bold shadow-lg shadow-[#00E5C7]/10 backdrop-blur-md transition-all hover:scale-105 active:scale-95 sm:bottom-6"
        >
          <span className="text-base leading-none" aria-hidden>{flag}</span>
          <Globe className="w-4 h-4" />
          <span className="hidden sm:inline tabular-nums text-xs uppercase tracking-wider">
            {code}
          </span>
        </button>
      )}

      <CulturalHubModal
        open={open}
        onClose={() => setOpen(false)}
        onSelected={onSelected}
      />
    </>
  );
}

export default GlobeFAB;

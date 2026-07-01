/**
 * CulturalHubModal — Tier-2 manual selection UI (LOCKED v2.0).
 *
 * Source spec: /app/memory/locked_specs/v8_INTERNATIONAL_LOGIC.md
 *
 * 4 tabs: Country / Language / Dialect / Currency+Units (auto-derived).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { X, Search, Check } from 'lucide-react';
import {
  globalVibeSync,
  type UserLocaleSelection,
} from '@/utils/globalVibeSync';

const API = process.env.REACT_APP_BACKEND_URL as string;

interface Country {
  code: string;
  name: string;
  flag: string;
  default_language: string;
  default_dialect: string;
  currency: string;
  currency_symbol: string;
  unit_system: 'imperial' | 'metric';
}

interface Language {
  code: string;
  name: string;
  native_name: string;
  dialects: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelected: (next: UserLocaleSelection) => void;
}

export function CulturalHubModal({ open, onClose, onSelected }: Props) {
  const [tab, setTab] = useState<'country' | 'language' | 'dialect'>('country');
  const [countries, setCountries] = useState<Country[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [search, setSearch] = useState('');
  const [pickedCountry, setPickedCountry] = useState<Country | null>(null);
  const [pickedLanguage, setPickedLanguage] = useState<string>('');
  const [pickedDialect, setPickedDialect] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Load lists once
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const [c, l] = await Promise.all([
          fetch(`${API}/api/localization/countries`).then(r => r.json()),
          fetch(`${API}/api/localization/languages`).then(r => r.json()),
        ]);
        setCountries(c.countries || []);
        setLanguages(l.languages || []);
      } catch {
        /* ignore */
      }
    })();
  }, [open]);

  const filteredCountries = useMemo(() => {
    if (!search) return countries;
    const q = search.toLowerCase();
    return countries.filter(c =>
      c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
    );
  }, [countries, search]);

  const currentLang: Language | undefined = useMemo(() => {
    const code = pickedLanguage || pickedCountry?.default_language;
    return languages.find(l => l.code === code);
  }, [languages, pickedLanguage, pickedCountry]);

  const onPickCountry = (c: Country) => {
    setPickedCountry(c);
    setPickedLanguage(c.default_language);
    setPickedDialect(c.default_dialect);
    setTab('language');
  };

  const onPickLanguage = (lc: string) => {
    setPickedLanguage(lc);
    const lang = languages.find(l => l.code === lc);
    // Pre-fill dialect with country default if it matches, else 1st available, else lc-CC
    if (lang?.dialects?.length) {
      const matchDefault = pickedCountry?.default_dialect &&
        lang.dialects.includes(pickedCountry.default_dialect);
      setPickedDialect(matchDefault
        ? (pickedCountry?.default_dialect as string)
        : lang.dialects[0]);
    } else {
      setPickedDialect(`${lc}-${pickedCountry?.code || 'US'}`);
    }
    if (lang?.dialects?.length && lang.dialects.length > 1) setTab('dialect');
  };

  const onApply = async () => {
    if (!pickedCountry) return;
    setSaving(true);
    try {
      const userId = localStorage.getItem('user_id') || undefined;
      const payload = await globalVibeSync(
        {
          countryCode: pickedCountry.code,
          languageCode: pickedLanguage || pickedCountry.default_language,
          dialect: pickedDialect || pickedCountry.default_dialect,
        },
        userId,
      );
      if (payload) onSelected(payload);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      data-testid="cultural-hub-modal"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-[#0A0A0F] border border-[#00E5C7]/30 rounded-2xl shadow-2xl shadow-[#00E5C7]/20 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-gradient-to-r from-[#00E5C7]/5 to-transparent">
          <div>
            <h3 className="text-lg font-black text-white tracking-tight">
              Cultural Hub
            </h3>
            <p className="text-xs text-[#00E5C7] uppercase tracking-widest">
              200% Global Fit
            </p>
          </div>
          <button
            onClick={onClose}
            data-testid="cultural-hub-close"
            className="text-white/60 hover:text-white p-1 rounded-md hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5 bg-black/40">
          {(['country', 'language', 'dialect'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              data-testid={`cultural-hub-tab-${t}`}
              className={`flex-1 px-4 py-3 text-sm font-bold uppercase tracking-wider transition-colors
                ${tab === t
                  ? 'text-[#00E5C7] border-b-2 border-[#00E5C7]'
                  : 'text-white/50 hover:text-white/80'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {tab === 'country' && (
            <div>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  data-testid="cultural-hub-country-search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search countries…"
                  className="w-full bg-black/60 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none focus:border-[#00E5C7]/60"
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {filteredCountries.map(c => (
                  <button
                    key={c.code}
                    onClick={() => onPickCountry(c)}
                    data-testid={`cultural-hub-country-${c.code}`}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left text-sm transition-all
                      ${pickedCountry?.code === c.code
                        ? 'border-[#00E5C7] bg-[#00E5C7]/10 text-white'
                        : 'border-white/10 bg-black/40 text-white/80 hover:border-white/30 hover:bg-black/60'}`}
                  >
                    <span className="text-xl leading-none">{c.flag}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold truncate">{c.name}</div>
                      <div className="text-[10px] uppercase text-white/50 tracking-wider">
                        {c.currency} · {c.unit_system === 'imperial' ? 'mi' : 'km'}
                      </div>
                    </div>
                    {pickedCountry?.code === c.code && (
                      <Check className="w-4 h-4 text-[#00E5C7] flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === 'language' && (
            <div className="grid grid-cols-2 gap-2">
              {languages.map(l => (
                <button
                  key={l.code}
                  onClick={() => onPickLanguage(l.code)}
                  data-testid={`cultural-hub-language-${l.code}`}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-left text-sm transition-all
                    ${pickedLanguage === l.code
                      ? 'border-[#00E5C7] bg-[#00E5C7]/10 text-white'
                      : 'border-white/10 bg-black/40 text-white/80 hover:border-white/30'}`}
                >
                  <div className="min-w-0">
                    <div className="font-bold truncate">{l.name}</div>
                    <div className="text-[10px] text-white/50">{l.native_name}</div>
                  </div>
                  {pickedLanguage === l.code && (
                    <Check className="w-4 h-4 text-[#00E5C7] flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}

          {tab === 'dialect' && (
            <div>
              {currentLang && currentLang.dialects.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {currentLang.dialects.map(d => (
                    <button
                      key={d}
                      onClick={() => setPickedDialect(d)}
                      data-testid={`cultural-hub-dialect-${d}`}
                      className={`px-3 py-2.5 rounded-lg border text-sm font-mono transition-all
                        ${pickedDialect === d
                          ? 'border-[#00E5C7] bg-[#00E5C7]/10 text-white'
                          : 'border-white/10 bg-black/40 text-white/80 hover:border-white/30'}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-white/50 text-sm">
                  No dialect variants for {currentLang?.name || 'this language'}.
                  Default locale: <code className="text-[#00E5C7]">{pickedDialect}</code>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Summary + apply */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t border-white/5 bg-black/40">
          <div className="text-xs text-white/60 flex flex-wrap gap-3">
            {pickedCountry && (
              <span data-testid="cultural-hub-summary">
                <span className="text-base mr-1">{pickedCountry.flag}</span>
                <strong className="text-white">{pickedCountry.name}</strong>{' '}
                · <span className="text-[#00E5C7]">{pickedDialect}</span>{' '}
                · {pickedCountry.currency_symbol} {pickedCountry.currency}{' '}
                · {pickedCountry.unit_system === 'imperial' ? 'mi' : 'km'}
              </span>
            )}
          </div>
          <button
            onClick={onApply}
            disabled={!pickedCountry || saving}
            data-testid="cultural-hub-apply"
            className="px-5 py-2 rounded-full bg-[#FF8A1F] hover:bg-[#FFA040] text-black font-black text-sm uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Syncing…' : 'Apply Vibe'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CulturalHubModal;

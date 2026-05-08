/**
 * CulturalOnboardingWizard — Detailed Dating Portal Onboarding (LOCKED v2.0).
 *
 * Source spec: /app/memory/locked_specs/v8_INTERNATIONAL_LOGIC.md
 *
 * 4 steps for "200% compatibility":
 *   1. Origin & Current Vibe
 *   2. Linguistic Range
 *   3. Dialect Selection (English / Spanish only)
 *   4. Cultural Values Filter (opt-in)
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Check } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL as string;

interface Country { code: string; name: string; flag: string; }
interface Language { code: string; name: string; native_name: string; dialects: string[]; }

type StepId =
  | 'origin_and_vibe'
  | 'linguistic_range'
  | 'dialect_selection'
  | 'cultural_values';

const STEP_TITLES: Record<StepId, string> = {
  origin_and_vibe: 'Origin & Current Vibe',
  linguistic_range: 'Linguistic Range',
  dialect_selection: 'Dialect Selection',
  cultural_values: 'Cultural Values',
};

const STEP_ORDER: StepId[] = [
  'origin_and_vibe', 'linguistic_range', 'dialect_selection', 'cultural_values',
];

export default function CulturalOnboardingWizard() {
  const navigate = useNavigate();
  const userId = (typeof window !== 'undefined' && localStorage.getItem('user_id')) || 'guest';

  const [stepIdx, setStepIdx] = useState(0);
  const [countries, setCountries] = useState<Country[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Step state
  const [homeCountry, setHomeCountry] = useState('');
  const [currentCountry, setCurrentCountry] = useState('');
  const [fluent, setFluent] = useState<string[]>([]);
  const [learning, setLearning] = useState<string[]>([]);
  const [englishDialect, setEnglishDialect] = useState('');
  const [spanishDialect, setSpanishDialect] = useState('');
  const [traditions, setTraditions] = useState<string[]>([]);
  const [dietary, setDietary] = useState<string[]>([]);
  const [etiquette, setEtiquette] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [c, l] = await Promise.all([
          fetch(`${API}/api/localization/countries`).then(r => r.json()),
          fetch(`${API}/api/localization/languages`).then(r => r.json()),
        ]);
        setCountries(c.countries || []);
        setLanguages(l.languages || []);
      } catch { /* ignore */ }
    })();
  }, []);

  const englishDialects = useMemo(
    () => (languages.find(l => l.code === 'en')?.dialects || []),
    [languages],
  );
  const spanishDialects = useMemo(
    () => (languages.find(l => l.code === 'es')?.dialects || []),
    [languages],
  );

  const stepId: StepId = STEP_ORDER[stepIdx];
  const isLast = stepIdx === STEP_ORDER.length - 1;

  const submitStep = async () => {
    setSubmitting(true);
    try {
      const payload =
        stepId === 'origin_and_vibe'
          ? { home_country: homeCountry, current_country: currentCountry }
          : stepId === 'linguistic_range'
          ? { fluent, learning }
          : stepId === 'dialect_selection'
          ? { english_dialect: englishDialect || null, spanish_dialect: spanishDialect || null }
          : { cultural_values: { traditions, dietary, social_etiquette: etiquette || null } };

      await fetch(`${API}/api/cultural-onboarding/${userId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: stepId, payload }),
      });

      if (isLast) {
        navigate('/dating');
      } else {
        setStepIdx(stepIdx + 1);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const toggleIn = (arr: string[], v: string, setter: (next: string[]) => void) => {
    setter(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
  };

  const canAdvance = useMemo(() => {
    if (stepId === 'origin_and_vibe') return !!homeCountry && !!currentCountry;
    if (stepId === 'linguistic_range') return fluent.length > 0;
    if (stepId === 'dialect_selection') {
      // require dialect only for languages user said they're fluent in
      const needsEn = fluent.includes('en');
      const needsEs = fluent.includes('es');
      if (needsEn && !englishDialect) return false;
      if (needsEs && !spanishDialect) return false;
      return true;
    }
    return true; // cultural_values is opt-in
  }, [stepId, homeCountry, currentCountry, fluent, englishDialect, spanishDialect]);

  return (
    <div
      data-testid="cultural-onboarding-wizard"
      className="min-h-screen bg-[#0A0A0F] text-white px-4 py-10 flex items-start justify-center"
    >
      <div className="w-full max-w-3xl">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {STEP_ORDER.map((s, i) => (
            <div
              key={s}
              className={`flex-1 h-1 rounded-full transition-colors ${
                i <= stepIdx ? 'bg-[#00E5C7]' : 'bg-white/10'
              }`}
            />
          ))}
        </div>

        <p className="uppercase tracking-[0.3em] text-[#00E5C7] text-xs font-bold mb-2">
          Step {stepIdx + 1} / {STEP_ORDER.length}
        </p>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">
          {STEP_TITLES[stepId]}
        </h1>
        <p className="text-white/60 mb-8 max-w-prose">
          We use this to deliver <span className="text-[#FFD33D] font-bold">200% compatibility</span>{' '}
          across the dating, gaming, rides, and food experiences.
        </p>

        {/* Step content */}
        {stepId === 'origin_and_vibe' && (
          <div className="space-y-6">
            <CountryPicker
              label="Where is home?"
              countries={countries}
              value={homeCountry}
              onChange={setHomeCountry}
              testidPrefix="home"
            />
            <CountryPicker
              label="Where are you vibing today?"
              countries={countries}
              value={currentCountry}
              onChange={setCurrentCountry}
              testidPrefix="current"
            />
          </div>
        )}

        {stepId === 'linguistic_range' && (
          <div className="space-y-6">
            <LanguageMultiPicker
              label="Languages you speak fluently"
              languages={languages}
              value={fluent}
              onToggle={(lc) => toggleIn(fluent, lc, setFluent)}
              testidPrefix="fluent"
            />
            <LanguageMultiPicker
              label="Languages you're learning (optional)"
              languages={languages}
              value={learning}
              onToggle={(lc) => toggleIn(learning, lc, setLearning)}
              testidPrefix="learning"
            />
          </div>
        )}

        {stepId === 'dialect_selection' && (
          <div className="space-y-6">
            {fluent.includes('en') ? (
              <DialectPicker
                label="Your English dialect"
                dialects={englishDialects}
                value={englishDialect}
                onChange={setEnglishDialect}
                testidPrefix="english"
              />
            ) : (
              <p className="text-white/40 text-sm">Skipping English (not in fluent list).</p>
            )}
            {fluent.includes('es') ? (
              <DialectPicker
                label="Your Spanish dialect"
                dialects={spanishDialects}
                value={spanishDialect}
                onChange={setSpanishDialect}
                testidPrefix="spanish"
              />
            ) : (
              <p className="text-white/40 text-sm">Skipping Spanish (not in fluent list).</p>
            )}
            {!fluent.includes('en') && !fluent.includes('es') && (
              <p className="text-white/60 text-sm">
                Dialect selection only applies to English & Spanish — you can skip ahead.
              </p>
            )}
          </div>
        )}

        {stepId === 'cultural_values' && (
          <div className="space-y-6">
            <PillGroup
              label="Traditions you observe (optional)"
              options={['Western', 'Latin', 'East Asian', 'South Asian', 'Middle Eastern', 'African', 'Caribbean', 'Indigenous']}
              value={traditions}
              onToggle={(v) => toggleIn(traditions, v, setTraditions)}
              testidPrefix="tradition"
            />
            <PillGroup
              label="Dietary habits (helps Hungry Vibes dates)"
              options={['Omnivore', 'Vegetarian', 'Vegan', 'Halal', 'Kosher', 'Pescatarian', 'Gluten-Free']}
              value={dietary}
              onToggle={(v) => toggleIn(dietary, v, setDietary)}
              testidPrefix="dietary"
            />
            <div>
              <label className="block text-sm font-bold mb-2 text-white/80">
                Social etiquette / pace of communication
              </label>
              <select
                data-testid="etiquette-select"
                value={etiquette}
                onChange={(e) => setEtiquette(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-3 text-sm text-white"
              >
                <option value="">No preference</option>
                <option value="direct">Direct</option>
                <option value="indirect">Indirect</option>
                <option value="formal">Formal</option>
                <option value="casual">Casual</option>
              </select>
            </div>
          </div>
        )}

        {/* Nav */}
        <div className="flex items-center justify-between mt-10">
          <button
            disabled={stepIdx === 0}
            onClick={() => setStepIdx(stepIdx - 1)}
            data-testid="cultural-onboarding-back"
            className="inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm font-bold text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <button
            onClick={submitStep}
            disabled={!canAdvance || submitting}
            data-testid="cultural-onboarding-next"
            className="inline-flex items-center gap-1 px-6 py-3 rounded-full bg-[#FF8A1F] hover:bg-[#FFA040] text-black font-black text-sm uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLast ? (submitting ? 'Saving…' : 'Finish') : 'Next'}
            {!isLast && <ChevronRight className="w-4 h-4" />}
            {isLast && <Check className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- helper sub-components ---------- */

function CountryPicker({
  label, countries, value, onChange, testidPrefix,
}: {
  label: string;
  countries: Country[];
  value: string;
  onChange: (v: string) => void;
  testidPrefix: string;
}) {
  return (
    <div>
      <label className="block text-sm font-bold mb-2 text-white/80">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={`${testidPrefix}-country-select`}
        className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-3 text-sm text-white focus:outline-none focus:border-[#00E5C7]/60"
      >
        <option value="">Select a country…</option>
        {countries.map(c => (
          <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
        ))}
      </select>
    </div>
  );
}

function LanguageMultiPicker({
  label, languages, value, onToggle, testidPrefix,
}: {
  label: string;
  languages: Language[];
  value: string[];
  onToggle: (lc: string) => void;
  testidPrefix: string;
}) {
  return (
    <div>
      <label className="block text-sm font-bold mb-2 text-white/80">{label}</label>
      <div className="flex flex-wrap gap-2">
        {languages.map(l => (
          <button
            key={l.code}
            type="button"
            onClick={() => onToggle(l.code)}
            data-testid={`${testidPrefix}-${l.code}-pill`}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              value.includes(l.code)
                ? 'bg-[#00E5C7]/20 border-[#00E5C7] text-white'
                : 'bg-black/40 border-white/10 text-white/70 hover:border-white/30'
            }`}
          >
            {l.name} <span className="text-white/40 ml-1 text-xs">{l.native_name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DialectPicker({
  label, dialects, value, onChange, testidPrefix,
}: {
  label: string;
  dialects: string[];
  value: string;
  onChange: (v: string) => void;
  testidPrefix: string;
}) {
  return (
    <div>
      <label className="block text-sm font-bold mb-2 text-white/80">{label}</label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {dialects.map(d => (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            data-testid={`${testidPrefix}-dialect-${d}`}
            className={`px-3 py-2.5 rounded-lg border text-sm font-mono transition-colors ${
              value === d
                ? 'border-[#00E5C7] bg-[#00E5C7]/10 text-white'
                : 'border-white/10 bg-black/40 text-white/70 hover:border-white/30'
            }`}
          >
            {d}
          </button>
        ))}
      </div>
    </div>
  );
}

function PillGroup({
  label, options, value, onToggle, testidPrefix,
}: {
  label: string;
  options: string[];
  value: string[];
  onToggle: (v: string) => void;
  testidPrefix: string;
}) {
  return (
    <div>
      <label className="block text-sm font-bold mb-2 text-white/80">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map(o => (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            data-testid={`${testidPrefix}-${o.toLowerCase().replace(/\s+/g, '-')}-pill`}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              value.includes(o)
                ? 'bg-[#FFD33D]/20 border-[#FFD33D] text-white'
                : 'bg-black/40 border-white/10 text-white/70 hover:border-white/30'
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

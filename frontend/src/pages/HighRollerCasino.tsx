/**
 * High Roller VIP Casino — gated 10,000-coin-minimum tier.
 *
 * Two states:
 *   1. Not yet VIP → show 3-tier upgrade cards (Genius / Genesis / Apex)
 *      with Stripe Checkout buttons.
 *   2. Active VIP → show the VIP lounge with the High Roller Blackjack
 *      entry tile + days-remaining countdown.
 *
 * Design ethos: deep obsidian background, gold + emerald accents,
 * radial-gradient glow halos, parallax-feel via backdrop-blur. No
 * generic purple/violet "AI slop" gradient.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Crown, Diamond, Sparkles, Lock, CheckCircle2, ArrowRight } from 'lucide-react';
import BackButton from '@/components/BackButton';

const API_URL = process.env.REACT_APP_BACKEND_URL;

type Tier = {
  tier: 'genius' | 'genesis' | 'apex';
  label: string;
  price_usd: number;
  duration_days: number;
  tagline: string;
  perks: string[];
};

type Eligibility = {
  is_vip: boolean;
  tier: string | null;
  vip_until: string | null;
  min_bet: number;
};

const TIER_THEME: Record<string, { ring: string; glow: string; chip: string; badge: string }> = {
  genius: {
    ring: 'ring-amber-400/60',
    glow: 'shadow-[0_0_60px_-10px_rgba(251,191,36,0.55)]',
    chip: 'from-amber-300 via-yellow-400 to-amber-600',
    badge: 'bg-amber-500 text-black',
  },
  genesis: {
    ring: 'ring-emerald-400/70',
    glow: 'shadow-[0_0_70px_-10px_rgba(16,185,129,0.6)]',
    chip: 'from-emerald-300 via-green-400 to-emerald-700',
    badge: 'bg-emerald-500 text-black',
  },
  apex: {
    ring: 'ring-fuchsia-400/70',
    glow: 'shadow-[0_0_80px_-10px_rgba(217,70,239,0.65)]',
    chip: 'from-yellow-200 via-amber-300 to-fuchsia-700',
    badge: 'bg-gradient-to-r from-amber-300 to-fuchsia-500 text-black',
  },
};

export default function HighRollerCasino() {
  const navigate = useNavigate();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadAll();
  }, []);

  async function loadAll() {
    try {
      const tiersRes = await fetch(`${API_URL}/api/high-roller/tiers`);
      const tiersJson = await tiersRes.json();
      setTiers(tiersJson.tiers || []);

      const token = localStorage.getItem('auth_token');
      if (!token) return;
      const meRes = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!meRes.ok) return;
      const me = await meRes.json();
      const uid = me.user_id || me.id || me._id;
      if (!uid) return;
      const elRes = await fetch(`${API_URL}/api/high-roller/eligibility/${uid}`);
      const elJson = await elRes.json();
      setEligibility({ ...elJson, user_id: uid });
    } catch (e: any) {
      setError(e?.message || 'Failed to load High Roller data');
    }
  }

  async function upgrade(tier: string) {
    setBusy(tier);
    setError(null);
    try {
      const token = localStorage.getItem('auth_token');
      const meRes = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const me = await meRes.json();
      const uid = me.user_id || me.id || me._id;

      const res = await fetch(`${API_URL}/api/high-roller/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: uid,
          tier,
          return_url: `${window.location.origin}/casino/high-roller`,
        }),
      });
      const json = await res.json();
      if (json.checkout_url) {
        window.location.href = json.checkout_url;
      } else {
        setError('Checkout link not returned');
      }
    } catch (e: any) {
      setError(e?.message || 'Upgrade failed');
    } finally {
      setBusy(null);
    }
  }

  const isVip = !!eligibility?.is_vip;
  const daysLeft = eligibility?.vip_until
    ? Math.max(0, Math.ceil((new Date(eligibility.vip_until).getTime() - Date.now()) / 86_400_000))
    : 0;

  return (
    <div
      data-testid="high-roller-page"
      className="min-h-screen bg-[#07050a] text-white relative overflow-hidden"
    >
      {/* Ambient gold/emerald radial wash */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-amber-500/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.04),transparent_60%)]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-5 py-8">
        <BackButton to="/dashboard" label="Back to Galaxy" />

        {/* Hero */}
        <header className="mt-6 mb-14">
          <div className="flex items-center gap-3 mb-3">
            <Crown className="w-7 h-7 text-amber-300" />
            <span className="uppercase tracking-[0.35em] text-xs text-amber-200/80">
              Global Vibez · VIP Tier
            </span>
          </div>
          <h1
            data-testid="high-roller-hero-title"
            className="text-4xl sm:text-5xl lg:text-6xl font-light leading-[1.05]"
          >
            <span className="block text-white/95">High Roller</span>
            <span
              className="block bg-gradient-to-r from-amber-200 via-amber-400 to-emerald-300 bg-clip-text text-transparent"
            >
              Private Tables.
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-white/70 text-base">
            A private casino floor with a <span className="text-amber-300">₵10,000 minimum bet</span>,
            concierge dealers, and tables reserved for members. Pick a 30-day VIP window.
          </p>

          {/* Status strip */}
          <div className="mt-7 flex flex-wrap gap-3 items-center">
            {isVip ? (
              <div
                data-testid="high-roller-active-vip"
                className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/40 px-4 py-2 text-emerald-200"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm">
                  VIP · {eligibility?.tier?.toUpperCase() ?? 'ACTIVE'} · {daysLeft} day
                  {daysLeft === 1 ? '' : 's'} left
                </span>
              </div>
            ) : (
              <div
                data-testid="high-roller-not-vip"
                className="inline-flex items-center gap-2 rounded-full bg-white/5 ring-1 ring-white/10 px-4 py-2 text-white/70"
              >
                <Lock className="w-4 h-4" />
                <span className="text-sm">Not yet VIP — pick a tier below.</span>
              </div>
            )}
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 ring-1 ring-amber-400/30 px-4 py-2 text-amber-200">
              <Diamond className="w-4 h-4" />
              <span className="text-sm">Min bet · ₵{(eligibility?.min_bet ?? 10000).toLocaleString()}</span>
            </div>
          </div>
        </header>

        {error && (
          <div
            data-testid="high-roller-error"
            className="mb-8 rounded-lg bg-red-500/10 ring-1 ring-red-400/40 text-red-200 px-4 py-3 text-sm"
          >
            {error}
          </div>
        )}

        {/* VIP Lounge — only when active */}
        {isVip && (
          <section className="mb-16" data-testid="high-roller-lounge">
            <h2 className="text-lg md:text-lg font-medium text-white/85 mb-4">
              Your VIP Lounge
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <button
                data-testid="high-roller-enter-blackjack"
                onClick={() => navigate('/casino/high-roller/blackjack')}
                className={`group text-left rounded-2xl p-7 bg-gradient-to-br from-[#0f0a1d] to-[#0c1810] ring-1 ring-emerald-400/30 hover:ring-amber-300/60 transition-all ${TIER_THEME[eligibility?.tier || 'genius'].glow}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs uppercase tracking-widest text-amber-200/80">VIP Blackjack</span>
                  <ArrowRight className="w-5 h-5 text-amber-200 group-hover:translate-x-1 transition-transform" />
                </div>
                <h3 className="text-2xl font-light text-white">Private Table · 8-Deck Shoe</h3>
                <p className="mt-3 text-white/60 text-sm">₵10,000 minimum. Concierge dealer.</p>
              </button>

              <button
                data-testid="high-roller-enter-roulette"
                onClick={() => navigate('/casino/high-roller/roulette')}
                className={`group text-left rounded-2xl p-7 bg-gradient-to-br from-[#1a0a0a] to-[#0c0a18] ring-1 ring-rose-400/30 hover:ring-amber-300/60 transition-all`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs uppercase tracking-widest text-amber-200/80">VIP Roulette</span>
                  <ArrowRight className="w-5 h-5 text-amber-200 group-hover:translate-x-1 transition-transform" />
                </div>
                <h3 className="text-2xl font-light text-white">European Wheel · 0-36</h3>
                <p className="mt-3 text-white/60 text-sm">Provably-fair HMAC-SHA512. 35:1 on straights.</p>
              </button>

              <button
                data-testid="high-roller-enter-baccarat"
                onClick={() => navigate('/casino/high-roller/baccarat')}
                className={`group text-left rounded-2xl p-7 bg-gradient-to-br from-[#15071a] to-[#0c0a14] ring-1 ring-fuchsia-400/30 hover:ring-amber-300/60 transition-all`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs uppercase tracking-widest text-amber-200/80">VIP Baccarat</span>
                  <ArrowRight className="w-5 h-5 text-amber-200 group-hover:translate-x-1 transition-transform" />
                </div>
                <h3 className="text-2xl font-light text-white">Punto Banco · 8-Deck</h3>
                <p className="mt-3 text-white/60 text-sm">Player 2× · Banker 1.95× · Tie 9×.</p>
              </button>
            </div>
          </section>
        )}

        {/* Tier upgrade grid */}
        <section data-testid="high-roller-tiers" className="mb-12">
          <h2 className="text-lg md:text-lg font-medium text-white/85 mb-6">
            {isVip ? 'Renew or Upgrade' : 'Pick your VIP tier'}
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {tiers.map((t, idx) => {
              const theme = TIER_THEME[t.tier];
              return (
                <motion.div
                  key={t.tier}
                  data-testid={`high-roller-tier-${t.tier}`}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.08, duration: 0.5 }}
                  className={`relative rounded-2xl p-7 bg-gradient-to-br from-[#0c0a14] to-[#100a05] ring-1 ${theme.ring} ${theme.glow}`}
                >
                  <div
                    className={`w-12 h-12 rounded-full bg-gradient-to-br ${theme.chip} mb-5 shadow-inner flex items-center justify-center`}
                  >
                    <Crown className="w-6 h-6 text-black/80" />
                  </div>
                  <div className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full font-semibold mb-3 ${theme.badge}`}>
                    {t.label}
                  </div>
                  <div className="flex items-baseline gap-1.5 mb-2">
                    <span className="text-3xl font-light text-white">${t.price_usd}</span>
                    <span className="text-white/50 text-sm">/ {t.duration_days} days</span>
                  </div>
                  <p className="text-white/65 text-sm mb-5 min-h-[2.5rem]">{t.tagline}</p>
                  <ul className="space-y-2 mb-6 text-sm text-white/75">
                    {t.perks.map((p) => (
                      <li key={p} className="flex gap-2">
                        <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-300 flex-shrink-0" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    data-testid={`high-roller-upgrade-${t.tier}-btn`}
                    onClick={() => upgrade(t.tier)}
                    disabled={busy === t.tier}
                    className={`w-full rounded-full py-3 font-semibold bg-gradient-to-r ${theme.chip} text-black hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-60`}
                  >
                    {busy === t.tier
                      ? 'Opening Stripe…'
                      : isVip
                      ? `Renew · $${t.price_usd}`
                      : `Unlock · $${t.price_usd}`}
                  </button>
                </motion.div>
              );
            })}
          </div>
          <p className="mt-6 text-xs text-white/40">
            Payments processed by Stripe. VIP window starts immediately on successful payment.
          </p>
        </section>
      </div>
    </div>
  );
}

/**
 * High Roller VIP Blackjack — gated 8-deck shoe Blackjack with a
 * ₵10,000 minimum bet. Calls the dedicated `/api/high-roller/blackjack/*`
 * endpoints so the standard 50-coin Blackjack route is untouched.
 *
 * Premium chrome: obsidian background, amber/emerald accents, animated
 * chip stack, concierge dealer welcome line.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Crown, Diamond, Lock, ArrowRight } from 'lucide-react';
import BackButton from '@/components/BackButton';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const MIN_BET = 10_000;

type Card = { rank: string; suit: string };
type DealResp = {
  session_id: string;
  player_cards: Card[];
  dealer_cards: Card[];
  player_value: number;
  dealer_value: number;
  game_over?: boolean;
  vip?: boolean;
  result?: string;
  payout?: number;
};

function CardChip({ c }: { c: Card }) {
  const isRed = c.suit === 'hearts' || c.suit === 'diamonds';
  const suit = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }[c.suit] || '♠';
  return (
    <motion.div
      initial={{ opacity: 0, y: -20, rotateZ: -8 }}
      animate={{ opacity: 1, y: 0, rotateZ: 0 }}
      className={`w-16 h-24 rounded-lg bg-white shadow-2xl border-2 border-amber-300/40 flex flex-col items-center justify-center font-semibold ${isRed ? 'text-red-600' : 'text-slate-900'}`}
    >
      <div className="text-xl">{c.rank}</div>
      <div className="text-2xl leading-none">{suit}</div>
    </motion.div>
  );
}

export default function HighRollerBlackjack() {
  const navigate = useNavigate();
  const [eligibility, setEligibility] = useState<{ is_vip: boolean; tier: string | null } | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [bet, setBet] = useState<number>(MIN_BET);
  const [session, setSession] = useState<DealResp | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void check();
  }, []);

  async function check() {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      navigate('/login');
      return;
    }
    const me = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json()).catch(() => null);
    if (!me) {
      navigate('/login');
      return;
    }
    const uid = me.user_id || me.id || me._id;
    setUserId(uid);
    const el = await fetch(`${API_URL}/api/high-roller/eligibility/${uid}`).then((r) => r.json());
    setEligibility(el);
  }

  async function deal() {
    if (!userId) return;
    if (bet < MIN_BET) {
      setError(`Minimum bet at this table is ₵${MIN_BET.toLocaleString()}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/high-roller/blackjack/deal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, bet_amount: bet }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err?.detail?.message || err?.detail || 'Deal failed');
        return;
      }
      const data: DealResp = await res.json();
      setSession(data);
    } finally {
      setBusy(false);
    }
  }

  async function act(action: 'hit' | 'stand' | 'double') {
    if (!session?.session_id) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/high-roller/blackjack/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, session_id: session.session_id, action }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err?.detail?.message || err?.detail || 'Action failed');
        return;
      }
      const data: DealResp = await res.json();
      setSession({ ...session, ...data });
    } finally {
      setBusy(false);
    }
  }

  const dealerLine = useMemo(() => {
    const tier = eligibility?.tier;
    if (tier === 'apex') return 'Welcome back to the private floor. Tonight\'s shoe is fresh.';
    if (tier === 'genesis') return 'Pleasure to see you. Shall we begin?';
    return 'Welcome to the High Roller table.';
  }, [eligibility?.tier]);

  // Locked-out state
  if (eligibility && !eligibility.is_vip) {
    return (
      <div className="min-h-screen bg-[#07050a] text-white">
        <div className="max-w-3xl mx-auto px-5 py-12">
          <BackButton to="/casino/high-roller" label="Back" />
          <div
            data-testid="vip-blackjack-locked"
            className="mt-10 rounded-2xl p-10 bg-gradient-to-br from-[#0c0a14] to-[#100a05] ring-1 ring-amber-300/30 text-center"
          >
            <Lock className="w-10 h-10 mx-auto text-amber-300 mb-4" />
            <h1 className="text-3xl font-light mb-3">VIP Membership Required</h1>
            <p className="text-white/70 mb-6">
              The High Roller table is reserved for active VIP members. Unlock a 30-day window from $49.
            </p>
            <button
              data-testid="vip-blackjack-upgrade-cta"
              onClick={() => navigate('/casino/high-roller')}
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 bg-gradient-to-r from-amber-300 to-emerald-300 text-black font-semibold"
            >
              Upgrade <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="vip-blackjack-page" className="min-h-screen bg-[#07050a] text-white relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[-15%] left-1/2 -translate-x-1/2 w-[80%] h-[60%] rounded-full bg-emerald-700/20 blur-[140px]" />
        <div className="absolute bottom-[-25%] right-[-10%] w-[60%] h-[60%] rounded-full bg-amber-500/10 blur-[130px]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-5 py-8">
        <BackButton to="/casino/high-roller" label="Back to VIP Lounge" />

        <header className="mt-6 mb-8 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-5 h-5 text-amber-300" />
              <span className="uppercase tracking-[0.3em] text-xs text-amber-200/80">
                VIP · {eligibility?.tier?.toUpperCase() || 'ACTIVE'}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-light">High Roller Blackjack</h1>
            <p className="text-white/60 mt-2 text-sm italic">"{dealerLine}"</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 ring-1 ring-amber-400/30 px-4 py-2 text-amber-200">
            <Diamond className="w-4 h-4" />
            <span className="text-sm">Min ₵{MIN_BET.toLocaleString()}</span>
          </div>
        </header>

        {error && (
          <div data-testid="vip-blackjack-error" className="mb-6 rounded-lg bg-red-500/10 ring-1 ring-red-400/40 text-red-200 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Table felt */}
        <div className="rounded-3xl p-8 bg-gradient-to-br from-[#0a1310] via-[#0a1814] to-[#0a0f1a] ring-1 ring-emerald-500/20 shadow-[0_30px_120px_-30px_rgba(16,185,129,0.4)]">
          {/* Dealer */}
          <div className="mb-10">
            <div className="text-xs uppercase tracking-widest text-emerald-300/80 mb-3">Dealer</div>
            <div className="flex gap-2 min-h-[6rem]">
              {(session?.dealer_cards || []).map((c, i) => (
                <CardChip key={`d${i}`} c={c} />
              ))}
              {!session && <div className="text-white/30 text-sm italic">Awaiting your bet…</div>}
            </div>
            {session?.dealer_value !== undefined && (
              <div className="text-white/70 text-sm mt-2">Value: {session.dealer_value}</div>
            )}
          </div>

          {/* Player */}
          <div className="mb-6">
            <div className="text-xs uppercase tracking-widest text-amber-300/80 mb-3">You</div>
            <div className="flex gap-2 min-h-[6rem]">
              {(session?.player_cards || []).map((c, i) => (
                <CardChip key={`p${i}`} c={c} />
              ))}
            </div>
            {session?.player_value !== undefined && (
              <div className="text-white/70 text-sm mt-2">Value: {session.player_value}</div>
            )}
          </div>

          {/* Result */}
          {session?.game_over && session?.result && (
            <div
              data-testid="vip-blackjack-result"
              className="rounded-xl px-5 py-4 bg-gradient-to-r from-amber-500/20 to-emerald-500/20 ring-1 ring-amber-300/40 text-amber-100 mb-6 text-center font-semibold"
            >
              {session.result.toUpperCase()} · Payout ₵{(session.payout || 0).toLocaleString()}
            </div>
          )}

          {/* Controls */}
          {!session || session.game_over ? (
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm text-white/70">Bet (₵)</label>
              <input
                data-testid="vip-blackjack-bet-input"
                type="number"
                min={MIN_BET}
                step={1000}
                value={bet}
                onChange={(e) => setBet(parseInt(e.target.value || `${MIN_BET}`, 10))}
                className="bg-black/40 ring-1 ring-amber-300/30 rounded-lg px-3 py-2 text-amber-100 w-40"
              />
              <button
                data-testid="vip-blackjack-deal-btn"
                disabled={busy}
                onClick={deal}
                className="rounded-full px-6 py-2.5 bg-gradient-to-r from-amber-300 to-emerald-300 text-black font-semibold disabled:opacity-60"
              >
                {busy ? 'Dealing…' : session?.game_over ? 'Deal again' : 'Deal'}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              <button
                data-testid="vip-blackjack-hit-btn"
                disabled={busy}
                onClick={() => act('hit')}
                className="rounded-full px-6 py-2.5 bg-white/10 ring-1 ring-white/20 hover:bg-white/15 transition-colors"
              >
                Hit
              </button>
              <button
                data-testid="vip-blackjack-stand-btn"
                disabled={busy}
                onClick={() => act('stand')}
                className="rounded-full px-6 py-2.5 bg-amber-400 text-black font-semibold"
              >
                Stand
              </button>
              <button
                data-testid="vip-blackjack-double-btn"
                disabled={busy}
                onClick={() => act('double')}
                className="rounded-full px-6 py-2.5 bg-emerald-400 text-black font-semibold"
              >
                Double
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * High Roller VIP Roulette — European 0-36 wheel, ₵10k minimum stake
 * across all chips in a round. Provably-fair HMAC-SHA512 wheel.
 *
 * Bet types: red/black, odd/even, low/high, dozens 1-3, straight 0-36.
 * Place multiple chips, hit Spin, settle in one server round-trip.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Crown, Diamond, Lock, ArrowRight, RotateCw } from 'lucide-react';
import BackButton from '@/components/BackButton';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const MIN_BET = 10_000;

type Bet = { bet_type: string; bet_amount: number; bet_value?: number };

type SpinResp = {
  winning_number: number;
  color: 'red' | 'black' | 'green';
  bets: Array<{ bet_type: string; bet_value?: number; bet_amount: number; won: boolean; payout: number; multiplier: number }>;
  total_stake: number;
  total_payout: number;
  net: number;
};

const BET_OPTIONS: Array<{ key: string; label: string; theme: string }> = [
  { key: 'red', label: 'Red', theme: 'from-red-500 to-rose-700' },
  { key: 'black', label: 'Black', theme: 'from-slate-700 to-black' },
  { key: 'odd', label: 'Odd', theme: 'from-amber-400 to-amber-700' },
  { key: 'even', label: 'Even', theme: 'from-emerald-400 to-emerald-700' },
  { key: 'low', label: '1-18', theme: 'from-cyan-400 to-cyan-700' },
  { key: 'high', label: '19-36', theme: 'from-fuchsia-400 to-fuchsia-700' },
  { key: 'dozen1', label: '1st 12', theme: 'from-violet-400 to-violet-700' },
  { key: 'dozen2', label: '2nd 12', theme: 'from-pink-400 to-pink-700' },
  { key: 'dozen3', label: '3rd 12', theme: 'from-teal-400 to-teal-700' },
];

export default function HighRollerRoulette() {
  const navigate = useNavigate();
  const [eligibility, setEligibility] = useState<{ is_vip: boolean; tier: string | null } | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [stake, setStake] = useState<number>(MIN_BET);
  const [bets, setBets] = useState<Bet[]>([]);
  const [result, setResult] = useState<SpinResp | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void check(); }, []);

  async function check() {
    const token = localStorage.getItem('auth_token');
    if (!token) { navigate('/login'); return; }
    const me = await fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).catch(() => null);
    if (!me) { navigate('/login'); return; }
    const uid = me.user_id || me.id || me._id;
    setUserId(uid);
    const el = await fetch(`${API_URL}/api/high-roller/eligibility/${uid}`).then((r) => r.json());
    setEligibility(el);
  }

  function placeBet(bet_type: string) {
    setError(null);
    setBets((prev) => [...prev, { bet_type, bet_amount: stake }]);
  }

  function clearBets() { setBets([]); setResult(null); }

  async function spin() {
    if (!userId) return;
    if (bets.length === 0) { setError('Place at least one chip first.'); return; }
    const total = bets.reduce((s, b) => s + b.bet_amount, 0);
    if (total < MIN_BET) {
      setError(`Total stake ₵${total.toLocaleString()} below VIP minimum ₵${MIN_BET.toLocaleString()}.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const client_seed = `client-${Date.now()}`;
      const res = await fetch(`${API_URL}/api/high-roller/roulette/spin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, client_seed, bets }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err?.detail?.message || err?.detail || 'Spin failed');
        return;
      }
      const data: SpinResp = await res.json();
      setResult(data);
    } finally {
      setBusy(false);
    }
  }

  const totalStake = useMemo(() => bets.reduce((s, b) => s + b.bet_amount, 0), [bets]);

  // Non-VIP fallback
  if (eligibility && !eligibility.is_vip) {
    return (
      <div className="min-h-screen bg-[#07050a] text-white">
        <div className="max-w-3xl mx-auto px-5 py-12">
          <BackButton to="/casino/high-roller" label="Back" />
          <div
            data-testid="vip-roulette-locked"
            className="mt-10 rounded-2xl p-10 bg-gradient-to-br from-[#0c0a14] to-[#100a05] ring-1 ring-amber-300/30 text-center"
          >
            <Lock className="w-10 h-10 mx-auto text-amber-300 mb-4" />
            <h1 className="text-3xl font-light mb-3">VIP Membership Required</h1>
            <p className="text-white/70 mb-6">
              The European Roulette wheel is reserved for active VIP members.
            </p>
            <button
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
    <div data-testid="vip-roulette-page" className="min-h-screen bg-[#07050a] text-white relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[-15%] left-1/2 -translate-x-1/2 w-[80%] h-[60%] rounded-full bg-rose-700/15 blur-[140px]" />
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
            <h1 className="text-3xl sm:text-4xl font-light">European Roulette</h1>
            <p className="text-white/60 mt-2 text-sm italic">"Place your wager. The wheel decides."</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 ring-1 ring-amber-400/30 px-4 py-2 text-amber-200">
            <Diamond className="w-4 h-4" />
            <span className="text-sm">Min total ₵{MIN_BET.toLocaleString()}</span>
          </div>
        </header>

        {error && (
          <div data-testid="vip-roulette-error" className="mb-6 rounded-lg bg-red-500/10 ring-1 ring-red-400/40 text-red-200 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {result && (
          <motion.div
            data-testid="vip-roulette-result"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`mb-6 rounded-2xl p-6 ring-1 ${result.color === 'red' ? 'bg-red-500/15 ring-red-400/40' : result.color === 'black' ? 'bg-slate-700/30 ring-slate-300/40' : 'bg-emerald-500/15 ring-emerald-400/40'} text-center`}
          >
            <div className="text-xs uppercase tracking-widest text-white/60 mb-1">Winning</div>
            <div className="text-6xl font-light">{result.winning_number}</div>
            <div className="text-sm mt-1 uppercase tracking-wide">{result.color}</div>
            <div className={`mt-3 inline-block px-4 py-1.5 rounded-full text-sm font-semibold ${result.net >= 0 ? 'bg-emerald-400 text-black' : 'bg-red-500/30 text-red-100'}`}>
              {result.net >= 0 ? `+ ₵${result.net.toLocaleString()}` : `− ₵${Math.abs(result.net).toLocaleString()}`}
            </div>
          </motion.div>
        )}

        {/* Table */}
        <div className="rounded-3xl p-7 bg-gradient-to-br from-[#0a1310] via-[#0a1814] to-[#0a0f1a] ring-1 ring-emerald-500/20 shadow-[0_30px_120px_-30px_rgba(16,185,129,0.4)]">
          <div className="text-xs uppercase tracking-widest text-emerald-300/80 mb-4">Place your bets</div>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {BET_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                data-testid={`vip-roulette-bet-${opt.key}`}
                onClick={() => placeBet(opt.key)}
                disabled={busy}
                className={`rounded-xl py-4 px-3 bg-gradient-to-br ${opt.theme} text-white font-semibold shadow-lg hover:scale-[1.03] active:scale-[0.97] transition-transform disabled:opacity-50`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-6">
            <label className="text-sm text-white/70">Chip (₵)</label>
            <input
              data-testid="vip-roulette-chip-input"
              type="number"
              min={1000}
              step={1000}
              value={stake}
              onChange={(e) => setStake(parseInt(e.target.value || '1000', 10))}
              className="bg-black/40 ring-1 ring-amber-300/30 rounded-lg px-3 py-2 text-amber-100 w-32"
            />
            <div className="text-sm text-white/60 flex-1">
              Chips placed: <span className="text-amber-200 font-semibold">{bets.length}</span>
              {' · '}
              Total stake: <span className="text-amber-200 font-semibold">₵{totalStake.toLocaleString()}</span>
            </div>
          </div>

          {bets.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {bets.map((b, i) => (
                <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-white/8 ring-1 ring-white/15">
                  {b.bet_type} · ₵{b.bet_amount.toLocaleString()}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              data-testid="vip-roulette-spin-btn"
              disabled={busy || bets.length === 0}
              onClick={spin}
              className="rounded-full px-7 py-3 bg-gradient-to-r from-amber-300 to-emerald-300 text-black font-semibold disabled:opacity-50 flex items-center gap-2"
            >
              <RotateCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
              {busy ? 'Spinning…' : 'Spin Wheel'}
            </button>
            <button
              data-testid="vip-roulette-clear-btn"
              onClick={clearBets}
              disabled={busy}
              className="rounded-full px-6 py-3 bg-white/10 ring-1 ring-white/20 hover:bg-white/15"
            >
              Clear table
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

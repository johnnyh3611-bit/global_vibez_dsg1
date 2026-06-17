/**
 * High Roller VIP Baccarat — Vegas-rules Player/Banker/Tie at ₵10k min.
 * Banker pays 1.95× (5% house commission), Player 2×, Tie 9×.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Crown, Diamond, Lock, ArrowRight } from 'lucide-react';
import BackButton from '@/components/BackButton';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const MIN_BET = 10_000;

type Hand = Array<{ rank: string; suit: string }>;
type PlayResp = {
  player_hand: Hand; banker_hand: Hand;
  player_score: number; banker_score: number;
  winner: 'player' | 'banker' | 'tie';
  bet_type: string; bet_amount: number; payout: number; net: number;
};

function CardChip({ c, idx }: { c: { rank: string; suit: string }; idx: number }) {
  const isRed = c.suit === 'hearts' || c.suit === 'diamonds';
  const suit = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }[c.suit] || '♠';
  return (
    <motion.div
      initial={{ opacity: 0, y: -20, rotateZ: -8 }}
      animate={{ opacity: 1, y: 0, rotateZ: 0 }}
      transition={{ delay: idx * 0.12 }}
      className={`w-14 h-20 rounded-lg bg-white shadow-2xl border-2 border-amber-300/40 flex flex-col items-center justify-center font-semibold ${isRed ? 'text-red-600' : 'text-slate-900'}`}
    >
      <div className="text-base">{c.rank}</div>
      <div className="text-xl leading-none">{suit}</div>
    </motion.div>
  );
}

export default function HighRollerBaccarat() {
  const navigate = useNavigate();
  const [eligibility, setEligibility] = useState<{ is_vip: boolean; tier: string | null } | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [bet, setBet] = useState<number>(MIN_BET);
  const [betType, setBetType] = useState<'player' | 'banker' | 'tie'>('player');
  const [result, setResult] = useState<PlayResp | null>(null);
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

  async function play() {
    if (!userId) return;
    if (bet < MIN_BET) { setError(`Minimum ₵${MIN_BET.toLocaleString()}`); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${API_URL}/api/high-roller/baccarat/play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, bet_type: betType, bet_amount: bet }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err?.detail?.message || err?.detail || 'Play failed');
        return;
      }
      const data: PlayResp = await res.json();
      setResult(data);
    } finally {
      setBusy(false);
    }
  }

  if (eligibility && !eligibility.is_vip) {
    return (
      <div className="min-h-screen bg-[#07050a] text-white">
        <div className="max-w-3xl mx-auto px-5 py-12">
          <BackButton to="/casino/high-roller" label="Back" />
          <div data-testid="vip-baccarat-locked" className="mt-10 rounded-2xl p-10 bg-gradient-to-br from-[#0c0a14] to-[#100a05] ring-1 ring-amber-300/30 text-center">
            <Lock className="w-10 h-10 mx-auto text-amber-300 mb-4" />
            <h1 className="text-3xl font-light mb-3">VIP Membership Required</h1>
            <p className="text-white/70 mb-6">Baccarat at the High Roller table is reserved for VIP members.</p>
            <button onClick={() => navigate('/casino/high-roller')} className="inline-flex items-center gap-2 rounded-full px-6 py-3 bg-gradient-to-r from-amber-300 to-emerald-300 text-black font-semibold">
              Upgrade <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="vip-baccarat-page" className="min-h-screen bg-[#07050a] text-white relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[-15%] left-1/2 -translate-x-1/2 w-[80%] h-[60%] rounded-full bg-fuchsia-700/15 blur-[140px]" />
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
            <h1 className="text-3xl sm:text-4xl font-light">Punto Banco · Baccarat</h1>
            <p className="text-white/60 mt-2 text-sm italic">"Player. Banker. Or tie. Pick your side."</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 ring-1 ring-amber-400/30 px-4 py-2 text-amber-200">
            <Diamond className="w-4 h-4" />
            <span className="text-sm">Min ₵{MIN_BET.toLocaleString()}</span>
          </div>
        </header>

        {error && <div data-testid="vip-baccarat-error" className="mb-6 rounded-lg bg-red-500/10 ring-1 ring-red-400/40 text-red-200 px-4 py-3 text-sm">{error}</div>}

        <div className="rounded-3xl p-7 bg-gradient-to-br from-[#0a1310] via-[#0a1814] to-[#0a0f1a] ring-1 ring-emerald-500/20 shadow-[0_30px_120px_-30px_rgba(16,185,129,0.4)]">
          <div className="grid sm:grid-cols-2 gap-7 mb-8">
            <div>
              <div className="text-xs uppercase tracking-widest text-cyan-300/80 mb-3">Player</div>
              <div className="flex gap-2 min-h-[5rem]">
                {(result?.player_hand || []).map((c, i) => <CardChip key={`p${i}`} c={c} idx={i} />)}
                {!result && <div className="text-white/30 text-sm italic">—</div>}
              </div>
              {result && <div className="text-white/70 text-sm mt-2">Score: {result.player_score}</div>}
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-amber-300/80 mb-3">Banker</div>
              <div className="flex gap-2 min-h-[5rem]">
                {(result?.banker_hand || []).map((c, i) => <CardChip key={`b${i}`} c={c} idx={i} />)}
                {!result && <div className="text-white/30 text-sm italic">—</div>}
              </div>
              {result && <div className="text-white/70 text-sm mt-2">Score: {result.banker_score}</div>}
            </div>
          </div>

          {result && (
            <motion.div
              data-testid="vip-baccarat-result"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mb-6 rounded-xl px-5 py-4 text-center font-semibold ring-1 ${result.net >= 0 ? 'bg-emerald-500/15 ring-emerald-400/40 text-emerald-100' : 'bg-red-500/10 ring-red-400/40 text-red-100'}`}
            >
              Winner: {result.winner.toUpperCase()} · {result.net >= 0 ? `+ ₵${result.net.toLocaleString()}` : `− ₵${Math.abs(result.net).toLocaleString()}`}
            </motion.div>
          )}

          <div className="text-xs uppercase tracking-widest text-emerald-300/80 mb-3">Place your bet</div>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {(['player', 'banker', 'tie'] as const).map((t) => (
              <button
                key={t}
                data-testid={`vip-baccarat-bet-${t}`}
                onClick={() => setBetType(t)}
                disabled={busy}
                className={`rounded-xl py-4 font-semibold transition-all ${betType === t ? 'bg-gradient-to-br from-amber-300 to-emerald-300 text-black scale-[1.02] shadow-lg' : 'bg-white/8 ring-1 ring-white/15 text-white/80 hover:bg-white/12'}`}
              >
                {t.toUpperCase()}
                <div className="text-[10px] mt-0.5 opacity-80">
                  {t === 'player' && '2:1'}
                  {t === 'banker' && '1.95:1'}
                  {t === 'tie' && '9:1'}
                </div>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-white/70">Bet (₵)</label>
            <input
              data-testid="vip-baccarat-bet-input"
              type="number"
              min={MIN_BET}
              step={1000}
              value={bet}
              onChange={(e) => setBet(parseInt(e.target.value || `${MIN_BET}`, 10))}
              className="bg-black/40 ring-1 ring-amber-300/30 rounded-lg px-3 py-2 text-amber-100 w-40"
            />
            <button
              data-testid="vip-baccarat-deal-btn"
              disabled={busy}
              onClick={play}
              className="rounded-full px-6 py-2.5 bg-gradient-to-r from-amber-300 to-emerald-300 text-black font-semibold disabled:opacity-60"
            >
              {busy ? 'Dealing…' : result ? 'Deal again' : 'Deal'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

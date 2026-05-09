/**
 * VibezRewardsHistory — wallet panel for the $VIBEZ formula.
 * Roadmap PDF §1: shows users exactly how their R_total was computed
 * (B_base × M_multiplier + T_bonus + chair_boost).
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Coins, ShieldCheck } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

interface Reward {
  reward_id: string;
  game: string;
  breakdown: { B_base: number; M_term: number; T_bonus: number; chair_boost: number; R_total: number; multiplier: number; minutes: number };
  chair_owned: boolean;
  mint_status: string;
  tx_hash: string;
  created_at: string;
}

export default function VibezRewardsHistory() {
  const navigate = useNavigate();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [mintMode, setMintMode] = useState('SIMULATED');

  useEffect(() => {
    const t = localStorage.getItem('auth_token');
    const uid = localStorage.getItem('user_id');
    if (!t || !uid) return;
    fetch(`${API}/api/vibez-rewards/constants`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setMintMode(d.mint_mode));
    fetch(`${API}/api/vibez-rewards/history/${uid}?limit=50`, {
      headers: { Authorization: `Bearer ${t}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setRewards(d.rewards || []));
  }, []);

  const total = rewards.reduce((s, r) => s + r.breakdown.R_total, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-amber-950/20 to-black text-white">
      <div className="sticky top-0 z-30 bg-black/70 backdrop-blur-md border-b border-amber-500/30 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} data-testid="vrh-back" className="p-2 rounded-lg hover:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-[0.4em] text-amber-300">$VIBEZ · Activity Multiplier</div>
          <div className="text-lg font-black bg-gradient-to-r from-amber-300 via-orange-300 to-yellow-200 bg-clip-text text-transparent">
            Reward History
          </div>
        </div>
        {mintMode === 'SIMULATED' && (
          <span className="text-[10px] uppercase font-bold text-amber-300/80">SIMULATED</span>
        )}
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-amber-500/10 border border-amber-400/40 p-5 text-center"
          data-testid="vrh-total"
        >
          <div className="text-[10px] uppercase tracking-widest text-amber-300/80">Lifetime $VIBEZ Earned</div>
          <div className="text-4xl sm:text-5xl font-black font-mono text-amber-200 mt-1">{total.toFixed(2)}</div>
          <div className="text-xs text-white/60 mt-1">R_total = (B_base × M) + T_bonus + chair_boost</div>
        </motion.div>

        <div data-testid="vrh-list" className="space-y-2">
          {rewards.length === 0 ? (
            <div className="text-center text-white/50 py-10">
              <Coins className="w-10 h-10 mx-auto mb-2 opacity-40" />
              No rewards yet — finish a Spades, Vibe Dice or Chess match to earn $VIBEZ.
            </div>
          ) : rewards.map((r) => (
            <motion.div
              key={r.reward_id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              data-testid={`vrh-row-${r.reward_id}`}
              className="rounded-xl bg-stone-900/60 border border-amber-500/20 p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-black uppercase text-amber-200">{r.game}</div>
                  <div className="text-[10px] text-white/40 font-mono">{r.tx_hash.slice(0, 18)}…</div>
                </div>
                <div className="font-mono font-black text-amber-300 text-xl">+{r.breakdown.R_total.toFixed(2)}</div>
              </div>
              <div className="grid grid-cols-4 gap-1 text-center text-[10px]">
                <div className="rounded p-1 bg-cyan-500/10">B_base<br /><span className="text-cyan-300 font-mono font-bold">{r.breakdown.B_base.toFixed(2)}</span></div>
                <div className="rounded p-1 bg-fuchsia-500/10">×{r.breakdown.multiplier}<br /><span className="text-fuchsia-300 font-mono font-bold">{r.breakdown.M_term.toFixed(2)}</span></div>
                <div className="rounded p-1 bg-emerald-500/10">T_bonus<br /><span className="text-emerald-300 font-mono font-bold">{r.breakdown.T_bonus.toFixed(2)}</span></div>
                <div className={`rounded p-1 ${r.chair_owned ? 'bg-amber-500/15' : 'bg-white/5'}`}>
                  Chair<br /><span className={`font-mono font-bold ${r.chair_owned ? 'text-amber-300' : 'text-white/30'}`}>+{r.breakdown.chair_boost.toFixed(2)}</span>
                </div>
              </div>
              {r.chair_owned && (
                <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-200">
                  <ShieldCheck className="w-3 h-3" /> Seated Ownership +10%
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

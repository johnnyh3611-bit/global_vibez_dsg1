/**
 * BlindAuctionDating — Master Tech Blueprint §2 dating game show.
 *
 * 4 "Frost-Filtered" profiles up for blind auction. Suitors bid Vibe
 * Coins; viewers heckle from the gallery (5% mining kickback). After
 * the timer the highest bidder either:
 *  - matches the winner ⇒ Vault_Pool Loyalty Stake payout
 *  - mismatches        ⇒ auto_Bridge to Cinema Date room (synced movie)
 *
 * Each bid posts to the Streamer Action Hub as a `ROUTE_TIP` (since
 * it routes the game-show to its destination).
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Crown, Heart, Snowflake, Trophy, Film } from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

interface Suitor { id: string; alias: string; bid: number; synergy: number; }

const PROFILES = ['Mystery #1', 'Mystery #2', 'Mystery #3', 'Mystery #4'];

export default function BlindAuctionDating() {
  const navigate = useNavigate();
  const [suitors, setSuitors] = useState<Suitor[]>([
    { id: 's1', alias: 'NeonNomad',  bid: 0, synergy: 92 },
    { id: 's2', alias: 'PixelHeart', bid: 0, synergy: 87 },
    { id: 's3', alias: 'GildedFox',  bid: 0, synergy: 98 },
    { id: 's4', alias: 'MoonRover',  bid: 0, synergy: 81 },
  ]);
  const [secs, setSecs] = useState(60);
  const [resolved, setResolved] = useState<null | 'vault' | 'cinema'>(null);
  const [winner, setWinner] = useState<Suitor | null>(null);

  // Tick down the auction clock
  useEffect(() => {
    if (resolved) return;
    if (secs <= 0) {
      const top = [...suitors].sort((a, b) => b.bid - a.bid)[0];
      setWinner(top);
      // 98% synergy logic: top synergy gets the Vault_Pool, otherwise auto_Bridge
      const synergyWinner = [...suitors].sort((a, b) => b.synergy - a.synergy)[0];
      setResolved(top.id === synergyWinner.id ? 'vault' : 'cinema');
      return;
    }
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secs, resolved, suitors]);

  const placeBid = async (s: Suitor, amount: number) => {
    if (resolved) return;
    setSuitors((arr) => arr.map((x) => (x.id === s.id ? { ...x, bid: x.bid + amount } : x)));
    toast.success(`Bid +$${(amount / 100).toFixed(2)} on ${s.alias}`);
    try {
      const t = localStorage.getItem('auth_token');
      await fetch(`${API}/api/streamer-actions/tip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(t && { Authorization: `Bearer ${t}` }) },
        body: JSON.stringify({
          streamer_id: 'blind_auction',
          action_kind: 'ROUTE_TIP',
          amount_cents: amount,
          metadata: { game: 'blind_auction', suitor_id: s.id, alias: s.alias },
        }),
      });
    } catch {}
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-rose-950/30 to-black text-white">
      <div className="sticky top-0 z-30 bg-black/70 backdrop-blur-md border-b border-rose-500/30 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} data-testid="auction-back" className="p-2 rounded-lg hover:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-[0.4em] text-rose-300">Dating Universe · Blind Auction</div>
          <div className="text-lg font-black bg-gradient-to-r from-rose-300 via-pink-300 to-amber-300 bg-clip-text text-transparent">
            Game Show · Synergy-First
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-rose-200/70">Time</div>
          <div className="font-mono font-black text-rose-300 text-2xl" data-testid="auction-timer">{String(secs).padStart(2, '0')}s</div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5">
        <div className="grid sm:grid-cols-2 gap-3" data-testid="auction-grid">
          {suitors.map((s, i) => (
            <motion.div
              key={s.id}
              whileHover={{ y: -3 }}
              data-testid={`suitor-${s.id}`}
              className="rounded-2xl bg-stone-900/80 border-2 border-rose-500/30 p-4 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-cyan-400/5 backdrop-blur-md pointer-events-none" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 text-rose-200/70 text-[10px] uppercase tracking-widest mb-2">
                  <Snowflake className="w-3 h-3" /> Frost-Filtered · {PROFILES[i]}
                </div>
                <div className="text-lg font-black mb-1">{s.alias}</div>
                <div className="text-[10px] text-cyan-300 mb-3">{s.synergy}% synergy</div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-amber-300/70">Current Bid</div>
                    <div className="font-mono font-black text-amber-300 text-xl" data-testid={`bid-${s.id}`}>${(s.bid / 100).toFixed(2)}</div>
                  </div>
                  {winner?.id === s.id && resolved && (
                    <Crown className="w-6 h-6 text-amber-300 drop-shadow-lg" />
                  )}
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {[100, 500, 2500].map((amt) => (
                    <button
                      key={amt}
                      data-testid={`bid-${s.id}-${amt}`}
                      disabled={!!resolved}
                      onClick={() => placeBid(s, amt)}
                      className="px-2 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 border border-rose-400/40 text-xs font-bold disabled:opacity-30"
                    >
                      +${(amt / 100).toFixed(0)}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <AnimatePresence>
          {resolved && winner && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              data-testid="auction-resolved"
              className={`mt-6 p-6 rounded-3xl border-2 text-center ${resolved === 'vault' ? 'border-amber-400 bg-amber-500/15' : 'border-violet-400 bg-violet-500/15'}`}
            >
              {resolved === 'vault' ? (
                <>
                  <Trophy className="w-12 h-12 text-amber-300 mx-auto mb-2" />
                  <div className="text-2xl font-black text-amber-200">Vault Pool Released</div>
                  <div className="text-sm text-amber-100/80 mt-1">
                    {winner.alias} matched 98% Synergy — Loyalty Stake distributed.
                  </div>
                </>
              ) : (
                <>
                  <Film className="w-12 h-12 text-violet-300 mx-auto mb-2" />
                  <div className="text-2xl font-black text-violet-200">Auto-Bridge → Cinema Date Room</div>
                  <div className="text-sm text-violet-100/80 mt-1">
                    Highest bid didn't match top synergy. Synced movie date queued.
                  </div>
                  <button
                    onClick={() => navigate('/dsg/memory-bank')}
                    className="mt-3 px-5 py-2 rounded-xl bg-violet-500 hover:bg-violet-400 font-bold"
                  >
                    Enter Cinema Room
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

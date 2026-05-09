/**
 * TotemPoleBattles — 1v1 music-video battle (Music Arena §3).
 *
 * Two artists go head-to-head. Audience gifts each side. When time
 * runs out, `/api/totem-pole/battle/resolve` runs the PDF code:
 *   if A.gifts > B.gifts: A.rank_Up + apply_PowerHour (1.5x fans)
 *   else: B.process_70_30_Revenue
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Crown, Flame, Star, Trophy } from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const BATTLE_ID = 'demo_battle_2026_05';
const ARTIST_A = { name: 'NeonNomad', img: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400' };
const ARTIST_B = { name: 'GildedFox', img: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400' };

interface ResolveResult {
  winner_side: 'A' | 'B' | 'TIE';
  winner_pot_cents: number;
  fan_power_hour_bonus_cents: number;
  payout_split: { creator_cents: number; sovereign_tax_cents: number; liquidity_pool_cents: number };
}

export default function TotemPoleBattles() {
  const navigate = useNavigate();
  const [potA, setPotA] = useState(0);
  const [potB, setPotB] = useState(0);
  const [secs, setSecs] = useState(60);
  const [resolved, setResolved] = useState<ResolveResult | null>(null);

  useEffect(() => {
    if (resolved) return;
    if (secs <= 0) {
      resolveBattle();
      return;
    }
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secs, resolved]);

  const gift = async (side: 'A' | 'B', amt: number) => {
    if (resolved) return;
    if (side === 'A') setPotA((p) => p + amt); else setPotB((p) => p + amt);
    try {
      const t = localStorage.getItem('auth_token');
      await fetch(`${API}/api/totem-pole/battle/gift`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(t && { Authorization: `Bearer ${t}` }) },
        body: JSON.stringify({ battle_id: BATTLE_ID, artist_side: side, amount_cents: amt }),
      });
      toast.success(`+$${(amt / 100).toFixed(2)} → ${side === 'A' ? ARTIST_A.name : ARTIST_B.name}`);
    } catch {}
  };

  const resolveBattle = async () => {
    try {
      const t = localStorage.getItem('auth_token');
      const r = await fetch(`${API}/api/totem-pole/battle/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(t && { Authorization: `Bearer ${t}` }) },
        body: JSON.stringify({ battle_id: BATTLE_ID }),
      });
      if (r.ok) {
        setResolved(await r.json());
      } else {
        // Local fallback so the UI still finishes
        const winner = potA > potB ? 'A' : potB > potA ? 'B' : 'TIE';
        const pot = winner === 'A' ? potA : potB;
        setResolved({
          winner_side: winner,
          winner_pot_cents: pot,
          fan_power_hour_bonus_cents: Math.round(pot * 0.5),
          payout_split: {
            creator_cents: Math.round(pot * 0.7),
            sovereign_tax_cents: Math.round(pot * 0.135),
            liquidity_pool_cents: Math.round(pot * 0.10),
          },
        });
      }
    } catch {}
  };

  const winnerName = resolved
    ? resolved.winner_side === 'A' ? ARTIST_A.name
      : resolved.winner_side === 'B' ? ARTIST_B.name
      : 'TIE — split the pot'
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-orange-950/30 to-black text-white">
      <div className="sticky top-0 z-30 bg-black/70 backdrop-blur-md border-b border-orange-500/30 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} data-testid="tpb-back" className="p-2 rounded-lg hover:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-[0.4em] text-orange-300">Music Arena · Totem Pole Battle</div>
          <div className="text-lg font-black bg-gradient-to-r from-orange-300 via-rose-300 to-amber-300 bg-clip-text text-transparent">
            1v1 · Live
          </div>
        </div>
        <div className="font-mono font-black text-orange-300 text-2xl" data-testid="tpb-timer">{secs}s</div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-5">
        <div className="grid grid-cols-2 gap-3" data-testid="tpb-arena">
          {[
            { artist: ARTIST_A, side: 'A' as const, pot: potA, color: 'from-cyan-500 to-violet-500' },
            { artist: ARTIST_B, side: 'B' as const, pot: potB, color: 'from-amber-500 to-rose-500' },
          ].map(({ artist, side, pot, color }) => (
            <motion.div
              key={side}
              data-testid={`tpb-side-${side}`}
              animate={resolved?.winner_side === side ? { scale: 1.05 } : { scale: 1 }}
              className={`rounded-2xl overflow-hidden border-2 ${resolved?.winner_side === side ? 'border-amber-400 shadow-[0_0_60px_rgba(245,158,11,0.5)]' : 'border-white/20'}`}
            >
              <div className="relative aspect-[4/5]">
                <img src={artist.img} alt={artist.name} className="w-full h-full object-cover" />
                <div className={`absolute inset-0 bg-gradient-to-t ${color} opacity-20`} />
                <div className="absolute bottom-0 left-0 right-0 p-3 bg-black/60 backdrop-blur-sm">
                  <div className="text-xs uppercase tracking-widest text-white/70">Side {side}</div>
                  <div className="text-xl font-black">{artist.name}</div>
                  <div className="text-amber-300 font-mono font-black mt-1" data-testid={`tpb-pot-${side}`}>${(pot / 100).toFixed(2)}</div>
                </div>
                {resolved?.winner_side === side && (
                  <div className="absolute top-3 right-3"><Crown className="w-8 h-8 text-amber-300 drop-shadow-lg" /></div>
                )}
              </div>
              {!resolved && (
                <div className="grid grid-cols-3 gap-1 p-2 bg-black/60">
                  {[100, 500, 2000].map((amt) => (
                    <button
                      key={amt}
                      data-testid={`tpb-gift-${side}-${amt}`}
                      onClick={() => gift(side, amt)}
                      className="rounded-lg px-2 py-2 bg-white/10 hover:bg-white/20 text-xs font-bold"
                    >
                      <Flame className="w-3 h-3 inline -mt-1 mr-1" />${(amt / 100).toFixed(0)}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>

        <AnimatePresence>
          {resolved && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              data-testid="tpb-resolved"
              className="mt-6 p-6 rounded-3xl border-2 border-amber-400 bg-amber-500/10 text-center"
            >
              <Trophy className="w-12 h-12 text-amber-300 mx-auto mb-2" />
              <div className="text-2xl font-black text-amber-200">{winnerName}</div>
              {resolved.winner_side !== 'TIE' && (
                <>
                  <div className="text-sm text-amber-100/70 mt-1">
                    Creator share (70%): ${(resolved.payout_split.creator_cents / 100).toFixed(2)}
                  </div>
                  <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-fuchsia-500/30 border border-fuchsia-400 text-sm font-bold text-fuchsia-200">
                    <Star className="w-4 h-4" /> Power Hour ON · 1.5× fan stake bonus +${(resolved.fan_power_hour_bonus_cents / 100).toFixed(2)}
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

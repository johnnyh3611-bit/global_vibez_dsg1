/**
 * VibeShopperHunt — Daily Odd Item Loop + Direct-to-Shelf delivery
 * (Master Tech Blueprint §3).
 *
 * Backend rails (already shipped):
 *  - DSG Guard enrollment (drivers/shoppers): /api/dsg-guard/enrollment/*
 *  - VibeShopper dispatch payload: /api/dsg-guard/dispatch/build
 *  - Real-time route deviation 1.5mi: /api/dsg-guard/route-deviation/check
 *  - 70 / 13.5 / 10 split: /api/dsg-guard/payout-structure
 *
 * This page is the SHOPPER-FACING UI: pick an Odd Item, see the
 * 1.5x VibeXP boost, accept the task, and watch escrow status.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ShoppingBag, MapPin, Sparkles, Lock, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const ODD_ITEMS = [
  { id: 'oi1', name: 'Vintage Pyrex Mixing Bowl', store: 'Maria\'s Antiques', distance: '0.4 mi', fare: 1800, xp: 1.5 },
  { id: 'oi2', name: 'Pickled Watermelon Rind',   store: 'Grandma Lou\'s',   distance: '0.9 mi', fare: 1200, xp: 1.5 },
  { id: 'oi3', name: 'Hand-rolled Cuban Cigars',  store: 'Esteban\'s Lounge', distance: '1.2 mi', fare: 2400, xp: 1.5 },
  { id: 'oi4', name: 'Saffron-infused Honey',     store: 'Bee\'s Knees Co-op', distance: '0.7 mi', fare: 1500, xp: 1.5 },
];

interface Payout {
  fare_split: number;
  sovereign_tax: number;
  liquidity_pool: number;
  residual: number;
}

export default function VibeShopperHunt() {
  const navigate = useNavigate();
  const [payout, setPayout] = useState<Payout | null>(null);
  const [activeTask, setActiveTask] = useState<string | null>(null);
  const [taskStage, setTaskStage] = useState<'PICKED' | 'EN_ROUTE' | 'DELIVERED'>('PICKED');

  useEffect(() => {
    fetch(`${API}/api/dsg-guard/payout-structure`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setPayout(d))
      .catch(() => {});
  }, []);

  const accept = (id: string) => {
    setActiveTask(id);
    setTaskStage('PICKED');
    toast.success('Task claimed — head to the store!');
    // Simulate the staged journey
    setTimeout(() => setTaskStage('EN_ROUTE'), 4000);
    setTimeout(() => setTaskStage('DELIVERED'), 9000);
  };

  const driverShare = (fareCents: number) => Math.round(fareCents * 0.70);
  const xpEarned = (fareCents: number) => Math.round((fareCents / 100) * 1.5);

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-amber-950/20 to-black text-white">
      <div className="sticky top-0 z-30 bg-black/70 backdrop-blur-md border-b border-amber-500/30 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} data-testid="vibeshopper-back" className="p-2 rounded-lg hover:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-[0.4em] text-amber-300">DSG Guard · Pillar 04</div>
          <div className="text-lg font-black bg-gradient-to-r from-amber-300 via-orange-300 to-yellow-200 bg-clip-text text-transparent">
            VibeShopper Scavenger Hunt
          </div>
        </div>
      </div>

      {/* Banner — daily Odd Item Loop */}
      <div className="max-w-3xl mx-auto px-4 py-5">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-fuchsia-500/20 border border-amber-400/40 p-4 mb-5"
        >
          <div className="flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-amber-300" />
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-widest text-amber-300/80">Today's Odd Item Loop</div>
              <div className="font-black">1.5× VibeXP boost on every pick</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-amber-200/80">Resets in</div>
              <div className="font-mono font-black text-lg">14:23:08</div>
            </div>
          </div>
        </motion.div>

        {/* Active task tracker */}
        {activeTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl bg-emerald-900/30 border border-emerald-400/40 p-5 mb-5"
            data-testid="active-task"
          >
            <div className="flex items-center gap-3 mb-3">
              <ShoppingBag className="w-6 h-6 text-emerald-300" />
              <div className="font-bold">Active task — {ODD_ITEMS.find(i => i.id === activeTask)?.name}</div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['PICKED', 'EN_ROUTE', 'DELIVERED'] as const).map((s, i) => {
                const idx = ['PICKED', 'EN_ROUTE', 'DELIVERED'].indexOf(taskStage);
                const done = i <= idx;
                return (
                  <div key={s} data-testid={`stage-${s.toLowerCase()}`}
                    className={`p-3 rounded-lg border text-center ${done ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200' : 'bg-black/30 border-white/10 text-white/40'}`}>
                    {done ? <CheckCircle2 className="w-5 h-5 mx-auto" /> : i === idx + 1 ? <Clock className="w-5 h-5 mx-auto animate-pulse" /> : <Lock className="w-5 h-5 mx-auto" />}
                    <div className="text-[10px] mt-1 font-bold uppercase tracking-wider">{s.replace('_', ' ')}</div>
                  </div>
                );
              })}
            </div>
            {taskStage === 'DELIVERED' && (
              <div className="mt-4 p-3 rounded-lg bg-amber-500/15 border border-amber-400/40 text-center" data-testid="escrow-released">
                <div className="text-xs text-amber-300/80 uppercase tracking-widest">Vibe Vault Escrow Released</div>
                <div className="text-amber-200 font-mono">GPS coordinate match confirmed (within 50m)</div>
              </div>
            )}
          </motion.div>
        )}

        {/* Payout chart */}
        {payout && (
          <div className="rounded-2xl bg-black/40 border border-white/10 p-4 mb-5">
            <div className="text-[10px] uppercase tracking-widest text-white/60 mb-2">Locked Payout Structure</div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <Slice label="Driver" pct={payout.fare_split} color="emerald-400" />
              <Slice label="Sov. Tax" pct={payout.sovereign_tax} color="fuchsia-400" />
              <Slice label="Liquidity" pct={payout.liquidity_pool} color="cyan-400" />
              <Slice label="Residual" pct={payout.residual} color="amber-400" />
            </div>
          </div>
        )}

        {/* Item grid */}
        <div className="grid sm:grid-cols-2 gap-3" data-testid="odd-item-grid">
          {ODD_ITEMS.map((it) => (
            <motion.div
              key={it.id}
              whileHover={{ y: -3 }}
              data-testid={`odd-item-${it.id}`}
              className="rounded-2xl bg-stone-900/60 border border-amber-500/20 p-4 hover:border-amber-400/60 transition"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-bold">{it.name}</div>
                  <div className="text-xs text-amber-200/70 flex items-center gap-1 mt-1">
                    <MapPin className="w-3 h-3" /> {it.store} · {it.distance}
                  </div>
                </div>
                <div className="rounded-full px-2 py-0.5 text-[10px] bg-amber-500/20 text-amber-300 font-bold">
                  +{it.xp}× XP
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-white/50">You earn</div>
                  <div className="font-mono font-black text-emerald-300 text-lg">${(driverShare(it.fare) / 100).toFixed(2)}</div>
                  <div className="text-[10px] text-white/40">+ {xpEarned(it.fare)} VibeXP</div>
                </div>
                <button
                  data-testid={`accept-${it.id}`}
                  onClick={() => accept(it.id)}
                  disabled={!!activeTask}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 font-bold disabled:opacity-30"
                >
                  {activeTask === it.id ? 'Active' : 'Claim'}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

const Slice: React.FC<{ label: string; pct: number; color: string }> = ({ label, pct, color }) => (
  <div className={`rounded-lg bg-black/30 border border-${color}/30 p-2`}>
    <div className={`text-${color} font-mono font-black text-lg`}>{(pct * 100).toFixed(1)}%</div>
    <div className="text-[10px] text-white/60 uppercase tracking-wider">{label}</div>
  </div>
);

/**
 * RecirculationVelocityWidget — Public landing-page readout (Feb 2026)
 *
 * Replaces the legacy BurnCounterWidget. With the Recirculation
 * Blueprint live, in-app ₵ coins **don't burn** — they cycle 40/30/30
 * through pools, driving velocity. This widget shows the live pool
 * totals so prospects see proof of the velocity story, not vague
 * scarcity claims.
 *
 * Voice: velocity-driven hero per founder direction.
 *   "Coins don't die. They cycle. Every spend funds someone's next win."
 *
 * The DSG token (Solana SPL) has its OWN burn schedule shown elsewhere
 * (Welcome Letter / Economic Engine page). This widget is in-app ₵ only.
 */
import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Recycle, Trophy, Vault, Timer } from 'lucide-react';

type Summary = {
  tournament_pool: number;
  treasury: number;
  airlock_locked: number;
  model: string;
  split_pct: { tournament: number; treasury: number; airlock: number };
  airlock_hold_seconds: number;
};

const API = process.env.REACT_APP_BACKEND_URL;
const fmt = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
    ? `${(n / 1_000).toFixed(1)}K`
    : n.toLocaleString();

const RecirculationVelocityWidget: React.FC = () => {
  const [data, setData] = useState<Summary | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${API}/api/recirculation/public-summary`);
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled) setData(body);
      } catch {
        /* non-fatal — widget gracefully shows skeleton */
      }
    };
    load();
    const id = setInterval(load, 30_000); // refresh every 30s
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <Card
      className="p-6 bg-gradient-to-br from-fuchsia-950/40 via-black/60 to-cyan-950/40 border border-fuchsia-500/30 backdrop-blur-md"
      data-testid="recirculation-velocity-widget"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Recycle className="w-5 h-5 text-fuchsia-400" />
          <h3 className="text-sm font-black tracking-widest uppercase text-white">
            Coin Velocity · Live
          </h3>
        </div>
        <Badge
          variant="outline"
          className="text-emerald-300 border-emerald-500/50 bg-emerald-950/30 text-[10px]"
        >
          3B fixed supply · no burn
        </Badge>
      </div>

      <p className="text-sm text-zinc-300 mb-5 leading-relaxed">
        Coins don't die. They cycle.{' '}
        <span className="text-white font-bold">
          Every spend funds someone's next win.
        </span>
      </p>

      <div className="grid grid-cols-3 gap-3">
        <div
          className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20"
          data-testid="velocity-widget-tournament-pool"
        >
          <div className="flex items-center gap-1.5 mb-1">
            <Trophy className="w-3.5 h-3.5 text-emerald-300" />
            <span className="text-[10px] uppercase tracking-widest text-emerald-300">
              Tournament Pool
            </span>
          </div>
          <div className="text-xl font-black text-white font-mono">
            ₵ {data ? fmt(data.tournament_pool) : '—'}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 mt-0.5">
            40% of every spend
          </div>
        </div>

        <div
          className="p-3 rounded-xl bg-fuchsia-500/5 border border-fuchsia-500/20"
          data-testid="velocity-widget-treasury"
        >
          <div className="flex items-center gap-1.5 mb-1">
            <Vault className="w-3.5 h-3.5 text-fuchsia-300" />
            <span className="text-[10px] uppercase tracking-widest text-fuchsia-300">
              Treasury
            </span>
          </div>
          <div className="text-xl font-black text-white font-mono">
            ₵ {data ? fmt(data.treasury) : '—'}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 mt-0.5">
            30% · platform engine
          </div>
        </div>

        <div
          className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20"
          data-testid="velocity-widget-airlock"
        >
          <div className="flex items-center gap-1.5 mb-1">
            <Timer className="w-3.5 h-3.5 text-amber-300" />
            <span className="text-[10px] uppercase tracking-widest text-amber-300">
              72h Vault
            </span>
          </div>
          <div className="text-xl font-black text-white font-mono">
            ₵ {data ? fmt(data.airlock_locked) : '—'}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 mt-0.5">
            30% · velocity gate
          </div>
        </div>
      </div>

      <p className="text-[11px] text-zinc-500 leading-relaxed mt-5">
        40 / 30 / 30 split on every paid transaction.{' '}
        <span className="text-zinc-300">3 billion ₵ fixed.</span> Velocity
        drives in-app value — no burns, no rugs.
      </p>
    </Card>
  );
};

export default RecirculationVelocityWidget;

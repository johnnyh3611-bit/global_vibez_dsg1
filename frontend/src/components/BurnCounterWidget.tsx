/**
 * BurnCounterWidget — public scarcity readout for the landing page.
 *
 * Pulls live numbers from /api/coins/stats/burn every 30 seconds and
 * tells the founder pricing model story: 3B fixed supply, every spend
 * permanently burns coins, circulating supply tightens as the
 * marketplace grows.
 *
 * No auth required — anyone visiting globalvibezdsg.com can watch it
 * tick. That's the marketing point.
 */
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Flame, Coins, TrendingDown, Zap } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

interface BurnStats {
  total_supply: number;
  burned_total: number;
  burned_today: number;
  circulating: number;
  user_float: number;
  topup_total_credited: number;
  burn_pct: number;
  coins_per_usd: number;
  burned_total_usd: number;
  burned_today_usd: number;
  top_reasons_24h: { reason: string; coins_burned: number; tx_count: number }[];
}

const REASON_LABELS: Record<string, string> = {
  yellow_pages_upgrade: "Yellow Pages",
  hungryvibez_order: "Food Orders",
  vibe_ridez_seat_booking: "Ride Bookings",
  jftn_room_pass: "JFTN Rooms",
};

function fmt(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default function BurnCounterWidget() {
  const [stats, setStats] = useState<BurnStats | null>(null);

  useEffect(() => {
    const load = () => {
      fetch(`${API}/coins/stats/burn`)
        .then((r) => r.json())
        .then(setStats)
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  if (!stats) {
    return (
      <div
        className="rounded-2xl border border-yellow-500/20 bg-slate-950/50 p-6 text-center text-slate-500"
        data-testid="burn-counter-widget-loading"
      >
        Loading scarcity stats…
      </div>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-slate-950 via-slate-900 to-orange-950/30 p-6 sm:p-8 shadow-[0_0_40px_rgba(234,179,8,0.15)]"
      data-testid="burn-counter-widget"
    >
      {/* Glow pulse */}
      <motion.div
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 3, repeat: Infinity }}
        className="pointer-events-none absolute -inset-1 bg-gradient-to-r from-yellow-500/0 via-orange-500/15 to-yellow-500/0 blur-2xl"
      />

      <div className="relative">
        <div className="flex items-center gap-2 mb-1">
          <Flame className="w-5 h-5 text-orange-400" />
          <span className="text-[11px] uppercase tracking-[0.4em] text-orange-300 font-black">
            DSG Scarcity · Live
          </span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-white">
          {fmt(stats.burned_total)} ₵ <span className="text-orange-400">burned</span>{" "}
          <span className="text-slate-500 text-base font-medium">
            (${stats.burned_total_usd.toLocaleString()})
          </span>
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          {stats.burn_pct.toFixed(6)}% of the {fmt(stats.total_supply)} total supply
          gone forever. Every spend in the app is a permanent burn.
        </p>

        {/* Top stat row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5" data-testid="burn-counter-tiles">
          <Tile
            icon={<TrendingDown className="w-4 h-4" />}
            label="Burned 24h"
            value={`${fmt(stats.burned_today)} ₵`}
            sub={`$${stats.burned_today_usd.toLocaleString()}`}
            color="text-orange-300"
            testId="burn-tile-24h"
          />
          <Tile
            icon={<Coins className="w-4 h-4" />}
            label="Circulating"
            value={`${fmt(stats.circulating)} ₵`}
            sub={`of ${fmt(stats.total_supply)}`}
            color="text-yellow-300"
            testId="burn-tile-circulating"
          />
          <Tile
            icon={<Zap className="w-4 h-4" />}
            label="User Wallets"
            value={`${fmt(stats.user_float)} ₵`}
            sub="across all holders"
            color="text-emerald-300"
            testId="burn-tile-float"
          />
          <Tile
            icon={<Flame className="w-4 h-4" />}
            label="Burn Rate"
            value={`${stats.coins_per_usd.toLocaleString()} ₵`}
            sub="= $1 USD (locked)"
            color="text-rose-300"
            testId="burn-tile-rate"
          />
        </div>

        {/* Top burn reasons */}
        {stats.top_reasons_24h.length > 0 && (
          <div className="mt-5 pt-4 border-t border-slate-800/60" data-testid="burn-counter-reasons">
            <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500 mb-2">
              Top Burns Last 24h
            </div>
            <div className="flex flex-wrap gap-2">
              {stats.top_reasons_24h.map((r) => (
                <div
                  key={r.reason}
                  className="px-3 py-1.5 rounded-full bg-slate-900/80 border border-yellow-500/20 text-xs text-slate-300 flex items-center gap-2"
                  data-testid={`burn-reason-${r.reason}`}
                >
                  <span className="text-yellow-300 font-bold">
                    {fmt(r.coins_burned)} ₵
                  </span>
                  <span className="text-slate-400">
                    {REASON_LABELS[r.reason] || r.reason}
                  </span>
                  <span className="text-slate-600 text-[10px]">
                    · {r.tx_count} tx
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.section>
  );
}

interface TileProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
  testId: string;
}
function Tile({ icon, label, value, sub, color, testId }: TileProps) {
  return (
    <div
      className="rounded-xl border border-slate-800/60 bg-slate-950/60 px-3 py-3"
      data-testid={testId}
    >
      <div className={`flex items-center gap-1.5 ${color} text-[10px] uppercase tracking-[0.2em] font-black mb-1`}>
        {icon}
        {label}
      </div>
      <div className="text-lg sm:text-xl font-bold text-white">{value}</div>
      <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>
    </div>
  );
}

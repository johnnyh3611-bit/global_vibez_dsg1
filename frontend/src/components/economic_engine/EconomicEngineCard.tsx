/**
 * EconomicEngineCard — public Vibez Coin tokenomics + live engine state.
 *
 * Encodes the spec from Global_Vibez_DSG_Economic_Engine.pdf:
 *   - 3B initial supply → 1.5B stabilization target
 *   - 4% → 0.5% dynamic burn rate (scales with supply)
 *   - 50/50 revenue split (buyback+burn vs USD liquidity floor)
 *   - $1.00 parity target
 *
 * Fetches /api/economic-engine/snapshot every 30s for the live values.
 * Renders inline progress bar + 4 key stat tiles + a tiny formula
 * reference so any investor or auditor can verify the engine.
 */
import { useEffect, useState } from "react";
import { Coins, Flame, Droplets, Target, TrendingDown } from "lucide-react";

interface Snapshot {
  constants: {
    initial_supply: number;
    stabilization_target_supply: number;
    golden_asset_supply: number;
    initial_burn_rate: number;
    minimum_burn_rate: number;
    revenue_split_ratio: number;
    default_utility_cost_usd: number;
    parity_usd: number;
    coin_to_credits_ratio?: number;
    usd_to_credits_ratio?: number;
    global_revenue_sources?: string[];
    protocol_version?: string;
  };
  current_supply: number;
  lifetime_burned_coins: number;
  lifetime_revenue_usd: number;
  liquidity_fund_usd: number;
  current_burn_rate: number;
  progress_to_stabilization: number;
  stabilization_reached: boolean;
  updated_at?: string;
}

const API = process.env.REACT_APP_BACKEND_URL;

function fmtBig(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

function fmtUsd(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

export default function EconomicEngineCard() {
  const [snap, setSnap] = useState<Snapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${API}/api/economic-engine/snapshot`);
        if (!res.ok) return;
        const d = (await res.json()) as Snapshot;
        if (!cancelled) setSnap(d);
      } catch {
        /* silent */
      }
    };
    load();
    const id = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!snap) return null;

  const c = snap.constants;
  const progressPct = Math.round((snap.progress_to_stabilization || 0) * 100);
  const burnPct = (snap.current_burn_rate * 100).toFixed(2);

  return (
    <div
      className="rounded-2xl border border-fuchsia-400/25 bg-gradient-to-br from-[#0F0720] via-[#150629] to-[#0a0b18] p-5 md:p-6 shadow-[0_0_30px_rgba(217,70,239,0.18)]"
      data-testid="economic-engine-card"
    >
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-fuchsia-400/90">
            DSG Token Engine · Solana SPL · Burn Schedule
          </p>
          <h3 className="text-xl md:text-2xl font-black text-white mt-0.5">
            DSG · ${c.parity_usd.toFixed(2)} floor · Programmed burn down to a hard floor
          </h3>
          <p className="text-[10px] text-purple-300/60 mt-1">
            (In-app VIBEZ ₵ doesn't burn — see the Coin Velocity widget. Two
            economies, by design.)
          </p>
          {c.protocol_version && (
            <p className="text-[10px] font-mono text-purple-400/60 mt-0.5">
              {c.protocol_version}
            </p>
          )}
        </div>
        <span
          className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-widest font-bold border ${
            snap.stabilization_reached
              ? "bg-emerald-500/15 text-emerald-200 border-emerald-400/40"
              : "bg-amber-500/15 text-amber-200 border-amber-400/40"
          }`}
          data-testid="economic-engine-status-pill"
        >
          {snap.stabilization_reached ? "Stabilized" : "Burning down"}
        </span>
      </div>

      {/* Credits standard strip — universal utility unit. */}
      {c.coin_to_credits_ratio && c.usd_to_credits_ratio && (
        <div
          className="rounded-lg bg-black/30 border border-fuchsia-500/15 px-3 py-2 mb-4 flex flex-wrap items-center justify-between gap-2 text-[11px]"
          data-testid="economic-engine-credits-strip"
        >
          <span className="font-mono uppercase tracking-widest text-[9px] text-purple-300/70 font-bold">
            Credits · Standard Utility Unit
          </span>
          <div className="flex items-center gap-3 font-mono text-purple-100">
            <span>
              1 Coin = <b className="text-fuchsia-300">{c.coin_to_credits_ratio} Credits</b>
            </span>
            <span className="text-purple-400/40">·</span>
            <span>
              $1 = <b className="text-fuchsia-300">{c.usd_to_credits_ratio} Credits</b>
            </span>
            <span className="text-purple-400/40">·</span>
            <span>
              10 Credits = <b className="text-fuchsia-300">$0.10</b>
            </span>
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="mb-5">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-purple-300/80 mb-1.5">
          <span>Path to 1.5 B stabilization</span>
          <span className="text-fuchsia-200 font-bold" data-testid="economic-engine-progress-pct">
            {progressPct}%
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-fuchsia-500 via-purple-400 to-emerald-400 transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex justify-between text-[9px] text-purple-300/60 mt-1">
          <span>3 B (start)</span>
          <span>1.5 B (target)</span>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <StatTile
          label="Current supply"
          value={fmtBig(snap.current_supply)}
          suffix="coins"
          icon={Coins}
          testid="economic-engine-supply"
        />
        <StatTile
          label="Burn rate (live)"
          value={`${burnPct}%`}
          suffix={`max ${(c.initial_burn_rate * 100).toFixed(1)}% · floor ${(c.minimum_burn_rate * 100).toFixed(1)}%`}
          icon={Flame}
          accent="text-orange-300"
          testid="economic-engine-burn-rate"
        />
        <StatTile
          label="Liquidity fund"
          value={fmtUsd(snap.liquidity_fund_usd)}
          suffix={`${(c.revenue_split_ratio * 100).toFixed(0)}% of revenue`}
          icon={Droplets}
          accent="text-cyan-300"
          testid="economic-engine-liquidity"
        />
        <StatTile
          label="Lifetime burned"
          value={fmtBig(snap.lifetime_burned_coins)}
          suffix={`${fmtUsd(snap.lifetime_revenue_usd)} revenue`}
          icon={TrendingDown}
          accent="text-fuchsia-300"
          testid="economic-engine-lifetime-burned"
        />
      </div>

      {/* Formula reference */}
      <details className="text-xs text-purple-300/70" data-testid="economic-engine-formula">
        <summary className="cursor-pointer uppercase tracking-widest text-[10px] font-bold text-fuchsia-300 hover:text-fuchsia-200">
          <Target className="w-3 h-3 inline mr-1" /> See the formula
        </summary>
        <div className="mt-2 p-3 rounded-lg bg-black/30 border border-fuchsia-500/15 font-mono space-y-1 leading-relaxed">
          <p>
            <span className="text-purple-300/60">if supply ≤ {fmtBig(c.stabilization_target_supply)}:</span>
          </p>
          <p className="pl-4">
            <span className="text-emerald-300">return {c.minimum_burn_rate}</span>
          </p>
          <p className="text-purple-300/60">else:</p>
          <p className="pl-4 text-fuchsia-200">
            progress = (supply − {fmtBig(c.stabilization_target_supply)}) / (
            {fmtBig(c.initial_supply)} − {fmtBig(c.stabilization_target_supply)})
          </p>
          <p className="pl-4 text-fuchsia-200">
            rate = {c.minimum_burn_rate} + (
            {(c.initial_burn_rate - c.minimum_burn_rate).toFixed(3)} × progress)
          </p>
          <p className="text-purple-300/50 mt-1.5">
            Revenue split — global revenue from{" "}
            <b className="text-purple-200">
              {(c.global_revenue_sources || ["Rides", "Restaurants", "Gaming"]).join(" · ")}
            </b>{" "}
            — {(c.revenue_split_ratio * 100).toFixed(0)}% Buyback &amp; Burn (active market
            purchases, drives price) ·{" "}
            {(100 - c.revenue_split_ratio * 100).toFixed(0)}% Liquidity Injection (strengthens
            the pool, protects against volatility).
          </p>
        </div>
      </details>
    </div>
  );
}

function StatTile({
  label,
  value,
  suffix,
  icon: Icon,
  accent = "text-fuchsia-200",
  testid,
}: {
  label: string;
  value: string;
  suffix?: string;
  icon: typeof Coins;
  accent?: string;
  testid: string;
}) {
  return (
    <div
      className="rounded-xl bg-black/30 border border-fuchsia-500/15 p-3"
      data-testid={testid}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`w-3.5 h-3.5 ${accent}`} />
        <p className="text-[9px] uppercase tracking-widest text-purple-300/70 font-bold">
          {label}
        </p>
      </div>
      <p className={`text-xl md:text-2xl font-black ${accent}`}>{value}</p>
      {suffix && (
        <p className="text-[9px] text-purple-300/55 mt-0.5">{suffix}</p>
      )}
    </div>
  );
}

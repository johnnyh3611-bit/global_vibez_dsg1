/**
 * SolanaNetworkPanel — combined widget pair (Gas Monitor + TPS Graph)
 * mounted on the God-Mode dashboard. Polls every 30s.
 *
 * Until the founder flips VIBEZ_SOLANA_RPC to a mainnet URL ("domains"
 * safe word), the data will look flat — that's expected on Devnet. The
 * widget shows a "Devnet" pill so the founder isn't confused by zeros.
 */
import { useCallback, useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Activity, Gauge, Wifi } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

type Fees = {
  rpc_url: string;
  is_mainnet: boolean;
  samples: number;
  low: number; med: number; high: number;
  low_sol: number; med_sol: number; high_sol: number;
};

type Tps = {
  rpc_url: string;
  is_mainnet: boolean;
  samples: number;
  avg_tps: number;
  peak_tps: number;
  series: Array<{ slot: number; tps: number; n_transactions: number }>;
};

export default function SolanaNetworkPanel() {
  const [fees, setFees] = useState<Fees | null>(null);
  const [tps, setTps] = useState<Tps | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [fR, tR] = await Promise.all([
        fetch(`${API}/api/solana/network/fees`, {}),
        fetch(`${API}/api/solana/network/tps?samples=30`, {}),
      ]);
      if (fR.ok) setFees(await fR.json());
      if (tR.ok) setTps(await tR.json());
      if (!fR.ok || !tR.ok) setErr("RPC error — check VIBEZ_SOLANA_RPC env.");
    } catch (e) {
      setErr(`Network error: ${e}`);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const isMainnet = fees?.is_mainnet ?? tps?.is_mainnet ?? false;

  return (
    <div className="space-y-4" data-testid="solana-network-panel">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-400 leading-snug">
          Live Solana RPC stats. Auto-refreshes every 30 s.
        </p>
        <span
          data-testid="solana-network-rpc-pill"
          className={`text-[9px] uppercase tracking-widest font-black px-2 py-1 rounded-full ${
            isMainnet
              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-400/40"
              : "bg-amber-500/15 text-amber-300 border border-amber-400/40"
          }`}
        >
          {isMainnet ? "Mainnet" : "Devnet"}
        </span>
      </div>

      {err && (
        <p className="text-rose-300 text-[11px]" data-testid="solana-network-error">
          {err}
        </p>
      )}

      {/* Gas Monitor */}
      <div
        className="rounded-xl border border-cyan-400/30 bg-black/60 p-4 backdrop-blur-sm"
        data-testid="solana-gas-monitor"
      >
        <h4 className="text-cyan-400 text-[10px] font-black tracking-widest uppercase mb-3 flex items-center gap-1.5">
          <Gauge className="w-3 h-3" />
          Solana Network Load
        </h4>

        {!fees ? (
          <p className="text-slate-400 text-sm">Loading…</p>
        ) : (
          <div>
            <div className="flex items-end gap-3 sm:gap-6 flex-wrap">
              <Cell
                tone="emerald"
                label="Smooth"
                primary={`${fees.low_sol.toFixed(9)} SOL`}
                secondary={`${fees.low} µ-lamports/CU`}
              />
              <div className="h-10 w-[2px] bg-white/10" />
              <Cell
                tone="amber"
                label="Busy"
                primary={`${fees.med_sol.toFixed(9)} SOL`}
                secondary={`${fees.med} µ-lamports/CU`}
              />
              <div className="h-10 w-[2px] bg-white/10" />
              <Cell
                tone="rose"
                label="Heavy"
                primary={`${fees.high_sol.toFixed(9)} SOL`}
                secondary={`${fees.high} µ-lamports/CU`}
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-3">
              Sampled across the last {fees.samples} blocks. Numbers are
              priority fees per compute unit at the 25/50/90 percentiles.
            </p>
          </div>
        )}
      </div>

      {/* TPS Graph */}
      <div
        className="rounded-xl border border-white/10 bg-black/60 p-4 backdrop-blur-xl"
        data-testid="solana-tps-graph"
      >
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-white font-bold text-sm flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-emerald-300" />
            Live TPS — last 30 samples
          </h4>
          {tps && (
            <p className="text-[10px] text-slate-400 flex items-center gap-2">
              <span>
                avg{" "}
                <span className="text-emerald-300 font-black">{tps.avg_tps}</span>
              </span>
              <span>·</span>
              <span>
                peak{" "}
                <span className="text-emerald-300 font-black">{tps.peak_tps}</span>
              </span>
            </p>
          )}
        </div>

        {!tps ? (
          <p className="text-slate-400 text-sm">Loading…</p>
        ) : tps.series.length === 0 ? (
          <p className="text-slate-400 text-sm">No samples available.</p>
        ) : (
          <div className="h-[220px] w-full">
            <ResponsiveContainer>
              <LineChart data={tps.series}>
                <XAxis dataKey="slot" hide />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#000",
                    border: "1px solid #333",
                    fontSize: 10,
                  }}
                  itemStyle={{ fontSize: 10, color: "#14F195" }}
                  formatter={(v: number) => [`${v} TPS`, "Throughput"]}
                />
                <Line
                  type="monotone"
                  dataKey="tps"
                  stroke="#14F195"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-slate-500 mt-2">
          <Wifi className="w-3 h-3" />
          {isMainnet ? (
            <span>Mainnet RPC · live cluster traffic</span>
          ) : (
            <span>Devnet RPC · low traffic by design — flip to mainnet when ready</span>
          )}
        </div>
      </div>
    </div>
  );
}

function Cell({
  label,
  primary,
  secondary,
  tone,
}: {
  label: string;
  primary: string;
  secondary: string;
  tone: "emerald" | "amber" | "rose";
}) {
  const c =
    tone === "emerald"
      ? "text-emerald-300"
      : tone === "amber"
      ? "text-amber-300"
      : "text-rose-300";
  return (
    <div className="text-center">
      <div className={`text-[9px] uppercase tracking-widest ${c}`}>{label}</div>
      <div className={`font-mono text-sm ${c}`}>{primary}</div>
      <div className="font-mono text-[9px] text-white/40 mt-0.5">{secondary}</div>
    </div>
  );
}

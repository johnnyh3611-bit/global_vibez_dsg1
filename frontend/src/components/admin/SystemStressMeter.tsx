/**
 * SystemStressMeter — Liquidity Health widget for the God-Mode dashboard.
 *
 * Reads `/api/admin/health-check` every 30s and renders a colored bar:
 *   • cyan (≥1.5×) — Healthy
 *   • amber (1.0×–1.5×) — Caution
 *   • red (<1.0×)  — Critical (auto-throttle active)
 *   • slate-with-red-blink — Locked (emergency override engaged)
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const API = process.env.REACT_APP_BACKEND_URL;

type Health = {
  status: string;
  reserve_usd: number;
  total_liability_usd: number;
  reserve_ratio: number | null;
  target_ratio: number;
  payout_multiplier: number;
  action_required: boolean;
  current_house_fee_pct: number;
  auto_pilot_enabled: boolean;
  emergency_lock: boolean;
  last_auto_pilot_run: string | null;
};

const fmtUsd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function SystemStressMeter() {
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch(`${API}/api/admin/health-check`, {
        });
        if (r.ok && !cancelled) setHealth(await r.json());
      } catch {
        /* noop */
      }
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!health) {
    return (
      <div
        data-testid="stress-meter"
        className="rounded-2xl border border-slate-700 bg-black p-6 w-full"
      >
        <p className="text-slate-500 text-xs uppercase tracking-widest">
          Liquidity Health · loading…
        </p>
      </div>
    );
  }

  const ratio = health.reserve_ratio ?? 99;
  const pctOfTarget = Math.min((ratio / health.target_ratio) * 100, 100);
  const color = health.emergency_lock
    ? "#ef4444"
    : ratio >= 1.5
    ? "#06b6d4"
    : ratio >= 1.0
    ? "#f59e0b"
    : "#ef4444";

  return (
    <div
      className="rounded-2xl border border-slate-700 bg-black p-6 w-full"
      data-testid="stress-meter"
    >
      <div className="flex items-baseline justify-between">
        <h3 className="text-slate-400 text-xs uppercase tracking-widest font-bold">
          Liquidity Health
        </h3>
        <span
          className={`text-[10px] uppercase tracking-widest font-black ${
            health.emergency_lock
              ? "text-rose-400 animate-pulse"
              : ratio >= 1.5
              ? "text-cyan-400"
              : ratio >= 1.0
              ? "text-amber-400"
              : "text-rose-400"
          }`}
          data-testid="stress-meter-zone"
        >
          {health.status}
        </span>
      </div>

      <div className="mt-3 relative h-4 w-full bg-slate-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pctOfTarget}%`, backgroundColor: color }}
          transition={{ duration: 1.0, ease: "easeOut" }}
          className="h-full"
          style={{ boxShadow: `0 0 12px ${color}` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4 text-[11px] font-mono">
        <div>
          <p className="text-slate-500 uppercase tracking-widest text-[9px]">Reserve</p>
          <p className="text-cyan-300 font-bold">{fmtUsd(health.reserve_usd)}</p>
        </div>
        <div>
          <p className="text-slate-500 uppercase tracking-widest text-[9px]">Liability</p>
          <p className="text-amber-300 font-bold">
            {fmtUsd(health.total_liability_usd)}
          </p>
        </div>
        <div>
          <p className="text-slate-500 uppercase tracking-widest text-[9px]">Coverage</p>
          <p className="text-fuchsia-300 font-bold">
            {ratio.toFixed(2)}× / {health.target_ratio.toFixed(1)}× target
          </p>
        </div>
        <div>
          <p className="text-slate-500 uppercase tracking-widest text-[9px]">
            Payout multiplier
          </p>
          <p
            className={`font-bold ${
              health.payout_multiplier >= 1.0 ? "text-emerald-300" : "text-rose-300"
            }`}
          >
            {(health.payout_multiplier * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-2 gap-2 text-[10px]">
        <p className="text-slate-500">
          Auto-Pilot:{" "}
          <span className={health.auto_pilot_enabled ? "text-emerald-300" : "text-rose-300"}>
            {health.auto_pilot_enabled ? "ON" : "OFF"}
          </span>
        </p>
        <p className="text-slate-500 text-right">
          House fee:{" "}
          <span className="text-amber-300">
            {(health.current_house_fee_pct * 100).toFixed(0)}%
          </span>
        </p>
      </div>

      {health.action_required && (
        <motion.p
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="mt-3 text-rose-400 text-[10px] font-black uppercase tracking-widest"
          data-testid="stress-meter-alert"
        >
          {health.emergency_lock
            ? "⚠ Emergency Lock engaged · payouts frozen"
            : "⚠ Auto-throttle active · payouts scaled"}
        </motion.p>
      )}
    </div>
  );
}

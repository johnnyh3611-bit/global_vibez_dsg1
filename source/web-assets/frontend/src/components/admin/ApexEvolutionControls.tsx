/**
 * ApexEvolutionControls — admin-only widget mounted in God-Mode.
 *
 * Shows live status of the Escape Velocity event + 3 actions:
 *   • Activate Now (manual override — fires the +1× pump + opens Apex)
 *   • Award Race Bonuses (post-activation only; gives top 100 a free chair)
 *   • Reset Race Window (resets the leaderboard's race_started_at to NOW)
 *
 * Each action is double-confirmed because they're irreversible.
 */
import { useEffect, useState, useCallback } from "react";
import { Flame, Trophy, RotateCcw, AlertTriangle, Check } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

type Status = {
  evolution_at: string | null;
  seconds_until_evolution: number | null;
  apex_unlocked: boolean;
  pump_applied: boolean;
  race_started_at: string | null;
  activated_at: string | null;
  race_bonuses_awarded: boolean;
};

export default function ApexEvolutionControls() {
  const [status, setStatus] = useState<Status | null>(null);
  const [econ, setEcon] = useState<{
    chair_pool_pct: number;
    chair_pool_pct_pre_ev: number;
    chair_pool_pct_post_ev: number;
    escape_velocity_fired: boolean;
  } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`${API}/api/apex/status`);
    if (r.ok) setStatus(await r.json());
    // Pull the live chair-pool ratio so the admin sees exactly what
    // the +1× pump will do to payouts (14% → 30% jump on EV fire).
    const e = await fetch(`${API}/api/chairs/economics`);
    if (e.ok) {
      const d = await e.json();
      setEcon({
        chair_pool_pct: d.chair_pool_pct,
        chair_pool_pct_pre_ev: d.chair_pool_pct_pre_ev,
        chair_pool_pct_post_ev: d.chair_pool_pct_post_ev,
        escape_velocity_fired: d.escape_velocity_fired,
      });
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const post = async (path: string, label: string, confirmText: string) => {
    if (!window.confirm(confirmText)) return;
    setBusy(label);
    setLast(null);
    try {
      const r = await fetch(`${API}${path}`, {
        method: "POST",
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setLast(`${label}: ${JSON.stringify(d)}`);
      } else {
        setLast(`${label} FAILED: ${d.detail || r.statusText}`);
      }
      await load();
    } finally {
      setBusy(null);
    }
  };

  if (!status) {
    return (
      <p className="text-slate-400 text-sm">Loading Escape Velocity status…</p>
    );
  }

  return (
    <div className="space-y-4" data-testid="apex-evolution-controls">
      {econ && (
        <div
          className="rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-950/30 to-rose-950/20 p-4"
          data-testid="ev-chair-pool-banner"
        >
          <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-amber-300 mb-1">
            Chair-holder profit share
          </p>
          <div className="flex items-baseline gap-3 flex-wrap">
            <p className="text-3xl font-black font-mono text-white">
              {(econ.chair_pool_pct * 100).toFixed(0)}%
            </p>
            {!econ.escape_velocity_fired && (
              <p className="text-sm text-amber-200">
                → auto-bumps to{" "}
                <strong>
                  {(econ.chair_pool_pct_post_ev * 100).toFixed(0)}%
                </strong>{" "}
                the moment you pull the switch
              </p>
            )}
            {econ.escape_velocity_fired && (
              <p className="text-sm text-emerald-300">
                ✓ Escape Velocity fired — chair holders now earning at the
                upgraded rate
              </p>
            )}
          </div>
          <p className="text-[10px] text-amber-100/60 mt-1">
            Distributed by weight (Genius 3× / Genesis 2× / Phase III 1.5× /
            Phase IV 1.25× / Phase V 1×). Never by who paid most.
          </p>
        </div>
      )}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile
          label="Escape Velocity at"
          value={
            status.evolution_at
              ? new Date(status.evolution_at).toLocaleString()
              : "Not configured"
          }
          accent={status.evolution_at ? "amber" : "slate"}
        />
        <Tile
          label="Reserve vault unlocked"
          value={status.apex_unlocked ? "YES" : "no"}
          accent={status.apex_unlocked ? "emerald" : "slate"}
        />
        <Tile
          label="+1× pump applied"
          value={status.pump_applied ? "YES" : "no"}
          accent={status.pump_applied ? "emerald" : "slate"}
        />
        <Tile
          label="Race bonuses awarded"
          value={status.race_bonuses_awarded ? "YES" : "no"}
          accent={status.race_bonuses_awarded ? "emerald" : "slate"}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() =>
            post(
              "/api/admin/apex/activate-now",
              "activate-now",
              "PULL THE SWITCH? This is Escape Velocity. Every chair in existence gets +1× (Genius 3× → 4×, Genesis 2× → 3×), the chair-holder profit share auto-bumps from 14% to 30%, all legacy phase brackets lock (Genius $10 → Phase V $30 close forever), and the $50 Apex bracket opens. Cannot be undone. You only hit Escape Velocity once.",
            )
          }
          disabled={status.apex_unlocked || busy === "activate-now"}
          data-testid="apex-activate-now"
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-rose-500 text-white text-[11px] uppercase tracking-widest font-black hover:bg-rose-400 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Flame className="w-3.5 h-3.5" />
          Pull the Switch
        </button>
        <button
          onClick={() =>
            post(
              "/api/admin/apex/award-bonuses",
              "award-bonuses",
              "Award one free Apex chair to each of the top 100 race finishers? Runs ONCE — second click is a no-op.",
            )
          }
          disabled={
            !status.apex_unlocked ||
            status.race_bonuses_awarded ||
            busy === "award-bonuses"
          }
          data-testid="apex-award-bonuses"
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-400 text-black text-[11px] uppercase tracking-widest font-black hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Trophy className="w-3.5 h-3.5" />
          Award Race Bonuses
        </button>
        <button
          onClick={() =>
            post(
              "/api/admin/apex/reset-race",
              "reset-race",
              "Reset the race window to NOW? All previously-counted invites will fall outside the leaderboard.",
            )
          }
          disabled={status.apex_unlocked || busy === "reset-race"}
          data-testid="apex-reset-race"
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-700 text-slate-200 text-[11px] uppercase tracking-widest font-black hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset Race Window
        </button>
      </div>

      {last && (
        <p
          className="text-[11px] font-mono p-2 rounded bg-slate-900/70 border border-slate-700 text-slate-300 break-all"
          data-testid="apex-last-action"
        >
          {last.includes("FAILED") ? (
            <AlertTriangle className="inline w-3 h-3 mr-1 text-rose-400" />
          ) : (
            <Check className="inline w-3 h-3 mr-1 text-emerald-400" />
          )}
          {last}
        </p>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "amber" | "emerald" | "slate";
}) {
  const accentClass =
    accent === "amber"
      ? "border-amber-400/40 bg-amber-500/[0.06] text-amber-200"
      : accent === "emerald"
      ? "border-emerald-400/40 bg-emerald-500/[0.06] text-emerald-200"
      : "border-slate-700 bg-slate-800/40 text-slate-300";
  return (
    <div className={`rounded-lg p-3 border ${accentClass}`}>
      <p className="text-[9px] uppercase tracking-widest opacity-70">{label}</p>
      <p className="text-sm font-black mt-1 break-all">{value}</p>
    </div>
  );
}

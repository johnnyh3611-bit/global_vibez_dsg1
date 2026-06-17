/**
 * GeniusPhaseProgress — public progress bar + per-user cap status.
 *
 * Reads GET /api/chairs/genius-cap (auth optional — when the caller
 * is signed in we also surface their personal `user_remaining`
 * allowance, so the UI can pre-clamp the purchase quantity input).
 *
 * Three informational states, driven by backend:
 *   1. `cap_active=true` + Genius still has supply → show the classic
 *      "Genius Phase Progress" bar + per-user cap counter.
 *   2. `cap_active=false` (admin flipped switch OR phase rolled past
 *      Genius) → show "Open Phase Active" badge + system-wide progress
 *      toward 1M total supply.
 *   3. `genius_remaining_total=0` → "Genius Phase Complete — Next Phase
 *      Unlocked" banner (the celebration).
 *
 * No hardcoded limits — ALL numbers come from the backend so the UI
 * stays perfectly in sync with `chairs.py::PHASES` and the admin
 * toggle.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Lock, Unlock, CheckCircle } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

type CapState = {
  current_phase: string;
  cap_active: boolean;
  per_user_cap: number;
  genius_phase_limit: number;
  genius_sold: number;
  genius_remaining_total: number;
  user_remaining: number | null;
  total_supply: number;
};

export default function GeniusPhaseProgress() {
  const [state, setState] = useState<CapState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        // Try authed first — falls back to public if no token.
        const token = localStorage.getItem("auth_token");
        const r = token
          ? await authFetch(`${API}/api/chairs/genius-cap`)
          : await fetch(`${API}/api/chairs/genius-cap`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as CapState;
        setState(data);
      } catch (e: any) {
        setError(e?.message || "Failed to load phase progress");
      }
    };
    void load();
    const interval = setInterval(load, 30_000); // live-refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <div
        className="p-4 border border-rose-500/40 bg-rose-950/30 rounded-xl text-rose-200 text-sm"
        data-testid="genius-progress-error"
      >
        {error}
      </div>
    );
  }
  if (!state) {
    return (
      <div
        className="p-6 bg-slate-950/60 border border-white/10 rounded-xl animate-pulse"
        data-testid="genius-progress-loading"
      >
        <div className="h-4 bg-white/10 rounded w-1/3 mb-3" />
        <div className="h-4 bg-white/5 rounded w-full" />
      </div>
    );
  }

  const isGenius = state.current_phase === "Genius";
  const systemProgress =
    (state.genius_sold / Math.max(1, state.genius_phase_limit)) * 100;
  const totalProgress =
    ((state.total_supply - state.genius_remaining_total) /
      Math.max(1, state.total_supply)) *
    100;
  const userUsed =
    state.user_remaining != null
      ? Math.max(0, state.per_user_cap - state.user_remaining)
      : null;
  const userProgress =
    userUsed != null
      ? (userUsed / Math.max(1, state.per_user_cap)) * 100
      : 0;

  const filled = state.genius_remaining_total === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 bg-gradient-to-br from-slate-950 via-slate-950 to-cyan-950/30 border border-cyan-500/30 rounded-2xl"
      data-testid="genius-phase-progress"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-cyan-400" />
          {isGenius ? "Genius Phase Progress" : `${state.current_phase} Progress`}
        </h3>
        <span
          className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full border ${
            state.cap_active
              ? "bg-amber-500/10 border-amber-500/40 text-amber-300"
              : "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
          }`}
          data-testid="genius-cap-state-pill"
        >
          {state.cap_active ? (
            <span className="inline-flex items-center gap-1">
              <Lock className="h-3 w-3" /> {state.per_user_cap} per user
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <Unlock className="h-3 w-3" /> Open phase
            </span>
          )}
        </span>
      </div>

      {/* System-wide Genius progress */}
      <div
        className="w-full bg-slate-800/60 h-3 rounded-full overflow-hidden"
        data-testid="genius-phase-bar"
      >
        <div
          className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-700"
          style={{ width: `${Math.min(100, systemProgress)}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-cyan-400/90">
        {state.genius_sold.toLocaleString()} /{" "}
        {state.genius_phase_limit.toLocaleString()} Genius chairs released
        <span className="text-slate-500"> · {systemProgress.toFixed(2)}%</span>
      </p>

      {/* Per-user cap (only when cap active + user signed in) */}
      {state.cap_active && state.user_remaining != null && (
        <div className="mt-4 pt-4 border-t border-white/5" data-testid="user-cap-block">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
            <span>Your personal cap</span>
            <span data-testid="user-cap-remaining">
              {state.user_remaining} remaining of {state.per_user_cap}
            </span>
          </div>
          <div className="w-full bg-slate-800/60 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                userProgress >= 100
                  ? "bg-rose-500"
                  : "bg-gradient-to-r from-amber-400 to-cyan-400"
              }`}
              style={{ width: `${Math.min(100, userProgress)}%` }}
            />
          </div>
        </div>
      )}

      {filled && (
        <div
          className="mt-4 p-3 bg-emerald-500/20 text-emerald-300 text-center border border-emerald-500/50 rounded-lg animate-pulse flex items-center justify-center gap-2"
          data-testid="genius-phase-complete-banner"
        >
          <CheckCircle className="h-4 w-4" />
          <span className="text-sm font-semibold uppercase tracking-wider">
            Genius Phase Complete — Next Phase Unlocked
          </span>
        </div>
      )}

      {/* Long-term supply pulse (always visible) */}
      <div className="mt-4 pt-4 border-t border-white/5">
        <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">
          Long-term supply
        </p>
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-slate-800/40 h-1.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-slate-500/60"
              style={{ width: `${Math.min(100, totalProgress)}%` }}
            />
          </div>
          <span className="text-[11px] text-slate-400">
            {(state.total_supply - state.genius_remaining_total).toLocaleString()} /{" "}
            {state.total_supply.toLocaleString()}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

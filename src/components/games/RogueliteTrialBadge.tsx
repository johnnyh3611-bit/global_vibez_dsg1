/**
 * RogueliteTrialBadge — Cyber-Casino 24-hour permadeath ladder UI
 * (Revolutionary Games Blueprint v1, May 2026 §Roguelite Chess Trial).
 *
 * Renders a slim badge in the PracticeChess header that shows:
 *   • Lives remaining (heart row)
 *   • Today's score
 *   • Streak counter (flame)
 *   • Time to reset (h:mm)
 *
 * Caller wires `recordOutcome(outcome, eloDiff)` when a chess game ends
 * so the trial state stays in sync.
 */
import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Flame, Trophy, Clock } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

interface TrialState {
  day_key: string;
  lives: number;
  score: number;
  streak: number;
  started_at: string;
  ends_at: string;
  is_alive: boolean;
}

const fetchAuth = async (path: string, init?: RequestInit) => {
  const token = localStorage.getItem("session_token") || localStorage.getItem("auth_token");
  return fetch(`${API}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
};

export const RogueliteTrialBadge: React.FC<{
  /** Wire from the parent: when a chess game ends, call this with the
   *  outcome so the badge debits a life on loss / adds points on win. */
  outcomeRef?: React.MutableRefObject<(outcome: "win" | "loss" | "draw", eloDiff?: number) => Promise<void>>;
}> = ({ outcomeRef }) => {
  const [state, setState] = useState<TrialState | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  const refresh = useCallback(async () => {
    try {
      const res = await fetchAuth("/api/roguelite-chess/state");
      if (res.ok) setState(await res.json());
    } catch {
      // Optional UI — silent fall-through.
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, [refresh]);

  // Expose `recordOutcome` to the parent via the supplied ref so the
  // chess page can call it when a game ends.
  const recordOutcome = useCallback(
    async (outcome: "win" | "loss" | "draw", eloDiff: number = 0) => {
      try {
        const res = await fetchAuth("/api/roguelite-chess/record-result", {
          method: "POST",
          body: JSON.stringify({ outcome, elo_diff: eloDiff }),
        });
        if (res.ok) {
          setState(await res.json());
        }
      } catch {
        /* silent */
      }
    },
    [],
  );

  useEffect(() => {
    if (outcomeRef) outcomeRef.current = recordOutcome;
  }, [outcomeRef, recordOutcome]);

  if (!state) return null;

  const ends = Date.parse(state.ends_at);
  const remainingMs = Math.max(0, ends - now);
  const hours = Math.floor(remainingMs / 3600000);
  const minutes = Math.floor((remainingMs % 3600000) / 60000);

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      data-testid="roguelite-trial-badge"
      className="flex items-center gap-3 px-3 py-1.5 rounded-full backdrop-blur border bg-slate-950/80"
      style={{
        borderColor: state.is_alive ? "rgba(34, 211, 238, 0.4)" : "rgba(244, 63, 94, 0.4)",
        boxShadow: state.is_alive
          ? "0 0 16px rgba(34, 211, 238, 0.2)"
          : "0 0 16px rgba(244, 63, 94, 0.25)",
      }}
    >
      <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-cyan-300">
        Trial
      </span>

      {/* Lives */}
      <div
        className="flex items-center gap-0.5"
        data-testid="roguelite-lives"
        title={`${state.lives} lives remaining`}
      >
        {Array.from({ length: 3 }).map((_, i) => {
          const alive = i < state.lives;
          return (
            <Heart
              key={i}
              className={`w-3.5 h-3.5 ${
                alive ? "fill-rose-500 text-rose-500" : "text-slate-700"
              }`}
            />
          );
        })}
      </div>

      {/* Score */}
      <div
        className="flex items-center gap-1 text-amber-300"
        data-testid="roguelite-score"
      >
        <Trophy className="w-3.5 h-3.5" />
        <span className="text-xs font-black tabular-nums">
          {state.score.toLocaleString()}
        </span>
      </div>

      {/* Streak */}
      {state.streak > 0 && (
        <div
          className="flex items-center gap-1 text-orange-400"
          data-testid="roguelite-streak"
        >
          <Flame className="w-3.5 h-3.5" />
          <span className="text-xs font-black">{state.streak}</span>
        </div>
      )}

      {/* Reset timer */}
      <div className="flex items-center gap-1 text-slate-300 text-[11px] font-mono">
        <Clock className="w-3 h-3" />
        {hours}h {String(minutes).padStart(2, "0")}m
      </div>

      <AnimatePresence>
        {!state.is_alive && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/40 text-[10px] font-mono uppercase tracking-wider text-rose-300"
          >
            Eliminated
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default RogueliteTrialBadge;

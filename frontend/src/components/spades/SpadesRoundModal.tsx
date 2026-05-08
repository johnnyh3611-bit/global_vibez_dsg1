/**
 * SpadesRoundModal — Between-round stats popup.
 *
 * Per the user: "In between every game, we need a popup that give the
 * game score, the game statistics before the next round start."
 *
 * Shows:
 *   • Hero banner: "Round Complete" + amber trophy
 *   • Per-team breakdown: bid · books won · made/missed · bags earned ·
 *     delta this round · running total
 *   • Per-player stats: name · bid · tricks taken · hit-rate this round
 *   • Running totals toward 200 with a progress bar
 *   • **Auto-advance countdown bar (Feb 2026)**: user said "there should
 *     be a pop-up before the next round that lasts about 5 seconds to
 *     show everything so people could read it. Then they go on to the
 *     next round." So the modal now ticks down a visible progress bar
 *     and auto-fires `onClose()` after 5 s. User can still click
 *     "Next Hand" to skip the countdown.
 *
 * Aesthetic: emerald/amber Vibe Wiz Premium — matches the table.
 */
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Spade, Trophy } from "lucide-react";
import type { SpadesPlayerView, SpadesPosition, SpadesScores } from "./types";

interface Props {
  open: boolean;
  summary: {
    team1Score: number;
    team2Score: number;
    delta1: number;
    delta2: number;
  } | null;
  scores?: SpadesScores;
  players?: Record<SpadesPosition, SpadesPlayerView>;
  onClose: () => void;
  /** Auto-advance after N ms (default 5000). Pass 0 to disable. */
  autoAdvanceMs?: number;
}

export const SpadesRoundModal: React.FC<Props> = ({
  open,
  summary,
  scores,
  players,
  onClose,
  autoAdvanceMs = 5000,
}) => {
  // Compute aggregate team bid/tricks for the round from the player view.
  const team1Bid = (players?.north?.bid ?? 0) + (players?.south?.bid ?? 0);
  const team1Tricks =
    (players?.north?.tricks ?? 0) + (players?.south?.tricks ?? 0);
  const team2Bid = (players?.east?.bid ?? 0) + (players?.west?.bid ?? 0);
  const team2Tricks =
    (players?.east?.tricks ?? 0) + (players?.west?.tricks ?? 0);

  const team1Made = team1Tricks >= team1Bid && team1Bid > 0;
  const team2Made = team2Tricks >= team2Bid && team2Bid > 0;

  const progress = (pts: number) => Math.min(100, Math.max(0, (pts / 200) * 100));

  // ─── Auto-advance countdown ─────────────────────────────────────────
  // Ticks down from `autoAdvanceMs` once the modal opens; when it hits
  // 0, calls onClose() to start the next hand. Resets when modal closes
  // so re-opening always gives the user the full review window.
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!open || !summary || autoAdvanceMs <= 0) return;
    setElapsed(0);
    const start = Date.now();
    const interval = window.setInterval(() => {
      const e = Date.now() - start;
      if (e >= autoAdvanceMs) {
        window.clearInterval(interval);
        onClose();
      } else {
        setElapsed(e);
      }
    }, 100);
    return () => window.clearInterval(interval);
  }, [open, summary, autoAdvanceMs, onClose]);

  const countdownPct = autoAdvanceMs > 0
    ? Math.min(100, (elapsed / autoAdvanceMs) * 100)
    : 0;
  const secondsLeft = autoAdvanceMs > 0
    ? Math.max(0, Math.ceil((autoAdvanceMs - elapsed) / 1000))
    : 0;

  return (
    <AnimatePresence>
      {open && summary ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[65] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 md:p-4"
          data-testid="spades-round-modal"
        >
          <motion.div
            initial={{ scale: 0.88, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-3xl bg-gradient-to-br from-emerald-950 via-[#0a1a12] to-[#050507] border-2 border-amber-500/50 shadow-[0_0_60px_rgba(251,191,36,0.25)] overflow-hidden"
          >
            {/* Auto-advance countdown bar at the very top */}
            {autoAdvanceMs > 0 ? (
              <div
                className="relative h-1 bg-amber-500/10"
                data-testid="spades-round-countdown"
              >
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]"
                  style={{ width: `${countdownPct}%`, transition: "width 0.1s linear" }}
                />
              </div>
            ) : null}

            {/* Hero */}
            <div className="relative px-6 py-5 text-center bg-gradient-to-b from-amber-500/10 to-transparent border-b border-amber-500/20">
              <Trophy className="w-10 h-10 text-amber-300 mx-auto mb-1.5" />
              <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300/80 font-bold">
                Round Complete
              </p>
              <h2
                className="text-2xl md:text-3xl font-black text-white"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                Round Score
              </h2>
            </div>

            {/* Team breakdown */}
            <div className="grid grid-cols-2 divide-x divide-amber-500/15">
              <TeamBreakdown
                label="Your Team"
                tone="red"
                total={summary.team1Score}
                delta={summary.delta1}
                bid={team1Bid}
                tricks={team1Tricks}
                bags={scores?.team1.bags ?? 0}
                made={team1Made}
              />
              <TeamBreakdown
                label="Opponents"
                tone="blue"
                total={summary.team2Score}
                delta={summary.delta2}
                bid={team2Bid}
                tricks={team2Tricks}
                bags={scores?.team2.bags ?? 0}
                made={team2Made}
              />
            </div>

            {/* Progress bars */}
            <div className="px-5 py-4 border-t border-amber-500/10 space-y-2.5">
              <ProgressRow
                label="Your Team → 200"
                pct={progress(summary.team1Score)}
                value={summary.team1Score}
                tone="red"
              />
              <ProgressRow
                label="Opponents → 200"
                pct={progress(summary.team2Score)}
                value={summary.team2Score}
                tone="blue"
              />
            </div>

            {/* Per-player stats */}
            {players ? (
              <div className="px-5 py-4 border-t border-amber-500/10">
                <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300/80 font-bold mb-2.5">
                  Player Stats · This Round
                </p>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {(["north", "east", "south", "west"] as SpadesPosition[]).map(
                    (pos) => {
                      const p = players[pos];
                      if (!p) return null;
                      const made =
                        p.bid > 0 && p.tricks >= p.bid
                          ? "made"
                          : p.bid === 0
                            ? p.tricks === 0
                              ? "nil-ok"
                              : "nil-bust"
                            : "missed";
                      const madeLabel =
                        made === "made"
                          ? "✓ Made"
                          : made === "nil-ok"
                            ? "✓ Nil"
                            : made === "nil-bust"
                              ? "✗ Nil Busted"
                              : "✗ Missed";
                      const madeColor =
                        made === "made" || made === "nil-ok"
                          ? "text-emerald-300"
                          : "text-rose-300";
                      return (
                        <div
                          key={pos}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-slate-950/60 border border-amber-500/15"
                          data-testid={`spades-round-player-${pos}`}
                        >
                          <div>
                            <p
                              className={`text-[10px] font-bold uppercase tracking-wider ${
                                p.team === "team1" ? "text-red-400" : "text-blue-400"
                              }`}
                              style={{ fontFamily: "'Cinzel', serif" }}
                            >
                              {pos}
                            </p>
                            <p className="text-white/60 text-[10px]">
                              Bid {p.bid} · Won {p.tricks}
                            </p>
                          </div>
                          <span className={`font-bold text-[10px] ${madeColor}`}>
                            {madeLabel}
                          </span>
                        </div>
                      );
                    },
                  )}
                </div>
              </div>
            ) : null}

            {/* CTA */}
            <div className="px-5 pb-5 pt-2 border-t border-amber-500/10">
              <div className="text-[10px] text-center text-amber-300/60 uppercase tracking-wider mb-3 flex items-center justify-center gap-1">
                <Spade className="w-3 h-3" /> First to 200 wins the table
              </div>
              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 hover:from-amber-400 hover:to-yellow-400 text-[#3a2500] font-black uppercase tracking-widest text-sm shadow-[0_0_18px_rgba(251,191,36,0.4)]"
                data-testid="spades-round-continue"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                {autoAdvanceMs > 0 && secondsLeft > 0
                  ? `Next Hand · ${secondsLeft}s`
                  : "Next Hand"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

const TeamBreakdown: React.FC<{
  label: string;
  tone: "red" | "blue";
  total: number;
  delta: number;
  bid: number;
  tricks: number;
  bags: number;
  made: boolean;
}> = ({ label, tone, total, delta, bid, tricks, bags, made }) => {
  const color = tone === "red" ? "text-red-400" : "text-blue-400";
  const dotClass = tone === "red" ? "bg-red-500" : "bg-blue-500";
  const deltaColor =
    delta > 0 ? "text-emerald-300" : delta < 0 ? "text-rose-300" : "text-white/50";
  const deltaPrefix = delta > 0 ? "+" : "";
  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`inline-block w-2 h-2 rounded-full ${dotClass}`} />
        <p
          className={`text-[10px] uppercase tracking-[0.25em] font-black ${color}`}
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          {label}
        </p>
        {total >= 200 ? <Crown className="w-3 h-3 text-amber-300 ml-auto" /> : null}
      </div>
      <p
        className="text-3xl md:text-4xl font-black text-white tabular-nums leading-none"
        style={{ fontFamily: "'Cinzel', serif" }}
      >
        {total}
      </p>
      <p className={`mt-1 text-xs font-bold tabular-nums ${deltaColor}`}>
        {deltaPrefix}
        {delta} this round
      </p>
      <div className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] uppercase tracking-wider">
        <span className="text-white/40">Bid</span>
        <span className="text-right text-cyan-300 tabular-nums">{bid}</span>
        <span className="text-white/40">Books</span>
        <span className="text-right text-amber-300 tabular-nums">{tricks}</span>
        <span className="text-white/40">Bags</span>
        <span
          className={`text-right font-black tabular-nums ${
            bags >= 4 ? "text-rose-300" : bags >= 3 ? "text-amber-200" : "text-emerald-300"
          }`}
        >
          {bags}/5
        </span>
        <span className="text-white/40">Result</span>
        <span
          className={`text-right font-black ${made ? "text-emerald-300" : "text-rose-300"}`}
        >
          {made ? "Made" : "Missed"}
        </span>
      </div>
    </div>
  );
};

const ProgressRow: React.FC<{
  label: string;
  pct: number;
  value: number;
  tone: "red" | "blue";
}> = ({ label, pct, value, tone }) => {
  const barColor =
    tone === "red"
      ? "from-red-500 to-red-400"
      : "from-blue-500 to-blue-400";
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider mb-1">
        <span className="text-white/50">{label}</span>
        <span className="text-white/70 tabular-nums font-mono">{value} / 200</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-950/80 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className={`h-full rounded-full bg-gradient-to-r ${barColor}`}
        />
      </div>
    </div>
  );
};

export default SpadesRoundModal;

/**
 * SpadesScoreBadge — Compressed "points to 200" overlay.
 *
 * Replaces the twin-block score panel with a single compact badge so
 * the table has room to breathe (user: "compress some of this stuff
 * together"). Shows both teams' points side-by-side in amber Cinzel
 * text over a dark slate pill. Sits floating in the top-right of the
 * arena.
 *
 * Drawer: clicking the badge expands a detailed breakdown (bid totals,
 * bag pressure, contract status). Matches the amber Cinzel scoreboard
 * aesthetic of BidWhistPremium.
 */
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Crown } from "lucide-react";
import type { SpadesScores, SpadesPlayerView, SpadesPosition, SpadesPhase } from "./types";

interface Props {
  scores: SpadesScores;
  players: Record<SpadesPosition, SpadesPlayerView>;
  phase: SpadesPhase;
  tricksPlayed: number;
}

export const SpadesScoreBadge: React.FC<Props> = ({
  scores,
  players,
  phase,
  tricksPlayed,
}) => {
  const [open, setOpen] = useState(false);

  const team1Bid = (players.north?.bid ?? 0) + (players.south?.bid ?? 0);
  const team1Tricks = (players.north?.tricks ?? 0) + (players.south?.tricks ?? 0);
  const team2Bid = (players.east?.bid ?? 0) + (players.west?.bid ?? 0);
  const team2Tricks = (players.east?.tricks ?? 0) + (players.west?.tricks ?? 0);

  const phaseLabel =
    phase === "bidding"
      ? "Bidding"
      : phase === "playing"
        ? `Trick ${Math.min(tricksPlayed + 1, 13)}/13`
        : phase === "scoring"
          ? "Scoring"
          : "Game Over";

  return (
    <div
      className="relative inline-block"
      data-testid="spades-score-badge"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-lg bg-slate-950/90 backdrop-blur border-2 border-amber-500/60 shadow-[0_0_12px_rgba(251,191,36,0.25)]"
        data-testid="spades-score-badge-btn"
      >
        {/* Team 1 (red) */}
        <div className="flex items-baseline gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500" />
          <span
            className="text-base md:text-lg font-black text-red-400 tabular-nums leading-none"
            style={{ fontFamily: "'Cinzel', serif" }}
            data-testid="spades-score-team1-badge"
          >
            {scores.team1.points}
          </span>
          {scores.team1.points >= 200 ? <Crown className="w-3 h-3 text-amber-300" /> : null}
        </div>

        <span className="text-amber-500/50 font-bold">·</span>

        {/* Team 2 (blue) */}
        <div className="flex items-baseline gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />
          <span
            className="text-base md:text-lg font-black text-blue-400 tabular-nums leading-none"
            style={{ fontFamily: "'Cinzel', serif" }}
            data-testid="spades-score-team2-badge"
          >
            {scores.team2.points}
          </span>
          {scores.team2.points >= 200 ? <Crown className="w-3 h-3 text-amber-300" /> : null}
        </div>

        <span className="text-amber-300/50 text-[9px] md:text-[10px] uppercase tracking-[0.25em] font-bold hidden md:inline-block">
          / 200
        </span>

        <ChevronDown
          size={12}
          className={`text-amber-400/60 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Phase label — micro-text directly below */}
      <p className="mt-0.5 text-center text-[8px] md:text-[9px] uppercase tracking-[0.3em] text-amber-300/70 font-bold">
        {phaseLabel}
      </p>

      {/* ── Expanded drawer ── */}
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="absolute top-full right-0 mt-2 min-w-[240px] z-50"
          >
            <div className="bg-slate-950/95 backdrop-blur-xl border-2 border-amber-500/60 rounded-xl p-3 shadow-2xl">
              <div className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-[10px] uppercase font-bold tracking-widest">
                <div />
                <div className="text-red-400 text-right">YOUR</div>
                <div className="text-blue-400 text-right">OPP</div>

                <div className="text-white/40">Score</div>
                <div className="text-right text-white tabular-nums">
                  {scores.team1.points}
                </div>
                <div className="text-right text-white tabular-nums">
                  {scores.team2.points}
                </div>

                <div className="text-white/40">Contract</div>
                <div className="text-right text-cyan-300 tabular-nums">
                  {team1Bid || "—"}
                </div>
                <div className="text-right text-cyan-300 tabular-nums">
                  {team2Bid || "—"}
                </div>

                <div className="text-white/40">Books</div>
                <div className="text-right text-amber-400 tabular-nums">
                  {team1Tricks}
                </div>
                <div className="text-right text-amber-400 tabular-nums">
                  {team2Tricks}
                </div>

                <div className="text-white/40">Bags</div>
                <div
                  className={`text-right font-black tabular-nums ${bagTone(scores.team1.bags)}`}
                >
                  {scores.team1.bags}/5
                </div>
                <div
                  className={`text-right font-black tabular-nums ${bagTone(scores.team2.bags)}`}
                >
                  {scores.team2.bags}/5
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

function bagTone(bags: number): string {
  if (bags >= 4) return "text-rose-300";
  if (bags >= 3) return "text-amber-200";
  return "text-emerald-300";
}

export default SpadesScoreBadge;

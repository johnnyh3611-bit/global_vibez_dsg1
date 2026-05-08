/**
 * SpadesScorePanel — Big Wiz style scoreboard.
 *
 * Matches the BidWhistPremiumAAA aesthetic:
 *   • Team 1 (you + partner) → RED
 *   • Team 2 (opponents)     → BLUE
 *   • Cinzel imperial serif for totals
 *   • Click-to-expand dropdowns showing bid totals + bag tracker
 *   • Sticky at the top so the score is never out of view while playing
 *   • Mobile: collapses tighter but keeps both teams side-by-side
 */
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Crown, Spade } from "lucide-react";
import type { SpadesPhase, SpadesScores, SpadesPlayerView, SpadesPosition } from "./types";

interface Props {
  scores: SpadesScores;
  phase: SpadesPhase;
  tricksPlayed: number;
  players: Record<SpadesPosition, SpadesPlayerView>;
}

export const SpadesScorePanel: React.FC<Props> = ({
  scores,
  phase,
  tricksPlayed,
  players,
}) => {
  // Aggregate per-team bid totals from the player view.
  const team1Bid =
    (players.north?.bid ?? 0) + (players.south?.bid ?? 0);
  const team1Tricks =
    (players.north?.tricks ?? 0) + (players.south?.tricks ?? 0);
  const team2Bid =
    (players.east?.bid ?? 0) + (players.west?.bid ?? 0);
  const team2Tricks =
    (players.east?.tricks ?? 0) + (players.west?.tricks ?? 0);

  return (
    <div
      className="grid grid-cols-2 gap-2 md:gap-3 mb-3"
      data-testid="spades-score-panel"
    >
      <TeamBlock
        team="team1"
        label="Your Team"
        tone="red"
        members={[players.north?.name ?? "North", players.south?.name ?? "You"]}
        points={scores.team1.points}
        bags={scores.team1.bags}
        teamBid={team1Bid}
        teamTricks={team1Tricks}
        showCrown={scores.team1.points >= 200}
      />
      <TeamBlock
        team="team2"
        label="Opponents"
        tone="blue"
        members={[players.east?.name ?? "East", players.west?.name ?? "West"]}
        points={scores.team2.points}
        bags={scores.team2.bags}
        teamBid={team2Bid}
        teamTricks={team2Tricks}
        showCrown={scores.team2.points >= 200}
      />
      <div className="col-span-2 flex items-center justify-center text-[9px] uppercase tracking-[0.3em] text-cyan-300/40 mt-1 font-['Cinzel']">
        <Spade className="w-3 h-3 mr-1" />
        {phase === "bidding"
          ? "Bidding phase"
          : phase === "playing"
            ? `Trick ${Math.min(tricksPlayed + 1, 13)} / 13`
            : phase === "scoring"
              ? "Scoring…"
              : "Game over"}
      </div>
    </div>
  );
};

interface TeamBlockProps {
  team: "team1" | "team2";
  label: string;
  tone: "red" | "blue";
  members: string[];
  points: number;
  bags: number;
  teamBid: number;
  teamTricks: number;
  showCrown: boolean;
}

const TeamBlock: React.FC<TeamBlockProps> = ({
  team,
  label,
  tone,
  members,
  points,
  bags,
  teamBid,
  teamTricks,
  showCrown,
}) => {
  const [open, setOpen] = useState(false);

  const palette =
    tone === "red"
      ? {
          border: "border-red-500/50",
          bgFrom: "from-red-600/15",
          bgTo:   "to-red-900/10",
          accent: "text-red-300",
          pill:   "bg-red-500",
        }
      : {
          border: "border-blue-500/50",
          bgFrom: "from-blue-600/15",
          bgTo:   "to-blue-900/10",
          accent: "text-blue-300",
          pill:   "bg-blue-500",
        };

  // Bag urgency coloring: 0-2 normal, 3 warn amber, 4 danger rose.
  const bagTone =
    bags >= 4
      ? "bg-rose-500/25 text-rose-100 border-rose-500/50"
      : bags >= 3
        ? "bg-amber-500/20 text-amber-200 border-amber-500/40"
        : "bg-black/30 text-purple-100 border-white/5";

  return (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      className={`relative text-left rounded-2xl border-2 ${palette.border} bg-gradient-to-br ${palette.bgFrom} ${palette.bgTo} backdrop-blur-md p-3 md:p-4 transition-all ${
        open ? "shadow-[0_0_24px_rgba(255,255,255,0.08)]" : ""
      }`}
      data-testid={`spades-score-${team}`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2 h-2 rounded-full ${palette.pill}`}
          />
          <p
            className={`text-[10px] font-black uppercase tracking-[0.25em] ${palette.accent}`}
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            {label}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {showCrown ? <Crown className="w-3 h-3 text-amber-300" /> : null}
          <ChevronDown
            size={12}
            className={`transition-transform text-white/40 ${open ? "rotate-180" : ""}`}
          />
        </div>
      </div>

      {/* Main score row */}
      <div className="flex items-baseline gap-2">
        <span
          className="text-3xl md:text-4xl font-black text-white tabular-nums leading-none"
          style={{ fontFamily: "'Cinzel', serif" }}
          data-testid={`spades-score-${team}-points`}
        >
          {points}
        </span>
        <span className="text-[10px] uppercase tracking-widest text-white/50">
          / 200
        </span>
      </div>

      {/* Quick chips (bid + tricks + bags) */}
      <div className="mt-2 flex items-center gap-1.5 flex-wrap text-[9px] md:text-[10px] uppercase tracking-wider">
        <span className="px-1.5 py-0.5 rounded border border-cyan-400/20 bg-black/30 text-cyan-200">
          Bid <strong className="text-white">{teamBid}</strong>
        </span>
        <span className="px-1.5 py-0.5 rounded border border-emerald-400/20 bg-black/30 text-emerald-200">
          Books <strong className="text-white">{teamTricks}</strong>
        </span>
        <span
          className={`px-1.5 py-0.5 rounded border ${bagTone} font-mono font-black`}
          data-testid={`spades-score-${team}-bags`}
        >
          {bags}/5 bags
        </span>
      </div>

      {/* Big Wiz style pop-down drawer */}
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px] uppercase font-bold tracking-widest">
              <div className="text-white/40">Members</div>
              <div className={`text-right ${palette.accent} truncate`}>
                {members.join(" + ")}
              </div>
              <div className="text-white/40">Contract</div>
              <div className="text-right text-white">
                {teamBid === 0
                  ? "—"
                  : `${teamBid} book${teamBid === 1 ? "" : "s"}`}
              </div>
              <div className="text-white/40">Books won</div>
              <div className="text-right text-cyan-300">{teamTricks}</div>
              <div className="text-white/40">Under by</div>
              <div className="text-right text-white">
                {teamBid > 0 ? Math.max(teamBid - teamTricks, 0) : "—"}
              </div>
              <div className="text-white/40">Bag pressure</div>
              <div
                className={`text-right ${bags >= 4 ? "text-rose-300" : bags >= 3 ? "text-amber-200" : "text-emerald-300"}`}
              >
                {bags >= 4 ? "Critical" : bags >= 3 ? "Tight" : "Safe"}
              </div>
              <div className="text-white/40">Points to 200</div>
              <div className="text-right text-white">{Math.max(200 - points, 0)}</div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </button>
  );
};

export default SpadesScorePanel;

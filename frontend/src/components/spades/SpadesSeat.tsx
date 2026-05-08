/**
 * SpadesSeat — Vibe Wiz Premium "Player Badge" styling.
 *
 * Matches BidWhistPremium's PlayerBadge design exactly:
 *   • Pill button with Red (team1) or Blue (team2) border
 *   • Crown icon if this is YOU
 *   • Cinzel font, UPPERCASE position name
 *   • Amber "book count cube" at the right edge showing tricks won
 *   • Dealer chip to the left when this seat is the dealer
 *   • No drawer — score is fully embedded in the badge itself (the
 *     compressed design the user asked for)
 *   • Pulses cyan while it's this player's turn
 */
import React from "react";
import { motion } from "framer-motion";
import { Bot, Crown } from "lucide-react";
import ShotClockRing from "@/components/games/ShotClockRing";
import type { SpadesPlayerView, SpadesPosition } from "./types";

interface Props {
  position: SpadesPosition;
  player: SpadesPlayerView;
  isTurn: boolean;
  isYou: boolean;
  isDealer?: boolean;
  onClick?: () => void;
  /** Optional 10-second turn timer (Universal Design Agent §2). When
      provided AND `isTurn`, draws the SVG ring around the badge. */
  shotClockExpiresAt?: number | null;
  onShotClockExpire?: () => void;
}

const TEAM: Record<"team1" | "team2", { border: string; ring: string; bg: string; text: string }> = {
  team1: {
    border: "border-red-500",
    ring:   "ring-red-400",
    bg:     "bg-red-900/30",
    text:   "text-red-400",
  },
  team2: {
    border: "border-blue-500",
    ring:   "ring-blue-400",
    bg:     "bg-blue-900/30",
    text:   "text-blue-400",
  },
};

// East and west sit on the short sides of the table. Rotating their
// badges 90° makes the text read along the table's width (like real
// players facing you from the sides of a card table). Per the user:
// "turn west and east, the width way of the, of the table".
const ROTATION_BY_POSITION: Record<SpadesPosition, string> = {
  north: "",                       // text stays upright
  south: "",                       // text stays upright
  east:  "rotate-90",              // clockwise 90°: reads top→bottom when you look right
  west:  "-rotate-90",             // counter-clockwise 90°: reads bottom→top when you look left
};

export const SpadesSeat: React.FC<Props> = ({
  position,
  player,
  isTurn,
  isYou,
  isDealer = false,
  onClick,
  shotClockExpiresAt,
  onShotClockExpire,
}) => {
  const team = TEAM[player.team] ?? TEAM.team1;
  const rotation = ROTATION_BY_POSITION[position];

  const seatBody = (
    <div
      className={`flex items-center gap-1.5 md:gap-2 ${rotation}`}
      data-testid={`spades-seat-${position}`}
    >
      {/* ── Dealer chip (poker-style) ── */}
      {isDealer ? (
        <motion.div
          initial={{ scale: 0, rotate: 180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
          className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-white border-2 border-amber-500 shadow-lg flex items-center justify-center"
          title="Dealer"
          data-testid={`spades-dealer-chip-${position}`}
        >
          <span className="text-amber-900 font-black text-xs md:text-sm">D</span>
        </motion.div>
      ) : null}

      {/* ── Player Badge ── */}
      <motion.button
        type="button"
        onClick={onClick}
        animate={
          isTurn
            ? {
                boxShadow: [
                  "0 0 0px rgba(34,211,238,0)",
                  "0 0 20px rgba(34,211,238,0.5)",
                  "0 0 0px rgba(34,211,238,0)",
                ],
              }
            : { boxShadow: "0 0 0px rgba(34,211,238,0)" }
        }
        transition={{ duration: 1.6, repeat: isTurn ? Infinity : 0 }}
        className={`px-3 py-1.5 md:px-4 md:py-2 border-2 backdrop-blur-sm shadow-lg rounded-lg flex items-center gap-1.5 md:gap-2 transition-transform hover:scale-105 ${team.bg} ${isYou ? `${team.border} ring-2 ${team.ring}` : team.border}`}
        data-testid={`spades-seat-btn-${position}`}
      >
        <div className="flex items-center gap-1 md:gap-1.5">
          {isYou ? <Crown className="w-3 h-3 text-amber-400" /> : null}
          {player.is_bot && !isYou ? (
            <Bot className="w-3 h-3 text-white/40" />
          ) : null}
          <span
            className={`font-bold uppercase tracking-wider text-[11px] md:text-sm ${team.text}`}
            style={{ fontFamily: "'Cinzel', serif" }}
            data-testid={`spades-seat-name-${position}`}
          >
            {position}
          </span>
        </div>

        {/* Bid progress pill — "tricks/bid" at a glance. Colour flips:
            • amber while under-bid (on track)
            • emerald-gold pulse when hit exactly (made contract)
            • rose when over bid (bags incoming)
            Pre-bid it shows a neutral dash so players can still read
            their seat identity. */}
        {(() => {
          const bid = player.bid ?? 0;
          const tricks = player.tricks ?? 0;
          const hasBid = bid > 0;
          const hit = hasBid && tricks === bid;
          const over = hasBid && tricks > bid;

          const pillClass = !hasBid
            ? "border-amber-500/60 bg-slate-950 text-amber-400"
            : hit
              ? "border-emerald-400 bg-emerald-500/15 text-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.45)]"
              : over
                ? "border-rose-400 bg-rose-500/15 text-rose-200"
                : "border-amber-500 bg-slate-950 text-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.3)]";

          return (
            <div
              className={`min-w-[2.25rem] md:min-w-[2.5rem] px-1.5 py-0.5 rounded-md border flex items-center justify-center tabular-nums ${pillClass}`}
              title={hasBid ? `${tricks} of ${bid} books won` : `${tricks} books won`}
              data-testid={`spades-seat-progress-${position}`}
            >
              <span
                className="text-[10px] md:text-[11px] font-black leading-none"
                style={{ fontFamily: "'Cinzel', serif" }}
                data-testid={`spades-seat-books-${position}`}
              >
                {hasBid ? `${tricks}/${bid}` : `${tricks}`}
              </span>
            </div>
          );
        })()}
      </motion.button>
    </div>
  );

  // Wrap with the universal 10-second Shot Clock ring when this seat
  // is the active turn AND a deadline was supplied. Otherwise render
  // the bare seat — zero overhead.
  if (isTurn && shotClockExpiresAt) {
    return (
      <ShotClockRing
        expiresAt={shotClockExpiresAt}
        onExpire={onShotClockExpire}
        size={130}
        strokeWidth={4}
      >
        {seatBody}
      </ShotClockRing>
    );
  }
  return seatBody;
};

export default SpadesSeat;

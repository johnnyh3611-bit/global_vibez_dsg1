/**
 * SpadesHandFan — The 13-card fan at the bottom of the table.
 *
 * Cards arc rotate -8° → +8° from left to right. Hovering lifts a card.
 * Illegal plays (per the backend's `validPlays` list) are dimmed and
 * non-clickable. The whole fan replays its dealing animation when the
 * `key` changes (we bump it after each new hand).
 *
 * **Suit grouping (Feb 2026)**: hands are auto-sorted by suit so clubs,
 * hearts, spades, diamonds are never intertwined — a player's eye can
 * instantly see "I have 3 spades, 4 clubs, 2 hearts, 4 diamonds."
 * Order is C-H-S-D (alternating black/red for visual separation);
 * within each suit cards sort HIGH→LOW (A, K, Q, J, 10, …).
 *
 * Wild/joker suits (used by UNO + Rummy) are sorted to the front.
 */
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import SpadesCard from "./SpadesCard";
import type { SpadesCard as SpadesCardData } from "./types";

interface Props {
  hand: SpadesCardData[];
  validPlays: SpadesCardData[];
  isYourTurn: boolean;
  onPlay: (card: SpadesCardData) => void;
  busy: boolean;
  /** Hides the "Your move / Waiting" text above the fan. Useful during
   *  the 10s review window where the fan is display-only and we don't
   *  want a redundant status line. */
  hideTurnIndicator?: boolean;
  /** Disables suit-grouping. Required for Gin Rummy / Rummy which
   *  intentionally group by MELD instead of by suit. */
  disableSuitSort?: boolean;
}

const cardKey = (c: SpadesCardData) => `${c.suit}-${c.rank}`;

// Rank order for sort — high ranks first within each suit.
// Aces are "high" in most trick games. Left/Right bowers in Euchre
// remain in-suit per their suit label (the engine re-labels them).
const RANK_ORDER: Record<string, number> = {
  A: 0, K: 1, Q: 2, J: 3,
  "10": 4, "9": 5, "8": 6, "7": 7, "6": 8, "5": 9, "4": 10, "3": 11, "2": 12,
};

// Alternating-colour suit order H ♥ → C ♣ → D ♦ → S ♠ (red / black /
// red / black) per Founder request 2026-02-05. Keeps suits from
// intertwining and matches the typical "colour-grouped" eye-scan most
// players prefer. Jokers/wilds render first so they're easy to spot.
const SUIT_ORDER: Record<string, number> = {
  joker: -1,    // UNO / Rummy wildcard
  hearts: 0,    // ♥ red
  clubs: 1,     // ♣ black
  diamonds: 2,  // ♦ red
  spades: 3,    // ♠ black
};

function sortBySuit(hand: SpadesCardData[]): SpadesCardData[] {
  return [...hand].sort((a, b) => {
    const sa = SUIT_ORDER[a.suit] ?? 99;
    const sb = SUIT_ORDER[b.suit] ?? 99;
    if (sa !== sb) return sa - sb;
    const ra = RANK_ORDER[String(a.rank)] ?? 99;
    const rb = RANK_ORDER[String(b.rank)] ?? 99;
    return ra - rb;
  });
}

export const SpadesHandFan: React.FC<Props> = ({
  hand,
  validPlays,
  isYourTurn,
  onPlay,
  busy,
  hideTurnIndicator = false,
  disableSuitSort = false,
}) => {
  const displayHand = disableSuitSort ? hand : sortBySuit(hand);
  const validKeys = new Set(validPlays.map(cardKey));
  const N = Math.max(displayHand.length, 1);

  // Auto-shrink the fan on mobile so a 13-card hand doesn't overflow a
  // 375px viewport. Card size + overlap recompute on resize so rotation
  // (portrait → landscape) re-centres correctly.
  const [vw, setVw] = useState<number>(() =>
    typeof window !== "undefined" ? window.innerWidth : 1024
  );
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const isMobile = vw < 640;
  const cardSize: "sm" | "md" = isMobile && N >= 10 ? "sm" : "md";
  // Card width per size (must mirror DIM_SIZES in SpadesCard.tsx).
  const cardW = cardSize === "sm" ? 48 : 72;
  // Compute overlap so the fan always fits in `vw - 32px` (16px gutter
  // each side). Overlap is the negative margin between adjacent cards.
  // Total fan width = cardW + (N-1) * (cardW - overlap). Solve for overlap.
  const targetWidth = Math.min(vw - 32, 700);
  const naturalOverlap = cardSize === "sm" ? 18 : 28;
  const computedOverlap = Math.max(
    naturalOverlap,
    cardW - Math.max((targetWidth - cardW) / Math.max(N - 1, 1), 12)
  );

  return (
    <div
      className="relative mt-4"
      style={{ minHeight: 130 }}
      data-testid="spades-hand-fan"
    >
      {/* Status hint */}
      {hideTurnIndicator ? null : (
        <div className="text-center mb-2">
          <span
            className={`text-[10px] md:text-xs uppercase tracking-[0.3em] font-bold ${
              isYourTurn ? "text-cyan-300" : "text-purple-300/50"
            }`}
            data-testid="spades-hand-turn-indicator"
          >
            {isYourTurn ? "● Your move" : "Waiting…"}
          </span>
        </div>
      )}

      <div className="flex justify-center items-end relative">
        {displayHand.map((card, i) => {
          // Arc range −12° to +12° for a pronounced "cards-around-a-bowl"
          // curve — visually emphasises the seat at the bottom of the
          // table when the south orb is hidden on the user's own view.
          const angle = ((i - (N - 1) / 2) / Math.max(N - 1, 1)) * 24;
          const isPlayable = isYourTurn && !busy && validKeys.has(cardKey(card));
          const isDimmed = isYourTurn && !validKeys.has(cardKey(card));

          return (
            <motion.div
              key={cardKey(card)}
              initial={{ y: -120, rotate: angle, opacity: 0 }}
              animate={{ y: 0, rotate: angle, opacity: 1 }}
              transition={{
                duration: 0.6,
                ease: [0.25, 0.46, 0.45, 0.94],
                delay: 0.08 * i,
              }}
              style={{
                marginLeft: i === 0 ? 0 : -computedOverlap,
                zIndex: i,
                transformOrigin: "bottom center",
              }}
              className="hover:z-50"
            >
              <SpadesCard
                card={card}
                size={cardSize}
                isPlayable={isPlayable}
                isDimmed={isDimmed}
                onClick={isPlayable ? () => onPlay(card) : undefined}
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default SpadesHandFan;

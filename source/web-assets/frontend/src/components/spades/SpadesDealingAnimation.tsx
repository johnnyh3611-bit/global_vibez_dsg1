/**
 * SpadesDealingAnimation — one-by-one realistic dealer-pace card flight.
 *
 * Instead of 52 cards at once, we render the deal in 4 passes of 4 cards
 * (one card to each of the 4 seats per pass, 3 passes × 4 seats = 12 cards).
 * The interval (~280ms) matches how a real dealer deals — slow enough to
 * track each card, fast enough to keep the player engaged. Total ~3.5s.
 *
 * Each card:
 *   • Spawns at the center casino-chip
 *   • Arcs out to the target seat with a curved trajectory
 *   • Flips face-down mid-flight
 *   • Lands next to the target seat then fades
 *
 * Once all cards have landed, `onComplete` fires so the parent can pop
 * up the bid modal.
 */
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  active: boolean;
  onComplete?: () => void;
}

// 4-seat target positions (matches the BidWhistPremium anchor offsets).
// North is up, south is down, east is right, west is left.
const SEAT_TARGETS: Array<{ x: number; y: number; label: string }> = [
  { x:    0, y:  230, label: "south" },
  { x:  340, y:    0, label: "east"  },
  { x:    0, y: -230, label: "north" },
  { x: -340, y:    0, label: "west"  },
];

// 3 passes × 4 seats = 12 card reveals. Feels like a real deal without
// dragging on for 52 individual cards.
const TOTAL_PASSES = 3;
const CARDS_PER_PASS = 4;
const TOTAL_CARDS = TOTAL_PASSES * CARDS_PER_PASS;
const PER_CARD_MS = 280;

export const SpadesDealingAnimation: React.FC<Props> = ({
  active,
  onComplete,
}) => {
  const [dealtCount, setDealtCount] = useState(0);

  useEffect(() => {
    if (!active) {
      setDealtCount(0);
      return;
    }
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      setDealtCount(i);
      if (i >= TOTAL_CARDS) {
        clearInterval(timer);
        // A short "settle" beat after the last card.
        window.setTimeout(() => onComplete?.(), 600);
      }
    }, PER_CARD_MS);
    return () => clearInterval(timer);
  }, [active, onComplete]);

  if (!active) return null;

  return (
    <div
      className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center"
      data-testid="spades-dealing-animation"
    >
      <AnimatePresence>
        {Array.from({ length: dealtCount }).map((_, i) => {
          const target = SEAT_TARGETS[i % 4];
          // Slight arc variance per card so stacks don't look robotic.
          const arcBias = (i % 4) * 6 - 10;
          return (
            <motion.div
              key={i}
              initial={{
                x: 0,
                y: 0,
                rotate: 0,
                scale: 0.55,
                opacity: 0,
              }}
              animate={{
                x: target.x,
                y: target.y,
                rotate: [0, 120, 220, 320, arcBias * 4],
                scale: [0.55, 0.95, 0.9, 0.82, 0.74],
                opacity: [0, 1, 1, 1, 0.85],
              }}
              transition={{
                duration: 0.9,
                ease: [0.22, 0.61, 0.36, 1],
              }}
              className="absolute"
            >
              <div className="relative w-12 h-16 md:w-14 md:h-20 rounded-md bg-gradient-to-br from-[#0a1f44] via-[#162555] to-[#050818] border border-amber-500/50 shadow-[0_0_14px_rgba(251,191,36,0.35)] overflow-hidden">
                {/* Diagonal back pattern */}
                <div
                  className="absolute inset-1 rounded opacity-50"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(45deg, rgba(251,191,36,0.25) 0 1px, transparent 1px 5px)",
                  }}
                />
                {/* Central crest */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)]" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default SpadesDealingAnimation;

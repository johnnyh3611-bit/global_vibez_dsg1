/**
 * SpadesTrickPile — The 4-card center pile during the playing phase.
 *
 * Each card is positioned to look like it was played from its respective
 * seat (N at top, S at bottom, E right, W left). Cards animate in with a
 * scale+rotate flip per the Spades Superior Build PDF's "ease-out-quad
 * 0.6s" feel.
 */
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import SpadesCard from "./SpadesCard";
import type { SpadesTrickPlay, SpadesPosition } from "./types";

interface Props {
  trick: SpadesTrickPlay[];
}

/**
 * Seat offsets — kept TIGHT and SYMMETRIC around the table's true
 * center (where the logo lives) per founder mandate (May 2026):
 *
 *   "Cards must land in the middle of the table where the logo is at,
 *    not closer to my side."
 *
 * Previous values (±32 / ±44) intruded on the player's hand area in
 * portrait + completely overflowed in landscape. The new offsets are
 * small enough that the GROUP CENTROID is the table center while
 * still revealing which seat each card came from.
 */
const SEAT_OFFSET: Record<SpadesPosition, { x: number; y: number; r: number }> = {
  north: { x: 0,   y: -10, r: 0 },
  south: { x: 0,   y:  10, r: 0 },
  east:  { x:  18, y:   0, r: 6 },
  west:  { x: -18, y:   0, r: -6 },
};

export const SpadesTrickPile: React.FC<Props> = ({ trick }) => {
  return (
    <div
      className="relative w-32 h-32 md:w-40 md:h-40"
      data-testid="spades-trick-pile"
    >
      <AnimatePresence>
        {trick.map((play) => {
          const off = SEAT_OFFSET[play.position];
          return (
            <motion.div
              key={`${play.position}-${play.card.suit}-${play.card.rank}`}
              initial={{
                x: off.x * 2.4,
                y: off.y * 2.4,
                rotateY: 90,
                rotate: off.r,
                opacity: 0,
              }}
              animate={{
                x: off.x,
                y: off.y,
                rotateY: 0,
                rotate: off.r,
                opacity: 1,
              }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            >
              <SpadesCard card={play.card} size="lg" isPlayable={false} />
            </motion.div>
          );
        })}
      </AnimatePresence>
      {trick.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] uppercase tracking-[0.3em] text-cyan-300/40 font-mono text-center">
          Center
          <br />
          Pile
        </div>
      ) : null}
    </div>
  );
};

export default SpadesTrickPile;

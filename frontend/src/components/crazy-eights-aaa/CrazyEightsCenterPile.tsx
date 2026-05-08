/**
 * CrazyEightsCenterPile — discard top + draw-pile counter overlay shown
 * inside SpadesTable's center casino chip area for Crazy Eights AAA.
 */
import { motion, AnimatePresence } from "framer-motion";
import type { SpadesCard as CardData } from "@/components/spades/types";

const SUIT_COLOR: Record<string, string> = {
  spades:   "text-slate-900",
  clubs:    "text-slate-900",
  hearts:   "text-rose-600",
  diamonds: "text-rose-600",
};

const SUIT_GLYPH: Record<string, string> = {
  spades: "♠", clubs: "♣", hearts: "♥", diamonds: "♦",
};

interface Props {
  top: CardData | null;
  declaredSuit: string;
  drawCount: number;
}

export default function CrazyEightsCenterPile({ top, declaredSuit, drawCount }: Props) {
  if (!top) return null;
  const isWild = top.rank === "8";
  return (
    <div
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex items-center gap-3 pointer-events-none"
      data-testid="crazy-eights-center-pile"
    >
      {/* Draw pile (face-down stub) */}
      <div className="relative">
        <div className="w-12 h-16 md:w-14 md:h-20 rounded-md bg-gradient-to-br from-indigo-700 to-indigo-950 border-2 border-indigo-400/60 shadow-lg flex items-center justify-center">
          <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-indigo-200 -rotate-90">VIBEZ</span>
        </div>
        <div
          className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-slate-900/90 border border-indigo-400/50 text-[9px] font-bold text-indigo-200 tabular-nums"
          data-testid="crazy-eights-draw-count"
        >
          ×{drawCount}
        </div>
      </div>

      {/* Discard top */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={`${top.suit}-${top.rank}`}
          initial={{ scale: 0.6, opacity: 0, rotate: -15 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={{ scale: 0.4, opacity: 0 }}
          transition={{ type: "spring", stiffness: 240, damping: 22 }}
          className="relative"
        >
          <div
            className="w-14 h-20 md:w-16 md:h-24 rounded-md bg-white border-2 border-slate-300 shadow-2xl flex flex-col items-center justify-between p-1"
            data-testid="crazy-eights-top-card"
          >
            <span className={`text-xs font-bold leading-none ${SUIT_COLOR[top.suit]}`}>
              {top.rank}
            </span>
            <span className={`text-3xl md:text-4xl ${SUIT_COLOR[top.suit]}`}>
              {SUIT_GLYPH[top.suit]}
            </span>
            <span className={`text-xs font-bold leading-none rotate-180 ${SUIT_COLOR[top.suit]}`}>
              {top.rank}
            </span>
          </div>
          {isWild ? (
            <div
              className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-gradient-to-r from-fuchsia-500 to-indigo-500 text-white text-[9px] font-black uppercase tracking-[0.25em] shadow-lg border border-white/20"
              data-testid="crazy-eights-declared-suit"
            >
              {declaredSuit}
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

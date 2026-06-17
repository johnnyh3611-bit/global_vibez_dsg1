import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dices, Hand } from 'lucide-react';

interface SideDockDecisionProps {
  open: boolean;
  currentScore: number;
  qualified: boolean;
  rollsRemaining?: number;
  canStand: boolean;
  rollLabel?: string;
  onRoll: () => void;
  onStand: () => void;
  busy?: boolean;
  /** Optional caption shown above the buttons (e.g. "Qualify by rolling 6 → 5 → 4") */
  helperText?: string;
}

/**
 * Side-mounted Roll/Stand dock.
 *
 * Layout strategy:
 *  - ≥lg: floats on the right edge of the viewport, vertically centered.
 *    Looks like the side bet pop-down used in the Coliseum.
 *  - <lg : sticks to the bottom of the viewport as a full-width bar so
 *    thumbs can reach both buttons on mobile without overlapping the dice.
 *
 * Replaces the older `DecisionPopDown` which sat in the middle of the
 * screen and obscured the dice tray + qualifier chips.
 */
export const SideDockDecision: React.FC<SideDockDecisionProps> = ({
  open,
  currentScore,
  qualified,
  rollsRemaining,
  canStand,
  rollLabel = 'Roll',
  onRoll,
  onStand,
  busy,
  helperText,
}) => {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Desktop right-edge dock */}
          <motion.aside
            key="dock-desktop"
            initial={{ x: 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 240, damping: 22 }}
            className="hidden lg:flex fixed right-4 top-1/2 -translate-y-1/2 z-40 flex-col items-stretch gap-3 w-[260px] rounded-2xl bg-black/85 backdrop-blur-xl border-2 border-cyan-400/40 px-4 py-5 shadow-[0_0_60px_-15px_rgba(34,211,238,0.55)]"
            data-testid="vibe654-decision-dock-desktop"
          >
            <div className="text-[10px] uppercase tracking-[0.4em] text-cyan-300/80">
              Your Move
            </div>
            <div className="text-3xl font-black text-white leading-tight">
              {qualified ? 'POINT' : 'QUALIFIERS'}{' '}
              <span className="text-amber-300">{currentScore}</span>
            </div>
            {typeof rollsRemaining === 'number' && (
              <div className="text-[11px] text-white/60">
                Rolls left: <span className="text-amber-300 font-bold">{rollsRemaining}</span>
              </div>
            )}
            {helperText && (
              <p className="text-[11px] text-white/55 leading-snug">{helperText}</p>
            )}
            <div className="flex flex-col gap-2 mt-1">
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                disabled={busy}
                onClick={onRoll}
                data-testid="vibe654-decision-roll"
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-sm uppercase tracking-widest shadow-lg disabled:opacity-50"
              >
                <Dices className="w-4 h-4" /> {rollLabel}
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                disabled={busy || !canStand}
                onClick={onStand}
                data-testid="vibe654-decision-stand"
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-black text-sm uppercase tracking-widest shadow-lg disabled:opacity-50"
              >
                <Hand className="w-4 h-4" /> Stand
              </motion.button>
            </div>
          </motion.aside>

          {/* Mobile / tablet bottom-sticky bar */}
          <motion.div
            key="dock-mobile"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="lg:hidden fixed bottom-0 inset-x-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 bg-gradient-to-t from-black via-black/95 to-black/40 backdrop-blur-xl border-t-2 border-cyan-400/40"
            data-testid="vibe654-decision-dock-mobile"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] uppercase tracking-[0.3em] text-cyan-300/80">
                {qualified ? 'Point' : 'Qualifiers'}{' '}
                <span className="text-amber-300 font-black">{currentScore}</span>
              </div>
              {typeof rollsRemaining === 'number' && (
                <div className="text-[10px] text-white/60">
                  Rolls left{' '}
                  <span className="text-amber-300 font-bold">{rollsRemaining}</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                disabled={busy}
                onClick={onRoll}
                data-testid="vibe654-decision-roll-mobile"
                className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-sm uppercase tracking-widest shadow-lg disabled:opacity-50"
              >
                <Dices className="w-4 h-4" /> {rollLabel}
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                disabled={busy || !canStand}
                onClick={onStand}
                data-testid="vibe654-decision-stand-mobile"
                className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-black text-sm uppercase tracking-widest shadow-lg disabled:opacity-50"
              >
                <Hand className="w-4 h-4" /> Stand
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default SideDockDecision;

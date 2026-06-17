import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dices, Hand } from 'lucide-react';

interface DecisionPopDownProps {
  open: boolean;
  currentScore: number;
  canStand: boolean;
  rollLabel?: string;
  onRoll: () => void;
  onStand: () => void;
  busy?: boolean;
}

/**
 * Center-screen "Vibe Pop-Down" decision overlay (Roll / Stand).
 * Replaces the old inline button block. Bounces in from the top of the arena.
 */
export const DecisionPopDown: React.FC<DecisionPopDownProps> = ({
  open,
  currentScore,
  canStand,
  rollLabel = 'Roll',
  onRoll,
  onStand,
  busy,
}) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: -120, opacity: 0, scale: 0.6 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -80, opacity: 0, scale: 0.6 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none"
          data-testid="vibe654-decision-popdown"
        >
          <div className="bg-black/90 backdrop-blur-xl border-2 border-cyan-400/40 rounded-3xl px-8 py-6 shadow-[0_0_80px_-10px_rgba(34,211,238,0.7)] flex flex-col items-center gap-3 pointer-events-auto">
            <div className="text-[10px] uppercase tracking-[0.4em] text-cyan-300/80">Your Move</div>
            <div className="text-3xl md:text-4xl font-black text-white">
              CURRENT ROLL: <span className="text-amber-300">{currentScore}</span>
            </div>
            <div className="flex gap-3">
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                disabled={busy}
                onClick={onRoll}
                data-testid="vibe654-decision-roll"
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black shadow-lg disabled:opacity-50 text-lg"
              >
                <Dices className="w-5 h-5" /> {rollLabel}
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                disabled={busy || !canStand}
                onClick={onStand}
                data-testid="vibe654-decision-stand"
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-black shadow-lg disabled:opacity-50 text-lg"
              >
                <Hand className="w-5 h-5" /> Stand
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DecisionPopDown;

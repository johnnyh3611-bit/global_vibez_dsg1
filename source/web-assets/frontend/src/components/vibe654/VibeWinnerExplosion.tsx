import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy } from 'lucide-react';

interface VibeWinnerExplosionProps {
  show: boolean;
  winnerName?: string;
  payout?: number;
  /** If true, lowers the message from "VIBE WINNER!" to "6-5-4 HIT!" */
  onlyRollHit?: boolean;
}

/**
 * Full-screen celebration + token-rain particles when a 6-5-4 closes out or
 * a tournament winner is crowned.
 */
export const VibeWinnerExplosion: React.FC<VibeWinnerExplosionProps> = ({
  show,
  winnerName,
  payout,
  onlyRollHit,
}) => {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center"
          data-testid="vibe654-winner-explosion"
        >
          {/* token rain */}
          <div className="absolute inset-0 overflow-hidden">
            {Array.from({ length: 50 }).map((_, i) => {
              const left = Math.random() * 100;
              const delay = Math.random() * 0.4;
              const duration = 1.4 + Math.random() * 1.6;
              return (
                <motion.div
                  key={`vw-${i}`}
                  initial={{ top: '-5%', opacity: 0, rotate: 0 }}
                  animate={{ top: '110%', opacity: [0, 1, 1, 0], rotate: 360 }}
                  transition={{ duration, delay, ease: 'easeIn' }}
                  className="absolute w-3 h-5 rounded-sm bg-gradient-to-b from-yellow-300 to-amber-600 shadow-[0_0_12px_rgba(251,191,36,0.6)]"
                  style={{ left: `${left}%` }}
                />
              );
            })}
          </div>

          {/* centered banner */}
          <motion.div
            initial={{ scale: 0.5 }}
            animate={{ scale: [0.5, 1.1, 1] }}
            exit={{ scale: 0.5 }}
            transition={{ duration: 0.45 }}
            className="bg-black/80 backdrop-blur-xl border-4 border-yellow-300 rounded-3xl px-10 py-8 text-center shadow-[0_0_120px_-20px_rgba(251,191,36,0.8)]"
          >
            <Trophy className="w-14 h-14 text-yellow-300 mx-auto mb-3" />
            <h2 className="text-4xl md:text-6xl font-black tracking-wider text-white mb-2">
              {onlyRollHit ? '6-5-4 HIT!' : 'VIBE WINNER!'}
            </h2>
            {winnerName && (
              <p className="text-xl md:text-2xl font-bold text-amber-200 mb-1" data-testid="vibe654-winner-name">
                {winnerName}
              </p>
            )}
            {payout !== undefined && payout > 0 && (
              <p className="text-3xl md:text-4xl font-black text-emerald-300" data-testid="vibe654-explosion-payout">
                ₵{payout.toLocaleString()}
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VibeWinnerExplosion;

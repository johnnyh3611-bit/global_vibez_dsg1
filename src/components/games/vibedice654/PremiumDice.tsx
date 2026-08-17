import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';

const DOT_POSITIONS: Record<number, Array<[number, number]>> = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [25, 75], [75, 25], [75, 75]],
  5: [[25, 25], [25, 75], [50, 50], [75, 25], [75, 75]],
  6: [[25, 25], [25, 50], [25, 75], [75, 25], [75, 50], [75, 75]],
};

interface PremiumDiceProps {
  value: number;
  rolling?: boolean;
  /**
   * Highlight the die as the round-qualifying score (kept for backward compat
   * with the sovereign / Bid Whist tables that pulse the winning roll).
   */
  isQualifier?: boolean;
  /**
   * `true` when the die has been calcified (5 or 6 in Vibez 654) and
   * removed from the rolling pool. Applies the amber-400 locked state
   * with a Lock badge per /app/design_guidelines.json (Vibez 654 AAA).
   */
  isCalcified?: boolean;
}

/**
 * PremiumDice — canonical crimson-pip die used across every dice room.
 * v8.1 (LOCKED 2026-02-16): adds `isCalcified` AAA locked state per the
 * Vibez 654 design blueprint (amber-400 face + scale-90 + Lock badge).
 */
export const PremiumDice = ({
  value, rolling, isQualifier = false, isCalcified = false,
}: PremiumDiceProps) => {
  const dots = DOT_POSITIONS[value] || [];
  // Calcified takes priority over qualifier when both are set.
  const showCalcified = isCalcified;
  const showQualifier = isQualifier && !isCalcified;

  return (
    <motion.div
      className={`w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-xl border-2 shadow-2xl relative ${rolling ? 'dice-rolling' : ''}`}
      style={{
        background: showCalcified
          ? 'linear-gradient(145deg, #f59e0b, #fbbf24)'
          : showQualifier
            ? 'linear-gradient(145deg, #f59e0b, #fbbf24)'
            : 'linear-gradient(145deg, #8b0000, #dc143c)',
        borderColor: showCalcified
          ? '#fbbf24'
          : showQualifier ? '#fbbf24' : '#ff6b6b',
        boxShadow: showCalcified
          ? 'inset 0 4px 8px rgba(0,0,0,0.25), 0 4px 14px rgba(251,191,36,0.4)'
          : showQualifier
            ? '0 0 30px rgba(251,191,36,0.9), 0 10px 40px rgba(251,191,36,0.5), inset 0 2px 5px rgba(255,255,255,0.3)'
            : '0 10px 30px rgba(0,0,0,0.5), inset 0 2px 5px rgba(255,255,255,0.1)',
      }}
      initial={false}
      animate={
        rolling
          ? { rotateX: [0, 360, 720], rotateY: [0, 360, 720], scale: [1, 1.3, 1] }
          : showCalcified
            ? { scale: 0.9, opacity: 0.95 }
            : showQualifier
              ? { scale: [1, 1.08, 1] }
              : { scale: 1, opacity: 1 }
      }
      transition={
        rolling
          ? { duration: 1.5, ease: 'easeOut' }
          : showCalcified
            ? { type: 'spring', stiffness: 220, damping: 16 }
            : showQualifier
              ? { duration: 0.8, repeat: Infinity, repeatType: 'reverse' }
              : { duration: 0.2 }
      }
      data-testid={
        showCalcified
          ? `v654-die-${value}-calcified`
          : `premium-dice-${value}`
      }
    >
      {dots.map((pos, i) => (
        <div
          key={`dot-${value}-${pos[0]}-${pos[1]}-${i}`}
          className={`absolute w-2.5 h-2.5 sm:w-3 sm:h-3 lg:w-4 lg:h-4 rounded-full shadow-lg ${
            showCalcified ? 'bg-stone-900' : 'bg-white'
          }`}
          style={{
            left: `${pos[0]}%`,
            top: `${pos[1]}%`,
            transform: 'translate(-50%, -50%)',
            boxShadow: showCalcified
              ? '0 1px 2px rgba(0,0,0,0.5)'
              : showQualifier
                ? '0 0 8px rgba(255,255,255,1)'
                : '0 2px 4px rgba(0,0,0,0.3)',
          }}
        />
      ))}
      {showCalcified && (
        <div className="absolute -top-2 -right-2 bg-stone-900 border border-amber-400 rounded-full p-0.5 shadow-lg">
          <Lock className="w-3 h-3 text-amber-300" />
        </div>
      )}
    </motion.div>
  );
};

export default PremiumDice;

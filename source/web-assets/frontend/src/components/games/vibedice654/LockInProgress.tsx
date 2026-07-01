import { motion, AnimatePresence } from 'framer-motion';

export const LockInProgress = ({
  lockedDice,
  rollsRemaining,
  isQualified,
  currentPointScore,
}) => (
  <div className="glass-card p-4" data-testid="lock-in-progress">
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-sm text-neutral-400 tracking-widest uppercase">6-5-4 Lock-in Progress</h3>
      <span className="text-xs text-amber-400 font-bold">
        {rollsRemaining} {rollsRemaining === 1 ? 'Roll' : 'Rolls'} Left
      </span>
    </div>
    <div className="flex gap-3">
      {[6, 5, 4].map((num) => {
        const locked = lockedDice.includes(num);
        return (
          <motion.div
            key={`lock-${num}`}
            initial={{ scale: 0 }}
            animate={{ scale: locked ? [0, 1.3, 1] : 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className={`w-14 h-14 rounded-lg flex items-center justify-center border-2 transition-all duration-500 ${
              locked
                ? 'bg-gradient-to-br from-amber-500 to-yellow-600 border-amber-400 text-white shadow-[0_0_25px_rgba(251,191,36,0.8)] font-black'
                : 'bg-black/40 border-neutral-800 text-neutral-700'
            }`}
          >
            <AnimatePresence>
              {locked ? (
                <motion.span
                  initial={{ opacity: 0, y: 100 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="font-black text-xl"
                >
                  {num}
                </motion.span>
              ) : (
                <span className="font-black text-xl">{num}</span>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
    {lockedDice.length > 0 && (
      <p className="text-amber-400 text-sm mt-2">
        {lockedDice.length} / 3 locked • {3 - lockedDice.length} to qualify
      </p>
    )}
    {isQualified && (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-3 p-2 bg-green-900/20 border border-green-500/30 rounded-lg"
      >
        <p className="text-green-400 font-bold text-center text-sm">
          ✓ QUALIFIED • Current Score: {currentPointScore} points
        </p>
      </motion.div>
    )}
  </div>
);

export default LockInProgress;

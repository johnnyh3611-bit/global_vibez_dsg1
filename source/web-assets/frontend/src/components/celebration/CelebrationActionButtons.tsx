import { motion } from 'framer-motion';

const BASE_BTN_CLS = `
  relative group
  px-6 py-3.5 sm:px-8 sm:py-4 md:px-10 md:py-5
  rounded-xl sm:rounded-2xl
  font-black
  text-base sm:text-lg md:text-xl
  overflow-hidden
  touch-manipulation [-webkit-tap-highlight-color:transparent]
  min-h-[44px] w-full sm:w-auto
`;

const restartStyle = (isWin) => ({
  background: isWin
    ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.3), rgba(16, 185, 129, 0.3))'
    : 'linear-gradient(135deg, rgba(168, 85, 247, 0.3), rgba(147, 51, 234, 0.3))',
  backdropFilter: 'blur(20px)',
  border: '2px solid',
  borderColor: isWin ? 'rgba(34, 197, 94, 0.5)' : 'rgba(168, 85, 247, 0.5)',
  boxShadow: isWin
    ? '0 8px 32px rgba(34, 197, 94, 0.3)'
    : '0 8px 32px rgba(168, 85, 247, 0.3)',
  willChange: 'transform',
});

const continueStyle = {
  background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.3), rgba(14, 165, 233, 0.3))',
  backdropFilter: 'blur(20px)',
  border: '2px solid rgba(6, 182, 212, 0.5)',
  boxShadow: '0 8px 32px rgba(6, 182, 212, 0.3)',
  willChange: 'transform',
};

export const CelebrationActionButtons = ({ isWin, onRestart, onContinue }) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 1 }}
    className="relative z-10 flex flex-col sm:flex-row gap-3 sm:gap-4 md:gap-6 px-4 w-full max-w-md"
    data-testid="celebration-actions"
  >
    {onRestart && (
      <motion.button
        data-testid="celebration-restart-btn"
        whileHover={{ scale: 1.05, y: -2 }}
        whileTap={{ scale: 0.98 }}
        onClick={onRestart}
        className={BASE_BTN_CLS}
        style={restartStyle(isWin)}
      >
        <span className="relative z-10 text-white">🔄 Play Again</span>
      </motion.button>
    )}

    {onContinue && (
      <motion.button
        data-testid="celebration-continue-btn"
        whileHover={{ scale: 1.05, y: -2 }}
        whileTap={{ scale: 0.98 }}
        onClick={onContinue}
        className={BASE_BTN_CLS}
        style={continueStyle}
      >
        <span className="relative z-10 text-white">➡️ Continue</span>
      </motion.button>
    )}
  </motion.div>
);

export default CelebrationActionButtons;

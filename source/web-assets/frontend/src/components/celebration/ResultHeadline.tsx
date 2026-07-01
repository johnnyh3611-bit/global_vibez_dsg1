import { motion } from 'framer-motion';

export const ResultHeadline = ({ isWin, showElements, message, opponentName }) => {
  const titleGradient = isWin
    ? 'linear-gradient(180deg, #FFD700 0%, #FFA500 50%, #FF6347 100%)'
    : 'linear-gradient(180deg, #D1D5DB 0%, #9CA3AF 50%, #6B7280 100%)';

  const titleShadow = isWin
    ? '0 10px 50px rgba(255, 215, 0, 0.6)'
    : '0 10px 30px rgba(0, 0, 0, 0.8)';

  return (
    <motion.div
      initial={{ y: 100, opacity: 0, scale: 0.8 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 100, damping: 15, delay: 0.3 }}
      className="relative z-10 text-center mb-8"
      data-testid="result-headline"
    >
      <motion.div
        animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.7, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute inset-0 blur-3xl"
        style={{
          background: isWin
            ? 'radial-gradient(circle, #FFD700, transparent)'
            : 'radial-gradient(circle, #6B7280, transparent)',
        }}
      />

      <motion.h1
        animate={{ scale: [1, 1.02, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="relative font-black tracking-wider leading-none"
        style={{
          fontSize: 'clamp(2.5rem, 12vw, 8rem)',
          background: titleGradient,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          textShadow: titleShadow,
          filter: 'drop-shadow(0 0 60px currentColor)',
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        {isWin ? 'VICTORY' : 'DEFEAT'}
      </motion.h1>

      {showElements && (
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="text-white text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold mt-2 sm:mt-4 px-4"
          style={{ textShadow: '0 2px 20px rgba(0,0,0,0.8)' }}
        >
          {message || (isWin ? `You defeated ${opponentName}!` : `${opponentName} wins this round`)}
        </motion.p>
      )}
    </motion.div>
  );
};

export default ResultHeadline;

import { motion } from 'framer-motion';

const GLASS_CARD_STYLE = {
  boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 0 30px rgba(255,255,255,0.1)',
};

const ScoreCard = ({ label, value }) => (
  <motion.div
    whileHover={{ scale: 1.05 }}
    className="relative backdrop-blur-xl bg-white/10 px-4 py-3 sm:px-6 sm:py-4 md:px-8 md:py-6 rounded-xl sm:rounded-2xl min-w-[100px]"
    style={GLASS_CARD_STYLE}
  >
    <p className="text-gray-300 text-xs sm:text-sm font-semibold uppercase tracking-wider truncate max-w-[120px]">
      {label}
    </p>
    <p className="text-white text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black">{value}</p>
  </motion.div>
);

const CoinsCard = ({ coins }) => (
  <motion.div
    animate={{
      scale: [1, 1.1, 1],
      boxShadow: [
        '0 8px 32px rgba(255, 215, 0, 0.4)',
        '0 8px 40px rgba(255, 215, 0, 0.6)',
        '0 8px 32px rgba(255, 215, 0, 0.4)',
      ],
    }}
    transition={{ duration: 1, repeat: Infinity }}
    className="relative backdrop-blur-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 px-4 py-3 sm:px-6 sm:py-4 md:px-8 md:py-6 rounded-xl sm:rounded-2xl border border-yellow-500/30 min-w-[100px]"
  >
    <p className="text-yellow-200 text-xs sm:text-sm font-semibold uppercase tracking-wider">Earned</p>
    <p className="text-yellow-300 text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black">+{coins} 🪙</p>
  </motion.div>
);

export const StatsDisplay = ({ playerScore, opponentScore, opponentName, coinsEarned }) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.8 }}
    className="relative z-10 flex flex-wrap justify-center gap-3 sm:gap-4 md:gap-6 lg:gap-8 mb-8 sm:mb-12 px-4"
    data-testid="stats-display"
  >
    {playerScore !== undefined && <ScoreCard label="You" value={playerScore} />}
    {playerScore !== undefined && opponentScore !== undefined && (
      <div className="flex items-center">
        <p className="text-gray-500 text-lg sm:text-xl md:text-2xl font-bold">VS</p>
      </div>
    )}
    {opponentScore !== undefined && <ScoreCard label={opponentName} value={opponentScore} />}
    {coinsEarned > 0 && <CoinsCard coins={coinsEarned} />}
  </motion.div>
);

export default StatsDisplay;

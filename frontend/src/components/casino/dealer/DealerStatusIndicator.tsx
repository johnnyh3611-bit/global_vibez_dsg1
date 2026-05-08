import { motion } from 'framer-motion';

const statusText = ({ isCelebrating, isDealing, isShuffling }) => {
  if (isCelebrating) return 'Celebrating';
  if (isDealing) return 'Dealing';
  if (isShuffling) return 'Shuffling';
  return 'Ready';
};

export const DealerStatusIndicator = ({ isCelebrating, isDealing, isShuffling }) => (
  <motion.div
    className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur-sm border border-cyan-400/30 rounded-full px-4 py-2 flex items-center gap-2"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    data-testid="dealer-status"
  >
    <motion.div
      className="w-2 h-2 rounded-full bg-cyan-400"
      animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.2, 1] }}
      transition={{ duration: 2, repeat: Infinity }}
    />
    <span className="text-sm font-medium text-cyan-400">
      {statusText({ isCelebrating, isDealing, isShuffling })}
    </span>
  </motion.div>
);

export default DealerStatusIndicator;

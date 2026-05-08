import { motion } from 'framer-motion';

const CHIP_COLORS = {
  5: 'from-blue-600 to-blue-800',
  10: 'from-green-600 to-green-800',
  25: 'from-purple-600 to-purple-800',
  50: 'from-orange-600 to-orange-800',
  100: 'from-yellow-600 to-yellow-800',
};

const selectedAccent = (dealerTheme) => {
  if (dealerTheme === 'jade') return 'green';
  if (dealerTheme === 'nova') return 'amber';
  return 'blue';
};

export const MetalChip = ({ amount, selected, onClick, dealerTheme = 'nova' }) => {
  const accent = selectedAccent(dealerTheme);
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.15, y: -5 }}
      whileTap={{ scale: 0.95 }}
      className={`metal-button chip-stack w-16 h-16 rounded-full bg-gradient-to-br ${CHIP_COLORS[amount]} border-4 flex items-center justify-center font-black text-white text-lg shadow-xl transition-all ${
        selected
          ? `border-${accent}-400 ring-4 ring-${accent}-400/50`
          : 'border-white/30'
      }`}
      data-testid={`metal-chip-${amount}`}
    >
      ₵{amount}
    </motion.button>
  );
};

export default MetalChip;

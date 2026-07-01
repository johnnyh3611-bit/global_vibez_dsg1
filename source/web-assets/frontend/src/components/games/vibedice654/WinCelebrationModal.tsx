import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Sparkles } from 'lucide-react';

export const WinCelebrationModal = ({ open, totalWinAmount }) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.5 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
        data-testid="win-celebration-modal"
      >
        <motion.div
          animate={{ scale: [1, 1.05, 1], rotate: [0, 2, -2, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, repeatType: 'reverse' }}
          className="relative"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-amber-400/30 via-yellow-500/30 to-orange-500/30 blur-3xl rounded-full" />
          <div className="relative metal-button bg-gradient-to-br from-amber-950 via-yellow-900 to-amber-950 border-4 border-amber-400 rounded-3xl p-12 text-center shadow-[0_0_60px_rgba(251,191,36,0.6)]">
            <motion.div
              animate={{ y: [0, -10, 0], rotate: [0, 5, -5, 0] }}
              transition={{ duration: 1, repeat: Infinity, repeatType: 'reverse' }}
              className="mb-6"
            >
              <Trophy className="w-24 h-24 mx-auto text-amber-400 drop-shadow-[0_0_20px_rgba(251,191,36,1)]" />
            </motion.div>
            <h2 className="text-5xl font-black text-amber-300 mb-4 drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]">
              YOU WIN!
            </h2>
            <div className="bg-black/50 rounded-2xl py-6 px-8 border-2 border-amber-500/50">
              <p className="text-2xl text-amber-200 mb-2 font-semibold">Total Won</p>
              <p className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-200 drop-shadow-[0_0_20px_rgba(251,191,36,1)]" data-testid="vibe654-win-amount">
                ₵{Number(totalWinAmount || 0).toLocaleString()}
              </p>
            </div>
            <div className="absolute -top-4 -left-4">
              <Sparkles className="w-12 h-12 text-amber-300 animate-pulse" />
            </div>
            <div className="absolute -top-4 -right-4">
              <Sparkles className="w-12 h-12 text-yellow-300 animate-pulse" />
            </div>
            <div className="absolute -bottom-4 -left-4">
              <Sparkles className="w-12 h-12 text-orange-300 animate-pulse" />
            </div>
            <div className="absolute -bottom-4 -right-4">
              <Sparkles className="w-12 h-12 text-amber-300 animate-pulse" />
            </div>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default WinCelebrationModal;

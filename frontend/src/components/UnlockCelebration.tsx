import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import Confetti from 'react-confetti';
import { GlassCard } from './GlassCard';

export function UnlockCelebration({ isOpen, onClose, unlockedStyle }) {
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (isOpen) {
      setShowConfetti(true);
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
      
      // Auto-close after 5 seconds
      const timer = setTimeout(() => {
        setShowConfetti(false);
        setTimeout(onClose, 500);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !unlockedStyle) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/95 backdrop-blur-2xl flex items-center justify-center z-[9999] p-4"
        onClick={onClose}
      >
        {/* Confetti */}
        {showConfetti && (
          <Confetti
            width={windowSize.width}
            height={windowSize.height}
            recycle={false}
            numberOfPieces={500}
            gravity={0.3}
            colors={['#ec4899', '#8b5cf6', '#06b6d4', '#fbbf24', '#f59e0b']}
          />
        )}

        <motion.div
          initial={{ scale: 0.5, opacity: 0, rotateY: -180 }}
          animate={{ scale: 1, opacity: 1, rotateY: 0 }}
          exit={{ scale: 0.5, opacity: 0, rotateY: 180 }}
          transition={{ 
            type: 'spring', 
            stiffness: 200, 
            damping: 20,
            delay: 0.1
          }}
          onClick={(e) => e.stopPropagation()}
          className="max-w-2xl w-full"
        >
          <GlassCard variant="gaming" className="p-8 relative overflow-hidden">
            {/* Background glow animation */}
            <motion.div
              animate={{
                opacity: [0.3, 0.6, 0.3],
                scale: [1, 1.2, 1]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
              className={`absolute inset-0 bg-gradient-to-br ${unlockedStyle.preview_gradient} blur-3xl`}
            />

            {/* Content */}
            <div className="relative z-10">
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-0 right-0 text-white/60 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>

              {/* Title */}
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-center mb-8"
              >
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                    rotate: [0, 10, -10, 0]
                  }}
                  transition={{
                    duration: 0.6,
                    repeat: Infinity,
                    repeatDelay: 1
                  }}
                  className="text-8xl mb-4"
                >
                  {unlockedStyle.emoji}
                </motion.div>
                
                <h2 className="text-4xl font-black text-white mb-2 flex items-center justify-center gap-3">
                  <Sparkles className="w-8 h-8 text-yellow-400" />
                  NEW STYLE UNLOCKED!
                  <Sparkles className="w-8 h-8 text-yellow-400" />
                </h2>
                
                <p className="text-xl text-fuchsia-300 font-bold">
                  {unlockedStyle.name}
                </p>
              </motion.div>

              {/* Style Preview */}
              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className={`
                  backdrop-blur-xl rounded-2xl p-8 mb-6
                  bg-gradient-to-br ${unlockedStyle.preview_gradient}
                  border-4 ${unlockedStyle.border_color}
                  ${unlockedStyle.glow_effect}
                `}
              >
                <div className="text-center mb-4">
                  <p className="text-white/90 text-lg mb-4">
                    {unlockedStyle.description}
                  </p>
                </div>

                {/* Preview Cards */}
                <div className="flex justify-center gap-3">
                  {['♥', '♠', '♦', '♣'].map((suit, idx) => (
                    <motion.div
                      key={`item-${idx}`}
                      initial={{ y: 20, opacity: 0, scale: 0.8 }}
                      animate={{ y: 0, opacity: 1, scale: 1 }}
                      transition={{ delay: 0.7 + idx * 0.1 }}
                      whileHover={{ y: -10, scale: 1.1 }}
                      className="w-16 h-24 rounded-lg bg-white shadow-2xl flex items-center justify-center text-4xl font-bold transform hover:rotate-6 transition-transform"
                    >
                      {suit}
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Unlock Info */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="text-center"
              >
                <p className="text-white/70 text-sm mb-4">
                  This style is now available to use in all card games!
                </p>
                
                <button
                  onClick={onClose}
                  className="px-8 py-3 bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white font-bold text-lg rounded-xl hover:from-fuchsia-500 hover:to-pink-500 transition-all shadow-[0_0_30px_rgba(232,121,249,0.6)]"
                >
                  Awesome! 🎉
                </button>
              </motion.div>
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

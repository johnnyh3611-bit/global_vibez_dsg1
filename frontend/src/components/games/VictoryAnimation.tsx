import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import { Trophy, Star, Zap } from 'lucide-react';
import { useState, useEffect } from 'react';

/**
 * Epic victory animation with confetti, trophy, and score pop-up
 */
export const VictoryAnimation = ({ show, winner, score, onClose }: { show?: any; winner?: any; score?: any; onClose?: any }) => {
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isWin = winner === 'player' || winner === 'user';
  const isDraw = winner === 'draw';

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        >
          {/* Confetti */}
          {isWin && (
            <Confetti
              width={windowSize.width}
              height={windowSize.height}
              numberOfPieces={200}
              recycle={false}
              gravity={0.3}
            />
          )}

          {/* Main Victory Card */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 180 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-12 rounded-3xl border-4 border-white/20 shadow-2xl max-w-md mx-4 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Animated Background Glow */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 via-purple-500/20 to-pink-500/20"
              animate={{
                opacity: [0.3, 0.6, 0.3],
                scale: [1, 1.1, 1]
              }}
              transition={{ duration: 3, repeat: Infinity }}
            />

            <div className="relative z-10 text-center space-y-6">
              {/* Trophy Icon */}
              <motion.div
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex justify-center"
              >
                <div className={`p-6 rounded-full ${
                  isWin ? 'bg-gradient-to-br from-yellow-400 to-amber-600' :
                  isDraw ? 'bg-gradient-to-br from-blue-400 to-indigo-600' :
                  'bg-gradient-to-br from-red-400 to-red-600'
                } shadow-[0_0_50px_rgba(251,191,36,0.5)]`}>
                  {isWin && <Trophy className="w-16 h-16 text-white" />}
                  {isDraw && <Star className="w-16 h-16 text-white" />}
                  {!isWin && !isDraw && <Zap className="w-16 h-16 text-white" />}
                </div>
              </motion.div>

              {/* Title */}
              <motion.h2
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.4, type: 'spring', stiffness: 300 }}
                className="text-6xl font-black text-white"
              >
                {isWin && '🏆 Victory!'}
                {isDraw && '🤝 Draw!'}
                {!isWin && !isDraw && '😢 Defeat'}
              </motion.h2>

              {/* Message */}
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="text-2xl text-white/80"
              >
                {isWin && 'Amazing play! You crushed it!'}
                {isDraw && 'Well played! Great match!'}
                {!isWin && !isDraw && 'Better luck next time!'}
              </motion.p>

              {/* Score */}
              {score !== undefined && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.2, 1] }}
                  transition={{ delay: 0.8, times: [0, 0.6, 1] }}
                  className="py-4 px-8 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20"
                >
                  <p className="text-white/60 text-sm mb-1">Final Score</p>
                  <p className="text-5xl font-black text-white">{score}</p>
                </motion.div>
              )}

              {/* Floating Particles */}
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={_.id || _.name || `item-${i}`}
                  className="absolute w-3 h-3 bg-gradient-to-br from-cyan-400 to-purple-400 rounded-full"
                  initial={{ 
                    x: Math.random() * 200 - 100,
                    y: Math.random() * 200 - 100,
                    opacity: 0 
                  }}
                  animate={{
                    y: [0, -200, -400],
                    x: [0, (Math.random() - 0.5) * 100],
                    opacity: [0, 1, 0],
                    scale: [0, 1, 0]
                  }}
                  transition={{
                    delay: 1 + i * 0.1,
                    duration: 2,
                    ease: 'easeOut'
                  }}
                />
              ))}

              {/* Close Button */}
              <motion.button
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1 }}
                onClick={onClose}
                className="mt-6 px-8 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-bold rounded-full hover:scale-105 transition-transform shadow-lg"
              >
                Play Again
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VictoryAnimation;

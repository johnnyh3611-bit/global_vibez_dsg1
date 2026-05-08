import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';

/**
 * GameCelebration - Enhanced visual effects for game results
 * Spectacular animations for wins, losses, and draws
 */
export function GameCelebration({ 
  result, 
  message, 
  opponentName = 'AI',
  onRestart,
  onContinue,
  stats = null // Optional: { playerScore, opponentScore, coins earned, etc }
}) {
  const { width, height } = useWindowSize();
  
  if (!result) return null;

  const isWin = result === 'win';
  const isLose = result === 'lose';
  const isDraw = result === 'draw';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
      >
        {/* Victory Confetti - Enhanced */}
        {isWin && (
          <>
            <Confetti
              width={width}
              height={height}
              recycle={true}
              numberOfPieces={600}
              gravity={0.25}
              colors={['#fbbf24', '#f59e0b', '#d946ef', '#a855f7', '#06b6d4', '#22c55e', '#ef4444']}
              drawShape={ctx => {
                // Custom star shapes
                ctx.beginPath();
                for(let i = 0; i < 5; i++) {
                  ctx.lineTo(Math.cos((18 + i * 72) / 180 * Math.PI) * 10, -Math.sin((18 + i * 72) / 180 * Math.PI) * 10);
                  ctx.lineTo(Math.cos((54 + i * 72) / 180 * Math.PI) * 5, -Math.sin((54 + i * 72) / 180 * Math.PI) * 5);
                }
                ctx.closePath();
                ctx.fill();
              }}
            />
            
            {/* Firework particles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(20)].map((_, i) => (
                <motion.div
                  key={_.id || _.name || `item-${i}`}
                  initial={{ 
                    x: width / 2, 
                    y: height / 2,
                    scale: 0,
                    opacity: 1
                  }}
                  animate={{
                    x: width / 2 + (Math.random() - 0.5) * width,
                    y: height / 2 + (Math.random() - 0.5) * height,
                    scale: [0, 2, 0],
                    opacity: [1, 1, 0]
                  }}
                  transition={{
                    duration: 2,
                    delay: i * 0.1,
                    repeat: Infinity,
                    repeatDelay: 1
                  }}
                  className="absolute w-4 h-4 rounded-full"
                  style={{
                    background: `radial-gradient(circle, ${['#fbbf24', '#d946ef', '#06b6d4', '#22c55e'][i % 4]}, transparent)`,
                    boxShadow: `0 0 20px ${['#fbbf24', '#d946ef', '#06b6d4', '#22c55e'][i % 4]}`
                  }}
                />
              ))}
            </div>
          </>
        )}

        {/* Main celebration card */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ 
            type: 'spring', 
            stiffness: 200, 
            damping: 20,
            delay: 0.2 
          }}
          className="relative max-w-2xl w-full mx-4"
        >
          {/* Background glow */}
          <div 
            className="absolute inset-0 blur-3xl opacity-50 rounded-3xl"
            style={{
              background: isWin 
                ? 'radial-gradient(circle, #22c55e, #10b981, #059669)'
                : isLose
                ? 'radial-gradient(circle, #6b7280, #4b5563, #374151)'
                : 'radial-gradient(circle, #06b6d4, #0891b2, #0e7490)'
            }}
          />

          {/* Card content */}
          <div 
            className={`relative rounded-3xl border-4 p-12 backdrop-blur-xl ${
              isWin 
                ? 'bg-gradient-to-br from-green-900/90 to-emerald-900/90 border-green-400'
                : isLose
                ? 'bg-gradient-to-br from-gray-800/90 to-gray-900/90 border-gray-500'
                : 'bg-gradient-to-br from-cyan-900/90 to-blue-900/90 border-cyan-400'
            }`}
            style={{
              boxShadow: isWin 
                ? '0 0 60px rgba(34, 197, 94, 0.6), inset 0 0 40px rgba(34, 197, 94, 0.2)'
                : isLose
                ? '0 0 40px rgba(107, 114, 128, 0.4)'
                : '0 0 50px rgba(6, 182, 212, 0.5)'
            }}
          >
            {/* Animated icon */}
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                rotate: isWin ? [0, 10, -10, 0] : [0, 5, -5, 0]
              }}
              transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
              className="text-9xl text-center mb-6"
            >
              {isWin ? '🏆' : isLose ? '💪' : '🤝'}
            </motion.div>

            {/* Result text */}
            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className={`text-6xl font-black text-center mb-4 ${
                isWin ? 'text-yellow-300' : isLose ? 'text-gray-300' : 'text-cyan-300'
              }`}
              style={{
                textShadow: isWin 
                  ? '0 0 30px rgba(253, 224, 71, 0.8), 0 0 60px rgba(253, 224, 71, 0.4)'
                  : isLose
                  ? '0 0 20px rgba(156, 163, 175, 0.6)'
                  : '0 0 30px rgba(6, 182, 212, 0.8)'
              }}
            >
              {isWin ? 'VICTORY!' : isLose ? 'DEFEAT' : "IT'S A DRAW!"}
            </motion.h1>

            {/* Message */}
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-2xl text-white text-center mb-8 font-bold"
            >
              {message}
            </motion.p>

            {/* Stats (if provided) */}
            {stats && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex justify-center gap-6 mb-8"
              >
                {stats.playerScore !== undefined && (
                  <div className="bg-white/10 backdrop-blur-md px-6 py-3 rounded-xl border border-white/20">
                    <p className="text-gray-300 text-sm">Your Score</p>
                    <p className="text-white text-3xl font-black">{stats.playerScore}</p>
                  </div>
                )}
                {stats.opponentScore !== undefined && (
                  <div className="bg-white/10 backdrop-blur-md px-6 py-3 rounded-xl border border-white/20">
                    <p className="text-gray-300 text-sm">{opponentName}</p>
                    <p className="text-white text-3xl font-black">{stats.opponentScore}</p>
                  </div>
                )}
                {stats.coinsEarned !== undefined && stats.coinsEarned > 0 && (
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                    className="bg-gradient-to-r from-yellow-500 to-amber-600 px-6 py-3 rounded-xl border-2 border-yellow-400 shadow-lg"
                  >
                    <p className="text-yellow-100 text-sm">Coins Earned</p>
                    <p className="text-white text-3xl font-black">+{stats.coinsEarned} 🪙</p>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* Action buttons */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex justify-center gap-4"
            >
              {onRestart && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onRestart}
                  className={`px-8 py-4 rounded-xl font-black text-lg border-2 shadow-xl ${
                    isWin
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 border-green-400 text-white hover:from-green-500 hover:to-emerald-500'
                      : 'bg-gradient-to-r from-purple-600 to-fuchsia-600 border-purple-400 text-white hover:from-purple-500 hover:to-fuchsia-500'
                  }`}
                >
                  🔄 Play Again
                </motion.button>
              )}
              {onContinue && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onContinue}
                  className="px-8 py-4 rounded-xl font-black text-lg bg-gradient-to-r from-cyan-600 to-blue-600 border-2 border-cyan-400 text-white hover:from-cyan-500 hover:to-blue-500 shadow-xl"
                >
                  ➡️ Continue
                </motion.button>
              )}
            </motion.div>

            {/* Motivational text for losses */}
            {isLose && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="text-gray-400 text-center mt-6 italic"
              >
                "Every champion was once a contender that refused to give up."
              </motion.p>
            )}
          </div>

          {/* Floating sparkles for wins */}
          {isWin && (
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(30)].map((_, i) => (
                <motion.div
                  key={_.id || _.name || `item-${i}`}
                  initial={{ 
                    x: Math.random() * 100 + '%',
                    y: '100%',
                    scale: 0,
                    opacity: 1
                  }}
                  animate={{
                    y: '-20%',
                    scale: [0, 1, 0],
                    opacity: [0, 1, 0]
                  }}
                  transition={{
                    duration: 3 + Math.random() * 2,
                    delay: i * 0.1,
                    repeat: Infinity
                  }}
                  className="absolute text-2xl"
                >
                  ✨
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

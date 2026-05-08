import React from 'react';
import Confetti from 'react-confetti';
import { motion } from 'framer-motion';
import { useWindowSize } from 'react-use';

export function VictoryScreen({ show, winner, message, onPlayAgain }) {
  const { width, height } = useWindowSize();

  if (!show) return null;

  const isWin = winner === 'player';
  const isDraw = winner === 'draw' || winner === 'push';

  return (
    <>
      {/* Confetti Effect */}
      {isWin && (
        <Confetti
          width={width}
          height={height}
          recycle={false}
          numberOfPieces={500}
          gravity={0.3}
          colors={['#FFD700', '#FFA500', '#FF6347', '#00CED1', '#9370DB', '#32CD32']}
        />
      )}

      {/* Victory Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && onPlayAgain && onPlayAgain()}
      >
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="text-center px-8 py-12 max-w-md"
        >
          {/* Trophy/Icon */}
          <motion.div
            animate={{ 
              scale: [1, 1.2, 1],
              rotate: [0, 10, -10, 0]
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="text-9xl mb-6"
          >
            {isWin ? '🏆' : isDraw ? '🤝' : '😔'}
          </motion.div>

          {/* Message */}
          <motion.h2
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className={`text-6xl font-black mb-4 ${
              isWin 
                ? 'text-transparent bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 bg-clip-text' 
                : isDraw
                ? 'text-transparent bg-gradient-to-r from-blue-400 to-cyan-500 bg-clip-text'
                : 'text-transparent bg-gradient-to-r from-red-400 to-rose-600 bg-clip-text'
            }`}
            style={{
              textShadow: isWin ? '0 0 40px rgba(255, 215, 0, 0.5)' : 'none'
            }}
          >
            {isWin ? 'YOU WIN!' : isDraw ? 'DRAW!' : 'GAME OVER'}
          </motion.h2>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-white text-xl mb-8"
          >
            {message}
          </motion.p>

          {/* Play Again Button */}
          {onPlayAgain && (
            <motion.button
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={onPlayAgain}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-black px-12 py-4 rounded-full text-xl shadow-2xl transition-all"
            >
              PLAY AGAIN
            </motion.button>
          )}
        </motion.div>
      </motion.div>
    </>
  );
}

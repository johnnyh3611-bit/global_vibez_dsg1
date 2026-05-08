/**
 * RouletteWheel - Animated roulette wheel component
 * Handles spinning animation and winning number display
 */
import React from 'react';
import { motion } from 'framer-motion';

const WHEEL_NUMBERS = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

const getNumberColor = (num) => {
  if (num === 0) return 'green';
  return RED_NUMBERS.includes(num) ? 'red' : 'black';
};

const RouletteWheel = ({ 
  winningNumber, 
  isSpinning, 
  wheelRotation, 
  spinKey 
}) => {
  return (
    <div className="relative w-full max-w-md mx-auto aspect-square">
      {/* Wheel Container */}
      <div className="relative w-full h-full">
        {/* Outer Ring - Gold */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-yellow-600 via-amber-500 to-yellow-700 shadow-2xl"></div>
        
        {/* Middle Ring - Numbers */}
        <div className="absolute inset-4 rounded-full overflow-hidden shadow-inner">
          <motion.div
            key={spinKey}
            className="w-full h-full rounded-full relative"
            style={{ 
              background: 'radial-gradient(circle, #1a1a1a 0%, #0a0a0a 100%)'
            }}
            animate={{
              rotate: wheelRotation
            }}
            transition={{
              duration: isSpinning ? 3 : 0,
              ease: isSpinning ? [0.22, 1, 0.36, 1] : 'linear'
            }}
          >
            {/* Number Segments */}
            {WHEEL_NUMBERS.map((num, index) => {
              const angle = (index * 360) / WHEEL_NUMBERS.length;
              const color = getNumberColor(num);
              const bgColor = color === 'green' ? '#047857' : color === 'red' ? '#DC2626' : '#1F2937';
              
              return (
                <div
                  key={num}
                  className="absolute w-full h-full"
                  style={{
                    transform: `rotate(${angle}deg)`,
                    transformOrigin: 'center'
                  }}
                >
                  <div
                    className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-12 rounded flex items-center justify-center text-white font-bold text-xs shadow-lg"
                    style={{ backgroundColor: bgColor }}
                  >
                    {num}
                  </div>
                </div>
              );
            })}
          </motion.div>
        </div>

        {/* Center Hub */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 shadow-2xl border-4 border-white/20 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-300 to-amber-500 flex items-center justify-center">
            <span className="text-white text-xs font-black">🎰</span>
          </div>
        </div>

        {/* Pointer/Arrow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10">
          <div className="w-0 h-0 border-l-8 border-r-8 border-t-12 border-l-transparent border-r-transparent border-t-amber-500"></div>
        </div>
      </div>

      {/* Winning Number Display */}
      {winningNumber !== null && !isSpinning && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="absolute -bottom-16 left-1/2 -translate-x-1/2 z-20"
        >
          <div className={`px-8 py-4 rounded-2xl border-4 shadow-2xl ${
            getNumberColor(winningNumber) === 'green' ? 'bg-emerald-600 border-emerald-400' :
            getNumberColor(winningNumber) === 'red' ? 'bg-red-600 border-red-400' :
            'bg-gray-800 border-gray-600'
          }`}>
            <p className="text-white text-sm font-bold mb-1 text-center">WINNING NUMBER</p>
            <p className="text-white text-5xl font-black text-center">{winningNumber}</p>
          </div>
        </motion.div>
      )}

      {/* Spinning Indicator */}
      {isSpinning && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute -bottom-16 left-1/2 -translate-x-1/2"
        >
          <div className="bg-amber-600 px-6 py-3 rounded-full text-white font-bold text-sm animate-pulse shadow-lg">
            🎰 SPINNING...
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default RouletteWheel;

/**
 * RouletteBettingGrid - Interactive betting layout
 * Numbers, colors, dozens, columns, even/odd bets
 */
import React from 'react';
import { motion } from 'framer-motion';

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

const getNumberColor = (num) => {
  if (num === 0) return 'green';
  return RED_NUMBERS.includes(num) ? 'red' : 'black';
};

const RouletteBettingGrid = ({ 
  onPlaceBet, 
  currentBets, 
  isSpinning,
  chipValue 
}) => {
  const numbers = Array.from({ length: 36 }, (_, i) => i + 1);
  
  const getBetAmount = (type, value) => {
    const bet = currentBets.find(b => b.type === type && b.value === value);
    return bet ? bet.amount : 0;
  };

  const Chip = ({ amount }) => (
    <div className="absolute top-1 right-1 bg-amber-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-lg border border-white/30 z-10">
      ₵{amount}
    </div>
  );

  return (
    <div className="bg-emerald-900/90 backdrop-blur-xl rounded-2xl p-4 shadow-2xl border-2 border-amber-500/30">
      <div className="grid grid-cols-[auto_1fr] gap-2">
        {/* Zero */}
        <div className="col-span-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onPlaceBet('number', 0)}
            disabled={isSpinning}
            className="relative w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-6 rounded-xl transition-all disabled:opacity-30 border-2 border-white/20"
          >
            0
            {getBetAmount('number', 0) > 0 && <Chip amount={getBetAmount('number', 0)} />}
          </motion.button>
        </div>

        {/* Number Grid */}
        <div className="col-start-2 grid grid-cols-12 gap-1">
          {numbers.map((num) => {
            const color = getNumberColor(num);
            const bgColor = color === 'red' ? 'bg-red-600 hover:bg-red-500' : 'bg-gray-800 hover:bg-gray-700';
            
            return (
              <motion.button
                key={num}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => onPlaceBet('number', num)}
                disabled={isSpinning}
                className={`relative ${bgColor} text-white font-bold text-sm py-3 rounded transition-all disabled:opacity-30 border border-white/20 aspect-square flex items-center justify-center`}
              >
                {num}
                {getBetAmount('number', num) > 0 && <Chip amount={getBetAmount('number', num)} />}
              </motion.button>
            );
          })}
        </div>

        {/* Column Bets */}
        <div className="col-start-2 grid grid-cols-3 gap-2 mt-2">
          {[1, 2, 3].map((col) => (
            <motion.button
              key={`col-${col}`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onPlaceBet('column', col)}
              disabled={isSpinning}
              className="relative bg-amber-700 hover:bg-amber-600 text-white font-bold py-3 rounded-lg transition-all disabled:opacity-30 text-sm"
            >
              2:1
              {getBetAmount('column', col) > 0 && <Chip amount={getBetAmount('column', col)} />}
            </motion.button>
          ))}
        </div>

        {/* Outside Bets */}
        <div className="col-span-2 grid grid-cols-2 gap-2 mt-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onPlaceBet('dozen', 1)}
            disabled={isSpinning}
            className="relative bg-blue-700 hover:bg-blue-600 text-white font-bold py-3 rounded-lg transition-all disabled:opacity-30 text-sm"
          >
            1st 12
            {getBetAmount('dozen', 1) > 0 && <Chip amount={getBetAmount('dozen', 1)} />}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onPlaceBet('dozen', 2)}
            disabled={isSpinning}
            className="relative bg-blue-700 hover:bg-blue-600 text-white font-bold py-3 rounded-lg transition-all disabled:opacity-30 text-sm"
          >
            2nd 12
            {getBetAmount('dozen', 2) > 0 && <Chip amount={getBetAmount('dozen', 2)} />}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onPlaceBet('dozen', 3)}
            disabled={isSpinning}
            className="relative bg-blue-700 hover:bg-blue-600 text-white font-bold py-3 rounded-lg transition-all disabled:opacity-30 text-sm"
          >
            3rd 12
            {getBetAmount('dozen', 3) > 0 && <Chip amount={getBetAmount('dozen', 3)} />}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onPlaceBet('even_odd', 'even')}
            disabled={isSpinning}
            className="relative bg-purple-700 hover:bg-purple-600 text-white font-bold py-3 rounded-lg transition-all disabled:opacity-30 text-sm"
          >
            EVEN
            {getBetAmount('even_odd', 'even') > 0 && <Chip amount={getBetAmount('even_odd', 'even')} />}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onPlaceBet('even_odd', 'odd')}
            disabled={isSpinning}
            className="relative bg-purple-700 hover:bg-purple-600 text-white font-bold py-3 rounded-lg transition-all disabled:opacity-30 text-sm"
          >
            ODD
            {getBetAmount('even_odd', 'odd') > 0 && <Chip amount={getBetAmount('even_odd', 'odd')} />}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onPlaceBet('color', 'red')}
            disabled={isSpinning}
            className="relative bg-red-700 hover:bg-red-600 text-white font-bold py-3 rounded-lg transition-all disabled:opacity-30 text-sm"
          >
            RED
            {getBetAmount('color', 'red') > 0 && <Chip amount={getBetAmount('color', 'red')} />}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onPlaceBet('color', 'black')}
            disabled={isSpinning}
            className="relative bg-gray-900 hover:bg-gray-800 text-white font-bold py-3 rounded-lg transition-all disabled:opacity-30 text-sm"
          >
            BLACK
            {getBetAmount('color', 'black') > 0 && <Chip amount={getBetAmount('color', 'black')} />}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onPlaceBet('half', 'low')}
            disabled={isSpinning}
            className="relative bg-cyan-700 hover:bg-cyan-600 text-white font-bold py-3 rounded-lg transition-all disabled:opacity-30 text-sm"
          >
            1-18
            {getBetAmount('half', 'low') > 0 && <Chip amount={getBetAmount('half', 'low')} />}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onPlaceBet('half', 'high')}
            disabled={isSpinning}
            className="relative bg-cyan-700 hover:bg-cyan-600 text-white font-bold py-3 rounded-lg transition-all disabled:opacity-30 text-sm"
          >
            19-36
            {getBetAmount('half', 'high') > 0 && <Chip amount={getBetAmount('half', 'high')} />}
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default RouletteBettingGrid;

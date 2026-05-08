import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BackButton from '@/components/BackButton';

// European Wheel Sequence (Counter-Clockwise)
const WHEEL_NUMBERS = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];

// Number Colors
const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const getNumberColor = (num) => {
  if (num === 0) return 'green';
  return RED_NUMBERS.includes(num) ? 'red' : 'black';
};

// Payout Logic
const calculatePayout = (betType, amount) => {
  const payouts = {
    'straight': 35,
    'split': 17,
    'street': 11,
    'corner': 8,
    'dozen': 2,
    'column': 2,
    'even_money': 1
  };
  return amount * payouts[betType] + amount;
};

export default function PracticeRoulette() {
  const [credits, setCredits] = useState(10000);
  const [chipValue, setChipValue] = useState(100);
  const [bets, setBets] = useState([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winningNumber, setWinningNumber] = useState(null);
  const [ballPosition, setBallPosition] = useState(0);
  const [wheelRotation, setWheelRotation] = useState(0);

  const totalBet = bets.reduce((sum, bet) => sum + bet.amount, 0);

  const placeBet = (betType, value) => {
    if (isSpinning || credits < chipValue) {
      return;
    }
    
    const existingBet = bets.find(b => b.type === betType && b.value === value);
    if (existingBet) {
      setBets(bets.map(b => 
        b.type === betType && b.value === value 
          ? { ...b, amount: b.amount + chipValue }
          : b
      ));
    } else {
      setBets([...bets, { type: betType, value, amount: chipValue }]);
    }
    setCredits(credits - chipValue);
  };

  const clearBets = () => {
    setCredits(credits + totalBet);
    setBets([]);
  };

  const spin = () => {
    if (isSpinning || totalBet === 0) {
      return;
    }
    
    setIsSpinning(true);
    setWinningNumber(null);
    
    const randomNumber = WHEEL_NUMBERS[Math.floor(Math.random() * WHEEL_NUMBERS.length)];
    const numberIndex = WHEEL_NUMBERS.indexOf(randomNumber);
    const degreesPerNumber = 360 / WHEEL_NUMBERS.length;
    const targetRotation = 360 * 5 + (numberIndex * degreesPerNumber); // 5 full spins + landing

    setWheelRotation(targetRotation);
    setBallPosition(targetRotation);

    setTimeout(() => {
      setWinningNumber(randomNumber);
      setIsSpinning(false);
      
      // Calculate winnings
      let totalWin = 0;
      bets.forEach(bet => {
        let won = false;
        
        if (bet.type === 'straight' && bet.value === randomNumber) {
          won = true;
          totalWin += calculatePayout('straight', bet.amount);
        } else if (bet.type === 'red' && getNumberColor(randomNumber) === 'red') {
          won = true;
          totalWin += calculatePayout('even_money', bet.amount);
        } else if (bet.type === 'black' && getNumberColor(randomNumber) === 'black') {
          won = true;
          totalWin += calculatePayout('even_money', bet.amount);
        } else if (bet.type === 'even' && randomNumber !== 0 && randomNumber % 2 === 0) {
          won = true;
          totalWin += calculatePayout('even_money', bet.amount);
        } else if (bet.type === 'odd' && randomNumber % 2 === 1) {
          won = true;
          totalWin += calculatePayout('even_money', bet.amount);
        } else if (bet.type === 'low' && randomNumber >= 1 && randomNumber <= 18) {
          won = true;
          totalWin += calculatePayout('even_money', bet.amount);
        } else if (bet.type === 'high' && randomNumber >= 19 && randomNumber <= 36) {
          won = true;
          totalWin += calculatePayout('even_money', bet.amount);
        } else if (bet.type === 'dozen1' && randomNumber >= 1 && randomNumber <= 12) {
          won = true;
          totalWin += calculatePayout('dozen', bet.amount);
        } else if (bet.type === 'dozen2' && randomNumber >= 13 && randomNumber <= 24) {
          won = true;
          totalWin += calculatePayout('dozen', bet.amount);
        } else if (bet.type === 'dozen3' && randomNumber >= 25 && randomNumber <= 36) {
          won = true;
          totalWin += calculatePayout('dozen', bet.amount);
        }
      });

      if (totalWin > 0) {
        setCredits(credits + totalWin);
      }

      setTimeout(() => {
        setBets([]);
      }, 3000);
    }, 6000);
  };

  return (
    <div className="min-h-screen relative overflow-y-auto pb-20" style={{
      background: 'radial-gradient(ellipse at center, #1a0033 0%, #0a0015 50%, #000000 100%)'
    }}>
      <BackButton to="/games" label="Back to Games" variant="casino" />

      {/* Animated Background */}
      <div className="absolute inset-0 opacity-20">
        {[...Array(100)].map((_, i) => (
          <motion.div
            key={`item-${i}`}
            className="absolute w-1 h-1 bg-yellow-400 rounded-full"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.2, 1, 0.2],
              scale: [1, 1.5, 1]
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2
            }}
          />
        ))}
      </div>

      {/* Top HUD */}
      <div className="absolute top-2 left-0 right-0 z-50">
        <div className="flex justify-center gap-4">
          <motion.div 
            className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 backdrop-blur-2xl border border-yellow-400 rounded-xl px-4 py-2"
            whileHover={{ scale: 1.05 }}
          >
            <div className="text-[10px] text-yellow-300 mb-0.5 tracking-wider font-bold">💰 CREDITS</div>
            <div className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">
              ${credits.toLocaleString()}
            </div>
          </motion.div>

          <motion.div 
            className="bg-gradient-to-br from-orange-500/20 to-red-500/20 backdrop-blur-2xl border border-orange-400 rounded-xl px-4 py-2"
            whileHover={{ scale: 1.05 }}
          >
            <div className="text-[10px] text-orange-300 mb-0.5 tracking-wider font-bold">TOTAL BET</div>
            <div className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400">
              ${totalBet.toLocaleString()}
            </div>
          </motion.div>
        </div>

        <motion.div className="text-center mt-2">
          <div className="inline-block bg-gradient-to-r from-yellow-500/30 via-orange-500/30 to-red-500/30 backdrop-blur-xl border border-yellow-400 rounded-full px-6 py-1.5">
            <div className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-300 to-red-300 tracking-widest">
              {isSpinning ? '🎰 SPINNING...' : winningNumber !== null ? `🏆 ${winningNumber} ${getNumberColor(winningNumber).toUpperCase()}` : '🎰 PLACE YOUR BETS'}
            </div>
          </div>
        </motion.div>
      </div>

      {/* CSS 3D Roulette Wheel */}
      <div className="mt-[120px] mx-auto z-30" style={{ perspective: '1500px', width: '400px' }}>
        <div className="relative mx-auto" style={{ width: '400px', height: '400px' }}>
          
          {/* Wheel Container */}
          <motion.div
            className="absolute inset-0"
            animate={{ rotateZ: isSpinning ? wheelRotation : 0 }}
            transition={{ duration: 6, ease: "easeOut" }}
          >
            {/* Outer Wheel Frame */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-yellow-700 via-yellow-900 to-yellow-950 shadow-[0_0_80px_rgba(255,215,0,0.4)]" style={{
              border: '15px solid #8B4513',
              boxShadow: 'inset 0 0 40px rgba(0,0,0,0.8), 0 0 80px rgba(255,215,0,0.4)'
            }}>
              
              {/* Number Pockets */}
              <div className="absolute inset-0 rounded-full overflow-hidden">
                {WHEEL_NUMBERS.map((num, index) => {
                  const angle = (index * (360 / WHEEL_NUMBERS.length)) - 90;
                  const color = getNumberColor(num);
                  
                  return (
                    <div
                      key={num}
                      className="absolute left-1/2 top-1/2 origin-left"
                      style={{
                        transform: `rotate(${angle}deg) translateX(120px)`,
                        width: '40px',
                        height: '40px',
                        marginLeft: '-20px',
                        marginTop: '-20px'
                      }}
                    >
                      <div className={`w-full h-full rounded-sm flex items-center justify-center text-white text-xs font-black ${
                        color === 'red' ? 'bg-red-600' : color === 'black' ? 'bg-black' : 'bg-green-600'
                      }`} style={{
                        boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.2)',
                        transform: `rotate(${-angle}deg)`
                      }}>
                        {num}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Center Hub */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-700 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
                <div className="w-full h-full rounded-full flex items-center justify-center text-yellow-900 text-2xl font-black">
                  R
                </div>
              </div>
            </div>
          </motion.div>

          {/* Ball */}
          <motion.div
            className="absolute top-[30px] left-1/2"
            animate={{ rotateZ: isSpinning ? -ballPosition : 0 }}
            transition={{ duration: 6, ease: "easeOut" }}
          >
            <div className="w-4 h-4 rounded-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.8)]" style={{
              boxShadow: '0 0 15px rgba(255,255,255,0.8), inset 0 -2px 4px rgba(0,0,0,0.3)'
            }} />
          </motion.div>

          {/* Winning Number Display */}
          <AnimatePresence>
            {winningNumber !== null && !isSpinning && (
              <motion.div
                initial={{ scale: 0, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0 }}
                className="absolute -bottom-16 left-1/2 transform -translate-x-1/2"
              >
                <div className={`px-8 py-4 rounded-2xl border-4 ${
                  getNumberColor(winningNumber) === 'red' ? 'bg-red-600/30 border-red-400' :
                  getNumberColor(winningNumber) === 'black' ? 'bg-gray-900/30 border-gray-400' :
                  'bg-green-600/30 border-green-400'
                } shadow-[0_0_40px_rgba(255,215,0,0.6)] backdrop-blur-xl`}>
                  <div className="text-5xl font-black text-white">{winningNumber}</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Betting Board */}
      <div className="mt-24 relative z-50">
        <div className="max-w-7xl mx-auto px-4">
          
          {/* Main Number Grid (Simplified) */}
          <div className="bg-green-900/80 backdrop-blur-xl border-2 border-yellow-600 rounded-xl p-4 mb-3">
            <div className="text-white text-center mb-2 font-bold">Click numbers to bet (Current chip: ${chipValue})</div>
            
            {/* Outside Bets First - More Prominent */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <motion.button 
                onClick={() => placeBet('red', 'RED')} 
                className="bg-red-600 text-white font-bold py-3 px-4 rounded-lg border-2 border-yellow-400 hover:border-yellow-300 hover:shadow-[0_0_20px_rgba(255,0,0,0.6)] text-sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                🔴 RED (1:1)
              </motion.button>
              <motion.button 
                onClick={() => placeBet('black', 'BLACK')} 
                className="bg-black text-white font-bold py-3 px-4 rounded-lg border-2 border-yellow-400 hover:border-yellow-300 hover:shadow-[0_0_20px_rgba(255,255,255,0.6)] text-sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                ⚫ BLACK (1:1)
              </motion.button>
              <motion.button 
                onClick={() => placeBet('even', 'EVEN')} 
                className="bg-purple-600 text-white font-bold py-3 px-4 rounded-lg border-2 border-yellow-400 hover:border-yellow-300 hover:shadow-[0_0_20px_rgba(147,51,234,0.6)] text-sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                EVEN (1:1)
              </motion.button>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              <motion.button 
                onClick={() => placeBet('odd', 'ODD')} 
                className="bg-purple-600 text-white font-bold py-3 px-4 rounded-lg border-2 border-yellow-400 hover:border-yellow-300 text-sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                ODD (1:1)
              </motion.button>
              <motion.button 
                onClick={() => placeBet('low', '1-18')} 
                className="bg-blue-600 text-white font-bold py-3 px-4 rounded-lg border-2 border-yellow-400 hover:border-yellow-300 text-sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                1-18 (1:1)
              </motion.button>
              <motion.button 
                onClick={() => placeBet('high', '19-36')} 
                className="bg-blue-600 text-white font-bold py-3 px-4 rounded-lg border-2 border-yellow-400 hover:border-yellow-300 text-sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                19-36 (1:1)
              </motion.button>
            </div>

            {/* Dozens */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <motion.button 
                onClick={() => placeBet('dozen1', '1-12')} 
                className="bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg border-2 border-yellow-400 hover:border-yellow-300 text-sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                1st 12 (2:1)
              </motion.button>
              <motion.button 
                onClick={() => placeBet('dozen2', '13-24')} 
                className="bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg border-2 border-yellow-400 hover:border-yellow-300 text-sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                2nd 12 (2:1)
              </motion.button>
              <motion.button 
                onClick={() => placeBet('dozen3', '25-36')} 
                className="bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg border-2 border-yellow-400 hover:border-yellow-300 text-sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                3rd 12 (2:1)
              </motion.button>
            </div>

            {/* Number Grid - Compact */}
            <div className="text-white text-xs text-center mb-2">Individual Numbers (35:1):</div>
            <div className="grid grid-cols-13 gap-1">
              {/* Single 0 */}
              <motion.button
                onClick={() => placeBet('straight', 0)}
                className="bg-green-600 text-white font-bold py-2 px-1 rounded border border-yellow-400/50 hover:border-yellow-400 hover:shadow-[0_0_15px_rgba(34,197,94,0.8)] text-xs"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                0
              </motion.button>
              
              {/* Numbers 1-36 */}
              {Array.from({ length: 36 }, (_, i) => i + 1).map(num => (
                <motion.button
                  key={num}
                  onClick={() => placeBet('straight', num)}
                  className={`${
                    getNumberColor(num) === 'red' ? 'bg-red-600 hover:shadow-[0_0_15px_rgba(220,38,38,0.8)]' : 'bg-black hover:shadow-[0_0_15px_rgba(255,255,255,0.6)]'
                  } text-white font-bold py-2 px-1 rounded border border-yellow-400/50 hover:border-yellow-400 text-xs`}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  {num}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Controls */}
          <div className="grid grid-cols-2 gap-4 mb-3">
            <motion.button
              onClick={clearBets}
              disabled={totalBet === 0}
              className="bg-gradient-to-r from-red-600 to-pink-600 border-2 border-red-400 text-white font-black text-base py-4 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
              whileHover={{ scale: 1.03, boxShadow: '0 0 30px rgba(220,38,38,0.6)' }}
              whileTap={{ scale: 0.97 }}
            >
              🚫 CLEAR BETS
            </motion.button>
            <motion.button
              onClick={spin}
              disabled={isSpinning || totalBet === 0}
              className="bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 text-white font-black text-base py-4 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_30px_rgba(255,215,0,0.6)]"
              whileHover={{ scale: 1.03, boxShadow: '0 0 40px rgba(255,215,0,0.8)' }}
              whileTap={{ scale: 0.97 }}
            >
              {isSpinning ? '⏳ SPINNING...' : '🎰 SPIN ($' + totalBet + ')'}
            </motion.button>
          </div>

          {/* Chip Selector */}
          <div className="text-center">
            <div className="text-white/50 text-[10px] mb-1.5 tracking-[0.15em] font-bold">💰 CHIP VALUE</div>
            <div className="flex justify-center gap-3">
              {[25, 100, 500, 1000].map(value => (
                <motion.button
                  key={value}
                  onClick={() => setChipValue(value)}
                  className={`relative transition-all ${chipValue === value ? 'scale-110' : 'opacity-70 hover:opacity-100'}`}
                  whileHover={{ scale: chipValue === value ? 1.1 : 1.05, rotate: 360 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className={`w-11 h-11 rounded-full border-3 flex items-center justify-center font-bold text-white shadow-xl relative overflow-hidden ${
                    value === 25 ? 'bg-gradient-to-br from-blue-500 to-blue-700 border-blue-300' :
                    value === 100 ? 'bg-gradient-to-br from-red-500 to-red-700 border-red-300' :
                    value === 500 ? 'bg-gradient-to-br from-purple-500 to-purple-700 border-purple-300' :
                    'bg-gradient-to-br from-yellow-500 to-yellow-700 border-yellow-300'
                  }`}>
                    <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent" />
                    <span className="z-10 text-xs">${value}</span>
                  </div>
                  {chipValue === value && (
                    <motion.div
                      className="absolute inset-0 rounded-full"
                      animate={{ boxShadow: [
                        '0 0 8px rgba(255,255,255,0.5)',
                        '0 0 16px rgba(255,255,255,1)',
                        '0 0 8px rgba(255,255,255,0.5)'
                      ]}}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                  )}
                </motion.button>
              ))}
            </div>
            <div className="text-yellow-300 text-[9px] mt-1.5 font-semibold tracking-wider">🎰 European Roulette - 37 Numbers</div>
          </div>
        </div>
      </div>
    </div>
  );
}

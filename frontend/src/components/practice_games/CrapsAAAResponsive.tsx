import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import CasinoTable3D from '../casino/CasinoTable3D';
import BackButton from '../BackButton';
import CrapsTableWrapper from '../craps/CrapsTableWrapper';
import PropBetsBoard from '../craps/PropBetsBoard';
import { useOrientation } from '../../hooks/useOrientation';
import { calculateTotal, isHardway, getRollName, getGamePhase } from '../../utils/crapsHelpers';
import SocialOverlay from '../social/SocialOverlay';
import SocialGameButton from './SocialGameButton';
import { useSocialSocket } from '../../hooks/useSocialSocket';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// 3D Animated Dice Component
const Dice3D = ({ value, index = 0, rolling = false }) => {
  const faces = [
    [
      { x: '50%', y: '50%' }
    ],
    [
      { x: '25%', y: '25%' },
      { x: '75%', y: '75%' }
    ],
    [
      { x: '25%', y: '25%' },
      { x: '50%', y: '50%' },
      { x: '75%', y: '75%' }
    ],
    [
      { x: '25%', y: '25%' },
      { x: '25%', y: '75%' },
      { x: '75%', y: '25%' },
      { x: '75%', y: '75%' }
    ],
    [
      { x: '25%', y: '25%' },
      { x: '25%', y: '75%' },
      { x: '50%', y: '50%' },
      { x: '75%', y: '25%' },
      { x: '75%', y: '75%' }
    ],
    [
      { x: '25%', y: '33%' },
      { x: '25%', y: '67%' },
      { x: '50%', y: '33%' },
      { x: '50%', y: '67%' },
      { x: '75%', y: '33%' },
      { x: '75%', y: '67%' }
    ]
  ];

  const dots = value >= 1 && value <= 6 ? faces[value - 1] : [];

  return (
    <motion.div
      initial={{ y: -200, rotate: 0, scale: 0 }}
      animate={{ 
        y: 0, 
        rotate: rolling ? 720 : 0,
        scale: 1
      }}
      transition={{ 
        delay: index * 0.1,
        type: 'spring',
        stiffness: rolling ? 200 : 100,
        damping: 10
      }}
      className="relative w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-white rounded-lg shadow-2xl border-2 border-gray-300"
    >
      {dots.map((dot, i) => (
        <div
          key={`dots-${i}`}
          className="absolute w-3 h-3 sm:w-4 sm:h-4 bg-black rounded-full transform -translate-x-1/2 -translate-y-1/2"
          style={{ left: dot.x, top: dot.y }}
        />
      ))}
    </motion.div>
  );
};

// Chip Component
const CrapsChip = ({ value, color = 'from-amber-600 to-yellow-500' }) => (
  <motion.div
    whileHover={{ scale: 1.1, rotate: 5 }}
    className={`inline-flex items-center gap-1 px-2 sm:px-3 py-1 rounded-full bg-gradient-to-br ${color} text-white text-xs sm:text-sm font-black shadow-lg border-2 border-white/30`}
  >
    <span className="text-xs">$</span>
    <span>{value}</span>
  </motion.div>
);

export default function CrapsAAAResponsive() {
  const [dice, setDice] = useState([1, 1]);
  const [point, setPoint] = useState(null);
  const [credits, setCredits] = useState(1000);
  const [currentBet, setCurrentBet] = useState(0);
  const [chipValue, setChipValue] = useState(25);
  const [rolling, setRolling] = useState(false);
  const [gameResult, setGameResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [betType, setBetType] = useState('pass_line'); // pass_line, dont_pass, field, prop
  
  const isLandscape = useOrientation();
  const { width, height } = useWindowSize();

  const rollDice = async () => {
    if (currentBet === 0) {
      alert('Please place a bet first!');
      return;
    }

    setRolling(true);
    setGameResult(null);

    try {
      // Simulate API call (replace with actual endpoint)
      const die1 = Math.floor(Math.random() * 6) + 1;
      const die2 = Math.floor(Math.random() * 6) + 1;
      const total = die1 + die2;
      const hard = isHardway(die1, die2);
      const rollInfo = getRollName(die1, die2);

      // Animation delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setDice([die1, die2]);
      setRolling(false);

      let result = null;

      // Come-Out Roll Logic
      if (point === null) {
        if (total === 7 || total === 11) {
          result = { type: 'win', message: `${rollInfo.emoji} ${rollInfo.name}! Pass Line Wins!`, payout: currentBet * 2 };
          setCredits(prev => prev + currentBet);
        } else if (total === 2 || total === 3 || total === 12) {
          result = { type: 'lose', message: `${rollInfo.emoji} Craps! Pass Line Loses.`, payout: 0 };
        } else {
          setPoint(total);
          result = { type: 'point', message: `${rollInfo.emoji} Point is ${total}`, payout: 0 };
        }
      } else {
        // Point Roll Logic
        if (total === point) {
          result = { type: 'win', message: `${rollInfo.emoji} Point Hit! You Win!`, payout: currentBet * 2 };
          setCredits(prev => prev + currentBet);
          setPoint(null);
        } else if (total === 7) {
          result = { type: 'lose', message: `${rollInfo.emoji} Seven Out! You Lose.`, payout: 0 };
          setPoint(null);
        } else {
          result = { type: 'continue', message: `${rollInfo.emoji} Roll ${total}. Roll again...`, payout: 0 };
        }
      }

      setGameResult(result);
      setHistory(prev => [{ dice: [die1, die2], total, rollInfo }, ...prev].slice(0, 10));
      
      if (result.type === 'win' || result.type === 'lose') {
        setCurrentBet(0);
      }

    } catch (error) {
      // console.error('Roll error:', error);
      setRolling(false);
    }
  };

  const placeBet = () => {
    if (credits < chipValue) return;
    setCurrentBet(prev => prev + chipValue);
    setCredits(prev => prev - chipValue);
  };

  const clearBet = () => {
    setCredits(prev => prev + currentBet);
    setCurrentBet(0);
  };

  return (
    <CasinoTable3D gameType="craps">
      <BackButton to="/games" label="Back" variant="casino" />

      {gameResult?.type === 'win' && (
        <Confetti
          width={width}
          height={height}
          recycle={false}
          numberOfPieces={300}
          gravity={0.2}
        />
      )}

      {/* Responsive Container */}
      <div className="fixed inset-0 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
        <div className="relative w-full max-w-7xl">
          
          {/* Premium Craps Table */}
          <CrapsTableWrapper>
            
            {/* Header - Point Indicator & Credits */}
            <div className="absolute top-[5%] left-1/2 transform -translate-x-1/2 flex flex-col sm:flex-row items-center gap-3 sm:gap-6 z-20">
              <div className="bg-black/60 backdrop-blur-md px-4 sm:px-8 py-2 sm:py-4 rounded-2xl border-2 border-amber-500/70 shadow-2xl">
                <p className="text-amber-300 text-xs font-bold mb-1 text-center">POINT</p>
                <p className="text-2xl sm:text-4xl font-black text-amber-400 text-center">
                  {point || 'OFF'}
                </p>
              </div>
              
              <div className="bg-black/60 backdrop-blur-md px-4 sm:px-6 py-2 sm:py-3 rounded-full border border-green-500/50">
                <p className="text-green-200 text-xs font-semibold mb-1 text-center">Your Credits</p>
                <CrapsChip value={credits} color="from-green-600 to-emerald-600" />
              </div>
            </div>

            {/* Dice Display - Center */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
              <div className="flex gap-3 sm:gap-6 mb-6">
                <Dice3D value={dice[0]} index={0} rolling={rolling} />
                <Dice3D value={dice[1]} index={1} rolling={rolling} />
              </div>
              
              {/* Total Display */}
              {!rolling && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-center"
                >
                  <div className="inline-block bg-black/70 backdrop-blur-md px-6 py-3 rounded-2xl border-2 border-white/30">
                    <p className="text-white text-xs font-bold mb-1">TOTAL</p>
                    <p className="text-white text-3xl sm:text-5xl font-black">{calculateTotal(dice[0], dice[1])}</p>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Betting Grid - Bottom Left */}
            <div className="absolute bottom-[8%] left-[5%] z-10 w-[90%] sm:w-auto">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={placeBet}
                  disabled={rolling}
                  className="col-span-1 sm:col-span-2 bg-gradient-to-br from-green-700 to-green-900 hover:from-green-600 hover:to-green-800 border-2 border-white/30 p-3 sm:p-6 text-center text-white font-bold text-xs sm:text-base rounded-lg transition-all disabled:opacity-30"
                >
                  PASS LINE
                  {currentBet > 0 && <div className="text-xs mt-1">${currentBet}</div>}
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={rolling}
                  className="bg-gradient-to-br from-red-700 to-red-900 hover:from-red-600 hover:to-red-800 border-2 border-white/30 p-3 sm:p-6 text-center text-white font-bold text-xs sm:text-sm rounded-lg transition-all disabled:opacity-30"
                >
                  DON'T PASS
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={rolling}
                  className="bg-gradient-to-br from-blue-700 to-blue-900 hover:from-blue-600 hover:to-blue-800 border-2 border-white/30 p-3 sm:p-6 text-center text-white font-bold text-xs sm:text-sm rounded-lg transition-all disabled:opacity-30"
                >
                  FIELD
                </motion.button>
              </div>
            </div>

            {/* Proposition Bets - Bottom Right */}
            <div className="absolute bottom-[8%] right-[5%] z-10 w-[45%] hidden sm:block">
              <PropBetsBoard onPlaceBet={() => {}} disabled={rolling} />
            </div>

          </CrapsTableWrapper>

          {/* Controls - Below Table */}
          <div className="mt-4 sm:mt-6 space-y-3 sm:space-y-4">
            {/* Chip Selector */}
            <div className="bg-black/40 backdrop-blur-md p-3 sm:p-4 rounded-xl border border-white/20">
              <p className="text-amber-200 text-xs sm:text-sm font-bold mb-2">Select Chip Value:</p>
              <div className="grid grid-cols-4 gap-2">
                {[25, 50, 100, 500].map(val => (
                  <motion.button
                    key={val}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setChipValue(val)}
                    className={`px-3 py-2 rounded-full font-bold text-xs sm:text-sm transition-all ${
                      chipValue === val 
                        ? 'bg-gradient-to-br from-amber-500 to-yellow-600 text-white scale-110 shadow-lg' 
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    ${val}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={clearBet}
                disabled={rolling || currentBet === 0}
                className="bg-gradient-to-r from-gray-600 to-gray-800 hover:from-gray-500 hover:to-gray-700 text-white font-black py-4 sm:py-6 rounded-2xl shadow-2xl text-base sm:text-xl disabled:opacity-30 disabled:cursor-not-allowed"
              >
                \ud83d\uddd1\ufe0f CLEAR BET
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={rollDice}
                disabled={rolling || currentBet === 0}
                className="bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-white font-black py-4 sm:py-6 rounded-2xl shadow-2xl text-base sm:text-xl disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {rolling ? '\ud83c\udfb2 ROLLING...' : '\ud83c\udfb2 THROW DICE'}
              </motion.button>
            </div>
          </div>

          {/* Prop Bets - Mobile Only */}
          <div className="mt-4 sm:hidden">
            <PropBetsBoard onPlaceBet={() => {}} disabled={rolling} />
          </div>

          {/* Roll History */}
          {history.length > 0 && (
            <div className="mt-4 bg-black/40 backdrop-blur-md p-3 sm:p-4 rounded-xl border border-white/20 max-h-40 overflow-y-auto">
              <p className="text-amber-200 text-xs sm:text-sm font-bold mb-2">Recent Rolls:</p>
              <div className="space-y-1">
                {history.map((roll, i) => (
                  <div key={`dots-${i}`} className="text-white text-xs sm:text-sm flex items-center gap-2">
                    <span>{roll.rollInfo.emoji}</span>
                    <span className="font-mono">[{roll.dice[0]}, {roll.dice[1]}]</span>
                    <span className="font-bold">= {roll.total}</span>
                    <span className="text-amber-400">{roll.rollInfo.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Game Result Overlay */}
      <AnimatePresence>
        {gameResult && gameResult.type !== 'continue' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
            onClick={() => setGameResult(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-gradient-to-br from-emerald-900 to-emerald-950 rounded-3xl p-8 sm:p-12 text-center border-4 border-amber-600 shadow-2xl max-w-md mx-4"
            >
              <div className="text-6xl sm:text-8xl mb-4 sm:mb-6">
                {gameResult.type === 'win' ? '\ud83c\udfc6' : gameResult.type === 'lose' ? '\ud83d\ude14' : '\ud83c\udfaf'}
              </div>
              <h3 className={`text-2xl sm:text-4xl font-black mb-4 sm:mb-6 ${
                gameResult.type === 'win' ? 'text-green-400' : 
                gameResult.type === 'lose' ? 'text-red-400' : 'text-amber-400'
              }`}>
                {gameResult.message}
              </h3>
              {gameResult.payout > 0 && (
                <CrapsChip value={gameResult.payout} color="from-amber-500 to-yellow-500" />
              )}
              <p className="text-white/60 text-xs mt-4">Tap to continue</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Landscape Hint */}
      {!isLandscape && (
        <div className="fixed bottom-20 sm:bottom-4 left-1/2 transform -translate-x-1/2 bg-emerald-600/90 backdrop-blur-sm px-3 sm:px-4 py-2 rounded-full text-white text-xs font-bold z-40">
          \ud83d\udcf1 Rotate for best experience
        </div>
      )}
    </CasinoTable3D>
  );
}

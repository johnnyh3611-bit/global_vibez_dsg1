import React, { useState, useEffect } from 'react';
import { Sparkles, Trophy, Zap } from 'lucide-react';

import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';
const SYMBOLS = ['💎', '⭐', '🔥', '💜', '🎮', '🌟', '⚡', '🎯'];
const VIBES_SYMBOLS = {
  '💎': { name: 'Diamond', multiplier: 100, color: 'from-cyan-400 to-blue-600' },
  '⭐': { name: 'Star', multiplier: 50, color: 'from-yellow-400 to-orange-500' },
  '🔥': { name: 'Fire', multiplier: 40, color: 'from-red-500 to-pink-600' },
  '💜': { name: 'Vibe', multiplier: 30, color: 'from-purple-500 to-pink-500' },
  '🎮': { name: 'Game', multiplier: 20, color: 'from-green-400 to-cyan-500' },
  '🌟': { name: 'Glitter', multiplier: 15, color: 'from-yellow-300 to-pink-400' },
  '⚡': { name: 'Bolt', multiplier: 10, color: 'from-blue-400 to-purple-500' },
  '🎯': { name: 'Target', multiplier: 5, color: 'from-red-400 to-yellow-500' }
};

export default function PracticeVibesSlots({ onMove, gameState }: { onMove?: any, gameState?: any }) {
  const [reels, setReels] = useState([['💎', '⭐', '🔥'], ['💎', '⭐', '🔥'], ['💎', '⭐', '🔥']]);
  const [spinning, setSpinning] = useState(false);
  const [winAmount, setWinAmount] = useState(0);
  const [credits, setCredits] = useState(gameState?.credits || 1000);
  const [bet, setBet] = useState(10);
  const [totalWon, setTotalWon] = useState(0);
  const [jackpotActive, setJackpotActive] = useState(false);

  const spin = () => {
    if (spinning || credits < bet) return;
    
    setSpinning(true);
    setWinAmount(0);
    setCredits(prev => prev - bet);
    
    // Spin animation
    const spinInterval = setInterval(() => {
      setReels([
        [SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
         SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
         SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]],
        [SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
         SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
         SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]],
        [SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
         SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
         SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]]
      ]);
    }, 100);

    setTimeout(() => {
      clearInterval(spinInterval);
      
      // Final result
      const finalReels = [
        [SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
         SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
         SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]],
        [SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
         SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
         SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]],
        [SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
         SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
         SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]]
      ];
      
      setReels(finalReels);
      
      // Check for wins
      const middleRow = [finalReels[0][1], finalReels[1][1], finalReels[2][1]];
      const topRow = [finalReels[0][0], finalReels[1][0], finalReels[2][0]];
      const bottomRow = [finalReels[0][2], finalReels[1][2], finalReels[2][2]];
      
      let win = 0;
      
      // Check middle row
      if (middleRow[0] === middleRow[1] && middleRow[1] === middleRow[2]) {
        const symbol = middleRow[0];
        win = bet * VIBES_SYMBOLS[symbol].multiplier;
        if (symbol === '💎') setJackpotActive(true);
      }
      // Check top row
      else if (topRow[0] === topRow[1] && topRow[1] === topRow[2]) {
        win = bet * VIBES_SYMBOLS[topRow[0]].multiplier * 0.5;
      }
      // Check bottom row
      else if (bottomRow[0] === bottomRow[1] && bottomRow[1] === bottomRow[2]) {
        win = bet * VIBES_SYMBOLS[bottomRow[0]].multiplier * 0.5;
      }
      // Two of a kind
      else if (middleRow[0] === middleRow[1] || middleRow[1] === middleRow[2]) {
        win = bet * 2;
      }
      
      if (win > 0) {
        setWinAmount(win);
        setCredits(prev => prev + win);
        setTotalWon(prev => prev + win);
        setTimeout(() => setJackpotActive(false), 3000);
      }
      
      setSpinning(false);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-black p-4 md:p-8">
      {/* Jackpot Animation */}
      {jackpotActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="text-center animate-bounce">
            <div className="text-8xl mb-4">💎🎰💎</div>
            <h1 className="text-6xl font-bold bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600 bg-clip-text text-transparent">
              JACKPOT!
            </h1>
            <p className="text-4xl text-white mt-4 font-bold">+{winAmount} Credits!</p>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-cyan-400 via-pink-500 to-purple-600 bg-clip-text text-transparent mb-2">
            ✨ VIBES SLOTS ✨
          </h1>
          <p className="text-cyan-300 text-lg">Spin the Cyberpunk Reels!</p>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl p-4 border-2 border-cyan-400 shadow-lg shadow-cyan-500/50">
            <div className="text-cyan-300 text-sm">Credits</div>
            <div className="text-3xl font-bold text-white">{credits}</div>
          </div>
          <div className="bg-gradient-to-br from-pink-600 to-red-600 rounded-xl p-4 border-2 border-yellow-400 shadow-lg shadow-yellow-500/50">
            <div className="text-yellow-200 text-sm">Total Won</div>
            <div className="text-3xl font-bold text-white">{totalWon}</div>
          </div>
          <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl p-4 border-2 border-pink-400 shadow-lg shadow-pink-500/50">
            <div className="text-pink-200 text-sm">Last Win</div>
            <div className="text-3xl font-bold text-white">{winAmount}</div>
          </div>
        </div>

        {/* Slot Machine */}
        <div className="bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 rounded-3xl p-8 border-4 border-cyan-500 shadow-2xl shadow-cyan-500/50 mb-6">
          {/* Reels */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {reels.map((reel, reelIndex) => (
              <div key={reelIndex} className="space-y-2">
                {reel.map((symbol, symbolIndex) => (
                  <div
                    key={`symbol-${reelIndex}-${symbolIndex}`}
                    className={`
                      h-32 flex items-center justify-center text-7xl
                      bg-gradient-to-br ${VIBES_SYMBOLS[symbol].color}
                      rounded-2xl border-4 border-white/20
                      shadow-lg transform transition-all
                      ${spinning ? 'animate-pulse scale-95' : 'scale-100'}
                      ${symbolIndex === 1 ? 'ring-4 ring-yellow-400 scale-105' : ''}
                    `}
                  >
                    {symbol}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Bet Controls */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <button
              onClick={() => setBet(Math.max(10, bet - 10))}
              className="px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 text-white font-bold rounded-xl hover:scale-105 transition-transform"
              disabled={spinning}
            >
              - 10
            </button>
            <div className="text-center px-8 py-3 bg-black/50 rounded-xl border-2 border-cyan-400">
              <div className="text-cyan-300 text-sm">Bet Amount</div>
              <div className="text-3xl font-bold text-white">{bet}</div>
            </div>
            <button
              onClick={() => setBet(Math.min(100, bet + 10))}
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-cyan-600 text-white font-bold rounded-xl hover:scale-105 transition-transform"
              disabled={spinning}
            >
              + 10
            </button>
          </div>

          {/* Spin Button */}
          <button
            onClick={spin}
            disabled={spinning || credits < bet}
            className={`
              w-full py-6 text-2xl font-bold rounded-2xl
              bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600
              text-white shadow-2xl transform transition-all
              ${spinning ? 'scale-95 opacity-50' : 'hover:scale-105 hover:shadow-pink-500/50'}
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {spinning ? (
              <span className="flex items-center justify-center gap-3">
                <Zap className="w-8 h-8 animate-spin" />
                SPINNING...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-3">
                <Sparkles className="w-8 h-8" />
                SPIN TO WIN!
                <Sparkles className="w-8 h-8" />
              </span>
            )}
          </button>
        </div>

        {/* Paytable */}
        <div className="bg-black/50 rounded-xl p-6 border-2 border-purple-500">
          <h3 className="text-xl font-bold text-cyan-400 mb-4 flex items-center gap-2">
            <Trophy className="w-6 h-6" />
            Paytable (x Bet Amount)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {Object.entries(VIBES_SYMBOLS).map(([symbol, data]) => (
              <div key={symbol} className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 rounded-lg p-3 border border-cyan-500/30">
                <div className="text-3xl text-center mb-1">{symbol} {symbol} {symbol}</div>
                <div className="text-yellow-400 font-bold text-center">x{data.multiplier}</div>
                <div className="text-gray-400 text-xs text-center">{data.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
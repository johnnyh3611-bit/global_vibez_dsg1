import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';

import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';
// Modern Card Component - Large, clean design
const ModernPokerCard = ({ card, size = 'md' }) => {
  if (!card) return null;
  
  const sizeClasses = {
    sm: 'w-16 h-24',
    md: 'w-20 h-32',
    lg: 'w-24 h-36'
  };
  
  const suits = { H: '♥️', D: '♦️', C: '♣️', S: '♠️' };
  const suitColors = { H: '#ef4444', D: '#ef4444', C: '#000000', S: '#000000' };
  
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  
  return (
    <motion.div
      whileHover={{ y: -8, scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`${sizeClasses[size]} bg-white rounded-xl shadow-2xl flex flex-col justify-between p-2 relative overflow-hidden`}
      style={{
        boxShadow: '0 8px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,0,0,0.1)'
      }}
    >
      {/* Top rank */}
      <div className="flex flex-col items-center" style={{ color: suitColors[suit] }}>
        <span className="text-lg font-black leading-none">{rank}</span>
        <span className="text-base leading-none">{suits[suit]}</span>
      </div>
      
      {/* Center suit */}
      <div className="absolute inset-0 flex items-center justify-center opacity-20">
        <span className="text-5xl" style={{ color: suitColors[suit] }}>
          {suits[suit]}
        </span>
      </div>
      
      {/* Bottom rank (rotated) */}
      <div className="flex flex-col items-center rotate-180" style={{ color: suitColors[suit] }}>
        <span className="text-lg font-black leading-none">{rank}</span>
        <span className="text-base leading-none">{suits[suit]}</span>
      </div>
    </motion.div>
  );
};

// Chip Component
const Chip = ({ value, className = '' }) => (
  <div className={`px-3 py-1 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 text-white text-xs font-black shadow-lg ${className}`}>
    ${value}
  </div>
);

export function ModernPoker({ game, onMove, makingMove, aiThinking }: { game?: any, onMove?: any, makingMove?: any, aiThinking?: any }) {
  const playerHand = game.game_state?.player_hand || [];
  const communityCards = game.game_state?.community_cards || [];
  const pot = game.game_state?.pot || 0;
  const playerChips = game.game_state?.player_chips || 1000;
  const aiChips = game.game_state?.ai_chips || 1000;
  const currentBet = game.game_state?.current_bet || 0;
  const [gameResult, setGameResult] = useState(null);
  const { width, height } = useWindowSize();
  
  const gameOver = game.status === 'completed';
  const playerWon = gameOver && game.winner === 'player';
  const isPlayerTurn = game.current_turn === 'player' && !gameOver;

  useEffect(() => {
    if (gameOver) {
      if (game.winner === 'player') {
        setGameResult({ type: 'win', message: 'You Win!' });
      } else if (game.winner === 'ai') {
        setGameResult({ type: 'lose', message: 'AI Wins' });
      } else {
        setGameResult({ type: 'draw', message: 'Split Pot' });
      }
    }
  }, [gameOver, game.winner]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 p-3 sm:p-6">
      {playerWon && (
        <Confetti
          width={width}
          height={height}
          recycle={false}
          numberOfPieces={300}
          gravity={0.2}
        />
      )}

      <div className="max-w-md mx-auto space-y-4">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-black text-white mb-1">
            Texas Hold'em
          </h1>
          <p className="text-gray-400 text-sm">Global Vibez DSG</p>
        </div>

        {/* Game Result Overlay */}
        <AnimatePresence>
          {gameResult && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-gray-800 rounded-3xl p-8 text-center border-2 border-gray-700"
              >
                <div className="text-6xl mb-4">
                  {gameResult.type === 'win' ? '🏆' : gameResult.type === 'lose' ? '😔' : '🤝'}
                </div>
                <h3 className={`text-3xl font-black mb-4 ${
                  gameResult.type === 'win' ? 'text-green-400' : 
                  gameResult.type === 'lose' ? 'text-red-400' : 'text-blue-400'
                }`}>
                  {gameResult.message}
                </h3>
                <Chip value={pot} className="inline-block text-lg px-6 py-2" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Player Stats */}
        <div className="grid grid-cols-2 gap-3">
          {/* AI */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-3 border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center text-white text-xs font-bold">
                AI
              </div>
              <div className="flex-1">
                <p className="text-white/60 text-xs">Opponent</p>
                <p className="text-white font-bold text-sm">${aiChips}</p>
              </div>
            </div>
          </div>

          {/* Player */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-3 border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white text-xs font-bold">
                YOU
              </div>
              <div className="flex-1">
                <p className="text-white/60 text-xs">Your Chips</p>
                <p className="text-white font-bold text-sm">${playerChips}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Turn Indicator */}
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className={`text-center py-2 rounded-full font-bold text-sm ${
            isPlayerTurn 
              ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white' 
              : 'bg-white/5 text-gray-400'
          }`}
        >
          {gameOver ? '🎰 Game Over' : isPlayerTurn ? '✨ Your Turn' : '⏳ AI Thinking...'}
        </motion.div>

        {/* Table Area */}
        <div className="bg-gradient-to-br from-green-900/40 to-emerald-900/40 backdrop-blur-md rounded-3xl p-6 border-2 border-green-700/30 shadow-2xl">
          {/* Community Cards */}
          <div className="mb-6">
            <p className="text-center text-green-300 text-xs font-bold mb-3">Community Cards</p>
            <div className="flex justify-center gap-2 flex-wrap">
              {communityCards.map((card, i) => (
                <motion.div
                  key={`community-${card.suit}-${card.rank}-${i}`}
                  initial={{ scale: 0, rotateY: 180 }}
                  animate={{ scale: 1, rotateY: 0 }}
                  transition={{ delay: i * 0.15, type: 'spring' }}
                >
                  <ModernPokerCard card={card} size="md" />
                </motion.div>
              ))}
              {[...Array(5 - communityCards.length)].map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="w-20 h-32 rounded-xl bg-white/5 border-2 border-dashed border-white/20 flex items-center justify-center"
                >
                  <span className="text-white/20 text-2xl">?</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pot */}
          <motion.div
            animate={{ scale: [1, 1.03, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-center"
          >
            <div className="inline-block bg-black/40 backdrop-blur-sm px-6 py-3 rounded-full border-2 border-yellow-500/50">
              <p className="text-yellow-400 text-xs mb-1">💰 POT</p>
              <p className="text-2xl font-black text-yellow-400">${pot}</p>
            </div>
          </motion.div>
        </div>

        {/* Player Hand */}
        <div>
          <p className="text-center text-blue-300 text-xs font-bold mb-3">Your Cards</p>
          <div className="flex justify-center gap-3">
            {playerHand.map((card, i) => (
              <motion.div
                key={`player-${card.suit}-${card.rank}-${i}`}
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 + i * 0.1, type: 'spring' }}
              >
                <ModernPokerCard card={card} size="lg" />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        {!gameOver && (
          <div className="space-y-2">
            <button
              onClick={() => onMove({ action: 'raise' })}
              disabled={!isPlayerTurn || makingMove}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl shadow-xl transition-all"
            >
              <span className="text-lg">📈 RAISE</span>
            </button>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onMove({ action: 'call' })}
                disabled={!isPlayerTurn || makingMove}
                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl shadow-lg transition-all"
              >
                <span className="text-sm">🤝 CALL ${currentBet}</span>
              </button>
              
              <button
                onClick={() => onMove({ action: 'fold' })}
                disabled={!isPlayerTurn || makingMove}
                className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl shadow-lg transition-all"
              >
                <span className="text-sm">🚫 FOLD</span>
              </button>
            </div>
          </div>
        )}

        {/* Hint */}
        <p className="text-center text-gray-500 text-xs">
          💡 Best 5-card hand wins
        </p>
      </div>
    </div>
  );
}

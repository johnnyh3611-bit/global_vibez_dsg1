
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import { MessageCircle, Menu, Coins } from 'lucide-react';

import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';
// 3D Playing Card Component (Spades Plus Style)
const RealisticCard = ({ card, style = {}, index = 0, totalCards = 1, onClick, isPlayable }) => {
  if (!card) return null;
  
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  
  const suitSymbols = { H: '♥', D: '♦', C: '♣', S: '♠' };
  const suitColors = { H: '#DC143C', D: '#DC143C', C: '#000000', S: '#000000' };
  
  const displayRank = rank === '10' ? '10' : rank;
  const suitSymbol = suitSymbols[suit];
  const suitColor = suitColors[suit];
  
  // Calculate fan spread for player's hand
  const totalSpread = Math.min(totalCards * 8, 100);
  const startAngle = -totalSpread / 2;
  const anglePerCard = totalCards > 1 ? totalSpread / (totalCards - 1) : 0;
  const cardAngle = startAngle + (index * anglePerCard);
  const cardOffset = index * 18;
  
  return (
    <motion.div
      onClick={onClick}
      whileHover={isPlayable ? { y: -20, scale: 1.05 } : {}}
      className="absolute cursor-pointer"
      style={{
        left: `calc(50% - 40px + ${cardOffset - (totalCards * 9)}px)`,
        bottom: '-20px',
        transform: `rotate(${cardAngle}deg)`,
        zIndex: index,
        ...style
      }}
    >
      <div 
        className="relative w-20 h-28 sm:w-24 sm:h-32 bg-white rounded-lg shadow-2xl"
        style={{
          boxShadow: '0 10px 30px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.2)',
          background: 'linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%)'
        }}
      >
        {/* Card corners */}
        <div className="absolute top-1 left-1 flex flex-col items-center leading-none" style={{ color: suitColor }}>
          <div className="text-base sm:text-lg font-bold">{displayRank}</div>
          <div className="text-sm sm:text-base">{suitSymbol}</div>
        </div>
        
        {/* Center suit */}
        <div className="absolute inset-0 flex items-center justify-center opacity-10">
          <div className="text-6xl" style={{ color: suitColor }}>{suitSymbol}</div>
        </div>
        
        {/* Bottom corner (rotated) */}
        <div className="absolute bottom-1 right-1 flex flex-col items-center leading-none rotate-180" style={{ color: suitColor }}>
          <div className="text-base sm:text-lg font-bold">{displayRank}</div>
          <div className="text-sm sm:text-base">{suitSymbol}</div>
        </div>
        
        {/* Playable indicator */}
        {isPlayable && (
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center"
          >
            <span className="text-white text-xs font-bold">✓</span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

// Player Avatar Component
const PlayerAvatar = ({ position, playerData, isActive }) => {
  const positions = {
    top: 'top-2 left-1/2 -translate-x-1/2',
    left: 'left-2 top-1/2 -translate-y-1/2',
    right: 'right-2 top-1/2 -translate-y-1/2'
  };
  
  const borderColors = {
    top: isActive ? 'border-blue-500' : 'border-blue-400',
    left: isActive ? 'border-red-500' : 'border-red-400',
    right: isActive ? 'border-pink-500' : 'border-pink-400'
  };
  
  return (
    <div className={`absolute ${positions[position]} z-20`}>
      <div className="flex flex-col items-center">
        <div 
          className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full border-4 ${borderColors[position]} overflow-hidden shadow-xl bg-gradient-to-br from-gray-700 to-gray-900`}
        >
          <div className="w-full h-full flex items-center justify-center text-white text-lg font-bold">
            {playerData.name}
          </div>
        </div>
        
        {/* Card count badge */}
        <div className="mt-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg border-2 border-white">
          {playerData.cardCount}/{playerData.totalCards}
        </div>
      </div>
    </div>
  );
};

export function SpadesStylePoker({ game, onMove, makingMove, aiThinking }: { game?: any, onMove?: any, makingMove?: any, aiThinking?: any }) {
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
      setGameResult({
        type: game.winner === 'player' ? 'win' : game.winner === 'ai' ? 'lose' : 'draw',
        message: game.winner === 'player' ? 'You Win!' : game.winner === 'ai' ? 'AI Wins' : 'Split Pot'
      });
    }
  }, [gameOver, game.winner]);

  const handleCardClick = (card) => {
    if (isPlayerTurn && !makingMove) {
      // In poker, cards aren't clicked to play, but we can use this for future features
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden" style={{
      background: 'linear-gradient(135deg, #2d3748 0%, #1a202c 50%, #2d3748 100%)',
      backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,.03) 10px, rgba(255,255,255,.03) 20px)'
    }}>
      {playerWon && <Confetti width={width} height={height} recycle={false} numberOfPieces={300} />}

      {/* Top UI Bar - Spades Plus Style */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-3 bg-gradient-to-b from-black/40 to-transparent">
        <div className="flex items-center gap-2">
          <button className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl shadow-lg flex items-center justify-center border-2 border-blue-300">
            <span className="text-white text-xl">🎴</span>
          </button>
          <button className="px-4 py-2 bg-gradient-to-br from-green-500 to-green-700 rounded-xl shadow-lg flex items-center gap-1 border-2 border-green-300">
            <Coins className="w-4 h-4 text-white" />
            <span className="text-white text-xs font-bold">Buy</span>
          </button>
        </div>
        
        <div className="bg-black/60 backdrop-blur-sm px-4 py-1 rounded-full border-2 border-blue-400/50">
          <div className="text-blue-300 text-xs font-bold">Final Pts: {pot}</div>
        </div>
        
        <div className="flex items-center gap-2">
          <button className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl shadow-lg flex items-center justify-center border-2 border-blue-300">
            <MessageCircle className="w-5 h-5 text-white" />
          </button>
          <button className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl shadow-lg flex items-center justify-center border-2 border-blue-300">
            <Menu className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="absolute inset-0 flex items-center justify-center pt-16 pb-32">
        {/* 3D Table Container */}
        <div 
          className="relative w-full max-w-2xl aspect-[4/3]"
          style={{
            transform: 'perspective(1200px) rotateX(25deg)',
            transformStyle: 'preserve-3d'
          }}
        >
          {/* Wooden Frame Border */}
          <div 
            className="absolute inset-0 rounded-3xl"
            style={{
              background: 'linear-gradient(135deg, #8B4513 0%, #A0522D 25%, #8B4513 50%, #654321 75%, #8B4513 100%)',
              padding: '20px',
              boxShadow: 'inset 0 4px 8px rgba(0,0,0,0.5), 0 20px 60px rgba(0,0,0,0.8)'
            }}
          >
            {/* Inner Dark Border */}
            <div 
              className="absolute inset-0 m-4 rounded-3xl"
              style={{
                background: 'linear-gradient(135deg, #3d2817 0%, #2d1f12 100%)',
                boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.8)'
              }}
            />
            
            {/* Gold Inner Rim */}
            <div 
              className="absolute inset-0 m-6 rounded-3xl"
              style={{
                background: 'linear-gradient(135deg, #D4AF37 0%, #FFD700 50%, #D4AF37 100%)',
                padding: '3px'
              }}
            >
              {/* Green Felt Surface */}
              <div 
                className="w-full h-full rounded-3xl relative overflow-hidden"
                style={{
                  background: 'radial-gradient(ellipse at center, #228B22 0%, #1a6b1a 50%, #0d4d0d 100%)',
                  backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,.02) 5px, rgba(255,255,255,.02) 10px)',
                  boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.4)'
                }}
              >
                {/* Player Avatars */}
                <PlayerAvatar 
                  position="top" 
                  playerData={{ name: 'AI', cardCount: communityCards.length, totalCards: 5 }}
                  isActive={!isPlayerTurn && !gameOver}
                />
                
                {/* Community Cards Area */}
                <div className="absolute top-8 left-1/2 -translate-x-1/2 w-full max-w-xs">
                  <div className="flex justify-center gap-2">
                    {communityCards.map((card, i) => (
                      <motion.div
                        key={`community-${card.suit}-${card.rank}-${i}`}
                        initial={{ scale: 0, rotateY: 180 }}
                        animate={{ scale: 1, rotateY: 0 }}
                        transition={{ delay: i * 0.15 }}
                      >
                        <RealisticCard 
                          card={card} 
                          style={{ position: 'relative', left: 'auto', bottom: 'auto', transform: 'none' }}
                          onClick={() => {}}
                          isPlayable={false}
                        />
                      </motion.div>
                    ))}
                  </div>
                </div>
                
                {/* Pot Display */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <motion.div
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="bg-black/60 backdrop-blur-sm px-6 py-3 rounded-full border-3 border-yellow-500/70 shadow-2xl"
                  >
                    <div className="text-yellow-400 text-xs text-center mb-1">💰 POT</div>
                    <div className="text-yellow-300 text-2xl font-black text-center">${pot}</div>
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Player Hand (Bottom - Outside Table) */}
      <div className="absolute bottom-0 left-0 right-0 h-48 flex items-end justify-center">
        <div className="relative w-full max-w-2xl h-40">
          {/* Player Avatar Badge */}
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30">
            <PlayerAvatar 
              position="top" 
              playerData={{ name: 'YOU', cardCount: playerHand.length, totalCards: playerHand.length }}
              isActive={isPlayerTurn}
            />
          </div>
          
          {/* Curved Card Hand */}
          {playerHand.map((card, i) => (
            <RealisticCard
              key={`player-${card.suit}-${card.rank}-${i}`}
              card={card}
              index={i}
              totalCards={playerHand.length}
              onClick={() => handleCardClick(card)}
              isPlayable={isPlayerTurn}
            />
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      {!gameOver && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-40">
          <button
            onClick={() => onMove({ action: 'fold' })}
            disabled={!isPlayerTurn || makingMove}
            className="bg-gradient-to-br from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:opacity-30 text-white font-bold px-6 py-2 rounded-xl shadow-xl border-2 border-red-300 text-sm"
          >
            🚫 FOLD
          </button>
          <button
            onClick={() => onMove({ action: 'call' })}
            disabled={!isPlayerTurn || makingMove}
            className="bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-30 text-white font-bold px-6 py-2 rounded-xl shadow-xl border-2 border-blue-300 text-sm"
          >
            🤝 CALL ${currentBet}
          </button>
          <button
            onClick={() => onMove({ action: 'raise' })}
            disabled={!isPlayerTurn || makingMove}
            className="bg-gradient-to-br from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:opacity-30 text-white font-bold px-6 py-2 rounded-xl shadow-xl border-2 border-green-300 text-sm"
          >
            📈 RAISE
          </button>
        </div>
      )}

      {/* Game Result */}
      <AnimatePresence>
        {gameResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-3xl p-8 text-center border-4 border-yellow-500 shadow-2xl"
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
              <div className="text-yellow-400 text-2xl font-bold">${pot}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

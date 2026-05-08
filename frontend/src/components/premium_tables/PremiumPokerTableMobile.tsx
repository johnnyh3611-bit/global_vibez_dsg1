import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PortraitBlocker } from './RotationPrompt';

/**
 * MOBILE-OPTIMIZED POKER TABLE
 * - Landscape-first design for optimal view
 * - Auto-rotation support
 * - Entire board visible without scrolling
 * - Touch-optimized controls
 */
export function PremiumPokerTableMobile({ game, 
  onMove, 
  makingMove, 
  aiThinking,
  theme = 'emerald', }: { game?: any, onMove?: any, makingMove?: any, aiThinking?: any, theme?: any }) {
  const playerHand = game?.game_state?.player_hand || ['AH', 'KD'];
  const communityCards = game?.game_state?.community_cards || ['QS', '10H', '7C'];
  const pot = game?.game_state?.pot || 150;
  const playerChips = game?.game_state?.player_chips || 1000;
  const aiChips = game?.game_state?.ai_chips || 1000;
  const [selectedCard, setSelectedCard] = useState(null);
  
  const gameOver = game?.status === 'completed';
  const playerWon = gameOver && game?.winner === 'player';
  const currentTurn = game?.current_turn || 'player';

  return (
    <PortraitBlocker gameName="Poker" allowPortrait={false}>
      <div className="relative w-full h-screen bg-gradient-to-b from-[#0F172A] to-[#080C16] overflow-hidden">
        {/* Mobile Header - Compact */}
        <div className="absolute top-0 left-0 right-0 z-20 bg-black/60 backdrop-blur-md py-2 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 flex items-center justify-center">
                <span className="text-xs font-black">♠️</span>
              </div>
              <div>
                <h3 className="text-white text-sm font-black">Texas Hold'em</h3>
                <p className="text-white/40 text-xs">Premium Tables</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-yellow-400 text-xs font-bold">💰 ${playerChips}</p>
              <p className="text-white/60 text-xs">{playerHand.length} cards</p>
            </div>
          </div>
        </div>

        {/* MOBILE GAME BOARD - Landscape Optimized */}
        <div className="absolute inset-0 flex items-center justify-between px-4 pt-16 pb-24">
          
          {/* LEFT SIDE - AI Player */}
          <div className="flex flex-col items-center">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-2 ${
              currentTurn === 'ai_2' ? 'bg-pink-500 animate-pulse' : 'bg-gray-700'
            }`}>
              <span className="text-white text-sm font-bold">P2</span>
            </div>
            <div className="flex gap-1 mb-2">
              {[0, 1].map((c) => (
                <div key={c} className="w-8 h-12 bg-gradient-to-br from-gray-800 to-gray-900 rounded border border-pink-500" />
              ))}
            </div>
            <p className="text-white/60 text-xs">₵{aiChips}</p>
          </div>

          {/* CENTER - Game Board */}
          <div className="flex-1 flex flex-col items-center justify-center px-4">
            {/* Top AI Player */}
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                currentTurn === 'ai_1' ? 'bg-pink-500 animate-pulse' : 'bg-gray-700'
              }`}>
                <span className="text-white text-xs font-bold">P1</span>
              </div>
              <div className="flex gap-1">
                {[0, 1].map((c) => (
                  <div key={c} className="w-7 h-10 bg-gradient-to-br from-gray-800 to-gray-900 rounded border border-pink-500" />
                ))}
              </div>
              <p className="text-white/60 text-xs">₵{aiChips}</p>
            </div>

            {/* Community Cards + Pot */}
            <div className="bg-emerald-800/80 rounded-3xl p-4 mb-4 border-4 border-amber-600/50">
              <div className="flex items-center justify-center gap-2 mb-3">
                {communityCards.map((card, i) => (
                  <MobileCard key={card.id || `communityCards-${i}`} card={card} size="sm" />
                ))}
                {[...Array(5 - communityCards.length)].map((_, i) => (
                  <div key={`empty-${i}`} className="w-10 h-14 border-2 border-dashed border-yellow-400/40 rounded-lg" />
                ))}
              </div>
              
              {/* Pot Display */}
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="bg-black/80 px-4 py-2 rounded-full border-2 border-yellow-400"
              >
                <p className="text-yellow-400 text-xs font-bold text-center">💰 POT</p>
                <p className="text-white text-xl font-black text-center">₵{pot}</p>
              </motion.div>
            </div>

            {/* Player's Hand */}
            <div className="flex gap-2 justify-center">
              {playerHand.map((card, i) => (
                <motion.div
                  key={card.id || `playerHand-${i}`}
                  whileTap={{ scale: selectedCard === i ? 1 : 1.1 }}
                  onClick={() => setSelectedCard(selectedCard === i ? null : i)}
                  className={`transition-transform ${selectedCard === i ? 'translate-y-[-10px]' : ''}`}
                >
                  <MobileCard 
                    card={card} 
                    size="md" 
                    isSelected={selectedCard === i}
                  />
                </motion.div>
              ))}
            </div>
          </div>

          {/* RIGHT SIDE - AI Player */}
          <div className="flex flex-col items-center">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-2 ${
              currentTurn === 'ai_3' ? 'bg-pink-500 animate-pulse' : 'bg-gray-700'
            }`}>
              <span className="text-white text-sm font-bold">P3</span>
            </div>
            <div className="flex gap-1 mb-2">
              {[0, 1].map((c) => (
                <div key={c} className="w-8 h-12 bg-gradient-to-br from-gray-800 to-gray-900 rounded border border-pink-500" />
              ))}
            </div>
            <p className="text-white/60 text-xs">₵{aiChips}</p>
          </div>
        </div>

        {/* MOBILE ACTION BUTTONS - Bottom Fixed Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-xl border-t-2 border-white/10 p-3 z-30">
          <div className="flex gap-2 justify-center">
            <ActionButtonMobile
              label="FOLD"
              icon="🚫"
              color="red"
              onClick={() => onMove({ action: 'fold' })}
              disabled={makingMove || aiThinking || currentTurn !== 'player'}
            />
            <ActionButtonMobile
              label="CALL"
              icon="🤝"
              color="blue"
              onClick={() => onMove({ action: 'call' })}
              disabled={makingMove || aiThinking || currentTurn !== 'player'}
            />
            <ActionButtonMobile
              label="RAISE"
              icon="📈"
              color="green"
              onClick={() => onMove({ action: 'raise' })}
              disabled={makingMove || aiThinking || currentTurn !== 'player'}
            />
          </div>
        </div>

        {/* Game Over Overlay */}
        <AnimatePresence>
          {gameOver && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
            >
              <div className="text-center">
                <div className="text-8xl mb-4">{playerWon ? '🏆' : '😔'}</div>
                <h2 className={`text-4xl font-black mb-2 ${
                  playerWon ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {playerWon ? 'YOU WIN!' : 'YOU LOSE!'}
                </h2>
                <p className="text-white text-2xl">₵{pot}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PortraitBlocker>
  );
}

// Mobile Card Component (Simplified, no 3D)
function MobileCard({ card, size = 'md', isSelected = false }: { card?: any, size?: any, isSelected?: any }) {
  const isRed = card.includes('H') || card.includes('D');
  const suitSymbol = card.includes('H') ? '♥' : 
                     card.includes('D') ? '♦' : 
                     card.includes('S') ? '♠' : '♣';
  const rank = card.replace(/[HDSC]/g, '');

  const sizes = {
    sm: 'w-10 h-14 text-xs',
    md: 'w-14 h-20 text-base',
    lg: 'w-16 h-24 text-lg',
  };

  return (
    <div 
      className={`${sizes[size]} bg-white rounded-lg shadow-2xl border-2 ${
        isSelected ? 'border-yellow-400' : 'border-gray-300'
      } flex flex-col items-center justify-center relative`}
    >
      <div className={`font-black ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
        {rank}
      </div>
      <div className={`text-2xl ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
        {suitSymbol}
      </div>
      
      {/* Corner pips */}
      <div className={`absolute top-1 left-1 text-xs font-bold ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
        {rank}
      </div>
      <div className={`absolute bottom-1 right-1 text-xs font-bold rotate-180 ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
        {rank}
      </div>
    </div>
  );
}

// Mobile Action Button
function ActionButtonMobile({ label, icon, color, onClick, disabled }: { label?: any, icon?: any, color?: any, onClick?: any, disabled?: any }) {
  const colors = {
    red: 'from-red-600 to-red-700',
    blue: 'from-blue-600 to-blue-700',
    green: 'from-green-600 to-green-700',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 bg-gradient-to-r ${colors[color]} disabled:opacity-50 text-white font-black py-4 px-6 rounded-xl shadow-lg active:scale-95 transition-transform`}
    >
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-xs">{label}</div>
    </button>
  );
}

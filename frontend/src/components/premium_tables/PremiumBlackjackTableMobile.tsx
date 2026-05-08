import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PortraitBlocker } from './RotationPrompt';

export function PremiumBlackjackTableMobile({ game, 
  onMove, 
  makingMove, 
  aiThinking,
  theme = 'rose', }: { game?: any, onMove?: any, makingMove?: any, aiThinking?: any, theme?: any }) {
  const playerHand = game?.game_state?.player_hand || ['AH', 'KD'];
  const dealerHand = game?.game_state?.dealer_hand || ['QS', '??'];
  const playerTotal = game?.game_state?.player_total || 21;
  const dealerTotal = game?.game_state?.dealer_total || 12;
  const playerChips = game?.game_state?.player_chips || 1000;
  const currentBet = game?.game_state?.current_bet || 50;
  const [betAmount, setBetAmount] = useState(50);
  
  const gameOver = game?.status === 'completed';
  const playerWon = gameOver && game?.winner === 'player';
  const isBlackjack = playerTotal === 21 && playerHand.length === 2;
  const isBust = playerTotal > 21;
  const currentTurn = game?.current_turn || 'player';
  const canSplit = playerHand.length === 2 && playerHand[0][0] === playerHand[1][0];

  return (
    <PortraitBlocker gameName="Blackjack" allowPortrait={false}>
      <div className="relative w-full h-screen bg-gradient-to-br from-rose-900 via-pink-900 to-purple-900 overflow-hidden">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-20 bg-black/60 backdrop-blur-md py-2 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="text-2xl">🎰</div>
              <div>
                <h3 className="text-white text-sm font-black">Blackjack</h3>
                <p className="text-white/40 text-xs">Premium Tables</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-yellow-400 text-xs font-bold">💰 ${playerChips}</p>
              <p className="text-white/60 text-xs">Bet: ₵{currentBet}</p>
            </div>
          </div>
        </div>

        {/* Game Board */}
        <div className="absolute inset-0 flex flex-col items-center justify-between pt-16 pb-24 px-4">
          
          {/* Dealer Section - Top */}
          <div className="flex flex-col items-center">
            <div className="bg-red-900/40 backdrop-blur-sm px-6 py-2 rounded-full mb-3 border-2 border-red-500/50">
              <p className="text-red-400 text-xs font-bold">🎰 DEALER</p>
              <p className="text-white text-2xl font-black text-center">
                {dealerHand.includes('??') ? '?' : dealerTotal}
              </p>
            </div>
            <div className="flex gap-2">
              {dealerHand.map((card, i) => (
                <BlackjackCardMobile 
                  key={`dealerHand-${i}`} 
                  card={card === '??' ? 'BACK' : card} 
                  faceUp={card !== '??'}
                  size="md" 
                />
              ))}
            </div>
          </div>

          {/* Bet Display - Center */}
          <div className="flex flex-col items-center">
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="bg-black/80 backdrop-blur-xl px-8 py-4 rounded-full border-3 border-yellow-400 shadow-2xl"
            >
              <p className="text-yellow-400 text-xs font-bold text-center mb-1">💰 BET</p>
              <p className="text-white text-3xl font-black text-center">₵{currentBet}</p>
            </motion.div>
          </div>

          {/* Player Section - Bottom */}
          <div className="flex flex-col items-center">
            <div className="flex gap-2 mb-3">
              {playerHand.map((card, i) => (
                <BlackjackCardMobile key={card.id || `playerHand-${i}`} card={card} faceUp size="lg" />
              ))}
            </div>
            <div className={`backdrop-blur-sm px-6 py-2 rounded-full border-2 ${
              isBust ? 'bg-red-900/40 border-red-500/50' : 
              isBlackjack ? 'bg-green-900/40 border-green-500/50' : 
              'bg-cyan-900/40 border-cyan-500/50'
            }`}>
              <p className={`text-xs font-bold ${
                isBust ? 'text-red-400' : isBlackjack ? 'text-green-400' : 'text-cyan-400'
              }`}>
                🎴 YOU
              </p>
              <p className={`text-3xl font-black text-center ${
                isBust ? 'text-red-500' : isBlackjack ? 'text-green-400' : 'text-white'
              }`}>
                {playerTotal}
              </p>
              {isBlackjack && <p className="text-green-400 text-xs text-center font-bold">BLACKJACK!</p>}
              {isBust && <p className="text-red-500 text-xs text-center font-bold">BUST!</p>}
            </div>
          </div>
        </div>

        {/* Action Buttons - Bottom Bar */}
        {!gameOver && currentTurn === 'player' && (
          <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-xl border-t-2 border-white/10 p-3 z-30">
            <div className="grid grid-cols-3 gap-2">
              <ActionButtonMobile
                label="HIT"
                icon="🎴"
                color="blue"
                onClick={() => onMove({ action: 'hit' })}
                disabled={makingMove || aiThinking || isBust}
              />
              <ActionButtonMobile
                label="STAND"
                icon="🛑"
                color="red"
                onClick={() => onMove({ action: 'stand' })}
                disabled={makingMove || aiThinking || isBust}
              />
              <ActionButtonMobile
                label="DOUBLE"
                icon="💎"
                color="purple"
                onClick={() => onMove({ action: 'double' })}
                disabled={makingMove || aiThinking || playerHand.length > 2}
              />
            </div>
            {canSplit && (
              <button
                onClick={() => onMove({ action: 'split' })}
                disabled={makingMove || aiThinking}
                className="w-full mt-2 bg-gradient-to-r from-green-600 to-green-700 text-white font-bold py-3 rounded-lg"
              >
                ✂️ SPLIT
              </button>
            )}
          </div>
        )}

        {/* Betting UI */}
        {!game?.game_state && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-black/90 backdrop-blur-xl p-6 rounded-2xl border-2 border-yellow-400 max-w-md w-full">
              <p className="text-white text-xl font-bold text-center mb-4">Place Your Bet</p>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[10, 25, 50, 100, 250, 500].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setBetAmount(amount)}
                    className={`py-3 rounded-lg font-bold ${
                      betAmount === amount
                        ? 'bg-yellow-500 text-black'
                        : 'bg-white/10 text-white'
                    }`}
                  >
                    ₵{amount}
                  </button>
                ))}
              </div>
              <button
                onClick={() => onMove({ action: 'deal', bet: betAmount })}
                className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white font-black py-4 rounded-xl text-lg"
              >
                🎰 DEAL CARDS
              </button>
            </div>
          </div>
        )}

        {/* Game Over */}
        <AnimatePresence>
          {gameOver && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
            >
              <div className="text-center">
                <div className="text-8xl mb-4">{playerWon ? '🎰' : '😔'}</div>
                <h2 className={`text-4xl font-black mb-2 ${
                  playerWon ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {playerWon ? 'YOU WIN!' : 'DEALER WINS!'}
                </h2>
                <p className="text-white text-2xl mb-4">
                  {playerWon ? `+$${currentBet * (isBlackjack ? 1.5 : 1)}` : `-$₵{currentBet}`}
                </p>
                <button
                  onClick={() => onMove({ action: 'new_game' })}
                  className="bg-gradient-to-r from-green-600 to-green-700 text-white font-bold px-8 py-3 rounded-xl"
                >
                  🎰 PLAY AGAIN
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PortraitBlocker>
  );
}

function BlackjackCardMobile({ card, faceUp = true, size = 'md' }: { card?: any, faceUp?: any, size?: any }) {
  if (card === 'BACK') {
    return (
      <div className={`${size === 'lg' ? 'w-16 h-24' : 'w-12 h-18'} bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border-2 border-pink-500 flex items-center justify-center`}>
        <span className="text-pink-400 text-xs font-bold">GLOBAL<br/>VIBEZ</span>
      </div>
    );
  }

  const isRed = card.includes('H') || card.includes('D');
  const suitSymbol = card.includes('H') ? '♥' : 
                     card.includes('D') ? '♦' : 
                     card.includes('S') ? '♠' : '♣';
  const rank = card.replace(/[HDSC]/g, '');

  return (
    <div className={`${size === 'lg' ? 'w-16 h-24' : 'w-12 h-18'} bg-white rounded-lg shadow-2xl border-2 border-gray-300 flex flex-col items-center justify-center`}>
      <div className={`font-black ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
        {rank}
      </div>
      <div className={`text-2xl ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
        {suitSymbol}
      </div>
    </div>
  );
}

function ActionButtonMobile({ label, icon, color, onClick, disabled }: { label?: any, icon?: any, color?: any, onClick?: any, disabled?: any }) {
  const colors = {
    red: 'from-red-600 to-red-700',
    blue: 'from-blue-600 to-blue-700',
    purple: 'from-purple-600 to-purple-700',
    green: 'from-green-600 to-green-700',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`bg-gradient-to-r ${colors[color]} disabled:opacity-50 text-white font-bold py-4 rounded-lg active:scale-95 transition-transform`}
    >
      <div className="text-xl mb-1">{icon}</div>
      <div className="text-xs">{label}</div>
    </button>
  );
}

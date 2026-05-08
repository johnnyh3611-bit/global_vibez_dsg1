
import React, { useState } from 'react';
import { PremiumGameTable } from './PremiumGameTable';
import { AllInOneHandView } from './AllInOneHandView';
import { ViewToggle } from './ViewToggle';
import { useUserAvatar, UserAvatarManager } from './UserAvatarManager';
import { getRandomAvatar } from './avatarSystem';
import { EnhancedCard3D } from './EnhancedCard3D';
import { ChipSplash, SuitConfetti } from './ParticleSystem';
import {
  ShuffleAnimation,
  DealerRevealAnimation,
  BlackjackStatsOverlay,
  CardBurnAnimation,
  BlackjackCelebration,
  DealerAvatar,
  InsuranceOffer,
  AnimatedChipStacks,
} from './BlackjackEnhancements';
import { motion, AnimatePresence } from 'framer-motion';
import { useWindowSize } from 'react-use';
import { useResponsiveGameLayout, CARD_SIZES } from './responsiveLayout';

export function PremiumBlackjackTable({ game, 
  onMove, 
  makingMove, 
  aiThinking,
  theme = 'rose', }: { game?: any, onMove?: any, makingMove?: any, aiThinking?: any, theme?: any }) {
  const [view, setView] = useState('2d');
  const userAvatar = useUserAvatar();
  const [dealerAvatar] = useState(() => getRandomAvatar());
  const playerHand = game?.game_state?.player_hand || ['AH', 'KD'];
  const dealerHand = game?.game_state?.dealer_hand || ['QS', '??']; // ?? = face-down
  const playerTotal = game?.game_state?.player_total || 21;
  const dealerTotal = game?.game_state?.dealer_total || 12;
  const playerChips = game?.game_state?.player_chips || 1000;
  const currentBet = game?.game_state?.current_bet || 50;
  const [betAmount, setBetAmount] = useState(50);
  const [showStats, setShowStats] = useState(false);
  const [showShuffle, setShowShuffle] = useState(false);
  const [showInsurance, setShowInsurance] = useState(false);
  const [dealerMood, setDealerMood] = useState('neutral');
  const { width, height } = useWindowSize();
  
  const layout = useResponsiveGameLayout();
  
  const gameOver = game?.status === 'completed';
  const playerWon = gameOver && game?.winner === 'player';
  const isBlackjack = playerTotal === 21 && playerHand.length === 2;
  const isBust = playerTotal > 21;
  const currentTurn = game?.current_turn || 'player';
  const canSplit = playerHand.length === 2 && playerHand[0][0] === playerHand[1][0];
  
  // AAA ENHANCEMENTS - Mock stats
  const blackjackStats = {
    handsPlayed: 89,
    winRate: 52,
    blackjacks: 12,
    totalWon: 3450,
    biggestWin: 750,
    streak: 3,
  };
  
  // Check if dealer shows Ace (insurance offer)
  const dealerShowsAce = dealerHand[0]?.[0] === 'A' && !gameOver;

  // Prepare data for immersive hand view
  const convertedPlayerHand = playerHand.map((card, i) => {
    const suit = card.slice(-1);
    const rank = card.slice(0, -1);
    const suitMap = { H: '♥️', D: '♦️', C: '♣️', S: '♠️' };
    return {
      id: `${card}-${i}`,
      suit: suitMap[suit] || '🎴',
      rank: rank,
    };
  });

  // 2D Immersive Hand View
  if (view === '2d') {
    return (
      <AllInOneHandView
        playerHand={convertedPlayerHand}
        opponentAvatar={{ emoji: dealerAvatar?.emoji || '🎰', name: 'Dealer' }}
        onCardPlay={() => {}}
      >
        {/* Blackjack-specific overlays */}
        <AnimatePresence>
          {gameOver && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-center"
              >
                <div className="text-9xl mb-4">{playerWon ? '🎰' : '😔'}</div>
                <h3 className={`text-6xl font-black mb-4 ${playerWon ? 'text-green-400' : 'text-red-400'}`}>
                  {playerWon ? 'YOU WIN!' : 'DEALER WINS!'}
                </h3>
                <p className="text-yellow-400 text-4xl font-black mb-2">
                  {playerWon ? `+₵${currentBet * (isBlackjack ? 1.5 : 1)}` : `-₵${currentBet}`}
                </p>
                <button
                  onClick={() => onMove({ action: 'new_game' })}
                  className="mt-6 bg-gradient-to-r from-green-600 to-green-700 text-white font-black px-8 py-4 rounded-xl text-lg"
                >
                  🎰 PLAY AGAIN
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Action Buttons */}
        {!gameOver && currentTurn === 'player' && (
          <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-30">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex gap-3">
              <button onClick={() => onMove({ action: 'hit' })} disabled={makingMove || aiThinking || isBust} className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-xl disabled:opacity-50">🎴 HIT</button>
              <button onClick={() => onMove({ action: 'stand' })} disabled={makingMove || aiThinking || isBust} className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white font-bold rounded-xl disabled:opacity-50">🛑 STAND</button>
              <button onClick={() => onMove({ action: 'double' })} disabled={makingMove || aiThinking || playerHand.length > 2 || playerChips < currentBet} className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-bold rounded-xl disabled:opacity-50">💎 DOUBLE</button>
              {canSplit && <button onClick={() => onMove({ action: 'split' })} disabled={makingMove || aiThinking || playerChips < currentBet} className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white font-bold rounded-xl disabled:opacity-50">✂️ SPLIT</button>}
            </motion.div>
          </div>
        )}
        
        {/* Betting UI */}
        {!game?.game_state && (
          <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-30">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-black/80 backdrop-blur-xl p-6 rounded-2xl border-2 border-yellow-400">
              <p className="text-white text-lg font-bold text-center mb-4">Place Your Bet</p>
              <button onClick={() => onMove({ action: 'deal', bet: 50 })} className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white font-black py-4 rounded-xl text-lg">🎰 DEAL CARDS</button>
            </motion.div>
          </div>
        )}
      </AllInOneHandView>
    );
  }

  // 3D View
  return (
    <div className="relative w-full h-screen bg-[#080C16]">
      <ViewToggle view={view} onToggle={setView} />
      <UserAvatarManager />
      {/* AAA ENHANCEMENTS */}
      <ShuffleAnimation trigger={showShuffle} onComplete={() => setShowShuffle(false)} />
      <BlackjackStatsOverlay stats={blackjackStats} visible={showStats} />
      <InsuranceOffer 
        visible={showInsurance && dealerShowsAce} 
        onAccept={() => {
          setShowInsurance(false);
          onMove({ action: 'insurance' });
        }}
        onDecline={() => setShowInsurance(false)}
      />
      <BlackjackCelebration type={isBlackjack ? 'blackjack' : isBust ? 'bust' : null} />
      
      <SuitConfetti 
        active={playerWon || isBlackjack} 
        colors={['#fbbf24', '#f59e0b', '#22c55e', '#dc2626']} 
      />

      <PremiumGameTable 
        theme={theme}
        activePlayerPosition={{ x: 50, y: 80 }}
        potAmount={currentBet}
        layout={layout}
      >
        {/* AAA ENHANCEMENT: Dealer Avatar */}
        <div
          className="absolute"
          style={{
            left: 'calc(50%)',
            top: 'calc(50% - 350px)',
            transform: 'translate(-50%, -50%) translateZ(40px)',
          }}
        >
          <DealerAvatar mood={dealerMood} />
        </div>
        
        {/* Dealer's Hand - Top */}
        {dealerHand.map((card, i) => {
          const isFaceDown = card === '??';
          return (
            <EnhancedCard3D
              key={`dealerHand-${i}`}
              card={isFaceDown ? 'BACK' : card}
              position3D={{ x: -50 + i * 100, y: -200, z: 30 }}
              rotation3D={{ x: 15, y: 0, z: 0 }}
              faceUp={!isFaceDown}
              size={layout.cardSize}
              theme={theme}
            />
          );
        })}
        
        {/* Dealer Total Display */}
        <div
          className="absolute"
          style={{
            left: 'calc(50%)',
            top: 'calc(50% - 280px)',
            transform: 'translate(-50%, -50%) translateZ(60px)',
          }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="bg-black/80 backdrop-blur-xl px-6 py-3 rounded-full border-2 border-red-500"
          >
            <p className="text-red-400 text-xs font-bold text-center mb-1">🎰 DEALER</p>
            <p className="text-white text-2xl font-black text-center">
              {dealerHand.includes('??') ? '?' : dealerTotal}
            </p>
          </motion.div>
        </div>
        
        {/* Player's Hand - Bottom */}
        {playerHand.map((card, i) => (
          <EnhancedCard3D
            key={card.id || `playerHand-${i}`}
            card={card}
            position3D={{ x: -60 + i * 80, y: 220, z: 100 }}
            rotation3D={{ x: -20, y: 0, z: 0 }}
            faceUp={true}
            size={layout.cardSize}
            theme={theme}
          />
        ))}
        
        {/* Player Total Display */}
        <div
          className="absolute"
          style={{
            left: 'calc(50%)',
            top: 'calc(50% + 320px)',
            transform: 'translate(-50%, -50%) translateZ(120px)',
          }}
        >
          <motion.div
            animate={{ 
              borderColor: isBust ? '#DC2626' : isBlackjack ? '#22C55E' : '#D4AF37',
              scale: isBust || isBlackjack ? [1, 1.1, 1] : 1,
            }}
            transition={{ duration: 0.5, repeat: (isBust || isBlackjack) ? Infinity : 0 }}
            className="bg-black/80 backdrop-blur-xl px-6 py-3 rounded-full border-2"
          >
            <p className="text-cyan-400 text-xs font-bold text-center mb-1">🎴 YOU</p>
            <p className={`text-3xl font-black text-center ${
              isBust ? 'text-red-500' : isBlackjack ? 'text-green-400' : 'text-white'
            }`}>
              {playerTotal}
            </p>
            {isBlackjack && <p className="text-green-400 text-xs text-center font-bold mt-1">BLACKJACK!</p>}
            {isBust && <p className="text-red-500 text-xs text-center font-bold mt-1">BUST!</p>}
          </motion.div>
        </div>
        
        {/* AAA ENHANCEMENT: Animated Chip Stacks */}
        <AnimatedChipStacks 
          betAmount={currentBet} 
          position={{ x: 'calc(50%)', y: 'calc(50% + 80px)' }}
        />
        
        {/* Bet Display - Center */}
        <div
          className="absolute"
          style={{
            left: 'calc(50%)',
            top: 'calc(50%)',
            transform: 'translate(-50%, -50%) translateZ(80px)',
          }}
        >
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="bg-black/85 px-8 py-4 rounded-full border-3 border-yellow-400 shadow-2xl"
          >
            <p className="text-yellow-400 text-xs font-bold text-center mb-1">💰 BET</p>
            <p className="text-white text-3xl font-black text-center">₵{currentBet}</p>
          </motion.div>
          <ChipSplash trigger={currentBet} position={{ x: '50%', y: '50%' }} amount={currentBet} />
        </div>
      </PremiumGameTable>
      
      {/* Header */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-black/70 backdrop-blur-xl px-8 py-3 rounded-2xl border-2 border-[#D4AF37]/30"
        >
          <h2 className="text-3xl font-black text-transparent bg-gradient-to-r from-rose-400 via-pink-500 to-rose-400 bg-clip-text text-center">
            🎰 Premium Blackjack 🃏
          </h2>
          <div className="flex items-center justify-center gap-4 mt-2">
            <p className="text-white/60 text-xs">Premium Tables</p>
            <p className="text-yellow-400 text-sm font-bold">💰 ${playerChips}</p>
          </div>
        </motion.div>
      </div>
      
      {/* Action Buttons - Bottom */}
      {!gameOver && currentTurn === 'player' && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex gap-3"
          >
            <ActionButton
              label="HIT"
              icon="🎴"
              gradient="from-blue-600 to-blue-700"
              onClick={() => onMove({ action: 'hit' })}
              disabled={makingMove || aiThinking || isBust}
            />
            <ActionButton
              label="STAND"
              icon="🛑"
              gradient="from-red-600 to-red-700"
              onClick={() => onMove({ action: 'stand' })}
              disabled={makingMove || aiThinking || isBust}
            />
            <ActionButton
              label="DOUBLE"
              icon="💎"
              gradient="from-purple-600 to-purple-700"
              onClick={() => onMove({ action: 'double' })}
              disabled={makingMove || aiThinking || playerHand.length > 2 || playerChips < currentBet}
            />
            {canSplit && (
              <ActionButton
                label="SPLIT"
                icon="✂️"
                gradient="from-green-600 to-green-700"
                onClick={() => onMove({ action: 'split' })}
                disabled={makingMove || aiThinking || playerChips < currentBet}
              />
            )}
          </motion.div>
        </div>
      )}
      
      {/* Betting UI - Before game starts */}
      {!game?.game_state && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-black/80 backdrop-blur-xl p-6 rounded-2xl border-2 border-yellow-400"
          >
            <p className="text-white text-lg font-bold text-center mb-4">Place Your Bet</p>
            <div className="flex gap-3 mb-4">
              {[10, 25, 50, 100, 250].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setBetAmount(amount)}
                  className={`px-6 py-3 rounded-xl font-bold ${
                    betAmount === amount
                      ? 'bg-yellow-500 text-black'
                      : 'bg-white/10 text-white hover:bg-white/20'
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
          </motion.div>
        </div>
      )}
      
      {/* Game Over Overlay */}
      <AnimatePresence>
        {gameOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="text-center"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-9xl mb-4"
              >
                {playerWon ? '🎰' : '😔'}
              </motion.div>
              <h3 className={`text-6xl font-black mb-4 ${
                playerWon
                  ? 'text-transparent bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400 bg-clip-text' 
                  : 'text-transparent bg-gradient-to-r from-red-400 to-rose-600 bg-clip-text'
              }`}>
                {playerWon ? 'YOU WIN!' : 'DEALER WINS!'}
              </h3>
              <p className="text-yellow-400 text-4xl font-black mb-2">
                {playerWon ? `+$${currentBet * (isBlackjack ? 1.5 : 1)}` : `-$₵{currentBet}`}
              </p>
              <button
                onClick={() => onMove({ action: 'new_game' })}
                className="mt-6 bg-gradient-to-r from-green-600 to-green-700 text-white font-black px-8 py-4 rounded-xl text-lg"
              >
                🎰 PLAY AGAIN
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ActionButton({ label, icon, gradient, onClick, disabled }: { label?: any, icon?: any, gradient?: any, onClick?: any, disabled?: any }) {
  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.05, y: disabled ? 0 : -5 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      onClick={onClick}
      disabled={disabled}
      className={`bg-gradient-to-r ${gradient} disabled:opacity-50 disabled:cursor-not-allowed text-white font-black px-8 py-5 rounded-xl text-base shadow-2xl border-2 border-white/30 relative overflow-hidden min-w-[120px]`}
    >
      <span className="relative z-10">
        <div className="text-2xl mb-1">{icon}</div>
        <div className="text-sm">{label}</div>
      </span>
      {!disabled && (
        <motion.div
          className="absolute inset-0 bg-white/20"
          initial={{ x: '-100%' }}
          whileHover={{ x: '100%' }}
          transition={{ duration: 0.5 }}
        />
      )}
    </motion.button>
  );
}

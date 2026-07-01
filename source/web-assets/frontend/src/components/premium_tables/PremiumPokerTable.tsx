
import React, { useState, useEffect } from 'react';
import { PremiumGameTable } from './PremiumGameTable';
import { TopDownGameTable } from './TopDownGameTable';
import { ViewToggle } from './ViewToggle';
import { useUserAvatar, UserAvatarManager } from './UserAvatarManager';
import { getRandomAvatar } from './avatarSystem';
import { EnhancedCard3D } from './EnhancedCard3D';
import { ChipSplash, SuitConfetti, PotPulse } from './ParticleSystem';
import { AllInOneHandView } from './AllInOneHandView';
import { 
  HandStrengthIndicator, 
  EquityCalculator, 
  DealerButton, 
  FeltTexture,
  PotGrowthAnimation,
  StatsOverlay 
} from './PokerEnhancements';
import { motion, AnimatePresence } from 'framer-motion';
import { useWindowSize } from 'react-use';
import { useResponsiveGameLayout, getPokerCardPositions, CARD_SIZES } from './responsiveLayout';

export function PremiumPokerTable({ game, 
  onMove, 
  makingMove, 
  aiThinking,
  theme = 'emerald', }: { game?: any, onMove?: any, makingMove?: any, aiThinking?: any, theme?: any }) {
  const [view, setView] = useState('2d');
  const userAvatar = useUserAvatar();
  const [opponentAvatars] = useState(() => [
    getRandomAvatar(),
    getRandomAvatar(),
    getRandomAvatar(),
  ]);
  
  const playerHand = game?.game_state?.player_hand || ['AH', 'KD'];
  const communityCards = game?.game_state?.community_cards || ['QS', '10H', '7C'];
  const pot = game?.game_state?.pot || 150;
  const playerChips = game?.game_state?.player_chips || 1000;
  const aiChips = game?.game_state?.ai_chips || 1000;
  const [hoveredCard, setHoveredCard] = useState(null);
  const [previousPot, setPreviousPot] = useState(pot);
  const [chipSplashTrigger, setChipSplashTrigger] = useState(0);
  const [showStats, setShowStats] = useState(false);
  const [showEquity, setShowEquity] = useState(false);
  const [potGrowthTrigger, setPotGrowthTrigger] = useState(0);
  const { width, height } = useWindowSize();
  
  // RESPONSIVE LAYOUT
  const layout = useResponsiveGameLayout();
  const positions = getPokerCardPositions(layout, playerHand.length);
  
  // AAA ENHANCEMENTS - Calculate hand strength
  const handStrength = calculateHandStrength(playerHand, communityCards);
  
  // Mock stats (in real app, fetch from backend)
  const playerStats = {
    gamesPlayed: 142,
    winRate: 58,
    totalWinnings: 12450,
    biggestPot: 2100,
  };
  
  const gameOver = game?.status === 'completed';
  const playerWon = gameOver && game?.winner === 'player';
  const currentTurn = game?.current_turn || 'player';

  // Active player position for spotlight
  const activePlayerPosition = currentTurn === 'player' 
    ? { x: 50, y: 80 } 
    : { x: 50, y: 20 };

  // Trigger chip splash and pot growth when pot increases
  useEffect(() => {
    if (pot > previousPot) {
      setChipSplashTrigger(prev => prev + 1);
      setPotGrowthTrigger(prev => prev + 1);
      setPreviousPot(pot);
      
      // Auto-hide after animation
      setTimeout(() => setPotGrowthTrigger(0), 1500);
    }
  }, [pot, previousPot]);

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
        opponentAvatar={{ emoji: opponentAvatars[0]?.emoji || '🤖', name: opponentAvatars[0]?.name || 'Opponent' }}
        onCardPlay={(card) => {
          const index = playerHand.findIndex((c, idx) => `${c}-${idx}` === card.id);
          if (index >= 0 && !makingMove && !aiThinking && currentTurn === 'player') {
            setHoveredCard(hoveredCard === index ? null : index);
          }
        }}
      >
        {/* Poker-specific overlays */}
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
                  {playerWon ? '💰' : '😔'}
                </motion.div>
                <h3 className={`text-6xl font-black mb-4 ${
                  playerWon
                    ? 'text-transparent bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400 bg-clip-text' 
                    : 'text-transparent bg-gradient-to-r from-red-400 to-rose-600 bg-clip-text'
                }`}>
                  {playerWon ? 'VICTORY!' : 'DEFEAT!'}
                </h3>
                <p className="text-yellow-400 text-4xl font-black mb-2">₵{pot}</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Action Buttons */}
        {!gameOver && (
          <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-30">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="flex gap-3"
            >
              <button
                onClick={() => onMove({ action: 'fold' })}
                disabled={makingMove || aiThinking || currentTurn !== 'player'}
                className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold rounded-xl disabled:opacity-50"
              >
                🚫 FOLD
              </button>
              <button
                onClick={() => onMove({ action: 'call' })}
                disabled={makingMove || aiThinking || currentTurn !== 'player'}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-xl disabled:opacity-50"
              >
                🤝 CALL
              </button>
              <button
                onClick={() => onMove({ action: 'raise' })}
                disabled={makingMove || aiThinking || currentTurn !== 'player'}
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold rounded-xl disabled:opacity-50"
              >
                📈 RAISE
              </button>
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
      {/* Suit Confetti on Win */}
      <SuitConfetti 
        active={playerWon} 
        colors={['#fbbf24', '#f59e0b', '#22c55e', '#dc2626']} 
      />

      {/* AAA ENHANCEMENT: Statistics Overlay */}
      <StatsOverlay stats={playerStats} visible={showStats} />
      
      {/* AAA ENHANCEMENT: Hand Strength Indicator */}
      <HandStrengthIndicator strength={handStrength} visible={!gameOver && currentTurn === 'player'} />
      
      {/* AAA ENHANCEMENT: Equity Calculator (shown on all-in) */}
      <EquityCalculator 
        playerEquity={65} 
        opponentEquity={35} 
        visible={showEquity} 
      />
      
      {/* AAA ENHANCEMENT: Pot Growth Animation */}
      <PotGrowthAnimation trigger={potGrowthTrigger} />

      <PremiumGameTable 
        theme={theme}
        activePlayerPosition={activePlayerPosition}
        potAmount={pot}
        layout={layout}
      >
        {/* AAA ENHANCEMENT: Felt Texture */}
        <FeltTexture />
        {/* Community Cards - Center of table - RESPONSIVE */}
        {communityCards.map((card, i) => (
          <EnhancedCard3D
            key={card.id || `communityCards-${i}`}
            card={card}
            position3D={{ 
              x: -positions.community.spread / 2 + i * (positions.community.spread / 5), 
              y: positions.community.baseY, 
              z: positions.community.z 
            }}
            rotation3D={{ x: 0, y: 0, z: 0 }}
            faceUp={true}
            size={layout.cardSize}
            theme={theme}
          />
        ))}
        
        {/* Empty card slots */}
        {[...Array(5 - communityCards.length)].map((_, i) => {
          const cardSize = CARD_SIZES[layout.cardSize];
          return (
            <motion.div
              key={`empty-${i}`}
              className="absolute border-2 border-dashed rounded-xl"
              animate={{
                borderColor: ['rgba(212, 175, 55, 0.3)', 'rgba(212, 175, 55, 0.6)', 'rgba(212, 175, 55, 0.3)'],
              }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{
                width: cardSize.width,
                height: cardSize.height,
                left: `calc(50% + ${-positions.community.spread / 2 + (communityCards.length + i) * (positions.community.spread / 5)}px)`,
                top: `calc(50% + ${positions.community.baseY}px)`,
                transform: 'translate(-50%, -50%) translateZ(10px)',
              }}
            />
          );
        })}
        
        {/* Player's Hand - Bottom - RESPONSIVE */}
        {playerHand.map((card, i) => {
          const angleRange = layout.isMobile ? 15 : 25;
          const angle = ((i - (playerHand.length - 1) / 2) / playerHand.length) * angleRange;
          
          return (
            <EnhancedCard3D
              key={card.id || `playerHand-${i}`}
              card={card}
              position3D={{ 
                x: -positions.player.spread / 2 + (i * positions.player.spread) / (playerHand.length - 1 || 1), 
                y: positions.player.baseY, 
                z: positions.player.z 
              }}
              rotation3D={{ ...positions.player.rotation, z: angle }}
              faceUp={true}
              onClick={() => !makingMove && !aiThinking && !gameOver && setHoveredCard(hoveredCard === i ? null : i)}
              disabled={makingMove || aiThinking || gameOver}
              size={layout.cardSize}
              theme={theme}
            />
          );
        })}
        
        {/* AI Opponent Cards with animation */}
        {[
          { key: 'top', count: 2, basePos: { x: 0, y: -350 }, rotation: { x: 20, y: 180, z: 0 } },
          { key: 'left', count: 2, basePos: { x: -400, y: -100 }, rotation: { x: 0, y: 150, z: -10 } },
          { key: 'right', count: 2, basePos: { x: 400, y: -100 }, rotation: { x: 0, y: -150, z: 10 } },
        ].map(({ key, count, basePos, rotation }) =>
          [...Array(count)].map((_, i) => (
            <EnhancedCard3D
              key={`${key}-${i}`}
              card="BACK"
              position3D={{ 
                x: basePos.x + (key === 'top' ? (i - 0.5) * 60 : 0), 
                y: basePos.y + (key !== 'top' ? i * 60 : 0), 
                z: 20 
              }}
              rotation3D={rotation}
              faceUp={false}
              disabled
              theme={theme}
            />
          ))
        )}
        
        {/* Pot Display with Pulse and Chip Splash */}
        <motion.div
          initial={{ scale: 0, y: -50 }}
          animate={{ scale: 1, y: 0 }}
          className="absolute"
          style={{
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%) translateZ(80px)',
          }}
        >
          <div className="relative">
            <motion.div
              animate={{ scale: [1, 1.03, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="px-8 py-4 rounded-full relative"
              style={{
                background: 'rgba(0, 0, 0, 0.85)',
                backdropFilter: 'blur(20px)',
                border: '3px solid #D4AF37',
                boxShadow: '0 0 30px rgba(212, 175, 55, 0.6), inset 0 2px 10px rgba(212, 175, 55, 0.2)',
              }}
            >
              <PotPulse amount={pot} previousAmount={previousPot} />
              
              <p className="text-[#D4AF37] text-xs font-bold mb-1 text-center tracking-wider">💰 POT</p>
              <motion.p 
                key={pot}
                initial={{ scale: 1.2, color: '#FCD34D' }}
                animate={{ scale: 1, color: '#FFFFFF' }}
                transition={{ duration: 0.3 }}
                className="text-white text-4xl font-black text-center"
              >
                ₵{pot}
              </motion.p>
            </motion.div>
            
            {/* Chip Splash Effect */}
            <ChipSplash 
              trigger={chipSplashTrigger} 
              position={{ x: '50%', y: '50%' }}
              amount={pot}
            />
          </div>
        </motion.div>
        
        {/* Player Avatars with Turn Glow */}
        <PlayerAvatar3D 
          name="AI Player 1" 
          chips={aiChips} 
          position={{ x: 0, y: -420, z: 50 }} 
          isActive={currentTurn === 'ai'}
          theme={theme}
        />
        <PlayerAvatar3D 
          name="AI Player 2" 
          chips={aiChips} 
          position={{ x: -480, y: -150, z: 50 }}
          theme={theme}
        />
        <PlayerAvatar3D 
          name="AI Player 3" 
          chips={aiChips} 
          position={{ x: 480, y: -150, z: 50 }}
          theme={theme}
        />
        <PlayerAvatar3D 
          name="You" 
          chips={playerChips} 
          position={{ x: 0, y: 380, z: 120 }} 
          isPlayer={true}
          isActive={currentTurn === 'player'}
          theme={theme}
        />
      </PremiumGameTable>
      
      {/* 2D Overlay UI */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-black/70 backdrop-blur-xl px-8 py-3 rounded-2xl border-2 border-[#D4AF37]/30"
          style={{
            boxShadow: '0 0 30px rgba(212, 175, 55, 0.3)',
          }}
        >
          <h2 className="text-3xl font-black text-transparent bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400 bg-clip-text text-center animate-gradient">
            ♠️ Premium Texas Hold'em ♥️
          </h2>
          <p className="text-white/50 text-xs text-center mt-1">Global Vibez DSG™ | Premium Tables</p>
        </motion.div>
      </div>
      
      {/* Action Buttons with Enhanced Feedback */}
      {!gameOver && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex gap-4"
          >
            <ActionButton
              label="FOLD"
              icon="🚫"
              gradient="from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
              onClick={() => onMove({ action: 'fold' })}
              disabled={makingMove || aiThinking || currentTurn !== 'player'}
            />
            <ActionButton
              label="CALL"
              icon="🤝"
              gradient="from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
              onClick={() => onMove({ action: 'call' })}
              disabled={makingMove || aiThinking || currentTurn !== 'player'}
            />
            <ActionButton
              label="RAISE"
              icon="📈"
              gradient="from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
              onClick={() => onMove({ action: 'raise' })}
              disabled={makingMove || aiThinking || currentTurn !== 'player'}
            />
          </motion.div>
        </div>
      )}
      
      {/* Theme Selector - Top Right */}
      <ThemeSelector currentTheme={theme} onThemeChange={() => {}} />
      
      {/* Game Over Overlay */}
      <AnimatePresence>
        {gameOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
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
                {playerWon ? '💰' : '😔'}
              </motion.div>
              <h3 className={`text-6xl font-black mb-4 ${
                playerWon
                  ? 'text-transparent bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400 bg-clip-text' 
                  : 'text-transparent bg-gradient-to-r from-red-400 to-rose-600 bg-clip-text'
              }`}>
                {playerWon ? 'VICTORY!' : 'DEFEAT!'}
              </h3>
              <p className="text-yellow-400 text-4xl font-black mb-2">₵{pot}</p>
              <p className="text-white/60 text-sm">Premium Tables</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Player Avatar Component
function PlayerAvatar3D({ name, chips, position, isActive, isPlayer, theme }: { name?: any; chips?: any; position?: any; isActive?: any; isPlayer?: any; theme?: any }) {
  return (
    <div 
      className="absolute"
      style={{
        left: `calc(50% + ${position.x}px)`,
        top: `calc(50% + ${position.y}px)`,
        transform: `translate(-50%, -50%) translateZ(${position.z}px)`,
      }}
    >
      <motion.div 
        className={`px-6 py-3 rounded-xl backdrop-blur-xl`}
        animate={isActive ? {
          borderColor: ['#F472B6', '#EC4899', '#F472B6'],
          boxShadow: [
            '0 0 20px rgba(244, 114, 182, 0.6)',
            '0 0 30px rgba(244, 114, 182, 0.8)',
            '0 0 20px rgba(244, 114, 182, 0.6)',
          ],
        } : {}}
        transition={{ duration: 1.5, repeat: isActive ? Infinity : 0 }}
        style={{
          minWidth: '160px',
          background: isActive 
            ? 'linear-gradient(135deg, rgba(244, 114, 182, 0.2), rgba(236, 72, 153, 0.2))' 
            : 'rgba(0, 0, 0, 0.7)',
          border: isActive ? '2px solid #F472B6' : '2px solid rgba(255,255,255,0.2)',
        }}
      >
        <p className={`text-center font-bold mb-1 ${isPlayer ? 'text-cyan-400' : 'text-white'}`}>
          {name} {isPlayer && '(You)'}
        </p>
        <p className="text-yellow-400 text-lg font-black text-center">💰 ${chips}</p>
        {isActive && (
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="text-center text-xs text-pink-400 mt-1 font-bold"
          >
            ● YOUR TURN
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

// Action Button Component
function ActionButton({ label, icon, gradient, onClick, disabled }: { label?: any, icon?: any, gradient?: any, onClick?: any, disabled?: any }) {
  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.05, y: disabled ? 0 : -5 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      onClick={onClick}
      disabled={disabled}
      className={`bg-gradient-to-r ${gradient} disabled:opacity-50 disabled:cursor-not-allowed text-white font-black px-10 py-5 rounded-xl text-lg shadow-2xl border-2 border-white/30 relative overflow-hidden`}
    >
      <span className="relative z-10">{icon} {label}</span>
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

// Theme Selector Component
function ThemeSelector({ currentTheme, onThemeChange }: { currentTheme?: any, onThemeChange?: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const themes = ['emerald', 'midnight', 'royal', 'rose'];
  const themeIcons = { emerald: '🌿', midnight: '🌙', royal: '👑', rose: '🌹' };
  
  return (
    <div className="absolute top-4 right-4 z-20">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="bg-black/70 backdrop-blur-xl border-2 border-white/20 text-white font-bold px-6 py-3 rounded-xl shadow-lg"
      >
        {themeIcons[currentTheme]} Premium Tables
      </motion.button>
      
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute right-0 mt-2 bg-black/90 backdrop-blur-xl border-2 border-white/20 rounded-xl p-3 min-w-[200px]"
        >
          <p className="text-white/60 text-xs mb-2 px-2">Choose Theme:</p>
          {themes.map((theme) => (
            <button
              key={theme}
              onClick={() => {
                onThemeChange(theme);
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-2 rounded-lg mb-1 font-bold ${
                theme === currentTheme 
                  ? 'bg-white/20 text-white' 
                  : 'text-white/70 hover:bg-white/10'
              }`}
            >
              {themeIcons[theme]} {theme.charAt(0).toUpperCase() + theme.slice(1)}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  );
}

// AAA ENHANCEMENT: Hand Strength Calculator
function calculateHandStrength(playerHand, communityCards) {
  // Simplified calculation (in real app, use poker evaluation library)
  const allCards = [...playerHand, ...communityCards];
  
  // Check for pairs, flush, straight, etc.
  const ranks = allCards.map(c => c[0]);
  const suits = allCards.map(c => c.slice(-1));
  
  const hasPair = new Set(ranks).size < ranks.length;
  const hasFlush = suits.some(s => suits.filter(suit => suit === s).length >= 5);
  
  if (hasFlush) return 85;
  if (hasPair) return 60;
  
  // High card
  const highCards = ranks.filter(r => ['A', 'K', 'Q', 'J'].includes(r));
  return highCards.length * 15 + 20;
}


import React, { useState, useEffect } from 'react';
import { PremiumGameTable } from './PremiumGameTable';
import { AllInOneHandView } from './AllInOneHandView';
import { ViewToggle } from './ViewToggle';
import { useUserAvatar, UserAvatarManager } from './UserAvatarManager';
import { getRandomAvatar } from './avatarSystem';
import { EnhancedCard3D } from './EnhancedCard3D';
import { SuitConfetti } from './ParticleSystem';
import { motion, AnimatePresence } from 'framer-motion';
import { useWindowSize } from 'react-use';
import {
  Wild8GlowEffect,
  SuitChangeEffect,
  DrawPenaltyAnimation,
  CrazyEightsMultiplier,
  LastCardWarning,
  CrazyEightsVictory,
  CrazyEightsStatsOverlay,
} from './CrazyEightsEnhancements';

export function PremiumCrazyEightsTable({ game, 
  onMove, 
  makingMove, 
  aiThinking,
  theme = 'midnight', }: { game?: any, onMove?: any, makingMove?: any, aiThinking?: any, theme?: any }) {
  const [view, setView] = useState('2d');
  const userAvatar = useUserAvatar();
  const [opponentAvatars] = useState(() => [
    getRandomAvatar(),
    getRandomAvatar(),
    getRandomAvatar(),
  ]);
  const playerHand = game?.game_state?.player_hand || ['8H', '5D', '10S', 'KC', '3H', '7C'];
  const topCard = game?.game_state?.top_card || 'QH';
  const deckSize = game?.game_state?.deck_size || 24;
  const aiCardCounts = game?.game_state?.ai_card_counts || [5, 4, 6];
  const [selectedCard, setSelectedCard] = useState(null);
  const [showSuitPicker, setShowSuitPicker] = useState(false);
  const { width, height } = useWindowSize();
  
  // AAA Enhancement States
  const [wild8Glow, setWild8Glow] = useState(false);
  const [suitChangeTrigger, setSuitChangeTrigger] = useState(null);
  const [drawPenaltyTrigger, setDrawPenaltyTrigger] = useState(null);
  const [multiplier, setMultiplier] = useState(1);
  const [showMultiplier, setShowMultiplier] = useState(false);
  const [lastCardWarning, setLastCardWarning] = useState(false);
  const [showStats, setShowStats] = useState(false);
  
  const gameOver = game?.status === 'completed';
  const playerWon = gameOver && game?.winner === 'player';
  const currentTurn = game?.current_turn || 'player';

  // Mock stats
  const stats = {
    gamesPlayed: 38,
    winRate: 71,
    eightsPlayed: 15,
    perfectWins: 6,
    fastestWin: 38,
    bestStreak: 7,
  };

  // Last card warning
  useEffect(() => {
    if (playerHand.length === 1 && !gameOver) {
      setLastCardWarning(true);
      setTimeout(() => setLastCardWarning(false), 2500);
    }
  }, [playerHand.length, gameOver]);

  // Active player position for spotlight
  const activePlayerPosition = currentTurn === 'player' 
    ? { x: 50, y: 80 } 
    : currentTurn === 'ai_1' ? { x: 50, y: 20 }
    : currentTurn === 'ai_2' ? { x: 20, y: 50 }
    : { x: 80, y: 50 };

  const handleCardClick = (card, index) => {
    if (makingMove || aiThinking || gameOver || currentTurn !== 'player') return;
    
    setSelectedCard(index);
    
    // If it's an 8 (wild), show glow + suit picker
    if (card[0] === '8') {
      setWild8Glow(true);
      setShowSuitPicker(true);
      setTimeout(() => setWild8Glow(false), 3000);
    } else {
      onMove({ card, index });
      
      // Simulate multiplier for consecutive plays
      const newMultiplier = Math.min(multiplier + 1, 10);
      setMultiplier(newMultiplier);
      if (newMultiplier > 1) {
        setShowMultiplier(true);
        setTimeout(() => setShowMultiplier(false), 2000);
      }
    }
  };

  const handleSuitChoice = (suit) => {
    onMove({ card: playerHand[selectedCard], index: selectedCard, chosenSuit: suit });
    setShowSuitPicker(false);
    setWild8Glow(false);
    setSelectedCard(null);
    
    // Trigger suit change effect
    setSuitChangeTrigger({ suit, key: Date.now() });
    setTimeout(() => setSuitChangeTrigger(null), 1500);
  };

  // Check if card is an 8 (wild)
  const isWildCard = (card) => card[0] === '8';

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
        opponentAvatar={{ emoji: opponentAvatars[0]?.emoji || '🤖', name: opponentAvatars[0]?.name || 'AI Player' }}
        onCardPlay={(card) => {
          const index = playerHand.findIndex((c, idx) => `${c}-${idx}` === card.id);
          if (index >= 0) handleCardClick(playerHand[index], index);
        }}
      >
        {/* Crazy Eights effects */}
        <AnimatePresence>
          {wild8Glow && <Wild8GlowEffect active={wild8Glow} />}
        </AnimatePresence>
        <AnimatePresence>
          {suitChangeTrigger && (
            <SuitChangeEffect
              key={suitChangeTrigger.key}
              suit={suitChangeTrigger.suit}
              trigger={true}
              onComplete={() => setSuitChangeTrigger(null)}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {playerWon && <CrazyEightsVictory winner="You" trigger={true} />}
        </AnimatePresence>
        
        {/* Suit Picker Modal */}
        <AnimatePresence>
          {showSuitPicker && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 rounded-3xl border-4 border-yellow-400 shadow-2xl"
              >
                <h3 className="text-4xl font-black text-yellow-400 mb-2 text-center">✨ Magic 8 ✨</h3>
                <p className="text-white/60 text-sm mb-6 text-center">Choose a suit</p>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { suit: 'H', name: 'Hearts', color: '#DC2626', symbol: '♥️' },
                    { suit: 'D', name: 'Diamonds', color: '#DC2626', symbol: '♦️' },
                    { suit: 'C', name: 'Clubs', color: '#1F2937', symbol: '♣️' },
                    { suit: 'S', name: 'Spades', color: '#1F2937', symbol: '♠️' },
                  ].map(({ suit, name, color, symbol }) => (
                    <motion.button
                      key={suit}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleSuitChoice(suit)}
                      className="w-32 h-32 rounded-2xl font-black text-white shadow-2xl flex flex-col items-center justify-center"
                      style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}CC 100%)`, border: '4px solid white' }}
                    >
                      <div className="text-5xl mb-2">{symbol}</div>
                      <div className="text-sm">{name}</div>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </AllInOneHandView>
    );
  }

  // 3D View
  return (
    <div className="relative w-full h-screen bg-[#080C16]">
      <ViewToggle view={view} onToggle={setView} />
      <UserAvatarManager />
      {/* AAA ENHANCEMENTS */}
      
      {/* Wild 8 Glow Effect */}
      <AnimatePresence>
        {wild8Glow && <Wild8GlowEffect active={wild8Glow} />}
      </AnimatePresence>
      
      {/* Suit Change Effect */}
      <AnimatePresence>
        {suitChangeTrigger && (
          <SuitChangeEffect
            key={suitChangeTrigger.key}
            suit={suitChangeTrigger.suit}
            trigger={true}
            onComplete={() => setSuitChangeTrigger(null)}
          />
        )}
      </AnimatePresence>
      
      {/* Draw Penalty Animation */}
      <AnimatePresence>
        {drawPenaltyTrigger && (
          <DrawPenaltyAnimation
            key={drawPenaltyTrigger.key}
            count={drawPenaltyTrigger.count}
            trigger={true}
            onComplete={() => setDrawPenaltyTrigger(null)}
          />
        )}
      </AnimatePresence>
      
      {/* Multiplier Display */}
      <AnimatePresence>
        <CrazyEightsMultiplier multiplier={multiplier} active={showMultiplier} />
      </AnimatePresence>
      
      {/* Last Card Warning */}
      <AnimatePresence>
        {lastCardWarning && <LastCardWarning trigger={true} playerName="You" />}
      </AnimatePresence>
      
      {/* Victory Celebration */}
      <AnimatePresence>
        {playerWon && <CrazyEightsVictory winner="You" trigger={true} />}
      </AnimatePresence>
      
      {/* Stats Overlay */}
      <CrazyEightsStatsOverlay stats={stats} visible={showStats} />

      <PremiumGameTable 
        theme={theme}
        activePlayerPosition={activePlayerPosition}
        potAmount={0}
      >
        {/* Center Discard Pile - Top Card */}
        <EnhancedCard3D
          card={topCard}
          position3D={{ x: -80, y: 0, z: 30 }}
          rotation3D={{ x: 0, y: 0, z: Math.random() * 30 - 15 }}
          faceUp={true}
          size="lg"
          theme={theme}
        />
        
        {/* Discard Pile Stack Effect (3 cards beneath) */}
        {[0, 1, 2].map((i) => (
          <motion.div
            key={`item-${i}`}
            className="absolute rounded-xl"
            style={{
              width: 120,
              height: 180,
              left: `calc(50% - 80px)`,
              top: `calc(50% + ${i * 2}px)`,
              transform: `translate(-50%, -50%) translateZ(${25 - i * 5}px) rotate(${i * 5}deg)`,
              background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
              border: '3px solid #E2E8F0',
              boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            }}
          />
        ))}
        
        {/* Draw Pile Stack */}
        {[0, 1, 2].map((i) => (
          <motion.div
            key={`item-${i}`}
            className="absolute rounded-xl"
            style={{
              width: 120,
              height: 180,
              left: `calc(50% + 80px)`,
              top: `calc(50% + ${i * 3}px)`,
              transform: `translate(-50%, -50%) translateZ(${20 + i * 2}px) rotate(${i * 2}deg)`,
              background: 'linear-gradient(135deg, #1F2937 0%, #111827 100%)',
              border: '3px solid #F472B6',
              boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-pink-400 text-sm font-bold">GLOBAL</div>
                <div className="text-pink-400 text-sm font-bold">VIBEZ</div>
              </div>
            </div>
          </motion.div>
        ))}
        
        {/* Draw Pile Button */}
        <motion.button
          whileHover={{ scale: 1.05, translateZ: 40 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => !makingMove && !aiThinking && currentTurn === 'player' && onMove({ action: 'draw' })}
          disabled={makingMove || aiThinking || currentTurn !== 'player'}
          className="absolute"
          style={{
            left: `calc(50% + 80px)`,
            top: `calc(50% - 130px)`,
            transform: 'translate(-50%, -50%) translateZ(50px)',
          }}
        >
          <div className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 disabled:opacity-50 text-white font-black px-6 py-3 rounded-xl border-2 border-white/30 shadow-2xl">
            🎴 DRAW CARD
          </div>
        </motion.button>
        
        {/* Deck Size Indicator */}
        <div
          className="absolute"
          style={{
            left: `calc(50% + 80px)`,
            top: `calc(50% + 120px)`,
            transform: 'translate(-50%, -50%) translateZ(50px)',
          }}
        >
          <div className="bg-black/70 backdrop-blur-xl px-4 py-2 rounded-lg border border-white/20">
            <p className="text-white text-xs font-bold text-center">{deckSize} cards left</p>
          </div>
        </div>
        
        {/* Player's Hand - Bottom (spread in arc) */}
        {playerHand.map((card, i) => {
          const totalCards = playerHand.length;
          const spread = Math.min(totalCards * 50, 700);
          const angle = ((i - (totalCards - 1) / 2) / totalCards) * 25;
          const is8 = isWildCard(card);
          
          return (
            <div key={card.id || `playerHand-${i}`} className="relative">
              <EnhancedCard3D
                card={card}
                position3D={{ 
                  x: -spread / 2 + (i * spread) / (totalCards - 1 || 1), 
                  y: 300, 
                  z: 100 
                }}
                rotation3D={{ x: -20, y: 0, z: angle }}
                faceUp={true}
                onClick={() => handleCardClick(card, i)}
                disabled={makingMove || aiThinking || gameOver || currentTurn !== 'player'}
                size="lg"
                theme={theme}
              />
              
              {/* Golden glow for 8s */}
              {is8 && (
                <motion.div
                  className="absolute"
                  animate={{
                    boxShadow: [
                      '0 0 20px rgba(234, 179, 8, 0.6)',
                      '0 0 40px rgba(234, 179, 8, 0.9)',
                      '0 0 20px rgba(234, 179, 8, 0.6)',
                    ],
                  }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  style={{
                    left: `calc(50% + ${-spread / 2 + (i * spread) / (totalCards - 1 || 1)}px)`,
                    top: `calc(50% + 300px)`,
                    transform: `translate(-50%, -50%) translateZ(95px) rotateX(-20deg) rotateZ(${angle}deg)`,
                    width: 130,
                    height: 190,
                    border: '3px solid #EAB308',
                    borderRadius: '12px',
                    pointerEvents: 'none',
                  }}
                />
              )}
            </div>
          );
        })}
        
        {/* AI Hands */}
        {/* AI Opponent 1 - Top */}
        <AIHandDisplay 
          cardCount={aiCardCounts[0]}
          position={{ x: 0, y: -350, z: 30 }}
          rotation={{ x: 20, y: 180, z: 0 }}
          theme={theme}
        />
        
        {/* AI Opponent 2 - Left */}
        <AIHandDisplay 
          cardCount={aiCardCounts[1]}
          position={{ x: -400, y: 0, z: 30 }}
          rotation={{ x: 0, y: 120, z: -15 }}
          theme={theme}
        />
        
        {/* AI Opponent 3 - Right */}
        <AIHandDisplay 
          cardCount={aiCardCounts[2]}
          position={{ x: 400, y: 0, z: 30 }}
          rotation={{ x: 0, y: -120, z: 15 }}
          theme={theme}
        />
        
        {/* Player Avatars */}
        <PlayerAvatar3D 
          name="AI Player 1" 
          cardCount={aiCardCounts[0]}
          position={{ x: 0, y: -420, z: 50 }} 
          isActive={currentTurn === 'ai_1'}
          theme={theme}
        />
        <PlayerAvatar3D 
          name="AI Player 2" 
          cardCount={aiCardCounts[1]}
          position={{ x: -480, y: 0, z: 50 }}
          isActive={currentTurn === 'ai_2'}
          theme={theme}
        />
        <PlayerAvatar3D 
          name="AI Player 3" 
          cardCount={aiCardCounts[2]}
          position={{ x: 480, y: 0, z: 50 }}
          isActive={currentTurn === 'ai_3'}
          theme={theme}
        />
        <PlayerAvatar3D 
          name="You" 
          cardCount={playerHand.length}
          position={{ x: 0, y: 380, z: 120 }} 
          isPlayer={true}
          isActive={currentTurn === 'player'}
          theme={theme}
        />
      </PremiumGameTable>
      
      {/* Header */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-black/70 backdrop-blur-xl px-8 py-3 rounded-2xl border-2 border-[#D4AF37]/30"
        >
          <h2 className="text-3xl font-black text-transparent bg-gradient-to-r from-red-500 via-purple-500 to-blue-500 bg-clip-text text-center">
            ♠️ Premium Crazy Eights ♥️
          </h2>
          <p className="text-white/50 text-xs text-center mt-1">Global Vibez DSG™ | Premium Tables</p>
        </motion.div>
      </div>
      
      {/* Stats Toggle Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowStats(!showStats)}
        className="absolute top-4 right-4 z-20 bg-black/70 backdrop-blur-xl px-4 py-2 rounded-xl border border-white/20 hover:border-red-500/50 transition-colors"
      >
        <span className="text-white text-sm font-bold">📊 {showStats ? 'Hide' : 'Show'} Stats</span>
      </motion.button>
      
      {/* Suit Picker Modal (for 8s) */}
      <AnimatePresence>
        {showSuitPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 rounded-3xl border-4 border-yellow-400 shadow-2xl"
            >
              <h3 className="text-4xl font-black text-yellow-400 mb-2 text-center">✨ Magic 8 ✨</h3>
              <p className="text-white/60 text-sm mb-6 text-center">Choose a suit</p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { suit: 'H', name: 'Hearts', color: '#DC2626', symbol: '♥️' },
                  { suit: 'D', name: 'Diamonds', color: '#DC2626', symbol: '♦️' },
                  { suit: 'C', name: 'Clubs', color: '#1F2937', symbol: '♣️' },
                  { suit: 'S', name: 'Spades', color: '#1F2937', symbol: '♠️' },
                ].map(({ suit, name, color, symbol }) => (
                  <motion.button
                    key={suit}
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleSuitChoice(suit)}
                    className="w-32 h-32 rounded-2xl font-black text-white shadow-2xl flex flex-col items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, ${color} 0%, ${color}CC 100%)`,
                      border: '4px solid white',
                    }}
                  >
                    <div className="text-5xl mb-2">{symbol}</div>
                    <div className="text-sm">{name}</div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// AI Hand Display
function AIHandDisplay({ cardCount, position, rotation, theme }: { cardCount?: any, position?: any, rotation?: any, theme?: any }) {
  return (
    <>
      {[...Array(Math.min(cardCount, 7))].map((_, i) => (
        <motion.div
          key={_.id || _.name || `item-${i}`}
          className="absolute rounded-xl overflow-hidden"
          style={{
            width: 100,
            height: 150,
            left: `calc(50% + ${position.x + i * 15}px)`,
            top: `calc(50% + ${position.y + i * 5}px)`,
            transform: `translate(-50%, -50%) translateZ(${position.z + i * 2}px) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) rotateZ(${rotation.z + i * 3}deg)`,
            background: 'linear-gradient(135deg, #1F2937 0%, #111827 100%)',
            border: '3px solid #F472B6',
            boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-pink-400 text-xs font-bold">GLOBAL</div>
              <div className="text-pink-400 text-xs font-bold">VIBEZ</div>
            </div>
          </div>
        </motion.div>
      ))}
    </>
  );
}

// Player Avatar
function PlayerAvatar3D({ name, cardCount, position, isActive, isPlayer, theme }: { name?: any; cardCount?: any; position?: any; isActive?: any; isPlayer?: any; theme?: any }) {
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
        className="px-6 py-3 rounded-xl backdrop-blur-xl"
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
        <p className="text-yellow-400 text-lg font-black text-center">
          🎴 {cardCount} {cardCount === 1 ? 'Card' : 'Cards'}
        </p>
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

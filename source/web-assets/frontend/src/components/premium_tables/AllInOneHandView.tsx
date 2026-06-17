import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * ALL-IN-ONE Hand View - Combines all 4 features:
 * 1. Immersive swipe-to-throw
 * 2. Voice AI control  
 * 3. Compact arc mode
 * 4. Card selection/preview
 */
export function AllInOneHandView({ 
  playerHand = [],
  opponentAvatar = { emoji: '🤖', name: 'AI Vibez' },
  onCardPlay,
  children,
}: {
  playerHand?: any[];
  opponentAvatar?: { emoji: string; name: string };
  onCardPlay?: any;
  children?: any;
}) {
  const [viewMode, setViewMode] = useState('immersive'); // 'immersive' or 'compact'
  const [selectedCard, setSelectedCard] = useState(null);
  const [thrownCards, setThrownCards] = useState([]);
  const [voiceActive, setVoiceActive] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);

  const handleCardDragEnd = (card, info) => {
    if (info.offset.y < -100) {
      playCard(card);
    }
  };

  const handleCardClick = (card) => {
    if (viewMode === 'compact') {
      setSelectedCard(card);
    }
  };

  const playCard = (card) => {
    setThrownCards([...thrownCards, card]);
    setSelectedCard(null);
    simulateAIResponse(card);
    if (onCardPlay) onCardPlay(card);
  };

  const simulateAIResponse = (card) => {
    setAiSpeaking(true);
    setTimeout(() => setAiSpeaking(false), 2000);
  };

  const toggleVoice = () => {
    setVoiceActive(!voiceActive);
    if (!voiceActive) {
      // Simulate voice recognition
      setTimeout(() => {
        setVoiceActive(false);
      }, 5000);
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gradient-to-b from-gray-900 via-purple-950 to-black">
      
      {/* Ambient Background Effects */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.3) 0%, transparent 50%)',
        }} />
      </div>

      {/* Global Vibez Logo Header */}
      <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-40 text-center">
        <div className="text-3xl md:text-4xl font-black text-transparent bg-gradient-to-r from-cyan-400 via-purple-500 to-fuchsia-500 bg-clip-text">
          GLOBAL VIBEZ DSG
        </div>
        <div className="text-xs text-cyan-400/70 tracking-widest mt-1">━━━ PREMIUM CARD GAMES ━━━</div>
      </div>

      {/* AI Opponent Avatar */}
      <div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-30">
        <motion.div
          animate={{
            scale: aiSpeaking ? [1, 1.1, 1] : 1,
          }}
          transition={{ duration: 0.5, repeat: aiSpeaking ? Infinity : 0 }}
        >
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-2xl border-4 border-white/30">
            <div className="text-5xl">{opponentAvatar.emoji}</div>
          </div>
          {aiSpeaking && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1.2, opacity: 1 }}
              className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 bg-cyan-500 text-white px-3 py-1 rounded-full text-xs font-bold"
            >
              🎤 Speaking...
            </motion.div>
          )}
          <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-white font-bold text-sm whitespace-nowrap">
            {opponentAvatar.name}
          </div>
        </motion.div>
      </div>

      {/* View Mode Toggle */}
      <div className="absolute top-6 left-6 z-40 flex gap-2">
        <button
          onClick={() => setViewMode('immersive')}
          className={`px-3 py-2 rounded-lg font-bold text-xs ${
            viewMode === 'immersive'
              ? 'bg-purple-600 text-white'
              : 'bg-white/20 text-white hover:bg-white/30'
          }`}
        >
          🎮 Swipe
        </button>
        <button
          onClick={() => setViewMode('compact')}
          className={`px-3 py-2 rounded-lg font-bold text-xs ${
            viewMode === 'compact'
              ? 'bg-cyan-600 text-white'
              : 'bg-white/20 text-white hover:bg-white/30'
          }`}
        >
          🎴 Arc
        </button>
      </div>

      {/* Voice Control */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={toggleVoice}
        className={`absolute top-6 right-6 z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl ${
          voiceActive 
            ? 'bg-gradient-to-br from-red-500 to-pink-600 animate-pulse' 
            : 'bg-gradient-to-br from-blue-500 to-cyan-600'
        }`}
      >
        <span className="text-2xl">{voiceActive ? '🎙️' : '🔇'}</span>
      </motion.button>

      {voiceActive && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-24 right-6 bg-red-500/90 text-white px-4 py-2 rounded-lg font-bold text-xs"
        >
          🎤 Say card name!
        </motion.div>
      )}

      {/* Controls Instructions */}
      {viewMode === 'immersive' && (
        <div className="absolute top-24 left-6 z-30 bg-black/60 backdrop-blur-xl px-4 py-3 rounded-xl border-2 border-cyan-500/50">
          <p className="text-white font-bold text-xs mb-1">🎮 CONTROLS:</p>
          <p className="text-cyan-400 text-[10px]">• Swipe card UP</p>
          <p className="text-cyan-400 text-[10px]">• Voice: Say card</p>
        </div>
      )}

      {/* Thrown Cards Area */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[500px] h-[250px] flex items-center justify-center z-20">
        <AnimatePresence>
          {thrownCards.slice(-3).map((card, i) => (
            <motion.div
              key={`thrown-${thrownCards.length - i}`}
              initial={{ y: 200, opacity: 0, rotateX: -90 }}
              animate={{ 
                y: 0, 
                opacity: 1, 
                rotateX: 0,
                rotate: Math.random() * 20 - 10,
                x: (i - 1) * 50,
                zIndex: i,
              }}
              exit={{ y: -200, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="absolute w-20 h-28 bg-white rounded-xl shadow-2xl flex flex-col items-center justify-center border-4 border-purple-500"
            >
              <p className="text-4xl mb-1">{card.suit}</p>
              <p className="text-2xl font-black">{card.rank}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Player Hand - Immersive Mode */}
      {viewMode === 'immersive' && (
        <div className="absolute bottom-0 left-0 right-0 h-64 flex items-end justify-center">
          <div className="relative w-full max-w-6xl h-full flex items-end justify-center">
            {playerHand.map((card, i) => {
              const totalCards = playerHand.length;
              const centerIndex = (totalCards - 1) / 2;
              const offset = i - centerIndex;
              const rotation = offset * 8;
              const xSpread = offset * 70;
              const yLift = Math.abs(offset) * 12;
              const scale = 1 - Math.abs(offset) * 0.03;

              return (
                <motion.div
                  key={card.id || i}
                  drag="y"
                  dragConstraints={{ top: -400, bottom: 0 }}
                  dragElastic={0.2}
                  onDragEnd={(e, info) => handleCardDragEnd(card, info)}
                  initial={{ y: 100, opacity: 0 }}
                  animate={{ y: 0, opacity: 1, scale }}
                  whileHover={{ y: -50, scale: 1.15, rotate: 0, zIndex: 100 }}
                  whileTap={{ scale: 1.05, cursor: 'grabbing' }}
                  transition={{ delay: i * 0.04, type: 'spring', stiffness: 200 }}
                  className="absolute cursor-grab active:cursor-grabbing"
                  style={{
                    left: '50%',
                    bottom: '20px',
                    transform: `translateX(${xSpread}px) translateY(${yLift}px) rotate(${rotation}deg)`,
                    transformOrigin: 'bottom center',
                    zIndex: 10 + i,
                  }}
                >
                  <div className="relative">
                    <motion.div 
                      className="absolute inset-0 bg-gradient-to-br from-purple-500 to-cyan-500 rounded-xl blur-lg opacity-0 group-hover:opacity-50"
                      animate={{ opacity: [0, 0.3, 0] }}
                      transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
                    />
                    <div className="relative w-24 h-36 bg-white rounded-xl shadow-2xl flex flex-col items-center justify-center border-4 border-purple-500 hover:border-cyan-400 transition-colors">
                      <p className="text-5xl mb-1">{card.suit}</p>
                      <p className="text-3xl font-black text-gray-800">{card.rank}</p>
                      <div className="absolute bottom-1 text-[8px] text-gray-400 flex items-center gap-1">
                        <span>⬆️</span><span className="font-bold">SWIPE</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Player Hand - Compact Arc Mode */}
      {viewMode === 'compact' && (
        <div className="absolute bottom-0 left-0 right-0 h-80 flex items-end justify-center pb-6">
          <div className="relative w-full max-w-7xl">
            {playerHand.map((card, i) => {
              const totalCards = playerHand.length;
              const angleStep = 100 / totalCards;
              const startAngle = -50;
              const angle = startAngle + (i * angleStep);
              const radius = 380;
              const x = Math.sin((angle * Math.PI) / 180) * radius;
              const y = Math.cos((angle * Math.PI) / 180) * radius - radius + 180;

              return (
                <motion.div
                  key={card.id || i}
                  initial={{ y: 200, opacity: 0, rotate: angle }}
                  animate={{ y: 0, opacity: 1 }}
                  whileHover={{ y: -60, scale: 1.2, rotate: 0, zIndex: 100 }}
                  transition={{ delay: i * 0.06, type: 'spring', stiffness: 200 }}
                  onClick={() => handleCardClick(card)}
                  className="absolute cursor-pointer"
                  style={{
                    left: `calc(50% + ${x}px)`,
                    bottom: `${y}px`,
                    transform: `translateX(-50%) rotate(${angle}deg)`,
                    transformOrigin: 'bottom center',
                    zIndex: 5 + i,
                  }}
                >
                  <div className="w-28 h-40 bg-white rounded-2xl shadow-2xl flex flex-col items-center justify-center border-4 border-purple-500 hover:border-cyan-400 transition-all">
                    <p className="text-6xl mb-2">{card.suit}</p>
                    <p className="text-4xl font-black text-gray-800">{card.rank}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Card Preview (Compact Mode) */}
      <AnimatePresence>
        {selectedCard && viewMode === 'compact' && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50"
          >
            <div className="w-44 h-64 bg-white rounded-3xl shadow-2xl flex flex-col items-center justify-center border-8 border-cyan-500">
              <p className="text-8xl mb-3">{selectedCard.suit}</p>
              <p className="text-6xl font-black text-gray-800">{selectedCard.rank}</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => playCard(selectedCard)}
              className="absolute -bottom-14 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-black px-6 py-3 rounded-2xl text-lg shadow-2xl flex items-center gap-2"
            >
              <span>✓</span>
              <span>PLAY CARD</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logo Watermark */}
      <div className="absolute bottom-28 left-1/2 transform -translate-x-1/2 opacity-5 pointer-events-none">
        <div className="text-7xl font-black text-white text-center">
          GLOBAL<br/>VIBEZ
        </div>
      </div>

      {/* Children (custom overlays) */}
      {children}

      {/* Bottom Info Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-black/60 backdrop-blur-xl border-t-2 border-purple-500/30 flex items-center justify-center z-10">
        <div className="text-center">
          <p className="text-white font-black text-xl">
            🎴 YOUR TURN
          </p>
          <p className="text-cyan-400 text-xs">
            {viewMode === 'immersive' ? 'Swipe card up to play' : 'Click card to select'} • Voice ready
          </p>
        </div>
      </div>
    </div>
  );
}

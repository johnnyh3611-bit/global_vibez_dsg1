import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Immersive First-Person Card Hand View with Voice AI
export function ImmersiveHandView({ playerHand, theme }: { playerHand?: any, theme?: any }) {
  const [draggedCard, setDraggedCard] = useState(null);
  const [thrownCards, setThrownCards] = useState([]);
  const [voiceActive, setVoiceActive] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);

  const handleCardDragEnd = (card, info) => {
    // If dragged up significantly, "throw" the card
    if (info.offset.y < -100) {
      setThrownCards([...thrownCards, card]);
      simulateAIResponse(card);
    }
  };

  const simulateAIResponse = (card) => {
    setAiSpeaking(true);
    setTimeout(() => {
      setAiSpeaking(false);
    }, 2000);
  };

  const handleVoiceCommand = () => {
    setVoiceActive(!voiceActive);
    // In real implementation, this would trigger speech recognition
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gradient-to-b from-gray-900 via-purple-950 to-black">
      
      {/* Ambient Background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.3) 0%, transparent 50%)',
        }} />
      </div>

      {/* AI Opponent Avatar - Top Center */}
      <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-30">
        <motion.div
          animate={{
            scale: aiSpeaking ? [1, 1.1, 1] : 1,
          }}
          transition={{ duration: 0.5, repeat: aiSpeaking ? Infinity : 0 }}
          className="relative"
        >
          {/* AI Avatar */}
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-2xl border-4 border-white/30">
            <div className="text-6xl">🤖</div>
          </div>
          
          {/* Speaking Indicator */}
          {aiSpeaking && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1.2, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 bg-cyan-500 text-white px-4 py-1 rounded-full text-sm font-bold"
            >
              🎤 AI Speaking...
            </motion.div>
          )}
          
          {/* AI Name */}
          <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 text-white font-bold text-lg whitespace-nowrap">
            AI Vibez
          </div>
        </motion.div>
      </div>

      {/* Thrown Cards Area (Center Table) */}
      <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 w-[600px] h-[300px] flex items-center justify-center">
        <AnimatePresence>
          {thrownCards.map((card, i) => (
            <motion.div
              key={`thrown-${i}`}
              initial={{ y: 200, opacity: 0, rotateX: -90 }}
              animate={{ 
                y: 0, 
                opacity: 1, 
                rotateX: 0,
                rotate: Math.random() * 20 - 10,
                x: (i - thrownCards.length / 2) * 80
              }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="absolute w-24 h-36 bg-white rounded-xl shadow-2xl flex flex-col items-center justify-center border-4 border-purple-500"
            >
              <p className="text-5xl mb-2">{card.suit}</p>
              <p className="text-3xl font-black">{card.rank}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Voice Control Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={handleVoiceCommand}
        className={`absolute top-8 right-8 z-40 w-16 h-16 rounded-full flex items-center justify-center shadow-2xl ${
          voiceActive 
            ? 'bg-gradient-to-br from-red-500 to-pink-600 animate-pulse' 
            : 'bg-gradient-to-br from-blue-500 to-cyan-600'
        }`}
      >
        <span className="text-3xl">{voiceActive ? '🎙️' : '🔇'}</span>
      </motion.button>

      {/* Voice Status */}
      {voiceActive && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-28 right-8 bg-red-500/90 text-white px-4 py-2 rounded-lg font-bold text-sm"
        >
          🎤 Listening... Say card name!
        </motion.div>
      )}

      {/* Instructions */}
      <div className="absolute top-8 left-8 z-30 bg-black/60 backdrop-blur-xl px-6 py-4 rounded-xl border-2 border-cyan-500/50">
        <p className="text-white font-bold text-sm mb-2">🎮 CONTROLS:</p>
        <p className="text-cyan-400 text-xs">• Swipe card UP to throw</p>
        <p className="text-cyan-400 text-xs">• Click 🎙️ for voice control</p>
        <p className="text-cyan-400 text-xs">• Say card to play it</p>
      </div>

      {/* Player's Hand - Bottom (Natural Spread) */}
      <div className="absolute bottom-0 left-0 right-0 h-64 flex items-end justify-center">
        <div className="relative w-full max-w-6xl h-full flex items-end justify-center">
          {playerHand.map((card, i) => {
            const totalCards = playerHand.length;
            const centerIndex = (totalCards - 1) / 2;
            const offset = i - centerIndex;
            
            // Natural hand fan calculations
            const rotation = offset * 8; // More pronounced rotation
            const xSpread = offset * 80; // Wider spread
            const yLift = Math.abs(offset) * 15; // Cards at edges lift slightly
            const scale = 1 - Math.abs(offset) * 0.05; // Center cards slightly larger

            return (
              <motion.div
                key={card.id || i}
                drag="y"
                dragConstraints={{ top: -400, bottom: 0 }}
                dragElastic={0.2}
                onDragEnd={(e, info) => handleCardDragEnd(card, info)}
                initial={{ y: 100, opacity: 0 }}
                animate={{ 
                  y: 0, 
                  opacity: 1,
                  scale,
                }}
                whileHover={{ 
                  y: -60,
                  scale: 1.2,
                  rotate: 0,
                  zIndex: 100,
                  transition: { type: 'spring', stiffness: 300 }
                }}
                whileTap={{
                  scale: 1.1,
                  cursor: 'grabbing'
                }}
                transition={{ 
                  delay: i * 0.05,
                  type: 'spring',
                  stiffness: 200,
                }}
                className="absolute cursor-grab active:cursor-grabbing"
                style={{
                  left: '50%',
                  bottom: '30px',
                  transform: `translateX(${xSpread}px) translateY(${yLift}px) rotate(${rotation}deg)`,
                  transformOrigin: 'bottom center',
                  zIndex: 10 + i,
                }}
              >
                {/* Card */}
                <div className="relative">
                  {/* Glow effect */}
                  <motion.div 
                    className="absolute inset-0 bg-gradient-to-br from-purple-500 to-cyan-500 rounded-2xl blur-xl opacity-0 group-hover:opacity-60"
                    animate={{
                      opacity: [0, 0.4, 0],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: i * 0.2,
                    }}
                  />
                  
                  {/* Card Body */}
                  <div className="relative w-28 h-40 bg-white rounded-2xl shadow-2xl flex flex-col items-center justify-center border-4 border-purple-500 hover:border-cyan-400 transition-colors">
                    <p className="text-6xl mb-2">{card.suit}</p>
                    <p className="text-4xl font-black text-gray-800">{card.rank}</p>
                    
                    {/* Drag indicator */}
                    <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-xs text-gray-400 flex items-center gap-1">
                      <span>⬆️</span>
                      <span className="font-bold">SWIPE</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Logo Watermark */}
      <div className="absolute bottom-32 left-1/2 transform -translate-x-1/2 opacity-5 pointer-events-none">
        <div className="text-9xl font-black text-white">
          GLOBAL<br/>VIBEZ
        </div>
      </div>

      {/* Bottom Info Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-black/60 backdrop-blur-xl border-t-2 border-purple-500/30 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white font-black text-2xl mb-1">
            🎴 YOUR TURN
          </p>
          <p className="text-cyan-400 text-sm">
            Swipe a card up to play • Voice command ready
          </p>
        </div>
      </div>
    </div>
  );
}

// Alternative: More compact hand view with side avatar
export function CompactHandView({ playerHand, theme }: { playerHand?: any, theme?: any }) {
  const [selectedCard, setSelectedCard] = useState(null);
  
  return (
    <div className="relative w-full h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-black overflow-hidden">
      
      {/* AI Avatar - Right Side */}
      <div className="absolute right-8 top-1/2 transform -translate-y-1/2 z-30">
        <motion.div
          animate={{
            y: [0, -10, 0],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="relative"
        >
          <div className="w-40 h-40 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-2xl border-4 border-white/30">
            <div className="text-7xl">🤖</div>
          </div>
          <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-cyan-500 text-white px-6 py-2 rounded-full font-bold whitespace-nowrap">
            AI Vibez
          </div>
        </motion.div>
      </div>

      {/* Large Logo */}
      <div className="absolute top-8 left-1/2 transform -translate-x-1/2 text-center z-20">
        <div className="text-5xl font-black text-transparent bg-gradient-to-r from-cyan-400 via-purple-500 to-fuchsia-500 bg-clip-text mb-2">
          GLOBAL VIBEZ DSG
        </div>
        <div className="text-sm text-cyan-400/70 tracking-widest">━━━ PREMIUM CARD GAMES ━━━</div>
      </div>

      {/* Player Hand - Full Bottom Spread */}
      <div className="absolute bottom-0 left-0 right-0 h-80 flex items-end justify-center pb-8">
        <div className="relative w-full max-w-7xl">
          {playerHand.map((card, i) => {
            const totalCards = playerHand.length;
            const angleStep = 120 / totalCards; // Spread across 120 degrees
            const startAngle = -60; // Start from left
            const angle = startAngle + (i * angleStep);
            const radius = 400; // Distance from pivot point
            
            // Calculate position on arc
            const x = Math.sin((angle * Math.PI) / 180) * radius;
            const y = Math.cos((angle * Math.PI) / 180) * radius - radius + 200;

            return (
              <motion.div
                key={card.id || i}
                initial={{ y: 200, opacity: 0, rotate: angle }}
                animate={{ 
                  y: 0,
                  opacity: 1,
                }}
                whileHover={{
                  y: -80,
                  scale: 1.3,
                  rotate: 0,
                  zIndex: 100,
                }}
                transition={{
                  delay: i * 0.08,
                  type: 'spring',
                  stiffness: 200,
                }}
                onClick={() => setSelectedCard(card)}
                className="absolute cursor-pointer"
                style={{
                  left: `calc(50% + ${x}px)`,
                  bottom: `${y}px`,
                  transform: `translateX(-50%) rotate(${angle}deg)`,
                  transformOrigin: 'bottom center',
                  zIndex: 5 + i,
                }}
              >
                <div className="w-32 h-48 bg-white rounded-2xl shadow-2xl flex flex-col items-center justify-center border-4 border-purple-500 hover:border-cyan-400 transition-all">
                  <p className="text-7xl mb-2">{card.suit}</p>
                  <p className="text-5xl font-black text-gray-800">{card.rank}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Selected Card Preview */}
      <AnimatePresence>
        {selectedCard && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50"
          >
            <div className="w-48 h-72 bg-white rounded-3xl shadow-2xl flex flex-col items-center justify-center border-8 border-cyan-500">
              <p className="text-9xl mb-4">{selectedCard.suit}</p>
              <p className="text-7xl font-black text-gray-800">{selectedCard.rank}</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setSelectedCard(null)}
              className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-black px-8 py-4 rounded-2xl text-xl shadow-2xl"
            >
              ✓ PLAY CARD
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

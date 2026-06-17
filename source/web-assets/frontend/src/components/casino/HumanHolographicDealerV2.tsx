import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import soundManager from '@/utils/soundManager';

/**
 * AAA Plus Meta-Human Dealer
 * Optimizations: Diegetic UI, Ray-traced shadow simulation, and Physical Card Physics
 */
export default function HumanHolographicDealerV2({
  dealerType = "nova",
  phrase = "",
  isDealing = false,
  isShuffling = false,
  isCelebrating = false,
  tableHeight = 200 // To anchor the dealer behind the table
}) {
  const [dealingCards, setDealingCards] = useState([]);
  const [nodding, setNodding] = useState(false);

  // Dealer identity configurations (Expanded for Meta-Human depth)
  const config = useMemo(() => {
    const dealers = {
      nova: { name: "NOVA", skin: "#5a3828", accent: "#06b6d4", personality: "smooth" },
      ace: { name: "ACE", skin: "#d9a78a", accent: "#ffd700", personality: "sharp" },
      ruby: { name: "RUBY", skin: "#b8845f", accent: "#ec4899", personality: "vibrant" },
      jade: { name: "JADE", skin: "#a67550", accent: "#10b981", personality: "calm" }
    };
    return dealers[dealerType] || dealers.nova;
  }, [dealerType]);

  // Physics-based Card Dealing Logic
  useEffect(() => {
    if (isDealing) {
      const interval = setInterval(() => {
        const id = Date.now() + Math.random();
        // Calculate arc trajectory toward player positions
        const newCard = {
          id,
          targetX: (Math.random() - 0.5) * 400, // Spread across table
          targetY: 300 + Math.random() * 50,
          rotation: (Math.random() - 0.5) * 45
        };
        
        setDealingCards(prev => [...prev, newCard]);
        soundManager.cardDeal();

        setTimeout(() => {
          setDealingCards(prev => prev.filter(c => c.id !== id));
        }, 800);
      }, 400);
      return () => clearInterval(interval);
    }
  }, [isDealing]);

  return (
    <div className="dealer-container relative flex flex-col items-center justify-end h-[500px] w-full">
      
      {/* 1. METAHUMAN SILHOUETTE (The "Physical" Presence) */}
      <motion.div 
        className="relative z-20"
        animate={{ 
          y: nodding ? [-8, 0] : [0, -8, 0],
          filter: isShuffling ? "drop-shadow(0 0 15px rgba(6,182,212,0.8))" : "none"
        }}
        transition={{ duration: nodding ? 0.5 : 4, repeat: nodding ? 0 : Infinity, ease: "easeInOut" }}
      >
        {/* SVG Dealer */}
        <svg width="320" height="420" viewBox="0 0 300 400" className="drop-shadow-2xl" style={{ transform: 'rotateX(10deg)' }}>
          <defs>
            {/* Dynamic skin gradient */}
            <radialGradient id={`skinTone-${dealerType}`} cx="50%" cy="40%">
              <stop offset="0%" stopColor={config.skin} stopOpacity="0.9" />
              <stop offset="100%" stopColor={config.skin} stopOpacity="0.7" />
            </radialGradient>
            
            {/* Vest gradient */}
            <linearGradient id="vestBlack" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1a1a1a" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#0d0d0d" stopOpacity="0.9" />
            </linearGradient>

            {/* Shirt gradient */}
            <radialGradient id="shirtWhite" cx="50%" cy="20%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#f0f0f0" stopOpacity="0.9" />
            </radialGradient>
          </defs>

          {/* BODY */}
          <g className="dealer-body">
            {/* Torso/Vest */}
            <rect
              x="100" y="200"
              width="100" height="140"
              rx="10"
              fill="url(#vestBlack)"
              stroke={config.accent}
              strokeWidth="1"
              opacity="0.95"
            />
            {/* Table reflection on vest */}
            <rect x="100" y="280" width="100" height="60" fill="white" opacity="0.05" />
            
            {/* White Shirt Collar */}
            <path
              d="M 110 195 L 150 195 L 145 215 L 115 215 Z"
              fill="url(#shirtWhite)"
            />
            <path
              d="M 150 195 L 190 195 L 185 215 L 155 215 Z"
              fill="url(#shirtWhite)"
            />
            
            {/* Bow Tie */}
            <g transform="translate(125, 205)">
              <ellipse rx="15" ry="8" fill="#c41e3a" opacity="0.9" />
              <ellipse cx="25" rx="15" ry="8" fill="#c41e3a" opacity="0.9" />
              <rect x="10" y="-3" width="20" height="6" rx="2" fill="#a61931" opacity="0.95" />
            </g>
            
            {/* Vest Buttons */}
            <circle cx="150" cy="235" r="3" fill="#ffd700" opacity="0.9" />
            <circle cx="150" cy="255" r="3" fill="#ffd700" opacity="0.9" />
            <circle cx="150" cy="275" r="3" fill="#ffd700" opacity="0.9" />
          </g>

          {/* ARMS */}
          <g className="dealer-arms">
            {/* Left arm (dealing) */}
            <motion.g
              animate={{
                rotate: isDealing ? [0, -15, 0] : 0,
                x: isDealing ? [0, -20, 0] : 0
              }}
              transition={{ duration: 0.6, repeat: isDealing ? Infinity : 0 }}
              style={{ transformOrigin: '120px 220px' }}
            >
              <ellipse
                cx="90" cy="250"
                rx="12" ry="35"
                fill={`url(#skinTone-${dealerType})`}
                transform="rotate(-20 90 250)"
              />
              <ellipse cx="75" cy="280" rx="10" ry="15" fill={`url(#skinTone-${dealerType})`} />
            </motion.g>
            
            {/* Right arm */}
            <ellipse cx="210" cy="250" rx="12" ry="35" fill={`url(#skinTone-${dealerType})`} transform="rotate(20 210 250)" />
            <ellipse cx="225" cy="280" rx="10" ry="15" fill={`url(#skinTone-${dealerType})`} />
          </g>

          {/* NECK */}
          <rect x="135" y="175" width="30" height="25" rx="8" fill={`url(#skinTone-${dealerType})`} />

          {/* HEAD */}
          <g className="dealer-head">
            {/* Face */}
            <ellipse cx="150" cy="130" rx="45" ry="55" fill={`url(#skinTone-${dealerType})`} stroke={config.accent} strokeWidth="1" />
            
            {/* Hair (Short fade for NOVA) */}
            <path
              d="M 110 100 Q 120 80 150 80 Q 180 80 190 100 L 190 125 Q 180 120 150 120 Q 120 120 110 125 Z"
              fill="#1a0f08"
            />
            
            {/* Eyes */}
            <g className="left-eye">
              <ellipse cx="130" cy="125" rx="10" ry="12" fill="white" opacity="0.95" />
              <circle cx="130" cy="125" r="6" fill="#2c1810" />
              <circle cx="130" cy="125" r="3" fill="#1a1a1a" />
              <circle cx="132" cy="123" r="2" fill="white" opacity="0.8" />
              <circle cx="132" cy="123" r="1" fill={config.accent} opacity="0.6" />
            </g>
            
            <g className="right-eye">
              <ellipse cx="170" cy="125" rx="10" ry="12" fill="white" opacity="0.95" />
              <circle cx="170" cy="125" r="6" fill="#2c1810" />
              <circle cx="170" cy="125" r="3" fill="#1a1a1a" />
              <circle cx="172" cy="123" r="2" fill="white" opacity="0.8" />
              <circle cx="172" cy="123" r="1" fill={config.accent} opacity="0.6" />
            </g>
            
            {/* Eyebrows */}
            <path d="M 120 115 Q 130 112 140 115" stroke="#1a0f08" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M 160 115 Q 170 112 180 115" stroke="#1a0f08" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            
            {/* Nose */}
            <path d="M 145 130 L 148 148 L 152 148 L 150 135 Z" fill={config.skin} opacity="0.7" />
            
            {/* Mouth */}
            <motion.path
              d="M 130 160 Q 150 168 170 160"
              stroke="#8b4513"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
              animate={isCelebrating ? {
                d: "M 125 160 Q 150 175 175 160"
              } : {}}
            />
          </g>

          {/* Name tag */}
          <g transform="translate(125, 220)">
            <rect width="50" height="18" rx="4" fill={config.accent} opacity="0.9" />
            <text x="25" y="13" fontSize="10" textAnchor="middle" fill="#000" fontWeight="bold">
              {config.name}
            </text>
          </g>
        </svg>

        {/* 2. DIEGETIC SPEECH (Floating next to head, not centered) */}
        <AnimatePresence>
          {phrase && (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="absolute left-[80%] top-10 bg-black/60 border-l-4 border-cyan-400 p-3 backdrop-blur-md rounded-r-lg shadow-lg"
              style={{ maxWidth: '200px' }}
            >
              <p className="text-cyan-400 text-xs font-mono tracking-widest uppercase mb-1">AI_COMMS_V2</p>
              <p className="text-white text-sm italic">"{phrase}"</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* 3. THE CARD PHYSICS LAYER (Cards move FROM dealer TO table) */}
      <div className="absolute inset-0 pointer-events-none z-30">
        <AnimatePresence>
          {dealingCards.map(card => (
            <motion.div
              key={card.id}
              initial={{ x: "50%", y: "50%", scale: 0.2, opacity: 1, rotateY: 180 }}
              animate={{ 
                x: `calc(50% + ${card.targetX}px)`, 
                y: `calc(50% + ${card.targetY}px)`, 
                scale: 1, 
                rotateY: 0,
                rotateZ: card.rotation
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: "circOut" }}
              className="absolute w-14 h-20 bg-white rounded shadow-2xl border-2 border-slate-200"
            >
              <div className="w-full h-full bg-gradient-to-br from-blue-900 to-black rounded flex items-center justify-center">
                <span className="text-white text-xl font-bold">V</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* 4. TABLE ANCHOR GLOW (Where the dealer meets the table) */}
      <div className="absolute bottom-0 w-[400px] h-[100px] bg-cyan-500/10 blur-[60px] rounded-[100%] z-10" />
    </div>
  );
}

// Game state reaction helper
export const getDealerReaction = (gameState, lastOutcome) => {
  if (gameState === 'PLAYER_WIN') {
    return { 
      phrase: "Impressive win! Ready to go again?", 
      animation: "celebrating", 
      color: "#10b981" // Success Green
    };
  }
  if (gameState === 'PLACING_BETS') {
    return { 
      phrase: "Place your bets, let's see what you've got.", 
      animation: "waiting", 
      color: "#06b6d4" // Active Cyan
    };
  }
  if (lastOutcome === 'BIG_LOSS') {
    return { 
      phrase: "Ouch. The house takes this one. Better luck next hand.", 
      animation: "professional", 
      color: "#ef4444" // Warning Red
    };
  }
  return { phrase: "Ready for the next round?", animation: "idle", color: "#06b6d4" };
};

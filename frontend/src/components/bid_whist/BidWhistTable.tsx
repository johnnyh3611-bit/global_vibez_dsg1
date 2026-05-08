
import { motion, AnimatePresence } from 'framer-motion';
import { Crown } from 'lucide-react';
import PlayerPod from './PlayerPod';

// Layout constants for the "Celestial Glasshouse" 3D Table
const TABLE_LAYOUT = {
  container: "relative w-full aspect-video max-h-[80vh] flex items-center justify-center",
  
  // The "Dish" (The green felt area)
  felt: "absolute w-[70%] h-[60%] rounded-[150px] bg-emerald-900/40 border-[12px] border-slate-800 shadow-inner",

  // Positioning the 4 Player Pods (The Glassmorphism badges)
  playerPods: {
    north: "absolute top-[-10%] left-1/2 -translate-x-1/2",
    south: "absolute bottom-[-5%] left-1/2 -translate-x-1/2",
    east:  "absolute right-[-5%] top-1/2 -translate-y-1/2", 
    west:  "absolute left-[-5%] top-1/2 -translate-y-1/2",
  },

  // The "Trick Zone" (Where the 4 played cards sit)
  trickZone: "absolute w-[30%] h-[30%] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 grid grid-cols-2 gap-2"
};

// Helper to get suit symbol and color
const getSuitSymbol = (suit) => {
  const symbols = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣', joker: '🃏' };
  return symbols[suit] || suit;
};

const getSuitColor = (suit) => {
  if (['hearts', 'diamonds'].includes(suit)) return 'text-red-600';
  if (suit === 'joker') return 'text-purple-600';
  return 'text-black';
};

export default function BidWhistTable({ gameState, onPlayCard, dealerName = "Nova" }) {
  // Mapping positions to 3D space for the "Celestial Glasshouse" feel
  const tableSlots = {
    north: { top: '15%', left: '50%' },
    south: { bottom: '15%', left: '50%' },
    east: { right: '15%', top: '50%' },
    west: { left: '15%', top: '50%' }
  };

  // Get player tricks from game state
  const player_tricks = gameState?.player_tricks || { north: 0, south: 0, east: 0, west: 0 };
  const players_data = gameState?.players_data || {};
  const userPosition = gameState?.your_position || 'south';

  return (
    <div className={TABLE_LAYOUT.container}>
      {/* The 3D Table Surface */}
      <div className={TABLE_LAYOUT.felt}>
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-emerald-900/10 rounded-[150px] pointer-events-none" />
        
        {/* Animated Card Slots - Current Trick */}
        <div className="absolute inset-0">
          <AnimatePresence>
            {gameState?.current_trick?.map((play, index) => {
              const position = tableSlots[play.player] || tableSlots[play.position];
              
              return (
                <motion.div
                  key={`${play.player || play.position}-${index}`}
                  initial={{ opacity: 0, scale: 0.5, y: 100, rotateY: 180 }}
                  animate={{ 
                    opacity: 1, 
                    scale: 1,
                    y: 0,
                    rotateY: 0,
                    ...position,
                    x: '-50%',
                    translateY: '-50%'
                  }}
                  exit={{ opacity: 0, scale: 0.5, rotateY: 180 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  className="absolute w-24 h-36 bg-white rounded-lg shadow-2xl border-2 border-amber-400"
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  <div className={`p-2 text-center ${getSuitColor(play.card.suit)}`}>
                    <div className="text-4xl font-bold mb-1">{play.card.rank}</div>
                    <div className="text-5xl">{getSuitSymbol(play.card.suit)}</div>
                  </div>
                  {/* Player name badge */}
                  <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/80 px-2 py-1 rounded text-[10px] text-amber-300 whitespace-nowrap backdrop-blur-sm border border-amber-500/30">
                    {play.player || play.position}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* AI Dealer Badge (Floating Glassmorphism) */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-4 left-1/2 -translate-x-1/2 px-6 py-2 bg-white/5 backdrop-blur-md border border-white/20 rounded-full shadow-lg flex items-center gap-2"
        >
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-amber-400 font-['Cinzel'] text-sm flex items-center gap-2">
            <Crown className="w-4 h-4" />
            Dealer: {dealerName}
          </span>
        </motion.div>

        {/* Center Logo/Emblem - GLOBAL VIBEZ DSG BRANDING - RESPONSIVE - ENHANCED VISIBILITY */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30">
          {/* Semi-transparent background for better contrast */}
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm rounded-2xl -m-4"></div>
          
          <div className="relative flex flex-col items-center gap-1 sm:gap-2 px-4 py-3">
            {/* Main Logo Text - Smaller on mobile, ENHANCED VISIBILITY */}
            <div className="font-['Cinzel'] font-bold text-amber-400 text-center drop-shadow-[0_0_12px_rgba(251,191,36,0.8)] shadow-[0_0_20px_rgba(251,191,36,0.6)]">
              <div className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl tracking-wider drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">GLOBAL VIBEZ</div>
              <div className="text-xl sm:text-2xl md:text-2xl lg:text-3xl tracking-[0.3em] mt-1 sm:mt-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">DSG</div>
            </div>
            {/* Decorative Elements - Hidden on small mobile */}
            <div className="hidden sm:flex items-center gap-3">
              <div className="w-12 sm:w-16 h-px bg-gradient-to-r from-transparent via-amber-400 to-transparent"></div>
              <div className="text-2xl sm:text-3xl md:text-4xl">🎴</div>
              <div className="w-12 sm:w-16 h-px bg-gradient-to-r from-transparent via-amber-400 to-transparent"></div>
            </div>
          </div>
        </div>

        {/* Player Pods - Positioned around the table */}
        {['north', 'south', 'east', 'west'].map((position) => {
          const playerData = players_data[position];
          if (!playerData) return null;
          
          return (
            <PlayerPod
              key={position}
              position={position}
              name={playerData.name || position.toUpperCase()}
              team={playerData.team}
              booksWon={playerData.books_won || 0}
              isTurn={gameState?.whose_turn === position}
              isDealer={gameState?.dealer === position}
            />
          );
        })}
      </div>
    </div>
  );
}

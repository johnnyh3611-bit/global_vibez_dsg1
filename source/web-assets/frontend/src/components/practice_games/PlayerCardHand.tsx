import React, { useState } from 'react';
import { motion } from 'framer-motion';

// LARGE Playing Card for Easy Mobile Play
const LargePlayingCard = ({ card, onClick, disabled, index, totalCards }) => {
  if (!card) return null;
  
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  
  const suitSymbols = { H: '♥', D: '♦', C: '♣', S: '♠' };
  const suitColors = { H: '#dc2626', D: '#dc2626', C: '#1f2937', S: '#1f2937' };
  
  const displayRank = rank === '10' ? '10' : rank;
  const suitSymbol = suitSymbols[suit];
  const suitColor = suitColors[suit];
  
  // Calculate position in curved fan - OPTIMIZED for visibility & touch
  const maxSpread = Math.min(totalCards * 14, 200); // Wider spread for more cards
  const startAngle = -maxSpread / 2;
  const angleStep = totalCards > 1 ? maxSpread / (totalCards - 1) : 0;
  const angle = startAngle + (index * angleStep);
  
  // Better spacing - each card visible
  const baseSpacing = totalCards > 10 ? 28 : 32; // Tighter for many cards
  const offsetX = index * baseSpacing - ((totalCards - 1) * baseSpacing / 2);
  const offsetY = Math.pow(Math.abs(angle) / 90, 1.2) * 70; // Strong curve
  
  // 3D rotation for depth
  const rotateY = angle * 0.5;
  const rotateX = Math.abs(angle) * 0.25;
  
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={!disabled ? { 
        y: -35, 
        scale: 1.2,
        zIndex: 1000,
        transition: { duration: 0.15, ease: 'easeOut' }
      } : {}}
      whileTap={!disabled ? { 
        scale: 1.05,
        transition: { duration: 0.1 }
      } : {}}
      className="absolute cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed touch-manipulation"
      style={{
        width: '90px',
        height: '130px',
        left: '50%',
        bottom: '10px',
        marginLeft: '-45px',
        transform: `translateX(${offsetX}px) translateY(${offsetY}px) rotate(${angle}deg) rotateY(${rotateY}deg) rotateX(${rotateX}deg)`,
        transformStyle: 'preserve-3d',
        zIndex: index,
        // Ensure tappable even when overlapped
        pointerEvents: 'auto',
        WebkitTapHighlightColor: 'transparent'
      }}
    >
      <div 
        className="relative w-full h-full rounded-2xl shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, #fefce8 0%, #fef9e7 50%, #fefce8 100%)',
          border: '3px solid #d4d4d4',
          boxShadow: `
            0 25px 60px rgba(0,0,0,0.7),
            0 15px 35px rgba(0,0,0,0.5),
            inset 0 2px 0 rgba(255,255,255,0.9),
            inset 0 -1px 0 rgba(0,0,0,0.1)
          `
        }}
      >
        {/* Top left corner - LARGER for easy reading */}
        <div 
          className="absolute top-2 left-2 flex flex-col items-center leading-none"
          style={{ color: suitColor }}
        >
          <span className="text-3xl font-black" style={{ fontFamily: 'Arial Black, sans-serif' }}>
            {displayRank}
          </span>
          <span className="text-2xl">{suitSymbol}</span>
        </div>
        
        {/* Center suit - MASSIVE */}
        <div className="absolute inset-0 flex items-center justify-center opacity-12 pointer-events-none">
          <span className="text-9xl pointer-events-none" style={{ color: suitColor }}>{suitSymbol}</span>
        </div>
        
        {/* Bottom right corner (rotated) */}
        <div 
          className="absolute bottom-2 right-2 flex flex-col items-center leading-none rotate-180"
          style={{ color: suitColor }}
        >
          <span className="text-3xl font-black" style={{ fontFamily: 'Arial Black, sans-serif' }}>
            {displayRank}
          </span>
          <span className="text-2xl">{suitSymbol}</span>
        </div>
        
        {/* Card shine/gloss */}
        <div 
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, transparent 40%, rgba(0,0,0,0.05) 100%)'
          }}
        />
        
        {/* Active indicator when hovered */}
        <motion.div
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          className="absolute -inset-1 rounded-2xl border-4 border-green-400 pointer-events-none"
          style={{
            boxShadow: '0 0 20px rgba(74, 222, 128, 0.6)'
          }}
        />
      </div>
    </motion.button>
  );
};

// Main Card Hand Component
export function PlayerCardHand({ cards = [], onCardClick, disabled = false }: { cards?: any, onCardClick?: any, disabled?: any }) {
  return (
    <div 
      className="fixed bottom-0 left-0 right-0 h-64 z-50 flex items-end justify-center"
      style={{ 
        perspective: '2000px',
        perspectiveOrigin: '50% 100%'
      }}
    >
      <div className="relative w-full max-w-6xl h-full">
        {cards.map((card, index) => (
          <LargePlayingCard
            key={`${card}-${index}`}
            card={card}
            index={index}
            totalCards={cards.length}
            onClick={() => !disabled && onCardClick && onCardClick(card)}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}

// Demo component to test
export function CardHandDemo() {
  const [selectedCard, setSelectedCard] = useState(null);
  const [playedCards, setPlayedCards] = useState([]);
  
  // Full hand like in screenshot (15 cards)
  const [hand, setHand] = useState([
    'JD', 'KH', 'AD', '4S', '5S', '9S', '10C', 'QC', 'AC',
    '2H', '6H', '9H', '10H', 'QS', '3D'
  ]);
  
  const handleCardClick = (card) => {
    setSelectedCard(card);
    setPlayedCards([...playedCards, card]);
    setHand(hand.filter(c => c !== card));
    
    // Visual feedback
    setTimeout(() => setSelectedCard(null), 1000);
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 relative overflow-hidden">
      {/* Game Info */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 text-white text-center z-10 max-w-2xl px-4">
        <h1 className="text-3xl sm:text-4xl font-black mb-3">🎴 Spades Plus Style Cards</h1>
        <div className="bg-black/60 backdrop-blur-sm rounded-2xl p-4 border-2 border-white/20">
          {selectedCard ? (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-green-400 text-xl font-bold"
            >
              ✓ Played: {selectedCard}
            </motion.div>
          ) : (
            <p className="text-base text-gray-300">
              👆 <span className="font-bold">Tap any card to play</span> • {hand.length} cards remaining
            </p>
          )}
        </div>
        
        {playedCards.length > 0 && (
          <div className="mt-4 text-sm text-gray-400">
            Played: {playedCards.join(', ')}
          </div>
        )}
      </div>
      
      {/* Landscape orientation prompt for portrait mode */}
      <div className="md:hidden portrait:flex hidden absolute inset-0 items-center justify-center bg-black/90 z-40">
        <div className="text-center text-white p-8">
          <motion.div 
            animate={{ rotate: [0, 90, 90, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
            className="text-7xl mb-4"
          >
            📱
          </motion.div>
          <h2 className="text-3xl font-black mb-3">Rotate Your Phone</h2>
          <p className="text-gray-400 text-lg">Best played in landscape mode</p>
        </div>
      </div>
      
      {/* The Card Hand */}
      <PlayerCardHand 
        cards={hand}
        onCardClick={handleCardClick}
        disabled={false}
      />
      
      {/* Helper text */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-white/40 text-xs text-center hidden landscape:block">
        ✨ Hover/tap cards to see them lift up • All {hand.length} cards are touchable
      </div>
    </div>
  );
}

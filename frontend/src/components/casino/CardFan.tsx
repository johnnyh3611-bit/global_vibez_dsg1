import React, { useState } from 'react';
import { motion } from 'framer-motion';
import PlayingCard from './PlayingCard';

/**
 * CardFan Component
 * Displays cards in a realistic fan layout like holding cards in hand
 * Perfect for Spades, Hearts, Poker, and other hand-based card games
 */

export default function CardFan({ 
  cards = [], 
  onCardClick,
  selectedCards = [],
  cardStyle = 'realistic',
  maxSpread = 200, // Maximum horizontal spread in pixels
  arcHeight = 30, // Height of the arc
  disabled = false,
  showCardCount = true
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  
  const cardCount = cards.length;
  if (cardCount === 0) return null;

  // Calculate card positioning for realistic fan
  const getCardTransform = (index, isHovered) => {
    // Spread angle: cards closer together in center, more spread at ends
    const centerIndex = (cardCount - 1) / 2;
    const offsetFromCenter = index - centerIndex;
    
    // Rotation: cards angle outward from center
    const maxRotation = Math.min(20, cardCount * 2); // More cards = less individual rotation
    const rotation = (offsetFromCenter / centerIndex) * maxRotation;
    
    // Horizontal position: arc curve
    const spreadPerCard = Math.min(maxSpread / Math.max(cardCount - 1, 1), 60); // Max 60px between cards
    const x = offsetFromCenter * spreadPerCard;
    
    // Vertical position: create arc
    const arcFactor = Math.abs(offsetFromCenter / centerIndex);
    const y = -(arcFactor * arcFactor * arcHeight); // Parabolic arc
    
    // Lift hovered/selected cards
    const lift = isHovered ? -20 : (selectedCards.includes(cards[index]) ? -10 : 0);
    
    // Z-index: center cards on top
    const zIndex = cardCount - Math.abs(offsetFromCenter);
    
    return {
      rotation,
      x,
      y: y + lift,
      zIndex,
      scale: isHovered ? 1.1 : 1
    };
  };

  return (
    <div className="relative flex items-end justify-center h-48">
      {/* Card count badge */}
      {showCardCount && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-sm px-4 py-1.5 rounded-full border-2 border-purple-500">
          <p className="text-white font-bold text-sm">
            {cardCount} {cardCount === 1 ? 'Card' : 'Cards'}
          </p>
        </div>
      )}
      
      {/* Cards in fan layout */}
      <div className="relative" style={{ width: maxSpread + 100, height: 160 }}>
        {cards.map((card, index) => {
          const isHovered = hoveredIndex === index;
          const isSelected = selectedCards.includes(card);
          const transform = getCardTransform(index, isHovered);
          
          return (
            <motion.div
              key={`${card}-${index}`}
              className="absolute bottom-0 left-1/2"
              style={{
                zIndex: transform.zIndex + (isHovered ? 100 : 0) + (isSelected ? 50 : 0),
                originX: 0.5,
                originY: 1
              }}
              initial={{ 
                x: transform.x, 
                y: transform.y,
                rotate: transform.rotation
              }}
              animate={{ 
                x: transform.x, 
                y: transform.y,
                rotate: transform.rotation,
                scale: transform.scale
              }}
              transition={{ 
                type: 'spring', 
                stiffness: 300, 
                damping: 25 
              }}
              onHoverStart={() => !disabled && setHoveredIndex(index)}
              onHoverEnd={() => setHoveredIndex(null)}
            >
              <PlayingCard
                card={card}
                style={cardStyle}
                size="normal"
                isSelected={isSelected}
                onClick={() => !disabled && onCardClick && onCardClick(card, index)}
                className="transition-all duration-200"
              />
              
              {/* Selection indicator */}
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-2 left-1/2 -translate-x-1/2 bg-yellow-400 text-black text-xs font-bold px-2 py-0.5 rounded-full"
                >
                  SELECTED
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>
      
      {/* Instructional text */}
      {!disabled && cards.length > 0 && (
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-center">
          <p className="text-white/60 text-sm">
            {selectedCards.length > 0 
              ? `${selectedCards.length} card${selectedCards.length > 1 ? 's' : ''} selected`
              : 'Click cards to select'
            }
          </p>
        </div>
      )}
    </div>
  );
}

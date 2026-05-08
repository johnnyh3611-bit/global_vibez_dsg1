
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CASINO_THEME, getPlayerPosition } from '@/utils/casinoTheme';
import { dealCards } from '@/utils/shuffleAlgorithm';
import PlayingCard3D from './PlayingCard3D';
import cardSoundManager from '@/utils/cardSoundManager';

// Realistic card dealing system with clockwise distribution
// Parabolic trajectory from dealer to players
// Staggered timing for professional feel

export default function CardDealingSystem({
  deck = [],
  players = [], // [{ id, position, name }, ...]
  cardsPerPlayer = 2,
  onDealComplete,
  dealerPosition = { x: 960, y: 100 }, // Top center
  tableCenter = { x: 960, y: 400 },
  dealSpeed = 'normal', // 'slow', 'normal', 'fast'
  showDealerHand = true
}: {
  deck?: any[];
  players?: any[];
  cardsPerPlayer?: number;
  onDealComplete?: (hands?: any) => void;
  dealerPosition?: { x: number; y: number };
  tableCenter?: { x: number; y: number };
  dealSpeed?: 'slow' | 'normal' | 'fast';
  showDealerHand?: boolean;
  width?: number;
  height?: number;
  onCardLanded?: (card: any) => void;
  autoDemo?: boolean;
}) {
  const [dealingCards, setDealingCards] = useState([]);
  const [isDealing, setIsDealing] = useState(false);

  const speedMultiplier = dealSpeed === 'slow' ? 1.5 : dealSpeed === 'fast' ? 0.5 : 1;
  const staggerDelay = CASINO_THEME.timing.cardStagger * speedMultiplier;
  const flyDuration = parseFloat(CASINO_THEME.timing.cardDeal) * 2 * speedMultiplier;

  useEffect(() => {
    if (deck.length > 0 && players.length > 0 && !isDealing) {
      startDealing();
    }
  }, [deck, players]);

  const startDealing = () => {
    setIsDealing(true);
    const { hands } = dealCards(deck, players.length, cardsPerPlayer);
    const cardAnimations = [];

    // Create animation sequence: clockwise dealing, one card to each player per round
    for (let round = 0; round < cardsPerPlayer; round++) {
      players.forEach((player, playerIndex) => {
        const card = hands[playerIndex][round];
        if (!card) return;

        // Calculate player position (clockwise radial layout)
        const playerPos = getPlayerPosition(
          playerIndex,
          players.length,
          tableCenter.x,
          tableCenter.y,
          CASINO_THEME.playerZone.radius
        );

        cardAnimations.push({
          card,
          playerId: player.id,
          playerIndex,
          round,
          startPos: dealerPosition,
          endPos: playerPos,
          delay: (round * players.length + playerIndex) * staggerDelay,
          id: `${player.id}-${round}-${Date.now()}`
        });
      });
    }

    setDealingCards(cardAnimations);

    // Play card deal sounds
    cardAnimations.forEach((_, index) => {
      setTimeout(() => {
        cardSoundManager.playCardFlip();
      }, index * staggerDelay * 1000);
    });

    // Notify completion
    const totalTime = (cardAnimations.length * staggerDelay + flyDuration) * 1000;
    setTimeout(() => {
      setIsDealing(false);
      if (onDealComplete) {
        onDealComplete(hands);
      }
    }, totalTime);
  };

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: CASINO_THEME.zIndex.cards }}>
      {/* Dealer Hand (deck visualization) */}
      {showDealerHand && (
        <motion.div
          className="absolute"
          style={{
            left: dealerPosition.x,
            top: dealerPosition.y,
            transform: 'translate(-50%, -50%)'
          }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
        >
          {/* Deck stack */}
          {[...Array(Math.min(5, deck.length))].map((_, i) => (
            <div
              key={_.id || _.name || `item-${i}`}
              className="absolute"
              style={{
                transform: `translateY(-${i * 2}px) translateX(${i}px)`,
                zIndex: 5 - i
              }}
            >
              <PlayingCard3D
                value="BACK"
                suit="spades"
                faceUp={false}
                animate={false}
                size="normal"
              />
            </div>
          ))}
        </motion.div>
      )}

      {/* Flying Cards Animation */}
      <AnimatePresence>
        {dealingCards.map((cardAnim) => (
          <motion.div
            key={cardAnim.id}
            className="absolute"
            initial={{
              left: cardAnim.startPos.x,
              top: cardAnim.startPos.y,
              scale: 0.8,
              opacity: 0,
              rotateZ: 0
            }}
            animate={{
              left: cardAnim.endPos.x,
              top: cardAnim.endPos.y,
              scale: 1,
              opacity: 1,
              rotateZ: [0, 15, -5, 0] // Slight spin during flight
            }}
            exit={{
              opacity: 0,
              scale: 0.5
            }}
            transition={{
              delay: cardAnim.delay,
              duration: flyDuration,
              ease: CASINO_THEME.timing.easeOut as any,
              // Parabolic trajectory (arc effect)
              y: {
                duration: flyDuration,
                ease: [0.22, 0.61, 0.36, 1] as any // Bezier curve for arc
              }
            }}
            style={{
              transform: 'translate(-50%, -50%)',
              zIndex: 100 + cardAnim.playerIndex
            }}
          >
            <PlayingCard3D
              value={cardAnim.card.value}
              suit={cardAnim.card.suit}
              faceUp={cardAnim.round === cardsPerPlayer - 1} // Flip last card face-up
              animate={false}
              size="normal"
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

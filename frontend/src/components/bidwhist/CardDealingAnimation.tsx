import { motion, AnimatePresence } from 'framer-motion';
import ImperialCard from '@/components/bidwhist/ImperialCard';

/**
 * Card Dealing Animation
 * Shows cards being dealt one-by-one to each player (North, East, South, West)
 * 12 cards per player = 48 total animations
 * Then 6 cards to kitty
 */
export default function CardDealingAnimation({ isDealing, 
  currentDealIndex = 0,
  totalCards = 48,
  onComplete }: { isDealing?: any, currentDealIndex?: any, totalCards?: any, onComplete?: any }) {
  // Calculate which player is receiving the current card
  const playerOrder = ['north', 'east', 'south', 'west'];
  const currentPlayer = playerOrder[currentDealIndex % 4];
  
  // Position coordinates for each player
  const playerPositions = {
    north: { top: '10%', left: '50%' },
    east: { right: '10%', top: '50%' },
    south: { bottom: '20%', left: '50%' },
    west: { left: '10%', top: '50%' }
  };

  const targetPosition = playerPositions[currentPlayer] || { top: '50%', left: '50%' };

  return (
    <AnimatePresence>
      {isDealing && (
        <motion.div
          className="fixed inset-0 z-[150] pointer-events-none"
        >
          {/* Dealing Card Animation */}
          <motion.div
            initial={{ 
              top: '50%', 
              left: '50%',
              x: '-50%',
              y: '-50%',
              scale: 0.5,
              rotateY: 180
            }}
            animate={{ 
              top: targetPosition.top || 'auto',
              bottom: targetPosition.bottom || 'auto',
              left: targetPosition.left || 'auto',
              right: targetPosition.right || 'auto',
              x: '-50%',
              y: targetPosition.top || targetPosition.bottom ? '-50%' : '-50%',
              scale: 0.8,
              rotateY: 0
            }}
            transition={{
              duration: 0.6, // Slower animation
              ease: "easeInOut"
            }}
            className="absolute"
            onAnimationComplete={() => {
              // Move to next card after short delay
              setTimeout(() => {
                if (currentDealIndex < totalCards - 1) {
                  // Continue dealing
                } else {
                  // Dealing complete
                  if (onComplete) onComplete();
                }
              }, 100);
            }}
          >
            {/* Card back during dealing - WITH BRANDING */}
            <div className="w-24 h-36 bg-gradient-to-br from-red-800 to-red-950 rounded-lg border-2 border-amber-500 shadow-2xl flex items-center justify-center overflow-hidden relative">
              {/* Decorative Pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-2 border-2 border-amber-400 rounded-md"></div>
                <div className="absolute inset-4 border border-amber-400/50 rounded-sm"></div>
              </div>
              
              {/* Global Vibez DSG Logo */}
              <div className="relative z-10 text-center">
                <div className="font-['Cinzel'] font-bold text-amber-400">
                  <div className="text-lg tracking-wider drop-shadow-lg">GLOBAL</div>
                  <div className="text-lg tracking-wider drop-shadow-lg">VIBEZ</div>
                  <div className="text-sm tracking-[0.3em] mt-1">DSG</div>
                </div>
                <div className="text-4xl mt-2">🎴</div>
              </div>
            </div>
          </motion.div>

          {/* Player Label */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute',
              ...targetPosition,
              transform: 'translate(-50%, calc(-50% - 80px))'
            }}
            className="bg-amber-600 px-4 py-2 rounded-full border-2 border-amber-400"
          >
            <span className="text-white font-['Cinzel'] font-bold text-sm uppercase">
              Dealing to {currentPlayer}
            </span>
          </motion.div>

          {/* Deal Progress */}
          <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md px-6 py-3 rounded-full border border-amber-500">
            <div className="text-center">
              <div className="text-sm text-amber-300 font-['Cinzel']">Dealing Cards...</div>
              <div className="text-xs text-slate-400 mt-1">
                {currentDealIndex + 1} / {totalCards}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

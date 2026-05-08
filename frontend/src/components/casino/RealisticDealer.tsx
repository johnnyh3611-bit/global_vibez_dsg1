import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Realistic Casino Dealer Component
 * Professional human dealer with realistic animations
 */
export const RealisticDealer = ({
  dealerName = "NOVA",
  phrase = "Welcome to Global Vibez Casino",
  isDealing = false,
  isShuffling = false,
  mood = "professional",
  dealerImage = "https://images.pexels.com/photos/7594265/pexels-photo-7594265.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
}) => {
  const [currentPhrase, setCurrentPhrase] = useState(phrase);
  const [armPosition, setArmPosition] = useState({ x: 0, y: 0 });

  // Dealer phrases based on game events
  const dealerPhrases = {
    professional: [
      "Place your bets",
      "Good luck to all players",
      "No more bets",
      "Cards coming out"
    ],
    encouraging: [
      "Nice hand!",
      "You've got this",
      "Great choice"
    ],
    celebrating: [
      "Blackjack! Congratulations!",
      "Winner!",
      "Excellent play"
    ]
  };

  // Animate dealing arm
  useEffect(() => {
    if (isDealing) {
      const interval = setInterval(() => {
        // Simulate arm movement when dealing
        setArmPosition({
          x: Math.sin(Date.now() / 200) * 15,
          y: Math.cos(Date.now() / 300) * 10
        });
      }, 50);
      return () => clearInterval(interval);
    } else {
      setArmPosition({ x: 0, y: 0 });
    }
  }, [isDealing]);

  return (
    <div className="relative w-full h-full">
      {/* Background atmosphere */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/70 to-transparent" />
      
      {/* Neon spotlight effect */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-64 bg-gradient-radial from-purple-500/20 via-transparent to-transparent blur-3xl" />

      {/* Dealer image with proper framing */}
      <div className="relative h-full flex items-end justify-center">
        <motion.div
          className="relative w-full max-w-3xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          {/* Dealer photo */}
          <div className="relative">
            <img
              src={dealerImage}
              alt="Casino Dealer"
              className="w-full h-auto object-cover object-top"
              style={{ 
                maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 60%, rgba(0,0,0,0) 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 60%, rgba(0,0,0,0) 100%)'
              }}
            />
            
            {/* Neon outline effect */}
            <div className="absolute inset-0 bg-gradient-to-b from-purple-500/10 via-pink-500/10 to-transparent mix-blend-overlay" />
          </div>

          {/* Dealing arm animation overlay */}
          <AnimatePresence>
            {isDealing && (
              <motion.div
                className="absolute bottom-1/4 left-1/2"
                initial={{ opacity: 0 }}
                animate={{ 
                  opacity: [0.3, 0.7, 0.3],
                  x: armPosition.x,
                  y: armPosition.y
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="w-32 h-2 bg-gradient-to-r from-transparent via-white/50 to-transparent blur-sm" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Dealer info panel */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 w-max">
        <div className="bg-black/80 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] rounded-2xl px-6 py-3">
          <div className="flex items-center gap-4">
            {/* Status indicator */}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isDealing ? 'bg-green-400 animate-pulse' : 'bg-purple-400'}`} />
              <span className="text-sm text-gray-400 font-['Outfit']">
                {isDealing ? 'Dealing' : isShuffling ? 'Shuffling' : 'Ready'}
              </span>
            </div>

            {/* Dealer name */}
            <div className="h-6 w-px bg-white/10" />
            <div className="text-white font-['Unbounded'] font-bold tracking-wider">
              {dealerName}
            </div>
          </div>
        </div>
      </div>

      {/* Dealer speech bubble */}
      <AnimatePresence>
        {currentPhrase && (
          <motion.div
            className="absolute top-24 right-12"
            initial={{ opacity: 0, x: 20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.9 }}
            transition={{ type: 'spring', damping: 20 }}
          >
            <div className="relative">
              {/* Speech bubble */}
              <div className="bg-black/90 backdrop-blur-xl border border-purple-500/30 rounded-2xl px-4 py-2 shadow-[0_0_15px_rgba(157,0,255,0.4)]">
                <p className="text-white font-['Outfit'] text-sm max-w-xs">
                  {currentPhrase}
                </p>
              </div>
              {/* Pointer */}
              <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-0 h-0 border-t-8 border-t-transparent border-r-8 border-r-black/90 border-b-8 border-b-transparent" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chip tray visualization */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-20 opacity-40">
        <div className="flex justify-center gap-2 items-end h-full pb-2">
          {[1, 2, 3, 4, 5].map((stack, i) => (
            <div key={`item-${i}`} className="flex flex-col items-center gap-0.5">
              {Array.from({ length: 5 - Math.abs(i - 2) }).map((_, j) => (
                <div
                  key={j}
                  className="w-10 h-2 rounded-full bg-gradient-to-b from-yellow-400/60 to-yellow-600/60 border border-yellow-700/30"
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Shuffling animation */}
      <AnimatePresence>
        {isShuffling && (
          <motion.div
            className="absolute bottom-1/3 left-1/2 -translate-x-1/2"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ 
              opacity: [0, 1, 1, 0],
              scale: [0.8, 1, 1, 0.8],
              rotate: [0, 5, -5, 0]
            }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <div className="bg-gradient-to-br from-red-500/80 to-black/80 rounded-lg p-4 backdrop-blur-xl border border-red-500/30">
              <p className="text-white font-['Outfit'] text-sm">Shuffling cards...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RealisticDealer;

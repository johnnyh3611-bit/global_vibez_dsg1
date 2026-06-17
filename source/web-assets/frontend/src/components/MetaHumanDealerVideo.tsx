import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * REAL MetaHuman Dealer - Video Based
 * Uses actual MetaHuman video footage from Unreal Engine
 * No SVG, no holographic effects - just pure MetaHuman
 */
export default function MetaHumanDealerVideo({
  dealerType = "nova",
  phrase = "",
  isDealing = false,
  isShuffling = false,
  isCelebrating = false,
  gameState = "idle",
  size = "normal"
}: {
  dealerType?: string;
  dealerName?: string;
  phrase?: string;
  isDealing?: boolean;
  isShuffling?: boolean;
  isCelebrating?: boolean;
  gameState?: string;
  size?: string;
  className?: string;
}) {
  const [currentVideo, setCurrentVideo] = useState('idle');
  const [videoError, setVideoError] = useState(false);

  // Video state machine - switch videos based on game state
  useEffect(() => {
    if (isDealing) {
      setCurrentVideo('dealing');
    } else if (isShuffling) {
      setCurrentVideo('shuffling');
    } else if (isCelebrating) {
      setCurrentVideo('celebrating');
    } else {
      setCurrentVideo('idle');
    }
    setVideoError(false); // reset error when state changes
  }, [isDealing, isShuffling, isCelebrating]);

  const handleVideoError = () => {
    setVideoError(true);
  };

  const getFallbackLabel = () => {
    if (isCelebrating) return '🎉 Celebrating';
    if (isDealing) return '🃏 Dealing';
    if (isShuffling) return '🎴 Shuffling';
    return '⏳ Ready';
  };

  // MetaHuman video paths (your Unreal Engine exports)
  const getVideoPath = () => {
    const videos = {
      idle: '/videos/dealer-shuffle.mp4', // Use as idle/waiting state
      dealing: '/videos/dealer-dealing.mp4',
      shuffling: '/videos/dealer-shuffling.mp4',
      celebrating: '/videos/dealer-dealing.mp4' // Reuse dealing for now
    };
    return videos[currentVideo] || videos.idle;
  };

  const sizeClasses = {
    small: "w-48 h-64",
    normal: "w-80 h-96",
    large: "w-96 h-[500px]"
  };

  return (
    <div className={`relative ${sizeClasses[size]} mx-auto`}>
      
      {/* MetaHuman Video Player */}
      <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl border-4 border-yellow-400/30">
        
        {/* Actual MetaHuman Video */}
        {videoError ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-slate-800">
            <div className="text-6xl mb-3">🎰</div>
            <p className="text-yellow-400 font-bold text-sm uppercase tracking-wider">
              {getFallbackLabel()}
            </p>
            <p className="text-slate-500 text-xs mt-1">Live dealer video loading…</p>
          </div>
        ) : (
          <video
            key={currentVideo} // Force reload when state changes
            className="w-full h-full object-cover"
            autoPlay
            loop
            muted
            playsInline
            onError={handleVideoError}
          >
            <source src={getVideoPath()} type="video/mp4" />
            Your browser does not support MetaHuman video playback.
          </video>
        )}

        {/* Dealer Name Tag Overlay */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-yellow-400 px-6 py-2 rounded-full shadow-lg">
          <p className="text-black font-black uppercase tracking-wider text-sm">
            🎭 DEALER {dealerType.toUpperCase()}
          </p>
        </div>

        {/* Status Indicator */}
        <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-sm px-3 py-2 rounded-lg border border-cyan-400/50">
          <div className="flex items-center gap-2">
            <motion.div
              className="w-2 h-2 rounded-full bg-cyan-400"
              animate={{
                opacity: [0.5, 1, 0.5],
                scale: [1, 1.2, 1]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="text-xs text-cyan-400 font-bold uppercase">
              {isCelebrating ? 'Celebrating' : isDealing ? 'Dealing' : isShuffling ? 'Shuffling' : 'Ready'}
            </span>
          </div>
        </div>
      </div>

      {/* Dealer Speech Bubble */}
      <AnimatePresence>
        {phrase && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute -top-16 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-md border-2 border-yellow-400/50 rounded-2xl px-6 py-3 shadow-xl min-w-[250px] max-w-[400px]"
          >
            <p className="text-yellow-400 text-xs font-mono uppercase tracking-wider mb-1">
              DEALER COMMS
            </p>
            <p className="text-white text-sm font-medium italic">
              "{phrase}"
            </p>
            {/* Speech bubble arrow */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full">
              <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-yellow-400/50" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subtle ambient glow underneath */}
      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-3/4 h-8 bg-yellow-400/20 blur-2xl rounded-full" />
    </div>
  );
}

// Game state reaction helper (same as before)
export const getDealerReaction = (gameState, lastOutcome) => {
  if (gameState === 'PLAYER_WIN') {
    return { 
      phrase: "Impressive win! Ready to go again?", 
      animation: "celebrating"
    };
  }
  if (gameState === 'PLACING_BETS') {
    return { 
      phrase: "Place your bets, let's see what you've got.", 
      animation: "waiting"
    };
  }
  if (gameState === 'DEALING') {
    return { 
      phrase: "Dealing your cards...", 
      animation: "dealing"
    };
  }
  if (lastOutcome === 'BIG_LOSS') {
    return { 
      phrase: "Better luck next hand.", 
      animation: "professional"
    };
  }
  return { phrase: "Welcome to the table", animation: "idle" };
};

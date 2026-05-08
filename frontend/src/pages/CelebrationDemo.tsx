import React from 'react';
import { CinematicCelebration } from '@/components/CinematicCelebration';

/**
 * Cinematic Celebration Demo - Realistic, immersive, no borders
 */
export default function CelebrationDemo() {
  return (
    <div className="min-h-screen bg-black">
      {/* Show the cinematic celebration */}
      <CinematicCelebration
        result="win"
        message="You Crushed It!"
        opponentName="Marcus Johnson"
        playerScore={21}
        opponentScore={14}
        coinsEarned={150}
        onRestart={() => window.location.reload()}
        onContinue={() => alert('Continue clicked!')}
      />
      
      {/* Info overlay */}
      <div className="absolute top-8 left-8 z-[60] bg-black/80 backdrop-blur-md px-6 py-4 rounded-2xl border border-purple-500/30">
        <h2 className="text-white text-2xl font-black mb-2">🎬 Cinematic Victory</h2>
        <p className="text-gray-300 text-sm mb-1">✅ No borders - full immersion</p>
        <p className="text-gray-300 text-sm mb-1">✅ Realistic physics & particles</p>
        <p className="text-gray-300 text-sm mb-1">✅ Volumetric lighting</p>
        <p className="text-gray-300 text-sm mb-1">✅ Screen shake & camera effects</p>
        <p className="text-gray-300 text-sm mb-1">✅ Glassmorphism UI</p>
        <p className="text-gray-300 text-sm">✅ AAA game quality</p>
      </div>
    </div>
  );
}

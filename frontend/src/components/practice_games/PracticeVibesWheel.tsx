import React, { useState } from 'react';
import { Trophy, Sparkles, Star } from 'lucide-react';

import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';
const WHEEL_SEGMENTS = [
  { label: 'JACKPOT', value: 1000, color: 'from-yellow-400 to-orange-500', icon: '💎' },
  { label: '50 Credits', value: 50, color: 'from-cyan-400 to-blue-500', icon: '💰' },
  { label: 'LOSE', value: 0, color: 'from-gray-600 to-gray-800', icon: '💔' },
  { label: '100 Credits', value: 100, color: 'from-green-400 to-cyan-500', icon: '💵' },
  { label: '25 Credits', value: 25, color: 'from-purple-400 to-pink-500', icon: '🪙' },
  { label: 'LOSE', value: 0, color: 'from-gray-600 to-gray-800', icon: '💔' },
  { label: '200 Credits', value: 200, color: 'from-pink-500 to-red-500', icon: '💸' },
  { label: '10 Credits', value: 10, color: 'from-blue-400 to-purple-500', icon: '🎁' },
];

export default function PracticeVibesWheel({ onMove, gameState }: { onMove?: any, gameState?: any }) {
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState(null);
  const [credits, setCredits] = useState(gameState?.credits || 500);
  const [totalWon, setTotalWon] = useState(0);
  const [spinsLeft, setSpinsLeft] = useState(5);

  const spin = () => {
    if (spinning || spinsLeft <= 0) return;

    setSpinning(true);
    setResult(null);
    setSpinsLeft(prev => prev - 1);

    // Random spins (5-10 full rotations + random segment)
    const fullRotations = (5 + Math.random() * 5) * 360;
    const randomSegment = Math.floor(Math.random() * WHEEL_SEGMENTS.length);
    const segmentAngle = 360 / WHEEL_SEGMENTS.length;
    const finalRotation = fullRotations + (randomSegment * segmentAngle);

    setRotation(prev => prev + finalRotation);

    setTimeout(() => {
      const winningSegment = WHEEL_SEGMENTS[randomSegment];
      setResult(winningSegment);
      
      if (winningSegment.value > 0) {
        setCredits(prev => prev + winningSegment.value);
        setTotalWon(prev => prev + winningSegment.value);
      }
      
      setSpinning(false);
    }, 4000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-black p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-yellow-400 via-pink-500 to-cyan-400 bg-clip-text text-transparent mb-2">
            🎡 VIBES WHEEL 🎡
          </h1>
          <p className="text-pink-300 text-lg">Spin the Wheel of Fortune!</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-cyan-600 to-blue-600 rounded-xl p-4 border-2 border-yellow-400 shadow-lg">
            <div className="text-yellow-200 text-sm">Credits</div>
            <div className="text-3xl font-bold text-white">{credits}</div>
          </div>
          <div className="bg-gradient-to-br from-pink-600 to-purple-600 rounded-xl p-4 border-2 border-cyan-400 shadow-lg">
            <div className="text-cyan-200 text-sm">Total Won</div>
            <div className="text-3xl font-bold text-white">{totalWon}</div>
          </div>
          <div className="bg-gradient-to-br from-green-600 to-cyan-600 rounded-xl p-4 border-2 border-pink-400 shadow-lg">
            <div className="text-pink-200 text-sm">Spins Left</div>
            <div className="text-3xl font-bold text-white">{spinsLeft}</div>
          </div>
        </div>

        {/* Wheel Container */}
        <div className="relative mb-8">
          {/* Pointer */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20">
            <div className="w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-t-[40px] border-t-yellow-400 drop-shadow-lg" />
          </div>

          {/* Wheel */}
          <div className="flex items-center justify-center p-8">
            <div className="relative w-96 h-96">
              {/* Outer glow */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 animate-pulse blur-xl opacity-50" />
              
              {/* Wheel */}
              <div
                className="relative w-full h-full rounded-full border-8 border-yellow-400 shadow-2xl overflow-hidden"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transition: spinning ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none'
                }}
              >
                {WHEEL_SEGMENTS.map((segment, index) => {
                  const angle = 360 / WHEEL_SEGMENTS.length;
                  const rotation = angle * index;
                  
                  return (
                    <div
                      key={`wheel-segment-${index}`}
                      className={`absolute w-full h-full origin-center`}
                      style={{
                        transform: `rotate(${rotation}deg)`,
                        clipPath: `polygon(50% 50%, 50% 0%, ${50 + 50 * Math.cos(Math.PI / 4)}% ${50 - 50 * Math.sin(Math.PI / 4)}%)`
                      }}
                    >
                      <div className={`w-full h-full bg-gradient-to-br ${segment.color} flex flex-col items-center justify-start pt-8`}>
                        <div className="text-3xl mb-1">{segment.icon}</div>
                        <div className="text-white font-bold text-sm">
                          {segment.label}
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {/* Center circle */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 border-4 border-white shadow-xl flex items-center justify-center">
                  <Sparkles className="w-10 h-10 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Result Display */}
        {result && !spinning && (
          <div className="bg-gradient-to-r from-purple-900 to-pink-900 rounded-2xl p-6 mb-6 border-4 border-yellow-400 shadow-2xl text-center animate-pulse">
            <div className="text-6xl mb-3">{result.icon}</div>
            <h2 className="text-3xl font-bold text-white mb-2">
              {result.label}
            </h2>
            {result.value > 0 && (
              <p className="text-2xl text-yellow-400 font-bold">
                +{result.value} Credits!
              </p>
            )}
          </div>
        )}

        {/* Spin Button */}
        <button
          onClick={spin}
          disabled={spinning || spinsLeft <= 0}
          className={`
            w-full py-6 text-2xl font-bold rounded-2xl
            bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500
            text-white shadow-2xl transform transition-all
            ${spinning || spinsLeft <= 0 ? 'scale-95 opacity-50' : 'hover:scale-105'}
            disabled:cursor-not-allowed
          `}
        >
          {spinning ? (
            <span className="flex items-center justify-center gap-3">
              <Star className="w-8 h-8 animate-spin" />
              SPINNING...
            </span>
          ) : spinsLeft > 0 ? (
            <span className="flex items-center justify-center gap-3">
              <Trophy className="w-8 h-8" />
              SPIN THE WHEEL!
              <Trophy className="w-8 h-8" />
            </span>
          ) : (
            'NO SPINS LEFT'
          )}
        </button>

        {spinsLeft === 0 && (
          <div className="mt-6 text-center">
            <p className="text-xl text-gray-400 mb-4">Come back tomorrow for more spins!</p>
            <button
              onClick={() => setSpinsLeft(5)}
              className="px-8 py-3 bg-gradient-to-r from-green-600 to-cyan-600 text-white font-bold rounded-xl hover:scale-105 transition-transform"
            >
              Reset Spins (Demo)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
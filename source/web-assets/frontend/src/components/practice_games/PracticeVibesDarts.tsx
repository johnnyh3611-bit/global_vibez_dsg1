import React, { useState } from 'react';
import { Target, Trophy, Sparkles } from 'lucide-react';
import MetaHumanDealer from '../MetaHumanDealer';

import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';
const DARTBOARD_SECTIONS = [
  { value: 20, angle: 0, color: 'red' },
  { value: 1, angle: 18, color: 'green' },
  { value: 18, angle: 36, color: 'red' },
  { value: 4, angle: 54, color: 'green' },
  { value: 13, angle: 72, color: 'red' },
  { value: 6, angle: 90, color: 'green' },
  { value: 10, angle: 108, color: 'red' },
  { value: 15, angle: 126, color: 'green' },
  { value: 2, angle: 144, color: 'red' },
  { value: 17, angle: 162, color: 'green' },
  { value: 3, angle: 180, color: 'red' },
  { value: 19, angle: 198, color: 'green' },
  { value: 7, angle: 216, color: 'red' },
  { value: 16, angle: 234, color: 'green' },
  { value: 8, angle: 252, color: 'red' },
  { value: 11, angle: 270, color: 'green' },
  { value: 14, angle: 288, color: 'red' },
  { value: 9, angle: 306, color: 'green' },
  { value: 12, angle: 324, color: 'red' },
  { value: 5, angle: 342, color: 'green' }
];

export default function PracticeVibesDarts({ onMove, gameState }: { onMove?: any, gameState?: any }) {
  const [score, setScore] = useState(501);
  const [totalScore, setTotalScore] = useState(0);
  const [throws, setThrows] = useState([]);
  const [currentRound, setCurrentRound] = useState([]);
  const [dealerPhrase, setDealerPhrase] = useState('welcome');
  const [dealerMood, setDealerMood] = useState('neutral');
  const [gameOver, setGameOver] = useState(false);

  const throwDart = () => {
    if (currentRound.length >= 3 || gameOver) return;

    // Simulate dart throw
    const hitSection = DARTBOARD_SECTIONS[Math.floor(Math.random() * DARTBOARD_SECTIONS.length)];
    const multiplier = Math.random() > 0.7 ? (Math.random() > 0.5 ? 3 : 2) : 1; // Triple, Double, or Single
    const points = hitSection.value * multiplier;
    const isBullseye = Math.random() > 0.95;
    
    const throwResult = {
      section: hitSection.value,
      multiplier,
      points: isBullseye ? 50 : points,
      isBullseye
    };

    const newRound = [...currentRound, throwResult];
    setCurrentRound(newRound);

    const roundTotal = newRound.reduce((sum, t) => sum + t.points, 0);
    const newScore = score - throwResult.points;

    if (newScore === 0) {
      setScore(0);
      setGameOver(true);
      setDealerPhrase('bigWin');
      setDealerMood('excited');
    } else if (newScore < 0) {
      setDealerPhrase('playerLoses');
      setDealerMood('neutral');
    } else {
      setScore(newScore);
      setTotalScore(prev => prev + throwResult.points);
      
      if (throwResult.isBullseye) {
        setDealerPhrase('bigWin');
        setDealerMood('excited');
      } else if (throwResult.multiplier === 3) {
        setDealerPhrase('playerWins');
        setDealerMood('happy');
      }
    }

    if (newRound.length === 3) {
      setThrows([...throws, newRound]);
      setCurrentRound([]);
      setTimeout(() => setDealerPhrase('placeBets'), 2000);
    }
  };

  const resetGame = () => {
    setScore(501);
    setTotalScore(0);
    setThrows([]);
    setCurrentRound([]);
    setDealerPhrase('welcome');
    setDealerMood('neutral');
    setGameOver(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-900 via-red-900 to-black p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Dealer */}
        <div className="mb-8">
          <MetaHumanDealer 
            dealerType="nova" 
            gameType="default"
            gameState={{
              playerWon: gameOver && score === 0,
              playerLost: score < 0,
              isDealing: currentRound.length > 0
            }}
            size="normal"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-red-600 to-orange-600 rounded-xl p-4 border-2 border-red-400">
            <div className="text-red-100 text-sm">Score Left</div>
            <div className="text-3xl font-bold text-white">{score}</div>
          </div>
          <div className="bg-gradient-to-br from-yellow-600 to-orange-600 rounded-xl p-4 border-2 border-yellow-400">
            <div className="text-yellow-100 text-sm">Total Points</div>
            <div className="text-3xl font-bold text-white">{totalScore}</div>
          </div>
          <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl p-4 border-2 border-purple-400">
            <div className="text-purple-100 text-sm">Throws</div>
            <div className="text-3xl font-bold text-white">{currentRound.length}/3</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Dartboard */}
          <div className="bg-gradient-to-br from-gray-900 to-black rounded-3xl p-8 border-4 border-yellow-600">
            <div className="relative w-80 h-80 mx-auto">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-red-600 to-orange-600 opacity-20 blur-2xl" />
              
              {/* Dartboard */}
              <svg viewBox="0 0 200 200" className="w-full h-full">
                <circle cx="100" cy="100" r="95" fill="#1a1a1a" stroke="#fbbf24" strokeWidth="2" />
                
                {/* Sections */}
                {DARTBOARD_SECTIONS.map((section, i) => {
                  const nextAngle = DARTBOARD_SECTIONS[(i + 1) % DARTBOARD_SECTIONS.length].angle;
                  return (
                    <g key={`section-${section.value}-${i}`}>
                      <path
                        d={`M 100 100 L ${100 + 95 * Math.cos((section.angle * Math.PI) / 180)} ${100 + 95 * Math.sin((section.angle * Math.PI) / 180)} A 95 95 0 0 1 ${100 + 95 * Math.cos((nextAngle * Math.PI) / 180)} ${100 + 95 * Math.sin((nextAngle * Math.PI) / 180)} Z`}
                        fill={section.color === 'red' ? '#dc2626' : '#16a34a'}
                        fillOpacity="0.6"
                      />
                      <text
                        x={100 + 70 * Math.cos(((section.angle + 9) * Math.PI) / 180)}
                        y={100 + 70 * Math.sin(((section.angle + 9) * Math.PI) / 180)}
                        fill="white"
                        fontSize="10"
                        textAnchor="middle"
                        fontWeight="bold"
                      >
                        {section.value}
                      </text>
                    </g>
                  );
                })}
                
                {/* Bullseye */}
                <circle cx="100" cy="100" r="15" fill="#fbbf24" />
                <circle cx="100" cy="100" r="8" fill="#dc2626" />
                <text x="100" y="105" fill="white" fontSize="8" textAnchor="middle" fontWeight="bold">50</text>
              </svg>
            </div>

            <button
              onClick={throwDart}
              disabled={currentRound.length >= 3 || gameOver}
              className="w-full mt-6 py-4 bg-gradient-to-r from-red-600 to-orange-600 text-white font-bold text-xl rounded-xl border-2 border-red-400 hover:scale-105 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Target className="w-6 h-6" />
              THROW DART
            </button>
          </div>

          {/* Scoreboard */}
          <div className="space-y-4">
            {/* Current Round */}
            <div className="bg-gradient-to-br from-purple-900 to-pink-900 rounded-2xl p-6 border-4 border-purple-400">
              <h3 className="text-2xl font-bold text-purple-200 mb-4">Current Round</h3>
              <div className="space-y-2">
                {[0, 1, 2].map(i => (
                  <div key={`dart-${i}`} className="bg-black/30 rounded-lg p-4 flex items-center justify-between">
                    <span className="text-purple-300">Dart {i + 1}</span>
                    {currentRound[i] ? (
                      <div className="flex items-center gap-2">
                        {currentRound[i].isBullseye ? (
                          <span className="text-2xl font-bold text-yellow-400">BULLSEYE! 50</span>
                        ) : (
                          <>
                            <span className="text-xl font-bold text-white">
                              {currentRound[i].multiplier === 3 ? 'TRIPLE' : currentRound[i].multiplier === 2 ? 'DOUBLE' : ''} {currentRound[i].section}
                            </span>
                            <span className="text-2xl font-bold text-green-400">+{currentRound[i].points}</span>
                          </>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-600">-</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* History */}
            <div className="bg-black/50 rounded-2xl p-6 border-2 border-cyan-600 max-h-64 overflow-y-auto">
              <h3 className="text-xl font-bold text-cyan-400 mb-4">Previous Rounds</h3>
              {throws.length === 0 ? (
                <p className="text-gray-500">No rounds yet</p>
              ) : (
                <div className="space-y-2">
                  {throws.map((round, i) => (
                    <div key={`round-${i}`} className="bg-gray-800 rounded-lg p-3">
                      <div className="text-sm text-gray-400 mb-1">Round {i + 1}</div>
                      <div className="flex gap-2">
                        {round.map((t, j) => (
                          <span key={j} className="text-white font-bold">
                            {t.isBullseye ? '🎯50' : `${t.points}`}
                          </span>
                        ))}
                        <span className="ml-auto text-green-400">= {round.reduce((s, t) => s + t.points, 0)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={resetGame}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold rounded-xl hover:scale-105 transition-transform"
            >
              New Game (501)
            </button>
          </div>
        </div>

        {/* Win Modal */}
        {gameOver && score === 0 && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gradient-to-br from-yellow-900 to-orange-900 rounded-3xl p-8 border-4 border-yellow-400 text-center max-w-md animate-bounce">
              <div className="text-6xl mb-4">🎯</div>
              <h2 className="text-4xl font-bold text-white mb-4">PERFECT!</h2>
              <p className="text-2xl text-yellow-400 mb-6">You hit 501!</p>
              <button
                onClick={resetGame}
                className="px-8 py-4 bg-gradient-to-r from-green-600 to-cyan-600 text-white font-bold text-xl rounded-xl hover:scale-105 transition-transform"
              >
                Play Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
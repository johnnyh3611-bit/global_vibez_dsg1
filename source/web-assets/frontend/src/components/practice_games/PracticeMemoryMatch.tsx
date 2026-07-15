import React, { useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';

import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';
import GameShell from '@/components/games/GameShell';

const EMOJIS = ['🎮', '🎯', '🎲', '🎪', '🎨', '🎭', '🎬', '🎤'];

export default function PracticeMemoryMatch({ onMove, gameState }: { onMove?: any, gameState?: any }) {
  const [cards, setCards] = useState<{ id: number; emoji: string }[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [score, setScore] = useState(0);
  const [gameWon, setGameWon] = useState(false);
  const [particleTrigger, setParticleTrigger] = useState(0);

  const initGame = () => {
    const shuffled = [...EMOJIS, ...EMOJIS]
      .sort(() => Math.random() - 0.5)
      .map((emoji, i) => ({ id: i, emoji }));
    setCards(shuffled);
    setFlipped([]);
    setMatched([]);
    setMoves(0);
    setScore(0);
    setGameWon(false);
  };

  useEffect(() => {
    initGame();
  }, []);

  useEffect(() => {
    if (flipped.length === 2) {
      const [first, second] = flipped;
      if (cards[first].emoji === cards[second].emoji) {
        setMatched((prev) => [...prev, first, second]);
        setScore((prev) => prev + 100);
        cardSoundManager.playWinSound();
        setParticleTrigger((prev) => prev + 1);
        setFlipped([]);

        if (matched.length + 2 === cards.length) {
          setTimeout(() => setGameWon(true), 500);
        }
      } else {
        setTimeout(() => setFlipped([]), 1000);
      }
      setMoves((prev) => prev + 1);
    }
  }, [flipped, cards, matched]);

  const handleClick = (index: number) => {
    if (flipped.length === 2 || flipped.includes(index) || matched.includes(index)) return;
    cardSoundManager.playCardFlip();
    setFlipped((prev) => [...prev, index]);
  };

  return (
    <GameShell
      title="Memory Match"
      emoji="🧠"
      subtitle="Find all matching pairs"
      bgGradient="from-purple-900 via-pink-900 to-black"
      onBack={() => window.history.back()}
      onRestart={initGame}
      status={gameWon ? 'You matched them all!' : `${cards.length - matched.length} cards left`}
      stats={[
        { label: 'Moves', value: moves, color: 'purple' },
        { label: 'Score', value: score, color: 'yellow' },
      ]}
      controls={
        <button
          onClick={initGame}
          className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl border-2 border-blue-400 hover:scale-105 transition-transform flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-5 h-5" />
          New Game
        </button>
      }
      modal={
        gameWon && (
          <div className="bg-gradient-to-br from-purple-900 to-pink-900 rounded-3xl p-6 sm:p-8 border-4 border-yellow-400 text-center max-w-sm mx-auto animate-bounce">
            <div className="text-5xl sm:text-6xl mb-4">🎉</div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">You Win!</h2>
            <p className="text-2xl text-yellow-400 mb-2">Score: {score}</p>
            <p className="text-lg text-purple-300 mb-6">Moves: {moves}</p>
            <button
              onClick={initGame}
              className="px-8 py-4 bg-gradient-to-r from-green-600 to-cyan-600 text-white font-bold text-xl rounded-xl hover:scale-105 transition-transform"
            >
              Play Again
            </button>
          </div>
        )
      }
    >
      <ParticleEffectsOverlay triggerSparkle={particleTrigger > 0 ? { x: 0, y: 0 } : null} />

      <div className="w-full max-w-lg mx-auto">
        <div className="grid grid-cols-4 gap-2 sm:gap-4">
          {cards.map((card, index) => (
            <button
              key={card.id}
              onClick={() => handleClick(index)}
              disabled={matched.includes(index)}
              className={`
                aspect-square rounded-xl sm:rounded-2xl border-2 sm:border-4 text-3xl sm:text-5xl
                transition-all transform hover:scale-105
                ${
                  matched.includes(index)
                    ? 'bg-gradient-to-br from-green-500 to-cyan-500 border-green-400 opacity-50'
                    : flipped.includes(index)
                    ? 'bg-gradient-to-br from-purple-500 to-pink-500 border-purple-400'
                    : 'bg-gradient-to-br from-gray-700 to-gray-900 border-gray-600'
                }
              `}
            >
              {flipped.includes(index) || matched.includes(index) ? card.emoji : '?'}
            </button>
          ))}
        </div>
      </div>
    </GameShell>
  );
}

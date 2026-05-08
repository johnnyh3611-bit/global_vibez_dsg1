
import React, { useState, useEffect } from 'react';
import { Trophy, RotateCcw, Star } from 'lucide-react';

import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';
const EMOJIS = ['🎮', '🎯', '🎲', '🎪', '🎨', '🎭', '🎬', '🎤'];

export default function PracticeMemoryMatch({ onMove, gameState }: { onMove?: any, gameState?: any }) {
  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState([]);
  const [moves, setMoves] = useState(0);
  const [score, setScore] = useState(0);
  const [gameWon, setGameWon] = useState(false);
  const [particleTrigger, setParticleTrigger] = useState(0);

  const initGame = () => {
    const shuffled = [...EMOJIS, ...EMOJIS]
      .sort(() => Math.random() - 0.5)
      .map((emoji, i) => ({ id: i, emoji, matched: false }));
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
        setMatched([...matched, first, second]);
        setScore(prev => prev + 100);
        cardSoundManager.playWinSound();
        setParticleTrigger(prev => prev + 1);
        setFlipped([]);
        
        if (matched.length + 2 === cards.length) {
          setTimeout(() => setGameWon(true), 500);
        }
      } else {
        setTimeout(() => setFlipped([]), 1000);
      }
      setMoves(prev => prev + 1);
    }
  }, [flipped, cards, matched]);

  const handleClick = (index) => {
    if (flipped.length === 2 || flipped.includes(index) || matched.includes(index)) return;
    cardSoundManager.playCardFlip();
    setFlipped([...flipped, index]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-black p-8">
      {/* Particle Effects */}
      <ParticleEffectsOverlay triggerSparkle={particleTrigger > 0 ? { x: 0, y: 0 } : null} />
      
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
            🧠 MEMORY MATCH
          </h1>
          <p className="text-purple-300">Find all matching pairs!</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl p-4 border-2 border-purple-400">
            <div className="text-purple-100 text-sm">Moves</div>
            <div className="text-3xl font-bold text-white">{moves}</div>
          </div>
          <div className="bg-gradient-to-br from-yellow-600 to-orange-600 rounded-xl p-4 border-2 border-yellow-400">
            <div className="text-yellow-100 text-sm">Score</div>
            <div className="text-3xl font-bold text-white">{score}</div>
          </div>
        </div>

        {/* Game Board */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {cards.map((card, index) => (
            <button
              key={card.id}
              onClick={() => handleClick(index)}
              disabled={matched.includes(index)}
              className={`
                aspect-square rounded-2xl border-4 text-6xl
                transition-all transform hover:scale-105
                ${matched.includes(index) 
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

        {/* Reset Button */}
        <button
          onClick={initGame}
          className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-xl rounded-xl border-2 border-blue-400 hover:scale-105 transition-transform flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-6 h-6" />
          New Game
        </button>

        {/* Win Modal */}
        {gameWon && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gradient-to-br from-purple-900 to-pink-900 rounded-3xl p-8 border-4 border-yellow-400 text-center max-w-md animate-bounce">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-4xl font-bold text-white mb-4">You Win!</h2>
              <p className="text-2xl text-yellow-400 mb-2">Score: {score}</p>
              <p className="text-xl text-purple-300 mb-6">Moves: {moves}</p>
              <button
                onClick={initGame}
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
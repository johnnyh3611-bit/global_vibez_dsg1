
import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, RotateCcw } from 'lucide-react';

import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';
const GRID_SIZE = 20;
const INITIAL_SNAKE = [{ x: 10, y: 10 }];
const INITIAL_DIRECTION = { x: 1, y: 0 };

export default function PracticeSnake({ onMove, gameState }: { onMove?: any, gameState?: any }) {
  const [snake, setSnake] = useState(INITIAL_SNAKE);
  const [direction, setDirection] = useState(INITIAL_DIRECTION);
  const [food, setFood] = useState({ x: 15, y: 15 });
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [particleTrigger, setParticleTrigger] = useState(0);

  const generateFood = useCallback(() => {
    return {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE)
    };
  }, []);

  const resetGame = () => {
    setSnake(INITIAL_SNAKE);
    setDirection(INITIAL_DIRECTION);
    setFood(generateFood());
    setGameOver(false);
    setScore(0);
    setIsPaused(false);
  };

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (gameOver) return;
      
      switch(e.key) {
        case 'ArrowUp':
          if (direction.y === 0) setDirection({ x: 0, y: -1 });
          break;
        case 'ArrowDown':
          if (direction.y === 0) setDirection({ x: 0, y: 1 });
          break;
        case 'ArrowLeft':
          if (direction.x === 0) setDirection({ x: -1, y: 0 });
          break;
        case 'ArrowRight':
          if (direction.x === 0) setDirection({ x: 1, y: 0 });
          break;
        case ' ':
          setIsPaused(prev => !prev);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [direction, gameOver]);

  useEffect(() => {
    if (gameOver || isPaused) return;

    const gameLoop = setInterval(() => {
      setSnake(prevSnake => {
        const head = prevSnake[0];
        const newHead = {
          x: (head.x + direction.x + GRID_SIZE) % GRID_SIZE,
          y: (head.y + direction.y + GRID_SIZE) % GRID_SIZE
        };

        // Check collision with self
        if (prevSnake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
          cardSoundManager.playLoseSound();
          setGameOver(true);
          if (score > highScore) setHighScore(score);
          return prevSnake;
        }

        const newSnake = [newHead, ...prevSnake];

        // Check if food eaten
        if (newHead.x === food.x && newHead.y === food.y) {
          cardSoundManager.playWinSound();
          setParticleTrigger(prev => prev + 1);
          setScore(prev => prev + 10);
          setFood(generateFood());
          return newSnake;
        }

        newSnake.pop();
        return newSnake;
      });
    }, 150);

    return () => clearInterval(gameLoop);
  }, [direction, food, gameOver, isPaused, generateFood, score, highScore]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-emerald-900 to-black p-8">
      {/* Particle Effects */}
      <ParticleEffectsOverlay triggerSparkle={particleTrigger > 0 ? { x: 0, y: 0 } : null} />
      
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-green-400 to-cyan-400 bg-clip-text text-transparent mb-2">
            🐍 SNAKE GAME
          </h1>
          <p className="text-green-300">Use Arrow Keys to Move • Space to Pause</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gradient-to-br from-green-600 to-cyan-600 rounded-xl p-4 border-2 border-green-400">
            <div className="text-green-100 text-sm">Score</div>
            <div className="text-3xl font-bold text-white">{score}</div>
          </div>
          <div className="bg-gradient-to-br from-yellow-600 to-orange-600 rounded-xl p-4 border-2 border-yellow-400">
            <div className="text-yellow-100 text-sm">High Score</div>
            <div className="text-3xl font-bold text-white">{highScore}</div>
          </div>
        </div>

        {/* Game Board */}
        <div className="bg-black rounded-2xl p-4 border-4 border-green-500 shadow-2xl mb-6">
          <div 
            className="grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
              aspectRatio: '1/1'
            }}
          >
            {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
              const x = i % GRID_SIZE;
              const y = Math.floor(i / GRID_SIZE);
              const isSnake = snake.some(s => s.x === x && s.y === y);
              const isHead = snake[0].x === x && snake[0].y === y;
              const isFood = food.x === x && food.y === y;

              return (
                <div
                  key={`cell-${x}-${y}`}
                  className={`
                    rounded-sm transition-all
                    ${isHead ? 'bg-gradient-to-br from-green-400 to-cyan-400 scale-110' : ''}
                    ${isSnake && !isHead ? 'bg-green-500' : ''}
                    ${isFood ? 'bg-red-500 animate-pulse' : ''}
                    ${!isSnake && !isFood ? 'bg-gray-900' : ''}
                  `}
                />
              );
            })}
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-4">
          <button
            onClick={resetGame}
            className="flex-1 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-xl rounded-xl border-2 border-blue-400 hover:scale-105 transition-transform flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-6 h-6" />
            New Game
          </button>
          <button
            onClick={() => setIsPaused(prev => !prev)}
            className="flex-1 py-4 bg-gradient-to-r from-yellow-600 to-orange-600 text-white font-bold text-xl rounded-xl border-2 border-yellow-400 hover:scale-105 transition-transform"
            disabled={gameOver}
          >
            {isPaused ? 'Resume' : 'Pause'}
          </button>
        </div>

        {/* Game Over */}
        {gameOver && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gradient-to-br from-red-900 to-orange-900 rounded-3xl p-8 border-4 border-red-400 text-center max-w-md">
              <div className="text-6xl mb-4">💀</div>
              <h2 className="text-4xl font-bold text-white mb-4">Game Over!</h2>
              <p className="text-2xl text-yellow-400 mb-6">Score: {score}</p>
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
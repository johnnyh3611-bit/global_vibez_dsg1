import React, { useState, useEffect, useCallback } from 'react';
import { RotateCcw, Pause, Play } from 'lucide-react';

import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';
import GameShell from '@/components/games/GameShell';

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
      y: Math.floor(Math.random() * GRID_SIZE),
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
    const handleKeyPress = (e: KeyboardEvent) => {
      if (gameOver) return;

      switch (e.key) {
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
          setIsPaused((prev) => !prev);
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
      setSnake((prevSnake) => {
        const head = prevSnake[0];
        const newHead = {
          x: (head.x + direction.x + GRID_SIZE) % GRID_SIZE,
          y: (head.y + direction.y + GRID_SIZE) % GRID_SIZE,
        };

        if (prevSnake.some((segment) => segment.x === newHead.x && segment.y === newHead.y)) {
          cardSoundManager.playLoseSound();
          setGameOver(true);
          if (score > highScore) setHighScore(score);
          return prevSnake;
        }

        const newSnake = [newHead, ...prevSnake];

        if (newHead.x === food.x && newHead.y === food.y) {
          cardSoundManager.playWinSound();
          setParticleTrigger((prev) => prev + 1);
          setScore((prev) => prev + 10);
          setFood(generateFood());
          return newSnake;
        }

        newSnake.pop();
        return newSnake;
      });
    }, 150);

    return () => clearInterval(gameLoop);
  }, [direction, food, gameOver, isPaused, generateFood, score, highScore]);

  const status = gameOver ? 'Game Over!' : isPaused ? 'Paused — press Space to resume' : 'Use Arrow Keys to Move';

  return (
    <GameShell
      title="Snake"
      emoji="🐍"
      subtitle="Eat food, grow longer, don't bite your tail"
      bgGradient="from-green-900 via-emerald-900 to-black"
      onBack={() => window.history.back()}
      onRestart={resetGame}
      status={status}
      stats={[
        { label: 'Score', value: score, color: 'green' },
        { label: 'High Score', value: highScore, color: 'yellow' },
      ]}
      controls={
        <div className="flex gap-3">
          <button
            onClick={resetGame}
            className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl border-2 border-blue-400 hover:scale-105 transition-transform flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-5 h-5" />
            New Game
          </button>
          <button
            onClick={() => setIsPaused((prev) => !prev)}
            disabled={gameOver}
            className="flex-1 py-3 bg-gradient-to-r from-yellow-600 to-orange-600 text-white font-bold rounded-xl border-2 border-yellow-400 hover:scale-105 transition-transform flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
            {isPaused ? 'Resume' : 'Pause'}
          </button>
        </div>
      }
      modal={
        gameOver && (
          <div className="bg-gradient-to-br from-red-900 to-orange-900 rounded-3xl p-6 sm:p-8 border-4 border-red-400 text-center max-w-sm mx-auto">
            <div className="text-5xl sm:text-6xl mb-4">💀</div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Game Over!</h2>
            <p className="text-2xl text-yellow-400 mb-6">Score: {score}</p>
            <button
              onClick={resetGame}
              className="px-8 py-4 bg-gradient-to-r from-green-600 to-cyan-600 text-white font-bold text-xl rounded-xl hover:scale-105 transition-transform"
            >
              Play Again
            </button>
          </div>
        )
      }
    >
      <ParticleEffectsOverlay triggerSparkle={particleTrigger > 0 ? { x: 0, y: 0 } : null} />

      <div className="w-full max-w-xl mx-auto">
        <div className="bg-black rounded-2xl p-2 sm:p-4 border-4 border-green-500 shadow-2xl">
          <div
            className="grid gap-0.5 sm:gap-1"
            style={{
              gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
              aspectRatio: '1/1',
            }}
          >
            {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
              const x = i % GRID_SIZE;
              const y = Math.floor(i / GRID_SIZE);
              const isSnake = snake.some((s) => s.x === x && s.y === y);
              const isHead = snake[0].x === x && snake[0].y === y;
              const isFood = food.x === x && food.y === y;

              return (
                <div
                  key={`cell-${x}-${y}`}
                  className={`
                    rounded-[2px] sm:rounded-sm transition-all
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
      </div>
    </GameShell>
  );
}

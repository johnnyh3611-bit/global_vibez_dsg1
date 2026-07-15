import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RotateCcw, Pause, Play } from 'lucide-react';

import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';
import GameShell from '@/components/games/GameShell';

const GRID_SIZE = 20;
const INITIAL_SNAKE = [{ x: 10, y: 10 }];
const INITIAL_DIRECTION = { x: 1, y: 0 };
const BASE_SPEED = 150;
const MIN_SPEED = 60;

export default function PracticeSnake({ onMove, gameState }: { onMove?: any, gameState?: any }) {
  const [snake, setSnake] = useState(INITIAL_SNAKE);
  const [direction, setDirection] = useState(INITIAL_DIRECTION);
  const nextDirection = useRef(INITIAL_DIRECTION);
  const [food, setFood] = useState({ x: 15, y: 15 });
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [particleTrigger, setParticleTrigger] = useState(0);

  const speed = Math.max(MIN_SPEED, BASE_SPEED - Math.floor(score / 50) * 15);

  const generateFood = useCallback((currentSnake: { x: number; y: number }[]) => {
    let pos: { x: number; y: number };
    do {
      pos = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
    } while (currentSnake.some((segment) => segment.x === pos.x && segment.y === pos.y));
    return pos;
  }, []);

  const resetGame = () => {
    const freshSnake = INITIAL_SNAKE;
    setSnake(freshSnake);
    setDirection(INITIAL_DIRECTION);
    nextDirection.current = INITIAL_DIRECTION;
    setFood(generateFood(freshSnake));
    setGameOver(false);
    setScore(0);
    setIsPaused(false);
  };

  useEffect(() => {
    const saved = Number(localStorage.getItem('snake-high-score') || 0);
    if (saved) setHighScore(saved);
    setFood(generateFood(INITIAL_SNAKE));
  }, [generateFood]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (gameOver) return;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          if (nextDirection.current.y === 0) nextDirection.current = { x: 0, y: -1 };
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          if (nextDirection.current.y === 0) nextDirection.current = { x: 0, y: 1 };
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          if (nextDirection.current.x === 0) nextDirection.current = { x: -1, y: 0 };
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          if (nextDirection.current.x === 0) nextDirection.current = { x: 1, y: 0 };
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
  }, [gameOver]);

  useEffect(() => {
    if (gameOver || isPaused) return;

    const gameLoop = setInterval(() => {
      setSnake((prevSnake) => {
        setDirection(nextDirection.current);
        const head = prevSnake[0];
        const newHead = {
          x: (head.x + nextDirection.current.x + GRID_SIZE) % GRID_SIZE,
          y: (head.y + nextDirection.current.y + GRID_SIZE) % GRID_SIZE,
        };

        if (prevSnake.some((segment) => segment.x === newHead.x && segment.y === newHead.y)) {
          cardSoundManager.playLoseSound();
          setGameOver(true);
          setHighScore((prev) => {
            const next = Math.max(prev, score);
            localStorage.setItem('snake-high-score', String(next));
            return next;
          });
          return prevSnake;
        }

        const newSnake = [newHead, ...prevSnake];

        if (newHead.x === food.x && newHead.y === food.y) {
          cardSoundManager.playWinSound();
          setParticleTrigger((prev) => prev + 1);
          setScore((prev) => {
            const next = prev + 10;
            setFood(generateFood(newSnake));
            return next;
          });
          return newSnake;
        }

        newSnake.pop();
        return newSnake;
      });
    }, speed);

    return () => clearInterval(gameLoop);
  }, [direction, food, gameOver, isPaused, generateFood, score, speed]);

  const status = gameOver
    ? 'Game Over!'
    : isPaused
    ? 'Paused — press Space to resume'
    : 'Use Arrow Keys or WASD';

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
            <p className="text-2xl text-yellow-400 mb-2">Score: {score}</p>
            <p className="text-lg text-orange-300 mb-6">High Score: {highScore}</p>
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

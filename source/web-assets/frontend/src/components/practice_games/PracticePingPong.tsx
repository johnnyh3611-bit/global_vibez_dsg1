import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RotateCcw, Play } from 'lucide-react';

import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';
import GameShell from '@/components/games/GameShell';

const FIELD_WIDTH = 100;
const FIELD_HEIGHT = 100;
const PADDLE_WIDTH = 2;
const PADDLE_HEIGHT = 20;
const BALL_SIZE = 3;
const WIN_SCORE = 11;

export default function PracticePingPong({ onMove, gameState }: { onMove?: any, gameState?: any }) {
  const [ball, setBall] = useState({ x: 50, y: 50, dx: 1, dy: 0.5, speed: 1.2 });
  const [playerY, setPlayerY] = useState(40);
  const [aiY, setAiY] = useState(40);
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [gameActive, setGameActive] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [particleTrigger, setParticleTrigger] = useState(0);
  const [message, setMessage] = useState('Press start');

  const fieldRef = useRef<HTMLDivElement>(null);

  const resetBall = useCallback((toward: 'player' | 'ai') => {
    const dx = toward === 'player' ? -1 : 1;
    const dy = (Math.random() * 1.4 - 0.7);
    setBall({ x: 50, y: 50, dx, dy, speed: 1.2 });
  }, []);

  const startGame = () => {
    setPlayerScore(0);
    setAiScore(0);
    setPlayerY(40);
    setAiY(40);
    setGameOver(false);
    setGameActive(true);
    setMessage('First to 11 wins');
    resetBall(Math.random() > 0.5 ? 'player' : 'ai');
  };

  useEffect(() => {
    if (!gameActive || gameOver) return;

    const interval = setInterval(() => {
      setBall((prev) => {
        let { x, y, dx, dy, speed } = prev;
        x += dx * speed;
        y += dy * speed;

        // Wall bounces (top/bottom)
        if (y <= 0) {
          y = 0;
          dy = Math.abs(dy);
        } else if (y >= FIELD_HEIGHT - BALL_SIZE) {
          y = FIELD_HEIGHT - BALL_SIZE;
          dy = -Math.abs(dy);
        }

        // Player paddle collision
        if (x <= PADDLE_WIDTH + 1 && y + BALL_SIZE >= playerY && y <= playerY + PADDLE_HEIGHT && dx < 0) {
          const hitPos = (y + BALL_SIZE / 2 - playerY) / PADDLE_HEIGHT; // 0..1
          dy = (hitPos - 0.5) * 2.2;
          dx = Math.abs(dx);
          speed = Math.min(speed + 0.08, 2.4);
          x = PADDLE_WIDTH + 1;
          cardSoundManager.playCardSlam();
        }

        // AI paddle collision
        if (x >= FIELD_WIDTH - PADDLE_WIDTH - 1 - BALL_SIZE && y + BALL_SIZE >= aiY && y <= aiY + PADDLE_HEIGHT && dx > 0) {
          const hitPos = (y + BALL_SIZE / 2 - aiY) / PADDLE_HEIGHT;
          dy = (hitPos - 0.5) * 2.2;
          dx = -Math.abs(dx);
          speed = Math.min(speed + 0.08, 2.4);
          x = FIELD_WIDTH - PADDLE_WIDTH - 1 - BALL_SIZE;
          cardSoundManager.playCardSlam();
        }

        // Player scores
        if (x >= FIELD_WIDTH) {
          setPlayerScore((s) => {
            const newScore = s + 1;
            if (newScore >= WIN_SCORE) {
              cardSoundManager.playWinSound();
              setParticleTrigger((p) => p + 1);
              setGameOver(true);
              setMessage('You win!');
            }
            return newScore;
          });
          resetBall('ai');
          return { ...prev, x: 50, y: 50, dx: -1, dy: (Math.random() * 1.4 - 0.7), speed: 1.2 };
        }

        // AI scores
        if (x <= 0) {
          setAiScore((s) => {
            const newScore = s + 1;
            if (newScore >= WIN_SCORE) {
              cardSoundManager.playLoseSound();
              setGameOver(true);
              setMessage('AI wins!');
            }
            return newScore;
          });
          resetBall('player');
          return { ...prev, x: 50, y: 50, dx: 1, dy: (Math.random() * 1.4 - 0.7), speed: 1.2 };
        }

        return { x, y, dx, dy, speed };
      });

      // AI follows ball with imperfect, clamped speed.
      setAiY((prev) => {
        const target = ball.y + BALL_SIZE / 2 - PADDLE_HEIGHT / 2;
        const diff = target - prev;
        const aiSpeed = 1.4;
        if (Math.abs(diff) < aiSpeed) return target;
        return Math.max(0, Math.min(FIELD_HEIGHT - PADDLE_HEIGHT, prev + (diff > 0 ? aiSpeed : -aiSpeed)));
      });
    }, 16);

    return () => clearInterval(interval);
  }, [gameActive, gameOver, playerY, aiY, ball.y, resetBall]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!gameActive || gameOver) return;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        setPlayerY((y) => Math.max(0, y - 8));
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        setPlayerY((y) => Math.min(FIELD_HEIGHT - PADDLE_HEIGHT, y + 8));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gameActive, gameOver]);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!gameActive || !fieldRef.current) return;
    const rect = fieldRef.current.getBoundingClientRect();
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPlayerY(Math.max(0, Math.min(FIELD_HEIGHT - PADDLE_HEIGHT, y - PADDLE_HEIGHT / 2)));
  };

  const status = gameOver
    ? message
    : !gameActive
    ? 'Press start, then move your paddle'
    : `${playerScore} — ${aiScore}`;

  return (
    <GameShell
      title="Ping Pong"
      emoji="🏓"
      subtitle="Move your paddle to win"
      bgGradient="from-indigo-900 via-purple-900 to-black"
      onBack={() => window.history.back()}
      onRestart={startGame}
      status={status}
      stats={[
        { label: 'You', value: playerScore, color: 'cyan' },
        { label: 'AI', value: aiScore, color: 'red' },
      ]}
      controls={
        <button
          onClick={startGame}
          className="w-full py-3 bg-gradient-to-r from-green-600 to-cyan-600 text-white font-bold rounded-xl border-2 border-green-400 hover:scale-105 transition-transform flex items-center justify-center gap-2"
        >
          {gameActive ? <RotateCcw className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          {gameActive ? 'Reset Game' : 'Start Game'}
        </button>
      }
      modal={
        gameOver && (
          <div className="bg-gradient-to-br from-purple-900 to-pink-900 rounded-3xl p-6 sm:p-8 border-4 border-yellow-400 text-center max-w-sm mx-auto">
            <div className="text-5xl sm:text-6xl mb-4">{playerScore > aiScore ? '🏆' : '💔'}</div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              {playerScore > aiScore ? 'You Win!' : 'AI Wins!'}
            </h2>
            <p className="text-2xl text-yellow-400 mb-6">Final: {playerScore} - {aiScore}</p>
            <button
              onClick={startGame}
              className="px-8 py-4 bg-gradient-to-r from-green-600 to-cyan-600 text-white font-bold text-xl rounded-xl hover:scale-105 transition-transform"
            >
              Play Again
            </button>
          </div>
        )
      }
    >
      <ParticleEffectsOverlay triggerSparkle={particleTrigger > 0 ? { x: 0, y: 0 } : null} />

      <div className="w-full max-w-3xl mx-auto">
        {!gameActive ? (
          <div className="text-center py-12">
            <button
              onClick={startGame}
              className="px-10 py-5 sm:px-12 sm:py-6 bg-gradient-to-r from-green-600 to-cyan-600 text-white font-bold text-xl rounded-xl border-2 border-green-400 hover:scale-105 transition-transform"
            >
              START GAME
            </button>
          </div>
        ) : (
          <div
            ref={fieldRef}
            onPointerMove={handlePointerMove}
            onTouchMove={(e) => {
              const touch = e.touches[0];
              if (!fieldRef.current) return;
              const rect = fieldRef.current.getBoundingClientRect();
              const y = ((touch.clientY - rect.top) / rect.height) * 100;
              setPlayerY(Math.max(0, Math.min(FIELD_HEIGHT - PADDLE_HEIGHT, y - PADDLE_HEIGHT / 2)));
            }}
            className="relative bg-gradient-to-br from-green-800 to-green-900 rounded-2xl border-4 border-white overflow-hidden h-[50vh] sm:h-[500px] max-h-[600px] touch-none"
          >
            <div
              className="absolute left-1/2 top-0 bottom-0 w-1 bg-white/30"
              style={{ transform: 'translateX(-50%)' }}
            />

            <div
              className="absolute left-2 w-2 sm:w-3 bg-blue-500 rounded"
              style={{ top: `${playerY}%`, height: `${PADDLE_HEIGHT}%` }}
            />

            <div
              className="absolute right-2 w-2 sm:w-3 bg-red-500 rounded"
              style={{ top: `${aiY}%`, height: `${PADDLE_HEIGHT}%` }}
            />

            <div
              className="absolute bg-white rounded-full"
              style={{
                left: `${ball.x}%`,
                top: `${ball.y}%`,
                width: `${BALL_SIZE}%`,
                height: `${BALL_SIZE}%`,
                transform: 'translate(-50%, -50%)',
              }}
            />
          </div>
        )}
      </div>
    </GameShell>
  );
}

import React, { useState, useEffect } from 'react';
import { RotateCcw, Play } from 'lucide-react';

import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';
import GameShell from '@/components/games/GameShell';

export default function PracticePingPong({ onMove, gameState }: { onMove?: any, gameState?: any }) {
  const [ballY, setBallY] = useState(50);
  const [ballX, setBallX] = useState(50);
  const [ballDirX, setBallDirX] = useState(1);
  const [ballDirY, setBallDirY] = useState(1);
  const [playerY, setPlayerY] = useState(40);
  const [aiY, setAiY] = useState(40);
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [gameActive, setGameActive] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [particleTrigger, setParticleTrigger] = useState(0);

  useEffect(() => {
    if (!gameActive || gameOver) return;

    const interval = setInterval(() => {
      setBallX((prev) => {
        let newX = prev + ballDirX * 2;

        // Player paddle collision
        if (newX <= 5 && ballY >= playerY && ballY <= playerY + 20) {
          cardSoundManager.playCardSlam();
          setBallDirX(1);
          return 5;
        }

        // AI paddle collision
        if (newX >= 95 && ballY >= aiY && ballY <= aiY + 20) {
          cardSoundManager.playCardSlam();
          setBallDirX(-1);
          return 95;
        }

        // Player scores
        if (newX >= 100) {
          setPlayerScore((s) => {
            const newScore = s + 1;
            if (newScore >= 11) {
              cardSoundManager.playWinSound();
              setParticleTrigger((p) => p + 1);
              setGameOver(true);
            }
            return newScore;
          });
          resetBall();
          return 50;
        }

        // AI scores
        if (newX <= 0) {
          setAiScore((s) => {
            const newScore = s + 1;
            if (newScore >= 11) {
              cardSoundManager.playLoseSound();
              setGameOver(true);
            }
            return newScore;
          });
          resetBall();
          return 50;
        }

        return newX;
      });

      setBallY((prev) => {
        let newY = prev + ballDirY * 2;
        if (newY <= 0 || newY >= 100) {
          setBallDirY((d) => -d);
        }
        return Math.max(0, Math.min(100, newY));
      });

      // AI follows ball
      setAiY((prev) => {
        const target = ballY - 10;
        if (Math.abs(prev - target) < 3) return prev;
        return prev + (target > prev ? 2 : -2);
      });
    }, 50);

    return () => clearInterval(interval);
  }, [gameActive, ballY, ballDirX, ballDirY, playerY, aiY, gameOver]);

  const resetBall = () => {
    setBallX(50);
    setBallY(50);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!gameActive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPlayerY(Math.max(0, Math.min(80, y)));
  };

  const startGame = () => {
    resetBall();
    setBallDirX(Math.random() > 0.5 ? 1 : -1);
    setBallDirY(Math.random() > 0.5 ? 1 : -1);
    setPlayerY(40);
    setAiY(40);
    setPlayerScore(0);
    setAiScore(0);
    setGameActive(true);
    setGameOver(false);
  };

  const status = gameOver
    ? playerScore > aiScore
      ? 'You win!'
      : 'AI wins!'
    : !gameActive
    ? 'Press start, then move your paddle'
    : 'First to 11 wins';

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
            onPointerMove={handlePointerMove}
            className="relative bg-gradient-to-br from-green-800 to-green-900 rounded-2xl border-4 border-white overflow-hidden cursor-none h-[50vh] sm:h-[500px] max-h-[600px]"
          >
            {/* Center line */}
            <div
              className="absolute left-1/2 top-0 bottom-0 w-1 bg-white/30"
              style={{ transform: 'translateX(-50%)' }}
            />

            {/* Player paddle */}
            <div
              className="absolute left-2 w-2 sm:w-3 bg-blue-500 rounded"
              style={{ top: `${playerY}%`, height: '20%' }}
            />

            {/* AI paddle */}
            <div
              className="absolute right-2 w-2 sm:w-3 bg-red-500 rounded"
              style={{ top: `${aiY}%`, height: '20%' }}
            />

            {/* Ball */}
            <div
              className="absolute w-3 h-3 sm:w-4 sm:h-4 bg-white rounded-full"
              style={{ left: `${ballX}%`, top: `${ballY}%`, transform: 'translate(-50%, -50%)' }}
            />
          </div>
        )}
      </div>
    </GameShell>
  );
}

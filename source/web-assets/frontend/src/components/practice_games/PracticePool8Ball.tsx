import React, { useState, useEffect } from 'react';
import { RotateCcw, Target, Crown } from 'lucide-react';
import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';
import GameShell from '@/components/games/GameShell';

const BALLS = [
  { num: 1, type: 'solid', color: '#facc15' },
  { num: 2, type: 'solid', color: '#2563eb' },
  { num: 3, type: 'solid', color: '#dc2626' },
  { num: 4, type: 'solid', color: '#9333ea' },
  { num: 5, type: 'solid', color: '#ea580c' },
  { num: 6, type: 'solid', color: '#16a34a' },
  { num: 7, type: 'solid', color: '#991b1b' },
  { num: 9, type: 'stripe', color: '#facc15' },
  { num: 10, type: 'stripe', color: '#2563eb' },
  { num: 11, type: 'stripe', color: '#dc2626' },
  { num: 12, type: 'stripe', color: '#9333ea' },
  { num: 13, type: 'stripe', color: '#ea580c' },
  { num: 14, type: 'stripe', color: '#16a34a' },
  { num: 15, type: 'stripe', color: '#991b1b' },
  { num: 8, type: '8ball', color: '#111827' },
];

const rackPositions: { x: number; y: number }[] = [
  { x: 0, y: 0 },
  { x: -18, y: 16 }, { x: 18, y: 16 },
  { x: -36, y: 32 }, { x: 0, y: 32 }, { x: 36, y: 32 },
  { x: -54, y: 48 }, { x: -18, y: 48 }, { x: 18, y: 48 }, { x: 54, y: 48 },
  { x: -72, y: 64 }, { x: -36, y: 64 }, { x: 0, y: 64 }, { x: 36, y: 64 }, { x: 72, y: 64 },
];

export default function PracticePool8Ball({ onMove, gameState }: { onMove?: any; gameState?: any }) {
  const [balls, setBalls] = useState(BALLS);
  const [playerType, setPlayerType] = useState<string | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [message, setMessage] = useState('Break to start!');
  const [gameOver, setGameOver] = useState(false);
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [particleTrigger, setParticleTrigger] = useState(0);
  const [shooting, setShooting] = useState(false);
  const [aiTurn, setAiTurn] = useState(false);

  useEffect(() => {
    if (aiTurn && !gameOver) {
      const timer = setTimeout(() => shoot(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [aiTurn, gameOver]);

  const shoot = (isAi = false) => {
    if (gameOver || balls.length === 0 || shooting) return;
    setShooting(true);
    cardSoundManager.playCardSlam();

    const hitBall = balls[Math.floor(Math.random() * balls.length)];
    const pocketed = Math.random() > 0.45;

    setTimeout(() => {
      if (!pocketed) {
        setMessage(currentPlayer === 1 ? 'Missed! AI is up' : 'AI missed! Your turn');
        setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
        setAiTurn(currentPlayer === 1);
        setShooting(false);
        return;
      }

      if (!playerType && hitBall.type !== '8ball') {
        const assigned = currentPlayer === 1 ? hitBall.type : (hitBall.type === 'solid' ? 'stripe' : 'solid');
        setPlayerType(assigned);
        setMessage(`Player ${currentPlayer === 1 ? '1' : '2'} is ${assigned === 'solid' ? 'solids' : 'stripes'}!`);
      }

      if (hitBall.num === 8) {
        const myGroup = currentPlayer === 1 ? playerType : (playerType ? (playerType === 'solid' ? 'stripe' : 'solid') : null);
        const myBallsCleared = !balls.some(
          (b) => b.type === myGroup && b.num !== 8,
        );

        if (myBallsCleared) {
          setGameOver(true);
          setMessage(currentPlayer === 1 ? 'You Win!' : 'AI Wins!');
          if (currentPlayer === 1) {
            setPlayerScore((s) => s + 1);
            cardSoundManager.playWinSound();
            setParticleTrigger((p) => p + 1);
          } else {
            setAiScore((s) => s + 1);
            cardSoundManager.playLoseSound();
          }
        } else {
          setGameOver(true);
          setMessage(currentPlayer === 1 ? 'Early 8-ball! AI Wins' : 'AI scratched the 8-ball! You Win');
          if (currentPlayer === 2) {
            setPlayerScore((s) => s + 1);
            cardSoundManager.playWinSound();
            setParticleTrigger((p) => p + 1);
          } else {
            setAiScore((s) => s + 1);
          }
        }
        setBalls([]);
        setShooting(false);
        return;
      }

      setBalls((prev) => prev.filter((b) => b.num !== hitBall.num));
      setMessage(`${currentPlayer === 1 ? 'You' : 'AI'} pocketed ${hitBall.num}! Go again`);
      if (currentPlayer === 2) {
        setAiTurn(true);
      }
      setShooting(false);
    }, isAi ? 0 : 300);
  };

  const resetGame = () => {
    setBalls(BALLS);
    setPlayerType(null);
    setCurrentPlayer(1);
    setMessage('Break to start!');
    setGameOver(false);
    setAiTurn(false);
    setShooting(false);
  };

  const ballPosition = (index: number) => rackPositions[index];

  return (
    <GameShell
      title="8-Ball Pool"
      emoji="🎱"
      subtitle={message}
      bgGradient="from-gray-900 via-blue-800 to-gray-900"
      onBack={() => window.history.back()}
      onRestart={resetGame}
      status={gameOver ? message : `Player ${currentPlayer === 1 ? 'You' : 'AI'}${playerType ? ` • ${playerType === 'solid' ? 'Solids' : 'Stripes'}` : ''}`}
      stats={[
        { label: 'You', value: playerScore, color: 'cyan' },
        { label: 'AI', value: aiScore, color: 'red' },
      ]}
      controls={
        <div className="flex gap-3">
          <button
            onClick={() => shoot(false)}
            disabled={currentPlayer !== 1 || gameOver || shooting || aiTurn}
            className="flex-1 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-black text-base rounded-xl border-2 border-cyan-400 hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Target className="w-5 h-5" />
            {shooting ? 'Shooting...' : 'SHOOT'}
          </button>
          <button
            onClick={resetGame}
            className="px-5 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl border-2 border-purple-400 hover:scale-[1.02] transition-transform flex items-center gap-2"
          >
            <RotateCcw className="w-5 h-5" />
            New Rack
          </button>
        </div>
      }
      modal={
        gameOver && (
          <div className="bg-gradient-to-br from-gray-900 to-blue-900 rounded-3xl p-6 sm:p-8 border-4 border-yellow-400 text-center max-w-sm mx-auto">
            <Crown className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">{message}</h2>
            <p className="text-2xl text-yellow-400 mb-6">{playerScore} - {aiScore}</p>
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

      <div className="w-full max-w-4xl mx-auto gv-view-pool" data-testid="pool-closer-top-view">
        <div className="gv-view-pool__plane relative bg-gradient-to-br from-green-800 to-green-950 rounded-3xl border-[8px] sm:border-[10px] border-yellow-900/80 shadow-2xl overflow-hidden min-h-[360px] sm:min-h-[460px] flex items-center justify-center">
          {/* Felt texture / markings */}
          <div className="absolute inset-4 border border-white/10 rounded-2xl" />
          <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-28 h-28 rounded-full border-2 border-white/10" />

          {/* Pockets */}
          <div className="absolute top-2 left-2 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-black border-2 border-gray-700" />
          <div className="absolute top-2 right-2 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-black border-2 border-gray-700" />
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-black border-2 border-gray-700" />
          <div className="absolute bottom-2 left-2 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-black border-2 border-gray-700" />
          <div className="absolute bottom-2 right-2 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-black border-2 border-gray-700" />
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-black border-2 border-gray-700" />

          {/* Rack — closer to camera via parent scale + larger balls */}
          {balls.length > 0 && (
            <div className="relative w-64 h-64 sm:w-96 sm:h-96">
              {balls.map((ball, i) => {
                const pos = ballPosition(i);
                const isStripe = ball.type === 'stripe';
                return (
                  <div
                    key={ball.num}
                    className="absolute w-8 h-8 sm:w-11 sm:h-11 rounded-full shadow-lg transition-all duration-300"
                    style={{
                      left: `calc(50% + ${pos.x * 1.15}px - 1rem)`,
                      top: `calc(48% + ${pos.y * 1.15}px - 1rem)`,
                      background: isStripe
                        ? `linear-gradient(to bottom, white 50%, ${ball.color} 50%)`
                        : ball.color,
                      border: isStripe ? `2px solid ${ball.color}` : '2px solid rgba(255,255,255,0.4)',
                    }}
                  >
                    <span className="absolute inset-0 flex items-center justify-center text-white font-black text-[10px] sm:text-xs drop-shadow-md">
                      {ball.num}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {balls.length === 0 && !gameOver && (
            <div className="text-green-300 text-2xl font-bold">Table cleared!</div>
          )}
        </div>
      </div>
    </GameShell>
  );
}

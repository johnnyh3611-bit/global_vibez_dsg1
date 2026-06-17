
import React, { useState } from 'react';
import { RotateCcw, Target } from 'lucide-react';

import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';
const BALLS = [
  { num: 1, type: 'solid', color: 'bg-yellow-400' },
  { num: 2, type: 'solid', color: 'bg-blue-600' },
  { num: 3, type: 'solid', color: 'bg-red-600' },
  { num: 4, type: 'solid', color: 'bg-purple-600' },
  { num: 5, type: 'solid', color: 'bg-orange-600' },
  { num: 6, type: 'solid', color: 'bg-green-600' },
  { num: 7, type: 'solid', color: 'bg-red-800' },
  { num: 9, type: 'stripe', color: 'bg-yellow-400' },
  { num: 10, type: 'stripe', color: 'bg-blue-600' },
  { num: 11, type: 'stripe', color: 'bg-red-600' },
  { num: 12, type: 'stripe', color: 'bg-purple-600' },
  { num: 13, type: 'stripe', color: 'bg-orange-600' },
  { num: 14, type: 'stripe', color: 'bg-green-600' },
  { num: 15, type: 'stripe', color: 'bg-red-800' },
  { num: 8, type: '8ball', color: 'bg-black' }
];

export default function PracticePool8Ball({ onMove, gameState }: { onMove?: any, gameState?: any }) {
  const [balls, setBalls] = useState(BALLS);
  const [playerType, setPlayerType] = useState(null);
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [message, setMessage] = useState('Break to start!');
  const [gameOver, setGameOver] = useState(false);
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [particleTrigger, setParticleTrigger] = useState(0);

  const shoot = () => {
    if (gameOver || balls.length === 0) return;

    cardSoundManager.playCardSlam();
    // Simulate shot
    const hitBall = balls[Math.floor(Math.random() * balls.length)];
    const pocketed = Math.random() > 0.4; // 60% success rate

    if (!pocketed) {
      setMessage(currentPlayer === 1 ? 'Missed! AI\'s turn' : 'AI missed! Your turn');
      setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
      if (currentPlayer === 1) {
        setTimeout(() => aiShoot(), 1500);
      }
      return;
    }

    // Ball pocketed
    if (!playerType && hitBall.type !== '8ball') {
      setPlayerType(currentPlayer === 1 ? hitBall.type : (hitBall.type === 'solid' ? 'stripe' : 'solid'));
      setMessage(`Player ${currentPlayer === 1 ? '1 is ' + hitBall.type + 's' : '2 is ' + (hitBall.type === 'solid' ? 'stripes' : 'solids')}!`);
    }

    if (hitBall.num === 8) {
      const myBallsCleared = currentPlayer === 1
        ? !balls.some(b => b.type === playerType && b.num !== 8)
        : !balls.some(b => b.type !== playerType && b.type !== '8ball' && b.num !== 8);
      
      if (myBallsCleared) {
        setGameOver(true);
        setMessage(currentPlayer === 1 ? 'You Win! 🏆' : 'AI Wins!');
        if (currentPlayer === 1) {
          setPlayerScore(prev => prev + 1);
          cardSoundManager.playWinSound();
          setParticleTrigger(prev => prev + 1);
        } else {
          setAiScore(prev => prev + 1);
          cardSoundManager.playLoseSound();
        }
      } else {
        setGameOver(true);
        setMessage(currentPlayer === 1 ? 'Early 8-ball! AI Wins!' : 'AI sank 8-ball early! You Win!');
        if (currentPlayer === 2) setPlayerScore(prev => prev + 1);
        else setAiScore(prev => prev + 1);
      }
      setBalls([]);
      return;
    }

    setBalls(balls.filter(b => b.num !== hitBall.num));
    setMessage(`${currentPlayer === 1 ? 'You' : 'AI'} pocketed ${hitBall.num}! Go again`);
    
    if (currentPlayer === 2) {
      setTimeout(() => aiShoot(), 1500);
    }
  };

  const aiShoot = () => {
    shoot();
  };

  const resetGame = () => {
    setBalls(BALLS);
    setPlayerType(null);
    setCurrentPlayer(1);
    setMessage('Break to start!');
    setGameOver(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-emerald-900 to-black p-4">
      {/* Particle Effects */}
      <ParticleEffectsOverlay triggerSparkle={particleTrigger > 0 ? { x: 0, y: 0 } : null} />
      
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-green-400 to-cyan-400 bg-clip-text text-transparent mb-2">
            🎱 8-BALL POOL
          </h1>
          <p className="text-green-300 text-xl">{message}</p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl p-4 border-2 border-blue-400">
            <div className="text-blue-100 text-sm">Your Wins</div>
            <div className="text-3xl font-bold text-white">{playerScore}</div>
          </div>
          <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl p-4 border-2 border-purple-400">
            <div className="text-purple-100 text-sm">Your Type</div>
            <div className="text-lg font-bold text-white">{playerType || '-'}</div>
          </div>
          <div className="bg-gradient-to-br from-red-600 to-orange-600 rounded-xl p-4 border-2 border-red-400">
            <div className="text-red-100 text-sm">AI Wins</div>
            <div className="text-3xl font-bold text-white">{aiScore}</div>
          </div>
        </div>

        {/* Pool Table */}
        <div className="bg-gradient-to-br from-green-700 to-green-900 rounded-3xl p-8 border-4 border-yellow-600 mb-6" style={{ minHeight: '400px' }}>
          <div className="grid grid-cols-5 gap-4">
            {balls.map(ball => (
              <div
                key={ball.num}
                className={`w-16 h-16 rounded-full ${
                  ball.type === 'stripe' 
                    ? `border-8 ${ball.color} bg-white` 
                    : ball.color
                } border-4 border-gray-300 flex items-center justify-center text-white font-bold text-xl shadow-xl`}
              >
                {ball.num}
              </div>
            ))}
          </div>
          
          {balls.length === 0 && !gameOver && (
            <div className="text-center text-green-300 text-2xl mt-20">Table cleared!</div>
          )}
        </div>

        {/* Controls */}
        <div className="flex gap-4">
          <button
            onClick={shoot}
            disabled={currentPlayer !== 1 || gameOver}
            className="flex-1 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold text-xl rounded-xl border-2 border-cyan-400 hover:scale-105 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Target className="w-6 h-6" />
            SHOOT
          </button>
          <button
            onClick={resetGame}
            className="flex-1 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-xl rounded-xl border-2 border-purple-400 hover:scale-105 transition-transform flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-6 h-6" />
            New Rack
          </button>
        </div>
      </div>
    </div>
  );
}
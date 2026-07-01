
import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';

import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';
export default function PracticeMancala({ onMove, gameState }: { onMove?: any, gameState?: any }) {
  const initialPits = [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0];
  const [pits, setPits] = useState(initialPits);
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [message, setMessage] = useState('Player 1: Choose a pit');
  const [gameOver, setGameOver] = useState(false);
  const [particleTrigger, setParticleTrigger] = useState(0);

  const move = (pitIndex) => {
    if (gameOver) return;
    if (currentPlayer === 1 && (pitIndex < 0 || pitIndex > 5 || pits[pitIndex] === 0)) return;
    if (currentPlayer === 2 && (pitIndex < 7 || pitIndex > 12 || pits[pitIndex] === 0)) return;

    cardSoundManager.playCardFlip();
    const newPits = [...pits];
    let stones = newPits[pitIndex];
    newPits[pitIndex] = 0;
    let currentPit = pitIndex;

    while (stones > 0) {
      currentPit = (currentPit + 1) % 14;
      
      // Skip opponent's store
      if (currentPlayer === 1 && currentPit === 13) continue;
      if (currentPlayer === 2 && currentPit === 6) continue;

      newPits[currentPit]++;
      stones--;
    }

    setPits(newPits);

    // Check for capture
    const isPlayerSide = currentPlayer === 1 ? currentPit >= 0 && currentPit <= 5 : currentPit >= 7 && currentPit <= 12;
    if (newPits[currentPit] === 1 && isPlayerSide) {
      const oppositePit = 12 - currentPit;
      if (newPits[oppositePit] > 0) {
        const store = currentPlayer === 1 ? 6 : 13;
        newPits[store] += newPits[oppositePit] + 1;
        newPits[currentPit] = 0;
        newPits[oppositePit] = 0;
        setPits(newPits);
      }
    }

    // Check if game over
    const p1Empty = newPits.slice(0, 6).every(p => p === 0);
    const p2Empty = newPits.slice(7, 13).every(p => p === 0);

    if (p1Empty || p2Empty) {
      const finalPits = [...newPits];
      finalPits[6] += finalPits.slice(0, 6).reduce((a, b) => a + b, 0);
      finalPits[13] += finalPits.slice(7, 13).reduce((a, b) => a + b, 0);
      for (let i = 0; i < 6; i++) finalPits[i] = 0;
      for (let i = 7; i < 13; i++) finalPits[i] = 0;
      setPits(finalPits);
      setGameOver(true);
      
      const p1Wins = finalPits[6] > finalPits[13];
      if (currentPlayer === 1 && p1Wins) {
        cardSoundManager.playWinSound();
        setParticleTrigger(prev => prev + 1);
      } else if (currentPlayer === 2 && !p1Wins) {
        cardSoundManager.playWinSound();
      } else {
        cardSoundManager.playLoseSound();
      }
      
      setMessage(finalPits[6] > finalPits[13] ? 'Player 1 Wins!' : finalPits[13] > finalPits[6] ? 'Player 2 Wins!' : 'Tie!');
      return;
    }

    // Extra turn if landed in store
    const landedInStore = (currentPlayer === 1 && currentPit === 6) || (currentPlayer === 2 && currentPit === 13);
    if (!landedInStore) {
      setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
      setMessage(currentPlayer === 1 ? 'Player 2: Choose a pit' : 'Player 1: Choose a pit');
    } else {
      setMessage(`Player ${currentPlayer}: Go again!`);
    }
  };

  const resetGame = () => {
    setPits(initialPits);
    setCurrentPlayer(1);
    setMessage('Player 1: Choose a pit');
    setGameOver(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-900 via-yellow-900 to-black p-4">
      {/* Particle Effects */}
      <ParticleEffectsOverlay triggerSparkle={particleTrigger > 0 ? { x: 0, y: 0 } : null} />
      
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-amber-400 to-yellow-400 bg-clip-text text-transparent mb-2">
            🪨 MANCALA
          </h1>
          <p className="text-yellow-300 text-xl">{message}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl p-4 border-2 border-blue-400">
            <div className="text-blue-100 text-sm">Player 1 Score</div>
            <div className="text-3xl font-bold text-white">{pits[6]}</div>
          </div>
          <div className="bg-gradient-to-br from-red-600 to-orange-600 rounded-xl p-4 border-2 border-red-400">
            <div className="text-red-100 text-sm">Player 2 Score</div>
            <div className="text-3xl font-bold text-white">{pits[13]}</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-800 to-amber-900 rounded-3xl p-6 border-4 border-yellow-600 mb-6">
          <div className="grid grid-cols-8 gap-2">
            {/* Player 2 Store */}
            <div className="row-span-2 flex items-center justify-center">
              <div className="w-full h-full bg-gradient-to-br from-red-700 to-orange-700 rounded-2xl border-4 border-red-500 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl font-bold text-white">{pits[13]}</div>
                  <div className="text-xs text-red-200">P2 Store</div>
                </div>
              </div>
            </div>

            {/* Player 2 Pits (reversed) */}
            {[12, 11, 10, 9, 8, 7].map(i => (
              <button
                key={`p2-pit-${i}`}
                onClick={() => move(i)}
                disabled={currentPlayer !== 2 || pits[i] === 0 || gameOver}
                className={`aspect-square rounded-xl text-2xl font-bold border-4 transition-all ${
                  currentPlayer === 2 && pits[i] > 0 && !gameOver
                    ? 'bg-gradient-to-br from-red-600 to-orange-600 border-red-400 hover:scale-110 cursor-pointer'
                    : 'bg-gradient-to-br from-gray-700 to-gray-800 border-gray-600 opacity-50'
                } disabled:cursor-not-allowed`}
              >
                <div className="text-white">{pits[i]}</div>
                <div className="text-xs text-gray-300">P2</div>
              </button>
            ))}

            {/* Empty cell for alignment */}
            <div></div>

            {/* Player 1 Pits */}
            {[0, 1, 2, 3, 4, 5].map(i => (
              <button
                key={`p1-pit-${i}`}
                onClick={() => move(i)}
                disabled={currentPlayer !== 1 || pits[i] === 0 || gameOver}
                className={`aspect-square rounded-xl text-2xl font-bold border-4 transition-all ${
                  currentPlayer === 1 && pits[i] > 0 && !gameOver
                    ? 'bg-gradient-to-br from-blue-600 to-cyan-600 border-blue-400 hover:scale-110 cursor-pointer'
                    : 'bg-gradient-to-br from-gray-700 to-gray-800 border-gray-600 opacity-50'
                } disabled:cursor-not-allowed`}
              >
                <div className="text-white">{pits[i]}</div>
                <div className="text-xs text-gray-300">P1</div>
              </button>
            ))}

            {/* Player 1 Store */}
            <div className="row-span-2 flex items-center justify-center">
              <div className="w-full h-full bg-gradient-to-br from-blue-700 to-cyan-700 rounded-2xl border-4 border-blue-500 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl font-bold text-white">{pits[6]}</div>
                  <div className="text-xs text-blue-200">P1 Store</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={resetGame}
          className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:scale-105 transition-transform flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-5 h-5" />
          New Game
        </button>
      </div>
    </div>
  );
}
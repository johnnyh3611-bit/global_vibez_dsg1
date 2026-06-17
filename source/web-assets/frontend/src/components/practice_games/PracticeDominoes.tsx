
import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';

import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';
const createDominoSet = () => {
  const dominoes = [];
  for (let i = 0; i <= 6; i++) {
    for (let j = i; j <= 6; j++) {
      dominoes.push({ left: i, right: j, id: `${i}-${j}` });
    }
  }
  return dominoes.sort(() => Math.random() - 0.5);
};

export default function PracticeDominoes({ onMove, gameState }: { onMove?: any, gameState?: any }) {
  const [playerHand, setPlayerHand] = useState([]);
  const [aiHand, setAiHand] = useState([]);
  const [chain, setChain] = useState([]);
  const [boneyard, setBoneyard] = useState([]);
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [message, setMessage] = useState('Draw dominoes to start!');
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [particleTrigger, setParticleTrigger] = useState(0);

  const startGame = () => {
    cardSoundManager.playCardShuffle();
    const dominoes = createDominoSet();
    setPlayerHand(dominoes.slice(0, 7));
    setAiHand(dominoes.slice(7, 14));
    setBoneyard(dominoes.slice(14));
    setChain([]);
    setCurrentPlayer(1);
    setMessage('Your turn! Play a domino');
    setGameStarted(true);
    setGameOver(false);
  };

  const canPlay = (domino) => {
    if (chain.length === 0) return true;
    const leftEnd = chain[0].left;
    const rightEnd = chain[chain.length - 1].right;
    return domino.left === leftEnd || domino.right === leftEnd || domino.left === rightEnd || domino.right === rightEnd;
  };

  const playDomino = (domino, fromAI = false) => {
    if (!gameStarted || gameOver) return;
    
    const hand = fromAI ? aiHand : playerHand;
    const setHand = fromAI ? setAiHand : setPlayerHand;

    if (!canPlay(domino)) {
      if (!fromAI) setMessage('Cannot play that domino!');
      return false;
    }

    let newDomino = { ...domino };
    if (chain.length > 0) {
      const leftEnd = chain[0].left;
      const rightEnd = chain[chain.length - 1].right;
      
      if (domino.right === leftEnd) {
        setChain([newDomino, ...chain]);
      } else if (domino.left === leftEnd) {
        newDomino = { left: domino.right, right: domino.left, id: domino.id };
        setChain([newDomino, ...chain]);
      } else if (domino.left === rightEnd) {
        setChain([...chain, newDomino]);
      } else if (domino.right === rightEnd) {
        newDomino = { left: domino.right, right: domino.left, id: domino.id };
        setChain([...chain, newDomino]);
      }
    } else {
      setChain([newDomino]);
    }

    setHand(hand.filter(d => d.id !== domino.id));

    if (hand.length === 1) {
      setGameOver(true);
      const playerWon = !fromAI;
      if (playerWon) {
        cardSoundManager.playWinSound();
        setParticleTrigger(prev => prev + 1);
      } else {
        cardSoundManager.playLoseSound();
      }
      setMessage(fromAI ? 'AI Wins!' : 'You Win! 🏆');
      return true;
    }

    cardSoundManager.playCardSlam();

    if (!fromAI) {
      setCurrentPlayer(2);
      setMessage('AI is thinking...');
      setTimeout(() => aiTurn(), 1000);
    } else {
      setCurrentPlayer(1);
      setMessage('Your turn!');
    }

    return true;
  };

  const aiTurn = () => {
    const playable = aiHand.find(d => canPlay(d));
    if (playable) {
      playDomino(playable, true);
    } else {
      setMessage('AI passed!');
      setCurrentPlayer(1);
      setTimeout(() => setMessage('Your turn!'), 1000);
    }
  };

  const DominoTile = ({ domino, onClick, disabled }: { domino: any; onClick?: any; disabled?: any }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center w-16 h-24 rounded-lg border-4 bg-white transition-all ${
        disabled ? 'opacity-50 cursor-not-allowed border-gray-400' : 'border-gray-800 hover:scale-110 cursor-pointer'
      }`}
    >
      <div className="text-2xl font-bold text-gray-900">{domino.left}</div>
      <div className="w-full h-0.5 bg-gray-800 my-1"></div>
      <div className="text-2xl font-bold text-gray-900">{domino.right}</div>
    </button>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-black p-4">
      {/* Particle Effects */}
      <ParticleEffectsOverlay triggerSparkle={particleTrigger > 0 ? { x: 0, y: 0 } : null} />
      
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-gray-300 to-white bg-clip-text text-transparent mb-2">
            🀄 DOMINOES
          </h1>
          <p className="text-gray-300 text-xl">{message}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl p-4 border-2 border-blue-400">
            <div className="text-blue-100 text-sm">Your Dominoes</div>
            <div className="text-3xl font-bold text-white">{playerHand.length}</div>
          </div>
          <div className="bg-gradient-to-br from-red-600 to-orange-600 rounded-xl p-4 border-2 border-red-400">
            <div className="text-red-100 text-sm">AI Dominoes</div>
            <div className="text-3xl font-bold text-white">{aiHand.length}</div>
          </div>
        </div>

        {!gameStarted ? (
          <div className="text-center">
            <button
              onClick={startGame}
              className="px-12 py-6 bg-gradient-to-r from-green-600 to-cyan-600 text-white font-bold text-2xl rounded-xl border-2 border-green-400 hover:scale-105 transition-transform"
            >
              START GAME
            </button>
          </div>
        ) : (
          <>
            {/* Chain */}
            <div className="bg-gradient-to-br from-green-800 to-green-900 rounded-2xl p-6 border-4 border-green-600 mb-6 min-h-32">
              <h3 className="text-xl font-bold text-green-200 mb-4">Domino Chain</h3>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {chain.length === 0 ? (
                  <p className="text-green-300">Play your first domino!</p>
                ) : (
                  chain.map((d, i) => (
                    <div key={`domino-${d.left}-${d.right}-${i}`} className="flex-shrink-0">
                      <DominoTile domino={d} disabled={true} />
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Player Hand */}
            <div className="bg-gradient-to-br from-blue-900 to-blue-950 rounded-2xl p-6 border-4 border-blue-600 mb-6">
              <h3 className="text-xl font-bold text-blue-200 mb-4">Your Dominoes</h3>
              <div className="flex gap-3 flex-wrap">
                {playerHand.map(d => (
                  <DominoTile
                    key={d.id}
                    domino={d}
                    onClick={() => playDomino(d)}
                    disabled={currentPlayer !== 1 || !canPlay(d)}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={startGame}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:scale-105 transition-transform flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              New Game
            </button>
          </>
        )}

        {gameOver && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gradient-to-br from-yellow-900 to-orange-900 rounded-3xl p-8 border-4 border-yellow-400 text-center max-w-md">
              <div className="text-6xl mb-4">{playerHand.length === 0 ? '🏆' : '💔'}</div>
              <h2 className="text-4xl font-bold text-white mb-4">{message}</h2>
              <button
                onClick={startGame}
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

import React, { useState } from 'react';
import { Users, RotateCcw } from 'lucide-react';

import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';
export default function PracticeTwoTruthsLie({ onMove, gameState }: { onMove?: any, gameState?: any }) {
  const [playerStatements, setPlayerStatements] = useState(['', '', '']);
  const [lieIndex, setLieIndex] = useState(null);
  const [aiStatements] = useState([
    'I have traveled to 15 countries',
    'I can speak 3 languages',
    'I have climbed Mount Everest'
  ]);
  const [aiLie] = useState(2);
  const [guessedAI, setGuessedAI] = useState(null);
  const [playerRevealed, setPlayerRevealed] = useState(false);
  const [score, setScore] = useState({ player: 0, ai: 0 });
  const [round, setRound] = useState(1);
  const [particleTrigger, setParticleTrigger] = useState(0);

  const handleGuess = (index) => {
    if (guessedAI !== null) return;
    setGuessedAI(index);
    
    if (index === aiLie) {
      cardSoundManager.playWinSound();
      setParticleTrigger(prev => prev + 1);
      setScore({ ...score, player: score.player + 1 });
    } else {
      cardSoundManager.playLoseSound();
      setScore({ ...score, ai: score.ai + 1 });
    }
  };

  const revealPlayerLie = () => {
    setPlayerRevealed(true);
  };

  const nextRound = () => {
    setPlayerStatements(['', '', '']);
    setLieIndex(null);
    setGuessedAI(null);
    setPlayerRevealed(false);
    setRound(round + 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-900 via-purple-900 to-black p-4">
      {/* Particle Effects */}
      <ParticleEffectsOverlay triggerSparkle={particleTrigger > 0 ? { x: 0, y: 0 } : null} />
      
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent mb-2">
            🎭 TWO TRUTHS & A LIE
          </h1>
          <p className="text-pink-300">Can you spot the lie?</p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl p-4 border-2 border-blue-400">
            <div className="text-blue-100 text-sm">Round</div>
            <div className="text-3xl font-bold text-white">{round}</div>
          </div>
          <div className="bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl p-4 border-2 border-green-400">
            <div className="text-green-100 text-sm">Your Score</div>
            <div className="text-3xl font-bold text-white">{score.player}</div>
          </div>
          <div className="bg-gradient-to-br from-red-600 to-orange-600 rounded-xl p-4 border-2 border-red-400">
            <div className="text-red-100 text-sm">AI Score</div>
            <div className="text-3xl font-bold text-white">{score.ai}</div>
          </div>
        </div>

        {/* AI's Statements */}
        <div className="bg-gradient-to-br from-purple-900 to-indigo-900 rounded-3xl p-8 border-4 border-purple-500 mb-6">
          <h2 className="text-2xl font-bold text-purple-200 mb-4 flex items-center gap-2">
            <Users className="w-6 h-6" />
            AI's Statements - Find the Lie!
          </h2>
          <div className="space-y-3">
            {aiStatements.map((statement, i) => (
              <button
                key={`ai-statement-${i}`}
                onClick={() => handleGuess(i)}
                disabled={guessedAI !== null}
                className={`w-full p-4 rounded-xl text-left font-semibold transition-all border-2 ${
                  guessedAI === null
                    ? 'bg-purple-700 border-purple-500 hover:bg-purple-600 hover:scale-102'
                    : guessedAI === i && i === aiLie
                    ? 'bg-green-600 border-green-400 scale-105'
                    : guessedAI === i && i !== aiLie
                    ? 'bg-red-600 border-red-400'
                    : i === aiLie
                    ? 'bg-yellow-600 border-yellow-400'
                    : 'bg-gray-700 border-gray-600'
                } text-white disabled:cursor-not-allowed`}
              >
                {statement}
                {guessedAI !== null && i === aiLie && ' 🚨 LIE!'}
                {guessedAI === i && i === aiLie && ' ✅ Correct!'}
                {guessedAI === i && i !== aiLie && ' ❌ Wrong!'}
              </button>
            ))}
          </div>
        </div>

        {/* Player Input */}
        <div className="bg-gradient-to-br from-pink-900 to-purple-900 rounded-3xl p-8 border-4 border-pink-500 mb-6">
          <h2 className="text-2xl font-bold text-pink-200 mb-4">Your Turn - Enter 2 Truths & 1 Lie</h2>
          <div className="space-y-3 mb-4">
            {[0, 1, 2].map(i => (
              <div key={`player-input-${i}`}>
                <input
                  type="text"
                  value={playerStatements[i]}
                  onChange={(e) => {
                    const newStatements = [...playerStatements];
                    newStatements[i] = e.target.value;
                    setPlayerStatements(newStatements);
                  }}
                  placeholder={`Statement ${i + 1}`}
                  className="w-full p-4 rounded-xl bg-purple-800 border-2 border-purple-600 text-white placeholder-purple-400 focus:border-pink-400 focus:outline-none"
                />
                <label className="flex items-center mt-2 text-pink-300">
                  <input
                    type="radio"
                    name="lie"
                    checked={lieIndex === i}
                    onChange={() => setLieIndex(i)}
                    className="mr-2"
                  />
                  This is the lie
                </label>
              </div>
            ))}
          </div>
          
          <button
            onClick={revealPlayerLie}
            disabled={playerRevealed || playerStatements.some(s => !s) || lieIndex === null}
            className="w-full py-3 bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold rounded-xl hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reveal My Lie
          </button>

          {playerRevealed && (
            <div className="mt-4 p-4 bg-yellow-900 border-2 border-yellow-600 rounded-xl">
              <p className="text-yellow-200 font-bold">Your lie was: "{playerStatements[lieIndex]}"</p>
            </div>
          )}
        </div>

        <button
          onClick={nextRound}
          disabled={!guessedAI || !playerRevealed}
          className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold rounded-xl hover:scale-105 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-5 h-5" />
          Next Round
        </button>
      </div>
    </div>
  );
}
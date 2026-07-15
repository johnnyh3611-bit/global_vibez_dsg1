import React, { useState } from 'react';
import { Flame, Heart, Zap, Trophy } from 'lucide-react';

export default function PracticeTruthOrDare({
  game,
  onMove,
  makingMove,
}: {
  game?: any;
  onMove?: (move: any) => void;
  makingMove?: boolean;
}) {
  const gameState = game?.game_state || {};
  const currentRound = gameState.current_round ?? 1;
  const maxRounds = gameState.max_rounds ?? 10;
  const playerScore = gameState.player_score ?? 0;
  const skipsRemaining = gameState.skips_remaining ?? 0;
  const currentChallenge = gameState.current_challenge;
  const challengeType = gameState.challenge_type;
  const isGameOver = game?.status === 'completed';

  const [choice, setChoice] = useState<'truth' | 'dare' | null>(null);

  const handleChoose = (type: 'truth' | 'dare') => {
    setChoice(type);
    if (onMove && !isGameOver && !makingMove) {
      onMove({ action: 'choose', choice: type });
    }
  };

  const handleComplete = (completed: boolean) => {
    if (onMove && !isGameOver && !makingMove) {
      onMove({ action: 'complete', completed });
    }
  };

  const handleSkip = () => {
    if (onMove && !isGameOver && !makingMove) {
      onMove({ action: 'skip' });
    }
  };

  if (isGameOver) {
    return (
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="bg-gradient-to-br from-pink-900 to-red-900 rounded-3xl p-8 border-4 border-pink-400 text-center max-w-2xl w-full">
          <div className="text-6xl mb-4"><Trophy className="w-20 h-20 text-pink-400 mx-auto" /></div>
          <h2 className="text-4xl font-bold text-white mb-4">Game Over</h2>
          <p className="text-3xl text-pink-400 mb-2">Final Score: {playerScore}</p>
          <p className="text-xl text-pink-300">Thanks for playing Truth or Dare</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-red-400 to-pink-400 bg-clip-text text-transparent mb-2">
            TRUTH OR DARE
          </h1>
          <p className="text-pink-300">Are you brave enough?</p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl p-4 border-2 border-purple-400">
            <div className="text-purple-100 text-sm">Score</div>
            <div className="text-3xl font-bold text-white">{playerScore}</div>
          </div>
          <div className="bg-gradient-to-br from-green-600 to-cyan-600 rounded-xl p-4 border-2 border-green-400">
            <div className="text-green-100 text-sm">Round</div>
            <div className="text-3xl font-bold text-white">{currentRound}/{maxRounds}</div>
          </div>
          <div className="bg-gradient-to-br from-red-600 to-orange-600 rounded-xl p-4 border-2 border-red-400">
            <div className="text-red-100 text-sm">Skips</div>
            <div className="text-3xl font-bold text-white">{skipsRemaining}</div>
          </div>
        </div>

        {!currentChallenge ? (
          <div className="bg-gradient-to-br from-blue-900 to-purple-900 rounded-3xl p-12 border-4 border-blue-500 text-center">
            <h2 className="text-4xl font-bold text-white mb-8">Choose Wisely</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button
                onClick={() => handleChoose('truth')}
                disabled={makingMove || isGameOver}
                className="py-12 bg-gradient-to-br from-blue-600 to-cyan-600 text-white font-bold text-3xl rounded-2xl border-4 border-blue-400 hover:scale-105 transition-transform shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="flex items-center justify-center gap-2">
                  <Heart className="w-8 h-8" /> TRUTH
                </span>
                <p className="text-sm mt-2 font-normal">+100 points</p>
              </button>

              <button
                onClick={() => handleChoose('dare')}
                disabled={makingMove || isGameOver}
                className="py-12 bg-gradient-to-br from-red-600 to-pink-600 text-white font-bold text-3xl rounded-2xl border-4 border-red-400 hover:scale-105 transition-transform shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="flex items-center justify-center gap-2">
                  <Flame className="w-8 h-8" /> DARE
                </span>
                <p className="text-sm mt-2 font-normal">+100 points</p>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-yellow-900 to-orange-900 rounded-3xl p-8 border-4 border-yellow-400">
            <div className="text-center mb-8">
              <div
                className={`inline-block px-6 py-3 rounded-full text-2xl font-bold mb-6 ${
                  challengeType === 'truth'
                    ? 'bg-blue-600 text-white'
                    : 'bg-red-600 text-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  {challengeType === 'truth' ? (
                    <><Heart className="w-6 h-6" /> TRUTH</>
                  ) : (
                    <><Flame className="w-6 h-6" /> DARE</>
                  )}
                </span>
              </div>

              <h2 className="text-3xl font-bold text-white mb-8">{currentChallenge}</h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleComplete(true)}
                disabled={makingMove || isGameOver}
                className="py-6 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold text-xl rounded-xl border-2 border-green-400 hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="flex items-center justify-center gap-2">
                  <Zap className="w-5 h-5" /> I Did It
                </span>
                <p className="text-sm mt-1 font-normal">+100 points</p>
              </button>

              <button
                onClick={handleSkip}
                disabled={makingMove || isGameOver || skipsRemaining <= 0}
                className="py-6 bg-gradient-to-r from-gray-600 to-gray-700 text-white font-bold text-xl rounded-xl border-2 border-gray-500 hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Skip
                <p className="text-sm mt-1 font-normal">{skipsRemaining} remaining</p>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

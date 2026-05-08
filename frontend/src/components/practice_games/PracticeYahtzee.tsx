
import React, { useState } from 'react';
import { Dices, RotateCcw, Lock, LockOpen } from 'lucide-react';

import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';
const CATEGORIES = [
  { name: 'Ones', calc: (dice) => dice.filter(d => d === 1).reduce((a, b) => a + b, 0) },
  { name: 'Twos', calc: (dice) => dice.filter(d => d === 2).reduce((a, b) => a + b, 0) },
  { name: 'Threes', calc: (dice) => dice.filter(d => d === 3).reduce((a, b) => a + b, 0) },
  { name: 'Fours', calc: (dice) => dice.filter(d => d === 4).reduce((a, b) => a + b, 0) },
  { name: 'Fives', calc: (dice) => dice.filter(d => d === 5).reduce((a, b) => a + b, 0) },
  { name: 'Sixes', calc: (dice) => dice.filter(d => d === 6).reduce((a, b) => a + b, 0) },
  { name: 'Three of a Kind', calc: (dice: number[]) => {
    const counts: Record<number, number> = {};
    dice.forEach(d => counts[d] = (counts[d] || 0) + 1);
    return (Object.values(counts) as number[]).some(c => c >= 3) ? dice.reduce((a, b) => a + b, 0) : 0;
  }},
  { name: 'Four of a Kind', calc: (dice: number[]) => {
    const counts: Record<number, number> = {};
    dice.forEach(d => counts[d] = (counts[d] || 0) + 1);
    return (Object.values(counts) as number[]).some(c => c >= 4) ? dice.reduce((a, b) => a + b, 0) : 0;
  }},
  { name: 'Full House', calc: (dice: number[]) => {
    const counts: Record<number, number> = {};
    dice.forEach(d => counts[d] = (counts[d] || 0) + 1);
    const vals = (Object.values(counts) as number[]).sort();
    return vals.length === 2 && vals[0] === 2 && vals[1] === 3 ? 25 : 0;
  }},
  { name: 'Small Straight', calc: (dice) => {
    const sorted = [...new Set(dice)].sort();
    const str = sorted.join('');
    return str.includes('1234') || str.includes('2345') || str.includes('3456') ? 30 : 0;
  }},
  { name: 'Large Straight', calc: (dice) => {
    const sorted = [...new Set(dice)].sort().join('');
    return sorted === '12345' || sorted === '23456' ? 40 : 0;
  }},
  { name: 'Yahtzee', calc: (dice) => dice.every(d => d === dice[0]) ? 50 : 0 },
  { name: 'Chance', calc: (dice) => dice.reduce((a, b) => a + b, 0) }
];

export default function PracticeYahtzee({ onMove, gameState }: { onMove?: any, gameState?: any }) {
  const [dice, setDice] = useState([1, 2, 3, 4, 5]);
  const [locked, setLocked] = useState([false, false, false, false, false]);
  const [rollsLeft, setRollsLeft] = useState(3);
  const [scores, setScores] = useState({});
  const [totalScore, setTotalScore] = useState(0);

  const rollDice = () => {
    if (rollsLeft === 0) return;
    setDice(prev => prev.map((d, i) => locked[i] ? d : Math.floor(Math.random() * 6) + 1));
    setRollsLeft(prev => prev - 1);
  };

  const toggleLock = (index) => {
    if (rollsLeft === 3) return;
    setLocked(prev => prev.map((l, i) => i === index ? !l : l));
  };

  const selectCategory = (category) => {
    if (scores[category.name] !== undefined || rollsLeft === 3) return;
    const score = category.calc(dice);
    setScores(prev => ({ ...prev, [category.name]: score }));
    setTotalScore(prev => prev + score);
    setRollsLeft(3);
    setLocked([false, false, false, false, false]);
  };

  const resetGame = () => {
    setDice([1, 2, 3, 4, 5]);
    setLocked([false, false, false, false, false]);
    setRollsLeft(3);
    setScores({});
    setTotalScore(0);
  };

  const isGameOver = Object.keys(scores).length === CATEGORIES.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-900 via-orange-900 to-black p-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent mb-2">
            🎲 YAHTZEE
          </h1>
          <p className="text-yellow-300">Roll the dice and score big!</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gradient-to-br from-yellow-600 to-orange-600 rounded-xl p-4 border-2 border-yellow-400">
            <div className="text-yellow-100 text-sm">Rolls Left</div>
            <div className="text-3xl font-bold text-white">{rollsLeft}</div>
          </div>
          <div className="bg-gradient-to-br from-green-600 to-cyan-600 rounded-xl p-4 border-2 border-green-400">
            <div className="text-green-100 text-sm">Total Score</div>
            <div className="text-3xl font-bold text-white">{totalScore}</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-gray-900 to-yellow-900 rounded-3xl p-6 border-4 border-yellow-600 mb-6">
          <div className="flex justify-center gap-4 mb-6">
            {dice.map((d, i) => (
              <button
                key={`dice-${i}`}
                onClick={() => toggleLock(i)}
                className={`w-20 h-20 rounded-xl text-4xl font-bold border-4 transition-all transform hover:scale-105 ${
                  locked[i] 
                    ? 'bg-gradient-to-br from-red-600 to-pink-600 border-red-400' 
                    : 'bg-white border-gray-300'
                }`}
              >
                {locked[i] && <Lock className="w-6 h-6 mx-auto mb-1 text-white" />}
                <div className={locked[i] ? 'text-white' : 'text-gray-900'}>{d}</div>
              </button>
            ))}
          </div>

          <button
            onClick={rollDice}
            disabled={rollsLeft === 0}
            className="w-full py-4 bg-gradient-to-r from-green-600 to-cyan-600 text-white font-bold text-xl rounded-xl border-2 border-green-400 hover:scale-105 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Dices className="w-6 h-6" />
            ROLL DICE ({rollsLeft} left)
          </button>
        </div>

        <div className="bg-black/50 rounded-2xl p-6 border-2 border-orange-600 mb-6">
          <h3 className="text-2xl font-bold text-orange-400 mb-4">Score Categories</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {CATEGORIES.map(cat => {
              const score = cat.calc(dice);
              const selected = scores[cat.name] !== undefined;
              return (
                <button
                  key={cat.name}
                  onClick={() => selectCategory(cat)}
                  disabled={selected || rollsLeft === 3}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    selected
                      ? 'bg-gradient-to-r from-green-600 to-cyan-600 border-green-400'
                      : score > 0
                      ? 'bg-gradient-to-r from-yellow-600 to-orange-600 border-yellow-400 hover:scale-105'
                      : 'bg-gray-800 border-gray-600 opacity-50'
                  } disabled:cursor-not-allowed`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white">{cat.name}</span>
                    <span className="text-2xl font-bold text-white">
                      {selected ? scores[cat.name] : score > 0 ? score : '-'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={resetGame}
          className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:scale-105 transition-transform flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-5 h-5" />
          New Game
        </button>

        {isGameOver && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gradient-to-br from-yellow-900 to-orange-900 rounded-3xl p-8 border-4 border-yellow-400 text-center max-w-md">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-4xl font-bold text-white mb-4">Game Complete!</h2>
              <p className="text-3xl text-yellow-400 mb-6">Final Score: {totalScore}</p>
              <button
                onClick={resetGame}
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

import React, { useState } from 'react';
import { Flame, RotateCcw } from 'lucide-react';

import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';
const TRUTHS = [
  'What\'s your biggest fear?',
  'Who was your first crush?',
  'What\'s your most embarrassing moment?',
  'What\'s a secret you\'ve never told anyone?',
  'What\'s your biggest regret?',
  'Who do you have a crush on right now?',
  'What\'s the worst lie you\'ve ever told?',
  'What\'s your guilty pleasure?'
];

const DARES = [
  'Do 20 pushups right now',
  'Send a text to your crush',
  'Post an embarrassing photo',
  'Sing your favorite song out loud',
  'Do your best dance move',
  'Call a friend and tell them a joke',
  'Do a handstand for 10 seconds',
  'Speak in an accent for the next 3 rounds'
];

export default function PracticeTruthOrDare({ onMove, gameState }: { onMove?: any, gameState?: any }) {
  const [currentPrompt, setCurrentPrompt] = useState(null);
  const [promptType, setPromptType] = useState(null);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [particleTrigger, setParticleTrigger] = useState(0);

  const selectTruth = () => {
    cardSoundManager.playCardFlip();
    const truth = TRUTHS[Math.floor(Math.random() * TRUTHS.length)];
    setCurrentPrompt(truth);
    setPromptType('truth');
  };

  const selectDare = () => {
    cardSoundManager.playCardFlip();
    const dare = DARES[Math.floor(Math.random() * DARES.length)];
    setCurrentPrompt(dare);
    setPromptType('dare');
  };

  const completeChallenge = () => {
    cardSoundManager.playWinSound();
    setParticleTrigger(prev => prev + 1);
    setScore(score + (promptType === 'dare' ? 20 : 10));
    setCompleted(completed + 1);
    setCurrentPrompt(null);
    setPromptType(null);
  };

  const skipChallenge = () => {
    setSkipped(skipped + 1);
    setCurrentPrompt(null);
    setPromptType(null);
  };

  const resetGame = () => {
    setCurrentPrompt(null);
    setPromptType(null);
    setScore(0);
    setCompleted(0);
    setSkipped(0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-900 via-pink-900 to-black p-4">
      {/* Particle Effects */}
      <ParticleEffectsOverlay triggerSparkle={particleTrigger > 0 ? { x: 0, y: 0 } : null} />
      
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-red-400 to-pink-400 bg-clip-text text-transparent mb-2">
            🔮 TRUTH OR DARE
          </h1>
          <p className="text-pink-300">Are you brave enough?</p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl p-4 border-2 border-purple-400">
            <div className="text-purple-100 text-sm">Score</div>
            <div className="text-3xl font-bold text-white">{score}</div>
          </div>
          <div className="bg-gradient-to-br from-green-600 to-cyan-600 rounded-xl p-4 border-2 border-green-400">
            <div className="text-green-100 text-sm">Completed</div>
            <div className="text-3xl font-bold text-white">{completed}</div>
          </div>
          <div className="bg-gradient-to-br from-red-600 to-orange-600 rounded-xl p-4 border-2 border-red-400">
            <div className="text-red-100 text-sm">Skipped</div>
            <div className="text-3xl font-bold text-white">{skipped}</div>
          </div>
        </div>

        {!currentPrompt ? (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-blue-900 to-purple-900 rounded-3xl p-12 border-4 border-blue-500 text-center">
              <h2 className="text-4xl font-bold text-white mb-8">Choose Wisely...</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <button
                  onClick={selectTruth}
                  className="py-12 bg-gradient-to-br from-blue-600 to-cyan-600 text-white font-bold text-3xl rounded-2xl border-4 border-blue-400 hover:scale-105 transition-transform shadow-2xl"
                >
                  🗣️ TRUTH
                  <p className="text-sm mt-2">+10 points</p>
                </button>
                
                <button
                  onClick={selectDare}
                  className="py-12 bg-gradient-to-br from-red-600 to-pink-600 text-white font-bold text-3xl rounded-2xl border-4 border-red-400 hover:scale-105 transition-transform shadow-2xl"
                >
                  🔥 DARE
                  <p className="text-sm mt-2">+20 points</p>
                </button>
              </div>
            </div>

            <button
              onClick={resetGame}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:scale-105 transition-transform flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              Reset Score
            </button>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-yellow-900 to-orange-900 rounded-3xl p-8 border-4 border-yellow-400">
            <div className="text-center mb-8">
              <div className={`inline-block px-6 py-3 rounded-full text-2xl font-bold mb-6 ${
                promptType === 'truth' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-red-600 text-white'
              }`}>
                {promptType === 'truth' ? '🗣️ TRUTH' : '🔥 DARE'}
              </div>
              
              <h2 className="text-3xl font-bold text-white mb-8">{currentPrompt}</h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={completeChallenge}
                className="py-6 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold text-xl rounded-xl border-2 border-green-400 hover:scale-105 transition-transform"
              >
                ✅ I Did It!
                <p className="text-sm mt-1">+{promptType === 'dare' ? 20 : 10} points</p>
              </button>
              
              <button
                onClick={skipChallenge}
                className="py-6 bg-gradient-to-r from-gray-600 to-gray-700 text-white font-bold text-xl rounded-xl border-2 border-gray-500 hover:scale-105 transition-transform"
              >
                🙅 Skip
                <p className="text-sm mt-1">No points</p>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
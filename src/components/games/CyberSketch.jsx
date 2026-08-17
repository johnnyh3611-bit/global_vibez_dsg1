import React, { useState } from 'react';
import { motion } from 'framer-motion';

const WORDS = ['CYBERPUNK', 'DIAMOND', 'SPACESHIP', 'NEON CITY', 'DSG TOKEN', 'ROULETTE'];

export default function CyberSketch() {
  const [currentWord, setCurrentWord] = useState(WORDS[0]);
  const [guess, setGuess] = useState('');
  const [status, setStatus] = useState('GUESS THE DRAWING IN CHAT!');

  const nextWord = () => {
    const next = WORDS[Math.floor(Math.random() * WORDS.length)];
    setCurrentWord(next);
    setGuess('');
    setStatus('NEW WORD LOADED — GUESS NOW!');
  };

  const handleGuessSubmit = (e) => {
    e.preventDefault();
    if (guess.trim().toUpperCase() === currentWord) {
      setStatus(`🎉 CORRECT! YOU GUESSED "${currentWord}"!`);
    } else {
      setStatus('❌ INCORRECT, KEEP GUESSING!');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-slate-950/90 backdrop-blur-2xl rounded-3xl border border-amber-500/20 shadow-2xl max-w-lg mx-auto text-white">
      <h2 className="text-xl font-black tracking-wider uppercase bg-gradient-to-r from-amber-400 to-rose-500 bg-clip-text text-transparent mb-1">
        Cyber Sketch
      </h2>
      <p className="text-xs text-white/50 mb-6">Live Social Drawing & Guessing Lounge</p>

      <div className="w-full h-40 bg-slate-900/90 border border-amber-500/30 rounded-2xl flex items-center justify-center mb-6 shadow-inner relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.1)_0,transparent_70%)]" />
        <span className="text-2xl font-black tracking-widest text-amber-300 animate-pulse">
          🎨 [ARTIST IS DRAWING...]
        </span>
      </div>

      <form onSubmit={handleGuessSubmit} className="w-full flex gap-2 mb-4">
        <input
          type="text"
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          placeholder="Type your guess..."
          className="flex-1 bg-slate-900 border border-white/20 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-amber-400 font-bold tracking-wider"
        />
        <button type="submit" className="px-5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider">
          Guess
        </button>
      </form>

      <div className="text-xs font-black uppercase tracking-wider text-amber-300 mb-6 h-6 flex items-center">
        {status}
      </div>

      <button onClick={nextWord} className="w-full py-3 bg-gradient-to-r from-amber-500 to-rose-600 text-slate-950 font-black rounded-xl text-sm uppercase tracking-wider shadow-lg">
        Next Round
      </button>
    </div>
  );
}

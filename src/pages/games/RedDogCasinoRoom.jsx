import React from 'react';
import RedDogCasino from '../../components/games/RedDogCasino';

export default function RedDogCasinoRoom() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="w-full max-w-xl mb-6 flex items-center justify-between px-4">
        <a href="/high-roller-casino" className="text-xs uppercase font-bold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1">← Back to Lounge</a>
        <span className="text-xs font-mono text-white/40 uppercase tracking-widest">Room #RED-DOG</span>
      </div>
      <RedDogCasino />
    </div>
  );
}

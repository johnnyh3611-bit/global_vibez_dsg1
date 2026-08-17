import React, { useState } from 'react';
import Vibe654Master from './Vibe654Master';
import VibeStreetCraps from './VibeStreetCraps';
import CyberBlackjack from './CyberBlackjack';
import NeonLightningRoulette from './NeonLightningRoulette';
import RedDogCasino from './RedDogCasino';

export default function CasinoLoungeHub() {
  const [activeTab, setActiveTab] = useState('vibe654');

  const tabs = [
    { id: 'vibe654', label: '🎲 Vibe 654 Pop', component: <Vibe654Master /> },
    { id: 'craps', label: '🎲 Street Craps', component: <VibeStreetCraps /> },
    { id: 'blackjack', label: '🃏 Cyber Blackjack', component: <CyberBlackjack /> },
    { id: 'roulette', label: '🎡 Lightning Roulette', component: <NeonLightningRoulette /> },
    { id: 'reddog', label: '🃏 Red Dog', component: <RedDogCasino /> },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center p-4">
      {/* Official Lounge Tab Navigation */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-8 bg-slate-900/80 p-2 rounded-2xl border border-white/10 backdrop-blur-xl shadow-xl">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-lg shadow-cyan-500/25 border border-cyan-400/30'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active Game Room View */}
      <div className="w-full transition-all duration-300">
        {tabs.find((t) => t.id === activeTab)?.component}
      </div>
    </div>
  );
}

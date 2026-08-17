import React, { useState } from 'react';
import NeoGridDrop from './NeoGridDrop';
import VibeLudo from './VibeLudo';
import NavalStrike from './NavalStrike';
import CyberSketch from './CyberSketch';

export default function SocialBoardHub() {
  const [activeTab, setActiveTab] = useState('grid');

  const tabs = [
    { id: 'grid', label: '🔴 Neo-Grid Drop', component: <NeoGridDrop /> },
    { id: 'ludo', label: '👑 Vibe Ludo', component: <VibeLudo /> },
    { id: 'naval', label: '⚓ Naval Strike', component: <NavalStrike /> },
    { id: 'sketch', label: '🎨 Cyber Sketch', component: <CyberSketch /> },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center p-4">
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

      <div className="w-full transition-all duration-300">
        {tabs.find((t) => t.id === activeTab)?.component}
      </div>
    </div>
  );
}

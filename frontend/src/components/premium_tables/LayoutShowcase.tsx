import React, { useState } from 'react';
import { 
  HexagonalTable, 
  CircularTable, 
  SplitScreenTable, 
  DiamondTable, 
  NeonGridTable 
} from './AlternativeLayouts';

export function LayoutShowcase() {
  const [layout, setLayout] = useState('hexagonal');
  const [theme, setTheme] = useState('purple');
  
  const mockPlayerHand = [
    { id: '1', suit: '♥️', rank: '5' },
    { id: '2', suit: '♦️', rank: '3' },
    { id: '3', suit: '♣️', rank: '7' },
    { id: '4', suit: '♠️', rank: '2' },
    { id: '5', suit: '♥️', rank: 'SKIP' },
    { id: '6', suit: '🎴', rank: 'WILD' },
  ];

  const layouts = [
    { key: 'hexagonal', name: 'A: Hexagonal Premium', component: HexagonalTable },
    { key: 'circular', name: 'B: Circular Rotating', component: CircularTable },
    { key: 'splitscreen', name: 'C: Split-Screen Modern', component: SplitScreenTable },
    { key: 'diamond', name: 'D: Diamond Elite', component: DiamondTable },
    { key: 'neongrid', name: 'E: Neon Grid Cyber', component: NeonGridTable },
  ];

  const themes = [
    { key: 'emerald', name: 'Green', color: 'bg-emerald-600' },
    { key: 'purple', name: 'Purple', color: 'bg-purple-600' },
    { key: 'blue', name: 'Blue', color: 'bg-blue-600' },
    { key: 'red', name: 'Red', color: 'bg-red-600' },
    { key: 'gold', name: 'Gold', color: 'bg-yellow-600' },
  ];

  const CurrentLayout = layouts.find(l => l.key === layout)?.component || HexagonalTable;

  return (
    <div className="relative w-full h-screen">
      {/* Layout Selector - Top */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 flex gap-2">
        {layouts.map((l) => (
          <button
            key={l.key}
            onClick={() => setLayout(l.key)}
            className={`px-4 py-2 rounded-lg font-bold text-sm ${
              layout === l.key
                ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            {l.name}
          </button>
        ))}
      </div>

      {/* Color Selector - Bottom */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50 flex gap-2">
        <span className="text-white font-bold mr-2 flex items-center">Color:</span>
        {themes.map((t) => (
          <button
            key={t.key}
            onClick={() => setTheme(t.key)}
            className={`w-12 h-12 rounded-full ${t.color} ${
              theme === t.key ? 'ring-4 ring-white scale-110' : ''
            } transition-all hover:scale-105`}
            title={t.name}
          />
        ))}
      </div>

      {/* Current Layout */}
      <CurrentLayout playerHand={mockPlayerHand} theme={theme} />
    </div>
  );
}

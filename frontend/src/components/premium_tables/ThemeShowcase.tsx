
import React, { useState } from 'react';
import { TopDownGameTable } from './TopDownGameTable';
import { ViewToggle } from './ViewToggle';

export function ThemeShowcase() {
  const [theme, setTheme] = useState('classic_green');
  
  const mockPlayerHand = [
    { id: '1', suit: '♥️', rank: '5' },
    { id: '2', suit: '♦️', rank: '3' },
    { id: '3', suit: '♣️', rank: '7' },
    { id: '4', suit: '♠️', rank: '2' },
    { id: '5', suit: '♥️', rank: 'SKIP' },
    { id: '6', suit: '🎴', rank: 'WILD' },
  ];

  const mockOpponents = [
    { position: 'top', cardCount: 5, name: 'Player 2', avatar: { emoji: '🤖' } },
    { position: 'left', cardCount: 4, name: 'Player 3', avatar: { emoji: '👾' } },
    { position: 'right', cardCount: 6, name: 'Player 4', avatar: { emoji: '🎮' } },
  ];

  const centerCards = [
    { rank: 'Q', suit: '♥️', rotation: 5 },
  ];

  const themes = [
    { key: 'classic_green', name: 'A: Classic Green Casino' },
    { key: 'luxury_purple', name: 'B: Luxury Purple Royal' },
    { key: 'modern_black', name: 'C: Modern Black Carbon' },
    { key: 'classic_red', name: 'D: Classic Red Poker Room' },
    { key: 'blue_ocean', name: 'E: Blue Ocean Premium' },
  ];

  return (
    <div className="relative w-full h-screen">
      {/* Theme Selector */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 flex gap-2">
        {themes.map((t) => (
          <button
            key={t.key}
            onClick={() => setTheme(t.key)}
            className={`px-6 py-3 rounded-xl font-bold ${
              theme === t.key
                ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>

      <TopDownGameTable
        playerHand={mockPlayerHand}
        playerAvatar={{ emoji: '😎' }}
        playerName="You"
        opponentPositions={mockOpponents}
        centerCards={centerCards}
        scoreInfo={{
          blue: 0,
          red: 0,
          text: `UNO • Theme: ${theme}`,
        }}
        theme={theme}
        onCardClick={() => {}}
      />
    </div>
  );
}

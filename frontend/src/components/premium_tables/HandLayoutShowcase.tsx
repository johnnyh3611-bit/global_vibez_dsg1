
import React from 'react';
import { AllInOneHandView } from './AllInOneHandView';

export function FinalHandShowcase() {
  const mockPlayerHand = [
    { id: '1', suit: '♥️', rank: '5' },
    { id: '2', suit: '♦️', rank: '3' },
    { id: '3', suit: '♣️', rank: '7' },
    { id: '4', suit: '♠️', rank: '2' },
    { id: '5', suit: '♥️', rank: 'K' },
    { id: '6', suit: '🎴', rank: 'WILD' },
  ];

  return (
    <AllInOneHandView
      playerHand={mockPlayerHand}
      opponentAvatar={{ emoji: '🤖', name: 'AI Vibez' }}
    />
  );
}


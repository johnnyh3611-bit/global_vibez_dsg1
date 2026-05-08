import React from 'react';
import { PlatformRouter } from './PlatformRouter';
import { PremiumTicTacToeTable } from './PremiumTicTacToeTable';

export function AdaptiveTicTacToeTable({ game, onMove, makingMove, aiThinking, theme = 'emerald' }: { game?: any, onMove?: any, makingMove?: any, aiThinking?: any, theme?: any }) {
  return (
    <PlatformRouter
      pcComponent={
        <PremiumTicTacToeTable 
          game={game}
          onMove={onMove}
          makingMove={makingMove}
          aiThinking={aiThinking}
          theme={theme}
        />
      }
      mobileComponent={
        <PremiumTicTacToeTable 
          game={game}
          onMove={onMove}
          makingMove={makingMove}
          aiThinking={aiThinking}
          theme={theme}
        />
      }
    />
  );
}

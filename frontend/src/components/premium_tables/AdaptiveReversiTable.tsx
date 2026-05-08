import React from 'react';
import { PlatformRouter } from './PlatformRouter';
import { PremiumReversiTable } from './PremiumReversiTable';

export function AdaptiveReversiTable({ game, onMove, makingMove, aiThinking, theme = 'royal' }: { game?: any, onMove?: any, makingMove?: any, aiThinking?: any, theme?: any }) {
  return (
    <PlatformRouter
      pcComponent={
        <PremiumReversiTable 
          game={game}
          onMove={onMove}
          makingMove={makingMove}
          aiThinking={aiThinking}
          theme={theme}
        />
      }
      mobileComponent={
        <PremiumReversiTable 
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

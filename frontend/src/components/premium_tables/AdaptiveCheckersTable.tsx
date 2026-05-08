import React from 'react';
import { PlatformRouter } from './PlatformRouter';
import { PremiumCheckersTable } from './PremiumCheckersTable';

export function AdaptiveCheckersTable({ game, onMove, makingMove, aiThinking, theme = 'midnight' }: { game?: any, onMove?: any, makingMove?: any, aiThinking?: any, theme?: any }) {
  return (
    <PlatformRouter
      pcComponent={
        <PremiumCheckersTable 
          game={game}
          onMove={onMove}
          makingMove={makingMove}
          aiThinking={aiThinking}
          theme={theme}
        />
      }
      mobileComponent={
        <PremiumCheckersTable 
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

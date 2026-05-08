import React from 'react';
import { PlatformRouter } from './PlatformRouter';
import { PremiumConnect4Table } from './PremiumConnect4Table';

export function AdaptiveConnect4Table({ game, onMove, makingMove, aiThinking, theme = 'rose' }: { game?: any, onMove?: any, makingMove?: any, aiThinking?: any, theme?: any }) {
  return (
    <PlatformRouter
      pcComponent={
        <PremiumConnect4Table 
          game={game}
          onMove={onMove}
          makingMove={makingMove}
          aiThinking={aiThinking}
          theme={theme}
        />
      }
      mobileComponent={
        <PremiumConnect4Table 
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

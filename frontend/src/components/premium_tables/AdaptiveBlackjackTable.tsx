import React from 'react';
import { PlatformRouter } from './PlatformRouter';
import { PremiumBlackjackTable } from './PremiumBlackjackTable';
import { PremiumBlackjackTableMobile } from './PremiumBlackjackTableMobile';

export function AdaptiveBlackjackTable({ game, onMove, makingMove, aiThinking, theme = 'rose' }: { game?: any, onMove?: any, makingMove?: any, aiThinking?: any, theme?: any }) {
  return (
    <PlatformRouter
      pcComponent={
        <PremiumBlackjackTable 
          game={game}
          onMove={onMove}
          makingMove={makingMove}
          aiThinking={aiThinking}
          theme={theme}
        />
      }
      mobileComponent={
        <PremiumBlackjackTableMobile 
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

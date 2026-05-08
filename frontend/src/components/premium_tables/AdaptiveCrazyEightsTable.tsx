import React, { useState } from 'react';
import { PlatformRouter } from './PlatformRouter';
import { PremiumCrazyEightsTable } from './PremiumCrazyEightsTable';
import { PremiumPokerTableMobile } from './PremiumPokerTableMobile'; // Reuse for now, will create specific later

export function AdaptiveCrazyEightsTable({ game, onMove, makingMove, aiThinking, theme = 'midnight' }: { game?: any, onMove?: any, makingMove?: any, aiThinking?: any, theme?: any }) {
  return (
    <PlatformRouter
      pcComponent={
        <PremiumCrazyEightsTable 
          game={game}
          onMove={onMove}
          makingMove={makingMove}
          aiThinking={aiThinking}
          theme={theme}
        />
      }
      mobileComponent={
        <PremiumPokerTableMobile 
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

import React from 'react';
import { PlatformRouter } from './PlatformRouter';
import { PremiumHeartsTable } from './PremiumHeartsTable';

export function AdaptiveHeartsTable({ game, onMove, makingMove, aiThinking, theme = 'rose' }: { game?: any, onMove?: any, makingMove?: any, aiThinking?: any, theme?: any }) {
  return (
    <PlatformRouter
      pcComponent={<PremiumHeartsTable game={game} onMove={onMove} makingMove={makingMove} aiThinking={aiThinking} theme={theme} />}
      mobileComponent={<PremiumHeartsTable game={game} onMove={onMove} makingMove={makingMove} aiThinking={aiThinking} theme={theme} />}
    />
  );
}

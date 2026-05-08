import React from 'react';
import { PlatformRouter } from './PlatformRouter';
import { PremiumChessTable } from './PremiumChessTable';

export function AdaptiveChessTable({ game, onMove, makingMove, aiThinking, theme = 'emerald' }: { game?: any, onMove?: any, makingMove?: any, aiThinking?: any, theme?: any }) {
  return (
    <PlatformRouter
      pcComponent={<PremiumChessTable game={game} onMove={onMove} makingMove={makingMove} aiThinking={aiThinking} theme={theme} />}
      mobileComponent={<PremiumChessTable game={game} onMove={onMove} makingMove={makingMove} aiThinking={aiThinking} theme={theme} />}
    />
  );
}

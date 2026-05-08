import React, { useState } from 'react';
import { PlatformRouter, PlatformToggle } from './PlatformRouter';
import { PremiumPokerTable } from './PremiumPokerTable'; // PC Version
import { PremiumPokerTableMobile } from './PremiumPokerTableMobile'; // Mobile Version

/**
 * ADAPTIVE POKER TABLE
 * Automatically renders PC or Mobile version based on device
 * Includes manual toggle for testing
 */
export function AdaptivePokerTable({ game, onMove, makingMove, aiThinking, theme = 'emerald' }: { game?: any, onMove?: any, makingMove?: any, aiThinking?: any, theme?: any }) {
  const [forceMode, setForceMode] = useState(null);

  return (
    <>
      {/* Platform Toggle (for testing) - Remove in production */}
      <PlatformToggle currentMode={forceMode || 'auto'} onModeChange={setForceMode} />

      {/* Platform Router - Auto-selects PC or Mobile */}
      <PlatformRouter
        pcComponent={
          <PremiumPokerTable 
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
        forceMode={forceMode}
      />
    </>
  );
}

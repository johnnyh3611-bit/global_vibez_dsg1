
import React from 'react';
import { PlatformRouter } from './PlatformRouter';
import { PremiumGoFishTable } from './PremiumGoFishTable';
import { PremiumGoFishTableMobile } from './PremiumGoFishTableMobile';

export function AdaptiveGoFishTable({ onBack, theme = 'neon' }: { onBack?: any, theme?: any }) {
  return (
    <PlatformRouter
      pcComponent={
        <PremiumGoFishTable onBack={onBack} theme={theme} />
      }
      mobileComponent={
        <PremiumGoFishTableMobile onBack={onBack} theme={theme} />
      }
    />
  );
}

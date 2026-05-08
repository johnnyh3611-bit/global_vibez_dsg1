import React from 'react';
import { PortraitBlocker } from './RotationPrompt';
import { PremiumGoFishTable } from './PremiumGoFishTable';

export function PremiumGoFishTableMobile({ onBack }: { onBack?: any; theme?: any }) {
  return (
    <PortraitBlocker gameName="Go Fish" allowPortrait={false}>
      <PremiumGoFishTable onBack={onBack} />
    </PortraitBlocker>
  );
}

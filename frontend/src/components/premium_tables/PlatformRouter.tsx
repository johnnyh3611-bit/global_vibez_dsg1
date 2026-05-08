import React from 'react';
import { usePlatform } from './platformDetection';

/**
 * Platform Router Component
 * Renders PC or Mobile version of a game based on device
 * 
 * Usage:
 * <PlatformRouter
 *   pcComponent={<PokerTablePC {...props} />}
 *   mobileComponent={<PokerTableMobile {...props} />}
 *   tabletComponent={<PokerTableTablet {...props} />} // optional
 * />
 */
export function PlatformRouter({
  pcComponent,
  mobileComponent,
  tabletComponent = null,
  forceMode = null, // 'pc', 'mobile', 'tablet' - for testing
}: {
  pcComponent?: any;
  mobileComponent?: any;
  tabletComponent?: any;
  forceMode?: string | null;
}) {
  const platform = usePlatform();
  
  // Force mode for testing (can be set via URL param or localStorage)
  const activeMode = forceMode || platform.type;

  // Render based on platform
  if (activeMode === 'mobile') {
    return mobileComponent;
  } else if (activeMode === 'tablet') {
    // If tablet component provided, use it, otherwise use mobile
    return tabletComponent || mobileComponent;
  } else {
    return pcComponent;
  }
}

/**
 * Platform Toggle Component (for testing/debugging)
 * Allows users to manually switch between PC and Mobile views
 */
export function PlatformToggle({ currentMode, onModeChange }: { currentMode?: any, onModeChange?: any }) {
  return (
    <div className="fixed top-4 right-4 z-50 bg-black/80 backdrop-blur-xl border-2 border-white/20 rounded-xl p-3">
      <p className="text-white text-xs mb-2 font-bold">View Mode:</p>
      <div className="flex gap-2">
        {['pc', 'tablet', 'mobile'].map((mode) => (
          <button
            key={mode}
            onClick={() => onModeChange(mode)}
            className={`px-4 py-2 rounded-lg font-bold text-xs ${
              currentMode === mode
                ? 'bg-pink-500 text-white'
                : 'bg-white/10 text-white/60 hover:bg-white/20'
            }`}
          >
            {mode === 'pc' ? '💻 PC' : mode === 'tablet' ? '📱 Tablet' : '📱 Mobile'}
          </button>
        ))}
      </div>
    </div>
  );
}

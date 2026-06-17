import { useState, useEffect } from 'react';

// Responsive viewport hook with orientation detection
export function useResponsiveGameLayout() {
  const [layout, setLayout] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight : 1080,
    isPortrait: false,
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    scale: 1,
    cardSize: 'lg',
  });

  useEffect(() => {
    const updateLayout = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isPortrait = height > width;
      const isMobile = width < 768;
      const isTablet = width >= 768 && width < 1024;
      const isDesktop = width >= 1024;

      // Calculate scale factor
      let scale = 1;
      if (isMobile) {
        scale = isPortrait ? 0.5 : 0.7;
      } else if (isTablet) {
        scale = isPortrait ? 0.7 : 0.85;
      }

      // Card size based on device
      let cardSize = 'lg';
      if (isMobile) {
        cardSize = 'sm';
      } else if (isTablet) {
        cardSize = 'md';
      }

      setLayout({
        width,
        height,
        isPortrait,
        isMobile,
        isTablet,
        isDesktop,
        scale,
        cardSize,
      });
    };

    updateLayout();
    window.addEventListener('resize', updateLayout);
    window.addEventListener('orientationchange', updateLayout);

    return () => {
      window.removeEventListener('resize', updateLayout);
      window.removeEventListener('orientationchange', updateLayout);
    };
  }, []);

  return layout;
}

// Get responsive card positions for poker-style games
export function getPokerCardPositions(layout, handSize) {
  const { width, height, isPortrait, isMobile, scale } = layout;

  if (isPortrait) {
    // Portrait: cards closer, smaller spread
    const spread = Math.min(handSize * 30, width * 0.6);
    return {
      player: { 
        baseY: height * 0.4, // Higher up in portrait
        spread,
        z: 80,
        rotation: { x: -15, y: 0 },
      },
      community: {
        baseY: -height * 0.15,
        spread: Math.min(5 * 40, width * 0.5),
        z: 10,
      },
      pot: {
        y: -height * 0.05,
        z: 60,
      },
      opponents: {
        top: { baseY: -height * 0.45, z: 20 },
        left: { baseX: -width * 0.35, baseY: -height * 0.1, z: 20 },
        right: { baseX: width * 0.35, baseY: -height * 0.1, z: 20 },
      },
    };
  } else {
    // Landscape: normal spread
    const spread = Math.min(handSize * (isMobile ? 35 : 50), width * 0.7);
    return {
      player: { 
        baseY: height * 0.35,
        spread,
        z: 100,
        rotation: { x: -20, y: 0 },
      },
      community: {
        baseY: -height * 0.08,
        spread: Math.min(5 * 60, width * 0.4),
        z: 10,
      },
      pot: {
        y: 0,
        z: 80,
      },
      opponents: {
        top: { baseY: -height * 0.4, z: 30 },
        left: { baseX: -width * 0.4, baseY: 0, z: 30 },
        right: { baseX: width * 0.4, baseY: 0, z: 30 },
      },
    };
  }
}

// Get responsive table scale
export function getTableScale(layout) {
  const { width, height, isPortrait, isMobile, isTablet } = layout;

  if (isMobile) {
    return isPortrait 
      ? { width: width * 1.2, height: height * 0.9 }
      : { width: width * 1.1, height: height * 1.0 };
  } else if (isTablet) {
    return isPortrait
      ? { width: 900, height: 700 }
      : { width: 1100, height: 750 };
  } else {
    return { width: 1200, height: 800 };
  }
}

// Card size mapping
export const CARD_SIZES = {
  sm: { width: 60, height: 90 },
  md: { width: 90, height: 135 },
  lg: { width: 120, height: 180 },
};

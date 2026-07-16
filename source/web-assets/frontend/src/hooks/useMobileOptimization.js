// Mobile Optimization Hook
import { useState, useEffect } from 'react';

export function useMobileDetection() {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [orientation, setOrientation] = useState('portrait');

  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      setIsMobile(width < 768);
      setIsTablet(width >= 768 && width < 1024);
      setOrientation(height > width ? 'portrait' : 'landscape');
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    window.addEventListener('orientationchange', checkDevice);

    return () => {
      window.removeEventListener('resize', checkDevice);
      window.removeEventListener('orientationchange', checkDevice);
    };
  }, []);

  return { isMobile, isTablet, orientation, isDesktop: !isMobile && !isTablet };
}

// Prefer `@/hooks/useGestures` for new code. Kept for existing imports.
export { useSwipeGestures as useTouchGestures, useHapticFeedback } from './useGestures';

// Responsive board size calculator
export function useResponsiveBoardSize(baseSize = 600) {
  const [boardSize, setBoardSize] = useState(baseSize);
  const { isMobile, isTablet } = useMobileDetection();

  useEffect(() => {
    const calculateSize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const availableSize = Math.min(width * 0.9, height * 0.7);

      if (isMobile) {
        setBoardSize(Math.min(availableSize, 400));
      } else if (isTablet) {
        setBoardSize(Math.min(availableSize, 500));
      } else {
        setBoardSize(Math.min(availableSize, baseSize));
      }
    };

    calculateSize();
    window.addEventListener('resize', calculateSize);
    return () => window.removeEventListener('resize', calculateSize);
  }, [isMobile, isTablet, baseSize]);

  return boardSize;
}

// Mobile-friendly button sizes
export const mobileButtonClasses = {
  small: 'min-h-[44px] min-w-[44px] text-sm px-3',
  medium: 'min-h-[48px] min-w-[48px] text-base px-4',
  large: 'min-h-[56px] min-w-[56px] text-lg px-6'
};

// Prevent zoom on double tap (iOS)
// This should be used within a React component
export function usePreventMobileZoom() {
  useEffect(() => {
    let lastTouchEnd = 0;
    
    const preventZoom = (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    };

    document.addEventListener('touchend', preventZoom, { passive: false });
    
    return () => {
      document.removeEventListener('touchend', preventZoom);
    };
  }, []);
}


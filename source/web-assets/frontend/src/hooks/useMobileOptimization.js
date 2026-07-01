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

// Touch gestures hook for mobile games
export function useTouchGestures(callbacks = {}) {
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
      time: Date.now()
    });
  };

  const onTouchMove = (e) => {
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    });
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    const isLeftSwipe = distanceX > minSwipeDistance;
    const isRightSwipe = distanceX < -minSwipeDistance;
    const isUpSwipe = distanceY > minSwipeDistance;
    const isDownSwipe = distanceY < -minSwipeDistance;

    const duration = Date.now() - touchStart.time;
    const isTap = duration < 200 && Math.abs(distanceX) < 10 && Math.abs(distanceY) < 10;

    if (isTap && callbacks.onTap) {
      callbacks.onTap({ x: touchStart.x, y: touchStart.y });
    } else if (isLeftSwipe && callbacks.onSwipeLeft) {
      callbacks.onSwipeLeft();
    } else if (isRightSwipe && callbacks.onSwipeRight) {
      callbacks.onSwipeRight();
    } else if (isUpSwipe && callbacks.onSwipeUp) {
      callbacks.onSwipeUp();
    } else if (isDownSwipe && callbacks.onSwipeDown) {
      callbacks.onSwipeDown();
    }
  };

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd
  };
}

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

// Haptic feedback for mobile
export function useHapticFeedback() {
  const vibrate = (pattern = 50) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  };

  return {
    light: () => vibrate(10),
    medium: () => vibrate(20),
    heavy: () => vibrate(50),
    success: () => vibrate([50, 100, 50]),
    error: () => vibrate([100, 50, 100]),
    pattern: (pattern) => vibrate(pattern)
  };
}

import { useState, useEffect } from 'react';

/**
 * Platform Detection Hook
 * Determines if user is on PC, Tablet, or Mobile
 * Returns platform type and device capabilities
 */
export function usePlatform() {
  const [platform, setPlatform] = useState({
    type: 'desktop', // 'desktop', 'tablet', 'mobile'
    isTouchDevice: false,
    screenWidth: 1920,
    screenHeight: 1080,
    orientation: 'landscape', // 'portrait' or 'landscape'
    devicePixelRatio: 1,
  });

  useEffect(() => {
    const detectPlatform = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const orientation = height > width ? 'portrait' : 'landscape';
      const dpr = window.devicePixelRatio || 1;

      // Platform detection logic
      let type = 'desktop';
      if (width < 768) {
        type = 'mobile';
      } else if (width >= 768 && width < 1024) {
        type = 'tablet';
      } else if (isTouch && width < 1280) {
        // Touch-enabled laptops in tablet mode
        type = 'tablet';
      }

      // Additional checks for specific devices
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileDevice = /iphone|ipod|android|blackberry|windows phone|opera mini|iemobile/i.test(userAgent);
      const isTabletDevice = /ipad|android(?!.*mobile)|tablet/i.test(userAgent);
      
      if (isMobileDevice) type = 'mobile';
      if (isTabletDevice) type = 'tablet';

      setPlatform({
        type,
        isTouchDevice: isTouch,
        screenWidth: width,
        screenHeight: height,
        orientation,
        devicePixelRatio: dpr,
      });
    };

    detectPlatform();
    
    window.addEventListener('resize', detectPlatform);
    window.addEventListener('orientationchange', detectPlatform);

    return () => {
      window.removeEventListener('resize', detectPlatform);
      window.removeEventListener('orientationchange', detectPlatform);
    };
  }, []);

  return platform;
}

/**
 * Check if current platform is mobile
 */
export function isMobilePlatform() {
  if (typeof window === 'undefined') return false;
  const width = window.innerWidth;
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobileDevice = /iphone|ipod|android|blackberry|windows phone/i.test(userAgent);
  return width < 768 || isMobileDevice;
}

/**
 * Check if current platform is tablet
 */
export function isTabletPlatform() {
  if (typeof window === 'undefined') return false;
  const width = window.innerWidth;
  const userAgent = navigator.userAgent.toLowerCase();
  const isTabletDevice = /ipad|android(?!.*mobile)|tablet/i.test(userAgent);
  return (width >= 768 && width < 1024) || isTabletDevice;
}

/**
 * Check if current platform is desktop
 */
export function isDesktopPlatform() {
  if (typeof window === 'undefined') return true;
  return !isMobilePlatform() && !isTabletPlatform();
}

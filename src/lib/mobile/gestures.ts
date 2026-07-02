"use client";

import { useEffect, useRef } from "react";

interface GestureConfig {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number; // minimum px to trigger swipe
}

const DEFAULT_THRESHOLD = 50;

export function useSwipeGesture(config: GestureConfig) {
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;

      const diffX = touchStartX.current - touchEndX;
      const diffY = touchStartY.current - touchEndY;

      const threshold = config.threshold || DEFAULT_THRESHOLD;

      // Horizontal swipes
      if (Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX > threshold && config.onSwipeLeft) {
          config.onSwipeLeft();
          triggerHaptic("medium");
        } else if (diffX < -threshold && config.onSwipeRight) {
          config.onSwipeRight();
          triggerHaptic("medium");
        }
      }
      // Vertical swipes
      else {
        if (diffY > threshold && config.onSwipeUp) {
          config.onSwipeUp();
          triggerHaptic("medium");
        } else if (diffY < -threshold && config.onSwipeDown) {
          config.onSwipeDown();
          triggerHaptic("medium");
        }
      }
    };

    window.addEventListener("touchstart", handleTouchStart);
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [config]);
}

/**
 * Trigger haptic feedback (if supported)
 * Patterns: light, medium, heavy, success, error, warning
 */
export function triggerHaptic(
  pattern: "light" | "medium" | "heavy" | "success" | "error" | "warning" = "light"
) {
  if (!navigator.vibrate) return;

  const patterns: Record<string, number | number[]> = {
    light: 10,
    medium: 20,
    heavy: 40,
    success: [20, 10, 20], // short-pause-short (double tap)
    error: [40, 30, 40], // long-pause-long
    warning: [10, 20, 10, 20, 10], // alternating short-long
  };

  navigator.vibrate(patterns[pattern] || 10);
}

/**
 * Hook for pull-to-refresh gesture (mobile)
 */
export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const startY = useRef(0);
  const pulledDistance = useRef(0);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      // Only trigger from top of page
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (startY.current === 0) return;

      const currentY = e.touches[0].clientY;
      const distance = currentY - startY.current;

      if (distance > 0) {
        pulledDistance.current = distance;
        // Optional: show pull-to-refresh indicator at distance > 80px
      }
    };

    const handleTouchEnd = async () => {
      if (pulledDistance.current > 80) {
        triggerHaptic("medium");
        await onRefresh();
      }

      startY.current = 0;
      pulledDistance.current = 0;
    };

    window.addEventListener("touchstart", handleTouchStart);
    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [onRefresh]);
}

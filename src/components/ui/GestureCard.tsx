"use client";

import { ReactNode, useRef, useState } from "react";
import { triggerHaptic } from "@/lib/mobile/gestures";

interface GestureCardProps {
  children: ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  className?: string;
  showGestureHint?: boolean;
}

/**
 * Card wrapper that supports swipe gestures
 * Useful for dating cards, game selections, etc.
 */
export function GestureCard({
  children,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  className = "",
  showGestureHint = false,
}: GestureCardProps) {
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const [isActive, setIsActive] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setIsActive(true);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const diffX = touchStartX.current - touchEndX;
    const diffY = touchStartY.current - touchEndY;

    const threshold = 50; // minimum px to trigger swipe

    // Horizontal swipes
    if (Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX > threshold && onSwipeLeft) {
        triggerHaptic("medium");
        onSwipeLeft();
      } else if (diffX < -threshold && onSwipeRight) {
        triggerHaptic("medium");
        onSwipeRight();
      }
    }
    // Vertical swipes
    else {
      if (diffY > threshold && onSwipeUp) {
        triggerHaptic("medium");
        onSwipeUp();
      } else if (diffY < -threshold && onSwipeDown) {
        triggerHaptic("medium");
        onSwipeDown();
      }
    }

    setIsActive(false);
  };

  const hasGestures = onSwipeLeft || onSwipeRight || onSwipeUp || onSwipeDown;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`relative select-none transition-transform ${
        isActive && hasGestures ? "scale-95" : ""
      } ${className}`}
    >
      {children}

      {/* Gesture hint (optional) */}
      {showGestureHint && hasGestures && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-glass bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="text-center text-xs font-medium text-white">
            {(onSwipeLeft || onSwipeRight) && <p>← Swipe →</p>}
            {(onSwipeUp || onSwipeDown) && <p>Swipe to explore</p>}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Native-feel mobile gestures for DESIGN_STRATEGY Phase 2.
 * Ref-based so touch end always sees the latest coordinates.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type HapticKind = "light" | "medium" | "heavy" | "success" | "error";

const HAPTIC_PATTERNS: Record<HapticKind, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 40,
  success: [40, 60, 40],
  error: [80, 40, 80],
};

export function triggerHaptic(kind: HapticKind = "light") {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(HAPTIC_PATTERNS[kind]);
    } catch {
      // ignore unsupported / blocked vibration
    }
  }
}

export function useHapticFeedback() {
  return {
    light: () => triggerHaptic("light"),
    medium: () => triggerHaptic("medium"),
    heavy: () => triggerHaptic("heavy"),
    success: () => triggerHaptic("success"),
    error: () => triggerHaptic("error"),
    trigger: triggerHaptic,
  };
}

type SwipeCallbacks = {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onTap?: (point: { x: number; y: number }) => void;
  threshold?: number;
};

export function useSwipeGestures(callbacks: SwipeCallbacks = {}) {
  const startRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const endRef = useRef<{ x: number; y: number } | null>(null);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;
  const threshold = callbacks.threshold ?? 56;

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.targetTouches[0];
    startRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    endRef.current = null;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const t = e.targetTouches[0];
    endRef.current = { x: t.clientX, y: t.clientY };
  }, []);

  const onTouchEnd = useCallback(() => {
    const start = startRef.current;
    const end = endRef.current;
    const cb = callbacksRef.current;
    if (!start) return;

    if (!end) {
      if (Date.now() - start.t < 220 && cb.onTap) {
        cb.onTap({ x: start.x, y: start.y });
      }
      startRef.current = null;
      return;
    }

    const dx = start.x - end.x;
    const dy = start.y - end.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const duration = Date.now() - start.t;

    if (duration < 220 && absX < 12 && absY < 12) {
      cb.onTap?.({ x: start.x, y: start.y });
    } else if (absX > absY && absX > threshold) {
      if (dx > 0) cb.onSwipeLeft?.();
      else cb.onSwipeRight?.();
    } else if (absY > absX && absY > threshold) {
      if (dy > 0) cb.onSwipeUp?.();
      else cb.onSwipeDown?.();
    }

    startRef.current = null;
    endRef.current = null;
  }, [threshold]);

  return { onTouchStart, onTouchMove, onTouchEnd };
}

type LongPressOptions = {
  onLongPress: (point: { x: number; y: number }) => void;
  delayMs?: number;
  moveTolerance?: number;
};

export function useLongPress({
  onLongPress,
  delayMs = 480,
  moveTolerance = 12,
}: LongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const firedRef = useRef(false);
  const onLongPressRef = useRef(onLongPress);
  onLongPressRef.current = onLongPress;

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      firedRef.current = false;
      startRef.current = { x: e.clientX, y: e.clientY };
      clear();
      timerRef.current = setTimeout(() => {
        firedRef.current = true;
        triggerHaptic("medium");
        onLongPressRef.current({
          x: startRef.current?.x ?? e.clientX,
          y: startRef.current?.y ?? e.clientY,
        });
      }, delayMs);
    },
    [clear, delayMs]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!startRef.current || !timerRef.current) return;
      const dx = Math.abs(e.clientX - startRef.current.x);
      const dy = Math.abs(e.clientY - startRef.current.y);
      if (dx > moveTolerance || dy > moveTolerance) clear();
    },
    [clear, moveTolerance]
  );

  const onPointerUp = useCallback(() => {
    clear();
    startRef.current = null;
  }, [clear]);

  const onPointerCancel = onPointerUp;

  useEffect(() => clear, [clear]);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    /** True if the last press fired long-press (skip click handlers). */
    didFireLongPress: () => firedRef.current,
  };
}

type PullToRefreshOptions = {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  disabled?: boolean;
};

export function usePullToRefresh({
  onRefresh,
  threshold = 72,
  disabled = false,
}: PullToRefreshOptions) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const pulling = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || refreshing) return;
      const el = e.currentTarget as HTMLElement;
      const elTop = el.scrollTop || 0;
      const winTop =
        typeof window !== "undefined"
          ? window.scrollY || document.documentElement.scrollTop || 0
          : 0;
      // Prefer element scrollport when it actually scrolls; else window.
      const scrollTop = el.scrollHeight > el.clientHeight + 2 ? elTop : winTop;
      if (scrollTop > 2) return;
      startY.current = e.targetTouches[0].clientY;
      pulling.current = true;
    },
    [disabled, refreshing]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!pulling.current || startY.current == null || disabled || refreshing) {
        return;
      }
      const dy = e.targetTouches[0].clientY - startY.current;
      if (dy > 0) {
        setPullDistance(Math.min(dy * 0.55, threshold * 1.6));
      } else {
        setPullDistance(0);
      }
    },
    [disabled, refreshing, threshold]
  );

  const onTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;
    startY.current = null;

    if (pullDistance >= threshold && !refreshing && !disabled) {
      setRefreshing(true);
      triggerHaptic("light");
      try {
        await onRefreshRef.current();
        triggerHaptic("success");
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [disabled, pullDistance, refreshing, threshold]);

  return {
    pullDistance,
    refreshing,
    ready: pullDistance >= threshold,
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
  };
}

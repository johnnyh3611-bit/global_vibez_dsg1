/**
 * useSafeTimeout — a setTimeout that auto-clears on component unmount.
 *
 * Why: a plain `setTimeout(() => setX(false), 3000)` inside a React
 * component will fire its callback AFTER the component unmounts if the
 * user navigates away before the delay elapses. That callback then
 * calls setState on an unmounted component — causing the infamous
 * "Can't perform a React state update on an unmounted component"
 * warning and a potential memory leak.
 *
 * This hook tracks every timer it schedules and clears them all in a
 * single unmount cleanup. Drop-in replacement:
 *
 *     const safeTimeout = useSafeTimeout();
 *     safeTimeout(() => setShowConfetti(false), 5000);
 *
 * Cancellation of individual timers is still possible:
 *
 *     const id = safeTimeout(fn, 500);
 *     clearTimeout(id);  // fine — we only clear still-pending timers
 *
 * Intentionally lightweight (no ref forwarding, no dependency array)
 * because every card-game page uses it dozens of times.
 */
import { useCallback, useEffect, useRef } from "react";

export function useSafeTimeout() {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => {
      timers.current.forEach((id) => clearTimeout(id));
      timers.current = [];
    };
  }, []);

  return useCallback((cb: () => void, ms: number): ReturnType<typeof setTimeout> => {
    const id = setTimeout(cb, ms);
    timers.current.push(id);
    return id;
  }, []);
}

/**
 * useCornerDockTrigger — Vigilant Agent v2 (2026-02-09).
 *
 * Tiny zero-state hook that lets a corner-FAB component (Beta
 * Feedback, Voice Mirror, Orientation, Fresh Drops, Hungry Vibez)
 * cooperate with CornerDock.
 *
 * Usage (pseudo-code):
 *   const triggerHidden = useCornerDockTrigger("beta_feedback", setOpen);
 *   if (!triggerHidden) renderTriggerButton();
 *   // modal stays mounted regardless
 *
 * What it does
 *   1. Reads document.body.dataset.cornerDockActive once on mount;
 *      if set, the legacy floating trigger button is suppressed so
 *      the unified CornerDock owns the corner real-estate.
 *   2. Listens for the cdock:open:ID window event so CornerDock can
 *      pop the underlying modal/panel without touching its internal
 *      state.
 *
 * That's the entire contract. The component's existing modal /
 * panel logic continues to work unchanged.
 */
import { useEffect, useState } from "react";

export function useCornerDockTrigger(
  id: string,
  setOpen: (v: boolean) => void,
): boolean {
  const [triggerHidden, setTriggerHidden] = useState<boolean>(false);

  useEffect(() => {
    const sync = () => {
      if (typeof document === "undefined") return;
      setTriggerHidden(
        document.body.dataset.cornerDockActive === "1" ||
        document.body.dataset.chromeBarActive === "1",
      );
    };
    sync();
    const onOpen = () => setOpen(true);
    const onActive = () => setTriggerHidden(true);
    const onInactive = () => sync();
    if (typeof window !== "undefined") {
      window.addEventListener(`cdock:open:${id}`, onOpen as EventListener);
      window.addEventListener("cdock:active", onActive);
      window.addEventListener("cdock:inactive", onInactive);
      window.addEventListener("chromebar:active", onActive);
      window.addEventListener("chromebar:inactive", onInactive);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener(`cdock:open:${id}`, onOpen as EventListener);
        window.removeEventListener("cdock:active", onActive);
        window.removeEventListener("cdock:inactive", onInactive);
        window.removeEventListener("chromebar:active", onActive);
        window.removeEventListener("chromebar:inactive", onInactive);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return triggerHidden;
}

export default useCornerDockTrigger;

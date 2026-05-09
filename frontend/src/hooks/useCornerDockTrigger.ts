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
    if (typeof document !== "undefined") {
      setTriggerHidden(document.body.dataset.cornerDockActive === "1");
    }
    const onOpen = () => setOpen(true);
    // CornerDock fires this when it mounts/unmounts so the FABs can
    // sync without depending on mount order.
    const onActive = () => setTriggerHidden(true);
    const onInactive = () => setTriggerHidden(false);
    if (typeof window !== "undefined") {
      window.addEventListener(`cdock:open:${id}`, onOpen as EventListener);
      window.addEventListener("cdock:active", onActive);
      window.addEventListener("cdock:inactive", onInactive);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener(`cdock:open:${id}`, onOpen as EventListener);
        window.removeEventListener("cdock:active", onActive);
        window.removeEventListener("cdock:inactive", onInactive);
      }
    };
    // setOpen is stable from useState; id is constant per component instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return triggerHidden;
}

export default useCornerDockTrigger;

/**
 * CornerDockTooltip — first-time discovery hint.
 *
 * Beta-tester ergonomics: a soft tooltip pulses next to the new
 * "TOOLS · 3" trigger on first session so users discover the dock
 * without an in-app announcement. After the user opens the dock once
 * (or 8 seconds elapse), the tooltip auto-dismisses and we set a
 * localStorage flag so it never shows again.
 *
 * Self-mounted by <CornerDock />. No props.
 */
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY = "gv_corner_dock_tooltip_seen_v1";

const CornerDockTooltip: React.FC = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage?.getItem(STORAGE_KEY) === "1") return;
    // Wait 1.6 s after mount so it lands AFTER the page itself
    // settles (animation-heavy landings would otherwise step on it).
    const tStart = setTimeout(() => setShow(true), 1600);
    // Auto-dismiss after 8 s.
    const tEnd = setTimeout(() => {
      setShow(false);
      window.localStorage?.setItem(STORAGE_KEY, "1");
    }, 1600 + 8000);
    // If the user opens the dock manually before the timer fires,
    // dismiss immediately.
    const onTriggerClick = (e: MouseEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (!tgt) return;
      const trigger = tgt.closest('[data-testid$="-trigger"]');
      if (
        trigger?.getAttribute("data-testid")?.startsWith("corner-dock-")
      ) {
        setShow(false);
        window.localStorage?.setItem(STORAGE_KEY, "1");
      }
    };
    document.addEventListener("click", onTriggerClick, true);
    return () => {
      clearTimeout(tStart);
      clearTimeout(tEnd);
      document.removeEventListener("click", onTriggerClick, true);
    };
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="cd-tip"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.4 }}
          data-testid="corner-dock-first-time-tooltip"
          className="fixed bottom-[68px] left-4 z-[9994] max-w-[260px] rounded-2xl border border-cyan-400/40 bg-slate-950/95 backdrop-blur-xl p-3 pr-9 shadow-2xl shadow-cyan-500/30"
        >
          <button
            onClick={() => {
              setShow(false);
              if (typeof window !== "undefined") {
                window.localStorage?.setItem(STORAGE_KEY, "1");
              }
            }}
            data-testid="corner-dock-tooltip-dismiss"
            aria-label="Dismiss tooltip"
            className="absolute top-2 right-2 text-white/60 hover:text-white text-sm leading-none w-5 h-5 flex items-center justify-center rounded-full hover:bg-white/10"
          >
            ×
          </button>
          <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-300 font-bold mb-1">
            New
          </p>
          <p className="text-sm font-bold text-white leading-snug mb-1">
            Tap <span className="text-cyan-300">Tools</span> for everything
          </p>
          <p className="text-[11px] text-white/70 leading-snug">
            Voice Mirror, Auto-Rotate, Beta Feedback — all in one menu, no more cluttered corners.
          </p>
          {/* Pointer arrow tail */}
          <div
            aria-hidden
            className="absolute -bottom-1.5 left-7 w-3 h-3 rotate-45 bg-slate-950 border-r border-b border-cyan-400/40"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CornerDockTooltip;

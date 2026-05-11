/**
 * <LandscapeRotateHint /> — universal landscape orientation helper for
 * every fullscreen card / casino / dice room.
 *
 * Behavior (founder ask 2026-05-10, option 4c):
 *   • Auto-shows a centered rotate-phone hint when the device is in
 *     portrait orientation AND the viewport is narrow (mobile range).
 *   • Inline pill button at top-right (data-testid="landscape-toggle")
 *     lets the player FORCE landscape CSS rotation on any device. The
 *     button has 3 states: AUTO (default) → FORCE-LANDSCAPE → AUTO.
 *
 * Founder rule preserved: NO floating buttons on game rooms — the pill
 * is part of the chrome strip alongside the comms launcher. It uses
 * the same z-index family so it never overlaps the game itself.
 */
import { useEffect, useState } from "react";
import { RotateCcw, Smartphone } from "lucide-react";

const FORCE_KEY = "gv_force_landscape";

export default function LandscapeRotateHint() {
  const [orientation, setOrientation] = useState<"portrait" | "landscape">(
    typeof window !== "undefined" && window.innerWidth >= window.innerHeight
      ? "landscape"
      : "portrait"
  );
  const [forced, setForced] = useState<boolean>(
    typeof window !== "undefined" && window.localStorage.getItem(FORCE_KEY) === "1"
  );
  const [showHint, setShowHint] = useState<boolean>(false);

  useEffect(() => {
    const handle = () => {
      const isLandscape = window.innerWidth >= window.innerHeight;
      setOrientation(isLandscape ? "landscape" : "portrait");
      // Only nag on mobile-sized viewports (<= 900px is the heuristic).
      const isMobile = Math.min(window.innerWidth, window.innerHeight) < 900;
      setShowHint(!isLandscape && !forced && isMobile);
    };
    handle();
    window.addEventListener("resize", handle);
    window.addEventListener("orientationchange", handle);
    return () => {
      window.removeEventListener("resize", handle);
      window.removeEventListener("orientationchange", handle);
    };
  }, [forced]);

  // Apply / remove the global force-landscape body class.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (forced) {
      document.body.classList.add("gv-force-landscape");
      window.localStorage.setItem(FORCE_KEY, "1");
    } else {
      document.body.classList.remove("gv-force-landscape");
      window.localStorage.removeItem(FORCE_KEY);
    }
    return () => {
      document.body.classList.remove("gv-force-landscape");
    };
  }, [forced]);

  return (
    <>
      {/* Inline toggle pill — top-right, BELOW the comms launcher. */}
      <button
        type="button"
        onClick={() => setForced((v) => !v)}
        data-testid="landscape-toggle"
        aria-pressed={forced}
        aria-label={forced ? "Disable forced landscape" : "Force landscape orientation"}
        className="fixed top-14 right-3 z-[54] flex items-center gap-1 px-2 py-0.5 rounded-full
                   bg-black/70 hover:bg-black/90 backdrop-blur border border-amber-400/40
                   text-white text-[10px] font-black uppercase tracking-wider transition-colors"
      >
        <RotateCcw className={`w-3 h-3 ${forced ? "text-amber-300" : "text-white/60"}`} />
        <span className="hidden md:inline text-[9px]">{forced ? "Forced" : orientation}</span>
      </button>

      {/* Centered hint overlay — only on portrait + mobile + not forced. */}
      {showHint && (
        <div
          data-testid="landscape-hint-overlay"
          className="fixed inset-0 z-[57] bg-black/85 backdrop-blur-md flex flex-col items-center justify-center text-center px-6"
        >
          <Smartphone className="w-12 h-12 text-amber-300 animate-pulse" style={{ transform: "rotate(90deg)" }} />
          <p className="mt-4 text-base font-black uppercase tracking-widest text-white">Rotate for the table</p>
          <p className="mt-2 text-xs text-white/60 max-w-xs">
            This room plays best in landscape. Turn your device sideways — or tap below to force it.
          </p>
          <button
            type="button"
            onClick={() => setForced(true)}
            data-testid="landscape-hint-force"
            className="mt-5 px-5 py-2 rounded-full bg-amber-400 text-black text-xs font-black uppercase tracking-widest"
          >
            Force landscape
          </button>
          <button
            type="button"
            onClick={() => setShowHint(false)}
            data-testid="landscape-hint-dismiss"
            className="mt-2 text-xs text-white/40 hover:text-white/70 underline"
          >
            Continue in portrait
          </button>
        </div>
      )}
    </>
  );
}

/**
 * <LandscapeRotateHint /> — universal landscape orientation helper for
 * every fullscreen card / casino / dice room.
 *
 * Behavior:
 *   • Auto-shows a centered "Turn your phone sideways" overlay when the
 *     device is in portrait on a mobile-sized viewport.
 *   • Always-visible labeled pill (phones included) that explains the
 *     action: "Rotate phone" / "Forced landscape · Tap to exit".
 *   • Optional pop-out panel with plain-language instructions.
 */
import { useEffect, useState } from "react";
import { RotateCcw, Smartphone, ChevronDown, ChevronUp } from "lucide-react";

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
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const handle = () => {
      const isLandscape = window.innerWidth >= window.innerHeight;
      setOrientation(isLandscape ? "landscape" : "portrait");
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

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (showHint) document.body.classList.add("gv-landscape-hint-active");
    else document.body.classList.remove("gv-landscape-hint-active");
    return () => document.body.classList.remove("gv-landscape-hint-active");
  }, [showHint]);

  const pillLabel = forced
    ? "Forced landscape · Tap to exit"
    : orientation === "portrait"
      ? "Rotate phone"
      : "Landscape on";
  const pillTitle = forced
    ? "You forced landscape mode. Tap to return to normal phone orientation."
    : "Tap to force landscape if you cannot turn your phone sideways. Best for seeing your cards and the table.";

  return (
    <>
      {!showHint && (
        <div
          className="fixed z-[54] flex flex-col items-end gap-1.5 max-w-[min(92vw,17rem)]"
          style={{
            top: "max(2.75rem, calc(env(safe-area-inset-top) + 2.35rem))",
            right: "max(0.5rem, env(safe-area-inset-right))",
          }}
          data-testid="landscape-controls"
        >
          <button
            type="button"
            onClick={() => setForced((v) => !v)}
            data-testid="landscape-toggle"
            aria-pressed={forced}
            aria-label={pillLabel}
            title={pillTitle}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full
                       bg-black/80 hover:bg-black/95 backdrop-blur border border-amber-400/50
                       text-white text-[10px] font-black uppercase tracking-wide transition-colors
                       shadow-[0_4px_18px_rgba(0,0,0,0.45)]"
          >
            <RotateCcw className={`w-3.5 h-3.5 shrink-0 ${forced ? "text-amber-300" : "text-amber-200"}`} />
            <span className="leading-tight text-left normal-case tracking-normal font-bold">
              {pillLabel}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setHelpOpen((o) => !o)}
            data-testid="landscape-help-toggle"
            aria-expanded={helpOpen}
            className="flex items-center gap-1 px-2 py-1 rounded-full bg-black/70 border border-white/15
                       text-[9px] font-bold uppercase tracking-wider text-white/75 hover:text-white"
          >
            What is this?
            {helpOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {helpOpen ? (
            <div
              data-testid="landscape-help-panel"
              className="rounded-xl border border-amber-400/35 bg-[#0c0a14]/95 backdrop-blur-xl
                         px-3 py-2.5 text-left shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
            >
              <p className="text-[11px] font-black uppercase tracking-wider text-amber-200 mb-1">
                Phone orientation
              </p>
              <p className="text-[11px] leading-snug text-white/75">
                Card and table rooms play best with the phone sideways (landscape).
                Turn your device, or tap <span className="text-amber-200 font-semibold">Rotate phone</span>{" "}
                to force landscape on screen.
              </p>
            </div>
          ) : null}
        </div>
      )}

      {showHint && (
        <div
          data-testid="landscape-hint-overlay"
          className="fixed inset-0 z-[57] bg-black/88 backdrop-blur-md flex flex-col items-center justify-center text-center px-6"
        >
          <Smartphone
            className="w-14 h-14 text-amber-300 animate-pulse"
            style={{ transform: "rotate(90deg)" }}
            aria-hidden
          />
          <p className="mt-5 text-lg font-black uppercase tracking-widest text-white">
            Turn your phone sideways
          </p>
          <p className="mt-2 text-sm text-white/70 max-w-sm leading-relaxed">
            Rotate to landscape so you can see the full table and your cards without scrolling.
            If your phone is locked upright, tap the button below to force landscape on this screen.
          </p>
          <button
            type="button"
            onClick={() => setForced(true)}
            data-testid="landscape-hint-force"
            className="mt-6 px-6 py-2.5 rounded-full bg-amber-400 text-black text-xs font-black uppercase tracking-widest"
          >
            Force landscape on screen
          </button>
          <button
            type="button"
            onClick={() => setShowHint(false)}
            data-testid="landscape-hint-dismiss"
            className="mt-3 text-xs text-white/45 hover:text-white/80 underline"
          >
            Keep portrait for now
          </button>
        </div>
      )}
    </>
  );
}

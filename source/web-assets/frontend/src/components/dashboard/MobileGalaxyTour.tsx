/**
 * MobileGalaxyTour — first-time coach-mark for the 2D arc carousel.
 *
 * Three short steps overlaid on top of the mobile dashboard the FIRST
 * time a user lands here. Dismissed-or-completed state persists in
 * ``localStorage["gv_mobile_galaxy_tour_seen"]`` so returning users
 * never see it again. Founder ask (Feb 2026): "lift first-session
 * mobile completion by giving new users a 10-second walkthrough."
 *
 * Why no overlay arrows pointing at exact DOM nodes? Coach marks tied
 * to specific elements break the moment the surrounding layout shifts.
 * Instead we use a centered card that names what to tap with text —
 * cheap, reliable, A11y-friendly.
 */
import React, { useEffect, useState } from "react";

const STORAGE_KEY = "gv_mobile_galaxy_tour_seen";

type Step = {
  title: string;
  body: string;
  emoji: string;
};

const STEPS: Step[] = [
  {
    title: "Tap a planet to focus",
    body: "Six categories — Games, Dating, Rides, Food, Streaming, Vault. Tap any planet to focus it.",
    emoji: "🪐",
  },
  {
    title: "Swipe left or right to rotate",
    body: "A quick swipe (or the side arrows / your arrow keys) shifts focus to the next planet on the arc.",
    emoji: "👉",
  },
  {
    title: "Tap a room to dive in",
    body: "The room grid below the focused planet is your jump-off point. Tap any room tile to launch it.",
    emoji: "🚪",
  },
];

interface Props {
  /** Inject for tests so we can render the tour without checking storage. */
  forceShow?: boolean;
}

const MobileGalaxyTour: React.FC<Props> = ({ forceShow = false }) => {
  const [open, setOpen] = useState<boolean>(false);
  const [stepIdx, setStepIdx] = useState<number>(0);

  useEffect(() => {
    if (forceShow) {
      setOpen(true);
      return;
    }
    if (typeof window === "undefined") return;
    const seen = window.localStorage.getItem(STORAGE_KEY) === "1";
    if (!seen) setOpen(true);
  }, [forceShow]);

  const dismiss = (reason: "completed" | "skipped") => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* localStorage may be unavailable in private mode — best-effort */
    }
    setOpen(false);
    // Hook for analytics later if we want to track skip-vs-complete rates.
    void reason;
  };

  if (!open) return null;

  const step = STEPS[stepIdx];
  const isLast = stepIdx === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end justify-center sm:items-center"
      data-testid="mobile-galaxy-tour-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-galaxy-tour-title"
    >
      <div
        className="w-full max-w-md mx-4 mb-6 sm:mb-0 rounded-3xl bg-gradient-to-b from-zinc-900 to-black border border-fuchsia-500/40 shadow-[0_0_60px_rgba(217,70,239,0.35)] p-6"
        data-testid={`mobile-galaxy-tour-step-${stepIdx}`}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] uppercase tracking-[0.3em] text-fuchsia-300">
            Welcome · Step {stepIdx + 1} of {STEPS.length}
          </span>
          <button
            type="button"
            onClick={() => dismiss("skipped")}
            className="text-[11px] text-zinc-400 hover:text-white"
            data-testid="mobile-galaxy-tour-skip-btn"
          >
            Skip tour
          </button>
        </div>

        <div className="text-6xl mb-3 leading-none">{step.emoji}</div>
        <h2
          id="mobile-galaxy-tour-title"
          className="text-2xl font-black text-white mb-2"
        >
          {step.title}
        </h2>
        <p className="text-sm text-zinc-300 leading-relaxed mb-5">{step.body}</p>

        {/* Step dots — visual progress indicator */}
        <div
          className="flex items-center justify-center gap-1.5 mb-5"
          data-testid="mobile-galaxy-tour-dots"
        >
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === stepIdx ? "w-6 bg-fuchsia-400" : "w-1.5 bg-zinc-700"
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            if (isLast) dismiss("completed");
            else setStepIdx((i) => i + 1);
          }}
          className="w-full py-3 rounded-full bg-fuchsia-500 hover:bg-fuchsia-400 active:bg-fuchsia-600 text-white font-bold text-sm uppercase tracking-widest transition-colors"
          data-testid={isLast ? "mobile-galaxy-tour-finish-btn" : "mobile-galaxy-tour-next-btn"}
        >
          {isLast ? "Got it — let's go" : "Next"}
        </button>
      </div>
    </div>
  );
};

export default MobileGalaxyTour;

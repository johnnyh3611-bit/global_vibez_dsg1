/**
 * GalaxyGuidedTour — 30-second cinematic onboarding for the Volumetric Galaxy.
 *
 * Auto-plays on first visit (gated by localStorage.gv_galaxy_tour_seen).
 * Pans the camera through all 6 planets via setSelectedIndex, overlays
 * each planet's tagline + room count, and hands control back to the user
 * once finished. Re-playable via the top-bar "Replay Tour" pill.
 *
 * Sibling to PlanetCarouselNav — both drive selectedIndex.
 *
 * Founder ask 2026-02 (this session): "30-second cinematic auto-tour on
 * first-time login — a guided dive through each planet's orbit-rooms
 * for 2-3× day-one comprehension."
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Play, X, Pause, SkipForward } from "lucide-react";

export const GALAXY_TOUR_SEEN_KEY = "gv_galaxy_tour_seen";

export type TourPlanet = {
  id: string;
  label: string;
  color: string;
  rooms: Array<{ id: string; label: string }>;
};

type Props = {
  planets: TourPlanet[];
  selectedIndex: number | null;
  setSelectedIndex: (i: number | null) => void;
};

const DWELL_INTRO_MS = 2500;
const DWELL_PER_PLANET_MS = 4000;

const TAGLINES: Record<string, string> = {
  games: "Spades, Vibez 654, Chess Hall, Cyber Casino — and the new High Roller VIP at 10K minimums.",
  dating: "98% synergy matchmaking, Cinema Dates, Vibez Spots, and the Just-For-The-Night vanishing club.",
  rides: "Vibez Ridez — verified drivers, fare-split, and Hungry Vibez delivery on one fleet.",
  food: "Hungry Vibez delivery, the Yellow Pages directory, and Receipts +15% merchant boost.",
  streaming: "Go Live, Memory Bank, Beat Vault, Underground Live, the Media Master Hub, and your Broadcast Director.",
  vault: "Vibez Tiers, Wallet, Chair Hall, Voice Mirror, My Vibez — your sovereign economy controls.",
};

export default function GalaxyGuidedTour({ planets, selectedIndex, setSelectedIndex }: Props) {
  // -1 = intro overview; 0..N-1 = planet i; N = complete.
  const [stage, setStage] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const total = planets.length;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const endTour = useCallback(
    (markSeen = true) => {
      clearTimer();
      setStage(null);
      setPaused(false);
      setSelectedIndex(null);
      if (markSeen && typeof window !== "undefined") {
        localStorage.setItem(GALAXY_TOUR_SEEN_KEY, "1");
      }
    },
    [clearTimer, setSelectedIndex],
  );

  const startTour = useCallback(() => {
    clearTimer();
    setPaused(false);
    setStage(-1);
    setSelectedIndex(null);
  }, [clearTimer, setSelectedIndex]);

  // Auto-start on first visit only.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = localStorage.getItem(GALAXY_TOUR_SEEN_KEY) === "1";
    if (!seen) {
      // Small delay so the planet ring has time to materialize before
      // the camera tween fires.
      const t = setTimeout(() => startTour(), 1200);
      return () => clearTimeout(t);
    }
  }, [startTour]);

  // Listen for an external replay event so the top-bar pill can fire it.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onReplay = () => startTour();
    window.addEventListener("gv-galaxy-tour-replay", onReplay);
    return () => window.removeEventListener("gv-galaxy-tour-replay", onReplay);
  }, [startTour]);

  // Advance through stages on a timer.
  useEffect(() => {
    if (stage === null || paused) return;

    // Sync camera selection with current stage.
    if (stage === -1) {
      setSelectedIndex(null);
    } else if (stage >= 0 && stage < total) {
      setSelectedIndex(stage);
    }

    const dwell = stage === -1 ? DWELL_INTRO_MS : DWELL_PER_PLANET_MS;
    timerRef.current = setTimeout(() => {
      const next = stage + 1;
      if (next >= total) {
        endTour(true);
      } else {
        setStage(next);
      }
    }, dwell);

    return () => clearTimer();
  }, [stage, paused, total, setSelectedIndex, endTour, clearTimer]);

  if (stage === null) {
    // Tour idle — render the replay pill only if the user has already seen it.
    return <ReplayPill />;
  }

  const activePlanet = stage >= 0 && stage < total ? planets[stage] : null;

  return (
    <>
      {/* Backdrop dim — subtle, lets the 3D scene still breathe */}
      <div
        className="absolute inset-0 pointer-events-none z-[15] bg-gradient-to-b from-black/0 via-black/30 to-black/60"
        data-testid="galaxy-tour-backdrop"
      />

      {/* HUD overlay — top + bottom bands */}
      <div className="absolute inset-x-0 top-16 z-30 px-4 pointer-events-none">
        <div className="max-w-2xl mx-auto bg-black/70 backdrop-blur-md border border-white/15 rounded-2xl px-5 py-4 pointer-events-auto shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-fuchsia-300 font-black">
              <Play className="w-3 h-3 fill-current" />
              {stage === -1
                ? "Galaxy Tour · 30 seconds"
                : `Planet ${stage + 1} of ${total}`}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                data-testid="galaxy-tour-pause"
                aria-label={paused ? "Resume tour" : "Pause tour"}
                className="px-2 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white"
              >
                {paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  clearTimer();
                  const next = stage + 1;
                  if (next >= total) endTour(true);
                  else setStage(next);
                }}
                data-testid="galaxy-tour-next"
                aria-label="Next planet"
                className="px-2 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white"
              >
                <SkipForward className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => endTour(true)}
                data-testid="galaxy-tour-skip"
                className="px-3 py-1 rounded-full bg-fuchsia-500 hover:bg-fuchsia-400 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Skip
              </button>
            </div>
          </div>

          <div className="mt-3">
            {stage === -1 ? (
              <>
                <h2 className="text-white text-xl md:text-2xl font-black">
                  Welcome to the Galaxy
                </h2>
                <p className="text-fuchsia-100/80 text-sm mt-1">
                  6 planets · drag to spin · tap a planet to enter its rooms.
                  Watch as I show you each one.
                </p>
              </>
            ) : activePlanet ? (
              <>
                <h2
                  className="text-white text-xl md:text-2xl font-black uppercase tracking-widest"
                  style={{ textShadow: `0 0 14px ${activePlanet.color}` }}
                >
                  {activePlanet.label}
                </h2>
                <p className="text-white/80 text-sm mt-1">
                  {TAGLINES[activePlanet.id] ?? "Tap any orbiting tile to enter a room."}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {activePlanet.rooms.slice(0, 6).map((r) => (
                    <span
                      key={r.id}
                      className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border border-white/15 text-white/70 bg-white/5"
                    >
                      {r.label}
                    </span>
                  ))}
                  {activePlanet.rooms.length > 6 && (
                    <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 text-white/40">
                      +{activePlanet.rooms.length - 6} more
                    </span>
                  )}
                </div>
              </>
            ) : null}
          </div>

          {/* Progress dots */}
          <div className="mt-3 flex gap-1.5">
            {planets.map((p, i) => (
              <span
                key={p.id}
                className="h-1 rounded-full transition-all"
                style={{
                  width: i === stage ? "28px" : "8px",
                  background:
                    i < stage
                      ? p.color
                      : i === stage
                        ? "white"
                        : "rgba(255,255,255,0.2)",
                  boxShadow: i === stage ? `0 0 8px ${p.color}` : undefined,
                }}
                data-testid={`galaxy-tour-progress-${p.id}`}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * ReplayPill — small button in the top-bar that re-fires the tour by
 * dispatching `gv-galaxy-tour-replay`. Only visible after the user has
 * completed/skipped the auto-tour at least once.
 */
function ReplayPill() {
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSeen(localStorage.getItem(GALAXY_TOUR_SEEN_KEY) === "1");
    const onStorage = (e: StorageEvent) => {
      if (e.key === GALAXY_TOUR_SEEN_KEY) setSeen(e.newValue === "1");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (!seen) return null;
  return (
    <button
      type="button"
      data-testid="galaxy-tour-replay-pill"
      onClick={() => window.dispatchEvent(new CustomEvent("gv-galaxy-tour-replay"))}
      className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-fuchsia-400/40 text-fuchsia-200 hover:text-white hover:bg-fuchsia-500/30 text-[10px] font-black uppercase tracking-[0.3em] transition-colors"
    >
      <Play className="w-3 h-3 fill-current" />
      Replay Tour
    </button>
  );
}

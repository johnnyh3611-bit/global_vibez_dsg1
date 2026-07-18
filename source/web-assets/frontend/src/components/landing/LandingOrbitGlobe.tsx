/**
 * LandingOrbitGlobe — hero planet with hub markers.
 * Each marker opens a work/lifestyle dashboard (stashes return path for login).
 */
import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { GLOBE_HUBS, openHubPath } from "@/hubs/hubRegistry";

/** Deterministic star field so SSR/hydration stay stable. */
function buildStars(count: number) {
  const stars: { x: number; y: number; r: number; o: number; d: number }[] = [];
  let seed = 42;
  const next = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < count; i++) {
    stars.push({
      x: next() * 100,
      y: next() * 100,
      r: 0.35 + next() * 1.1,
      o: 0.25 + next() * 0.7,
      d: 2.5 + next() * 4.5,
    });
  }
  return stars;
}

export default function LandingOrbitGlobe() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const stars = useMemo(() => buildStars(48), []);

  return (
    <div
      className="relative mx-auto w-[220px] h-[220px] sm:w-[320px] sm:h-[320px] lg:w-[480px] lg:h-[480px] shrink-0"
      data-testid="landing-orbit-globe"
      aria-label="Global Vibez hub planet — tap a hub to open its dashboard"
    >
      <div
        className="absolute -inset-[18%] sm:-inset-[22%] rounded-full overflow-hidden pointer-events-none"
        data-testid="landing-orbit-galaxy"
        aria-hidden
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 50% 45%, rgba(88,28,135,0.45) 0%, rgba(15,23,42,0.2) 42%, transparent 70%)," +
              "radial-gradient(ellipse 55% 45% at 30% 65%, rgba(14,116,144,0.35) 0%, transparent 55%)," +
              "radial-gradient(ellipse 50% 40% at 72% 30%, rgba(190,24,93,0.28) 0%, transparent 50%)," +
              "radial-gradient(circle at 50% 50%, #020617 0%, #000 100%)",
          }}
        />

        {!reduceMotion && (
          <>
            <motion.div
              className="absolute -left-[10%] top-[20%] h-[55%] w-[55%] rounded-full blur-3xl"
              style={{
                background:
                  "radial-gradient(circle, rgba(34,211,238,0.22) 0%, transparent 70%)",
              }}
              animate={{ x: [0, 18, 0], y: [0, -12, 0], opacity: [0.45, 0.8, 0.45] }}
              transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute right-[0%] bottom-[15%] h-[50%] w-[50%] rounded-full blur-3xl"
              style={{
                background:
                  "radial-gradient(circle, rgba(217,70,239,0.2) 0%, transparent 70%)",
              }}
              animate={{ x: [0, -14, 0], y: [0, 10, 0], opacity: [0.35, 0.7, 0.35] }}
              transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
            />
          </>
        )}

        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {stars.map((s, i) => (
            <motion.circle
              key={`star-${i}`}
              cx={s.x}
              cy={s.y}
              r={s.r * 0.35}
              fill="white"
              initial={false}
              animate={
                reduceMotion
                  ? { opacity: s.o }
                  : { opacity: [s.o * 0.35, s.o, s.o * 0.35] }
              }
              transition={
                reduceMotion
                  ? undefined
                  : { duration: s.d, repeat: Infinity, ease: "easeInOut", delay: i * 0.07 }
              }
            />
          ))}
        </svg>

        {!reduceMotion && (
          <motion.span
            className="absolute h-px w-16 bg-gradient-to-r from-transparent via-white to-transparent"
            style={{ top: "22%", left: "10%", rotate: "-28deg" }}
            animate={{
              opacity: [0, 0, 1, 0],
              x: ["0%", "140%"],
              y: ["0%", "70%"],
            }}
            transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 7, ease: "easeOut" }}
          />
        )}

        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, transparent 40%, rgba(0,0,0,0.55) 78%, rgba(0,0,0,0.85) 100%)",
          }}
        />
      </div>

      {/* Planet body (visual only) — kept compact; markers are the interaction */}
      <div className="absolute inset-[12%] sm:inset-[14%] rounded-full pointer-events-none">
        <motion.div
          className="absolute inset-0 rounded-full border border-cyan-300/40 overflow-hidden"
          style={{
            background:
              "radial-gradient(circle at 30% 18%, rgba(255,255,255,0.95) 0%, rgba(186,230,253,0.85) 7%, rgba(34,211,238,0.6) 20%, rgba(59,130,246,0.4) 38%, rgba(15,23,42,0.98) 64%, #020617 100%)",
            boxShadow:
              "inset -22px -22px 50px rgba(0,0,0,0.95), inset 16px 16px 40px rgba(34,211,238,0.45), 0 0 60px rgba(34,211,238,0.4)",
          }}
        >
          <motion.svg
            className="absolute inset-0 w-full h-full opacity-90"
            viewBox="0 0 100 100"
            preserveAspectRatio="xMidYMid meet"
            animate={reduceMotion ? undefined : { rotate: 360 }}
            transition={{ duration: 80, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "50% 50%" }}
          >
            {[12, 20, 30, 40, 50, 60, 70].map((r) => (
              <circle
                key={`lat-${r}`}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke="rgba(34,211,238,0.55)"
                strokeWidth="0.45"
                strokeDasharray="2 2"
              />
            ))}
          </motion.svg>
        </motion.div>
      </div>

      <p className="absolute -bottom-7 left-0 right-0 text-center text-[9px] sm:text-[10px] uppercase tracking-[0.25em] text-white/45 pointer-events-none">
        Tap a hub → your dashboard
      </p>

      {GLOBE_HUBS.map((h) => (
        <button
          key={h.id}
          type="button"
          onClick={() => navigate(openHubPath(h))}
          title={`${h.label} dashboard`}
          data-testid={h.testid}
          className="absolute z-10 -translate-x-1/2 -translate-y-1/2 group flex flex-col items-center justify-center min-w-[44px] min-h-[44px] p-1 rounded-full"
          style={{ left: h.globeLeft, top: h.globeTop }}
        >
          <span
            className={`block text-[8px] sm:text-[10px] lg:text-xs font-black uppercase tracking-wide ${h.accent.split(" ")[0]} [text-shadow:0_0_8px_rgba(0,0,0,0.95)] group-hover:scale-110 group-hover:text-white transition-transform whitespace-nowrap`}
          >
            {h.short}
          </span>
          <span className="mx-auto mt-0.5 block h-1.5 w-1.5 rounded-full bg-white/90 shadow-[0_0_12px_rgba(255,255,255,1)] group-hover:scale-150 transition-transform" />
        </button>
      ))}
    </div>
  );
}

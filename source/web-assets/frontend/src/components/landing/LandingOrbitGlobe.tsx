/**
 * LandingOrbitGlobe — hero planet in a small galaxy stage.
 *
 * Visual intent: a metallic grid sphere (echoing the brand mark) floating
 * in deep space — stars, nebula haze, orbital rings, DSG satellite —
 * with ecosystem rooms as clickable surface markers.
 */
import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

type Country = {
  label: string;
  short: string;
  to: string;
  left: string;
  top: string;
  color: string;
  testid: string;
};

const COUNTRIES: Country[] = [
  {
    label: "Global Vibez",
    short: "Global",
    to: "/dashboard",
    left: "50%",
    top: "22%",
    color: "text-cyan-100",
    testid: "landing-orbit-country-global",
  },
  {
    label: "Vibe Venues",
    short: "Venues",
    to: "/vibe-venues",
    left: "72%",
    top: "38%",
    color: "text-fuchsia-200",
    testid: "landing-orbit-country-venues",
  },
  {
    label: "Vibe Ridez",
    short: "Ridez",
    to: "/vibe-ridez",
    left: "28%",
    top: "40%",
    color: "text-emerald-200",
    testid: "landing-orbit-country-ridez",
  },
  {
    label: "Hungry Vibez",
    short: "Hungry",
    to: "/hungry-vibez",
    left: "34%",
    top: "62%",
    color: "text-orange-200",
    testid: "landing-orbit-country-hungry",
  },
  {
    label: "Dating",
    short: "Dating",
    to: "/dating",
    left: "66%",
    top: "60%",
    color: "text-pink-200",
    testid: "landing-orbit-country-dating",
  },
  {
    label: "Streaming",
    short: "Stream",
    to: "/streams/live",
    left: "50%",
    top: "78%",
    color: "text-violet-200",
    testid: "landing-orbit-country-streaming",
  },
];

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
      aria-label="Global Vibez DSG planet with rooms inside and DSG in orbit"
    >
      {/* Galaxy stage — extends past the planet so stars read as background */}
      <div
        className="absolute -inset-[18%] sm:-inset-[22%] rounded-full overflow-hidden pointer-events-none"
        data-testid="landing-orbit-galaxy"
        aria-hidden
      >
        {/* Deep space + nebula */}
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

        {/* Soft nebula drift */}
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

        {/* Stars */}
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

        {/* Occasional shooting star */}
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

        {/* Soft vignette so the stage doesn't clash with hero copy */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, transparent 40%, rgba(0,0,0,0.55) 78%, rgba(0,0,0,0.85) 100%)",
          }}
        />
      </div>

      {/* Deep outer bloom */}
      <motion.div
        className="absolute -inset-[8%] rounded-full bg-gradient-to-br from-cyan-500/25 via-blue-500/15 to-fuchsia-500/25 blur-3xl"
        animate={
          reduceMotion
            ? undefined
            : { scale: [1, 1.1, 1], opacity: [0.35, 0.7, 0.35] }
        }
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />

      {/* Inner halo ring */}
      <div
        className="absolute -inset-[4%] rounded-full border border-cyan-300/10 bg-cyan-400/5 blur-2xl"
        aria-hidden
      />

      {/* Decorative elliptical orbit arcs (SVG) with moving satellites */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        <defs>
          <linearGradient id="arc-gold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(251,191,36,0.75)" />
            <stop offset="100%" stopColor="rgba(245,158,11,0.45)" />
          </linearGradient>
          <linearGradient id="arc-purple" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(217,70,239,0.65)" />
            <stop offset="100%" stopColor="rgba(147,51,234,0.45)" />
          </linearGradient>
          <linearGradient id="arc-cyan" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(34,211,238,0.65)" />
            <stop offset="100%" stopColor="rgba(14,165,233,0.45)" />
          </linearGradient>
        </defs>
        <motion.ellipse
          id="orbit-gold"
          cx="50"
          cy="50"
          rx="48"
          ry="22"
          fill="none"
          stroke="url(#arc-gold)"
          strokeWidth="0.7"
          strokeDasharray="110 36"
          initial={{ rotate: 0 }}
          animate={reduceMotion ? undefined : { rotate: 360 }}
          transition={{ duration: 26, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "50% 50%", filter: "drop-shadow(0 0 3px rgba(251,191,36,0.7))" }}
        />
        <motion.ellipse
          id="orbit-purple"
          cx="50"
          cy="50"
          rx="44"
          ry="17"
          fill="none"
          stroke="url(#arc-purple)"
          strokeWidth="0.6"
          strokeDasharray="52 72"
          initial={{ rotate: 180 }}
          animate={reduceMotion ? undefined : { rotate: -180 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "50% 50%", filter: "drop-shadow(0 0 3px rgba(217,70,239,0.7))" }}
        />
        <motion.ellipse
          id="orbit-cyan"
          cx="50"
          cy="50"
          rx="40"
          ry="12"
          fill="none"
          stroke="url(#arc-cyan)"
          strokeWidth="0.5"
          strokeDasharray="34 48"
          initial={{ rotate: 90 }}
          animate={reduceMotion ? undefined : { rotate: -270 }}
          transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "50% 50%", filter: "drop-shadow(0 0 3px rgba(34,211,238,0.6))" }}
        />
        {!reduceMotion && (
          <>
            <circle r="1.6" fill="#22d3ee" style={{ filter: "drop-shadow(0 0 3px #22d3ee)" }}>
              <animateMotion dur="14s" repeatCount="indefinite">
                <mpath href="#orbit-gold" />
              </animateMotion>
            </circle>
            <circle r="1.2" fill="#fbbf24" style={{ filter: "drop-shadow(0 0 3px #fbbf24)" }}>
              <animateMotion dur="10s" repeatCount="indefinite" begin="2s">
                <mpath href="#orbit-purple" />
              </animateMotion>
            </circle>
            <circle r="1" fill="#d946ef" style={{ filter: "drop-shadow(0 0 3px #d946ef)" }}>
              <animateMotion dur="18s" repeatCount="indefinite" begin="5s">
                <mpath href="#orbit-cyan" />
              </animateMotion>
            </circle>
            <circle r="0.8" fill="#22d3ee" style={{ filter: "drop-shadow(0 0 2px #22d3ee)" }}>
              <animateMotion dur="22s" repeatCount="indefinite" begin="8s">
                <mpath href="#orbit-gold" />
              </animateMotion>
            </circle>
          </>
        )}
      </svg>

      {/* DSG circular track + orbiting satellite */}
      <div
        className="absolute inset-[8%] rounded-full border border-cyan-300/20 pointer-events-none"
        data-testid="landing-orbit-dsg-track"
        aria-hidden
      />
      <div
        className="absolute inset-[8%] rounded-full border border-dashed border-amber-300/15 pointer-events-none"
        aria-hidden
      />

      <motion.div
        className="absolute inset-[8%]"
        animate={reduceMotion ? undefined : { rotate: 360 }}
        transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
        data-testid="landing-orbit-dsg-orb"
        aria-hidden
      >
        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
          <div className="relative flex items-center justify-center">
            <span className="absolute -left-8 top-1/2 h-1 w-6 origin-right -translate-y-1/2 rounded-full bg-gradient-to-r from-transparent to-fuchsia-400/80 blur-[2px]" />
            <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-slate-200 via-fuchsia-500 to-violet-700 shadow-[0_0_40px_rgba(217,70,239,0.95)] flex items-center justify-center border-2 border-amber-300/90">
              <span className="text-[10px] sm:text-xs font-black tracking-widest text-white drop-shadow">
                DSG
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Planet body with metallic grid */}
      <div className="absolute inset-[16%]" aria-hidden>
        {/* Atmosphere shell / aurora rim */}
        <div className="absolute -inset-[4%] rounded-full border border-cyan-300/35 bg-cyan-400/10 blur-md" />
        <div
          className="absolute -inset-[7%] rounded-full opacity-70"
          style={{
            background:
              "conic-gradient(from 200deg, transparent, rgba(34,211,238,0.25), transparent 30%, rgba(217,70,239,0.2), transparent 55%, rgba(251,191,36,0.15), transparent 80%)",
            filter: "blur(6px)",
          }}
        />

        <motion.div
          className="absolute inset-0 rounded-full border border-cyan-300/40 overflow-hidden"
          style={{
            background:
              "radial-gradient(circle at 30% 18%, rgba(255,255,255,0.95) 0%, rgba(186,230,253,0.85) 7%, rgba(34,211,238,0.6) 20%, rgba(59,130,246,0.4) 38%, rgba(15,23,42,0.98) 64%, #020617 100%)",
            boxShadow:
              "inset -22px -22px 50px rgba(0,0,0,0.95), inset 16px 16px 40px rgba(34,211,238,0.45), 0 0 60px rgba(34,211,238,0.4), 0 0 140px rgba(14,165,233,0.18)",
          }}
          animate={
            reduceMotion
              ? undefined
              : {
                  boxShadow: [
                    "inset -22px -22px 50px rgba(0,0,0,0.95), inset 16px 16px 40px rgba(34,211,238,0.45), 0 0 60px rgba(34,211,238,0.4), 0 0 140px rgba(14,165,233,0.18)",
                    "inset -22px -22px 50px rgba(0,0,0,0.95), inset 16px 16px 50px rgba(217,70,239,0.5), 0 0 90px rgba(217,70,239,0.5), 0 0 160px rgba(217,70,239,0.25)",
                    "inset -22px -22px 50px rgba(0,0,0,0.95), inset 16px 16px 40px rgba(251,191,36,0.45), 0 0 70px rgba(251,191,36,0.45), 0 0 140px rgba(251,191,36,0.2)",
                    "inset -22px -22px 50px rgba(0,0,0,0.95), inset 16px 16px 40px rgba(34,211,238,0.45), 0 0 60px rgba(34,211,238,0.4), 0 0 140px rgba(14,165,233,0.18)",
                  ],
                }
          }
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Bright cyan core glow */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 50% 50%, rgba(34,211,238,0.55) 0%, rgba(59,130,246,0.25) 28%, transparent 45%)",
            }}
          />

          {/* Slowly rotating metallic grid */}
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
                style={{ filter: "drop-shadow(0 0 2px rgba(34,211,238,0.7))" }}
              />
            ))}
            {[8, 14, 22, 30, 38, 46].map((ry, i) => (
              <ellipse
                key={`lon-${ry}`}
                cx="50"
                cy="50"
                rx="49"
                ry={ry}
                fill="none"
                stroke={i % 2 === 0 ? "rgba(34,211,238,0.5)" : "rgba(217,70,239,0.45)"}
                strokeWidth="0.4"
                strokeDasharray={i % 2 === 0 ? "3 2" : "2 3"}
                style={{ filter: "drop-shadow(0 0 2px rgba(34,211,238,0.5))" }}
              />
            ))}
            <line
              x1="50"
              y1="2"
              x2="50"
              y2="98"
              stroke="rgba(34,211,238,0.55)"
              strokeWidth="0.55"
              style={{ filter: "drop-shadow(0 0 3px rgba(34,211,238,0.8))" }}
            />
          </motion.svg>

          {/* Chrome-like horizon sheen */}
          <div
            className="absolute rounded-full bg-white/25 blur-lg"
            style={{ left: "18%", top: "12%", width: "20%", height: "12%", transform: "rotate(-25deg)" }}
          />
        </motion.div>
      </div>

      {/* Country / room markers on the planet surface */}
      {COUNTRIES.map((c) => (
        <button
          key={c.label}
          type="button"
          onClick={() => navigate(c.to)}
          title={c.label}
          data-testid={c.testid}
          className="absolute z-10 -translate-x-1/2 -translate-y-1/2 group flex flex-col items-center justify-center min-w-[44px] min-h-[44px] p-1 rounded-full"
          style={{ left: c.left, top: c.top }}
        >
          <span
            className={`block text-[8px] sm:text-[10px] lg:text-xs font-black uppercase tracking-wide ${c.color} [text-shadow:0_0_8px_rgba(0,0,0,0.95)] group-hover:scale-110 group-hover:text-white transition-transform whitespace-nowrap`}
          >
            {c.short}
          </span>
          <span className="mx-auto mt-0.5 block h-1.5 w-1.5 rounded-full bg-white/90 shadow-[0_0_12px_rgba(255,255,255,1)] group-hover:scale-150 transition-transform" />
        </button>
      ))}
    </div>
  );
}

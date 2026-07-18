/**
 * LandingOrbitGlobe — logo-faithful hub planet for Global Vibez DSG.
 *
 * • Metallic cyan-grid world (logo language) with richer color / flare
 * • Hub continents inside the planet (Ridez, Vineyards, Dating…) with
 *   glowing city-light pins you can tap
 * • DSG satellite on fire — whites / reds / ambers — orbiting the rim
 */
import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { GLOBE_HUBS, openHubPath, type HubDef } from "@/hubs/hubRegistry";

const ORBIT_SECONDS = 18;

/** Continent silhouettes + city-light anchors inside the planet (viewBox 0–100). */
type Continent = {
  id: HubDef["id"];
  path: string;
  /** City-light cluster centers in planet % */
  lights: { x: number; y: number }[];
  /** Label / hit target center */
  cx: number;
  cy: number;
  fill: string;
  glow: string;
};

const CONTINENTS: Continent[] = [
  {
    id: "vibe",
    path: "M38 18 C48 12, 60 14, 66 24 C70 32, 62 38, 52 36 C42 34, 34 28, 38 18 Z",
    lights: [
      { x: 48, y: 22 },
      { x: 56, y: 28 },
      { x: 44, y: 30 },
    ],
    cx: 52,
    cy: 26,
    fill: "rgba(34,211,238,0.55)",
    glow: "#22d3ee",
  },
  {
    id: "vineyards",
    path: "M12 34 C20 26, 34 28, 38 40 C40 50, 28 56, 18 52 C10 48, 8 40, 12 34 Z",
    lights: [
      { x: 22, y: 38 },
      { x: 30, y: 44 },
    ],
    cx: 26,
    cy: 42,
    fill: "rgba(251,113,133,0.5)",
    glow: "#fb7185",
  },
  {
    id: "ridez",
    path: "M16 54 C26 48, 40 52, 44 64 C46 72, 34 78, 24 74 C14 70, 12 60, 16 54 Z",
    lights: [
      { x: 28, y: 58 },
      { x: 36, y: 66 },
      { x: 22, y: 68 },
    ],
    cx: 30,
    cy: 62,
    fill: "rgba(52,211,153,0.55)",
    glow: "#34d399",
  },
  {
    id: "viberise",
    path: "M62 22 C72 16, 86 20, 90 32 C92 42, 80 48, 70 42 C62 38, 58 28, 62 22 Z",
    lights: [
      { x: 74, y: 28 },
      { x: 82, y: 34 },
    ],
    cx: 76,
    cy: 32,
    fill: "rgba(167,139,250,0.55)",
    glow: "#a78bfa",
  },
  {
    id: "dating",
    path: "M68 48 C78 42, 92 46, 94 58 C96 68, 84 74, 74 68 C66 64, 62 54, 68 48 Z",
    lights: [
      { x: 78, y: 54 },
      { x: 86, y: 60 },
      { x: 72, y: 62 },
    ],
    cx: 80,
    cy: 58,
    fill: "rgba(244,63,94,0.5)",
    glow: "#f43f5e",
  },
  {
    id: "hungry",
    path: "M52 66 C62 60, 76 64, 80 74 C82 82, 70 88, 58 84 C50 80, 48 70, 52 66 Z",
    lights: [
      { x: 62, y: 72 },
      { x: 70, y: 78 },
    ],
    cx: 64,
    cy: 74,
    fill: "rgba(251,146,60,0.55)",
    glow: "#fb923c",
  },
  {
    id: "cdl",
    path: "M34 72 C44 68, 54 72, 56 82 C58 90, 44 94, 36 88 C30 84, 28 76, 34 72 Z",
    lights: [
      { x: 42, y: 78 },
      { x: 50, y: 84 },
    ],
    cx: 44,
    cy: 80,
    fill: "rgba(251,191,36,0.55)",
    glow: "#fbbf24",
  },
];

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
      r: 0.35 + next() * 1.25,
      o: 0.28 + next() * 0.7,
      d: 2.2 + next() * 4.2,
    });
  }
  return stars;
}

/** Fiery DSG satellite — chrome V + white/red/amber flame trail */
function DsgFireSatellite({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className="relative flex flex-col items-center select-none"
      data-testid="landing-orbit-v-mark"
      aria-hidden
    >
      {/* Flame wake behind the craft */}
      <span
        className="absolute left-1/2 top-[20%] -translate-x-1/2 rounded-full blur-md"
        style={{
          width: compact ? 28 : 44,
          height: compact ? 36 : 56,
          background:
            "radial-gradient(ellipse at 50% 20%, rgba(255,255,255,0.95) 0%, rgba(251,191,36,0.85) 22%, rgba(239,68,68,0.75) 48%, rgba(220,38,38,0.2) 72%, transparent 85%)",
        }}
      />
      {/* Ember sparks */}
      {[0, 1, 2].map((i) => (
        <motion.span
          key={`ember-${i}`}
          className="absolute left-1/2 top-[55%] h-1 w-1 rounded-full"
          style={{
            background: i === 1 ? "#fff" : i === 0 ? "#fbbf24" : "#ef4444",
            boxShadow: `0 0 8px ${i === 1 ? "#fff" : i === 0 ? "#fbbf24" : "#ef4444"}`,
          }}
          animate={{
            y: [0, 14 + i * 6],
            x: [(i - 1) * 4, (i - 1) * 10],
            opacity: [0.9, 0],
            scale: [1, 0.2],
          }}
          transition={{
            duration: 0.7 + i * 0.15,
            repeat: Infinity,
            ease: "easeOut",
            delay: i * 0.12,
          }}
        />
      ))}

      {/* Chrome V */}
      <span
        className={`relative z-[1] font-black leading-none ${
          compact ? "text-[20px] sm:text-[26px]" : "text-[26px] sm:text-[34px] lg:text-[42px]"
        }`}
        style={{
          background:
            "linear-gradient(165deg, #ffffff 0%, #f8fafc 28%, #fca5a5 55%, #fbbf24 78%, #ef4444 100%)",
          WebkitBackgroundClip: "text",
          color: "transparent",
          filter:
            "drop-shadow(0 0 6px rgba(255,255,255,0.9)) drop-shadow(0 0 14px rgba(239,68,68,0.85))",
        }}
      >
        V
      </span>
      {/* Play-chevron cue from logo */}
      <span className="absolute z-[2] right-[-2px] top-[36%] h-0 w-0 border-y-[3px] border-y-transparent border-l-[5px] border-l-amber-300 sm:border-y-[4px] sm:border-l-[7px]" />
      <span
        className={`relative z-[1] mt-0.5 rounded-sm border border-white/40 bg-gradient-to-r from-red-600/90 via-amber-500/90 to-white/30 px-1.5 font-black uppercase tracking-[0.22em] text-white ${
          compact ? "text-[6px] sm:text-[7px]" : "text-[7px] sm:text-[8px] lg:text-[9px]"
        }`}
        style={{
          boxShadow: "0 0 14px rgba(239,68,68,0.8), 0 0 6px rgba(255,255,255,0.6)",
        }}
      >
        DSG
      </span>
      {/* Solar wings — lit white/red */}
      <span className="absolute left-[-12px] top-[34%] z-0 h-[3px] w-[10px] rounded-full bg-gradient-to-l from-white via-amber-300 to-red-500 sm:left-[-16px] sm:w-[14px]" />
      <span className="absolute right-[-12px] top-[34%] z-0 h-[3px] w-[10px] rounded-full bg-gradient-to-r from-white via-amber-300 to-red-500 sm:right-[-16px] sm:w-[14px]" />
    </div>
  );
}

export default function LandingOrbitGlobe() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const stars = useMemo(() => buildStars(72), []);
  const hubById = useMemo(
    () => Object.fromEntries(GLOBE_HUBS.map((h) => [h.id, h])),
    [],
  );

  return (
    <div
      className="relative mx-auto w-[200px] h-[200px] sm:w-[280px] sm:h-[280px] lg:w-[400px] lg:h-[400px] shrink-0"
      data-testid="landing-orbit-globe"
      aria-label="Global Vibez hub planet — tap a continent light to open its dashboard"
    >
      {/* Galaxy stage */}
      <div
        className="absolute -inset-[28%] sm:-inset-[32%] rounded-full overflow-hidden pointer-events-none"
        data-testid="landing-orbit-galaxy"
        aria-hidden
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 72% 62% at 50% 44%, rgba(6,182,212,0.42) 0%, rgba(88,28,135,0.22) 40%, transparent 68%)," +
              "radial-gradient(ellipse 48% 38% at 70% 26%, rgba(251,191,36,0.28) 0%, transparent 55%)," +
              "radial-gradient(ellipse 42% 36% at 26% 70%, rgba(239,68,68,0.18) 0%, transparent 52%)," +
              "radial-gradient(circle at 50% 50%, #020617 0%, #000 100%)",
          }}
        />

        {!reduceMotion && (
          <>
            <motion.div
              className="absolute left-[10%] top-[14%] h-[50%] w-[50%] rounded-full blur-3xl"
              style={{
                background:
                  "radial-gradient(circle, rgba(34,211,238,0.45) 0%, transparent 70%)",
              }}
              animate={{ x: [0, 18, 0], y: [0, -12, 0], opacity: [0.4, 0.9, 0.4] }}
              transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute right-[4%] bottom-[10%] h-[46%] w-[46%] rounded-full blur-3xl"
              style={{
                background:
                  "radial-gradient(circle, rgba(239,68,68,0.32) 0%, transparent 70%)",
              }}
              animate={{ x: [0, -14, 0], y: [0, 10, 0], opacity: [0.3, 0.75, 0.3] }}
              transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute left-[40%] top-[38%] h-[28%] w-[28%] rounded-full blur-2xl"
              style={{
                background:
                  "radial-gradient(circle, rgba(251,191,36,0.35) 0%, transparent 70%)",
              }}
              animate={{ scale: [1, 1.3, 1], opacity: [0.35, 0.8, 0.35] }}
              transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
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
              fill={i % 7 === 0 ? "#fca5a5" : i % 5 === 0 ? "#fbbf24" : i % 3 === 0 ? "#22d3ee" : "white"}
              initial={false}
              animate={
                reduceMotion
                  ? { opacity: s.o }
                  : { opacity: [s.o * 0.3, s.o, s.o * 0.3] }
              }
              transition={
                reduceMotion
                  ? undefined
                  : { duration: s.d, repeat: Infinity, ease: "easeInOut", delay: i * 0.05 }
              }
            />
          ))}
        </svg>

        {!reduceMotion && (
          <>
            <motion.span
              className="absolute h-0.5 w-24 bg-gradient-to-r from-transparent via-white to-transparent"
              style={{ top: "16%", left: "6%", rotate: "-28deg" }}
              animate={{ opacity: [0, 0, 1, 0], x: ["0%", "170%"], y: ["0%", "70%"] }}
              transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 4.5, ease: "easeOut" }}
            />
            <motion.span
              className="absolute h-0.5 w-16 bg-gradient-to-r from-transparent via-red-400 to-transparent"
              style={{ top: "58%", left: "50%", rotate: "24deg" }}
              animate={{ opacity: [0, 0, 1, 0], x: ["0%", "-130%"], y: ["0%", "-45%"] }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                repeatDelay: 6,
                delay: 2,
                ease: "easeOut",
              }}
            />
          </>
        )}

        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, transparent 36%, rgba(0,0,0,0.4) 70%, rgba(0,0,0,0.9) 100%)",
          }}
        />
      </div>

      {/* Logo-style orbital rings — gold + purple + cyan */}
      <motion.div
        className="absolute inset-[2%] rounded-full border border-amber-400/40 pointer-events-none"
        style={{ boxShadow: "0 0 28px rgba(251,191,36,0.35)" }}
        animate={reduceMotion ? undefined : { rotate: 360 }}
        transition={{ duration: 38, repeat: Infinity, ease: "linear" }}
        aria-hidden
      >
        <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-amber-300 shadow-[0_0_14px_#fbbf24]" />
        <span className="absolute top-1/2 -right-1 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-fuchsia-400 shadow-[0_0_12px_#e879f9]" />
      </motion.div>
      <motion.div
        className="absolute inset-[8%] rounded-full border border-fuchsia-400/35 pointer-events-none"
        style={{ boxShadow: "0 0 22px rgba(217,70,239,0.28)", transform: "rotateX(62deg)" }}
        animate={reduceMotion ? undefined : { rotate: -360 }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        aria-hidden
      >
        <span className="absolute bottom-2 left-[18%] h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_12px_#22d3ee]" />
      </motion.div>
      <motion.div
        className="absolute inset-[14%] rounded-full border border-cyan-300/30 pointer-events-none"
        animate={reduceMotion ? undefined : { rotate: 360 }}
        transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
        aria-hidden
      />

      {/* ── Fiery DSG satellite orbit ── */}
      <div
        className="absolute inset-[3%] z-[8] pointer-events-none"
        style={{ transform: "scaleY(0.5)", transformOrigin: "center" }}
        aria-hidden
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{
            border: "1px solid rgba(255,255,255,0.2)",
            boxShadow:
              "0 0 18px rgba(239,68,68,0.25), inset 0 0 18px rgba(251,191,36,0.12)",
          }}
        />
        {/* Fire ring wash */}
        {!reduceMotion && (
          <motion.div
            className="absolute inset-[-4%] rounded-full"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 0deg, rgba(239,68,68,0.35) 40deg, rgba(251,191,36,0.45) 70deg, rgba(255,255,255,0.5) 90deg, transparent 120deg, transparent 360deg)",
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: ORBIT_SECONDS, repeat: Infinity, ease: "linear" }}
          />
        )}
        {reduceMotion ? (
          <div
            className="absolute left-[90%] top-1/2"
            style={{ transform: "translate(-50%, -50%) scaleY(2)" }}
          >
            <DsgFireSatellite compact />
          </div>
        ) : (
          <motion.div
            className="absolute inset-0"
            animate={{ rotate: 360 }}
            transition={{ duration: ORBIT_SECONDS, repeat: Infinity, ease: "linear" }}
            data-testid="landing-orbit-satellite-rail"
          >
            <motion.div
              className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2"
              animate={{ rotate: -360 }}
              transition={{ duration: ORBIT_SECONDS, repeat: Infinity, ease: "linear" }}
            >
              <div style={{ transform: "scaleY(2)" }}>
                <DsgFireSatellite />
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>

      {/* ── Planet core ── */}
      <div className="absolute inset-[22%] sm:inset-[24%] z-[4] rounded-full">
        {/* Atmosphere */}
        <motion.div
          className="absolute -inset-[14%] rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(34,211,238,0.55) 0%, rgba(251,191,36,0.15) 42%, transparent 68%)",
          }}
          animate={
            reduceMotion
              ? undefined
              : { opacity: [0.55, 1, 0.55], scale: [0.96, 1.06, 0.96] }
          }
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        />

        <motion.div
          className="absolute inset-0 overflow-hidden rounded-full border border-cyan-100/50 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 30% 22%, rgba(255,255,255,0.95) 0%, rgba(186,230,253,0.7) 9%, rgba(14,165,233,0.5) 24%, rgba(30,58,138,0.9) 48%, rgba(15,23,42,0.98) 72%, #020617 100%)",
            boxShadow:
              "inset -18px -20px 44px rgba(0,0,0,0.92), inset 14px 12px 30px rgba(34,211,238,0.35), 0 0 42px rgba(34,211,238,0.55), 0 0 80px rgba(251,146,60,0.28)",
          }}
          animate={
            reduceMotion
              ? undefined
              : {
                  boxShadow: [
                    "inset -18px -20px 44px rgba(0,0,0,0.92), inset 14px 12px 30px rgba(34,211,238,0.35), 0 0 42px rgba(34,211,238,0.55), 0 0 80px rgba(251,146,60,0.22)",
                    "inset -18px -20px 44px rgba(0,0,0,0.92), inset 14px 12px 36px rgba(251,191,36,0.35), 0 0 55px rgba(251,191,36,0.55), 0 0 100px rgba(239,68,68,0.28)",
                    "inset -18px -20px 44px rgba(0,0,0,0.92), inset 14px 12px 30px rgba(34,211,238,0.45), 0 0 50px rgba(34,211,238,0.7), 0 0 90px rgba(34,211,238,0.3)",
                    "inset -18px -20px 44px rgba(0,0,0,0.92), inset 14px 12px 30px rgba(34,211,238,0.35), 0 0 42px rgba(34,211,238,0.55), 0 0 80px rgba(251,146,60,0.22)",
                  ],
                }
          }
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Hub continents (= lifestyle "countries") */}
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden
          >
            <defs>
              {CONTINENTS.map((c) => (
                <filter key={`glow-${c.id}`} id={`continent-glow-${c.id}`}>
                  <feGaussianBlur stdDeviation="1.2" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              ))}
              <radialGradient id="coreFlare" cx="50%" cy="50%" r="20%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="35%" stopColor="#67e8f9" />
                <stop offset="70%" stopColor="rgba(251,191,36,0.7)" />
                <stop offset="100%" stopColor="rgba(251,191,36,0)" />
              </radialGradient>
            </defs>
            {CONTINENTS.map((c) => (
              <g key={c.id} filter={`url(#continent-glow-${c.id})`}>
                <path d={c.path} fill={c.fill} stroke={c.glow} strokeWidth="0.6" opacity="0.92" />
                {c.lights.map((pt, i) => (
                  <circle
                    key={`${c.id}-light-${i}`}
                    cx={pt.x}
                    cy={pt.y}
                    r={i === 0 ? 1.35 : 0.9}
                    fill="#fff"
                    opacity={0.85}
                    style={{ filter: `drop-shadow(0 0 3px ${c.glow})` }}
                  />
                ))}
              </g>
            ))}
            <circle cx="50" cy="50" r="10" fill="url(#coreFlare)" opacity="0.85" />
          </svg>

          {/* Logo radar grid */}
          <motion.svg
            className="absolute inset-0 h-full w-full opacity-90"
            viewBox="0 0 100 100"
            preserveAspectRatio="xMidYMid meet"
            animate={reduceMotion ? undefined : { rotate: 360 }}
            transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "50% 50%" }}
          >
            {[10, 18, 28, 38, 48].map((r) => (
              <circle
                key={`lat-${r}`}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke="rgba(34,211,238,0.75)"
                strokeWidth="0.5"
                strokeDasharray="2 1.5"
              />
            ))}
            {[12, 22, 32, 40].map((ry, i) => (
              <ellipse
                key={`lon-${ry}`}
                cx="50"
                cy="50"
                rx="48"
                ry={ry}
                fill="none"
                stroke={i % 2 === 0 ? "rgba(251,191,36,0.5)" : "rgba(217,70,239,0.45)"}
                strokeWidth="0.4"
                strokeDasharray="3 2"
              />
            ))}
            <line x1="50" y1="2" x2="50" y2="98" stroke="rgba(34,211,238,0.55)" strokeWidth="0.45" />
            <line x1="2" y1="50" x2="98" y2="50" stroke="rgba(34,211,238,0.35)" strokeWidth="0.35" />
          </motion.svg>

          {/* Central brand spark */}
          <motion.div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
            style={{
              width: "24%",
              height: "24%",
              background:
                "radial-gradient(circle, #fff 0%, #67e8f9 20%, #22d3ee 42%, rgba(251,146,60,0.7) 64%, transparent 78%)",
              boxShadow:
                "0 0 22px #22d3ee, 0 0 40px #fbbf24, 0 0 58px rgba(239,68,68,0.45)",
            }}
            animate={
              reduceMotion
                ? undefined
                : { scale: [1, 1.35, 0.95, 1.2, 1], opacity: [0.85, 1, 0.9, 1, 0.85] }
            }
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            data-testid="landing-orbit-spark"
          />

          {/* Cloud sheen */}
          {!reduceMotion && (
            <motion.div
              className="absolute inset-0 opacity-35 pointer-events-none"
              style={{
                background:
                  "linear-gradient(108deg, transparent 18%, rgba(255,255,255,0.22) 36%, transparent 48%, rgba(255,255,255,0.14) 64%, transparent 80%)",
              }}
              animate={{ x: ["-10%", "10%", "-10%"] }}
              transition={{ duration: 13, repeat: Infinity, ease: "easeInOut" }}
            />
          )}

          {/* Terminator */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background:
                "linear-gradient(120deg, transparent 40%, rgba(2,6,23,0.28) 58%, rgba(2,6,23,0.65) 100%)",
            }}
          />
          <div
            className="absolute rounded-full bg-white/35 blur-md pointer-events-none"
            style={{
              left: "14%",
              top: "12%",
              width: "24%",
              height: "12%",
              transform: "rotate(-28deg)",
            }}
          />
        </motion.div>

        {/* Continent hit-targets — sit on the landmasses */}
        {CONTINENTS.map((c) => {
          const hub = hubById[c.id];
          if (!hub) return null;
          return (
            <button
              key={`hit-${c.id}`}
              type="button"
              onClick={() => navigate(openHubPath(hub))}
              title={`${hub.label} dashboard`}
              data-testid={hub.testid}
              className="absolute z-20 -translate-x-1/2 -translate-y-1/2 group flex flex-col items-center justify-center min-w-[40px] min-h-[40px] rounded-full"
              style={{ left: `${c.cx}%`, top: `${c.cy}%` }}
            >
              <motion.span
                className="block h-2.5 w-2.5 rounded-full border border-white/80"
                style={{
                  background: c.glow,
                  boxShadow: `0 0 12px ${c.glow}, 0 0 22px ${c.glow}`,
                }}
                animate={
                  reduceMotion
                    ? undefined
                    : { scale: [1, 1.55, 1], opacity: [0.85, 1, 0.85] }
                }
                transition={{ duration: 1.8 + (c.id.length % 3) * 0.25, repeat: Infinity }}
              />
              <span
                className={`mt-0.5 text-[7px] sm:text-[8px] lg:text-[10px] font-black uppercase tracking-wide opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all whitespace-nowrap ${hub.accent.split(" ")[0]}`}
                style={{
                  textShadow:
                    "0 0 8px rgba(0,0,0,0.95), 0 0 10px rgba(255,255,255,0.35)",
                }}
              >
                {hub.short}
              </span>
            </button>
          );
        })}
      </div>

      <p className="absolute -bottom-8 left-0 right-0 text-center text-[9px] sm:text-[10px] uppercase tracking-[0.28em] text-cyan-200/70 pointer-events-none">
        Tap a continent · your dashboard
      </p>
    </div>
  );
}

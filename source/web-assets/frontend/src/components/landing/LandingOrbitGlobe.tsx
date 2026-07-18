/**
 * LandingOrbitGlobe — hub planet matching the Global Vibez DSG brand mark:
 * metallic grid globe, cyan radar spark, gold/purple orbital rings,
 * satellite nodes. Smaller DSG globe + more flare / fire / emotion.
 * Markers open work hubs (stashes return path for login).
 */
import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { GLOBE_HUBS, openHubPath } from "@/hubs/hubRegistry";

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

export default function LandingOrbitGlobe() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const stars = useMemo(() => buildStars(56), []);

  return (
    <div
      className="relative mx-auto w-[200px] h-[200px] sm:w-[280px] sm:h-[280px] lg:w-[400px] lg:h-[400px] shrink-0"
      data-testid="landing-orbit-globe"
      aria-label="Global Vibez hub planet — tap a hub to open its dashboard"
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
              "radial-gradient(ellipse 70% 60% at 50% 45%, rgba(14,165,233,0.35) 0%, rgba(88,28,135,0.25) 38%, transparent 68%)," +
              "radial-gradient(ellipse 50% 40% at 70% 30%, rgba(245,158,11,0.22) 0%, transparent 55%)," +
              "radial-gradient(ellipse 45% 40% at 25% 70%, rgba(217,70,239,0.28) 0%, transparent 50%)," +
              "radial-gradient(circle at 50% 50%, #020617 0%, #000 100%)",
          }}
        />

        {!reduceMotion && (
          <>
            <motion.div
              className="absolute left-[10%] top-[18%] h-[50%] w-[50%] rounded-full blur-3xl"
              style={{
                background:
                  "radial-gradient(circle, rgba(34,211,238,0.35) 0%, transparent 70%)",
              }}
              animate={{ x: [0, 20, 0], y: [0, -14, 0], opacity: [0.4, 0.85, 0.4] }}
              transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute right-[5%] bottom-[12%] h-[48%] w-[48%] rounded-full blur-3xl"
              style={{
                background:
                  "radial-gradient(circle, rgba(251,146,60,0.28) 0%, transparent 70%)",
              }}
              animate={{ x: [0, -16, 0], y: [0, 12, 0], opacity: [0.3, 0.75, 0.3] }}
              transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute left-[35%] top-[40%] h-[30%] w-[30%] rounded-full blur-2xl"
              style={{
                background:
                  "radial-gradient(circle, rgba(217,70,239,0.3) 0%, transparent 70%)",
              }}
              animate={{ scale: [1, 1.25, 1], opacity: [0.35, 0.7, 0.35] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
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
              fill={i % 5 === 0 ? "#fbbf24" : i % 3 === 0 ? "#22d3ee" : "white"}
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

        {/* Shooting sparks */}
        {!reduceMotion && (
          <>
            <motion.span
              className="absolute h-0.5 w-20 bg-gradient-to-r from-transparent via-cyan-200 to-transparent"
              style={{ top: "18%", left: "8%", rotate: "-30deg" }}
              animate={{ opacity: [0, 0, 1, 0], x: ["0%", "160%"], y: ["0%", "80%"] }}
              transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 5, ease: "easeOut" }}
            />
            <motion.span
              className="absolute h-0.5 w-14 bg-gradient-to-r from-transparent via-amber-300 to-transparent"
              style={{ top: "62%", left: "55%", rotate: "22deg" }}
              animate={{ opacity: [0, 0, 1, 0], x: ["0%", "-120%"], y: ["0%", "-50%"] }}
              transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 7, delay: 2.2, ease: "easeOut" }}
            />
          </>
        )}

        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, transparent 38%, rgba(0,0,0,0.45) 72%, rgba(0,0,0,0.88) 100%)",
          }}
        />
      </div>

      {/* Orbital rings (logo-style gold / purple) — outside the smaller globe */}
      <motion.div
        className="absolute inset-[2%] rounded-full border border-amber-400/35 pointer-events-none"
        style={{ boxShadow: "0 0 24px rgba(251,191,36,0.25)" }}
        animate={reduceMotion ? undefined : { rotate: 360 }}
        transition={{ duration: 36, repeat: Infinity, ease: "linear" }}
        aria-hidden
      >
        <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-amber-300 shadow-[0_0_12px_#fbbf24]" />
        <span className="absolute top-1/2 -right-1 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-fuchsia-400 shadow-[0_0_10px_#e879f9]" />
      </motion.div>
      <motion.div
        className="absolute inset-[8%] rounded-full border border-fuchsia-400/30 pointer-events-none"
        style={{ boxShadow: "0 0 20px rgba(217,70,239,0.2)", transform: "rotateX(62deg)" }}
        animate={reduceMotion ? undefined : { rotate: -360 }}
        transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
        aria-hidden
      >
        <span className="absolute bottom-2 left-[20%] h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_#22d3ee]" />
      </motion.div>
      <motion.div
        className="absolute inset-[14%] rounded-full border border-cyan-300/25 pointer-events-none"
        animate={reduceMotion ? undefined : { rotate: 360 }}
        transition={{ duration: 48, repeat: Infinity, ease: "linear" }}
        aria-hidden
      />

      {/* Smaller DSG globe core */}
      <div className="absolute inset-[22%] sm:inset-[24%] rounded-full pointer-events-none">
        {/* Outer cyan bloom */}
        <motion.div
          className="absolute -inset-[12%] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(34,211,238,0.45) 0%, rgba(59,130,246,0.15) 40%, transparent 70%)",
          }}
          animate={
            reduceMotion
              ? undefined
              : { opacity: [0.55, 1, 0.55], scale: [0.96, 1.06, 0.96] }
          }
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        />

        <motion.div
          className="absolute inset-0 rounded-full overflow-hidden border border-cyan-200/50"
          style={{
            background:
              "radial-gradient(circle at 32% 22%, rgba(255,255,255,0.95) 0%, rgba(186,230,253,0.75) 8%, rgba(34,211,238,0.55) 22%, rgba(30,58,138,0.85) 48%, rgba(15,23,42,0.98) 72%, #020617 100%)",
            boxShadow:
              "inset -16px -16px 40px rgba(0,0,0,0.9), inset 12px 12px 32px rgba(34,211,238,0.35), 0 0 40px rgba(34,211,238,0.55), 0 0 80px rgba(251,146,60,0.25)",
          }}
          animate={
            reduceMotion
              ? undefined
              : {
                  boxShadow: [
                    "inset -16px -16px 40px rgba(0,0,0,0.9), inset 12px 12px 32px rgba(34,211,238,0.35), 0 0 40px rgba(34,211,238,0.55), 0 0 80px rgba(251,146,60,0.2)",
                    "inset -16px -16px 40px rgba(0,0,0,0.9), inset 12px 12px 40px rgba(251,191,36,0.4), 0 0 55px rgba(251,191,36,0.55), 0 0 100px rgba(217,70,239,0.35)",
                    "inset -16px -16px 40px rgba(0,0,0,0.9), inset 12px 12px 32px rgba(34,211,238,0.45), 0 0 50px rgba(34,211,238,0.7), 0 0 90px rgba(34,211,238,0.3)",
                    "inset -16px -16px 40px rgba(0,0,0,0.9), inset 12px 12px 32px rgba(34,211,238,0.35), 0 0 40px rgba(34,211,238,0.55), 0 0 80px rgba(251,146,60,0.2)",
                  ],
                }
          }
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Metallic radar grid (logo spark language) */}
          <motion.svg
            className="absolute inset-0 w-full h-full opacity-95"
            viewBox="0 0 100 100"
            preserveAspectRatio="xMidYMid meet"
            animate={reduceMotion ? undefined : { rotate: 360 }}
            transition={{ duration: 55, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "50% 50%" }}
          >
            {[10, 18, 28, 38, 48].map((r) => (
              <circle
                key={`lat-${r}`}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke="rgba(34,211,238,0.7)"
                strokeWidth="0.55"
                strokeDasharray="2 1.5"
              />
            ))}
            {[10, 18, 28, 38].map((ry, i) => (
              <ellipse
                key={`lon-${ry}`}
                cx="50"
                cy="50"
                rx="48"
                ry={ry}
                fill="none"
                stroke={i % 2 === 0 ? "rgba(251,191,36,0.45)" : "rgba(217,70,239,0.4)"}
                strokeWidth="0.4"
                strokeDasharray="3 2"
              />
            ))}
            <line x1="50" y1="2" x2="50" y2="98" stroke="rgba(34,211,238,0.55)" strokeWidth="0.5" />
            <line x1="2" y1="50" x2="98" y2="50" stroke="rgba(34,211,238,0.35)" strokeWidth="0.4" />
          </motion.svg>

          {/* Central brand spark / fire flare */}
          <motion.div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: "28%",
              height: "28%",
              background:
                "radial-gradient(circle, #fff 0%, #67e8f9 18%, #22d3ee 40%, rgba(251,146,60,0.65) 62%, transparent 75%)",
              boxShadow:
                "0 0 20px #22d3ee, 0 0 40px #fbbf24, 0 0 60px rgba(217,70,239,0.5)",
            }}
            animate={
              reduceMotion
                ? undefined
                : {
                    scale: [1, 1.35, 0.95, 1.2, 1],
                    opacity: [0.85, 1, 0.9, 1, 0.85],
                  }
            }
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            data-testid="landing-orbit-spark"
          />

          {/* Ember particles around the spark */}
          {!reduceMotion &&
            [0, 60, 120, 180, 240, 300].map((deg, i) => (
              <motion.span
                key={`ember-${deg}`}
                className="absolute left-1/2 top-1/2 h-1 w-1 rounded-full"
                style={{
                  background: i % 2 === 0 ? "#fbbf24" : "#22d3ee",
                  boxShadow: i % 2 === 0 ? "0 0 8px #fbbf24" : "0 0 8px #22d3ee",
                }}
                animate={{
                  x: [
                    Math.cos((deg * Math.PI) / 180) * 8,
                    Math.cos((deg * Math.PI) / 180) * 28,
                  ],
                  y: [
                    Math.sin((deg * Math.PI) / 180) * 8,
                    Math.sin((deg * Math.PI) / 180) * 28,
                  ],
                  opacity: [0, 1, 0],
                  scale: [0.6, 1.2, 0.2],
                }}
                transition={{
                  duration: 1.6,
                  repeat: Infinity,
                  delay: i * 0.18,
                  ease: "easeOut",
                }}
              />
            ))}

          {/* Horizon sheen */}
          <div
            className="absolute rounded-full bg-white/30 blur-md"
            style={{ left: "16%", top: "14%", width: "22%", height: "12%", transform: "rotate(-28deg)" }}
          />
        </motion.div>

        {/* Small metallic V badge (logo cue) — decorative, non-interactive */}
        <div
          className="absolute -right-[6%] top-[28%] z-[5] select-none"
          aria-hidden
          data-testid="landing-orbit-v-mark"
        >
          <span
            className="block text-[22px] sm:text-[30px] lg:text-[40px] font-black leading-none"
            style={{
              background: "linear-gradient(160deg, #f8fafc 0%, #94a3b8 45%, #e2e8f0 70%, #fbbf24 100%)",
              WebkitBackgroundClip: "text",
              color: "transparent",
              filter: "drop-shadow(0 0 8px rgba(34,211,238,0.55))",
            }}
          >
            V
          </span>
          <span className="absolute right-[2px] top-[42%] h-0 w-0 border-y-[3px] border-y-transparent border-l-[5px] border-l-amber-400 sm:border-y-[4px] sm:border-l-[6px]" />
        </div>
      </div>

      <p className="absolute -bottom-8 left-0 right-0 text-center text-[9px] sm:text-[10px] uppercase tracking-[0.28em] text-cyan-200/60 pointer-events-none">
        Tap a hub · your dashboard
      </p>

      {/* Hub markers */}
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
            className={`block text-[8px] sm:text-[10px] lg:text-xs font-black uppercase tracking-wide ${h.accent.split(" ")[0]} [text-shadow:0_0_10px_rgba(0,0,0,0.95),0_0_12px_rgba(34,211,238,0.45)] group-hover:scale-110 group-hover:text-white transition-transform whitespace-nowrap`}
          >
            {h.short}
          </span>
          <motion.span
            className="mx-auto mt-0.5 block h-1.5 w-1.5 rounded-full bg-amber-200 shadow-[0_0_12px_rgba(251,191,36,1)]"
            animate={
              reduceMotion
                ? undefined
                : { scale: [1, 1.6, 1], opacity: [0.8, 1, 0.8] }
            }
            transition={{ duration: 2 + (h.id.length % 3) * 0.3, repeat: Infinity }}
          />
        </button>
      ))}
    </div>
  );
}

/**
 * LandingOrbitGlobe — hub planet for Global Vibez DSG.
 * Metallic grid world, atmosphere rim, and a DSG satellite that
 * actually orbits the planet (not a static badge).
 */
import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { GLOBE_HUBS, openHubPath } from "@/hubs/hubRegistry";

const ORBIT_SECONDS = 22;

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

/** DSG brand satellite — V mark + DSG chip */
function DsgSatellite({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className="relative flex flex-col items-center select-none"
      data-testid="landing-orbit-v-mark"
      aria-hidden
    >
      {/* Soft trail glow */}
      <span
        className="absolute -inset-3 rounded-full blur-md opacity-70"
        style={{
          background:
            "radial-gradient(circle, rgba(34,211,238,0.55) 0%, rgba(251,191,36,0.25) 45%, transparent 70%)",
        }}
      />
      <span
        className={`relative font-black leading-none ${
          compact ? "text-[18px] sm:text-[24px]" : "text-[22px] sm:text-[30px] lg:text-[36px]"
        }`}
        style={{
          background:
            "linear-gradient(160deg, #f8fafc 0%, #e2e8f0 40%, #67e8f9 72%, #fbbf24 100%)",
          WebkitBackgroundClip: "text",
          color: "transparent",
          filter: "drop-shadow(0 0 10px rgba(34,211,238,0.75))",
        }}
      >
        V
      </span>
      <span
        className={`relative mt-0.5 rounded-sm border border-cyan-300/50 bg-slate-950/85 px-1 font-black uppercase tracking-[0.2em] text-amber-200 ${
          compact ? "text-[6px] sm:text-[7px]" : "text-[7px] sm:text-[8px] lg:text-[9px]"
        }`}
        style={{ boxShadow: "0 0 12px rgba(34,211,238,0.45)" }}
      >
        DSG
      </span>
      {/* Tiny solar panel wings */}
      <span className="absolute left-[-10px] top-[38%] h-[2px] w-[8px] rounded-full bg-cyan-200/70 sm:left-[-14px] sm:w-[11px]" />
      <span className="absolute right-[-10px] top-[38%] h-[2px] w-[8px] rounded-full bg-cyan-200/70 sm:right-[-14px] sm:w-[11px]" />
    </div>
  );
}

export default function LandingOrbitGlobe() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const stars = useMemo(() => buildStars(64), []);

  return (
    <div
      className="relative mx-auto w-[200px] h-[200px] sm:w-[280px] sm:h-[280px] lg:w-[400px] lg:h-[400px] shrink-0"
      data-testid="landing-orbit-globe"
      aria-label="Global Vibez hub planet — tap a hub to open its dashboard"
    >
      {/* Galaxy stage — cyan / amber brand wash (unified with hero) */}
      <div
        className="absolute -inset-[28%] sm:-inset-[32%] rounded-full overflow-hidden pointer-events-none"
        data-testid="landing-orbit-galaxy"
        aria-hidden
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 72% 62% at 50% 44%, rgba(6,182,212,0.38) 0%, rgba(15,23,42,0.55) 42%, transparent 70%)," +
              "radial-gradient(ellipse 48% 38% at 68% 28%, rgba(251,191,36,0.2) 0%, transparent 55%)," +
              "radial-gradient(ellipse 40% 36% at 28% 72%, rgba(34,211,238,0.18) 0%, transparent 52%)," +
              "radial-gradient(circle at 50% 50%, #020617 0%, #000 100%)",
          }}
        />

        {!reduceMotion && (
          <>
            <motion.div
              className="absolute left-[12%] top-[16%] h-[48%] w-[48%] rounded-full blur-3xl"
              style={{
                background:
                  "radial-gradient(circle, rgba(34,211,238,0.4) 0%, transparent 70%)",
              }}
              animate={{ x: [0, 18, 0], y: [0, -12, 0], opacity: [0.35, 0.8, 0.35] }}
              transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute right-[6%] bottom-[14%] h-[44%] w-[44%] rounded-full blur-3xl"
              style={{
                background:
                  "radial-gradient(circle, rgba(251,191,36,0.28) 0%, transparent 70%)",
              }}
              animate={{ x: [0, -14, 0], y: [0, 10, 0], opacity: [0.28, 0.7, 0.28] }}
              transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
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

        {!reduceMotion && (
          <motion.span
            className="absolute h-0.5 w-20 bg-gradient-to-r from-transparent via-cyan-200 to-transparent"
            style={{ top: "18%", left: "8%", rotate: "-30deg" }}
            animate={{ opacity: [0, 0, 1, 0], x: ["0%", "160%"], y: ["0%", "80%"] }}
            transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 5, ease: "easeOut" }}
          />
        )}

        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, transparent 38%, rgba(0,0,0,0.4) 72%, rgba(0,0,0,0.9) 100%)",
          }}
        />
      </div>

      {/* Orbital rings — thin, brand-aligned */}
      <motion.div
        className="absolute inset-[3%] rounded-full border border-amber-400/30 pointer-events-none"
        style={{ boxShadow: "0 0 20px rgba(251,191,36,0.18)" }}
        animate={reduceMotion ? undefined : { rotate: 360 }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        aria-hidden
      />
      <motion.div
        className="absolute inset-[9%] rounded-full border border-cyan-400/25 pointer-events-none"
        style={{ boxShadow: "0 0 18px rgba(34,211,238,0.16)", transform: "rotateX(64deg)" }}
        animate={reduceMotion ? undefined : { rotate: -360 }}
        transition={{ duration: 32, repeat: Infinity, ease: "linear" }}
        aria-hidden
      />
      <div
        className="absolute inset-[15%] rounded-full border border-cyan-200/15 pointer-events-none"
        aria-hidden
      />

      {/* ── DSG satellite orbit (elliptical squash + upright counter-spin) ── */}
      <div
        className="absolute inset-[4%] z-[6] pointer-events-none"
        style={{ transform: "scaleY(0.52)", transformOrigin: "center" }}
        aria-hidden
      >
        {/* Orbit trail */}
        <div
          className="absolute inset-0 rounded-full border border-cyan-300/35"
          style={{ boxShadow: "0 0 16px rgba(34,211,238,0.2)" }}
        />
        {reduceMotion ? (
          <div
            className="absolute left-[88%] top-1/2"
            style={{ transform: "translate(-50%, -50%) scaleY(1.92)" }}
          >
            <DsgSatellite compact />
          </div>
        ) : (
          <motion.div
            className="absolute inset-0"
            animate={{ rotate: 360 }}
            transition={{ duration: ORBIT_SECONDS, repeat: Infinity, ease: "linear" }}
            data-testid="landing-orbit-satellite-rail"
          >
            {/* Counter-spin keeps the badge upright; nested scale undoes the ellipse squash */}
            <motion.div
              className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2"
              animate={{ rotate: -360 }}
              transition={{ duration: ORBIT_SECONDS, repeat: Infinity, ease: "linear" }}
            >
              <div style={{ transform: "scaleY(1.92)" }}>
                <DsgSatellite />
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>

      {/* ── Planet core ── */}
      <div className="absolute inset-[22%] sm:inset-[24%] rounded-full pointer-events-none z-[4]">
        {/* Atmosphere bloom */}
        <motion.div
          className="absolute -inset-[14%] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(34,211,238,0.5) 0%, rgba(56,189,248,0.18) 38%, transparent 68%)",
          }}
          animate={
            reduceMotion
              ? undefined
              : { opacity: [0.55, 0.95, 0.55], scale: [0.97, 1.05, 0.97] }
          }
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        />

        <motion.div
          className="absolute inset-0 rounded-full overflow-hidden border border-cyan-100/40"
          style={{
            background:
              "radial-gradient(circle at 30% 24%, rgba(255,255,255,0.9) 0%, rgba(186,230,253,0.65) 10%, rgba(14,165,233,0.55) 26%, rgba(30,64,175,0.9) 50%, rgba(15,23,42,0.98) 74%, #020617 100%)",
            boxShadow:
              "inset -18px -20px 42px rgba(0,0,0,0.92), inset 14px 12px 28px rgba(34,211,238,0.32), 0 0 36px rgba(34,211,238,0.5), 0 0 72px rgba(251,191,36,0.18)",
          }}
          animate={
            reduceMotion
              ? undefined
              : {
                  boxShadow: [
                    "inset -18px -20px 42px rgba(0,0,0,0.92), inset 14px 12px 28px rgba(34,211,238,0.32), 0 0 36px rgba(34,211,238,0.5), 0 0 72px rgba(251,191,36,0.18)",
                    "inset -18px -20px 42px rgba(0,0,0,0.92), inset 14px 12px 34px rgba(251,191,36,0.28), 0 0 48px rgba(251,191,36,0.4), 0 0 88px rgba(34,211,238,0.28)",
                    "inset -18px -20px 42px rgba(0,0,0,0.92), inset 14px 12px 28px rgba(34,211,238,0.4), 0 0 42px rgba(34,211,238,0.65), 0 0 80px rgba(34,211,238,0.25)",
                    "inset -18px -20px 42px rgba(0,0,0,0.92), inset 14px 12px 28px rgba(34,211,238,0.32), 0 0 36px rgba(34,211,238,0.5), 0 0 72px rgba(251,191,36,0.18)",
                  ],
                }
          }
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Landmass silhouettes */}
          <svg
            className="absolute inset-0 h-full w-full opacity-80"
            viewBox="0 0 100 100"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden
          >
            <defs>
              <linearGradient id="landFill" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="rgba(16,185,129,0.55)" />
                <stop offset="55%" stopColor="rgba(20,83,45,0.7)" />
                <stop offset="100%" stopColor="rgba(15,23,42,0.85)" />
              </linearGradient>
              <radialGradient id="hotSpot" cx="68%" cy="58%" r="18%">
                <stop offset="0%" stopColor="rgba(251,146,60,0.95)" />
                <stop offset="40%" stopColor="rgba(245,158,11,0.55)" />
                <stop offset="100%" stopColor="rgba(245,158,11,0)" />
              </radialGradient>
            </defs>
            <path
              d="M18 42 C22 28, 38 24, 48 32 C58 40, 52 52, 44 56 C34 62, 22 58, 18 42 Z"
              fill="url(#landFill)"
            />
            <path
              d="M58 30 C66 22, 78 26, 82 36 C86 48, 74 54, 66 48 C58 42, 54 36, 58 30 Z"
              fill="url(#landFill)"
              opacity="0.85"
            />
            <path
              d="M40 68 C48 62, 62 66, 68 74 C72 82, 58 88, 48 84 C40 80, 36 72, 40 68 Z"
              fill="url(#landFill)"
              opacity="0.75"
            />
            <circle cx="68" cy="58" r="16" fill="url(#hotSpot)" />
          </svg>

          {/* Latitude / longitude grid (slow spin) */}
          <motion.svg
            className="absolute inset-0 w-full h-full opacity-90"
            viewBox="0 0 100 100"
            preserveAspectRatio="xMidYMid meet"
            animate={reduceMotion ? undefined : { rotate: 360 }}
            transition={{ duration: 70, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "50% 50%" }}
          >
            {[12, 22, 32, 42, 48].map((r) => (
              <circle
                key={`lat-${r}`}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke="rgba(34,211,238,0.55)"
                strokeWidth="0.45"
                strokeDasharray="2.2 1.6"
              />
            ))}
            {[14, 24, 34].map((ry, i) => (
              <ellipse
                key={`lon-${ry}`}
                cx="50"
                cy="50"
                rx="48"
                ry={ry}
                fill="none"
                stroke={i % 2 === 0 ? "rgba(251,191,36,0.4)" : "rgba(103,232,249,0.35)"}
                strokeWidth="0.35"
                strokeDasharray="3 2"
              />
            ))}
            <line x1="50" y1="2" x2="50" y2="98" stroke="rgba(34,211,238,0.4)" strokeWidth="0.4" />
            <line x1="2" y1="50" x2="98" y2="50" stroke="rgba(34,211,238,0.28)" strokeWidth="0.35" />
          </motion.svg>

          {/* Cloud band */}
          {!reduceMotion && (
            <motion.div
              className="absolute inset-0 opacity-40"
              style={{
                background:
                  "linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.18) 38%, transparent 48%, rgba(255,255,255,0.12) 62%, transparent 78%)",
              }}
              animate={{ x: ["-12%", "12%", "-12%"] }}
              transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
            />
          )}

          {/* Core spark */}
          <motion.div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: "22%",
              height: "22%",
              background:
                "radial-gradient(circle, #fff 0%, #67e8f9 22%, #22d3ee 48%, rgba(251,191,36,0.55) 68%, transparent 78%)",
              boxShadow: "0 0 18px #22d3ee, 0 0 32px rgba(251,191,36,0.55)",
            }}
            animate={
              reduceMotion
                ? undefined
                : { scale: [1, 1.28, 0.96, 1.15, 1], opacity: [0.85, 1, 0.9, 1, 0.85] }
            }
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            data-testid="landing-orbit-spark"
          />

          {/* Terminator / night side */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "linear-gradient(118deg, transparent 42%, rgba(2,6,23,0.35) 58%, rgba(2,6,23,0.72) 100%)",
            }}
          />

          {/* Specular sheen */}
          <div
            className="absolute rounded-full bg-white/35 blur-md"
            style={{
              left: "14%",
              top: "12%",
              width: "26%",
              height: "14%",
              transform: "rotate(-28deg)",
            }}
          />
        </motion.div>
      </div>

      <p className="absolute -bottom-8 left-0 right-0 text-center text-[9px] sm:text-[10px] uppercase tracking-[0.28em] text-cyan-200/65 pointer-events-none">
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

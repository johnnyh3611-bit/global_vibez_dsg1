/**
 * LandingOrbitGlobe — polished hero planet.
 *
 * A 3D-feel sphere with a luminous atmosphere, continent-like landmasses,
 * wireframe latitude/longitude arcs, and a DSG token orbiting on a glowing
 * ring. Ecosystem rooms sit on the planet surface as clickable markers.
 */
import { motion } from "framer-motion";
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
    to: "/viberidez",
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

export default function LandingOrbitGlobe() {
  const navigate = useNavigate();

  return (
    <div
      className="relative mx-auto w-[260px] h-[260px] sm:w-[340px] sm:h-[340px] lg:w-[440px] lg:h-[440px] shrink-0"
      data-testid="landing-orbit-globe"
      aria-label="Global Vibez DSG planet with rooms inside and DSG in orbit"
    >
      {/* Deep outer bloom */}
      <motion.div
        className="absolute -inset-[10%] rounded-full bg-gradient-to-br from-cyan-500/25 via-blue-500/15 to-fuchsia-500/25 blur-3xl"
        animate={{ scale: [1, 1.12, 1], opacity: [0.35, 0.75, 0.35] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />

      {/* Inner halo ring */}
      <div
        className="absolute -inset-[4%] rounded-full border border-cyan-300/10 bg-cyan-400/5 blur-2xl"
        aria-hidden
      />

      {/* Decorative elliptical orbit arcs (SVG) */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        <defs>
          <linearGradient id="arc-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(34,211,238,0.5)" />
            <stop offset="100%" stopColor="rgba(217,70,239,0.5)" />
          </linearGradient>
          <linearGradient id="arc-grad-2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(251,191,36,0.3)" />
            <stop offset="100%" stopColor="rgba(217,70,239,0.3)" />
          </linearGradient>
        </defs>
        <motion.ellipse
          cx="50"
          cy="50"
          rx="46"
          ry="20"
          fill="none"
          stroke="url(#arc-grad)"
          strokeWidth="0.6"
          strokeDasharray="120 40"
          initial={{ rotate: 0 }}
          animate={{ rotate: 360 }}
          transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "50% 50%" }}
        />
        <motion.ellipse
          cx="50"
          cy="50"
          rx="44"
          ry="16"
          fill="none"
          stroke="url(#arc-grad-2)"
          strokeWidth="0.5"
          strokeDasharray="60 80"
          initial={{ rotate: 180 }}
          animate={{ rotate: -180 }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "50% 50%" }}
        />
      </svg>

      {/* DSG circular track + orbiting satellite */}
      <div
        className="absolute inset-[6%] rounded-full border border-cyan-300/20 pointer-events-none"
        data-testid="landing-orbit-dsg-track"
        aria-hidden
      />
      <div
        className="absolute inset-[6%] rounded-full border border-dashed border-amber-300/15 pointer-events-none"
        aria-hidden
      />

      <motion.div
        className="absolute inset-[6%]"
        animate={{ rotate: 360 }}
        transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
        data-testid="landing-orbit-dsg-orb"
        aria-hidden
      >
        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
          <div className="relative flex items-center justify-center">
            <span className="absolute -left-8 top-1/2 h-1 w-6 origin-right -translate-y-1/2 rounded-full bg-gradient-to-r from-transparent to-fuchsia-400/80 blur-[2px]" />
            <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-amber-300 via-fuchsia-500 to-violet-600 shadow-[0_0_40px_rgba(217,70,239,0.95)] flex items-center justify-center border-2 border-white/80">
              <span className="text-[10px] sm:text-xs font-black tracking-widest text-white drop-shadow">
                DSG
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Planet body with 3D shading */}
      <div className="absolute inset-[14%]" aria-hidden>
        {/* Atmosphere shell */}
        <div className="absolute -inset-[3%] rounded-full border border-cyan-300/30 bg-cyan-400/10 blur-md" />

        <motion.div
          className="absolute inset-0 rounded-full border border-cyan-300/40 overflow-hidden"
          style={{
            background:
              "radial-gradient(circle at 26% 22%, rgba(34,211,238,0.65), transparent 42%), radial-gradient(circle at 76% 78%, rgba(217,70,239,0.55), transparent 46%), radial-gradient(circle at 50% 50%, rgba(15,23,42,0.98) 0%, rgba(2,6,23,0.99) 65%, #000 100%)",
            boxShadow:
              "inset -18px -18px 46px rgba(0,0,0,0.9), inset 16px 16px 40px rgba(34,211,238,0.28), 0 0 60px rgba(34,211,238,0.25)",
          }}
          animate={{
            boxShadow: [
              "inset -18px -18px 46px rgba(0,0,0,0.9), inset 16px 16px 40px rgba(34,211,238,0.28), 0 0 60px rgba(34,211,238,0.25)",
              "inset -18px -18px 46px rgba(0,0,0,0.9), inset 16px 16px 50px rgba(217,70,239,0.38), 0 0 80px rgba(217,70,239,0.45)",
              "inset -18px -18px 46px rgba(0,0,0,0.9), inset 16px 16px 40px rgba(34,211,238,0.28), 0 0 60px rgba(34,211,238,0.25)",
            ],
          }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Lat/long wireframe */}
          <div className="absolute inset-[10%] rounded-full border border-cyan-200/20" />
          <div className="absolute inset-[24%] rounded-full border border-fuchsia-300/15 border-dashed" />
          <div
            className="absolute inset-[8%] rounded-full border border-cyan-300/15"
            style={{ transform: "scaleX(0.4)" }}
          />
          <div
            className="absolute inset-[8%] rounded-full border border-fuchsia-300/12"
            style={{ transform: "scaleY(0.4)" }}
          />

          {/* Continent / landmass blobs */}
          <div
            className="absolute rounded-[42%] bg-cyan-400/20 blur-[2px]"
            style={{ left: "16%", top: "24%", width: "40%", height: "24%" }}
          />
          <div
            className="absolute rounded-[48%] bg-fuchsia-400/18 blur-[2px]"
            style={{ left: "50%", top: "46%", width: "34%", height: "28%" }}
          />
          <div
            className="absolute rounded-[50%] bg-emerald-400/16 blur-[2px]"
            style={{ left: "26%", top: "58%", width: "28%", height: "20%" }}
          />
          <div
            className="absolute rounded-[35%] bg-amber-400/14 blur-[2px]"
            style={{ left: "62%", top: "22%", width: "18%", height: "16%" }}
          />

          {/* Shine highlight */}
          <div
            className="absolute rounded-full bg-white/20 blur-xl"
            style={{ left: "22%", top: "18%", width: "18%", height: "12%" }}
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
            className={`block text-[8px] sm:text-[10px] lg:text-xs font-black uppercase tracking-wide ${c.color} drop-shadow-[0_1px_8px_rgba(0,0,0,0.95)] group-hover:scale-110 group-hover:text-white transition-transform whitespace-nowrap`}
          >
            {c.short}
          </span>
          <span className="mx-auto mt-0.5 block h-1.5 w-1.5 rounded-full bg-white/90 shadow-[0_0_12px_rgba(255,255,255,1)] group-hover:scale-150 transition-transform" />
        </button>
      ))}
    </div>
  );
}

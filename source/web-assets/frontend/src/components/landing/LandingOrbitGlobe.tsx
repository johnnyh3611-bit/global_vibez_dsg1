/**
 * LandingOrbitGlobe — Emergent-era hero motif.
 *
 * One planet fills the empty right-hero slot (where game cards used to sit).
 * Ecosystem rooms live INSIDE the planet like countries/continents.
 * A DSG orb circles OUTSIDE around that planet.
 */
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

type Country = {
  label: string;
  short: string;
  to: string;
  /** percent left/top inside the planet disc (0–100) */
  left: string;
  top: string;
  color: string;
  testid: string;
};

/** Rooms drawn as "countries" on the planet surface */
const COUNTRIES: Country[] = [
  {
    label: "Global Vibez",
    short: "Global Vibez",
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
      className="relative mx-auto w-[280px] h-[280px] sm:w-[340px] sm:h-[340px] lg:w-[400px] lg:h-[400px] shrink-0"
      data-testid="landing-orbit-globe"
      aria-label="Global Vibez DSG planet with rooms inside and DSG in orbit"
    >
      {/* Outer glow bloom */}
      <motion.div
        className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-500/40 via-blue-500/25 to-fuchsia-500/40 blur-3xl"
        animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* DSG orbital track (outside the planet) */}
      <div
        className="absolute inset-[4%] rounded-full border border-fuchsia-400/40 pointer-events-none"
        data-testid="landing-orbit-dsg-track"
      />
      <div className="absolute inset-[2%] rounded-full border border-amber-300/20 border-dashed pointer-events-none" />

      {/* DSG orb — circles OUTSIDE around the planet */}
      <motion.div
        className="absolute inset-[4%]"
        animate={{ rotate: 360 }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        data-testid="landing-orbit-dsg-orb"
      >
        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
          <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-amber-300 via-fuchsia-500 to-violet-600 shadow-[0_0_32px_rgba(217,70,239,0.95)] flex items-center justify-center border-2 border-white/60">
            <span className="text-xs sm:text-sm font-black tracking-wider text-white drop-shadow">
              DSG
            </span>
          </div>
        </div>
      </motion.div>

      {/* Planet body */}
      <motion.div
        className="absolute inset-[14%] rounded-full border border-cyan-300/40 overflow-hidden"
        style={{
          background:
            "radial-gradient(circle at 30% 26%, rgba(34,211,238,0.45), transparent 48%), radial-gradient(circle at 70% 70%, rgba(217,70,239,0.32), transparent 46%), radial-gradient(circle at 50% 50%, rgba(15,23,42,0.95), rgba(2,6,23,0.98))",
        }}
        animate={{
          boxShadow: [
            "0 0 32px rgba(34,211,238,0.3)",
            "0 0 64px rgba(217,70,239,0.55)",
            "0 0 32px rgba(34,211,238,0.3)",
          ],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Latitude / longitude wireframe */}
        <div className="absolute inset-[10%] rounded-full border border-cyan-200/20" />
        <div className="absolute inset-[22%] rounded-full border border-fuchsia-300/15 border-dashed" />
        <div
          className="absolute inset-[8%] rounded-full border border-cyan-300/15"
          style={{ transform: "scaleX(0.42)" }}
        />
        <div
          className="absolute inset-[8%] rounded-full border border-fuchsia-300/12"
          style={{ transform: "scaleY(0.42)" }}
        />
        {/* Continent-ish land blobs */}
        <div
          className="absolute rounded-[40%] bg-cyan-400/10 blur-[1px]"
          style={{ left: "18%", top: "28%", width: "38%", height: "22%" }}
        />
        <div
          className="absolute rounded-[45%] bg-fuchsia-400/10 blur-[1px]"
          style={{ left: "52%", top: "48%", width: "30%", height: "26%" }}
        />
        <div
          className="absolute rounded-[50%] bg-emerald-400/10 blur-[1px]"
          style={{ left: "28%", top: "58%", width: "26%", height: "18%" }}
        />

        {/* Countries / rooms inside the planet */}
        {COUNTRIES.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => navigate(c.to)}
            title={c.label}
            data-testid={c.testid}
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2 group"
            style={{ left: c.left, top: c.top }}
          >
            <span
              className={`block px-1.5 py-0.5 text-[9px] sm:text-[11px] lg:text-xs font-black uppercase tracking-wide ${c.color} drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)] group-hover:scale-110 group-hover:text-white transition-transform whitespace-nowrap`}
            >
              {c.short}
            </span>
            <span className="mx-auto mt-0.5 block h-1 w-1 rounded-full bg-white/70 shadow-[0_0_8px_rgba(255,255,255,0.8)] group-hover:scale-150 transition-transform" />
          </button>
        ))}
      </motion.div>
    </div>
  );
}

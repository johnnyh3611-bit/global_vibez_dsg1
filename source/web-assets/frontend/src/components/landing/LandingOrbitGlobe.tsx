/**
 * LandingOrbitGlobe — Emergent-era hero motif restored.
 *
 * Glowing globe beside "GLOBAL VIBEZ DSG" with:
 *  - a DSG-labeled orb orbiting inside the globe
 *  - outer satellites for Dating, Streaming, VibeRidez, Hungry Vibez,
 *    Vibe Venues, DSG TV, and DSG Music
 */
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

type Satellite = {
  label: string;
  short: string;
  to: string;
  /** percent left/top of the globe box (0–100) */
  left: string;
  top: string;
  color: string;
  testid: string;
};

const SATELLITES: Satellite[] = [
  {
    label: "Dating",
    short: "Dating",
    to: "/dating",
    left: "50%",
    top: "2%",
    color: "from-pink-400 to-rose-500",
    testid: "landing-orbit-sat-dating",
  },
  {
    label: "Streaming",
    short: "Stream",
    to: "/streams/live",
    left: "92%",
    top: "28%",
    color: "from-purple-400 to-violet-600",
    testid: "landing-orbit-sat-streaming",
  },
  {
    label: "Vibe Venues",
    short: "Venues",
    to: "/vibe-venues",
    left: "88%",
    top: "68%",
    color: "from-fuchsia-400 to-purple-500",
    testid: "landing-orbit-sat-venues",
  },
  {
    label: "DSG TV",
    short: "TV",
    to: "/media-master",
    left: "50%",
    top: "96%",
    color: "from-violet-400 to-indigo-500",
    testid: "landing-orbit-sat-tv",
  },
  {
    label: "DSG Music",
    short: "Music",
    to: "/dsg/music-group",
    left: "10%",
    top: "72%",
    color: "from-pink-400 to-fuchsia-500",
    testid: "landing-orbit-sat-music",
  },
  {
    label: "Hungry Vibez",
    short: "Hungry",
    to: "/hungry-vibez",
    left: "6%",
    top: "32%",
    color: "from-orange-400 to-rose-500",
    testid: "landing-orbit-sat-hungry",
  },
  {
    label: "VibeRidez",
    short: "Ridez",
    to: "/viberidez",
    left: "18%",
    top: "8%",
    color: "from-emerald-400 to-cyan-500",
    testid: "landing-orbit-sat-ridez",
  },
];

export default function LandingOrbitGlobe() {
  const navigate = useNavigate();

  return (
    <div
      className="relative mx-auto w-[220px] h-[220px] sm:w-[280px] sm:h-[280px] shrink-0"
      data-testid="landing-orbit-globe"
      aria-label="Global Vibez DSG orbit globe"
    >
      {/* Outer glow bloom */}
      <motion.div
        className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-500/35 via-blue-500/25 to-fuchsia-500/35 blur-2xl"
        animate={{ scale: [1, 1.12, 1], opacity: [0.45, 0.85, 0.45] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Globe body */}
      <motion.div
        className="absolute inset-[8%] rounded-full border border-cyan-300/35 overflow-hidden"
        style={{
          background:
            "radial-gradient(circle at 32% 28%, rgba(34,211,238,0.35), transparent 52%), radial-gradient(circle at 72% 68%, rgba(217,70,239,0.28), transparent 48%), rgba(2,6,23,0.82)",
        }}
        animate={{
          boxShadow: [
            "0 0 28px rgba(34,211,238,0.28)",
            "0 0 56px rgba(217,70,239,0.5)",
            "0 0 28px rgba(34,211,238,0.28)",
          ],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Wireframe rings */}
        <div className="absolute inset-[12%] rounded-full border border-cyan-200/25" />
        <div className="absolute inset-[22%] rounded-full border border-fuchsia-300/20 border-dashed" />
        <div
          className="absolute inset-[18%] rounded-full border border-cyan-300/15"
          style={{ transform: "scaleX(0.45)" }}
        />
        <div
          className="absolute inset-[18%] rounded-full border border-fuchsia-300/15"
          style={{ transform: "scaleY(0.45)" }}
        />

        {/* Center mark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-[9px] sm:text-[10px] tracking-[0.35em] uppercase text-cyan-100/80 font-semibold">
              Global Vibez
            </div>
            <div className="text-2xl sm:text-4xl font-black text-white drop-shadow-[0_0_18px_rgba(217,70,239,0.8)]">
              DSG
            </div>
          </div>
        </div>

        {/* Inner DSG orb — orbits inside the globe */}
        <motion.div
          className="absolute inset-[14%]"
          animate={{ rotate: 360 }}
          transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
          data-testid="landing-orbit-dsg-orb"
        >
          <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
            <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-amber-300 via-fuchsia-500 to-violet-600 shadow-[0_0_28px_rgba(217,70,239,0.9)] flex items-center justify-center border border-white/50">
              <span className="text-[10px] sm:text-xs font-black tracking-wider text-white">
                DSG
              </span>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Outer fuchsia track */}
      <div className="absolute inset-[2%] rounded-full border border-fuchsia-400/30 pointer-events-none" />

      {/* Ecosystem satellites */}
      {SATELLITES.map((sat) => (
        <button
          key={sat.label}
          type="button"
          onClick={() => navigate(sat.to)}
          title={sat.label}
          data-testid={sat.testid}
          className="absolute z-10 -translate-x-1/2 -translate-y-1/2 group"
          style={{ left: sat.left, top: sat.top }}
        >
          <span
            className={`flex items-center justify-center min-w-[48px] px-2 py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wide text-white bg-gradient-to-br ${sat.color} shadow-[0_0_16px_rgba(0,0,0,0.5)] border border-white/30 group-hover:scale-110 transition-transform`}
          >
            {sat.short}
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * LandingPlanet — logo-first hub (the simple / correct brand version).
 *
 * • Your Global Vibez logo is the planet / centerpiece
 * • The little glowing dots around it ARE the tabs → dashboards
 * • DSG fireball circles the whole thing on a ring
 * • Galaxy behind — no paper continents, no 1960s flat globe
 */
import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { GLOBE_HUBS, openHubPath, type HubDef } from "@/hubs/hubRegistry";

const ORBIT_SECONDS = 16;

const DOT_STYLE: Record<
  string,
  { glow: string; ring: string; label: string }
> = {
  vibe: { glow: "#2dd4bf", ring: "rgba(45,212,191,0.85)", label: "Home" },
  viberise: { glow: "#c084fc", ring: "rgba(192,132,252,0.85)", label: "VibeRise" },
  vineyards: { glow: "#f9a8d4", ring: "rgba(249,168,212,0.85)", label: "Vibe Vineyards" },
  ridez: { glow: "#22d3ee", ring: "rgba(34,211,238,0.85)", label: "VibeRide" },
  hungry: { glow: "#fb923c", ring: "rgba(251,146,60,0.85)", label: "Hungry Vibez" },
  dating: { glow: "#fb7185", ring: "rgba(251,113,133,0.85)", label: "Dating" },
  cdl: { glow: "#fbbf24", ring: "rgba(251,191,36,0.85)", label: "CDL / GDL" },
};

/** Evenly space hub dots around the logo (logo “circuit nodes”) */
function hubAngle(index: number, total: number) {
  // Start at top, go clockwise
  return -90 + (360 / total) * index;
}

function DsgFireball({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className="relative flex items-center justify-center select-none"
      data-testid="landing-dsg-fireball"
      aria-hidden
    >
      {/* Fire wash */}
      <span
        className="absolute rounded-full blur-md"
        style={{
          width: compact ? 52 : 72,
          height: compact ? 52 : 72,
          background:
            "radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(251,191,36,0.9) 28%, rgba(249,115,22,0.75) 55%, rgba(220,38,38,0.25) 78%, transparent 90%)",
        }}
      />
      <img
        src="/assets/dsg-sun-badge.png"
        alt=""
        className="relative z-[1] object-contain drop-shadow-[0_0_18px_rgba(249,115,22,0.95)]"
        style={{ width: compact ? 40 : 56, height: compact ? 40 : 56 }}
        draggable={false}
      />
    </div>
  );
}

function HubDot({
  hub,
  index,
  total,
  onOpen,
}: {
  hub: HubDef;
  index: number;
  total: number;
  onOpen: (h: HubDef) => void;
}) {
  const style = DOT_STYLE[hub.id] || DOT_STYLE.vibe;
  const angle = hubAngle(index, total);
  // Radius % from center of the stage — sits on the logo rim like circuit nodes
  const r = 46;

  return (
    <button
      type="button"
      data-testid={`landing-hub-dot-${hub.id}`}
      aria-label={`Open ${style.label} dashboard`}
      onClick={() => onOpen(hub)}
      className="absolute left-1/2 top-1/2 z-20 group"
      style={{
        transform: `translate(-50%, -50%) rotate(${angle}deg) translate(${r}%) rotate(${-angle}deg)`,
      }}
    >
      <span
        className="relative flex h-5 w-5 items-center justify-center sm:h-6 sm:w-6 lg:h-7 lg:w-7"
      >
        {/* Outer pulse ring */}
        <span
          className="absolute inset-[-6px] rounded-full opacity-70 group-hover:opacity-100 transition-opacity"
          style={{
            boxShadow: `0 0 16px ${style.glow}, 0 0 28px ${style.glow}`,
            border: `1.5px solid ${style.ring}`,
          }}
        />
        <span
          className="relative h-3 w-3 rounded-full sm:h-3.5 sm:w-3.5 lg:h-4 lg:w-4 transition-transform group-hover:scale-125"
          style={{
            background: `radial-gradient(circle at 35% 30%, #fff 0%, ${style.glow} 45%, ${style.glow} 100%)`,
            boxShadow: `0 0 12px ${style.glow}, 0 0 22px ${style.glow}`,
          }}
        />
      </span>
      <span
        className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap text-[8px] font-black uppercase tracking-wider text-white sm:text-[9px] lg:text-[10px]"
        style={{
          textShadow: `0 0 8px ${style.glow}, 0 1px 3px #000`,
        }}
      >
        {style.label}
      </span>
    </button>
  );
}

export function LandingPlanet() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const hubs = useMemo(() => GLOBE_HUBS, []);
  const onOpen = (hub: HubDef) => navigate(openHubPath(hub));

  return (
    <div
      className="relative mx-auto flex h-[280px] w-full max-w-[520px] items-center justify-center sm:h-[380px] lg:h-[560px] lg:max-w-none"
      data-testid="landing-planet"
      aria-label="Global Vibez logo hub — tap a glowing dot for its dashboard"
    >
      {/* Galaxy stage */}
      <div
        className="absolute inset-0 overflow-hidden rounded-[28px]"
        aria-hidden
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 55% at 50% 45%, rgba(6,182,212,0.35) 0%, rgba(88,28,135,0.22) 38%, transparent 65%)," +
              "radial-gradient(ellipse 40% 30% at 72% 28%, rgba(251,191,36,0.2) 0%, transparent 55%)," +
              "radial-gradient(ellipse 35% 30% at 22% 70%, rgba(239,68,68,0.14) 0%, transparent 50%)," +
              "radial-gradient(circle at 50% 50%, #020617 0%, #000 100%)",
          }}
        />
        {/* Soft star dust */}
        <div
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(1px 1px at 10% 20%, rgba(255,255,255,0.7), transparent)," +
              "radial-gradient(1px 1px at 30% 70%, rgba(255,255,255,0.5), transparent)," +
              "radial-gradient(1.5px 1.5px at 55% 35%, rgba(255,255,255,0.8), transparent)," +
              "radial-gradient(1px 1px at 75% 60%, rgba(167,139,250,0.7), transparent)," +
              "radial-gradient(1px 1px at 85% 25%, rgba(34,211,238,0.7), transparent)," +
              "radial-gradient(1px 1px at 40% 50%, rgba(255,255,255,0.45), transparent)," +
              "radial-gradient(1.5px 1.5px at 62% 80%, rgba(251,191,36,0.55), transparent)",
            backgroundSize: "100% 100%",
          }}
        />
      </div>

      {/* Logo + dots stage */}
      <div className="relative z-10 h-[220px] w-[220px] sm:h-[300px] sm:w-[300px] lg:h-[420px] lg:w-[420px]">
        {/* Orbit rings (logo language) */}
        <motion.div
          className="pointer-events-none absolute inset-[2%] rounded-full border border-amber-400/35"
          style={{ boxShadow: "0 0 28px rgba(251,191,36,0.28)" }}
          animate={reduceMotion ? undefined : { rotate: 360 }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          aria-hidden
        />
        <motion.div
          className="pointer-events-none absolute inset-[10%] rounded-full border border-fuchsia-400/30"
          style={{ boxShadow: "0 0 22px rgba(217,70,239,0.22)" }}
          animate={reduceMotion ? undefined : { rotate: -360 }}
          transition={{ duration: 32, repeat: Infinity, ease: "linear" }}
          aria-hidden
        />
        <motion.div
          className="pointer-events-none absolute inset-[18%] rounded-full border border-cyan-300/25"
          animate={reduceMotion ? undefined : { rotate: 360 }}
          transition={{ duration: 55, repeat: Infinity, ease: "linear" }}
          aria-hidden
        />

        {/* DSG fireball orbit */}
        <div
          className="pointer-events-none absolute inset-[0%] z-30"
          style={{ transform: "scaleY(0.55)", transformOrigin: "center" }}
          aria-hidden
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{
              border: "1px solid rgba(249,115,22,0.35)",
              boxShadow:
                "0 0 20px rgba(239,68,68,0.25), inset 0 0 16px rgba(251,191,36,0.12)",
            }}
          />
          {reduceMotion ? (
            <div
              className="absolute left-[92%] top-1/2"
              style={{ transform: "translate(-50%, -50%) scaleY(1.8)" }}
            >
              <DsgFireball compact />
            </div>
          ) : (
            <motion.div
              className="absolute inset-0"
              animate={{ rotate: 360 }}
              transition={{ duration: ORBIT_SECONDS, repeat: Infinity, ease: "linear" }}
              data-testid="landing-dsg-orbit-rail"
            >
              <motion.div
                className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2"
                animate={{ rotate: -360 }}
                transition={{ duration: ORBIT_SECONDS, repeat: Infinity, ease: "linear" }}
              >
                <div style={{ transform: "scaleY(1.8)" }}>
                  <DsgFireball />
                </div>
              </motion.div>
            </motion.div>
          )}
        </div>

        {/* Center: YOUR logo */}
        <div className="absolute inset-[22%] z-10 flex items-center justify-center">
          <motion.div
            className="absolute -inset-[18%] rounded-full pointer-events-none"
            style={{
              background:
                "radial-gradient(circle, rgba(34,211,238,0.45) 0%, rgba(251,191,36,0.12) 45%, transparent 70%)",
            }}
            animate={
              reduceMotion
                ? undefined
                : { opacity: [0.55, 1, 0.55], scale: [0.96, 1.05, 0.96] }
            }
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          />
          <img
            src="/global-vibez-logo.png?v=12"
            alt="Global Vibez DSG"
            className="relative z-[1] h-full w-full object-contain drop-shadow-[0_0_28px_rgba(34,211,238,0.55)]"
            draggable={false}
          />
        </div>

        {/* Hub dots = the tabs (logo circuit nodes) */}
        {hubs.map((hub, i) => (
          <HubDot
            key={hub.id}
            hub={hub}
            index={i}
            total={hubs.length}
            onOpen={onOpen}
          />
        ))}
      </div>

      <p
        data-testid="landing-planet-cta"
        className="pointer-events-none absolute bottom-1 left-0 right-0 z-20 text-center text-[9px] font-black uppercase tracking-[0.28em] sm:text-[10px]"
        style={{
          background: "linear-gradient(90deg,#fde68a,#fbbf24,#f59e0b,#fde68a)",
          backgroundSize: "200% 100%",
          WebkitBackgroundClip: "text",
          color: "transparent",
          animation: "landingCtaShift 2.4s ease-in-out infinite",
        }}
      >
        Tap a glowing dot · your dashboard
      </p>
      <style>{`
        @keyframes landingCtaShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
}

export default LandingPlanet;

/**
 * LandingPlanet — logo planet + orbiting mini-planets + DSG fireball.
 *
 * Spec (keep it simple / brand-true):
 * • Your logo IS the planet in the center
 * • Hub dots = little glowing circle planets ORBITING the logo (not paper tabs)
 * • DSG fireball / shooting star orbits the whole thing on fire
 * • Outer space / TV look — galaxy behind, zero paper UI cards
 */
import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { GLOBE_HUBS, openHubPath, type HubDef } from "@/hubs/hubRegistry";

const HUB_ORBIT_SECONDS = 42;
const DSG_ORBIT_SECONDS = 14;

type PlanetStyle = {
  label: string;
  core: string;
  mid: string;
  rim: string;
  glow: string;
};

const PLANET: Record<string, PlanetStyle> = {
  vibe: {
    label: "Home",
    core: "#ecfeff",
    mid: "#2dd4bf",
    rim: "#0f766e",
    glow: "#2dd4bf",
  },
  viberise: {
    label: "VibeRise",
    core: "#f5f3ff",
    mid: "#c084fc",
    rim: "#6b21a8",
    glow: "#c084fc",
  },
  vineyards: {
    label: "Vineyards",
    core: "#fff1f2",
    mid: "#f9a8d4",
    rim: "#9d174d",
    glow: "#f9a8d4",
  },
  ridez: {
    label: "VibeRide",
    core: "#ecfeff",
    mid: "#22d3ee",
    rim: "#0e7490",
    glow: "#22d3ee",
  },
  hungry: {
    label: "Hungry",
    core: "#fff7ed",
    mid: "#fb923c",
    rim: "#c2410c",
    glow: "#fb923c",
  },
  dating: {
    label: "Dating",
    core: "#fff1f2",
    mid: "#fb7185",
    rim: "#be123c",
    glow: "#fb7185",
  },
  cdl: {
    label: "CDL",
    core: "#fffbeb",
    mid: "#fbbf24",
    rim: "#b45309",
    glow: "#fbbf24",
  },
};

/** Tiny 3D-looking planet orb — no paper, no card */
function MiniPlanet({
  hub,
  onOpen,
}: {
  hub: HubDef;
  onOpen: (h: HubDef) => void;
}) {
  const p = PLANET[hub.id] || PLANET.vibe;

  return (
    <button
      type="button"
      data-testid={`landing-hub-planet-${hub.id}`}
      aria-label={`Open ${p.label} dashboard`}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(hub);
      }}
      className="group relative flex flex-col items-center outline-none"
    >
      {/* Atmosphere halo */}
      <span
        className="pointer-events-none absolute rounded-full blur-[6px] opacity-80 group-hover:opacity-100 transition-opacity"
        style={{
          width: 34,
          height: 34,
          background: `radial-gradient(circle, ${p.glow}99 0%, transparent 70%)`,
        }}
      />
      {/* Sphere */}
      <span
        className="relative z-[1] block h-5 w-5 rounded-full sm:h-6 sm:w-6 lg:h-7 lg:w-7 transition-transform duration-200 group-hover:scale-125"
        style={{
          background: `radial-gradient(circle at 32% 28%, ${p.core} 0%, ${p.mid} 42%, ${p.rim} 100%)`,
          boxShadow: `
            inset -3px -4px 8px rgba(0,0,0,0.55),
            inset 2px 2px 4px rgba(255,255,255,0.35),
            0 0 14px ${p.glow},
            0 0 28px ${p.glow}88
          `,
        }}
      />
      {/* Soft name — glow text only, never a paper plate */}
      <span
        className="pointer-events-none mt-1 text-[7px] font-black uppercase tracking-[0.18em] text-white/90 sm:text-[8px] lg:text-[9px] opacity-80 group-hover:opacity-100"
        style={{
          textShadow: `0 0 10px ${p.glow}, 0 0 18px ${p.glow}, 0 1px 2px #000`,
        }}
      >
        {p.label}
      </span>
    </button>
  );
}

/** DSG on fire — fireball / shooting-star look */
function DsgFireball() {
  return (
    <div
      className="relative flex items-center justify-center select-none"
      data-testid="landing-dsg-fireball"
      aria-hidden
    >
      {/* Shooting-star trail */}
      <span
        className="absolute right-full top-1/2 h-[3px] w-14 -translate-y-1/2 rounded-full sm:w-20"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(251,191,36,0.15) 30%, rgba(249,115,22,0.75) 78%, rgba(255,255,255,0.95) 100%)",
          filter: "blur(0.5px)",
          boxShadow: "0 0 12px rgba(249,115,22,0.65)",
        }}
      />
      <span
        className="absolute rounded-full blur-md"
        style={{
          width: 64,
          height: 64,
          background:
            "radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(251,191,36,0.9) 28%, rgba(249,115,22,0.7) 55%, rgba(220,38,38,0.2) 78%, transparent 90%)",
        }}
      />
      <img
        src="/assets/dsg-sun-badge.png"
        alt=""
        className="relative z-[1] h-12 w-12 object-contain drop-shadow-[0_0_20px_rgba(249,115,22,1)] sm:h-14 sm:w-14"
        draggable={false}
      />
    </div>
  );
}

export function LandingPlanet() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const hubs = useMemo(() => GLOBE_HUBS, []);
  const onOpen = (hub: HubDef) => navigate(openHubPath(hub));

  return (
    <div
      className="relative mx-auto flex h-[300px] w-full max-w-[520px] items-center justify-center sm:h-[400px] lg:h-[560px] lg:max-w-none"
      data-testid="landing-planet"
      aria-label="Global Vibez logo planet — tap an orbiting mini-planet for its dashboard"
    >
      {/* Deep space / TV look */}
      <div className="absolute inset-0 overflow-hidden rounded-[28px]" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 75% 60% at 50% 48%, rgba(14,165,233,0.28) 0%, rgba(76,29,149,0.2) 36%, transparent 62%)," +
              "radial-gradient(ellipse 42% 32% at 70% 30%, rgba(251,191,36,0.16) 0%, transparent 55%)," +
              "radial-gradient(ellipse 36% 30% at 24% 72%, rgba(244,63,94,0.12) 0%, transparent 52%)," +
              "radial-gradient(circle at 50% 50%, #020617 0%, #000 100%)",
          }}
        />
        {/* Starfield */}
        <div
          className="absolute inset-0 opacity-80"
          style={{
            backgroundImage:
              "radial-gradient(1px 1px at 8% 18%, #fff, transparent)," +
              "radial-gradient(1px 1px at 22% 64%, rgba(255,255,255,0.7), transparent)," +
              "radial-gradient(1.5px 1.5px at 48% 28%, #fff, transparent)," +
              "radial-gradient(1px 1px at 66% 72%, rgba(167,139,250,0.85), transparent)," +
              "radial-gradient(1px 1px at 82% 22%, rgba(34,211,238,0.8), transparent)," +
              "radial-gradient(1px 1px at 36% 46%, rgba(255,255,255,0.5), transparent)," +
              "radial-gradient(1.5px 1.5px at 58% 84%, rgba(251,191,36,0.65), transparent)," +
              "radial-gradient(1px 1px at 90% 55%, #fff, transparent)," +
              "radial-gradient(1px 1px at 14% 88%, rgba(244,114,182,0.7), transparent)",
          }}
        />
      </div>

      {/* Stage */}
      <div className="relative z-10 h-[240px] w-[240px] sm:h-[320px] sm:w-[320px] lg:h-[440px] lg:w-[440px]">
        {/* Soft orbital guidelines (space rings, not UI chrome) */}
        <div
          className="pointer-events-none absolute inset-[6%] rounded-full"
          style={{
            border: "1px solid rgba(34,211,238,0.18)",
            boxShadow: "0 0 24px rgba(34,211,238,0.12)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-[0%] rounded-full"
          style={{
            border: "1px solid rgba(249,115,22,0.22)",
            boxShadow: "0 0 28px rgba(249,115,22,0.12)",
            transform: "scaleY(0.58)",
            transformOrigin: "center",
          }}
          aria-hidden
        />

        {/* ── Hub mini-planets orbiting the logo ── */}
        <div
          className="absolute inset-[6%] z-20"
          data-testid="landing-hub-orbit-rail"
        >
          {reduceMotion ? (
            hubs.map((hub, i) => {
              const a = (-90 + (360 / hubs.length) * i) * (Math.PI / 180);
              const x = 50 + Math.cos(a) * 50;
              const y = 50 + Math.sin(a) * 50;
              return (
                <div
                  key={hub.id}
                  className="absolute"
                  style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)" }}
                >
                  <MiniPlanet hub={hub} onOpen={onOpen} />
                </div>
              );
            })
          ) : (
            <motion.div
              className="absolute inset-0"
              animate={{ rotate: 360 }}
              transition={{ duration: HUB_ORBIT_SECONDS, repeat: Infinity, ease: "linear" }}
            >
              {hubs.map((hub, i) => {
                const angle = -90 + (360 / hubs.length) * i;
                return (
                  <div
                    key={hub.id}
                    className="absolute left-1/2 top-1/2"
                    style={{
                      transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-50%)`,
                    }}
                  >
                    {/* Counter-rotate so planets stay upright while orbiting */}
                    <motion.div
                      animate={{ rotate: -360 }}
                      transition={{
                        duration: HUB_ORBIT_SECONDS,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                    >
                      <MiniPlanet hub={hub} onOpen={onOpen} />
                    </motion.div>
                  </div>
                );
              })}
            </motion.div>
          )}
        </div>

        {/* ── DSG fireball / shooting star — outer orbit ── */}
        <div
          className="pointer-events-none absolute inset-[0%] z-30"
          style={{ transform: "scaleY(0.58)", transformOrigin: "center" }}
          aria-hidden
        >
          {reduceMotion ? (
            <div
              className="absolute left-[94%] top-1/2"
              style={{ transform: "translate(-50%, -50%) scaleY(1.72)" }}
            >
              <DsgFireball />
            </div>
          ) : (
            <motion.div
              className="absolute inset-0"
              animate={{ rotate: 360 }}
              transition={{ duration: DSG_ORBIT_SECONDS, repeat: Infinity, ease: "linear" }}
              data-testid="landing-dsg-orbit-rail"
            >
              <motion.div
                className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2"
                animate={{ rotate: -360 }}
                transition={{ duration: DSG_ORBIT_SECONDS, repeat: Infinity, ease: "linear" }}
              >
                <div style={{ transform: "scaleY(1.72)" }}>
                  <DsgFireball />
                </div>
              </motion.div>
            </motion.div>
          )}
        </div>

        {/* ── Logo = the planet ── */}
        <div className="absolute inset-[26%] z-10 flex items-center justify-center">
          <motion.div
            className="pointer-events-none absolute -inset-[22%] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(34,211,238,0.4) 0%, rgba(251,191,36,0.1) 48%, transparent 70%)",
            }}
            animate={
              reduceMotion
                ? undefined
                : { opacity: [0.55, 1, 0.55], scale: [0.97, 1.04, 0.97] }
            }
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* Soft planet limb around the logo */}
          <div
            className="pointer-events-none absolute inset-[-6%] rounded-full"
            style={{
              boxShadow:
                "0 0 0 1px rgba(125,211,252,0.35), 0 0 40px rgba(34,211,238,0.35), inset 0 0 30px rgba(14,165,233,0.2)",
            }}
          />
          <img
            src="/global-vibez-logo.png?v=12"
            alt="Global Vibez DSG"
            className="relative z-[1] h-full w-full object-contain drop-shadow-[0_0_32px_rgba(34,211,238,0.55)]"
            draggable={false}
          />
        </div>
      </div>

      <p
        data-testid="landing-planet-cta"
        className="pointer-events-none absolute bottom-1 left-0 right-0 z-20 text-center text-[9px] font-black uppercase tracking-[0.28em] sm:text-[10px]"
        style={{
          color: "transparent",
          background: "linear-gradient(90deg,#67e8f9,#f9a8d4,#fbbf24,#67e8f9)",
          backgroundSize: "200% 100%",
          WebkitBackgroundClip: "text",
          animation: "landingCtaShift 2.6s ease-in-out infinite",
          textShadow: "none",
        }}
      >
        Tap an orbiting planet · your dashboard
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

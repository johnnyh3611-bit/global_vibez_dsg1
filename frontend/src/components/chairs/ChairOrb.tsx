/**
 * ChairOrb — glowing spherical chair token with the permanent ID
 * etched on its face. Replaces the older flat square-card design
 * (Feb 2026). Click → holder detail modal.
 *
 * Pure CSS radial-gradient + framer-motion bob/drift. No 3D library.
 *
 * Phase-tinted: Genius=amber, Genesis=emerald, Phase III=cyan,
 * Phase IV=violet, Phase V=fuchsia. Falls back to fuchsia.
 */
import { motion } from "framer-motion";

type Phase = "Genius" | "Genesis" | "Phase III" | "Phase IV" | "Phase V";

interface PhaseTone {
  /** Light highlight applied to the upper-left of the orb (1 of 3 stops). */
  highlight: string;
  /** Mid colour — defines the orb's identity. */
  mid: string;
  /** Deep shadow at the orb's lower-right edge. */
  shadow: string;
  /** Outer glow + ring colour. */
  glow: string;
  /** Tailwind class for the etched-text colour. */
  ink: string;
}

const PHASE_TONES: Record<string, PhaseTone> = {
  Genius:      { highlight: "rgba(254,243,199,0.95)", mid: "#fbbf24", shadow: "#7c2d12", glow: "rgba(251,191,36,0.55)", ink: "text-amber-100" },     // audit:allow-hex
  Genesis:     { highlight: "rgba(209,250,229,0.95)", mid: "#10b981", shadow: "#064e3b", glow: "rgba(16,185,129,0.55)",  ink: "text-emerald-100" },  // audit:allow-hex
  "Phase III": { highlight: "rgba(207,250,254,0.95)", mid: "#06b6d4", shadow: "#164e63", glow: "rgba(6,182,212,0.55)",   ink: "text-cyan-100" },     // audit:allow-hex
  "Phase IV":  { highlight: "rgba(237,233,254,0.95)", mid: "#8b5cf6", shadow: "#3b0764", glow: "rgba(139,92,246,0.55)",  ink: "text-violet-100" },   // audit:allow-hex
  "Phase V":   { highlight: "rgba(250,232,255,0.95)", mid: "#d946ef", shadow: "#581c87", glow: "rgba(217,70,239,0.55)",  ink: "text-fuchsia-100" },  // audit:allow-hex
};

interface Props {
  chairId: number;
  phase: string;
  /** Orb diameter in px (responsive parents can pick xs/sm/md/lg). */
  size?: "xs" | "sm" | "md" | "lg";
  /** Display handle of the holder (rendered under the orb). */
  holderHandle?: string;
  /** weight-multiplier label, e.g. "3×". */
  weightLabel?: string;
  /** Disabled bob animation (e.g. inside a 3D-rotating carousel). */
  staticOrb?: boolean;
  /** Stagger index — slight per-orb delay so they don't bob in sync. */
  staggerIndex?: number;
  onClick?: () => void;
  testId?: string;
}

const SIZES: Record<NonNullable<Props["size"]>, { box: number; rank: string; sub: string; ring: string }> = {
  xs: { box: 64,  rank: "text-[11px]", sub: "text-[8px]",  ring: "ring-1" },
  sm: { box: 88,  rank: "text-sm",     sub: "text-[9px]",  ring: "ring-2" },
  md: { box: 120, rank: "text-lg",     sub: "text-[10px]", ring: "ring-2" },
  lg: { box: 160, rank: "text-2xl",    sub: "text-xs",     ring: "ring-2" },
};

export default function ChairOrb({
  chairId,
  phase,
  size = "md",
  holderHandle,
  weightLabel,
  staticOrb = false,
  staggerIndex = 0,
  onClick,
  testId,
}: Props) {
  const tone = PHASE_TONES[phase] ?? PHASE_TONES["Phase V"];
  const dims = SIZES[size];
  const formattedId = `#${String(chairId).padStart(5, "0")}`;
  const tid = testId ?? `chair-orb-${chairId}`;

  // Gentle random-feeling drift per orb (stagger by index modulo).
  const bobDelay = (staggerIndex % 6) * 0.35;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      data-testid={tid}
      whileHover={onClick ? { scale: 1.08 } : undefined}
      whileTap={onClick ? { scale: 0.96 } : undefined}
      animate={
        staticOrb
          ? undefined
          : { y: [0, -6, 0, 6, 0] }
      }
      transition={
        staticOrb
          ? undefined
          : { duration: 5, repeat: Infinity, ease: "easeInOut", delay: bobDelay }
      }
      className={`group relative inline-flex flex-col items-center gap-2 ${onClick ? "cursor-pointer" : "cursor-default"}`}
      aria-label={`Chair ${formattedId}${holderHandle ? ` held by ${holderHandle}` : ""}`}
    >
      {/* Outer soft glow halo */}
      <span
        className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full blur-2xl pointer-events-none transition-opacity duration-300 group-hover:opacity-90"
        style={{
          width: dims.box * 1.4,
          height: dims.box * 1.4,
          marginTop: -dims.box * 0.2,
          background: `radial-gradient(closest-side, ${tone.glow}, transparent 70%)`,
          opacity: 0.55,
        }}
      />

      {/* The orb itself — radial gradient gives it sphere illusion */}
      <span
        className={`relative ${dims.ring} ring-white/20 rounded-full flex items-center justify-center select-none`}
        style={{
          width: dims.box,
          height: dims.box,
          background: `radial-gradient(circle at 30% 25%, ${tone.highlight} 0%, ${tone.mid} 40%, ${tone.shadow} 85%, #0b0712 100%)`,
          boxShadow: `0 0 28px ${tone.glow}, inset -10px -14px 30px rgba(0,0,0,0.55), inset 8px 10px 24px rgba(255,255,255,0.18)`,
        }}
      >
        {/* Phase mini-tag at the top */}
        <span
          className={`absolute top-[14%] left-1/2 -translate-x-1/2 text-[7px] md:text-[8px] uppercase tracking-[0.28em] font-mono font-bold ${tone.ink} opacity-90`}
        >
          {phase}
        </span>

        {/* Chair # — monospace, etched */}
        <span
          className={`relative ${dims.rank} font-mono font-black ${tone.ink}`}
          style={{
            textShadow:
              "0 1px 2px rgba(0,0,0,0.45), 0 0 6px rgba(255,255,255,0.15)",
            letterSpacing: "0.04em",
          }}
        >
          {formattedId}
        </span>

        {/* Weight badge bottom */}
        {weightLabel ? (
          <span
            className={`absolute bottom-[14%] left-1/2 -translate-x-1/2 text-[8px] md:text-[9px] font-mono font-bold ${tone.ink} opacity-80`}
          >
            {weightLabel}
          </span>
        ) : null}

        {/* Specular hot-spot — gives the sphere its glassy sheen */}
        <span
          className="absolute top-[12%] left-[22%] w-[28%] h-[20%] rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(closest-side, rgba(255,255,255,0.65), transparent 75%)",
            filter: "blur(2px)",
          }}
        />
      </span>

      {/* Holder handle under the orb */}
      {holderHandle ? (
        <span
          className={`relative max-w-full px-1 ${dims.sub} font-bold text-white/90 truncate text-center`}
          style={{ width: dims.box }}
        >
          {holderHandle}
        </span>
      ) : null}
    </motion.button>
  );
}

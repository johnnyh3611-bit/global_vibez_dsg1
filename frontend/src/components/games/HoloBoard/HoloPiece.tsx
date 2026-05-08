/**
 * HoloPiece — "FAT" 3D holographic playing piece (Revolutionary Games
 * Blueprint v1, May 2026).
 *
 *   • Solid-Light material — translucent glass shell with a neon energy
 *     core that pulses on idle.
 *   • Cyan glow + 0.2s haptic vibration on hover (UDA "Ghost-Touch").
 *   • De-Rez capture shatter — when `captured` flips true, the piece
 *     dissolves into digital dust and the wrapper unmounts.
 *   • King coronation — when `kinged` is true, a second orbiting energy
 *     core appears and the shell scales 1.2x.
 *
 * Pure CSS / SVG / framer-motion. No 3D engine, no Materials.* runtime.
 * Drop-in replacement for the existing red/black <div> piece markup in
 * PracticeCheckers, HttpMultiplayerCheckers, and (via `kind`) Chess.
 */
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  /** Piece colour family — drives glow + base hue. */
  color: "red" | "black" | "white";
  /** True when the piece has been kinged (Checkers) or promoted (Chess). */
  kinged?: boolean;
  /**
   * Optional Unicode glyph to render on the face — Chess pieces pass
   * "♛" / "♝" / "♞" / etc. Checkers pieces leave this unset.
   */
  glyph?: string;
  /** When true, plays the De-Rez shatter and unmounts. */
  captured?: boolean;
  /** Selection ring (caller controls). */
  selected?: boolean;
  /** ARIA / data-testid pass-through for QA hooks. */
  testid?: string;
  /**
   * Clamp the piece size (px). Default 44 for a standard 64-px square.
   * Pass a smaller number for mobile boards.
   */
  size?: number;
}

const COLOR_CORE: Record<Props["color"], string> = {
  red: "#ff2d55",
  black: "#3a3a4a",
  white: "#e8e9ee",
};

const COLOR_GLOW: Record<Props["color"], string> = {
  red: "rgba(255, 45, 85, 0.7)",
  black: "rgba(120, 130, 200, 0.55)",
  white: "rgba(255, 255, 255, 0.6)",
};

export const HoloPiece: React.FC<Props> = ({
  color,
  kinged = false,
  glyph,
  captured = false,
  selected = false,
  testid,
  size = 44,
}) => {
  // Track absorbed-glow boost (per spec: "attacker absorbs digital dust
  // to increase its glow intensity"). Bumped externally when this piece
  // captures — for the v1 pass we ramp on selection so the player still
  // gets the visual reward.
  const [boost, setBoost] = useState(false);
  const hoverTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (selected) setBoost(true);
    else {
      const t = window.setTimeout(() => setBoost(false), 1200);
      return () => clearTimeout(t);
    }
  }, [selected]);

  // Ghost-Touch hover handler — light haptic + pulse.
  const onHover = () => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (navigator as any).vibrate?.(20);
      } catch {
        /* vibrate is best-effort — older browsers throw */
      }
    }
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = window.setTimeout(() => setBoost(false), 250);
    setBoost(true);
  };

  // De-Rez shatter on capture — render once then unmount via parent.
  if (captured) {
    return (
      <motion.div
        data-testid={testid ? `${testid}-derez` : undefined}
        className="relative pointer-events-none"
        style={{ width: size, height: size }}
        initial={{ scale: 1, opacity: 1, rotate: 0 }}
        animate={{
          scale: [1, 1.15, 0],
          opacity: [1, 0.6, 0],
          rotate: [0, 12, -12, 0],
          filter: ["blur(0)", "blur(2px)", "blur(6px)"],
        }}
        transition={{ duration: 0.6, ease: [0.45, 0, 0.55, 1] }}
      >
        {/* Digital dust shards */}
        {Array.from({ length: 8 }).map((_, i) => {
          const angle = (i / 8) * Math.PI * 2;
          return (
            <motion.span
              key={i}
              className="absolute top-1/2 left-1/2 w-1 h-1 rounded-full"
              style={{ background: COLOR_CORE[color] }}
              initial={{ x: 0, y: 0, opacity: 1 }}
              animate={{
                x: Math.cos(angle) * 24,
                y: Math.sin(angle) * 24,
                opacity: 0,
              }}
              transition={{ duration: 0.55, delay: 0.05 }}
            />
          );
        })}
      </motion.div>
    );
  }

  const intensity = boost ? 1.5 : 1.0;
  const shellSize = kinged ? size * 1.2 : size;

  return (
    <motion.div
      data-testid={testid}
      onHoverStart={onHover}
      onTouchStart={onHover}
      className="relative cursor-pointer select-none"
      style={{ width: shellSize, height: shellSize }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.04 }}
      transition={{ type: "spring", stiffness: 240, damping: 18 }}
    >
      {/* Selection ring */}
      {selected && (
        <motion.span
          aria-hidden="true"
          className="absolute -inset-1 rounded-full"
          style={{
            boxShadow: `0 0 0 2px ${COLOR_CORE[color]}, 0 0 20px ${COLOR_GLOW[color]}`,
          }}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        />
      )}

      {/* Solid-Light glass shell (translucent + refraction-ish via
          layered radial gradients — no 3D engine required) */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.08) 22%, ${COLOR_CORE[color]}30 55%, ${COLOR_CORE[color]}80 100%)`,
          boxShadow: `inset 0 2px 6px rgba(255,255,255,0.4), inset 0 -4px 10px rgba(0,0,0,0.4), 0 0 ${
            12 * intensity
          }px ${COLOR_GLOW[color]}, 0 4px 12px rgba(0,0,0,0.5)`,
          backdropFilter: "blur(2px)",
        }}
      />

      {/* Pulsing inner energy core */}
      <motion.div
        aria-hidden="true"
        className="absolute rounded-full"
        style={{
          inset: "30%",
          background: COLOR_CORE[color],
          filter: `blur(4px) brightness(${intensity})`,
        }}
        animate={{ opacity: [0.6, 1, 0.6], scale: [0.9, 1.05, 0.9] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* King coronation: second orbiting core (Checkers) */}
      {kinged && !glyph && (
        <motion.div
          aria-hidden="true"
          className="absolute rounded-full"
          style={{
            width: size * 0.18,
            height: size * 0.18,
            top: "10%",
            left: "50%",
            background: "#FFD700",
            boxShadow: "0 0 12px #FFD700",
          }}
          animate={{
            x: [
              -Math.cos(0) * (size * 0.32),
              -Math.cos(Math.PI / 2) * (size * 0.32),
              -Math.cos(Math.PI) * (size * 0.32),
              -Math.cos((3 * Math.PI) / 2) * (size * 0.32),
              -Math.cos(2 * Math.PI) * (size * 0.32),
            ],
            y: [
              Math.sin(0) * (size * 0.32),
              Math.sin(Math.PI / 2) * (size * 0.32),
              Math.sin(Math.PI) * (size * 0.32),
              Math.sin((3 * Math.PI) / 2) * (size * 0.32),
              Math.sin(2 * Math.PI) * (size * 0.32),
            ],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        />
      )}

      {/* Chess glyph or Checkers crown */}
      {(glyph || kinged) && (
        <span
          className="absolute inset-0 flex items-center justify-center font-black select-none"
          style={{
            color: color === "white" ? "#1a1a2e" : "#ffffff",
            fontSize: glyph ? shellSize * 0.55 : shellSize * 0.4,
            textShadow: `0 0 8px ${COLOR_GLOW[color]}, 0 2px 2px rgba(0,0,0,0.6)`,
          }}
          aria-hidden="true"
        >
          {glyph ?? (kinged ? "♛" : "")}
        </span>
      )}
    </motion.div>
  );
};

export default HoloPiece;

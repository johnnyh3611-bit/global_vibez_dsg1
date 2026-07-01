/**
 * HoloSquare — anti-gravity glass grid cell for the Cyber-Casino Chess
 * & Checkers boards (Revolutionary Games Blueprint v1).
 *
 *   • Translucent glass tint with subtle radial highlight.
 *   • Pulses cyan when a legal move target.
 *   • Shockwave ripple animation on `pulseKey` change (fired by the
 *     parent each time a piece lands here).
 *
 * Logic-free: parent drives all game rules. This is purely visual.
 */
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  /** Dark vs light square flag from the parent's board model. */
  dark: boolean;
  /** This square is a legal destination — highlight cyan. */
  legalTarget?: boolean;
  /** This square holds the currently-selected piece — highlight gold. */
  selected?: boolean;
  /** Increment every time a piece *lands* on this square to fire the
   *  shockwave. Anything truthy or a changing key works. */
  pulseKey?: number | string;
  onClick?: () => void;
  disabled?: boolean;
  testid?: string;
  size?: number; // square edge in px (default 64)
  children?: React.ReactNode;
}

export const HoloSquare: React.FC<Props> = ({
  dark,
  legalTarget = false,
  selected = false,
  pulseKey,
  onClick,
  disabled = false,
  testid,
  size = 64,
  children,
}) => {
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    if (pulseKey !== undefined) setPulse((p) => p + 1);
  }, [pulseKey]);

  // Glass tints — dark/light squares both translucent so the floating
  // anti-gravity look comes through.
  const baseBg = dark
    ? "linear-gradient(135deg, rgba(20, 30, 60, 0.92) 0%, rgba(40, 50, 90, 0.82) 100%)"
    : "linear-gradient(135deg, rgba(220, 228, 255, 0.18) 0%, rgba(180, 200, 240, 0.10) 100%)";

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testid}
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      className="relative flex items-center justify-center transition-all"
      style={{
        width: size,
        height: size,
        background: baseBg,
        boxShadow: selected
          ? "inset 0 0 18px rgba(255, 215, 0, 0.6), 0 0 12px rgba(255, 215, 0, 0.4)"
          : legalTarget
            ? "inset 0 0 16px rgba(34, 211, 238, 0.55), 0 0 10px rgba(34, 211, 238, 0.4)"
            : "inset 0 1px 1px rgba(255,255,255,0.08), inset 0 -1px 2px rgba(0,0,0,0.5)",
        cursor: disabled ? "default" : onClick ? "pointer" : "default",
      }}
    >
      {/* Subtle grid line so the floating board reads as a grid */}
      <span
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(rgba(140,180,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(140,180,255,0.05) 1px, transparent 1px)",
          backgroundSize: "8px 8px",
        }}
      />

      {/* Legal-move dot (only when empty + targetable) */}
      {legalTarget && !children && (
        <motion.span
          aria-hidden="true"
          className="absolute w-3 h-3 rounded-full bg-cyan-300"
          style={{ boxShadow: "0 0 12px rgba(34, 211, 238, 0.9)" }}
          animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        />
      )}

      {/* Shockwave ripple on landing */}
      <AnimatePresence>
        {pulse > 0 && (
          <motion.span
            key={`shockwave-${pulse}`}
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none rounded-sm"
            initial={{ opacity: 0.6, scale: 0.6 }}
            animate={{
              opacity: 0,
              scale: 1.6,
              boxShadow: "0 0 24px rgba(34, 211, 238, 0.6) inset",
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>

      {children}
    </motion.button>
  );
};

export default HoloSquare;

/**
 * SpadesStatusBanner — Top-of-screen bouncy notification.
 *
 * Replaces the regular toast spam with the spec'd bouncy "TextMeshPro"
 * style banner from the Spades Superior Build PDF:
 *   • ease-out-bounce scale-in over 0.5s
 *   • Fades out at 2.4s
 *   • Tone-based color (cyan / amber / rose / emerald)
 *
 * Renders absolutely positioned at the top center of the viewport so it
 * floats above the table and never moves layout.
 */
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { StatusMessage } from "./types";

const TONE_BG: Record<StatusMessage["tone"], string> = {
  cyan:    "from-cyan-500/95 to-blue-600/95 border-cyan-300/50",
  amber:   "from-amber-500/95 to-orange-600/95 border-amber-300/50",
  rose:    "from-rose-500/95 to-pink-600/95 border-rose-300/50",
  emerald: "from-emerald-500/95 to-teal-600/95 border-emerald-300/50",
};

interface Props {
  message: StatusMessage | null;
}

export const SpadesStatusBanner: React.FC<Props> = ({ message }) => {
  return (
    <div
      className="pointer-events-none fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-32px)] max-w-md"
      data-testid="spades-status-banner-host"
    >
      <AnimatePresence mode="wait">
        {message ? (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, scale: 0.6, y: -16 }}
            animate={{
              opacity: 1,
              scale: [1.18, 0.94, 1.06, 0.98, 1.0],
              y: 0,
            }}
            exit={{ opacity: 0, scale: 0.85, y: -8 }}
            transition={{
              duration: 0.5,
              times: [0, 0.35, 0.65, 0.85, 1],
              ease: "easeOut",
            }}
            className={`mx-auto px-4 py-2 rounded-2xl bg-gradient-to-r ${TONE_BG[message.tone]} border-2 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.4)]`}
            data-testid="spades-status-banner"
          >
            <p className="text-sm md:text-base font-black text-white text-center uppercase tracking-wider">
              {message.text}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default SpadesStatusBanner;

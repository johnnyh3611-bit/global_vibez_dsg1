/**
 * Cinematic primitives for Phase 3 casino rooms.
 *
 * Three reusable visual flourishes the design agent specified
 * (`v8_PHASE3_BLACKJACK_ROULETTE_BACCARAT_BLUEPRINT.json`):
 *
 *   <ChipToss />     — chip flies from origin to target with rotation + bounce
 *   <BallSpin />     — Roulette ball spinning around a wheel ring then settling
 *   <CardSqueeze />  — Baccarat slow-reveal of a face-down card
 *
 * All three are pure CSS/Framer-Motion overlays. They render nothing
 * unless their `active` prop is true, so dropping them into a casino
 * page costs zero perf when idle.
 */
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { Coins } from 'lucide-react';

/* ──────────────────────────────────────────────────────────────────── */
/* ChipToss — used by Blackjack/Baccarat for placing bets                */
/* ──────────────────────────────────────────────────────────────────── */
interface ChipTossProps {
  active: boolean;
  /** Origin offset (player chip) in px — e.g. { x: 0, y: 200 } */
  from?: { x: number; y: number };
  /** Target offset (bet circle) in px */
  to?: { x: number; y: number };
  /** Display amount (rendered on the chip face) */
  amount?: number;
  onComplete?: () => void;
}

export function ChipToss({
  active, from = { x: 0, y: 200 }, to = { x: 0, y: 0 },
  amount, onComplete,
}: ChipTossProps) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          data-testid="chip-toss"
          initial={{ x: from.x, y: from.y, scale: 0.6, rotate: 0, opacity: 0 }}
          animate={{
            x: [from.x, (from.x + to.x) / 2, to.x],
            y: [from.y, Math.min(from.y, to.y) - 90, to.y],  // arc
            scale: [0.6, 1, 0.85],
            rotate: [0, 540],
            opacity: [0, 1, 1],
          }}
          exit={{ scale: 0.4, opacity: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          onAnimationComplete={onComplete}
          className="pointer-events-none fixed left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2"
        >
          <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#FFD33D] border-2 border-amber-200 shadow-2xl shadow-amber-500/50 flex items-center justify-center">
            <Coins className="w-5 h-5 text-amber-950" />
            {amount !== undefined && (
              <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-black text-amber-200 whitespace-nowrap">
                ₵{amount}
              </span>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* BallSpin — Roulette ball rotating + settling                          */
/* ──────────────────────────────────────────────────────────────────── */
import cardSoundManager from '@/utils/cardSoundManager';

interface BallSpinProps {
  active: boolean;
  /** Final landing angle in degrees (0–360) — where the ball stops. */
  landingAngle?: number;
  /** Wheel diameter in px (ball orbits at 0.42x this radius). */
  size?: number;
  onComplete?: () => void;
}

export function BallSpin({
  active, landingAngle = 0, size = 200, onComplete,
}: BallSpinProps) {
  const orbit = size * 0.42;
  // Audio cues (LOCKED 2026-02-16) — whoosh on launch, click on landing.
  // We fire on `active` toggle; the global cardSoundManager guards itself
  // against fast double-fires via the AudioContext lifecycle.
  const launchedRef = useRef(false);
  useEffect(() => {
    if (active && !launchedRef.current) {
      launchedRef.current = true;
      try { cardSoundManager.playRouletteWhoosh(); } catch { /* no-op */ }
    } else if (!active) {
      launchedRef.current = false;
    }
  }, [active]);

  const handleComplete = () => {
    try { cardSoundManager.playRouletteClick(); } catch { /* no-op */ }
    onComplete?.();
  };

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          data-testid="ball-spin"
          className="pointer-events-none relative"
          style={{ width: size, height: size }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Wheel ring (visual scaffolding — host page can override) */}
          <div
            className="absolute inset-0 rounded-full border-4 border-[#D4AF37]/40"
            style={{ boxShadow: 'inset 0 0 40px rgba(212,175,55,0.2)' }}
          />
          {/* The spinning ball */}
          <motion.div
            initial={{ rotate: 0 }}
            animate={{ rotate: 360 * 6 + landingAngle }}
            transition={{ duration: 3.4, ease: [0.18, 0.85, 0.32, 1] }}
            onAnimationComplete={handleComplete}
            className="absolute inset-0"
            style={{ transformOrigin: '50% 50%' }}
          >
            <div
              className="absolute w-3.5 h-3.5 rounded-full bg-white shadow-2xl shadow-white/60"
              style={{
                top: `calc(50% - ${orbit}px - 7px)`,
                left: 'calc(50% - 7px)',
              }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* CardSqueeze — Baccarat slow-reveal of a card from face-down to up     */
/* ──────────────────────────────────────────────────────────────────── */
interface CardSqueezeProps {
  active: boolean;
  /** Card face content rendered after the squeeze finishes. */
  faceUp?: React.ReactNode;
  onComplete?: () => void;
}

export function CardSqueeze({ active, faceUp, onComplete }: CardSqueezeProps) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          data-testid="card-squeeze"
          initial={{ rotateY: 180, scale: 0.7 }}
          animate={{ rotateY: [180, 110, 60, 30, 0], scale: [0.7, 0.95, 1.05, 1] }}
          transition={{ duration: 1.1, times: [0, 0.4, 0.7, 0.9, 1], ease: 'easeOut' }}
          exit={{ scale: 0.7, opacity: 0 }}
          onAnimationComplete={onComplete}
          style={{ transformStyle: 'preserve-3d', perspective: 800 }}
          className="w-20 h-28 rounded-md border border-white/20 shadow-2xl bg-white flex items-center justify-center"
        >
          {faceUp}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default { ChipToss, BallSpin, CardSqueeze };

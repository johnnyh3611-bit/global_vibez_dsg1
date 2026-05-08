/**
 * TurnIndicator — universal "whose turn is it?" banner.
 *
 * Founder directive (2026-02-16): *"You had to make sure that each person
 * turn, they can see whose turn is being taken."*
 *
 * One reusable component, mounted in every multiplayer game room. Three
 * visual states:
 *   • YOUR TURN  — gold ring + pulsing border, urgency tone
 *   • PARTNER'S  — teal ring (4-player partnership games)
 *   • OPPONENT   — neutral grey + opponent name
 *
 * Optional countdown bar (drift from `expiresAt` if provided). Dismissible
 * via parent unmount; this component does not own its own visibility.
 *
 * Mounts as a sticky banner at the top of the game viewport, just below
 * the safe-area inset so it never overlaps the OS clock.
 */
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, User } from 'lucide-react';

export type TurnRole = 'me' | 'partner' | 'opponent' | 'dealer' | 'system';

interface TurnIndicatorProps {
  /** Whose turn is it? Drives color + copy. */
  role: TurnRole;
  /** Display name shown in the banner — "Aaron" / "Banker" etc. */
  name?: string;
  /**
   * Optional ISO/epoch deadline. When present, shows a 30-sec-style
   * countdown bar. We compute drift client-side; no setInterval leak.
   */
  expiresAt?: number | string | null;
  /**
   * Optional override copy — e.g. "PLACE YOUR BETS" (Roulette),
   * "DEAL" (Baccarat), "DEALER REVEALING" (Blackjack).
   */
  customLabel?: string;
  /**
   * Optional callback fired exactly once when the countdown reaches 0.
   * Used by every game to wire shot-clock auto-action when there's no
   * `<SpadesSeat>` for the user's own seat (south).
   */
  onExpire?: () => void;
  /**
   * Optional className appended to the wrapper for one-off positioning
   * tweaks per room (e.g. shifting below an existing stat bar).
   */
  className?: string;
}

const ROLE_STYLES: Record<TurnRole, { ring: string; bg: string; text: string; label: string }> = {
  me: {
    ring: 'border-[#D4AF37]',
    bg: 'bg-[#D4AF37]/15',
    text: 'text-[#D4AF37]',
    label: 'YOUR TURN',
  },
  partner: {
    ring: 'border-[#00E5C7]',
    bg: 'bg-[#00E5C7]/12',
    text: 'text-[#00E5C7]',
    label: "PARTNER'S TURN",
  },
  opponent: {
    ring: 'border-white/30',
    bg: 'bg-white/5',
    text: 'text-white/80',
    label: "OPPONENT'S TURN",
  },
  dealer: {
    ring: 'border-[#1E40AF]',
    bg: 'bg-[#1E40AF]/15',
    text: 'text-blue-300',
    label: 'DEALER',
  },
  system: {
    ring: 'border-white/15',
    bg: 'bg-white/5',
    text: 'text-white/70',
    label: 'STAND BY',
  },
};

function useCountdown(expiresAt: number | string | null | undefined): { pct: number | null; secondsLeft: number | null } {
  const [pct, setPct] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAt) {
      setPct(null);
      setSecondsLeft(null);
      return;
    }
    const end = typeof expiresAt === 'string' ? Date.parse(expiresAt) : expiresAt;
    const start = Date.now();
    const total = end - start;
    if (total <= 0) {
      setPct(0);
      setSecondsLeft(0);
      return;
    }
    let raf = 0;
    const tick = () => {
      const remaining = end - Date.now();
      const nextPct = Math.max(0, Math.min(100, (remaining / total) * 100));
      setPct(nextPct);
      setSecondsLeft(Math.max(0, Math.ceil(remaining / 1000)));
      if (remaining > 0) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [expiresAt]);

  return { pct, secondsLeft };
}

export function TurnIndicator({
  role, name, expiresAt, customLabel, onExpire, className = '',
}: TurnIndicatorProps) {
  const style = ROLE_STYLES[role];
  const label = customLabel ?? style.label;
  const { pct, secondsLeft } = useCountdown(expiresAt);
  const subtitle = name && (role === 'opponent' || role === 'partner') ? name : null;
  const urgent = secondsLeft !== null && secondsLeft > 0 && secondsLeft <= 3;
  const expired = secondsLeft === 0;

  // Fire onExpire exactly once when the timer hits zero.
  const firedRef = useRef(false);
  useEffect(() => {
    if (!expiresAt) {
      firedRef.current = false;
      return;
    }
    if (expired && !firedRef.current) {
      firedRef.current = true;
      onExpire?.();
    }
  }, [expiresAt, expired, onExpire]);

  return (
    <AnimatePresence>
      <motion.div
        key={`${role}-${label}`}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -20, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 20 }}
        data-testid="turn-indicator"
        data-role={role}
        className={`sticky top-2 z-30 mx-auto max-w-md mb-3 ${className}`}
      >
        <div
          className={`relative overflow-hidden rounded-full border-2 ${
            urgent ? 'border-rose-400 animate-pulse' : style.ring
          } ${urgent ? 'bg-rose-500/15' : style.bg} backdrop-blur-md px-4 py-2 flex items-center justify-center gap-2 shadow-lg`}
        >
          {role === 'me' ? (
            <Clock className={`w-4 h-4 ${urgent ? 'text-rose-300' : style.text}`} />
          ) : (
            <User className={`w-4 h-4 ${style.text}`} />
          )}
          <span
            className={`text-[11px] sm:text-xs font-black uppercase tracking-[0.2em] ${
              urgent ? 'text-rose-200' : style.text
            }`}
            data-testid="turn-indicator-label"
          >
            {label}
          </span>
          {subtitle && (
            <span className="text-[11px] sm:text-xs font-bold text-white/70" data-testid="turn-indicator-name">
              · {subtitle}
            </span>
          )}

          {/* PHYSICAL countdown badge — big bold seconds counter (UDA §2).
              Replaces the old hairline so the player can clearly see how
              long they have left. Pulses red in the final 3 seconds. */}
          {secondsLeft !== null && secondsLeft > 0 && (
            <span
              data-testid="turn-indicator-seconds"
              data-seconds={secondsLeft}
              className={`ml-1 inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 rounded-full text-xs font-black tabular-nums shadow-md ${
                urgent
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'bg-amber-400 text-black'
              }`}
            >
              {secondsLeft}s
            </span>
          )}

          {/* Drain bar — thicker (h-1) so it's actually visible. */}
          {pct !== null && (
            <div
              data-testid="turn-indicator-countdown"
              className="absolute bottom-0 left-0 right-0 h-1 bg-white/10"
            >
              <div
                className={`h-full transition-[width] duration-100 ${
                  urgent ? 'bg-rose-400' : role === 'me' ? 'bg-[#D4AF37]' : 'bg-[#00E5C7]'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default TurnIndicator;

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
import { useEffect, useState } from 'react';
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

function useCountdown(expiresAt: number | string | null | undefined): number | null {
  const [pct, setPct] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAt) {
      setPct(null);
      return;
    }
    const end = typeof expiresAt === 'string' ? Date.parse(expiresAt) : expiresAt;
    const start = Date.now();
    const total = end - start;
    if (total <= 0) {
      setPct(0);
      return;
    }
    let raf = 0;
    const tick = () => {
      const remaining = end - Date.now();
      const next = Math.max(0, Math.min(100, (remaining / total) * 100));
      setPct(next);
      if (remaining > 0) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [expiresAt]);

  return pct;
}

export function TurnIndicator({
  role, name, expiresAt, customLabel, className = '',
}: TurnIndicatorProps) {
  const style = ROLE_STYLES[role];
  const label = customLabel ?? style.label;
  const pct = useCountdown(expiresAt);
  const subtitle = name && (role === 'opponent' || role === 'partner') ? name : null;

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
          className={`relative overflow-hidden rounded-full border-2 ${style.ring} ${style.bg} backdrop-blur-md px-4 py-2.5 flex items-center justify-center gap-2 shadow-lg ${role === 'me' ? 'animate-pulse-soft' : ''}`}
        >
          {role === 'me' ? (
            <Clock className={`w-4 h-4 ${style.text}`} />
          ) : (
            <User className={`w-4 h-4 ${style.text}`} />
          )}
          <span className={`text-[11px] sm:text-xs font-black uppercase tracking-[0.2em] ${style.text}`} data-testid="turn-indicator-label">
            {label}
          </span>
          {subtitle && (
            <span className="text-[11px] sm:text-xs font-bold text-white/70" data-testid="turn-indicator-name">
              · {subtitle}
            </span>
          )}

          {/* Countdown bar — bottom-edge, drains right to left */}
          {pct !== null && (
            <div
              data-testid="turn-indicator-countdown"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10"
            >
              <div
                className={`h-full ${role === 'me' ? 'bg-[#D4AF37]' : 'bg-[#00E5C7]'} transition-[width] duration-100`}
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

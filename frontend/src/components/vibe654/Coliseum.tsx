import React from 'react';
import { motion } from 'framer-motion';
import SeatOrb, { ColiseumSeat } from './SeatOrb';

export type ColiseumVariant = 'coliseum' | 'solo';

interface ColiseumProps {
  variant?: ColiseumVariant;
  seats: ColiseumSeat[];              // rendered around the circle; order = angular order
  activeSeatId?: string | null;       // user_id of the seat currently in the hot seat
  currentUserId?: string;             // "you" marker
  spectatorMode?: boolean;            // if true, seats expose tip + bet actions
  onTipClick?: (seat: ColiseumSeat) => void;
  onBetClick?: (seat: ColiseumSeat) => void;
  centerContent?: React.ReactNode;    // dice tray, pot display, AI dealer, etc.
  leaderboard?: { name: string; score: number }[];
}

/**
 * "The Great Circle" — Celestial Glass table used by every Vibe 654 room.
 *
 * Renders a circular glasshouse vault with seats anchored around its rim.
 * Variants:
 *   - "coliseum" (default) — stadium lighting, emerald-magenta perimeter,
 *     wraparound leaderboard on the glass wall.
 *   - "solo"              — dark marble floor, obsidian walls, single
 *     spotlight on the hot seat, neon data streams flowing up the back wall.
 */
export const Coliseum: React.FC<ColiseumProps> = ({
  variant = 'coliseum',
  seats,
  activeSeatId = null,
  currentUserId,
  spectatorMode = false,
  onTipClick,
  onBetClick,
  centerContent,
  leaderboard = [],
}) => {
  const n = Math.max(1, seats.length);

  const theme =
    variant === 'solo'
      ? {
          floor:
            'bg-[radial-gradient(ellipse_at_center,_#1a1024_0%,_#05020a_65%,_#000_100%)]',
          rim: 'from-amber-500/40 via-fuchsia-500/30 to-cyan-500/40',
          ringGlow: 'shadow-[0_0_120px_-20px_rgba(250,204,21,0.35)]',
          accent: 'text-amber-300',
          wallAccent: 'from-amber-400/20 via-transparent to-fuchsia-400/20',
          label: 'HIGH ROLLER · SOLO VAULT',
        }
      : {
          floor:
            'bg-[radial-gradient(ellipse_at_center,_#072e29_0%,_#020a0f_60%,_#000_100%)]',
          rim: 'from-cyan-400/40 via-emerald-400/40 to-fuchsia-500/40',
          ringGlow: 'shadow-[0_0_120px_-20px_rgba(34,211,238,0.35)]',
          accent: 'text-cyan-200',
          wallAccent: 'from-cyan-400/20 via-transparent to-emerald-400/20',
          label: 'BREADWINNER · 20-PLAYER COLISEUM',
        };

  return (
    <div
      className={`relative w-full aspect-square max-w-[820px] mx-auto ${theme.floor} rounded-full ${theme.ringGlow} overflow-hidden`}
      data-testid={`vibe654-coliseum-${variant}`}
      data-variant={variant}
    >
      {/* outer glass rim */}
      <div
        className={`absolute inset-2 rounded-full bg-gradient-to-tr ${theme.rim} opacity-30`}
        aria-hidden
      />
      {/* inner felt */}
      <div className="absolute inset-8 rounded-full bg-black/70 backdrop-blur-sm border border-white/5" aria-hidden />

      {/* 45° cinematic perspective stripes on the floor */}
      <div
        className="absolute inset-10 rounded-full opacity-20 pointer-events-none"
        style={{
          backgroundImage:
            'repeating-conic-gradient(from 0deg, rgba(255,255,255,0.02) 0deg 4deg, transparent 4deg 18deg)',
        }}
        aria-hidden
      />

      {/* solo-variant: neon data streams up the back wall */}
      {variant === 'solo' && (
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          {Array.from({ length: 8 }).map((_, i) => (
            <motion.div
              key={`stream-${i}`}
              className="absolute w-[2px] bg-gradient-to-t from-transparent via-amber-400/80 to-transparent"
              style={{
                left: `${12 + i * 9}%`,
                top: '10%',
                height: '80%',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0], y: [20, -20, 20] }}
              transition={{ duration: 2.2 + i * 0.15, repeat: Infinity, ease: 'easeInOut' }}
            />
          ))}
        </div>
      )}

      {/* coliseum-variant: live leaderboard on the back glass wall */}
      {variant === 'coliseum' && leaderboard.length > 0 && (
        <div
          className={`absolute top-6 left-1/2 -translate-x-1/2 w-3/5 rounded-lg border border-white/10 bg-gradient-to-r ${theme.wallAccent} backdrop-blur-md px-4 py-2 text-xs uppercase tracking-widest ${theme.accent} pointer-events-none`}
          data-testid="coliseum-glass-leaderboard"
        >
          <div className="flex items-center gap-3 justify-center">
            {leaderboard.slice(0, 3).map((row, i) => (
              <span key={`lb-${i}`} className="flex items-center gap-1">
                <span className="opacity-60">#{i + 1}</span>
                <span className="font-bold">{row.name}</span>
                <span className="opacity-80">{row.score}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* outer label on the glass rim — hidden for 2-seat rooms to avoid
          overlapping the bottom seat caption */}
      {seats.length >= 4 && (
        <div
          className={`absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.5em] ${theme.accent} opacity-70 pointer-events-none`}
        >
          {theme.label}
        </div>
      )}

      {/* center stage — dice tray / pot / AI dealer avatar / CTAs */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        data-testid="coliseum-center-stage"
      >
        <div className="pointer-events-auto w-[46%] aspect-square flex flex-col items-center justify-center text-center">
          {centerContent}
        </div>
      </div>

      {/* seats placed on a circle */}
      {seats.map((seat, idx) => {
        const angleDeg = (360 / n) * idx - 90; // -90 puts seat 0 at the top
        const rad = (angleDeg * Math.PI) / 180;
        const radiusPct = 42; // from center
        const x = 50 + radiusPct * Math.cos(rad);
        const y = 50 + radiusPct * Math.sin(rad);
        return (
          <div
            key={`seat-${seat.user_id || idx}`}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <SeatOrb
              seat={seat}
              isActive={activeSeatId === seat.user_id}
              isSelf={seat.user_id === currentUserId}
              spectatorMode={spectatorMode}
              onTipClick={onTipClick}
              onBetClick={onBetClick}
              variant={variant}
            />
          </div>
        );
      })}
    </div>
  );
};

export default Coliseum;

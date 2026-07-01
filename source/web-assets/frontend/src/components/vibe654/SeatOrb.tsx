import React from 'react';
import { motion } from 'framer-motion';
import { Coins, Flame } from 'lucide-react';

export interface ColiseumSeat {
  user_id: string;
  player_name: string;
  status?: 'active' | 'eliminated' | 'waiting';
  score?: number;
  isHost?: boolean;
  isAI?: boolean;
}

interface SeatOrbProps {
  seat: ColiseumSeat;
  isActive: boolean;
  isSelf: boolean;
  spectatorMode: boolean;
  variant: 'coliseum' | 'solo';
  onTipClick?: (seat: ColiseumSeat) => void;
  onBetClick?: (seat: ColiseumSeat) => void;
}

/**
 * Per-seat orb with neon aura. When it is the seat's turn, the aura ignites
 * cyan (coliseum) or amber (solo) and pulses — the visual cue for "hot seat".
 */
export const SeatOrb: React.FC<SeatOrbProps> = ({
  seat,
  isActive,
  isSelf,
  spectatorMode,
  variant,
  onTipClick,
  onBetClick,
}) => {
  const isEliminated = seat.status === 'eliminated';
  const activeRing =
    variant === 'solo' ? 'ring-amber-400 shadow-[0_0_40px_rgba(251,191,36,0.55)]' : 'ring-cyan-400 shadow-[0_0_40px_rgba(34,211,238,0.55)]';
  const dormantRing = 'ring-white/10';

  return (
    <div className="flex flex-col items-center gap-1">
      <motion.div
        data-testid={`vibe654-seat-${seat.user_id}`}
        data-active={isActive ? 'true' : 'false'}
        animate={
          isActive
            ? { scale: [1, 1.08, 1], opacity: [1, 0.95, 1] }
            : { scale: 1, opacity: isEliminated ? 0.4 : 1 }
        }
        transition={{ duration: 1.6, repeat: isActive ? Infinity : 0, ease: 'easeInOut' }}
        className={`relative w-16 h-16 md:w-20 md:h-20 rounded-full ring-4 ${
          isActive ? activeRing : dormantRing
        } bg-gradient-to-br ${
          seat.isAI
            ? 'from-fuchsia-700 to-indigo-900'
            : isEliminated
            ? 'from-slate-700 to-slate-900'
            : 'from-cyan-700 to-emerald-900'
        } flex items-center justify-center text-white font-black text-lg md:text-xl select-none`}
      >
        {/* avatar initials */}
        <span>{seat.isAI ? 'AI' : (seat.player_name || '?').trim().charAt(0).toUpperCase()}</span>

        {/* host / self badges */}
        {seat.isHost && !seat.isAI && (
          <span className="absolute -top-2 -right-2 text-[10px] bg-yellow-500 text-black rounded-full px-1.5 py-0.5 font-bold shadow">
            HOST
          </span>
        )}
        {isSelf && (
          <span className="absolute -bottom-2 -right-2 text-[10px] bg-emerald-500 text-black rounded-full px-1.5 py-0.5 font-bold shadow">
            YOU
          </span>
        )}

        {/* on-turn spotlight flame for the solo room */}
        {isActive && variant === 'solo' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="absolute -top-6 text-amber-300"
          >
            <Flame className="w-5 h-5" />
          </motion.div>
        )}
      </motion.div>

      {/* name + score pill */}
      <div className="text-[10px] md:text-xs text-center max-w-[96px] leading-tight">
        <div
          className={`font-bold truncate ${
            isEliminated ? 'line-through text-slate-500' : 'text-white/90'
          }`}
        >
          {seat.player_name}
        </div>
        {seat.score !== undefined && (
          <div className="opacity-70">
            {seat.status === 'eliminated' ? 'out' : `${seat.score} pts`}
          </div>
        )}
      </div>

      {/* spectator action buttons */}
      {spectatorMode && !isSelf && !isEliminated && !seat.isAI && (onTipClick || onBetClick) && (
        <div className="flex gap-1 mt-1">
          {onTipClick && (
            <button
              type="button"
              onClick={() => onTipClick(seat)}
              data-testid={`vibe654-seat-tip-${seat.user_id}`}
              className="px-2 py-0.5 rounded-full bg-yellow-500/90 hover:bg-yellow-400 text-black text-[10px] font-bold flex items-center gap-1 shadow"
              title={`Tip ${seat.player_name}`}
            >
              <Coins className="w-3 h-3" /> Tip
            </button>
          )}
          {onBetClick && (
            <button
              type="button"
              onClick={() => onBetClick(seat)}
              data-testid={`vibe654-seat-bet-${seat.user_id}`}
              className="px-2 py-0.5 rounded-full bg-fuchsia-600/90 hover:bg-fuchsia-500 text-white text-[10px] font-bold shadow"
              title={`Side-bet on ${seat.player_name}`}
            >
              Bet
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SeatOrb;

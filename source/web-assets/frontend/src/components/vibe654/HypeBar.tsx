import React from 'react';
import { motion } from 'framer-motion';
import { Flame, Wallet, Megaphone, Loader2 } from 'lucide-react';

export type HypeType = 'fire' | 'cashbag' | 'horn';

interface HypeBarProps {
  onHype: (type: HypeType) => Promise<void> | void;
  fee?: number;
  disabled?: boolean;
  busy?: boolean;
}

const HYPES: { id: HypeType; label: string; icon: React.ReactNode; color: string; badge: string }[] = [
  { id: 'fire', label: 'Heating Up', icon: <Flame className="w-5 h-5" />, color: 'from-orange-500 to-red-600', badge: '🔥' },
  { id: 'cashbag', label: 'Cash Bag', icon: <Wallet className="w-5 h-5" />, color: 'from-yellow-400 to-amber-600', badge: '💰' },
  { id: 'horn', label: '6-5-4 Horn', icon: <Megaphone className="w-5 h-5" />, color: 'from-cyan-500 to-blue-600', badge: '📯' },
];

/**
 * Bottom-fixed hype soundboard. Each button spends ``fee`` ₵ to broadcast its
 * emoji + (future) sound to every viewer of the table.
 */
export const HypeBar: React.FC<HypeBarProps> = ({ onHype, fee = 1, disabled, busy }) => {
  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 bottom-4 z-30 flex items-center gap-3 bg-black/80 backdrop-blur-xl border border-white/10 rounded-full px-4 py-2 shadow-2xl"
      data-testid="vibe654-hype-bar"
    >
      <div className="text-[10px] uppercase tracking-widest text-white/60">Hype · ₵{fee}</div>
      {HYPES.map((h) => (
        <motion.button
          key={h.id}
          type="button"
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.05 }}
          disabled={disabled || busy}
          onClick={() => onHype(h.id)}
          data-testid={`vibe654-hype-${h.id}`}
          aria-label={`Trigger ${h.label} hype (₵${fee})`}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r ${h.color} text-white font-bold text-sm shadow disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <span className="text-base">{h.badge}</span>
          <span className="hidden md:inline">{h.label}</span>
        </motion.button>
      ))}
      {busy && <Loader2 className="w-4 h-4 text-white/60 animate-spin" />}
    </div>
  );
};

export default HypeBar;

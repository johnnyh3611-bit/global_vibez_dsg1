/**
 * SpecialStatePrompt — full-screen prompt for high-stakes special states
 * across the partnership card games.
 *
 * Phase 2 founder ask: "Spades / Bid Whist Nil-bid + Boston special-state
 * full-screen prompts."
 *
 * Three baked variants:
 *   • NIL bid (Spades) — "Nil takes guts. Cover your partner."
 *   • DOUBLE NIL / BLIND NIL — "Risk it all without seeing your hand?"
 *   • BOSTON / BIG BOSTON (Bid Whist) — "Take all 13 tricks for max."
 *
 * Pure presentational — caller controls open/close + commit/cancel.
 */
import { motion, AnimatePresence } from 'framer-motion';
import { Skull, Eye, EyeOff, Crown, X, Check } from 'lucide-react';

export type SpecialStateVariant = 'nil' | 'double-nil' | 'boston' | 'big-boston';

const VARIANTS: Record<SpecialStateVariant, {
  title: string; tagline: string; reward: string; risk: string;
  Icon: any; accent: string; gradient: string;
  testid: string;
}> = {
  nil: {
    title: 'NIL BID',
    tagline: "Take ZERO tricks this hand.",
    reward: '+100 pts on success',
    risk: '–100 pts if you take even ONE trick',
    Icon: Eye,
    accent: '#FFD33D',
    gradient: 'from-yellow-500/20 via-amber-600/30 to-orange-700/20',
    testid: 'special-state-nil',
  },
  'double-nil': {
    title: 'DOUBLE NIL',
    tagline: 'Bid Nil without looking at your hand.',
    reward: '+200 pts on success',
    risk: '–200 pts if you take even ONE trick',
    Icon: EyeOff,
    accent: '#FF8A1F',
    gradient: 'from-orange-500/20 via-rose-600/30 to-fuchsia-700/20',
    testid: 'special-state-double-nil',
  },
  boston: {
    title: 'BOSTON',
    tagline: 'Take ALL 13 tricks this hand.',
    reward: '+200 pts + automatic win',
    risk: 'Massive bag penalty if you fall short',
    Icon: Crown,
    accent: '#D4AF37',
    gradient: 'from-amber-500/20 via-yellow-600/30 to-amber-800/20',
    testid: 'special-state-boston',
  },
  'big-boston': {
    title: 'BIG BOSTON',
    tagline: 'Take all 13 tricks WITHOUT looking at the kitty.',
    reward: '+300 pts + crowning glory',
    risk: 'Catastrophic loss if you miss',
    Icon: Skull,
    accent: '#dc143c',
    gradient: 'from-red-500/20 via-rose-700/30 to-red-900/20',
    testid: 'special-state-big-boston',
  },
};

interface SpecialStatePromptProps {
  open: boolean;
  variant: SpecialStateVariant;
  /** Called when player commits to the special state. */
  onConfirm: () => void;
  /** Called when player backs out. */
  onCancel: () => void;
}

export function SpecialStatePrompt({
  open, variant, onConfirm, onCancel,
}: SpecialStatePromptProps) {
  const v = VARIANTS[variant];
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          data-testid={v.testid}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
        >
          <motion.div
            initial={{ y: 40, scale: 0.96 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 40, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 220, damping: 20 }}
            className={`relative w-full max-w-md rounded-2xl border-2 overflow-hidden bg-gradient-to-br ${v.gradient} shadow-2xl`}
            style={{ borderColor: v.accent }}
          >
            <button
              onClick={onCancel}
              data-testid={`${v.testid}-cancel-x`}
              className="absolute top-3 right-3 p-1 text-white/60 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-8 text-center">
              <v.Icon
                className="w-16 h-16 mx-auto mb-4"
                style={{ color: v.accent }}
              />
              <p className="text-xs uppercase tracking-[0.4em] text-white/60 mb-2">
                Special Bid
              </p>
              <h2
                className="text-4xl font-black tracking-tight mb-3"
                style={{ color: v.accent }}
              >
                {v.title}
              </h2>
              <p className="text-white/85 text-lg mb-6">{v.tagline}</p>

              <div className="space-y-2 mb-6">
                <div className="rounded-lg bg-emerald-500/15 border border-emerald-500/40 px-3 py-2 text-sm text-emerald-300">
                  ✓ {v.reward}
                </div>
                <div className="rounded-lg bg-rose-500/15 border border-rose-500/40 px-3 py-2 text-sm text-rose-300">
                  ✕ {v.risk}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onCancel}
                  data-testid={`${v.testid}-back`}
                  className="px-4 py-3 rounded-xl bg-black/40 border border-white/15 text-white/80 hover:bg-black/60 text-sm font-bold uppercase tracking-widest"
                >
                  Back
                </button>
                <button
                  onClick={onConfirm}
                  data-testid={`${v.testid}-confirm`}
                  className="px-4 py-3 rounded-xl text-black font-black uppercase tracking-widest text-sm flex items-center justify-center gap-1.5 hover:scale-[1.02] transition-transform"
                  style={{ background: v.accent }}
                >
                  <Check className="w-4 h-4" /> Commit
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default SpecialStatePrompt;

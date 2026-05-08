/**
 * BattleModeWagerPanel — Cyber-Casino Battle Mode (Revolutionary Games
 * Blueprint v1, May 2026).
 *
 *   "Tap a piece → set a wager (₵ Vibez Coins). When that piece
 *    captures another piece, the captured piece's wager flows back to
 *    you as a chip-stream animation. When your piece is captured, your
 *    wager goes to the opponent."
 *
 * This component is purely client-side ledger:
 *   • caller passes the piece's stable id + the player's current
 *     credits balance,
 *   • caller wires `onWager(amount)` to debit credits,
 *   • when capture happens, caller fires `BattleModeWagerPanel.absorb`
 *     to play the chip-stream animation + credit the winner.
 *
 * Wagers are stored in a parent-supplied Map<pieceId, amount> so the
 * board logic can read & redistribute on capture without prop-drilling
 * dozens of states.
 */
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Coins, X, Zap } from "lucide-react";

interface Props {
  pieceId: string;
  pieceLabel: string; // e.g. "Black Knight" / "Red Pawn"
  currentWager: number;
  creditsAvailable: number;
  onSetWager: (amount: number) => void;
  onClose: () => void;
}

const PRESETS = [50, 200, 500, 1000, 2500, 5000];

export const BattleModeWagerPanel: React.FC<Props> = ({
  pieceId,
  pieceLabel,
  currentWager,
  creditsAvailable,
  onSetWager,
  onClose,
}) => {
  const [amount, setAmount] = useState<number>(currentWager || 200);

  const commit = () => {
    if (amount < 0 || amount > creditsAvailable) return;
    onSetWager(amount);
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
        data-testid="battle-mode-wager-panel"
      >
        <motion.div
          initial={{ scale: 0.85, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.85, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-3xl p-6 text-white"
          style={{
            background:
              "linear-gradient(135deg, rgba(40, 50, 90, 0.95) 0%, rgba(15, 20, 40, 0.98) 100%)",
            border: "1px solid rgba(34, 211, 238, 0.4)",
            boxShadow:
              "0 0 60px rgba(34, 211, 238, 0.35), inset 0 0 24px rgba(34, 211, 238, 0.18)",
          }}
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-cyan-300">
                Battle Mode · Wager
              </p>
              <h3 className="text-2xl font-black mt-0.5">{pieceLabel}</h3>
              <p className="text-[11px] text-slate-400 font-mono">id: {pieceId}</p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/10 transition"
              aria-label="Close"
              data-testid="battle-mode-close-btn"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Amount entry */}
          <div className="mt-4 mb-3">
            <label className="text-[11px] uppercase tracking-wider text-slate-300 font-bold mb-1 block">
              Stake on this piece
            </label>
            <div className="flex items-center gap-2 rounded-xl bg-black/40 border border-cyan-500/30 px-3 py-2.5">
              <Coins className="w-5 h-5 text-amber-400" />
              <input
                type="number"
                value={amount}
                min={0}
                max={creditsAvailable}
                step={50}
                onChange={(e) => setAmount(Number(e.target.value || 0))}
                className="flex-1 bg-transparent text-2xl font-black tabular-nums focus:outline-none"
                data-testid="battle-mode-amount-input"
              />
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                ₵
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5 font-mono">
              Wallet: {creditsAvailable.toLocaleString()} ₵
            </p>
          </div>

          {/* Quick chips */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setAmount(p)}
                disabled={p > creditsAvailable}
                data-testid={`battle-mode-preset-${p}`}
                className={`py-2 rounded-lg text-sm font-black transition ${
                  amount === p
                    ? "bg-cyan-400 text-black"
                    : "bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                }`}
              >
                {p.toLocaleString()}
              </button>
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={commit}
            disabled={amount < 0 || amount > creditsAvailable}
            data-testid="battle-mode-confirm-btn"
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-fuchsia-500 text-black font-black uppercase tracking-wider shadow-lg shadow-cyan-500/30 hover:scale-[1.02] transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Zap className="w-5 h-5" />
            Lock In Wager
          </button>

          <p className="text-[10px] text-slate-400 mt-3 leading-tight">
            <strong className="text-cyan-300">How it works:</strong> If your piece
            captures, you absorb the captured piece's wager. If your piece is
            captured, your wager flows to your opponent. Wagers reset at the
            end of each match.
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

/**
 * ChipStream — flying chip animation rendered when one player's wager
 * absorbs into another. Anchors to a from-element + a to-element via
 * their bounding rects. Auto-unmounts after 1.4s.
 */
interface StreamProps {
  fromRect: DOMRect;
  toRect: DOMRect;
  amount: number;
  onComplete: () => void;
}

export const ChipStream: React.FC<StreamProps> = ({
  fromRect,
  toRect,
  amount,
  onComplete,
}) => {
  // 1 chip per 100 ₵, capped at 18 so the screen doesn't flood.
  const chipCount = Math.min(18, Math.max(3, Math.round(amount / 100)));
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[160] pointer-events-none"
      data-testid="chip-stream"
    >
      {Array.from({ length: chipCount }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-4 h-4 rounded-full border-2 border-amber-300"
          style={{
            background:
              "radial-gradient(circle at 30% 25%, #fef08a 0%, #fbbf24 60%, #b45309 100%)",
            boxShadow: "0 0 8px rgba(251,191,36,0.7), 0 2px 4px rgba(0,0,0,0.4)",
            left: fromRect.left + fromRect.width / 2,
            top: fromRect.top + fromRect.height / 2,
          }}
          initial={{ x: -8, y: -8, scale: 0.4, opacity: 0 }}
          animate={{
            x: toRect.left + toRect.width / 2 - fromRect.left - fromRect.width / 2 - 8,
            y: toRect.top + toRect.height / 2 - fromRect.top - fromRect.height / 2 - 8,
            scale: [0.4, 1.2, 0.6],
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: 1.1 + Math.random() * 0.3,
            delay: i * 0.04,
            ease: "easeOut",
          }}
          onAnimationComplete={i === chipCount - 1 ? onComplete : undefined}
        />
      ))}
    </div>
  );
};

export default BattleModeWagerPanel;

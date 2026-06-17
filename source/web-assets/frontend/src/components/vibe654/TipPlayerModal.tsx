import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, X } from 'lucide-react';

interface TipPlayerModalProps {
  open: boolean;
  recipientName: string;
  onCancel: () => void;
  onSubmit: (amount: number) => Promise<void> | void;
  busy?: boolean;
}

const PRESETS = [100, 500, 1_000, 5_000, 25_000];

/**
 * Modal for confirming a ₵ tip amount. Matches the spec's spectator tipping
 * pipeline — amount flows to recipient, particle swarm fires over their seat.
 */
export const TipPlayerModal: React.FC<TipPlayerModalProps> = ({
  open,
  recipientName,
  onCancel,
  onSubmit,
  busy,
}) => {
  const [amount, setAmount] = useState<number>(500);

  const submit = useMemo(
    () => async () => {
      if (amount > 0) await onSubmit(amount);
    },
    [amount, onSubmit],
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={onCancel}
          data-testid="vibe654-tip-modal"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-gradient-to-br from-yellow-600 via-amber-700 to-orange-800 rounded-2xl p-6 text-white shadow-2xl border border-yellow-300/40"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Coins className="w-6 h-6 text-yellow-200" />
                <h3 className="text-xl font-black tracking-wide">Tip {recipientName}</h3>
              </div>
              <button
                type="button"
                className="opacity-70 hover:opacity-100"
                onClick={onCancel}
                data-testid="vibe654-tip-cancel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-yellow-100/90 mb-3">
              Send ₵ Vibez Coins directly to this player. A particle explosion fires over their seat for the whole room to see.
            </p>

            <div className="grid grid-cols-5 gap-2 mb-4">
              {PRESETS.map((v) => (
                <button
                  type="button"
                  key={`tp-${v}`}
                  onClick={() => setAmount(v)}
                  data-testid={`vibe654-tip-preset-${v}`}
                  className={`px-2 py-2 rounded-lg text-sm font-bold transition ${
                    amount === v
                      ? 'bg-white text-black shadow-lg'
                      : 'bg-black/40 hover:bg-black/60'
                  }`}
                >
                  ₵{v >= 1000 ? `${v / 1000}k` : v}
                </button>
              ))}
            </div>

            <label className="text-xs font-bold uppercase tracking-widest text-yellow-100/80">
              Custom Amount (₵)
            </label>
            <input
              type="number"
              min={1}
              max={1_000_000}
              step={1}
              value={amount}
              onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value || '0', 10) || 0))}
              data-testid="vibe654-tip-amount-input"
              className="w-full mt-1 mb-4 bg-black/50 border border-yellow-300/30 rounded-lg px-3 py-2 text-lg font-bold text-white focus:outline-none focus:border-yellow-200"
            />

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 px-4 py-3 rounded-lg bg-black/40 hover:bg-black/60 font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={busy || amount <= 0}
                data-testid="vibe654-tip-send"
                className="flex-1 px-4 py-3 rounded-lg bg-white text-black font-black hover:scale-[1.02] transition disabled:opacity-50"
              >
                {busy ? 'Sending…' : `Send ₵${amount.toLocaleString()}`}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TipPlayerModal;
